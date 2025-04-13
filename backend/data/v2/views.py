import logging
import traceback
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
import uuid
from datetime import datetime
from io import BytesIO
import threading
from concurrent.futures import ThreadPoolExecutor
import os

from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.pagination import PageNumberPagination

from ..models import (
    Invoice, FacturationManuelle, JournalVentes, EtatFacture,
    ParcCorporate, CreancesNGBSS, CAPeriodique, CANonPeriodique,
    CADNT, CARFD, CACNT, DOT, Anomaly, ProgressTracker
)
from ..serializers import (
    InvoiceSerializer, FacturationManuelleSerializer, JournalVentesSerializer,
    EtatFactureSerializer, ParcCorporateSerializer, CreancesNGBSSSerializer,
    CAPeriodiqueSerializer, CANonPeriodiqueSerializer, CADNTSerializer,
    CARFDSerializer, CACNTSerializer, AnomalySerializer
)
from ..file_processor import FileProcessor, FileTypeDetector
from .optimized_file_processor import OptimizedFileProcessor
from .optimized_processor_integration import OptimizedBulkProcessor
from ..data_processor import DataProcessor
from ..utils import clean_dot_value

logger = logging.getLogger(__name__)

# Reuse the pagination class from V1


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000


class HealthCheckView(APIView):
    """
    Simple view to check if the API is running.
    This endpoint can be used for health monitoring.
    """
    permission_classes = []  # Allow access without authentication

    def get(self, request):
        return Response(
            {"status": "ok", "message": "API V2 is running"},
            status=status.HTTP_200_OK
        )


