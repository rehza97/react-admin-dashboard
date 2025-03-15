# data/export_views.py
import csv
import io
import xlsxwriter
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import JournalVentes, EtatFacture, ParcCorporate, CreancesNGBSS
from django.db.models import Q
from datetime import datetime


class BaseExportView(APIView):
    """Base view for export functionality"""
    permission_classes = [IsAuthenticated]

    def get_filename(self, report_type=None):
        now = datetime.now()
        report_type = report_type or self.__class__.__name__.replace(
            'ExportView', '').lower()
        return f"{report_type}_report_{now.strftime('%Y%m%d_%H%M%S')}"

    def get_format(self, request):
        # Default to Excel, but allow CSV
        return request.query_params.get('format', 'xlsx')

    def export_csv(self, data, headers):
        response = HttpResponse(content_type='text/csv')
        filename = self.get_filename()
        response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'

        writer = csv.writer(response)
        writer.writerow(headers)

        for row in data:
            writer.writerow(row)

        return response

    def export_excel(self, data, headers):
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet()

        # Add headers
        for col, header in enumerate(headers):
            worksheet.write(0, col, header)

        # Add data rows
        for row_idx, row_data in enumerate(data, start=1):
            for col_idx, cell_value in enumerate(row_data):
                worksheet.write(row_idx, col_idx, cell_value)

        workbook.close()

        # Prepare response
        output.seek(0)
        response = HttpResponse(output.read(),
                                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        filename = self.get_filename()
        response['Content-Disposition'] = f'attachment; filename="{filename}.xlsx"'

        return response


class RevenueCollectionExportView(BaseExportView):
    """Export view for revenue collection data"""

    def get(self, request):
        # Get filter parameters
        year = request.query_params.get('year', datetime.now().year)
        month = request.query_params.get('month')
        dot = request.query_params.get('dot')

        # Get revenue data
        revenue_query = JournalVentes.objects.all()

        # Apply filters
        if year:
            revenue_query = revenue_query.filter(invoice_date__year=year)
        if month:
            revenue_query = revenue_query.filter(invoice_date__month=month)
        if dot:
            revenue_query = revenue_query.filter(organization__icontains=dot)

        # Get collection data
        collection_query = EtatFacture.objects.all()

        # Apply the same filters
        if year:
            collection_query = collection_query.filter(invoice_date__year=year)
        if month:
            collection_query = collection_query.filter(
                invoice_date__month=month)
        if dot:
            collection_query = collection_query.filter(
                organization__icontains=dot)

        # Prepare export data
        headers = ['Invoice ID', 'Date', 'DOT', 'Customer',
                   'Revenue Amount', 'Invoiced Amount', 'Collection Amount']
        export_data = []

        # Add revenue data
        for rev in revenue_query:
            # Try to find matching collection record
            collection = collection_query.filter(
                invoice_number=rev.invoice_number).first()
            collection_amount = collection.collection_amount if collection else 0
            invoiced_amount = collection.total_amount if collection else 0

            export_data.append([
                rev.invoice_number,
                rev.invoice_date.strftime(
                    '%Y-%m-%d') if rev.invoice_date else '',
                rev.organization,
                rev.customer,
                float(rev.revenue_amount),
                float(invoiced_amount),
                float(collection_amount)
            ])

        # Export based on requested format
        export_format = self.get_format(request)
        if export_format == 'csv':
            return self.export_csv(export_data, headers)
        else:
            return self.export_excel(export_data, headers)


class CorporateParkExportView(BaseExportView):
    """Export view for corporate park data"""

    def get(self, request):
        # Get filter parameters
        state = request.query_params.get('state')
        offer_name = request.query_params.get('offer_name')

        # Get corporate park data
        query = ParcCorporate.objects.filter(
            ~Q(customer_l3_code__in=['5', '57']),
            ~Q(offer_name__icontains='Moohtarif'),
            ~Q(offer_name__icontains='Solutions Hebergements'),
            ~Q(subscriber_status='Predeactivated')
        )

        # Apply filters
        if state:
            query = query.filter(state=state)
        if offer_name:
            query = query.filter(offer_name=offer_name)

        # Prepare export data
        headers = ['ID', 'Customer', 'Customer L1', 'Customer L2', 'Creation Date',
                   'State', 'Offer Name', 'Telecom Type', 'Subscriber Status']
        export_data = []

        for item in query:
            export_data.append([
                item.id,
                item.customer_fullname,
                item.customer_l1_desc,
                item.customer_l2_desc,
                item.creation_date.strftime(
                    '%Y-%m-%d') if item.creation_date else '',
                item.state,
                item.offer_name,
                item.telecom_type,
                item.subscriber_status
            ])

        # Export based on requested format
        export_format = self.get_format(request)
        if export_format == 'csv':
            return self.export_csv(export_data, headers)
        else:
            return self.export_excel(export_data, headers)


class ReceivablesExportView(BaseExportView):
    """Export view for receivables data"""

    def get(self, request):
        # Get filter parameters
        year = request.query_params.get('year', datetime.now().year)
        month = request.query_params.get('month')
        dot = request.query_params.get('dot')

        # Get receivables data
        query = CreancesNGBSS.objects.all()

        # Apply filters
        if year:
            query = query.filter(year=year)
        if month:
            query = query.filter(month=month)
        if dot and dot.strip():
            # Try to find DOT by name, code or ID
            try:
                if dot.isdigit():
                    query = query.filter(Q(dot_id=int(dot)) | Q(dot_code=dot))
                else:
                    # Try to match by code or name
                    query = query.filter(
                        Q(dot_code__icontains=dot) | Q(dot_code=dot))
            except:
                # Fallback to string comparison
                query = query.filter(dot_code=dot)

        # Prepare export data
        headers = ['Year', 'Month', 'DOT', 'Customer Category', 'Product',
                   'Invoice Amount', 'Open Amount', 'Creance Brut', 'Creance Net']
        export_data = []

        for item in query:
            export_data.append([
                item.year,
                item.month,
                item.dot_code,
                item.customer_lev1,
                item.product,
                float(item.invoice_amount) if item.invoice_amount else 0,
                float(item.open_amount) if item.open_amount else 0,
                float(item.creance_brut) if item.creance_brut else 0,
                float(item.creance_net) if item.creance_net else 0
            ])

        # Export based on requested format
        export_format = self.get_format(request)
        if export_format == 'csv':
            return self.export_csv(export_data, headers)
        else:
            return self.export_excel(export_data, headers)