class InvoiceUploadView(generics.CreateAPIView):
    """
    View for uploading invoice files.
    V2: We'll save the raw file without processing/cleaning it initially.
    """
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def post(self, request, *args, **kwargs):
        try:
            # Add the user to the request data
            request.data._mutable = True
            request.data['uploaded_by'] = request.user.id
            request.data._mutable = False

            # Create a serializer with the request data
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                # Save the instance (file is saved to disk)
                instance = serializer.save(
                    uploaded_by=request.user,
                    status='pending'  # Set status to pending, no processing yet
                )

                # Return success response with the invoice ID
                return Response({
                    'status': 'success',
                    'message': 'File uploaded successfully',
                    'invoice_id': instance.id,
                    'invoice_number': instance.invoice_number,
                }, status=status.HTTP_201_CREATED)
            else:
                # Return validation errors
                return Response({
                    'status': 'error',
                    'message': 'Invalid data',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'status': 'error',
                'message': f"An error occurred: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InvoiceListView(generics.ListAPIView):
    """
    View for listing invoices.
    V2: Add cleaning_status filter option.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        queryset = Invoice.objects.filter(uploaded_by=self.request.user)

        # Add filters for cleaning status
        status = self.request.query_params.get('status')
        if status:
            queryset = queryset.filter(status=status)

        # Include raw data option
        include_raw = self.request.query_params.get(
            'include_raw', 'false').lower() == 'true'
        if not include_raw:
            # If not including raw, filter out unprocessed data
            queryset = queryset.exclude(status='pending')

        # Filter out invoices with missing files if requested
        exclude_missing = self.request.query_params.get(
            'exclude_missing_files', 'false').lower() == 'true'
        if exclude_missing:
            # Get all invoices and filter out those with missing files
            valid_invoices = []
            for invoice in queryset:
                if invoice.file and os.path.exists(invoice.file.path):
                    valid_invoices.append(invoice.id)

            if valid_invoices:
                queryset = queryset.filter(id__in=valid_invoices)
            else:
                queryset = Invoice.objects.none()  # Return empty queryset if no valid files found

        return queryset


class InvoiceProcessView(APIView):
    """
    View for processing an invoice.
    V2: This will now just detect file type and save the raw data to the database.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        try:
            # Get the invoice
            invoice = Invoice.objects.get(id=pk, uploaded_by=request.user)

            # Update invoice status
            invoice.status = 'processing'
            invoice.save()

            # Create a progress tracker
            progress_tracker = ProgressTracker.objects.create(
                invoice=invoice,
                operation_type='process',
                status='in_progress',
                progress_percent=0.0,
                current_item=0,
                total_items=100,
                message='Starting file processing'
            )

            # Start processing in a background thread
            def process_file():
                try:
                    # Process the file to detect the type and extract data
                    file_path = invoice.file.path
                    file_processor = FileProcessor()
                    file_type_detector = FileTypeDetector()

                    # Update progress
                    progress_tracker.progress_percent = 10.0
                    progress_tracker.message = 'Detecting file type'
                    progress_tracker.save()

                    # Detect file type
                    file_type, confidence, _ = file_type_detector.detect_file_type(
                        file_path, invoice.file.name)

                    # Update invoice with file type
                    invoice.file_type = file_type
                    invoice.detection_confidence = confidence
                    invoice.save()

                    # Update progress
                    progress_tracker.progress_percent = 20.0
                    progress_tracker.message = f'File type detected: {file_type}'
                    progress_tracker.save()

                    # Process the file to extract raw data
                    raw_data, summary = file_processor.process_file(
                        file_path, invoice.file.name)

                    # Update progress
                    progress_tracker.progress_percent = 50.0
                    progress_tracker.message = 'Extracted raw data from file'
                    progress_tracker.save()

                    # Save the raw data to the database based on file type
                    # Each file type is now handled in its own transaction within _save_raw_data
                    self._save_raw_data(invoice, file_type, raw_data)

                    # Update progress
                    progress_tracker.progress_percent = 90.0
                    progress_tracker.message = 'Raw data saved to database'
                    progress_tracker.save()

                    # Update invoice status
                    invoice.status = 'preview'  # Set to preview since it's not cleaned yet
                    invoice.processed_date = timezone.now()
                    invoice.save()

                    # Complete the progress tracker
                    progress_tracker.progress_percent = 100.0
                    progress_tracker.status = 'completed'
                    progress_tracker.message = 'File processing completed successfully'
                    progress_tracker.save()

                except Exception as e:
                    logger.error(f"Error processing file: {str(e)}")
                    logger.error(traceback.format_exc())

                    # Update invoice status on error
                    invoice.status = 'failed'
                    invoice.error_message = str(e)
                    invoice.save()

                    # Update progress tracker on error
                    progress_tracker.status = 'failed'
                    progress_tracker.message = f'Error: {str(e)}'
                    progress_tracker.save()

            # Start the processing thread
            thread = threading.Thread(target=process_file)
            thread.start()

            return Response({
                'status': 'success',
                'message': 'File processing started',
                'invoice_id': invoice.id,
                'progress_tracker_id': progress_tracker.id
            })

        except Invoice.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Invoice not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error processing invoice: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'status': 'error',
                'message': f"An error occurred: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _save_raw_data(self, invoice, file_type, raw_data):
        """
        Save the raw data to the database based on file type.
        V2: This saves the raw data without cleaning/filtering.
        Each file type is saved in its own transaction to prevent one error from causing the entire process to fail.
        """
        try:
            if file_type == 'facturation_manuelle':
                with transaction.atomic():
                    self._save_facturation_manuelle(invoice, raw_data)
            elif file_type == 'journal_ventes':
                with transaction.atomic():
                    self._save_journal_ventes(invoice, raw_data)
            elif file_type == 'etat_facture':
                with transaction.atomic():
                    self._save_etat_facture(invoice, raw_data)
            elif file_type == 'parc_corporate':
                # For parc_corporate, handle without transaction to prevent atomic issues
                # Records that fail will be logged but won't stop processing
                self._save_parc_corporate(invoice, raw_data)
            elif file_type == 'creances_ngbss':
                with transaction.atomic():
                    self._save_creances_ngbss(invoice, raw_data)
            elif file_type == 'ca_periodique':
                with transaction.atomic():
                    self._save_ca_periodique(invoice, raw_data)
            elif file_type == 'ca_non_periodique':
                with transaction.atomic():
                    self._save_ca_non_periodique(invoice, raw_data)
            elif file_type == 'ca_dnt':
                with transaction.atomic():
                    self._save_ca_dnt(invoice, raw_data)
            elif file_type == 'ca_rfd':
                with transaction.atomic():
                    self._save_ca_rfd(invoice, raw_data)
            elif file_type == 'ca_cnt':
                with transaction.atomic():
                    self._save_ca_cnt(invoice, raw_data)
            elif file_type == 'unknown':
                # Log the issue but don't raise an exception
                logger.warning(
                    f"Unknown file type for invoice {invoice.id}. Cannot process data.")
                # Update invoice status to indicate the issue
                invoice.status = 'failed'
                invoice.error_message = "Unknown file type. Could not determine how to process this file."
                invoice.save()
                # Return without raising an exception
                return
            else:
                raise ValueError(f"Unknown file type: {file_type}")
        except Exception as e:
            logger.error(
                f"Error saving data for file type {file_type}: {str(e)}")
            # Re-raise to be handled by the outer transaction
            raise

    def _parse_date(self, date_value):
        """Parse a date value from various formats"""
        if not date_value:
            return None

        if isinstance(date_value, datetime):
            return date_value.date()

        if isinstance(date_value, str):
            # Try to handle ISO format with T separator first
            if 'T' in date_value:
                try:
                    return datetime.fromisoformat(date_value.replace('Z', '+00:00')).date()
                except ValueError:
                    pass

            # Try to handle French abbreviated month formats like "20 févr. 24"
            french_months = {
                'janv.': '01', 'févr.': '02', 'mars': '03', 'avr.': '04',
                'mai': '05', 'juin': '06', 'juil.': '07', 'août': '08',
                'sept.': '09', 'oct.': '10', 'nov.': '11', 'déc.': '12'
            }

            for month_fr, month_num in french_months.items():
                if month_fr in date_value.lower():
                    try:
                        # Extract day and year
                        parts = date_value.split()
                        day = parts[0]
                        year = parts[-1]

                        # Handle 2-digit year
                        if len(year) == 2:
                            year = f"20{year}"

                        # Create a standard format date
                        standard_date = f"{day}/{month_num}/{year}"
                        return datetime.strptime(standard_date, "%d/%m/%Y").date()
                    except (ValueError, IndexError):
                        pass

            # Try different date formats
            formats = [
                '%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y',
                '%d.%m.%Y', '%d %b %Y', '%d %B %Y',
                '%m/%d/%Y', '%Y/%m/%d', '%d-%b-%Y',
                '%d %b. %Y', '%d %B, %Y'
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(date_value, fmt).date()
                except ValueError:
                    continue

        return None

    def _parse_datetime(self, datetime_value):
        """Parse a datetime value from various formats"""
        if not datetime_value:
            return None

        if isinstance(datetime_value, datetime):
            # If it's already a datetime, make it timezone-aware if it's naive
            if timezone.is_naive(datetime_value):
                return timezone.make_aware(datetime_value)
            return datetime_value

        if isinstance(datetime_value, str):
            # Try different datetime formats
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%d/%m/%Y %H:%M:%S',
                '%d-%m-%Y %H:%M:%S',
                '%d.%m.%Y %H:%M:%S',
                '%d %b %Y %H:%M:%S',
                '%d %B %Y %H:%M:%S'
            ]
            for fmt in formats:
                try:
                    # Parse the string to datetime and make it timezone-aware
                    naive_dt = datetime.strptime(datetime_value, fmt)
                    return timezone.make_aware(naive_dt)
                except ValueError:
                    continue

        return None

    def _save_facturation_manuelle(self, invoice, data):
        """Save Facturation Manuelle data without filtering/cleaning"""
        saved_count = 0

        # Log first row for debugging
        if data and len(data) > 0:
            logger.info(f"First row of Facturation Manuelle data: {data[0]}")
            logger.info(
                f"Available keys in first row: {list(data[0].keys() if isinstance(data[0], dict) else [])}")

        # Field mapping (supports both lowercase and uppercase fields)
        field_mapping = {
            # Month field
            'month': 'month', 'mois': 'month', 'MOIS': 'month', 'MONTH': 'month',

            # Invoice date field
            'invoice_date': 'invoice_date', 'date_facture': 'invoice_date',
            'DATE_FACTURE': 'invoice_date', 'date facture': 'invoice_date',

            # Department field
            'department': 'department', 'departement': 'department',
            'DEPTS': 'department', 'DEPT': 'department', 'dépts': 'department',

            # Invoice number field
            'invoice_number': 'invoice_number', 'n_factures': 'invoice_number',
            'N_FACTURES': 'invoice_number', 'n° facture': 'invoice_number',

            # Fiscal year field
            'fiscal_year': 'fiscal_year', 'exercice': 'fiscal_year',
            'EXERCICES': 'fiscal_year', 'exercices': 'fiscal_year',

            # Client field
            'client': 'client', 'CLIENT': 'client', 'customer': 'client',

            # Amount pre-tax field
            'amount_pre_tax': 'amount_pre_tax', 'montant_ht': 'amount_pre_tax',
            'MONTANT_HT': 'amount_pre_tax', 'montant ht': 'amount_pre_tax',

            # VAT percentage field
            'vat_percentage': 'vat_percentage', 'pourcentage_tva': 'vat_percentage',
            'POURCENTAGE_TVA': 'vat_percentage', '% tva': 'vat_percentage',

            # VAT amount field
            'vat_amount': 'vat_amount', 'montant_tva': 'vat_amount',
            'MONTANT_TVA': 'vat_amount', 'montant tva': 'vat_amount',

            # Total amount field
            'total_amount': 'total_amount', 'montant_ttc': 'total_amount',
            'MONTANT_TTC': 'total_amount', 'montant ttc': 'total_amount',

            # Description field
            'description': 'description', 'DESIGNATIONS': 'description',
            'designations': 'description', 'désignations': 'description',

            # Period field
            'period': 'period', 'PERIODE': 'period', 'période': 'period'
        }

        for row in data:
            try:
                # Create a data dictionary with standardized field names
                model_data = {'invoice': invoice}

                # Process each field in the row
                for key, value in row.items():
                    key_lower = str(key).lower()
                    # Try exact match first
                    if key in field_mapping:
                        standard_key = field_mapping[key]
                        model_data[standard_key] = value
                    # Try lowercase match
                    elif key_lower in field_mapping:
                        standard_key = field_mapping[key_lower]
                        model_data[standard_key] = value

                # Handle special cases and convert types

                # Parse date fields
                if 'invoice_date' in model_data and model_data['invoice_date']:
                    try:
                        model_data['invoice_date'] = self._parse_date(
                            model_data['invoice_date'])
                    except Exception as e:
                        logger.warning(
                            f"Failed to parse invoice date: {str(e)}")
                        model_data['invoice_date'] = None

                # Ensure numeric fields are properly handled
                for field in ['amount_pre_tax', 'vat_percentage', 'vat_amount', 'total_amount']:
                    if field in model_data:
                        try:
                            if isinstance(model_data[field], str):
                                # Clean and convert string value
                                clean_value = model_data[field].replace(
                                    ',', '.').replace(' ', '')
                                model_data[field] = float(
                                    clean_value) if clean_value else 0
                        except (ValueError, TypeError):
                            model_data[field] = 0

                # Create the FacturationManuelle record
                record = FacturationManuelle.objects.create(
                    invoice=invoice,
                    month=model_data.get('month', ''),
                    invoice_date=model_data.get('invoice_date'),
                    department=model_data.get('department', ''),
                    invoice_number=model_data.get('invoice_number', ''),
                    fiscal_year=model_data.get('fiscal_year', ''),
                    client=model_data.get('client', ''),
                    amount_pre_tax=model_data.get('amount_pre_tax', 0),
                    vat_percentage=model_data.get('vat_percentage', 0),
                    vat_amount=model_data.get('vat_amount', 0),
                    total_amount=model_data.get('total_amount', 0),
                    description=model_data.get('description', ''),
                    period=model_data.get('period', '')
                )

                saved_count += 1

                # Log first few records for debugging
                if saved_count <= 3:
                    logger.info(
                        f"Saved Facturation Manuelle record #{saved_count}: {model_data}")

            except Exception as e:
                logger.error(
                    f"Error saving Facturation Manuelle record: {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to FacturationManuelle")
        return saved_count

    def _save_etat_facture(self, invoice, data):
        """Save Etat Facture data without filtering/cleaning"""
        saved_count = 0

        # Debug log
        logger.info(
            f"Starting _save_etat_facture for invoice {invoice.id}, with {len(data) if data else 0} rows")

        # Check if data is empty or None
        if not data:
            logger.error(
                f"No data provided for Etat Facture invoice {invoice.id}")
            return saved_count

        # Log the first row to debug
        if data and len(data) > 0:
            logger.info(f"First row of Etat Facture data: {data[0]}")
            logger.info(
                f"Keys in first row: {list(data[0].keys() if isinstance(data[0], dict) else [])}")

        # Map of possible field names in the data (lowercase to standardized)
        field_mapping = {
            # Organization field
            'organization': 'organization', 'organisation': 'organization', 'org': 'organization',

            # Source field
            'source': 'source',

            # Invoice number field
            'invoice_number': 'invoice_number', 'n_fact': 'invoice_number', 'n fact': 'invoice_number',
            'numero_facture': 'invoice_number', 'n° fact': 'invoice_number',

            # Invoice type field
            'invoice_type': 'invoice_type', 'typ_fact': 'invoice_type', 'type_facture': 'invoice_type',

            # Invoice date field
            'invoice_date': 'invoice_date', 'date_fact': 'invoice_date', 'date_facture': 'invoice_date',

            # Client field
            'client': 'client', 'customer': 'client',

            # Invoice object field
            'invoice_object': 'invoice_object', 'obj_fact': 'invoice_object', 'objet_facture': 'invoice_object',

            # Period field
            'period': 'period', 'periode': 'period', 'période': 'period',

            # Terminated flag field
            'terminated_flag': 'terminated_flag', 'termine_flag': 'terminated_flag',

            # Amount pre-tax field
            'amount_pre_tax': 'amount_pre_tax', 'montant_ht': 'amount_pre_tax',

            # Tax amount field
            'tax_amount': 'tax_amount', 'montant_taxe': 'tax_amount',

            # Total amount field
            'total_amount': 'total_amount', 'montant_ttc': 'total_amount',

            # Revenue amount field
            'revenue_amount': 'revenue_amount', 'chiffre_aff_exe': 'revenue_amount',

            # Collection amount field
            'collection_amount': 'collection_amount', 'encaissement': 'collection_amount',

            # Payment date field
            'payment_date': 'payment_date', 'date_rglt': 'payment_date',

            # Invoice credit amount field
            'invoice_credit_amount': 'invoice_credit_amount', 'facture_avoir_annulation': 'invoice_credit_amount',
        }

        for idx, row in enumerate(data):
            try:
                # Debug: Log the current row processing
                if idx < 3 or idx % 100 == 0:  # Log first 3 rows and every 100th row
                    logger.info(
                        f"Processing EtatFacture row {idx+1}/{len(data)}")

                # Extract values using the field mapping
                row_data = {}
                for key, value in row.items():
                    key_lower = str(key).lower()
                    if key_lower in field_mapping:
                        standard_key = field_mapping[key_lower]
                        row_data[standard_key] = value

                # Get DOT instance if available
                dot_instance = None
                dot_code = row.get('dot', '')
                if not dot_code:
                    # Try alternative names
                    for alt_name in ['DO', 'DOT']:
                        if alt_name in row:
                            dot_code = row[alt_name]
                            break

                # Debug: Log DOT code handling
                if dot_code:
                    logger.info(
                        f"EtatFacture row {idx+1}: Found DOT code: '{dot_code}'")
                    try:
                        dot_instance, created = DOT.objects.get_or_create(
                            code=dot_code, defaults={'name': dot_code})
                        logger.info(
                            f"EtatFacture row {idx+1}: DOT instance {'created' if created else 'fetched'} with ID: {dot_instance.id}")
                    except Exception as e:
                        logger.error(
                            f"Error getting/creating DOT for EtatFacture row {idx+1}: {str(e)}")
                else:
                    logger.info(f"EtatFacture row {idx+1}: No DOT code found")

                # Parse dates if available
                invoice_date = None
                date_key = next(
                    (k for k in ['DATE_FACT', 'invoice_date', 'Date Fact'] if k in row), None)
                if date_key and row[date_key]:
                    try:
                        invoice_date = self._parse_date(row[date_key])
                    except Exception as e:
                        logger.warning(
                            f"Failed to parse invoice date '{row[date_key]}': {str(e)}")

                payment_date = None
                payment_key = next(
                    (k for k in ['DATE_RGLT', 'payment_date', 'Date Rglt'] if k in row), None)
                if payment_key and row[payment_key]:
                    try:
                        payment_date = self._parse_date(row[payment_key])
                    except Exception as e:
                        logger.warning(
                            f"Failed to parse payment date '{row[payment_key]}': {str(e)}")

                # Get numeric fields with fallbacks for different naming conventions
                amount_pre_tax = 0
                for key in ['MONTANT_HT', 'amount_pre_tax', 'Montant Ht', 'Montant HT']:
                    if key in row and row[key] is not None:
                        try:
                            amount_pre_tax = float(row[key])
                            break
                        except (ValueError, TypeError):
                            pass

                # Debug: Log model creation
                logger.info(
                    f"EtatFacture row {idx+1}: Creating record with invoice_number='{row.get('invoice_number', '')}', dot_instance={dot_instance.id if dot_instance else 'None'}")

                # Create a new EtatFacture record - without dot field
                record = EtatFacture.objects.create(
                    invoice=invoice,
                    organization=row.get('organization', ''),
                    source=row.get('source', ''),
                    invoice_number=row.get('invoice_number', ''),
                    invoice_type=row.get('invoice_type', ''),
                    invoice_date=invoice_date,
                    client=row.get('client', ''),
                    invoice_object=row.get('invoice_object', ''),
                    period=row.get('period', ''),
                    terminated_flag=row.get('terminated_flag', ''),
                    amount_pre_tax=amount_pre_tax,
                    tax_amount=row.get('tax_amount', 0),
                    total_amount=row.get('total_amount', 0),
                    revenue_amount=row.get('revenue_amount', 0),
                    collection_amount=row.get('collection_amount', 0),
                    payment_date=payment_date,
                    invoice_credit_amount=row.get('invoice_credit_amount', 0)
                )
                saved_count += 1

                # Debug log first few records
                if saved_count <= 3:
                    logger.info(
                        f"Saved Etat Facture record #{saved_count}: {record}")

            except Exception as e:
                logger.error(
                    f"Error saving Etat Facture record (row {idx+1}): {str(e)}")
                logger.error(f"Row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_etat_facture: Saved {saved_count}/{len(data)} records for invoice {invoice.id}")
        return saved_count

    def _save_parc_corporate(self, invoice, data):
        """Save Parc Corporate data without filtering/cleaning"""
        saved_count = 0

        # Debug log
        logger.info(
            f"Starting _save_parc_corporate for invoice {invoice.id}, with {len(data)} rows")

        # Get the dot code once instead of for each row
        for idx, row in enumerate(data):
            try:

                # Extract the creation date if available
                creation_date = None
                if 'CREATION_DATE' in row and row['CREATION_DATE']:
                    try:
                        creation_date = self._parse_datetime(
                            row['CREATION_DATE'])
                    except Exception as e:
                        logger.warning(
                            f"Could not parse CREATION_DATE: {str(e)}")

                # Get the state and try to find DOT code from various fields
                state = row.get('STATE', '')

                # Try to extract DOT from organization if no DOT code found

                # Debug: Log model creation data

                # Create a new ParcCorporate record including the dot field when available
                ParcCorporate.objects.create(
                    invoice=invoice,

                    actel_code=row.get('ACTEL_CODE', ''),
                    customer_l1_code=row.get('CODE_CUSTOMER_L1', ''),
                    customer_l1_desc=row.get('DESCRIPTION_CUSTOMER_L1', ''),
                    customer_l2_code=row.get('CODE_CUSTOMER_L2', ''),
                    customer_l2_desc=row.get('DESCRIPTION_CUSTOMER_L2', ''),
                    customer_l3_code=row.get('CODE_CUSTOMER_L3', ''),
                    customer_l3_desc=row.get('DESCRIPTION_CUSTOMER_L3', ''),
                    telecom_type=row.get('TELECOM_TYPE', ''),
                    offer_type=row.get('OFFER_TYPE', ''),
                    offer_name=row.get('OFFER_NAME', ''),
                    subscriber_status=row.get('SUBSCRIBER_STATUS', ''),
                    creation_date=creation_date,
                    state=state,
                    customer_full_name=row.get('CUSTOMER_FULL_NAME', '')
                )
                saved_count += 1

                if idx < 3 or idx % 100 == 0:  # Log success for first 3 rows and every 100th row
                    logger.info(
                        f"Successfully saved ParcCorporate row {idx+1}")

            except Exception as e:
                logger.error(
                    f"Error saving ParcCorporate record (row {idx+1}): {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_parc_corporate: Saved {saved_count}/{len(data)} records")
        return saved_count

    def _save_creances_ngbss(self, invoice, data):
        """Save Creances NGBSS data without filtering/cleaning"""
        saved_count = 0
        logger.info(
            f"Starting _save_creances_ngbss for invoice {invoice.id}, with {len(data)} rows")

        # Add field mapping for DOT to support various formats
        dot_field_mapping = {
            'dot': 'DOT', 'do': 'DOT', 'dot_code': 'DOT', 'dotcode': 'DOT',
            'code_dot': 'DOT', 'department': 'DOT', 'dept': 'DOT', 'direction': 'DOT',
            'DOT': 'DOT', 'DO': 'DOT', 'DOT_CODE': 'DOT', 'DEPARTMENT': 'DOT',
            'DIRECTION': 'DOT', 'DEPT': 'DOT'
        }

        # Organization to DOT mapping
        org_to_dot_mapping = {
            'AT_SIEGE': 'Siege', 'SIEGE': 'Siege', 'SIEGE_DG': 'Siege', 'Siège': 'Siege',
            'DOT_ADRAR': 'Adrar', 'ADRAR': 'Adrar',
            'DOT_AIN_DEFLA': 'Ain_Defla', 'AIN_DEFLA': 'Ain_Defla', 'AIN DEFLA': 'Ain_Defla',
            'DOT_ALGER': 'Alger_Centre', 'ALGER': 'Alger_Centre', 'DOT_ALGER_CENTRE': 'Alger_Centre', 'ALGER_CENTRE': 'Alger_Centre', 'ALGER CENTRE': 'Alger_Centre',
            'DOT_ALGER_EST': 'Alger_Est', 'ALGER_EST': 'Alger_Est', 'ALGER EST': 'Alger_Est', 'Alger_Est': 'Alger_Est',
            'DOT_ALGER_OUEST': 'Alger_Ouest', 'ALGER_OUEST': 'Alger_Ouest', 'ALGER OUEST': 'Alger_Ouest', 'Alger_Ouest': 'Alger_Ouest',
            'DOT_ANNABA': 'Annaba', 'ANNABA': 'Annaba', 'Annaba': 'Annaba',
            'DOT_BATNA': 'Batna', 'BATNA': 'Batna', 'Batna': 'Batna',
            'DOT_BECHAR': 'Bechar', 'BECHAR': 'Bechar', 'Bechar': 'Bechar',
            'DOT_BEJAIA': 'Bejaia', 'BEJAIA': 'Bejaia', 'Bejaia': 'Bejaia',
            'DOT_BISKRA': 'Biskra', 'BISKRA': 'Biskra', 'Biskra': 'Biskra',
            'DOT_BLIDA': 'Blida', 'BLIDA': 'Blida', 'Blida': 'Blida',
            'DOT_BOUIRA': 'Bouira', 'BOUIRA': 'Bouira', 'Bouira': 'Bouira',
            'DOT_BOUMERDES': 'Boumerdes', 'BOUMERDES': 'Boumerdes', 'Boumerdes': 'Boumerdes',
            'DOT_BORDJ_BOU_ARRERIDJ': 'Bordj_Bou_Arreridj', 'BORDJ_BOU_ARRERIDJ': 'Bordj_Bou_Arreridj', 'BORDJ BOU ARRERIDJ': 'Bordj_Bou_Arreridj', 'Bordj_Bou_Arreridj': 'Bordj_Bou_Arreridj',
            'DOT_CHLEF': 'Chlef', 'CHLEF': 'Chlef', 'Chlef': 'Chlef',
            'DOT_CONSTANTINE': 'Constantine', 'CONSTANTINE': 'Constantine', 'Constantine': 'Constantine',
            'DOT_DJELFA': 'Djelfa', 'DJELFA': 'Djelfa', 'Djelfa': 'Djelfa',
            'DOT_EL_BAYADH': 'El_Bayadh', 'EL_BAYADH': 'El_Bayadh', 'EL BAYADH': 'El_Bayadh', 'El_Bayadh': 'El_Bayadh',
            'DOT_EL_OUED': 'El_Oued', 'EL_OUED': 'El_Oued', 'EL OUED': 'El_Oued', 'El_Oued': 'El_Oued',
            'DOT_GHARDAIA': 'Ghardaia', 'GHARDAIA': 'Ghardaia', 'Ghardaia': 'Ghardaia',
            'DOT_GUELMA': 'Guelma', 'GUELMA': 'Guelma', 'Guelma': 'Guelma',
            'DOT_ILLIZI': 'Illizi', 'ILLIZI': 'Illizi', 'Illizi': 'Illizi',
            'DOT_JIJEL': 'Jijel', 'JIJEL': 'Jijel', 'Jijel': 'Jijel',
            'DOT_KHENCHELA': 'Khenchela', 'KHENCHELA': 'Khenchela', 'Khenchela': 'Khenchela',
            'DOT_LAGHOUAT': 'Laghouat', 'LAGHOUAT': 'Laghouat', 'Laghouat': 'Laghouat',
            'DOT_MASCARA': 'Mascara', 'MASCARA': 'Mascara', 'Mascara': 'Mascara',
            'DOT_MEDEA': 'Medea', 'MEDEA': 'Medea', 'Medea': 'Medea',
            'DOT_MILA': 'Mila', 'MILA': 'Mila', 'Mila': 'Mila',
            'DOT_MOSTAGANEM': 'Mostaganem', 'MOSTAGANEM': 'Mostaganem', 'Mostaganem': 'Mostaganem',
            'DOT_MSILA': 'M_Sila', 'MSILA': 'M_Sila', 'M_Sila': 'M_Sila',
            'DOT_NAAMA': 'Naama', 'NAAMA': 'Naama', 'Naama': 'Naama',
            'DOT_ORAN': 'Oran', 'ORAN': 'Oran', 'Oran': 'Oran',
            'DOT_OUARGLA': 'Ouargla', 'OUARGLA': 'Ouargla', 'Ouargla': 'Ouargla',
            'DOT_OUM_EL_BOUAGHI': 'Oum_El_Bouaghi', 'OUM_EL_BOUAGHI': 'Oum_El_Bouaghi', 'OUM EL BOUAGHI': 'Oum_El_Bouaghi', 'Oum_El_Bouaghi': 'Oum_El_Bouaghi',
            'DOT_RELIZANE': 'Relizane', 'RELIZANE': 'Relizane', 'Relizane': 'Relizane',
            'DOT_SAIDA': 'Saida', 'SAIDA': 'Saida', 'Saida': 'Saida',
            'DOT_SETIF': 'Setif', 'SETIF': 'Setif', 'Setif': 'Setif',
            'DOT_SIDI_BEL_ABBES': 'Sidi_Bel_Abbes', 'SIDI_BEL_ABBES': 'Sidi_Bel_Abbes', 'SIDI BEL ABBES': 'Sidi_Bel_Abbes', 'Sidi_Bel_Abbes': 'Sidi_Bel_Abbes',
            'DOT_SKIKDA': 'Skikda', 'SKIKDA': 'Skikda', 'Skikda': 'Skikda',
            'DOT_SOUK_AHRAS': 'Souk_Ahras', 'SOUK_AHRAS': 'Souk_Ahras', 'SOUK AHRAS': 'Souk_Ahras', 'Souk_Ahras': 'Souk_Ahras',
            'DOT_TAMANRASSET': 'Tamanrasset', 'TAMANRASSET': 'Tamanrasset', 'Tamanrasset': 'Tamanrasset',
            'DOT_TEBESSA': 'Tebessa', 'TEBESSA': 'Tebessa', 'Tebessa': 'Tebessa',
            'DOT_TIARET': 'Tiaret', 'TIARET': 'Tiaret', 'Tiaret': 'Tiaret',
            'DOT_TINDOUF': 'Tindouf', 'TINDOUF': 'Tindouf', 'Tindouf': 'Tindouf',
            'DOT_TIPAZA': 'Tipaza', 'TIPAZA': 'Tipaza', 'Tipaza': 'Tipaza',
            'DOT_TISSEMSILT': 'Tissemsilt', 'TISSEMSILT': 'Tissemsilt', 'Tissemsilt': 'Tissemsilt',
            'DOT_TIZI_OUZOU': 'Tizi_Ouzou', 'TIZI_OUZOU': 'Tizi_Ouzou', 'TIZI OUZOU': 'Tizi_Ouzou', 'Tizi_Ouzou': 'Tizi_Ouzou',
            'DOT_TLEMCEN': 'Tlemcen', 'TLEMCEN': 'Tlemcen', 'Tlemcen': 'Tlemcen',
            'DOT_TOUGGOURT': 'Touggourt', 'TOUGGOURT': 'Touggourt', 'Touggourt': 'Touggourt',
            'Alger_Centre': 'Alger_Centre',
            'Ain_Temouchent': 'Ain_Temouchent',
            'Beni Abbes': 'Beni Abbes',
            'Bordj Badji Mokhtar': 'Bordj Badji Mokhtar',
            'Djanet': 'Djanet',
            'El Meghaier': 'El Meghaier',
            'EL Meniaa': 'EL Meniaa',
            'El_Tarf': 'El_Tarf',
            'In Guezzam': 'In Guezzam',
            'In Salah': 'In Salah',
            'Ouled Djellal': 'Ouled Djellal',
            'Timimoune': 'Timimoune',
            'Magasin DOT MOSTAGANEM': 'Mostaganem',
            'Magasin DOT LAGHOUAT': 'Laghouat',
            'Magasin DOT EL OUED': 'El_Oued',
            'Magasin DOT NAAMA': 'Naama',
            'Magasin DOT RELIZANE': 'Relizane',
            'Magasin DOT TIMIMOUN': 'Timimoune',
            'Direction Commerciale Corporate': 'Siege',
            'DCC': 'Siege',
            'Corporate': 'Siege',
            'Corporate Group': 'Siege',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER CENTRE': 'Alger_Centre',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER EST': 'Alger_Est',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER OUEST': 'Alger_Ouest',
            'DIRECTION RÉGIONALE TÉLÉCOMS ANNABA': 'Annaba',
            'DIRECTION RÉGIONALE TÉLÉCOMS BATNA': 'Batna',
            'DIRECTION RÉGIONALE TÉLÉCOMS BÉJAÏA': 'Bejaia',
            'DIRECTION RÉGIONALE TÉLÉCOMS BLIDA': 'Blida',
            'DIRECTION RÉGIONALE TÉLÉCOMS CHLEF': 'Chlef',
            'DIRECTION RÉGIONALE TÉLÉCOMS CONSTANTINE': 'Constantine',
            'DIRECTION RÉGIONALE TÉLÉCOMS DJELFA': 'Djelfa',
            'DIRECTION RÉGIONALE TÉLÉCOMS MÉDÉA': 'Medea',
            'DIRECTION RÉGIONALE TÉLÉCOMS ORAN': 'Oran',
            'DIRECTION RÉGIONALE TÉLÉCOMS OUARGLA': 'Ouargla',
            'DIRECTION RÉGIONALE TÉLÉCOMS SÉTIF': 'Setif',
            'DIRECTION RÉGIONALE TÉLÉCOMS TIZI-OUZOU': 'Tizi_Ouzou',
            'DIRECTION RÉGIONALE TÉLÉCOMS TLEMCEN': 'Tlemcen',
            'DR TÉLÉCOMS ALGER CENTRE': 'Alger_Centre',
            'DR TÉLÉCOMS ALGER EST': 'Alger_Est',
            'DR TÉLÉCOMS ALGER OUEST': 'Alger_Ouest',
            'DR TÉLÉCOMS ANNABA': 'Annaba',
            'DR TÉLÉCOMS BATNA': 'Batna',
            'DR TÉLÉCOMS BÉJAÏA': 'Bejaia',
            'DR TÉLÉCOMS BLIDA': 'Blida',
            'DR TÉLÉCOMS CHLEF': 'Chlef',
            'DR TÉLÉCOMS CONSTANTINE': 'Constantine',
            'DR TÉLÉCOMS DJELFA': 'Djelfa',
            'DR TÉLÉCOMS MÉDÉA': 'Medea',
            'DR TÉLÉCOMS ORAN': 'Oran',
            'DR TÉLÉCOMS OUARGLA': 'Ouargla',
            'DR TÉLÉCOMS SÉTIF': 'Setif',
            'DR TÉLÉCOMS TIZI-OUZOU': 'Tizi_Ouzou',
            'DR TÉLÉCOMS TLEMCEN': 'Tlemcen'
        }

        # Special product to DOT mapping for CreancesNGBSS
        product_to_dot_mapping = {
            'Specialized Line': 'SIE',
            'LTE': 'SIE'
        }

        for idx, row in enumerate(data):
            try:
                # Debug logging for first few rows
                # Log first 3 rows and every 1000th row (large file)
                if idx < 3 or idx % 1000 == 0:
                    logger.info(
                        f"Processing CreancesNGBSS row {idx+1}/{len(data)}")
                    logger.debug(f"Available keys in row: {list(row.keys())}")

                # Try to find DOT code from various field names
                dot_code = None
                for field_key, standard_key in dot_field_mapping.items():
                    if field_key.upper() in row and row[field_key.upper()]:
                        dot_code = row[field_key.upper()]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key.upper()}'")
                        break
                    elif field_key in row and row[field_key]:
                        dot_code = row[field_key]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key}'")
                        break

                # Try to extract DOT from product if no DOT code found
                product = row.get('PRODUIT', '')
                if not dot_code and product:
                    # Check if product value is in our mapping
                    if product in product_to_dot_mapping:
                        dot_code = product_to_dot_mapping[product]
                        logger.debug(
                            f"Mapped product '{product}' to DOT code '{dot_code}'")
                    elif product in org_to_dot_mapping:
                        dot_code = org_to_dot_mapping[product]
                        logger.debug(
                            f"Mapped product name '{product}' to DOT code '{dot_code}'")

                # Try to extract DOT from customer levels if no DOT code found
                customer_lev1 = row.get('CUST_LEV1', '')
                customer_lev2 = row.get('CUST_LEV2', '')
                customer_lev3 = row.get('CUST_LEV3', '')

                if not dot_code and customer_lev1:
                    if customer_lev1 in org_to_dot_mapping:
                        dot_code = org_to_dot_mapping[customer_lev1]
                        logger.debug(
                            f"Mapped customer_lev1 '{customer_lev1}' to DOT code '{dot_code}'")

                if not dot_code and customer_lev2:
                    if customer_lev2 in org_to_dot_mapping:
                        dot_code = org_to_dot_mapping[customer_lev2]
                        logger.debug(
                            f"Mapped customer_lev2 '{customer_lev2}' to DOT code '{dot_code}'")

                # Most specific categories should be prioritized
                if not dot_code and customer_lev3:
                    if customer_lev3 in org_to_dot_mapping:
                        dot_code = org_to_dot_mapping[customer_lev3]
                        logger.debug(
                            f"Mapped customer_lev3 '{customer_lev3}' to DOT code '{dot_code}'")
                    elif "Ligne d'exploitation" in customer_lev3:
                        # For creancesNGBSS, lines of exploitation are usually handled by Siège
                        dot_code = 'SIE'
                        logger.debug(
                            f"Mapped exploitation line '{customer_lev3}' to DOT code '{dot_code}'")

                # Get DOT instance if available
                dot_instance = None
                if dot_code:
                    try:
                        dot_instance, created = DOT.objects.get_or_create(
                            code=dot_code, defaults={'name': dot_code})
                        logger.debug(
                            f"CreancesNGBSS row {idx+1}: DOT instance {'created' if created else 'fetched'} with ID: {dot_instance.id}")
                    except Exception as e:
                        logger.error(
                            f"Error getting/creating DOT for CreancesNGBSS row {idx+1}: {str(e)}")
                        dot_instance = None
                else:
                    logger.debug(
                        f"CreancesNGBSS row {idx+1}: No DOT code found")

                # Create a new CreancesNGBSS record
                CreancesNGBSS.objects.create(
                    invoice=invoice,
                    dot=dot_instance,
                    dot_code=dot_code if dot_code else '',
                    actel=row.get('ACTEL', ''),
                    month=row.get('MOIS', ''),
                    year=row.get('ANNEE', ''),
                    subscriber_status=row.get('SUBS_STATUS', ''),
                    product=product,
                    customer_lev1=customer_lev1,
                    customer_lev2=customer_lev2,
                    customer_lev3=customer_lev3,
                    invoice_amount=row.get('INVOICE_AMT', 0),
                    open_amount=row.get('OPEN_AMT', 0),
                    tax_amount=row.get('TAX_AMT', 0),
                    invoice_amount_ht=row.get('INVOICE_AMT_HT', 0),
                    dispute_amount=row.get('DISPUTE_AMT', 0),
                    dispute_tax_amount=row.get('DISPUTE_TAX_AMT', 0),
                    dispute_net_amount=row.get('DISPUTE_NET_AMT', 0),
                    creance_brut=row.get('CREANCE_BRUT', 0),
                    creance_net=row.get('CREANCE_NET', 0),
                    creance_ht=row.get('CREANCE_HT', 0),
                    # cleaning_status='raw'  # Mark as raw data
                )
                saved_count += 1

                if idx < 3 or idx % 1000 == 0:  # Log first 3 rows and every 1000th row
                    logger.info(
                        f"Successfully saved CreancesNGBSS row {idx+1}")

            except Exception as e:
                logger.error(
                    f"Error saving Creances NGBSS record (row {idx+1}): {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_creances_ngbss: Saved {saved_count}/{len(data)} records")
        return saved_count

    def _save_ca_periodique(self, invoice, data):
        """Save CA Periodique data without filtering/cleaning"""
        saved_count = 0
        logger.info(
            f"Starting _save_ca_periodique for invoice {invoice.id}, with {len(data)} rows")

        # Add field mapping for DOT to support various formats
        dot_field_mapping = {
            'dot': 'DOT', 'do': 'DOT', 'dot_code': 'DOT', 'dotcode': 'DOT',
            'code_dot': 'DOT', 'department': 'DOT', 'dept': 'DOT', 'direction': 'DOT',
            'DOT': 'DOT', 'DO': 'DOT', 'DOT_CODE': 'DOT', 'DEPARTMENT': 'DOT',
            'DIRECTION': 'DOT', 'DEPT': 'DOT'
        }

        # Organization to DOT mapping
        org_to_dot_mapping = {
            'AT_SIEGE': 'SIE', 'SIEGE': 'SIE', 'SIEGE_DG': 'SIE', 'Siège': 'SIE',
            'DOT_ADRAR': 'ADR', 'ADRAR': 'ADR',
            'DOT_AIN_DEFLA': 'ADF', 'AIN_DEFLA': 'ADF', 'AIN DEFLA': 'ADF',
            'DOT_ALGER': 'ALG', 'ALGER': 'ALG', 'DOT_ALGER_CENTRE': 'ALG', 'ALGER_CENTRE': 'ALG', 'ALGER CENTRE': 'ALG',
            'DOT_ANNABA': 'ANN', 'ANNABA': 'ANN',
            'DOT_BATNA': 'BAT', 'BATNA': 'BAT',
            'DOT_BECHAR': 'BCH', 'BECHAR': 'BCH',
            'DOT_BEJAIA': 'BJA', 'BEJAIA': 'BJA',
            'DOT_BISKRA': 'BIS', 'BISKRA': 'BIS',
            'DOT_BLIDA': 'BLI', 'BLIDA': 'BLI',
            'DOT_BOUIRA': 'BOU', 'BOUIRA': 'BOU',
            'DOT_BOUMERDES': 'BMD', 'BOUMERDES': 'BMD',
            'DOT_BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ BOU ARRERIDJ': 'BBA',
            'DOT_CHLEF': 'CHL', 'CHLEF': 'CHL',
            'DOT_CONSTANTINE': 'CON', 'CONSTANTINE': 'CON',
            'DOT_DJELFA': 'DJE', 'DJELFA': 'DJE',
            'DOT_EL_BAYADH': 'BAY', 'EL_BAYADH': 'BAY', 'EL BAYADH': 'BAY',
            'DOT_EL_OUED': 'OUD', 'EL_OUED': 'OUD', 'EL OUED': 'OUD',
            'DOT_GHARDAIA': 'GHA', 'GHARDAIA': 'GHA',
            'DOT_GUELMA': 'GUE', 'GUELMA': 'GUE',
            'DOT_ILLIZI': 'ILL', 'ILLIZI': 'ILL',
            'DOT_JIJEL': 'JIJ', 'JIJEL': 'JIJ',
            'DOT_KHENCHELA': 'KHE', 'KHENCHELA': 'KHE',
            'DOT_LAGHOUAT': 'LAG', 'LAGHOUAT': 'LAG',
            'DOT_MASCARA': 'MAS', 'MASCARA': 'MAS',
            'DOT_MEDEA': 'MED', 'MEDEA': 'MED',
            'DOT_MILA': 'MIL', 'MILA': 'MIL',
            'DOT_MOSTAGANEM': 'MOS', 'MOSTAGANEM': 'MOS',
            'DOT_MSILA': 'MSI', 'MSILA': 'MSI',
            'DOT_NAAMA': 'NAA', 'NAAMA': 'NAA',
            'DOT_ORAN': 'ORA', 'ORAN': 'ORA',
            'DOT_OUARGLA': 'OUA', 'OUARGLA': 'OUA',
            'DOT_OUM_EL_BOUAGHI': 'OEB', 'OUM_EL_BOUAGHI': 'OEB', 'OUM EL BOUAGHI': 'OEB',
            'DOT_RELIZANE': 'REL', 'RELIZANE': 'REL',
            'DOT_SAIDA': 'SAI', 'SAIDA': 'SAI',
            'DOT_SETIF': 'SET', 'SETIF': 'SET',
            'DOT_SIDI_BEL_ABBES': 'SBA', 'SIDI_BEL_ABBES': 'SBA', 'SIDI BEL ABBES': 'SBA',
            'DOT_SKIKDA': 'SKI', 'SKIKDA': 'SKI',
            'DOT_SOUK_AHRAS': 'SAH', 'SOUK_AHRAS': 'SAH', 'SOUK AHRAS': 'SAH',
            'DOT_TAMANRASSET': 'TAM', 'TAMANRASSET': 'TAM',
            'DOT_TEBESSA': 'TEB', 'TEBESSA': 'TEB',
            'DOT_TIARET': 'TIA', 'TIARET': 'TIA',
            'DOT_TINDOUF': 'TIN', 'TINDOUF': 'TIN',
            'DOT_TIPAZA': 'TIP', 'TIPAZA': 'TIP',
            'DOT_TISSEMSILT': 'TIS', 'TISSEMSILT': 'TIS',
            'DOT_TIZI_OUZOU': 'TZO', 'TIZI_OUZOU': 'TZO', 'TIZI OUZOU': 'TZO',
            'DOT_TLEMCEN': 'TLE', 'TLEMCEN': 'TLE',
            'Magasin DOT MOSTAGANEM': 'MOS', 'Magasin DOT LAGHOUAT': 'LAG', 'Magasin DOT EL OUED': 'OUD',
            'Direction Commerciale Corporate': 'SIE', 'DCC': 'SIE',
            # Adding new DOT names
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER CENTRE': 'ALC',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER EST': 'ALE',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER OUEST': 'ALO',
            'DIRECTION RÉGIONALE TÉLÉCOMS ANNABA': 'ANN',
            'DIRECTION RÉGIONALE TÉLÉCOMS BATNA': 'BAT',
            'DIRECTION RÉGIONALE TÉLÉCOMS BÉJAÏA': 'BJA',
            'DIRECTION RÉGIONALE TÉLÉCOMS BLIDA': 'BLI',
            'DIRECTION RÉGIONALE TÉLÉCOMS CHLEF': 'CHL',
            'DIRECTION RÉGIONALE TÉLÉCOMS CONSTANTINE': 'CON',
            'DIRECTION RÉGIONALE TÉLÉCOMS DJELFA': 'DJE',
            'DIRECTION RÉGIONALE TÉLÉCOMS MÉDÉA': 'MED',
            'DIRECTION RÉGIONALE TÉLÉCOMS ORAN': 'ORA',
            'DIRECTION RÉGIONALE TÉLÉCOMS OUARGLA': 'OUA',
            'DIRECTION RÉGIONALE TÉLÉCOMS SÉTIF': 'SET',
            'DIRECTION RÉGIONALE TÉLÉCOMS TIZI-OUZOU': 'TZO',
            'DIRECTION RÉGIONALE TÉLÉCOMS TLEMCEN': 'TLE',
            'DR TÉLÉCOMS ALGER CENTRE': 'ALC',
            'DR TÉLÉCOMS ALGER EST': 'ALE',
            'DR TÉLÉCOMS ALGER OUEST': 'ALO',
            'DR TÉLÉCOMS ANNABA': 'ANN',
            'DR TÉLÉCOMS BATNA': 'BAT',
            'DR TÉLÉCOMS BÉJAÏA': 'BJA',
            'DR TÉLÉCOMS BLIDA': 'BLI',
            'DR TÉLÉCOMS CHLEF': 'CHL',
            'DR TÉLÉCOMS CONSTANTINE': 'CON',
            'DR TÉLÉCOMS DJELFA': 'DJE',
            'DR TÉLÉCOMS MÉDÉA': 'MED',
            'DR TÉLÉCOMS ORAN': 'ORA',
            'DR TÉLÉCOMS OUARGLA': 'OUA',
            'DR TÉLÉCOMS SÉTIF': 'SET',
            'DR TÉLÉCOMS TIZI-OUZOU': 'TZO',
            'DR TÉLÉCOMS TLEMCEN': 'TLE'
        }

        # Product to DOT mapping for specific products that are always associated with specific DOTs
        product_to_dot_mapping = {
            'Specialized Line': 'SIE',  # Special product that should be associated with "Siège"
            'LTE': 'SIE'               # Special product that should be associated with "Siège"
        }

        for idx, row in enumerate(data):
            try:
                # Debug some rows
                if idx < 3 or idx % 100 == 0:
                    logger.info(
                        f"Processing CAPeriodique row {idx+1}/{len(data)}")
                    logger.debug(f"Available keys in row: {list(row.keys())}")

                # Try to find DOT code from various field names
                dot_code = None
                for field_key, standard_key in dot_field_mapping.items():
                    if field_key.upper() in row and row[field_key.upper()]:
                        dot_code = row[field_key.upper()]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key.upper()}'")
                        break
                    elif field_key in row and row[field_key]:
                        dot_code = row[field_key]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key}'")
                        break

                # Try to extract DOT from product if no DOT code found
                product = row.get('PRODUIT', '')
                if not dot_code and product:
                    # Check if product value is in our mapping
                    if product in product_to_dot_mapping:
                        dot_code = product_to_dot_mapping[product]
                        logger.debug(
                            f"Mapped product '{product}' to DOT code '{dot_code}'")
                    elif product in org_to_dot_mapping:
                        dot_code = org_to_dot_mapping[product]
                        logger.debug(
                            f"Mapped product name '{product}' to DOT code '{dot_code}'")

                # Handle NaN values for decimal fields
                amount_pre_tax = row.get('HT', 0)
                tax_amount = row.get('TAX', 0)
                total_amount = row.get('TTC', 0)
                # Check if DISCOUNT exists in the row before trying to use it
                # Default to None if not present
                discount = row.get('DISCOUNT', None)

                # Enhanced NaN checking for all numeric fields
                # Check for pandas NaN, string 'nan', empty strings, etc.
                def clean_decimal(value):
                    import math
                    import pandas as pd

                    # Check for pandas NaN or math.nan
                    if pd.isna(value) or (isinstance(value, float) and math.isnan(value)):
                        return None
                    # Check for string 'nan' (case insensitive)
                    if isinstance(value, str) and (value.lower() == 'nan' or value.strip() == ''):
                        return None
                    return value

                # Apply cleaning to all decimal fields
                amount_pre_tax = clean_decimal(amount_pre_tax)
                tax_amount = clean_decimal(tax_amount)
                total_amount = clean_decimal(total_amount)
                discount = clean_decimal(discount)

                # Get DOT instance if available
                dot_instance = None
                if dot_code:
                    try:
                        dot_instance, created = DOT.objects.get_or_create(
                            code=dot_code, defaults={'name': dot_code})
                        logger.debug(
                            f"CAPeriodique row {idx+1}: DOT instance {'created' if created else 'fetched'} with ID: {dot_instance.id}")
                    except Exception as e:
                        logger.error(
                            f"Error getting/creating DOT for CAPeriodique row {idx+1}: {str(e)}")
                        dot_instance = None
                else:
                    logger.debug(
                        f"CAPeriodique row {idx+1}: No DOT code found")

                # Create a new CAPeriodique record
                CAPeriodique.objects.create(
                    invoice=invoice,
                    dot=dot_instance,
                    dot_code=dot_code if dot_code else '',
                    product=product,
                    amount_pre_tax=amount_pre_tax,
                    tax_amount=tax_amount,
                    total_amount=total_amount,
                    discount=discount,
                    # cleaning_status='raw'  # Mark as raw data
                )
                saved_count += 1

                if idx < 3 or idx % 100 == 0:
                    logger.info(f"Successfully saved CAPeriodique row {idx+1}")

            except Exception as e:
                logger.error(
                    f"Error saving CA Periodique record (row {idx+1}): {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_ca_periodique: Saved {saved_count}/{len(data)} records")
        return saved_count

    def _save_ca_non_periodique(self, invoice, data):
        """Save CA Non Periodique data without filtering/cleaning"""
        def clean_value(val):
            """Convert nan values to None and ensure other values are valid"""
            import math
            import pandas as pd
            if val is None:
                return None
            if isinstance(val, float) and (math.isnan(val) or pd.isna(val)):
                return None
            return val

        saved_count = 0
        logger.info(
            f"Starting _save_ca_non_periodique for invoice {invoice.id}, with {len(data)} rows")

        # Add field mapping for DOT to support various formats
        dot_field_mapping = {
            'dot': 'DOT', 'do': 'DOT', 'dot_code': 'DOT', 'dotcode': 'DOT',
            'code_dot': 'DOT', 'department': 'DOT', 'dept': 'DOT', 'direction': 'DOT',
            'DOT': 'DOT', 'DO': 'DOT', 'DOT_CODE': 'DOT', 'DEPARTMENT': 'DOT',
            'DIRECTION': 'DOT', 'DEPT': 'DOT'
        }

        # Organization to DOT mapping
        org_to_dot_mapping = {
            'AT_SIEGE': 'SIE', 'SIEGE': 'SIE', 'SIEGE_DG': 'SIE', 'Siège': 'SIE',
            'DOT_ADRAR': 'ADR', 'ADRAR': 'ADR',
            'DOT_AIN_DEFLA': 'ADF', 'AIN_DEFLA': 'ADF', 'AIN DEFLA': 'ADF',
            'DOT_ALGER': 'ALG', 'ALGER': 'ALG', 'DOT_ALGER_CENTRE': 'ALG', 'ALGER_CENTRE': 'ALG', 'ALGER CENTRE': 'ALG',
            'DOT_ANNABA': 'ANN', 'ANNABA': 'ANN',
            'DOT_BATNA': 'BAT', 'BATNA': 'BAT',
            'DOT_BECHAR': 'BCH', 'BECHAR': 'BCH',
            'DOT_BEJAIA': 'BJA', 'BEJAIA': 'BJA',
            'DOT_BISKRA': 'BIS', 'BISKRA': 'BIS',
            'DOT_BLIDA': 'BLI', 'BLIDA': 'BLI',
            'DOT_BOUIRA': 'BOU', 'BOUIRA': 'BOU',
            'DOT_BOUMERDES': 'BMD', 'BOUMERDES': 'BMD',
            'DOT_BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ BOU ARRERIDJ': 'BBA',
            'DOT_CHLEF': 'CHL', 'CHLEF': 'CHL',
            'DOT_CONSTANTINE': 'CON', 'CONSTANTINE': 'CON',
            'DOT_DJELFA': 'DJE', 'DJELFA': 'DJE',
            'DOT_EL_BAYADH': 'BAY', 'EL_BAYADH': 'BAY', 'EL BAYADH': 'BAY',
            'DOT_EL_OUED': 'OUD', 'EL_OUED': 'OUD', 'EL OUED': 'OUD',
            'DOT_GHARDAIA': 'GHA', 'GHARDAIA': 'GHA',
            'DOT_GUELMA': 'GUE', 'GUELMA': 'GUE',
            'DOT_ILLIZI': 'ILL', 'ILLIZI': 'ILL',
            'DOT_JIJEL': 'JIJ', 'JIJEL': 'JIJ',
            'DOT_KHENCHELA': 'KHE', 'KHENCHELA': 'KHE',
            'DOT_LAGHOUAT': 'LAG', 'LAGHOUAT': 'LAG',
            'DOT_MASCARA': 'MAS', 'MASCARA': 'MAS',
            'DOT_MEDEA': 'MED', 'MEDEA': 'MED',
            'DOT_MILA': 'MIL', 'MILA': 'MIL',
            'DOT_MOSTAGANEM': 'MOS', 'MOSTAGANEM': 'MOS',
            'DOT_MSILA': 'MSI', 'MSILA': 'MSI',
            'DOT_NAAMA': 'NAA', 'NAAMA': 'NAA',
            'DOT_ORAN': 'ORA', 'ORAN': 'ORA',
            'DOT_OUARGLA': 'OUA', 'OUARGLA': 'OUA',
            'DOT_OUM_EL_BOUAGHI': 'OEB', 'OUM_EL_BOUAGHI': 'OEB', 'OUM EL BOUAGHI': 'OEB',
            'DOT_RELIZANE': 'REL', 'RELIZANE': 'REL',
            'DOT_SAIDA': 'SAI', 'SAIDA': 'SAI',
            'DOT_SETIF': 'SET', 'SETIF': 'SET',
            'DOT_SIDI_BEL_ABBES': 'SBA', 'SIDI_BEL_ABBES': 'SBA', 'SIDI BEL ABBES': 'SBA',
            'DOT_SKIKDA': 'SKI', 'SKIKDA': 'SKI',
            'DOT_SOUK_AHRAS': 'SAH', 'SOUK_AHRAS': 'SAH', 'SOUK AHRAS': 'SAH',
            'DOT_TAMANRASSET': 'TAM', 'TAMANRASSET': 'TAM',
            'DOT_TEBESSA': 'TEB', 'TEBESSA': 'TEB',
            'DOT_TIARET': 'TIA', 'TIARET': 'TIA',
            'DOT_TINDOUF': 'TIN', 'TINDOUF': 'TIN',
            'DOT_TIPAZA': 'TIP', 'TIPAZA': 'TIP',
            'DOT_TISSEMSILT': 'TIS', 'TISSEMSILT': 'TIS',
            'DOT_TIZI_OUZOU': 'TZO', 'TIZI_OUZOU': 'TZO', 'TIZI OUZOU': 'TZO',
            'DOT_TLEMCEN': 'TLE', 'TLEMCEN': 'TLE',
            'Magasin DOT MOSTAGANEM': 'MOS', 'Magasin DOT LAGHOUAT': 'LAG', 'Magasin DOT EL OUED': 'OUD',
            'Direction Commerciale Corporate': 'SIE', 'DCC': 'SIE',
            # Adding new DOT names
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER CENTRE': 'ALC',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER EST': 'ALE',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER OUEST': 'ALO',
            'DIRECTION RÉGIONALE TÉLÉCOMS ANNABA': 'ANN',
            'DIRECTION RÉGIONALE TÉLÉCOMS BATNA': 'BAT',
            'DIRECTION RÉGIONALE TÉLÉCOMS BÉJAÏA': 'BJA',
            'DIRECTION RÉGIONALE TÉLÉCOMS BLIDA': 'BLI',
            'DIRECTION RÉGIONALE TÉLÉCOMS CHLEF': 'CHL',
            'DIRECTION RÉGIONALE TÉLÉCOMS CONSTANTINE': 'CON',
            'DIRECTION RÉGIONALE TÉLÉCOMS DJELFA': 'DJE',
            'DIRECTION RÉGIONALE TÉLÉCOMS MÉDÉA': 'MED',
            'DIRECTION RÉGIONALE TÉLÉCOMS ORAN': 'ORA',
            'DIRECTION RÉGIONALE TÉLÉCOMS OUARGLA': 'OUA',
            'DIRECTION RÉGIONALE TÉLÉCOMS SÉTIF': 'SET',
            'DIRECTION RÉGIONALE TÉLÉCOMS TIZI-OUZOU': 'TZO',
            'DIRECTION RÉGIONALE TÉLÉCOMS TLEMCEN': 'TLE',
            'DR TÉLÉCOMS ALGER CENTRE': 'ALC',
            'DR TÉLÉCOMS ALGER EST': 'ALE',
            'DR TÉLÉCOMS ALGER OUEST': 'ALO',
            'DR TÉLÉCOMS ANNABA': 'ANN',
            'DR TÉLÉCOMS BATNA': 'BAT',
            'DR TÉLÉCOMS BÉJAÏA': 'BJA',
            'DR TÉLÉCOMS BLIDA': 'BLI',
            'DR TÉLÉCOMS CHLEF': 'CHL',
            'DR TÉLÉCOMS CONSTANTINE': 'CON',
            'DR TÉLÉCOMS DJELFA': 'DJE',
            'DR TÉLÉCOMS MÉDÉA': 'MED',
            'DR TÉLÉCOMS ORAN': 'ORA',
            'DR TÉLÉCOMS OUARGLA': 'OUA',
            'DR TÉLÉCOMS SÉTIF': 'SET',
            'DR TÉLÉCOMS TIZI-OUZOU': 'TZO',
            'DR TÉLÉCOMS TLEMCEN': 'TLE'
        }

        for idx, row in enumerate(data):
            try:
                # Debug some rows
                if idx < 3 or idx % 100 == 0:
                    logger.info(
                        f"Processing CANonPeriodique row {idx+1}/{len(data)}")
                    logger.debug(f"Available keys in row: {list(row.keys())}")

                # Try to find DOT code from various field names
                dot_code = None
                for field_key, standard_key in dot_field_mapping.items():
                    if field_key.upper() in row and row[field_key.upper()]:
                        dot_code = row[field_key.upper()]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key.upper()}'")
                        break
                    elif field_key in row and row[field_key]:
                        dot_code = row[field_key]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key}'")
                        break

                # Try to extract DOT from product or channel if no DOT code found
                product = clean_value(row.get('PRODUIT', ''))
                channel = clean_value(row.get('CHANNEL', ''))

                if not dot_code and product:
                    # Check if product value is in our mapping
                    if product in org_to_dot_mapping:
                        dot_code = org_to_dot_mapping[product]
                        logger.debug(
                            f"Mapped product '{product}' to DOT code '{dot_code}'")

                if not dot_code and channel:
                    # Check if channel value is in our mapping
                    if channel in org_to_dot_mapping:
                        dot_code = org_to_dot_mapping[channel]
                        logger.debug(
                            f"Mapped channel '{channel}' to DOT code '{dot_code}'")
                    # Try to extract DOT code from channel name if it follows a pattern
                    elif channel.startswith('DOT_') or channel.startswith('AT_'):
                        potential_code = channel.split(
                            '_')[1] if '_' in channel else ''
                        if potential_code and potential_code in org_to_dot_mapping.values():
                            dot_code = potential_code
                            logger.debug(
                                f"Extracted DOT code '{dot_code}' from channel '{channel}'")

                # Get DOT instance if available
                dot_instance = None
                if dot_code:
                    try:
                        dot_instance, created = DOT.objects.get_or_create(
                            code=dot_code, defaults={'name': dot_code})
                        logger.debug(
                            f"CANonPeriodique row {idx+1}: DOT instance {'created' if created else 'fetched'} with ID: {dot_instance.id}")
                    except Exception as e:
                        logger.error(
                            f"Error getting/creating DOT for CANonPeriodique row {idx+1}: {str(e)}")
                        dot_instance = None
                else:
                    logger.debug(
                        f"CANonPeriodique row {idx+1}: No DOT code found")

                # Create a new CANonPeriodique record
                CANonPeriodique.objects.create(
                    invoice=invoice,
                    dot=dot_instance,
                    dot_code=dot_code if dot_code else '',
                    product=product,
                    amount_pre_tax=clean_value(row.get('HT', 0)),
                    tax_amount=clean_value(row.get('TAX', 0)),
                    total_amount=clean_value(row.get('TTC', 0)),
                    sale_type=clean_value(row.get('TYPE_VENTE', '')),
                    channel=channel,
                    # cleaning_status='raw'  # Mark as raw data
                )
                saved_count += 1

                if idx < 3 or idx % 100 == 0:
                    logger.info(
                        f"Successfully saved CANonPeriodique row {idx+1}")

            except Exception as e:
                logger.error(
                    f"Error saving CA Non Periodique record (row {idx+1}): {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_ca_non_periodique: Saved {saved_count}/{len(data)} records")
        return saved_count

    def _save_ca_dnt(self, invoice, data):
        """Save CA DNT data without filtering/cleaning"""
        saved_count = 0
        logger.info(
            f"Starting _save_ca_dnt for invoice {invoice.id}, with {len(data)} rows")

        # Add field mapping for DOT to support various formats
        dot_field_mapping = {
            'dot': 'DOT', 'do': 'DOT', 'dot_code': 'DOT', 'dotcode': 'DOT',
            'code_dot': 'DOT', 'department': 'DOT', 'dept': 'DOT', 'direction': 'DOT',
            'DOT': 'DOT', 'DO': 'DOT', 'DOT_CODE': 'DOT', 'DEPARTMENT': 'DOT',
            'DIRECTION': 'DOT', 'DEPT': 'DOT'
        }

        # Organization to DOT mapping
        org_to_dot_mapping = {
            'AT_SIEGE': 'SIE', 'SIEGE': 'SIE', 'SIEGE_DG': 'SIE',
            'DOT_ADRAR': 'ADR', 'ADRAR': 'ADR',
            'DOT_AIN_DEFLA': 'ADF', 'AIN_DEFLA': 'ADF', 'AIN DEFLA': 'ADF',
            'DOT_ALGER': 'ALG', 'ALGER': 'ALG', 'DOT_ALGER_CENTRE': 'ALG', 'ALGER_CENTRE': 'ALG', 'ALGER CENTRE': 'ALG',
            'DOT_ANNABA': 'ANN', 'ANNABA': 'ANN',
            'DOT_BATNA': 'BAT', 'BATNA': 'BAT',
            'DOT_BECHAR': 'BCH', 'BECHAR': 'BCH',
            'DOT_BEJAIA': 'BJA', 'BEJAIA': 'BJA',
            'DOT_BISKRA': 'BIS', 'BISKRA': 'BIS',
            'DOT_BLIDA': 'BLI', 'BLIDA': 'BLI',
            'DOT_BOUIRA': 'BOU', 'BOUIRA': 'BOU',
            'DOT_BOUMERDES': 'BMD', 'BOUMERDES': 'BMD',
            'DOT_BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ BOU ARRERIDJ': 'BBA',
            'DOT_CHLEF': 'CHL', 'CHLEF': 'CHL',
            'DOT_CONSTANTINE': 'CON', 'CONSTANTINE': 'CON',
            'DOT_DJELFA': 'DJE', 'DJELFA': 'DJE',
            'DOT_EL_BAYADH': 'BAY', 'EL_BAYADH': 'BAY', 'EL BAYADH': 'BAY',
            'DOT_EL_OUED': 'OUD', 'EL_OUED': 'OUD', 'EL OUED': 'OUD',
            'DOT_GHARDAIA': 'GHA', 'GHARDAIA': 'GHA',
            'DOT_GUELMA': 'GUE', 'GUELMA': 'GUE',
            'DOT_ILLIZI': 'ILL', 'ILLIZI': 'ILL',
            'DOT_JIJEL': 'JIJ', 'JIJEL': 'JIJ',
            'DOT_KHENCHELA': 'KHE', 'KHENCHELA': 'KHE',
            'DOT_LAGHOUAT': 'LAG', 'LAGHOUAT': 'LAG',
            'DOT_MASCARA': 'MAS', 'MASCARA': 'MAS',
            'DOT_MEDEA': 'MED', 'MEDEA': 'MED',
            'DOT_MILA': 'MIL', 'MILA': 'MIL',
            'DOT_MOSTAGANEM': 'MOS', 'MOSTAGANEM': 'MOS',
            'DOT_MSILA': 'MSI', 'MSILA': 'MSI',
            'DOT_NAAMA': 'NAA', 'NAAMA': 'NAA',
            'DOT_ORAN': 'ORA', 'ORAN': 'ORA',
            'DOT_OUARGLA': 'OUA', 'OUARGLA': 'OUA',
            'DOT_OUM_EL_BOUAGHI': 'OEB', 'OUM_EL_BOUAGHI': 'OEB', 'OUM EL BOUAGHI': 'OEB',
            'DOT_RELIZANE': 'REL', 'RELIZANE': 'REL',
            'DOT_SAIDA': 'SAI', 'SAIDA': 'SAI',
            'DOT_SETIF': 'SET', 'SETIF': 'SET',
            'DOT_SIDI_BEL_ABBES': 'SBA', 'SIDI_BEL_ABBES': 'SBA', 'SIDI BEL ABBES': 'SBA',
            'DOT_SKIKDA': 'SKI', 'SKIKDA': 'SKI',
            'DOT_SOUK_AHRAS': 'SAH', 'SOUK_AHRAS': 'SAH', 'SOUK AHRAS': 'SAH',
            'DOT_TAMANRASSET': 'TAM', 'TAMANRASSET': 'TAM',
            'DOT_TEBESSA': 'TEB', 'TEBESSA': 'TEB',
            'DOT_TIARET': 'TIA', 'TIARET': 'TIA',
            'DOT_TINDOUF': 'TIN', 'TINDOUF': 'TIN',
            'DOT_TIPAZA': 'TIP', 'TIPAZA': 'TIP',
            'DOT_TISSEMSILT': 'TIS', 'TISSEMSILT': 'TIS',
            'DOT_TIZI_OUZOU': 'TZO', 'TIZI_OUZOU': 'TZO', 'TIZI OUZOU': 'TZO',
            'DOT_TLEMCEN': 'TLE', 'TLEMCEN': 'TLE',
            'Magasin DOT MOSTAGANEM': 'MOS', 'Magasin DOT LAGHOUAT': 'LAG', 'Magasin DOT EL OUED': 'OUD'
        }

        # Add mapping for Department to DOT (based on DNT data observed in logs)
        dept_to_dot_mapping = {
            'ACTEL ANNASR': 'BAT',         # Batna
            'ACTEL TOUGOURT': 'OUA',       # Touggourt
            'ACTEL AIN SEFRA': 'NAA',      # Naama
            'ACTEL HASSI MESSAOUD': 'OUA',  # Ouargla
            'ACTEL COUDIAT': 'CON',        # Constantine
            'ACTEL AISSAT IDIR': 'ALG',    # Alger
            'Direction Commerciale Corporate': 'SIE',  # Siege
        }

        for idx, row in enumerate(data):
            try:
                # Debug some rows
                if idx < 3 or idx % 100 == 0:
                    logger.info(f"Processing CADNT row {idx+1}/{len(data)}")
                    logger.debug(f"Available keys in row: {list(row.keys())}")

                # Parse entry date if available
                entry_date = None
                if 'ENTRY_DATE' in row and row['ENTRY_DATE']:
                    try:
                        entry_date = self._parse_datetime(row['ENTRY_DATE'])
                    except Exception:
                        pass

                # Try to find DOT code from various field names
                dot_code = None
                for field_key, standard_key in dot_field_mapping.items():
                    if field_key.upper() in row and row[field_key.upper()]:
                        dot_code = row[field_key.upper()]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key.upper()}'")
                        break
                    elif field_key in row and row[field_key]:
                        dot_code = row[field_key]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key}'")
                        break

                # Try to extract DOT from department if no DOT code found
                department = row.get('DEPARTEMENT', '')
                if not dot_code and department:
                    # Check if department value is in our mapping
                    if department in dept_to_dot_mapping:
                        dot_code = dept_to_dot_mapping[department]
                        logger.debug(
                            f"Mapped department '{department}' to DOT code '{dot_code}'")
                    # Try to extract DOT code from department name if it follows a pattern
                    elif department.startswith('DOT_') or department.startswith('Magasin DOT '):
                        if department.startswith('DOT_'):
                            potential_code = department.split(
                                '_')[1] if '_' in department else ''
                        else:  # Magasin DOT X
                            potential_code = department.replace(
                                'Magasin DOT ', '')

                        if potential_code and potential_code in org_to_dot_mapping.values():
                            dot_code = potential_code
                            logger.debug(
                                f"Extracted DOT code '{dot_code}' from department '{department}'")

                # Get DOT instance if available
                dot_instance = None
                if dot_code:
                    try:
                        dot_instance, created = DOT.objects.get_or_create(
                            code=dot_code, defaults={'name': dot_code})
                        logger.debug(
                            f"CADNT row {idx+1}: DOT instance {'created' if created else 'fetched'} with ID: {dot_instance.id}")
                    except Exception as e:
                        logger.error(
                            f"Error getting/creating DOT for CADNT row {idx+1}: {str(e)}")
                        dot_instance = None
                else:
                    logger.debug(f"CADNT row {idx+1}: No DOT code found")

                # Create a new CADNT record
                CADNT.objects.create(
                    invoice=invoice,
                    pri_identity=row.get('PRI_IDENTITY', ''),
                    customer_code=row.get('CUST_CODE', ''),
                    full_name=row.get('FULL_NAME', ''),
                    transaction_id=row.get('TRANS_ID', ''),
                    transaction_type=row.get('TRANS_TYPE', ''),
                    channel_id=row.get('CHANNEL_ID', ''),
                    ext_trans_type=row.get('EXT_TRANS_TYPE', ''),
                    total_amount=row.get('TTC', 0),
                    tax_amount=row.get('TVA', 0),
                    amount_pre_tax=row.get('HT', 0),
                    entry_date=entry_date,
                    actel=row.get('ACTEL', ''),
                    dot=dot_instance,
                    dot_code=dot_code if dot_code else '',
                    customer_lev1=row.get('CUST_LEV1', ''),
                    customer_lev2=row.get('CUST_LEV2', ''),
                    customer_lev3=row.get('CUST_LEV3', ''),
                    department=department,
                    # cleaning_status='raw'  # Mark as raw data
                )
                saved_count += 1

                if idx < 3 or idx % 100 == 0:
                    logger.info(f"Successfully saved CADNT row {idx+1}")

            except Exception as e:
                logger.error(
                    f"Error saving CA DNT record (row {idx+1}): {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_ca_dnt: Saved {saved_count}/{len(data)} records")
        return saved_count

    def _save_ca_rfd(self, invoice, data):
        """Save CA RFD data without filtering/cleaning"""
        saved_count = 0
        logger.info(
            f"Starting _save_ca_rfd for invoice {invoice.id}, with {len(data)} rows")

        # Add field mapping for DOT to support various formats
        dot_field_mapping = {
            'dot': 'DOT', 'do': 'DOT', 'dot_code': 'DOT', 'dotcode': 'DOT',
            'code_dot': 'DOT', 'department': 'DOT', 'dept': 'DOT', 'direction': 'DOT',
            'DOT': 'DOT', 'DO': 'DOT', 'DOT_CODE': 'DOT', 'DEPARTMENT': 'DOT',
            'DIRECTION': 'DOT', 'DEPT': 'DOT'
        }

        # Organization to DOT mapping
        org_to_dot_mapping = {
            'AT_SIEGE': 'Siege', 'SIEGE': 'Siege', 'SIEGE_DG': 'Siege', 'Siege': 'Siege',
            'DOT_ADRAR': 'Adrar', 'ADRAR': 'Adrar', 'Adrar': 'Adrar',
            'DOT_AIN_DEFLA': 'Ain_Defla', 'AIN_DEFLA': 'Ain_Defla', 'AIN DEFLA': 'Ain_Defla', 'Ain_Defla': 'Ain_Defla',
            'DOT_ALGER': 'Alger_Centre', 'ALGER': 'Alger_Centre', 'DOT_ALGER_CENTRE': 'Alger_Centre', 'ALGER_CENTRE': 'Alger_Centre', 'ALGER CENTRE': 'Alger_Centre', 'Alger_Centre': 'Alger_Centre',
            'DOT_ALGER_EST': 'Alger_Est', 'ALGER_EST': 'Alger_Est', 'ALGER EST': 'Alger_Est', 'Alger_Est': 'Alger_Est',
            'DOT_ALGER_OUEST': 'Alger_Ouest', 'ALGER_OUEST': 'Alger_Ouest', 'ALGER OUEST': 'Alger_Ouest', 'Alger_Ouest': 'Alger_Ouest',
            'DOT_ANNABA': 'Annaba', 'ANNABA': 'Annaba', 'Annaba': 'Annaba',
            'DOT_BATNA': 'Batna', 'BATNA': 'Batna', 'Batna': 'Batna',
            'DOT_BECHAR': 'Bechar', 'BECHAR': 'Bechar', 'Bechar': 'Bechar',
            'DOT_BEJAIA': 'Bejaia', 'BEJAIA': 'Bejaia', 'Bejaia': 'Bejaia',
            'DOT_BISKRA': 'Biskra', 'BISKRA': 'Biskra', 'Biskra': 'Biskra',
            'DOT_BLIDA': 'Blida', 'BLIDA': 'Blida', 'Blida': 'Blida',
            'DOT_BOUIRA': 'Bouira', 'BOUIRA': 'Bouira', 'Bouira': 'Bouira',
            'DOT_BOUMERDES': 'Boumerdes', 'BOUMERDES': 'Boumerdes', 'Boumerdes': 'Boumerdes',
            'DOT_BORDJ_BOU_ARRERIDJ': 'Bordj_Bou_Arreridj', 'BORDJ_BOU_ARRERIDJ': 'Bordj_Bou_Arreridj', 'BORDJ BOU ARRERIDJ': 'Bordj_Bou_Arreridj', 'Bordj_Bou_Arreridj': 'Bordj_Bou_Arreridj',
            'DOT_CHLEF': 'Chlef', 'CHLEF': 'Chlef', 'Chlef': 'Chlef',
            'DOT_CONSTANTINE': 'Constantine', 'CONSTANTINE': 'Constantine', 'Constantine': 'Constantine',
            'DOT_DJELFA': 'Djelfa', 'DJELFA': 'Djelfa', 'Djelfa': 'Djelfa',
            'DOT_EL_BAYADH': 'El_Bayadh', 'EL_BAYADH': 'El_Bayadh', 'EL BAYADH': 'El_Bayadh', 'El_Bayadh': 'El_Bayadh',
            'DOT_EL_OUED': 'El_Oued', 'EL_OUED': 'El_Oued', 'EL OUED': 'El_Oued', 'El_Oued': 'El_Oued',
            'DOT_GHARDAIA': 'Ghardaia', 'GHARDAIA': 'Ghardaia', 'Ghardaia': 'Ghardaia',
            'DOT_GUELMA': 'Guelma', 'GUELMA': 'Guelma', 'Guelma': 'Guelma',
            'DOT_ILLIZI': 'Illizi', 'ILLIZI': 'Illizi', 'Illizi': 'Illizi',
            'DOT_JIJEL': 'Jijel', 'Jijel': 'Jijel', 'Jijel': 'Jijel',
            'DOT_KHENCHELA': 'Khenchela', 'KHENCHELA': 'Khenchela', 'Khenchela': 'Khenchela',
            'DOT_LAGHOUAT': 'Laghouat', 'LAGHOUAT': 'Laghouat', 'Laghouat': 'Laghouat',
            'DOT_MASCARA': 'Mascara', 'MASCARA': 'Mascara', 'Mascara': 'Mascara',
            'DOT_MEDEA': 'Medea', 'MEDEA': 'Medea', 'Medea': 'Medea',
            'DOT_MILA': 'Mila', 'MILA': 'Mila', 'Mila': 'Mila',
            'DOT_MOSTAGANEM': 'Mostaganem', 'MOSTAGANEM': 'Mostaganem', 'Mostaganem': 'Mostaganem',
            'DOT_MSILA': 'M_Sila', 'MSILA': 'M_Sila', 'M_Sila': 'M_Sila',
            'DOT_NAAMA': 'Naama', 'NAAMA': 'Naama', 'Naama': 'Naama',
            'DOT_ORAN': 'Oran', 'ORAN': 'Oran', 'Oran': 'Oran',
            'DOT_OUARGLA': 'Ouargla', 'OUARGLA': 'Ouargla', 'Ouargla': 'Ouargla',
            'DOT_OUM_EL_BOUAGHI': 'Oum_El_Bouaghi', 'OUM_EL_BOUAGHI': 'Oum_El_Bouaghi', 'OUM EL BOUAGHI': 'Oum_El_Bouaghi', 'Oum_El_Bouaghi': 'Oum_El_Bouaghi',
            'DOT_RELIZANE': 'Relizane', 'RELIZANE': 'Relizane', 'Relizane': 'Relizane',
            'DOT_SAIDA': 'Saida', 'SAIDA': 'Saida', 'Saida': 'Saida',
            'DOT_SETIF': 'Setif', 'SETIF': 'Setif', 'Setif': 'Setif',
            'DOT_SIDI_BEL_ABBES': 'Sidi_Bel_Abbes', 'SIDI_BEL_ABBES': 'Sidi_Bel_Abbes', 'SIDI BEL ABBES': 'Sidi_Bel_Abbes', 'Sidi_Bel_Abbes': 'Sidi_Bel_Abbes',
            'DOT_SKIKDA': 'Skikda', 'SKIKDA': 'Skikda', 'Skikda': 'Skikda',
            'DOT_SOUK_AHRAS': 'Souk_Ahras', 'SOUK_AHRAS': 'Souk_Ahras', 'SOUK AHRAS': 'Souk_Ahras', 'Souk_Ahras': 'Souk_Ahras',
            'DOT_TAMANRASSET': 'Tamanrasset', 'TAMANRASSET': 'Tamanrasset', 'Tamanrasset': 'Tamanrasset',
            'DOT_TEBESSA': 'Tebessa', 'TEBESSA': 'Tebessa', 'Tebessa': 'Tebessa',
            'DOT_TIARET': 'Tiaret', 'TIARET': 'Tiaret', 'Tiaret': 'Tiaret',
            'DOT_TINDOUF': 'Tindouf', 'TINDOUF': 'Tindouf', 'Tindouf': 'Tindouf',
            'DOT_TIPAZA': 'Tipaza', 'TIPAZA': 'Tipaza', 'Tipaza': 'Tipaza',
            'DOT_TISSEMSILT': 'Tissemsilt', 'TISSEMSILT': 'Tissemsilt', 'Tissemsilt': 'Tissemsilt',
            'DOT_TIZI_OUZOU': 'Tizi_Ouzou', 'TIZI_OUZOU': 'Tizi_Ouzou', 'TIZI OUZOU': 'Tizi_Ouzou', 'Tizi_Ouzou': 'Tizi_Ouzou',
            'DOT_TLEMCEN': 'Tlemcen', 'TLEMCEN': 'Tlemcen', 'Tlemcen': 'Tlemcen',
            'DOT_TOUGGOURT': 'Touggourt', 'TOUGGOURT': 'Touggourt', 'Touggourt': 'Touggourt',
            'Ain_Temouchent': 'ATE',
            'Beni Abbes': 'BNA',
            'Bordj Badji Mokhtar': 'BBM',
            'Djanet': 'DJN',
            'El Meghaier': 'EMG',
            'El_Tarf': 'ETA',
            'In Salah': 'INS',
            'Ouled Djellal': 'ODJ',
            'Timimoune': 'TMN',
            'Magasin DOT MOSTAGANEM': 'MOS', 'Magasin DOT LAGHOUAT': 'LAG', 'Magasin DOT EL OUED': 'OUD',
            'Magasin DOT NAAMA': 'NAA', 'Magasin DOT RELIZANE': 'REL', 'Magasin DOT TIMIMOUN': 'TMN',
            # Adding new DOT names
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER CENTRE': 'ALC',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER EST': 'ALE',
            'DIRECTION RÉGIONALE TÉLÉCOMS ALGER OUEST': 'ALO',
            'DIRECTION RÉGIONALE TÉLÉCOMS ANNABA': 'ANN',
            'DIRECTION RÉGIONALE TÉLÉCOMS BATNA': 'BAT',
            'DIRECTION RÉGIONALE TÉLÉCOMS BÉJAÏA': 'BJA',
            'DIRECTION RÉGIONALE TÉLÉCOMS BLIDA': 'BLI',
            'DIRECTION RÉGIONALE TÉLÉCOMS CHLEF': 'CHL',
            'Magasin DOT NAAMA': 'NAA', 'Magasin DOT RELIZANE': 'REL', 'Magasin DOT TIMIMOUN': 'TMN'
        }

        # Add mapping for Department to DOT (based on RFD data observed in logs)
        dept_to_dot_mapping = {
            'ACTEL KHENCHELA': 'KHE',        # Khenchela
            'ACTEL ABBANE RAMDANE': 'ORA',   # Oran
            'ACTEL SIDI AICH': 'BJA',        # Bejaia
            'ACTEL BEJAIA 42': 'BJA',        # Bejaia
            'ACTEL IMAMA': 'TLE',            # Tlemcen
            'ACTEL EL BIODH SIDI CHEIKH': 'BAY',  # El Bayadh
            'ACTEL BOUGAA': 'SET',           # Setif
            'ACTEL BOUFARIK': 'BLI',         # Blida
            'ACTEL KHROUB': 'CON',           # Constantine
            'ACTEL MOHAMMADIA': 'ALE',       # Alger Est
            'ACTEL 20 aout 1955': 'SKI',     # Skikda
            'ACTEL CHETTIA': 'CHL',          # Chlef
            'ACTEL AKBOU': 'BJA',            # Bejaia
            'ACTEL Bordj Bou Arreridj 13': 'BBA',  # Bordj Bou Arreridj
            'ACTEL Mazouna': 'REL',          # Relizane
            'ACTEL Oued Rhiou': 'REL',       # Relizane
            'ACTEL MARTYRS': 'CON',          # Constantine
            'ACTEL Ras El Oued': 'BBA',      # Bordj Bou Arreridj
            'ACTEL MILA': 'MIL',             # Mila
            'ACTEL COUDIAT': 'CON',          # Constantine
            'ACTEL BIR MOURAD RAIS': 'ALC',  # Alger Centre
            'ACTEL OULED YAICH': 'BLI',      # Blida
            'ACTEL HUSSEIN DEY': 'ALE',      # Alger Est
            'ACTEL GHAZAOUET': 'TLE',        # Tlemcen
            'ACTEL TIZI OUZOU NOUVELLE VILLE': 'TZO',  # Tizi Ouzou
            'ACTEL DELLYS': 'BMD',           # Boumerdes
            'ACTEL Tebessa': 'TEB',          # Tebessa
            'ACTEL TLEMCEN': 'TLE',          # Tlemcen
            'ACTEL MOUZAIA': 'BLI',          # Blida
            'ACTEL LAARARSSA': 'BLI',        # Blida
            'ACTEL AIN KEBIRA': 'SET',       # Setif
            'ACTEL BORDJ EL KIFFAN': 'ALE',  # Alger Est
            'ACTEL 8 mai 45 SETIF': 'SET',   # Setif
            'ACTEL OUM EL BOUAGHI': 'OEB',   # Oum El Bouaghi
            'ACTEL BOUIRA': 'BOU',           # Bouira
            'ACTEL SIDI BEL ABBES': 'SBA',   # Sidi Bel Abbes
            'ACTEL HYDRA': 'ALC',            # Alger Centre
            'ACTEL CHERAGA': 'ALO',          # Alger Ouest
            'ACTEL BAB EL OUED': 'ALC',      # Alger Centre
            'ACTEL SIDI ABDELLAH': 'ALO',    # Alger Ouest
            'ACTEL ADRAR': 'ADR',            # Adrar
            'ACTEL DJANET': 'DJN',           # Djanet
            'ACTEL 5 JUILLET (DJELFA)': 'DJE',  # Djelfa
            'ACTEL SAIDA': 'SAI',            # Saida
            'ACTEL Tissemsilt': 'TIS',       # Tissemsilt
            'ACTEL Tiaret': 'TIA',           # Tiaret
            'ACTEL EL TARF': 'ETA',          # El Tarf
            'ACTEL ILLIZI': 'ILL',           # Illizi
            'ACTEL BECHAR': 'BCH',           # Bechar
            'ACTEL TIMIMOUNE': 'TMN',        # Timimoune
            'ACTEL LAGHOUAT': 'LAG',         # Laghouat
            'ACTEL TINDOUF': 'TIN',          # Tindouf
            'ACTEL EL OUED': 'OUD',          # El Oued
            'ACTEL BENI ABBES': 'BNA',       # Beni Abbes
            'Direction Commerciale Corporate': 'SIE',  # Siege
            'ACTEL NAAMA': 'NAA',            # Naama
            'ACTEL BORDJ BADJI MOKHTAR': 'BBM',  # Bordj Badji Mokhtar
            'ACTEL TOUGOURT': 'TOU',         # Touggourt
            'ACTEL EL MEGHAIER': 'EMG',      # El Meghaier
            'ACTEL TAMANRASSET': 'TAM',      # Tamanrasset
            'ACTEL IN SALAH': 'INS',         # In Salah
            'ACTEL EL MENIAA': 'MEN',        # EL Meniaa
            'ACTEL INGUEZZAM': 'IGZ',        # In Guezzam
            'ACTEL OULED DJELLAL': 'ODJ'     # Ouled Djellal
        }

        for idx, row in enumerate(data):
            try:
                # Debug some rows
                if idx < 3 or idx % 1000 == 0:
                    logger.info(f"Processing CARFD row {idx+1}/{len(data)}")
                    logger.debug(f"Available keys in row: {list(row.keys())}")

                # Parse entry date if available
                entry_date = None
                if 'ENTRY_DATE' in row and row['ENTRY_DATE']:
                    try:
                        entry_date = self._parse_datetime(row['ENTRY_DATE'])
                    except Exception:
                        pass

                # Try to find DOT code from various field names
                dot_code = None
                for field_key, standard_key in dot_field_mapping.items():
                    if field_key.upper() in row and row[field_key.upper()]:
                        dot_code = row[field_key.upper()]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key.upper()}'")
                        break
                    elif field_key in row and row[field_key]:
                        dot_code = row[field_key]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key}'")
                        break

                # Check if the found DOT code needs mapping from full name to code
                if dot_code and dot_code in org_to_dot_mapping:
                    dot_code = org_to_dot_mapping[dot_code]
                    logger.debug(f"Mapped DOT name to code: '{dot_code}'")

                # Try to extract DOT from department/ACTEL if no DOT code found
                department = row.get('DEPARTEMENT', '')
                actel = row.get('ACTEL', '')

                if not dot_code and department:
                    # Check if department value is in our mapping
                    if department in dept_to_dot_mapping:
                        dot_code = dept_to_dot_mapping[department]
                        logger.debug(
                            f"Mapped department '{department}' to DOT code '{dot_code}'")
                    # Try to extract DOT code from department name if it follows a pattern
                    elif department.startswith('DOT_') or department.startswith('Magasin DOT '):
                        if department.startswith('DOT_'):
                            potential_code = department.split(
                                '_')[1] if '_' in department else ''
                        else:  # Magasin DOT X
                            potential_code = department.replace(
                                'Magasin DOT ', '')

                        if potential_code and potential_code in org_to_dot_mapping.values():
                            dot_code = potential_code
                            logger.debug(
                                f"Extracted DOT code '{dot_code}' from department '{department}'")

                # Try ACTEL field if still no DOT
                if not dot_code and actel:
                    actel_parts = actel.split('|')
                    if len(actel_parts) > 1:
                        actel_name = actel_parts[1].strip()
                        if actel_name in dept_to_dot_mapping:
                            dot_code = dept_to_dot_mapping[actel_name]
                            logger.debug(
                                f"Mapped ACTEL '{actel_name}' to DOT code '{dot_code}'")

                # Get DOT instance if available
                dot_instance = None
                if dot_code:
                    try:
                        dot_instance, created = DOT.objects.get_or_create(
                            code=dot_code, defaults={'name': dot_code})
                        logger.debug(
                            f"CARFD row {idx+1}: DOT instance {'created' if created else 'fetched'} with ID: {dot_instance.id}")
                    except Exception as e:
                        logger.error(
                            f"Error getting/creating DOT for CARFD row {idx+1}: {str(e)}")
                        dot_instance = None
                else:
                    logger.debug(f"CARFD row {idx+1}: No DOT code found")

                # Create a new CARFD record
                CARFD.objects.create(
                    invoice=invoice,
                    transaction_id=row.get('TRANS_ID', ''),
                    full_name=row.get('FULL_NAME', ''),
                    actel=row.get('ACTEL', ''),
                    dot=dot_instance,
                    dot_code=dot_code if dot_code else '',
                    total_amount=row.get('TTC', 0),
                    droit_timbre=row.get('DROIT_TIMBRE', 0),
                    tax_amount=row.get('TVA', 0),
                    amount_pre_tax=row.get('HT', 0),
                    entry_date=entry_date,
                    customer_code=row.get('CUST_CODE', ''),
                    pri_identity=row.get('PRI_IDENTITY', ''),
                    customer_lev1=row.get('CUST_LEV1', ''),
                    customer_lev2=row.get('CUST_LEV2', ''),
                    customer_lev3=row.get('CUST_LEV3', ''),
                    department=department,
                    # cleaning_status='raw'  # Mark as raw data
                )
                saved_count += 1

                if idx < 3 or idx % 1000 == 0:
                    logger.info(f"Successfully saved CARFD row {idx+1}")

            except Exception as e:
                logger.error(
                    f"Error saving CA RFD record (row {idx+1}): {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_ca_rfd: Saved {saved_count}/{len(data)} records")
        return saved_count

    def _save_ca_cnt(self, invoice, data):
        """Save CA CNT data without filtering/cleaning"""
        saved_count = 0
        logger.info(
            f"Starting _save_ca_cnt for invoice {invoice.id}, with {len(data)} rows")

        # Add field mapping for DOT to support various formats
        dot_field_mapping = {
            'dot': 'DOT', 'do': 'DOT', 'dot_code': 'DOT', 'dotcode': 'DOT',
            'code_dot': 'DOT', 'department': 'DOT', 'dept': 'DOT', 'direction': 'DOT',
            'DOT': 'DOT', 'DO': 'DOT', 'DOT_CODE': 'DOT', 'DEPARTMENT': 'DOT',
            'DIRECTION': 'DOT', 'DEPT': 'DOT'
        }

        # Organization to DOT mapping
        org_to_dot_mapping = {
            'AT_SIEGE': 'SIE', 'SIEGE': 'SIE', 'SIEGE_DG': 'SIE',
            'DOT_ADRAR': 'ADR', 'ADRAR': 'ADR',
            'DOT_AIN_DEFLA': 'ADF', 'AIN_DEFLA': 'ADF', 'AIN DEFLA': 'ADF',
            'DOT_ALGER': 'ALG', 'ALGER': 'ALG', 'DOT_ALGER_CENTRE': 'ALG', 'ALGER_CENTRE': 'ALG', 'ALGER CENTRE': 'ALG',
            'DOT_ALGER_EST': 'ALE', 'ALGER_EST': 'ALE', 'ALGER EST': 'ALE', 'Alger_Est': 'ALE',
            'DOT_ALGER_OUEST': 'ALO', 'ALGER_OUEST': 'ALO', 'ALGER OUEST': 'ALO', 'Alger_Ouest': 'ALO',
            'DOT_ANNABA': 'ANN', 'ANNABA': 'ANN', 'Annaba': 'ANN',
            'DOT_BATNA': 'BAT', 'BATNA': 'BAT', 'Batna': 'BAT',
            'DOT_BECHAR': 'BCH', 'BECHAR': 'BCH', 'Bechar': 'BCH',
            'DOT_BEJAIA': 'BJA', 'BEJAIA': 'BJA', 'Bejaia': 'BJA',
            'DOT_BISKRA': 'BIS', 'BISKRA': 'BIS', 'Biskra': 'BIS',
            'DOT_BLIDA': 'BLI', 'BLIDA': 'BLI', 'Blida': 'BLI',
            'DOT_BOUIRA': 'BOU', 'BOUIRA': 'BOU', 'Bouira': 'BOU',
            'DOT_BOUMERDES': 'BMD', 'BOUMERDES': 'BMD', 'Boumerdes': 'BMD',
            'DOT_BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ_BOU_ARRERIDJ': 'BBA', 'BORDJ BOU ARRERIDJ': 'BBA', 'Bordj_Bou_Arreridj': 'BBA',
            'DOT_CHLEF': 'CHL', 'CHLEF': 'CHL', 'Chlef': 'CHL',
            'DOT_CONSTANTINE': 'CON', 'CONSTANTINE': 'CON', 'Constantine': 'CON',
            'DOT_DJELFA': 'DJE', 'DJELFA': 'DJE', 'Djelfa': 'DJE',
            'DOT_EL_BAYADH': 'BAY', 'EL_BAYADH': 'BAY', 'EL BAYADH': 'BAY', 'El_Bayadh': 'BAY',
            'DOT_EL_OUED': 'OUD', 'EL_OUED': 'OUD', 'EL OUED': 'OUD', 'El_Oued': 'OUD',
            'DOT_GHARDAIA': 'GHA', 'GHARDAIA': 'GHA', 'Ghardaia': 'GHA',
            'DOT_GUELMA': 'GUE', 'GUELMA': 'GUE', 'Guelma': 'GUE',
            'DOT_ILLIZI': 'ILL', 'ILLIZI': 'ILL', 'Illizi': 'ILL',
            'DOT_JIJEL': 'JIJ', 'JIJEL': 'JIJ', 'Jijel': 'JIJ',
            'DOT_KHENCHELA': 'KHE', 'KHENCHELA': 'KHE', 'Khenchela': 'KHE',
            'DOT_LAGHOUAT': 'LAG', 'LAGHOUAT': 'LAG', 'Laghouat': 'LAG',
            'DOT_MASCARA': 'MAS', 'MASCARA': 'MAS', 'Mascara': 'MAS',
            'DOT_MEDEA': 'MED', 'MEDEA': 'MED', 'Medea': 'MED',
            'DOT_MILA': 'MIL', 'MILA': 'MIL', 'Mila': 'MIL',
            'DOT_MOSTAGANEM': 'MOS', 'MOSTAGANEM': 'MOS', 'Mostaganem': 'MOS',
            'DOT_MSILA': 'MSI', 'MSILA': 'MSI', 'M_Sila': 'MSI',
            'DOT_NAAMA': 'NAA', 'NAAMA': 'NAA', 'Naama': 'NAA',
            'DOT_ORAN': 'ORA', 'ORAN': 'ORA', 'Oran': 'ORA',
            'DOT_OUARGLA': 'OUA', 'OUARGLA': 'OUA', 'Ouargla': 'OUA',
            'DOT_OUM_EL_BOUAGHI': 'OEB', 'OUM_EL_BOUAGHI': 'OEB', 'OUM EL BOUAGHI': 'OEB', 'Oum_El_Bouaghi': 'OEB',
            'DOT_RELIZANE': 'REL', 'RELIZANE': 'REL', 'Relizane': 'REL',
            'DOT_SAIDA': 'SAI', 'SAIDA': 'SAI', 'Saida': 'SAI',
            'DOT_SETIF': 'SET', 'SETIF': 'SET', 'Setif': 'SET',
            'DOT_SIDI_BEL_ABBES': 'SBA', 'SIDI_BEL_ABBES': 'SBA', 'SIDI BEL ABBES': 'SBA', 'Sidi_Bel_Abbes': 'SBA',
            'DOT_SKIKDA': 'SKI', 'SKIKDA': 'SKI', 'Skikda': 'SKI',
            'DOT_SOUK_AHRAS': 'SAH', 'SOUK_AHRAS': 'SAH', 'SOUK AHRAS': 'SAH', 'Souk_Ahras': 'SAH',
            'DOT_TAMANRASSET': 'TAM', 'TAMANRASSET': 'TAM', 'Tamanrasset': 'TAM',
            'DOT_TEBESSA': 'TEB', 'TEBESSA': 'TEB', 'Tebessa': 'TEB',
            'DOT_TIARET': 'TIA', 'TIARET': 'TIA', 'Tiaret': 'TIA',
            'DOT_TINDOUF': 'TIN', 'TINDOUF': 'TIN', 'Tindouf': 'TIN',
            'DOT_TIPAZA': 'TIP', 'TIPAZA': 'TIP', 'Tipaza': 'TIP',
            'DOT_TISSEMSILT': 'TIS', 'TISSEMSILT': 'TIS', 'Tissemsilt': 'TIS',
            'DOT_TIZI_OUZOU': 'TZO', 'TIZI_OUZOU': 'TZO', 'TIZI OUZOU': 'TZO', 'Tizi_Ouzou': 'TZO',
            'DOT_TLEMCEN': 'TLE', 'TLEMCEN': 'TLE', 'Tlemcen': 'TLE',
            'DOT_TOUGGOURT': 'TOU', 'TOUGGOURT': 'TOU', 'Touggourt': 'TOU',
            'Alger_Centre': 'ALC',
            'Ain_Temouchent': 'ATE',
            'Beni Abbes': 'BNA',
            'Bordj Badji Mokhtar': 'BBM',
            'Djanet': 'DJN',
            'El Meghaier': 'EMG',
            'El_Tarf': 'ETA',
            'In Salah': 'INS',
            'Ouled Djellal': 'ODJ',
            'Timimoune': 'TMN',
            'Magasin DOT MOSTAGANEM': 'MOS', 'Magasin DOT LAGHOUAT': 'LAG', 'Magasin DOT EL OUED': 'OUD',
            'Magasin DOT NAAMA': 'NAA', 'Magasin DOT RELIZANE': 'REL', 'Magasin DOT TIMIMOUN': 'TMN'
        }

        # Add mapping for Department to DOT (based on CNT data observed in logs)
        dept_to_dot_mapping = {
            'ACTEL AIN BENIANE': 'ALO',         # Alger Ouest
            'ACTEL HUSSEIN DEY': 'ALE',         # Alger Est
            'ACTEL 5 JUILLET (DJELFA)': 'DJE',  # Djelfa
            'ACTEL AIN SMARA': 'CON',           # Constantine
            'ACTEL IN SALAH': 'INS',            # In Salah
            'ACTEL ZIGHOUD YOUCEF (Annaba)': 'ANN',  # Annaba
            'ACTEL EL MILIA': 'JIJ',            # Jijel
            'ACTEL SIG': 'MAS',                 # Mascara
            'ACTEL TLEMCEN': 'TLE',             # Tlemcen
            'ACTEL GUELMA': 'GUE',              # Guelma
            'ACTEL BEJAIA 42': 'BJA',           # Bejaia
            'ACTEL BOUSAADA': 'MSI',            # M_Sila
            'ACTEL Elharrouch': 'SKI',          # Skikda
            'ACTEL MEDEA': 'MED',               # Medea
            'ACTEL BISKRA': 'BIS',              # Biskra
            'ACTEL OULED YAICH': 'BLI',         # Blida
            'ACTEL MSILA': 'MSI',               # M_Sila
            'ACTEL SIDI BEL ABBES': 'SBA',      # Sidi_Bel_Abbes
            'ACTEL HAI DJIHANI BECHAR': 'BCH',  # Bechar
            'ACTEL Relizane': 'REL',            # Relizane
            'ACTEL TEMACINE': 'TOU',            # Touggourt
            'ACTEL Bordj Ghedir': 'BBA',        # Bordj_Bou_Arreridj
            'ACTEL EL TARF': 'ETA',             # El_Tarf
            'ACTEL Tiaret': 'TIA',              # Tiaret
            'ACTEL REGGANE': 'ADR',             # Adrar
            'ACTEL TAMANRASSET': 'TAM',         # Tamanrasset
            'ACTEL NAAMA': 'NAA',               # Naama
            'ACTEL LAGHOUAT': 'LAG',            # Laghouat
            'ACTEL TIZI OUZOU': 'TZO',          # Tizi_Ouzou
            'ACTEL OUM EL BOUAGHI': 'OEB',      # Oum_El_Bouaghi
            'ACTEL EL BAYADH': 'BAY',           # El_Bayadh
            'ACTEL SAIDA': 'SAI',               # Saida
            'ACTEL MOSTAGANEM': 'MOS',          # Mostaganem
            'ACTEL Tissemsilt': 'TIS',          # Tissemsilt
            'ACTEL TIMIMOUNE': 'TMN',           # Timimoune
            'ACTEL SOUK AHRAS': 'SAH',          # Souk_Ahras
            'ACTEL GHARDAIA': 'GHA',            # Ghardaia
            'ACTEL Chlef': 'CHL',               # Chlef
            'ACTEL Ain Defla': 'ADF',           # Ain_Defla
            'ACTEL OUARGLA': 'OUA',             # Ouargla
            'ACTEL MILA': 'MIL',                # Mila
            'ACTEL AIN TEMOUCHENT': 'ATE',      # Ain_Temouchent
            'ACTEL ILLIZI': 'ILL',              # Illizi
            'ACTEL TINDOUF': 'TIN',             # Tindouf
            'ACTEL OULED DJELLAL': 'ODJ',       # Ouled Djellal
            'ACTEL BENI ABBES': 'BNA',          # Beni Abbes
            'ACTEL KHENCHELA': 'KHE',           # Khenchela
            'ACTEL DJANET': 'DJN',              # Djanet
            'ACTEL BORDJ BADJI MOKHTAR': 'BBM',  # Bordj Badji Mokhtar
            'ACTEL EL MEGHAIER': 'EMG',         # El Meghaier
            'Direction des Systemes Billings': 'SIE',  # Siege
            'Direction Commerciale Corporate': 'SIE',  # Siege
            'Sous Direction COMMERCIALE': 'SIE',       # Siege
            'Direction de l Interconnexion et de la Regulation': 'SIE'  # Siege
        }

        for idx, row in enumerate(data):
            try:
                # Debug some rows
                if idx < 3 or idx % 1000 == 0:
                    logger.info(f"Processing CACNT row {idx+1}/{len(data)}")
                    logger.debug(f"Available keys in row: {list(row.keys())}")

                # Parse entry date if available
                entry_date = None
                if 'ENTRY_DATE' in row and row['ENTRY_DATE']:
                    try:
                        entry_date = self._parse_datetime(row['ENTRY_DATE'])
                    except Exception:
                        pass

                # Try to find DOT code from various field names
                dot_code = None
                for field_key, standard_key in dot_field_mapping.items():
                    if field_key.upper() in row and row[field_key.upper()]:
                        dot_code = row[field_key.upper()]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key.upper()}'")
                        break
                    elif field_key in row and row[field_key]:
                        dot_code = row[field_key]
                        logger.debug(
                            f"Found DOT code '{dot_code}' from field '{field_key}'")
                        break

                # Check if the found DOT code needs mapping from full name to code
                if dot_code and dot_code in org_to_dot_mapping:
                    dot_code = org_to_dot_mapping[dot_code]
                    logger.debug(f"Mapped DOT name to code: '{dot_code}'")

                # Try to extract DOT from department/ACTEL if no DOT code found
                department = row.get('DEPARTEMENT', '')
                actel = row.get('ACTEL', '')

                if not dot_code and department:
                    # Check if department value is in our mapping
                    if department in dept_to_dot_mapping:
                        dot_code = dept_to_dot_mapping[department]
                        logger.debug(
                            f"Mapped department '{department}' to DOT code '{dot_code}'")
                    # Try to extract DOT code from department name if it follows a pattern
                    elif department.startswith('DOT_') or department.startswith('Magasin DOT '):
                        if department.startswith('DOT_'):
                            potential_code = department.split(
                                '_')[1] if '_' in department else ''
                        else:  # Magasin DOT X
                            potential_code = department.replace(
                                'Magasin DOT ', '')

                        if potential_code and potential_code in org_to_dot_mapping.values():
                            dot_code = potential_code
                            logger.debug(
                                f"Extracted DOT code '{dot_code}' from department '{department}'")

                # Try ACTEL field if still no DOT
                if not dot_code and actel:
                    actel_parts = actel.split('|')
                    if len(actel_parts) > 1:
                        actel_name = actel_parts[1].strip()
                        if actel_name in dept_to_dot_mapping:
                            dot_code = dept_to_dot_mapping[actel_name]
                            logger.debug(
                                f"Mapped ACTEL '{actel_name}' to DOT code '{dot_code}'")

                # Get DOT instance if available
                dot_instance = None
                if dot_code:
                    try:
                        dot_instance, created = DOT.objects.get_or_create(
                            code=dot_code, defaults={'name': dot_code})
                        logger.debug(
                            f"CACNT row {idx+1}: DOT instance {'created' if created else 'fetched'} with ID: {dot_instance.id}")
                    except Exception as e:
                        logger.error(
                            f"Error getting/creating DOT for CACNT row {idx+1}: {str(e)}")
                        dot_instance = None
                else:
                    logger.debug(f"CACNT row {idx+1}: No DOT code found")

                # Create a new CACNT record
                CACNT.objects.create(
                    invoice=invoice,
                    invoice_adjusted=row.get('INVOICE_ADJUSTED', ''),
                    pri_identity=row.get('PRI_IDENTITY', ''),
                    customer_code=row.get('CUST_CODE', ''),
                    full_name=row.get('FULL_NAME', ''),
                    transaction_id=row.get('TRANS_ID', ''),
                    transaction_type=row.get('TRANS_TYPE', ''),
                    channel_id=row.get('CHANNEL_ID', ''),
                    total_amount=row.get('TTC', 0),
                    tax_amount=row.get('TVA', 0),
                    amount_pre_tax=row.get('HT', 0),
                    entry_date=entry_date,
                    actel=row.get('ACTEL', ''),
                    dot=dot_instance,
                    dot_code=dot_code if dot_code else '',
                    customer_lev1=row.get('CUST_LEV1', ''),
                    customer_lev2=row.get('CUST_LEV2', ''),
                    customer_lev3=row.get('CUST_LEV3', ''),
                    department=department,
                    # cleaning_status='raw'  # Mark as raw data
                )
                saved_count += 1

                if idx < 3 or idx % 1000 == 0:
                    logger.info(f"Successfully saved CACNT row {idx+1}")

            except Exception as e:
                logger.error(
                    f"Error saving CA CNT record (row {idx+1}): {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_ca_cnt: Saved {saved_count}/{len(data)} records")
        return saved_count

    def _save_journal_ventes(self, invoice, data):
        """Save Journal des Ventes data without filtering/cleaning"""
        saved_count = 0

        # Debug log
        logger.info(
            f"Starting _save_journal_ventes for invoice {invoice.id}, with {len(data) if data else 0} rows")

        # Log first row for debugging
        if data and len(data) > 0:
            logger.info(f"First row of Journal Ventes data: {data[0]}")
            logger.info(
                f"Available keys in first row: {list(data[0].keys() if isinstance(data[0], dict) else [])}")

        # Field mapping (supports both lowercase and uppercase fields)
        field_mapping = {


            # Organization field
            'organization': 'organization', 'org_name': 'organization',
            'ORG_NAME': 'organization', 'organisation': 'organization',

            # Origin field
            'origin': 'origin', 'origine': 'origin', 'ORIGINE': 'origin',

            # Invoice number field
            'invoice_number': 'invoice_number', 'n_fact': 'invoice_number',
            'N_FACT': 'invoice_number', 'n° fact': 'invoice_number',

            # Invoice type field
            'invoice_type': 'invoice_type', 'typ_fact': 'invoice_type',
            'TYP_FACT': 'invoice_type', 'type fact': 'invoice_type',

            # Invoice date field
            'invoice_date': 'invoice_date', 'date_fact': 'invoice_date',
            'DATE_FACT': 'invoice_date', 'date fact': 'invoice_date',

            # Client field
            'client': 'client', 'CLIENT': 'client', 'customer': 'client',

            # Currency field
            'currency': 'currency', 'devise': 'currency', 'DEVISE': 'currency',

            # Invoice object field
            'invoice_object': 'invoice_object', 'obj_fact': 'invoice_object',
            'OBJ_FACT': 'invoice_object', 'objet facture': 'invoice_object',

            # Account code field
            'account_code': 'account_code', 'cpt_comptable': 'account_code',
            'CPT_COMPTABLE': 'account_code', 'compte comptable': 'account_code',

            # GL date field
            'gl_date': 'gl_date', 'date_gl': 'gl_date',
            'DATE_GL': 'gl_date', 'date gl': 'gl_date',

            # Billing period field
            'billing_period': 'billing_period', 'periode_de_facturation': 'billing_period',
            'PERIODE_DE_FACTURATION': 'billing_period', 'periode de facturation': 'billing_period',

            # Reference field
            'reference': 'reference', 'REFERENCE': 'reference', 'ref': 'reference',

            # Terminated flag field
            'terminated_flag': 'terminated_flag', 'termine_flag': 'terminated_flag',
            'TERMINE_FLAG': 'terminated_flag',

            # Description field
            'description': 'description', 'DESCRIPTION': 'description', 'ligne produit': 'description',

            # Revenue amount field
            'revenue_amount': 'revenue_amount', 'chiffre_aff_exe_dzd': 'revenue_amount',
            'CHIFFRE_AFF_EXE_DZD': 'revenue_amount', 'chiffre aff exe': 'revenue_amount'
        }

        for idx, row in enumerate(data):
            try:
                # Debug: Log the current row
                if idx < 3 or idx % 100 == 0:  # Log first 3 rows and every 100th row
                    logger.info(
                        f"Processing JournalVentes row {idx+1}/{len(data)}")

                # Create a data dictionary with standardized field names
                model_data = {'invoice': invoice}

                # Process each field in the row
                for key, value in row.items():
                    key_lower = str(key).lower()
                    # Try exact match first
                    if key in field_mapping:
                        standard_key = field_mapping[key]
                        model_data[standard_key] = value
                    # Try lowercase match
                    elif key_lower in field_mapping:
                        standard_key = field_mapping[key_lower]
                        model_data[standard_key] = value

                # Handle special cases and data conversions

                # Parse date fields
                if 'invoice_date' in model_data and model_data['invoice_date']:
                    try:
                        model_data['invoice_date'] = self._parse_date(
                            model_data['invoice_date'])
                    except Exception as e:
                        logger.warning(
                            f"Failed to parse invoice date: {str(e)}")
                        model_data['invoice_date'] = None

                if 'gl_date' in model_data and model_data['gl_date']:
                    try:
                        model_data['gl_date'] = self._parse_date(
                            model_data['gl_date'])
                    except Exception as e:
                        logger.warning(f"Failed to parse GL date: {str(e)}")
                        model_data['gl_date'] = None

                # Ensure numeric fields are properly handled
                if 'revenue_amount' in model_data:
                    try:
                        if isinstance(model_data['revenue_amount'], str):
                            # Clean and convert string value
                            clean_value = model_data['revenue_amount'].replace(
                                ',', '.').replace(' ', '')
                            model_data['revenue_amount'] = float(
                                clean_value) if clean_value else 0
                    except (ValueError, TypeError):
                        model_data['revenue_amount'] = 0

                # Create the JournalVentes record - without dot_code field
                record = JournalVentes.objects.create(
                    invoice=invoice,
                    organization=model_data.get('organization', ''),
                    origin=model_data.get('origin', ''),
                    invoice_number=model_data.get('invoice_number', ''),
                    invoice_type=model_data.get('invoice_type', ''),
                    invoice_date=model_data.get('invoice_date'),
                    client=model_data.get('client', ''),
                    currency=model_data.get('currency', ''),
                    invoice_object=model_data.get('invoice_object', ''),
                    account_code=model_data.get('account_code', ''),
                    gl_date=model_data.get('gl_date'),
                    billing_period=model_data.get('billing_period', ''),
                    reference=model_data.get('reference', ''),
                    terminated_flag=model_data.get('terminated_flag', ''),
                    description=model_data.get('description', ''),
                    revenue_amount=model_data.get('revenue_amount', 0),
                )

                saved_count += 1

                # Log first few records for debugging
                if saved_count <= 3:
                    logger.info(
                        f"Saved Journal Ventes record #{saved_count}: {model_data}")

            except Exception as e:
                logger.error(
                    f"Error saving Journal Ventes record (row {idx+1}): {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(
            f"Completed _save_journal_ventes: Saved {saved_count}/{len(data)} records")
        return saved_count

    def _validate_ca_non_periodique(self, dot_filter=None):
        """
        Validates CANonPeriodique data against client requirements:
        - All records should have dot equal to "Siège"
        """
        logger.info("Validating CANonPeriodique data")

        result = {
            'model': 'CANonPeriodique',
            'records_checked': 0,
            'records_with_issues': 0,
            'issues': []
        }

        try:
            # Base queryset
            queryset = CANonPeriodique.objects.all()

            # Apply optional DOT filter
            if dot_filter:
                queryset = queryset.filter(dot__code=dot_filter)

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Check for invalid DOT (should be only Siège)
            invalid_dot = queryset.exclude(dot__name=CANonPeriodique.VALID_DOT)

            for record in invalid_dot:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_dot',
                    'description': f"Record has invalid DOT: {record.dot} - should be {CANonPeriodique.VALID_DOT}",
                    'invoice_id': record.invoice.id,
                    'dot': str(record.dot)
                })

        except Exception as e:
            logger.error(f"Error validating CANonPeriodique data: {str(e)}")
            result['error'] = str(e)

        return result

# New views specific to V2


"""
# Cleaning-related views - commented out for now
class InvoiceCleanView(APIView):
    \"\"\"
    View for cleaning an invoice's data.
    This is a new V2 endpoint for triggering cleaning on already-saved raw data.
    \"\"\"
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        try:
            # Get the invoice
            invoice = Invoice.objects.get(id=pk, uploaded_by=request.user)

            # Create a task ID for tracking the cleaning progress
            task_id = str(uuid.uuid4())

            # Create a progress tracker
            progress_tracker = ProgressTracker.objects.create(
                invoice=invoice,
                operation_type='clean',
                status='in_progress',
                progress_percent=0.0,
                current_item=0,
                total_items=100,
                message='Starting data cleaning'
            )

            # Initialize the cache for progress tracking
            cache.set(f"cleaning_progress_{task_id}", {
                'status': 'in_progress',
                'progress': 0,
                'message': 'Starting data cleaning',
                'start_time': datetime.now().isoformat()
            }, timeout=3600)  # 1 hour timeout

            # Start cleaning in a background thread
            def clean_data():
                try:
                    # Initialize data processor
                    data_processor = DataProcessor()

                    # Update progress
                    progress_tracker.progress_percent = 10.0
                    progress_tracker.message = 'Initializing data processor'
                    progress_tracker.save()

                    cache.set(f"cleaning_progress_{task_id}", {
                        'status': 'in_progress',
                        'progress': 10,
                        'message': 'Initializing data processor',
                        'start_time': datetime.now().isoformat()
                    }, timeout=3600)

                    # Clean data based on file type
                    file_type = invoice.file_type

                    # Update progress
                    progress_tracker.progress_percent = 20.0
                    progress_tracker.message = f'Cleaning {file_type} data'
                    progress_tracker.save()

                    cache.set(f"cleaning_progress_{task_id}", {
                        'status': 'in_progress',
                        'progress': 20,
                        'message': f'Cleaning {file_type} data',
                        'start_time': datetime.now().isoformat()
                    }, timeout=3600)

                    # Clean data based on file type
                    with transaction.atomic():
                        if file_type == 'facturation_manuelle':
                            self._clean_facturation_manuelle(
                                invoice, data_processor)
                        elif file_type == 'journal_ventes':
                            self._clean_journal_ventes(invoice, data_processor)
                        elif file_type == 'etat_facture':
                            self._clean_etat_facture(invoice, data_processor)
                        elif file_type == 'parc_corporate':
                            self._clean_parc_corporate(invoice, data_processor)
                        elif file_type == 'creances_ngbss':
                            self._clean_creances_ngbss(invoice, data_processor)
                        elif file_type == 'ca_periodique':
                            self._clean_ca_periodique(invoice, data_processor)
                        elif file_type == 'ca_non_periodique':
                            self._clean_ca_non_periodique(
                                invoice, data_processor)
                        elif file_type == 'ca_dnt':
                            self._clean_ca_dnt(invoice, data_processor)
                        elif file_type == 'ca_rfd':
                            self._clean_ca_rfd(invoice, data_processor)
                        elif file_type == 'ca_cnt':
                            self._clean_ca_cnt(invoice, data_processor)

                    # Update progress
                    progress_tracker.progress_percent = 90.0
                    progress_tracker.message = 'Data cleaning completed'
                    progress_tracker.save()

                    cache.set(f"cleaning_progress_{task_id}", {
                        'status': 'in_progress',
                        'progress': 90,
                        'message': 'Data cleaning completed',
                        'start_time': datetime.now().isoformat()
                    }, timeout=3600)

                    # Update invoice status
                    invoice.status = 'completed'  # Now it's fully processed and cleaned
                    invoice.save()

                    # Complete the progress tracker
                    progress_tracker.progress_percent = 100.0
                    progress_tracker.status = 'completed'
                    progress_tracker.message = 'Data cleaning completed successfully'
                    progress_tracker.save()

                    cache.set(f"cleaning_progress_{task_id}", {
                        'status': 'complete',
                        'progress': 100,
                        'message': 'Data cleaning completed successfully',
                        'start_time': datetime.now().isoformat(),
                        'end_time': datetime.now().isoformat()
                    }, timeout=3600)

                except Exception as e:
                    logger.error(f"Error cleaning data: {str(e)}")
                    logger.error(traceback.format_exc())

                    # Update invoice status on error
                    invoice.status = 'failed'
                    invoice.error_message = str(e)
                    invoice.save()

                    # Update progress tracker on error
                    progress_tracker.status = 'failed'
                    progress_tracker.message = f'Error: {str(e)}'
                    progress_tracker.save()

                    cache.set(f"cleaning_progress_{task_id}", {
                        'status': 'failed',
                        'progress': progress_tracker.progress_percent,
                        'message': f'Error: {str(e)}',
                        'start_time': datetime.now().isoformat(),
                        'end_time': datetime.now().isoformat()
                    }, timeout=3600)

            # Start the cleaning thread
            thread = threading.Thread(target=clean_data)
            thread.start()

            return Response({
                'status': 'success',
                'message': 'Data cleaning started',
                'invoice_id': invoice.id,
                'task_id': task_id,
                'progress_tracker_id': progress_tracker.id
            })

        except Invoice.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Invoice not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error starting data cleaning: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'status': 'error',
                'message': f"An error occurred: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BulkCleanView(APIView):
    \"\"\"
    View for bulk cleaning operations.
    This allows cleaning multiple invoices or specific data types.
    \"\"\"
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            # Get parameters
            invoice_ids = request.data.get('invoice_ids', [])
            data_types = request.data.get('data_types', [])

            # Validate parameters
            if not invoice_ids and not data_types:
                return Response({
                    'status': 'error',
                    'message': 'You must provide either invoice_ids or data_types'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create a task ID for tracking progress
            task_id = str(uuid.uuid4())

            # Initialize the cache for progress tracking
            cache.set(f"bulk_cleaning_progress_{task_id}", {
                'status': 'in_progress',
                'progress': 0,
                'message': 'Starting bulk data cleaning',
                'start_time': datetime.now().isoformat()
            }, timeout=7200)  # 2 hour timeout for bulk operations

            # Start cleaning in a background thread
            def bulk_clean():
                try:
                    # Initialize data processor
                    data_processor = DataProcessor()

                    # Update progress
                    cache.set(f"bulk_cleaning_progress_{task_id}", {
                        'status': 'in_progress',
                        'progress': 5,
                        'message': 'Initializing data processor',
                        'start_time': datetime.now().isoformat()
                    }, timeout=7200)

                    # Get invoices to process
                    invoices = []
                    if invoice_ids:
                        invoices = Invoice.objects.filter(
                            id__in=invoice_ids,
                            uploaded_by=request.user
                        )
                    else:
                        # Get all invoices with the specified data types
                        invoices = Invoice.objects.filter(
                            file_type__in=data_types,
                            uploaded_by=request.user,
                            # Only process invoices that need cleaning
                            status__in=['preview', 'failed']
                        )

                    total_invoices = len(invoices)
                    if total_invoices == 0:
                        cache.set(f"bulk_cleaning_progress_{task_id}", {
                            'status': 'complete',
                            'progress': 100,
                            'message': 'No invoices found to clean',
                            'start_time': datetime.now().isoformat(),
                            'end_time': datetime.now().isoformat()
                        }, timeout=7200)
                        return

                    # Process each invoice
                    for i, invoice in enumerate(invoices):
                        try:
                            # Update progress
                            progress = 5 + (90 * i / total_invoices)
                            cache.set(f"bulk_cleaning_progress_{task_id}", {
                                'status': 'in_progress',
                                'progress': progress,
                                'message': f'Cleaning invoice {i+1}/{total_invoices}: {invoice.invoice_number}',
                                'start_time': datetime.now().isoformat()
                            }, timeout=7200)

                            # Process based on file type
                            file_type = invoice.file_type

                            # Clean data based on file type
                            with transaction.atomic():
                                if file_type == 'facturation_manuelle':
                                    self._clean_facturation_manuelle(
                                        invoice, data_processor)
                                elif file_type == 'journal_ventes':
                                    self._clean_journal_ventes(invoice, data_processor)
                                elif file_type == 'etat_facture':
                                    self._clean_etat_facture(invoice, data_processor)
                                elif file_type == 'parc_corporate':
                                    self._clean_parc_corporate(invoice, data_processor)
                                elif file_type == 'creances_ngbss':
                                    self._clean_creances_ngbss(invoice, data_processor)
                                elif file_type == 'ca_periodique':
                                    self._clean_ca_periodique(invoice, data_processor)
                                elif file_type == 'ca_non_periodique':
                                    self._clean_ca_non_periodique(
                                        invoice, data_processor)
                                elif file_type == 'ca_dnt':
                                    self._clean_ca_dnt(invoice, data_processor)
                                elif file_type == 'ca_rfd':
                                    self._clean_ca_rfd(invoice, data_processor)
                                elif file_type == 'ca_cnt':
                                    self._clean_ca_cnt(invoice, data_processor)

                            # Update invoice status
                            invoice.status = 'completed'
                            invoice.save()

                        except Exception as e:
                            logger.error(
                                f"Error cleaning invoice {invoice.id}: {str(e)}")
                            invoice.status = 'failed'
                            invoice.error_message = str(e)
                            invoice.save()

                    # Complete the progress
                    cache.set(f"bulk_cleaning_progress_{task_id}", {
                        'status': 'complete',
                        'progress': 100,
                        'message': f'Completed cleaning {total_invoices} invoices',
                        'start_time': datetime.now().isoformat(),
                        'end_time': datetime.now().isoformat()
                    }, timeout=7200)

                except Exception as e:
                    logger.error(f"Error in bulk cleaning: {str(e)}")
                    logger.error(traceback.format_exc())

                    cache.set(f"bulk_cleaning_progress_{task_id}", {
                        'status': 'failed',
                        'progress': 0,
                        'message': f'Error: {str(e)}',
                        'start_time': datetime.now().isoformat(),
                        'end_time': datetime.now().isoformat()
                    }, timeout=7200)

            # Start the cleaning thread
            thread = threading.Thread(target=bulk_clean)
            thread.start()

            return Response({
                'status': 'success',
                'message': 'Bulk data cleaning started',
                'task_id': task_id
            })

        except Exception as e:
            logger.error(f"Error starting bulk cleaning: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'status': 'error',
                'message': f"An error occurred: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CleaningTasksView(APIView):
    \"\"\"
    View for retrieving all cleaning tasks.
    \"\"\"
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get all progress trackers for cleaning operations
            trackers = ProgressTracker.objects.filter(
                operation_type='clean',
                invoice__uploaded_by=request.user
            ).order_by('-start_time')

            # Format the response
            tasks = []
            for tracker in trackers:
                tasks.append({
                    'id': tracker.id,
                    'invoice_id': tracker.invoice.id,
                    'invoice_number': tracker.invoice.invoice_number,
                    'status': tracker.status,
                    'progress': tracker.progress_percent,
                    'message': tracker.message,
                    'start_time': tracker.start_time,
                    'last_update': tracker.last_update_time
                })

            return Response({
                'status': 'success',
                'tasks': tasks
            })

        except Exception as e:
            logger.error(f"Error retrieving cleaning tasks: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"An error occurred: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InvoiceCleaningStatusView(APIView):
    \"\"\"
    View for retrieving the cleaning status of an invoice.
    \"\"\"
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            # Get the invoice
            invoice = Invoice.objects.get(id=pk, uploaded_by=request.user)

            # Get the latest cleaning progress tracker
            tracker = ProgressTracker.objects.filter(
                invoice=invoice,
                operation_type='clean'
            ).order_by('-start_time').first()

            if not tracker:
                return Response({
                    'status': 'success',
                    'invoice_id': invoice.id,
                    'invoice_number': invoice.invoice_number,
                    'cleaning_status': 'not_started',
                    'message': 'No cleaning has been started for this invoice'
                })

            return Response({
                'status': 'success',
                'invoice_id': invoice.id,
                'invoice_number': invoice.invoice_number,
                'cleaning_status': tracker.status,
                'progress': tracker.progress_percent,
                'message': tracker.message,
                'start_time': tracker.start_time,
                'last_update': tracker.last_update_time
            })

        except Invoice.DoesNotExist:
            return Response({
                'status': 'error',
                'message': 'Invoice not found'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error retrieving cleaning status: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"An error occurred: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
"""

# Add the remaining views as needed, following the same pattern
# JournalVentesListView, EtatFactureListView, etc. should be updated to be aware of cleaning status

# Add the BulkProcessView for multi-threaded parallel processing


class BulkProcessView(APIView):
    """
    View for bulk processing multiple invoices in parallel.
    This uses multi-threading with the OptimizedFileProcessor for maximum performance.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            # Get parameters
            invoice_ids = request.data.get('invoice_ids', [])
            max_workers = request.data.get(
                'max_workers', 8)  # Limit concurrent threads
            # Default to optimized processor
            use_optimized = request.data.get('use_optimized', True)

            # Validate parameters
            if not invoice_ids:
                return Response({
                    'status': 'error',
                    'message': 'You must provide invoice_ids'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate max_workers
            try:
                max_workers = int(max_workers)
                if max_workers < 1:
                    max_workers = 1
                elif max_workers > 10:  # Set an upper limit to prevent system overload
                    max_workers = 10
            except ValueError:
                max_workers = 4  # Default if not a valid integer

            # Create a task ID for tracking progress
            task_id = str(uuid.uuid4())

            # Get invoices to process
            invoices = Invoice.objects.filter(
                id__in=invoice_ids,
                uploaded_by=request.user
            )

            # Check if all invoices were found
            if len(invoices) != len(invoice_ids):
                missing_ids = set(invoice_ids) - \
                    set(invoices.values_list('id', flat=True))
                return Response({
                    'status': 'error',
                    'message': f'Some invoices were not found: {missing_ids}'
                }, status=status.HTTP_404_NOT_FOUND)

            # Decide which processor to use
            if use_optimized:
                # Use the new optimized processor
                logger.info(
                    f"Using optimized processor for bulk processing {len(invoices)} invoices")

                # Get the save method to use from InvoiceProcessView
                save_raw_data_method = InvoiceProcessView()._save_raw_data

                # Start processing with the optimized processor
                OptimizedBulkProcessor.process_invoices(
                    invoices=invoices,
                    task_id=task_id,
                    save_raw_data_method=save_raw_data_method,
                    max_workers=max_workers
                )
            else:
                # Use the original processor for backward compatibility
                logger.info(
                    f"Using standard processor for bulk processing {len(invoices)} invoices")

                # Initialize cache with standard format
                cache.set(f"bulk_processing_progress_{task_id}", {
                    'status': 'in_progress',
                    'progress': 0,
                    'message': 'Starting bulk file processing',
                    'start_time': datetime.now().isoformat(),
                    'total_invoices': len(invoices),
                    'completed_invoices': 0,
                    'failed_invoices': 0,
                    'invoice_statuses': {}
                }, timeout=7200)

                # Start original bulk_process in a background thread
                thread = threading.Thread(target=self.bulk_process, args=(
                    invoices, max_workers, task_id
                ))
                thread.start()

            return Response({
                'status': 'success',
                'message': f'Bulk processing started for {len(invoices)} invoices with {max_workers} workers',
                'task_id': task_id,
                'invoice_count': len(invoices),
                'processing_mode': 'optimized' if use_optimized else 'standard'
            })

        except Exception as e:
            logger.error(f"Error starting bulk processing: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'status': 'error',
                'message': f"An error occurred: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def bulk_process(self, invoices, max_workers, task_id):
        """Legacy bulk process method that uses the standard FileProcessor"""
        try:
            total_invoices = len(invoices)
            completed_count = 0
            failed_count = 0
            invoice_results = {}

            # Process a single invoice
            def process_single_invoice(invoice):
                nonlocal completed_count, failed_count

                try:
                    # Create a progress tracker for this invoice
                    progress_tracker = ProgressTracker.objects.create(
                        invoice=invoice,
                        operation_type='process',
                        status='in_progress',
                        progress_percent=0.0,
                        current_item=0,
                        total_items=100,
                        message='Starting file processing'
                    )

                    # Update invoice status
                    invoice.status = 'processing'
                    invoice.save()

                    # Update bulk processing progress
                    current_progress = cache.get(
                        f"bulk_processing_progress_{task_id}")
                    if current_progress:
                        current_progress['invoice_statuses'][invoice.id] = {
                            'status': 'processing',
                            'progress': 0,
                            'message': 'Starting file processing'
                        }
                        cache.set(
                            f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                    # Process the file to detect the type and extract data
                    file_path = invoice.file.path
                    file_processor = FileProcessor()
                    file_type_detector = FileTypeDetector()

                    # Update progress
                    progress_tracker.progress_percent = 10.0
                    progress_tracker.message = 'Detecting file type'
                    progress_tracker.save()

                    # Update bulk processing progress
                    current_progress = cache.get(
                        f"bulk_processing_progress_{task_id}")
                    if current_progress:
                        current_progress['invoice_statuses'][invoice.id] = {
                            'status': 'processing',
                            'progress': 10,
                            'message': 'Detecting file type'
                        }
                        cache.set(
                            f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                    # Detect file type
                    file_type, confidence, _ = file_type_detector.detect_file_type(
                        file_path, invoice.file.name)

                    # Update invoice with file type
                    invoice.file_type = file_type
                    invoice.detection_confidence = confidence
                    invoice.save()

                    # Update progress
                    progress_tracker.progress_percent = 20.0
                    progress_tracker.message = f'File type detected: {file_type}'
                    progress_tracker.save()

                    # Update bulk processing progress
                    current_progress = cache.get(
                        f"bulk_processing_progress_{task_id}")
                    if current_progress:
                        current_progress['invoice_statuses'][invoice.id] = {
                            'status': 'processing',
                            'progress': 20,
                            'message': f'File type detected: {file_type}'
                        }
                        cache.set(
                            f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                    # Process the file to extract raw data
                    raw_data, summary = file_processor.process_file(
                        file_path, invoice.file.name)

                    # Update progress
                    progress_tracker.progress_percent = 50.0
                    progress_tracker.message = 'Extracted raw data from file'
                    progress_tracker.save()

                    # Update bulk processing progress
                    current_progress = cache.get(
                        f"bulk_processing_progress_{task_id}")
                    if current_progress:
                        current_progress['invoice_statuses'][invoice.id] = {
                            'status': 'processing',
                            'progress': 50,
                            'message': 'Extracted raw data from file'
                        }
                        cache.set(
                            f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                    # Get the save method to use
                    save_raw_data = InvoiceProcessView()._save_raw_data

                    # Save the raw data to the database based on file type
                    # Each file type is now handled in its own transaction within _save_raw_data
                    self._save_raw_data(invoice, file_type, raw_data)

                    # Update progress
                    progress_tracker.progress_percent = 90.0
                    progress_tracker.message = 'Raw data saved to database'
                    progress_tracker.save()

                    # Update invoice status
                    invoice.status = 'preview'  # Set to preview since it's not cleaned yet
                    invoice.processed_date = timezone.now()
                    invoice.save()

                    # Complete the progress tracker
                    progress_tracker.progress_percent = 100.0
                    progress_tracker.status = 'completed'
                    progress_tracker.message = 'File processing completed successfully'
                    progress_tracker.save()

                    # Update completion counts and results
                    completed_count += 1
                    invoice_results[invoice.id] = {
                        'status': 'completed',
                        'message': 'File processing completed successfully',
                        'file_type': file_type,
                        'confidence': confidence
                    }

                    # Update bulk processing progress
                    current_progress = cache.get(
                        f"bulk_processing_progress_{task_id}")
                    if current_progress:
                        current_progress['completed_invoices'] = completed_count
                        current_progress['progress'] = (
                            completed_count + failed_count) * 100 / total_invoices
                        current_progress['invoice_statuses'][invoice.id] = {
                            'status': 'completed',
                            'progress': 100,
                            'message': 'File processing completed successfully'
                        }
                        cache.set(
                            f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                    return invoice.id, True, None

                except Exception as e:
                    logger.error(
                        f"Error processing invoice {invoice.id}: {str(e)}")
                    logger.error(traceback.format_exc())

                    # Update invoice status on error
                    invoice.status = 'failed'
                    invoice.error_message = str(e)
                    invoice.save()

                    # Update progress tracker on error if it exists
                    try:
                        if 'progress_tracker' in locals():
                            progress_tracker.status = 'failed'
                            progress_tracker.message = f'Error: {str(e)}'
                            progress_tracker.save()
                    except Exception:
                        pass

                    # Update completion counts and results
                    failed_count += 1
                    invoice_results[invoice.id] = {
                        'status': 'failed',
                        'message': str(e)
                    }

                    # Update bulk processing progress
                    current_progress = cache.get(
                        f"bulk_processing_progress_{task_id}")
                    if current_progress:
                        current_progress['failed_invoices'] = failed_count
                        current_progress['progress'] = (
                            completed_count + failed_count) * 100 / total_invoices
                        current_progress['invoice_statuses'][invoice.id] = {
                            'status': 'failed',
                            'progress': 0,
                            'message': f'Error: {str(e)}'
                        }
                        cache.set(
                            f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                    return invoice.id, False, str(e)

            # Initialize the bulk process progress
            cache.set(f"bulk_processing_progress_{task_id}", {
                'status': 'in_progress',
                'progress': 0,
                'message': f'Processing {total_invoices} invoices with {max_workers} workers',
                'start_time': datetime.now().isoformat(),
                'total_invoices': total_invoices,
                'completed_invoices': 0,
                'failed_invoices': 0,
                'invoice_statuses': {invoice.id: {'status': 'pending', 'progress': 0, 'message': 'Waiting to start'} for invoice in invoices}
            }, timeout=7200)

            # Process all invoices using the thread pool
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit all invoices to the executor
                futures = {executor.submit(
                    process_single_invoice, invoice): invoice.id for invoice in invoices}

                # Wait for all tasks to complete
                for future in futures:
                    future.result()  # This ensures all exceptions are propagated

            # Complete the bulk processing
            end_time = datetime.now().isoformat()
            cache.set(f"bulk_processing_progress_{task_id}", {
                'status': 'completed',
                'progress': 100,
                'message': f'Completed processing {total_invoices} invoices. Success: {completed_count}, Failed: {failed_count}',
                'start_time': datetime.now().isoformat(),
                'end_time': end_time,
                'total_invoices': total_invoices,
                'completed_invoices': completed_count,
                'failed_invoices': failed_count,
                'invoice_statuses': invoice_results,
                'optimized_processor': False
            }, timeout=7200)

        except Exception as e:
            logger.error(f"Error in bulk processing: {str(e)}")
            logger.error(traceback.format_exc())

            # Update bulk processing status on error
            cache.set(f"bulk_processing_progress_{task_id}", {
                'status': 'failed',
                'progress': (completed_count + failed_count) * 100 / total_invoices if total_invoices > 0 else 0,
                'message': f'Error in bulk processing: {str(e)}',
                'start_time': datetime.now().isoformat(),
                'end_time': datetime.now().isoformat(),
                'total_invoices': total_invoices,
                'completed_invoices': completed_count,
                'failed_invoices': failed_count,
                'invoice_statuses': invoice_results,
                'optimized_processor': False
            }, timeout=7200)

    def get(self, request):
        """
        Get the status of a bulk processing task
        """
        try:
            task_id = request.query_params.get('task_id')
            if not task_id:
                return Response({
                    'status': 'error',
                    'message': 'task_id parameter is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get the progress from cache
            progress = cache.get(f"bulk_processing_progress_{task_id}")
            if not progress:
                return Response({
                    'status': 'error',
                    'message': 'Task not found or expired'
                }, status=status.HTTP_404_NOT_FOUND)

            return Response({
                'status': 'success',
                'progress': progress
            })

        except Exception as e:
            logger.error(f"Error getting bulk processing status: {str(e)}")
            return Response({
                'status': 'error',
                'message': f"An error occurred: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
