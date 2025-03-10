import logging
import pandas as pd
import numpy as np

from django.db.models import Sum, Count, Avg, F, Q, Case, When, Value, DecimalField, IntegerField, ExpressionWrapper, FloatField
from django.db.models.functions import Cast

from django.db.models.functions import Coalesce, ExtractYear, ExtractMonth
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import (
    Invoice, ProcessedInvoiceData, FacturationManuelle, JournalVentes,
    EtatFacture, ParcCorporate, CreancesNGBSS, CAPeriodique, CANonPeriodique,
    CADNT, CARFD, CACNT, RevenueObjective, CollectionObjective, NGBSSCollection, UnfinishedInvoice
)
from .data_processor import DataProcessor
from datetime import datetime
import traceback

from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


class RevenueKPIView(APIView):
    """
    API view for retrieving revenue KPIs
    - Total revenue
    - Revenue growth compared to previous year
    - Revenue achievement rate compared to objectives
    """
    permission_classes = [IsAuthenticated]

    # Only apply cache in production
    def get_decorator(self):
        if not settings.DEBUG:
            return method_decorator(cache_page(timeout=60 * 15))
        return lambda x: x

    @property
    def decorated_get(self):
        return self.get_decorator()(self.get_implementation)

    def get(self, request, *args, **kwargs):
        return self.decorated_get(request, *args, **kwargs)

    def get_implementation(self, request):
        try:
            # Get query parameters
            year = request.query_params.get('year', None)
            month = request.query_params.get('month', None)
            dot = request.query_params.get('dot', None)

            # Validate year parameter
            if year:
                try:
                    year = int(year)
                    # Check if year is reasonable (e.g., between 2000 and current year + 5)
                    current_year = datetime.now().year
                    if year < 2000 or year > current_year + 5:
                        return Response(
                            {"error": f"Year {year} is out of valid range"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except ValueError:
                    return Response(
                        {"error": "Year must be a valid integer"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Base query for Journal Ventes (main revenue source)
            query = JournalVentes.objects.select_related('invoice').all()

            # Apply filters
            if year:
                # Extract year from invoice_date
                query = query.filter(invoice_date__year=year)
            if month and month.isdigit():
                # Extract month from invoice_date
                query = query.filter(invoice_date__month=int(month))
            if dot:
                # Filter by DOT (department)
                query = query.filter(organization__icontains=dot)

            # Calculate total revenue
            total_revenue = query.aggregate(
                total=Coalesce(Sum('revenue_amount'), 0,
                               output_field=DecimalField())
            )['total'] or 0

            # Get revenue by month
            revenue_by_month = []

            # Only proceed if we have data
            if query.exists():
                if year:
                    # Get revenue for each month in the selected year
                    for m in range(1, 13):
                        monthly_revenue = query.filter(
                            invoice_date__month=m
                        ).aggregate(
                            total=Coalesce(Sum('revenue_amount'), 0,
                                           output_field=DecimalField())
                        )['total'] or 0

                        revenue_by_month.append({
                            'month': m,
                            'month_name': datetime(2000, m, 1).strftime('%B'),
                            'revenue': monthly_revenue
                        })
                else:
                    # If no year is specified, group by year and month
                    monthly_data = query.annotate(
                        year=ExtractYear('invoice_date'),
                        month=ExtractMonth('invoice_date')
                    ).values('year', 'month').annotate(
                        total=Coalesce(Sum('revenue_amount'), 0,
                                       output_field=DecimalField())
                    ).order_by('year', 'month')

                    for item in monthly_data:
                        if item['year'] and item['month']:
                            month_name = datetime(
                                2000, item['month'], 1).strftime('%B')
                            revenue_by_month.append({
                                'year': item['year'],
                                'month': item['month'],
                                'month_name': month_name,
                                'revenue': item['total']
                            })

            # Get revenue by organization (DOT)
            revenue_by_dot = query.values('organization').annotate(
                total=Coalesce(Sum('revenue_amount'), 0,
                               output_field=DecimalField())
            ).order_by('-total')[:10]  # Top 10 DOTs by revenue

            # Calculate previous year's revenue for comparison
            previous_year_revenue = 0
            if year:
                previous_year_query = JournalVentes.objects.filter(
                    invoice_date__year=int(year) - 1
                )
                if month and month.isdigit():
                    previous_year_query = previous_year_query.filter(
                        invoice_date__month=int(month)
                    )
                if dot:
                    previous_year_query = previous_year_query.filter(
                        organization__icontains=dot
                    )

                previous_year_revenue = previous_year_query.aggregate(
                    total=Coalesce(Sum('revenue_amount'), 0,
                                   output_field=DecimalField())
                )['total'] or 0

            # Calculate growth percentage
            growth_percentage = 0
            if previous_year_revenue > 0:
                growth_percentage = ((total_revenue - previous_year_revenue) /
                                     previous_year_revenue) * 100

            # Return the data
            return Response({
                'total_revenue': total_revenue,
                'previous_year_revenue': previous_year_revenue,
                'growth_percentage': growth_percentage,
                'revenue_by_month': revenue_by_month,
                'revenue_by_dot': list(revenue_by_dot),
                'filters': {
                    'year': year,
                    'month': month,
                    'dot': dot
                }
            })
        except Exception as e:
            logger.error(f"Error in RevenueKPIView: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {"error": "An error occurred while processing your request",
                    "details": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def calculate_performance_metrics(self, current_data, previous_data=None, objectives=None):
        """
        Calculate performance metrics including:
        - Year-over-year growth rate
        - Achievement rate against objectives

        Args:
            current_data: Current period data
            previous_data: Previous period data (optional)
            objectives: Target objectives (optional)

        Returns:
            Dictionary of performance metrics
        """
        metrics = {}

        # Calculate total values
        current_total = sum(item.get('value', 0)
                            for item in current_data) if current_data else 0
        metrics['current_total'] = current_total

        # Calculate year-over-year growth if previous data is available
        if previous_data:
            previous_total = sum(item.get('value', 0)
                                 for item in previous_data) if previous_data else 0
            metrics['previous_total'] = previous_total

            if previous_total > 0:
                growth_rate = (
                    (current_total - previous_total) / previous_total) * 100
                metrics['growth_rate'] = round(growth_rate, 2)
                metrics['growth_amount'] = current_total - previous_total
            else:
                metrics['growth_rate'] = None
                metrics['growth_amount'] = None

        # Calculate achievement rate if objectives are available
        if objectives:
            objective_total = sum(item.get('value', 0)
                                  for item in objectives) if objectives else 0
            metrics['objective_total'] = objective_total

            if objective_total > 0:
                achievement_rate = (current_total / objective_total) * 100
                metrics['achievement_rate'] = round(achievement_rate, 2)
                metrics['achievement_gap'] = current_total - objective_total
            else:
                metrics['achievement_rate'] = None
                metrics['achievement_gap'] = None

        return metrics

    def calculate_revenue_performance(self, year, month=None, dot=None):
        """
        Calculate revenue performance metrics including:
        - Current revenue
        - Previous year revenue
        - Year-over-year growth
        - Achievement rate against objectives

        Args:
            year: Year to calculate for
            month: Month to calculate for (optional)
            dot: DOT to filter by (optional)

        Returns:
            Dictionary of revenue performance metrics
        """
        # Get current revenue data
        current_data = self._get_revenue_data(year, month, dot)

        # Get previous year revenue data
        previous_data = self._get_revenue_data(year-1, month, dot)

        # Get revenue objectives
        objectives = self._get_revenue_objectives(year, month, dot)

        # Calculate performance metrics
        metrics = self.calculate_performance_metrics(
            current_data, previous_data, objectives)

        # Add additional revenue-specific metrics
        metrics['year'] = year
        metrics['month'] = month
        metrics['dot'] = dot
        metrics['data_type'] = 'revenue'

        return metrics


class CollectionKPIView(APIView):
    """
    API view for retrieving collection KPIs
    - Total collections
    - Collection rate compared to invoiced amount
    - Collection achievement rate compared to objectives
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get query parameters
            year = request.query_params.get('year', None)
            month = request.query_params.get('month', None)
            dot = request.query_params.get('dot', None)

            # Base query for Etat Facture (collection data)
            query = EtatFacture.objects.all()

            # Apply filters if provided
            if year:
                query = query.filter(invoice_date__year=year)
            if month:
                query = query.filter(invoice_date__month=month)
            if dot:
                # Clean organization name as per requirements
                query = query.filter(organization__icontains=dot)

            # For headquarters (Siège), only include DCC and DCGC
            if dot and dot.lower() == 'siège':
                query = query.filter(
                    Q(organization__icontains='DCC') |
                    Q(organization__icontains='DCGC')
                )

            # Calculate total collections and invoiced amount
            aggregates = query.aggregate(
                total_collection=Coalesce(
                    Sum('collection_amount'), 0, output_field=DecimalField()),
                total_invoiced=Coalesce(
                    Sum('total_amount'), 0, output_field=DecimalField())
            )

            total_collection = aggregates['total_collection']
            total_invoiced = aggregates['total_invoiced']

            # Calculate collection rate
            collection_rate = 0
            if total_invoiced > 0:
                collection_rate = (total_collection / total_invoiced) * 100

            # TODO: Add objective comparison when objectives are available
            # For now, using a placeholder
            objective_achievement_rate = 0

            return Response({
                'total_collection': total_collection,
                'total_invoiced': total_invoiced,
                'collection_rate': collection_rate,
                'objective_achievement_rate': objective_achievement_rate
            })

        except Exception as e:
            logger.error(f"Error retrieving collection KPIs: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def calculate_collection_performance(self, year, month=None, dot=None):
        """
        Calculate collection performance metrics including:
        - Current collections
        - Previous year collections
        - Year-over-year growth
        - Achievement rate against objectives
        - Collection rate against invoiced amount

        Args:
            year: Year to calculate for
            month: Month to calculate for (optional)
            dot: DOT to filter by (optional)

        Returns:
            Dictionary of collection performance metrics
        """
        # Get current collection data
        current_data = self._get_collection_data(year, month, dot)

        # Get previous year collection data
        previous_data = self._get_collection_data(year-1, month, dot)

        # Get collection objectives
        objectives = self._get_collection_objectives(year, month, dot)

        # Calculate performance metrics
        metrics = self.calculate_performance_metrics(
            current_data, previous_data, objectives)

        # Get invoiced amount for collection rate calculation
        invoiced_data = self._get_invoiced_amount_data(year, month, dot)
        invoiced_total = sum(item.get('value', 0)
                             for item in invoiced_data) if invoiced_data else 0

        # Calculate collection rate against invoiced amount
        if invoiced_total > 0:
            collection_rate = (metrics.get(
                'current_total', 0) / invoiced_total) * 100
            metrics['collection_rate'] = round(collection_rate, 2)
            metrics['uncollected_amount'] = invoiced_total - \
                metrics.get('current_total', 0)
        else:
            metrics['collection_rate'] = None
            metrics['uncollected_amount'] = None

        # Add additional collection-specific metrics
        metrics['year'] = year
        metrics['month'] = month
        metrics['dot'] = dot
        metrics['data_type'] = 'collection'
        metrics['invoiced_total'] = invoiced_total

        return metrics


class ReceivablesKPIView(APIView):
    """
    API view for retrieving receivables KPIs
    - Total receivables
    - Receivables by age/year
    - Receivables by DOT
    - Receivables by client category
    - Receivables by product
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Apply filters based on requirements
            # 1. Keep only Specialized Line and LTE products
            # 2. Keep only Corporate and Corporate Group in CUST_LEV1
            # 3. Remove Client professionnelConventionnÃ© from CUST_LEV2
            # 4. Keep only specific CUST_LEV3 values

            query = CreancesNGBSS.objects.filter(
                Q(product__in=['Specialized Line', 'LTE']),
                Q(customer_lev1__in=['Corporate', 'Corporate Group']),
                ~Q(customer_lev2='Client professionnelConventionnÃ©'),
                Q(customer_lev3__in=[
                    "Ligne d'exploitation AP",
                    "Ligne d'exploitation ATMobilis",
                    "Ligne d'exploitation ATS"
                ])
            )

            # Get query parameters for additional filtering
            year = request.query_params.get('year', None)
            dot = request.query_params.get('dot', None)
            product = request.query_params.get('product', None)
            customer_lev1 = request.query_params.get('customer_lev1', None)

            if year:
                query = query.filter(year=year)
            if dot:
                query = query.filter(dot=dot)
            if product:
                query = query.filter(product=product)
            if customer_lev1:
                query = query.filter(customer_lev1=customer_lev1)

            # Calculate total receivables
            total_receivables = query.aggregate(
                total_brut=Coalesce(Sum('creance_brut'), 0,
                                    output_field=DecimalField()),
                total_net=Coalesce(Sum('creance_net'), 0,
                                   output_field=DecimalField()),
                total_ht=Coalesce(Sum('creance_ht'), 0,
                                  output_field=DecimalField())
            )

            # Group by year for age analysis
            receivables_by_year = list(query.values('year').annotate(
                total=Coalesce(Sum('creance_net'), 0,
                               output_field=DecimalField())
            ).order_by('-total'))

            # Group by DOT
            receivables_by_dot = list(query.values('dot').annotate(
                total=Coalesce(Sum('creance_net'), 0,
                               output_field=DecimalField())
            ).order_by('-total'))

            # Group by client category (CUST_LEV1)
            receivables_by_category = list(query.values('customer_lev1').annotate(
                total=Coalesce(Sum('creance_net'), 0,
                               output_field=DecimalField())
            ).order_by('-total'))

            # Group by product
            receivables_by_product = list(query.values('product').annotate(
                total=Coalesce(Sum('creance_net'), 0,
                               output_field=DecimalField())
            ).order_by('-total'))

            # Identify anomalies (empty cells)
            anomalies = {
                'empty_dot': query.filter(Q(dot__isnull=True) | Q(dot='')).count(),
                'empty_actel': query.filter(Q(actel__isnull=True) | Q(actel='')).count(),
                'empty_month': query.filter(Q(month__isnull=True) | Q(month='')).count(),
                'empty_year': query.filter(Q(year__isnull=True) | Q(year='')).count(),
                'empty_product': query.filter(Q(product__isnull=True) | Q(product='')).count(),
                'empty_customer_lev1': query.filter(Q(customer_lev1__isnull=True) | Q(customer_lev1='')).count(),
                'empty_customer_lev2': query.filter(Q(customer_lev2__isnull=True) | Q(customer_lev2='')).count(),
                'empty_customer_lev3': query.filter(Q(customer_lev3__isnull=True) | Q(customer_lev3='')).count(),
            }

            # Calculate year-over-year comparison if year is specified
            yoy_comparison = None
            if year:
                previous_year = str(int(year) - 1)
                current_year_total = query.filter(year=year).aggregate(
                    total=Coalesce(Sum('creance_net'), 0, output_field=DecimalField()))['total']
                previous_year_total = CreancesNGBSS.objects.filter(
                    year=previous_year,
                    product__in=['Specialized Line', 'LTE'],
                    customer_lev1__in=['Corporate', 'Corporate Group'],
                    customer_lev3__in=[
                        "Ligne d'exploitation AP",
                        "Ligne d'exploitation ATMobilis",
                        "Ligne d'exploitation ATS"
                    ]
                ).exclude(
                    customer_lev2='Client professionnelConventionnÃ©'
                ).aggregate(
                    total=Coalesce(Sum('creance_net'), 0,
                                   output_field=DecimalField())
                )['total']

                yoy_comparison = {
                    'current_year': year,
                    'current_year_total': current_year_total,
                    'previous_year': previous_year,
                    'previous_year_total': previous_year_total,
                    'difference': current_year_total - previous_year_total,
                    'percentage_change': (
                        ((current_year_total - previous_year_total) /
                         previous_year_total * 100)
                        if previous_year_total > 0 else 0
                    )
                }

            return Response({
                'total_receivables': total_receivables,
                'receivables_by_year': receivables_by_year,
                'receivables_by_dot': receivables_by_dot,
                'receivables_by_category': receivables_by_category,
                'receivables_by_product': receivables_by_product,
                'anomalies': anomalies,
                'yoy_comparison': yoy_comparison
            })

        except Exception as e:
            logger.error(f"Error retrieving receivables KPIs: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CorporateNGBSSParkKPIView(APIView):
    """
    API view for retrieving Corporate NGBSS Park KPIs
    - Total subscribers by State (DOT)
    - Subscribers by Offer Name
    - Subscribers by Customer Code (L2)
    - Subscribers by Telecom Type
    - Subscribers by Subscriber Status
    - New creations tracking by Telecom Type
    - Month-over-month evolution
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get Corporate NGBSS Park KPIs

        Query parameters:
        - year: Filter by year (optional)
        - month: Filter by month (optional)
        - state: Filter by state/DOT (optional)
        - offer_name: Filter by offer name (optional)
        - telecom_type: Filter by telecom type (optional)
        - customer_l2_code: Filter by customer L2 code (optional)
        - subscriber_status: Filter by subscriber status (optional)
        """
        try:
            # Get query parameters
            year = request.query_params.get('year')
            month = request.query_params.get('month')
            state = request.query_params.get('state')
            offer_name = request.query_params.get('offer_name')
            telecom_type = request.query_params.get('telecom_type')
            customer_l2_code = request.query_params.get('customer_l2_code')
            subscriber_status = request.query_params.get('subscriber_status')

            # Base query with required filters
            query = ParcCorporate.objects.filter(
                ~Q(customer_l3_code__in=['5', '57']),
                ~Q(offer_name__icontains='Moohtarif'),
                ~Q(offer_name__icontains='Solutions Hebergements'),
                ~Q(subscriber_status='Predeactivated')
            )

            # Apply optional filters
            if state:
                query = query.filter(state=state)
            if offer_name:
                query = query.filter(offer_name=offer_name)
            if telecom_type:
                query = query.filter(telecom_type=telecom_type)
            if customer_l2_code:
                query = query.filter(customer_l2_code=customer_l2_code)
            if subscriber_status:
                query = query.filter(subscriber_status=subscriber_status)

            # Calculate total subscribers
            total_subscribers = query.count()

            # Group by State (DOT)
            subscribers_by_state = list(query.values('state').annotate(
                count=Count('id'),
                percentage=ExpressionWrapper(
                    Cast(F('count') * 100.0 / total_subscribers, FloatField()),
                    output_field=FloatField()
                )
            ).order_by('-count'))

            # Group by Offer Name
            subscribers_by_offer = list(query.values('offer_name').annotate(
                count=Count('id'),
                percentage=ExpressionWrapper(
                    Cast(F('count') * 100.0 / total_subscribers, FloatField()),
                    output_field=FloatField()
                )
            ).order_by('-count'))

            # Group by Customer Code (L2)
            subscribers_by_customer = list(query.values(
                'customer_l2_code',
                'customer_l2_desc'
            ).annotate(
                count=Count('id'),
                percentage=ExpressionWrapper(
                    Cast(F('count') * 100.0 / total_subscribers, FloatField()),
                    output_field=FloatField()
                )
            ).order_by('-count'))

            # Group by Telecom Type
            subscribers_by_telecom = list(query.values('telecom_type').annotate(
                count=Count('id'),
                percentage=ExpressionWrapper(
                    Cast(F('count') * 100.0 / total_subscribers, FloatField()),
                    output_field=FloatField()
                )
            ).order_by('-count'))

            # Group by Subscriber Status
            subscribers_by_status = list(query.values('subscriber_status').annotate(
                count=Count('id'),
                percentage=ExpressionWrapper(
                    Cast(F('count') * 100.0 / total_subscribers, FloatField()),
                    output_field=FloatField()
                )
            ).order_by('-count'))

            # Track new creations by telecom type
            current_date = timezone.now()

            # Get current month's data
            current_month_start = current_date.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0)
            current_month_end = (
                current_month_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)

            current_month_query = query.filter(
                creation_date__gte=current_month_start,
                creation_date__lte=current_month_end
            )

            # Get previous month's data
            previous_month_start = (
                current_month_start - timedelta(days=1)).replace(day=1)
            previous_month_end = current_month_start - timedelta(seconds=1)

            previous_month_query = query.filter(
                creation_date__gte=previous_month_start,
                creation_date__lte=previous_month_end
            )

            # New creations by telecom type for current month
            new_creations_by_telecom = list(current_month_query.values('telecom_type').annotate(
                count=Count('id')
            ).order_by('-count'))

            # Calculate month-over-month evolution
            current_month_total = current_month_query.count()
            previous_month_total = previous_month_query.count()

            # Calculate evolution percentages
            if previous_month_total > 0:
                evolution_percentage = (
                    (current_month_total - previous_month_total) / previous_month_total) * 100
            else:
                evolution_percentage = 100 if current_month_total > 0 else 0

            # Evolution by telecom type
            evolution_by_telecom = []
            for telecom_type in set(item['telecom_type'] for item in new_creations_by_telecom):
                current_count = current_month_query.filter(
                    telecom_type=telecom_type).count()
                previous_count = previous_month_query.filter(
                    telecom_type=telecom_type).count()

                if previous_count > 0:
                    telecom_evolution = (
                        (current_count - previous_count) / previous_count) * 100
                else:
                    telecom_evolution = 100 if current_count > 0 else 0

                evolution_by_telecom.append({
                    'telecom_type': telecom_type,
                    'current_month_count': current_count,
                    'previous_month_count': previous_count,
                    'evolution_percentage': telecom_evolution
                })

            # Prepare response data
            response_data = {
                'total_subscribers': total_subscribers,
                'subscribers_by_state': subscribers_by_state,
                'subscribers_by_offer': subscribers_by_offer,
                'subscribers_by_customer': subscribers_by_customer,
                'subscribers_by_telecom': subscribers_by_telecom,
                'subscribers_by_status': subscribers_by_status,
                'new_creations': {
                    'current_month': {
                        'total': current_month_total,
                        'by_telecom_type': new_creations_by_telecom
                    },
                    'previous_month': {
                        'total': previous_month_total
                    },
                    'evolution': {
                        'total_percentage': evolution_percentage,
                        'by_telecom_type': evolution_by_telecom
                    }
                },
                'period': {
                    'current_month': {
                        'start': current_month_start.date(),
                        'end': current_month_end.date()
                    },
                    'previous_month': {
                        'start': previous_month_start.date(),
                        'end': previous_month_end.date()
                    }
                }
            }

            return Response(response_data)

        except Exception as e:
            logger.error(
                f"Error retrieving Corporate NGBSS Park KPIs: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PeriodicRevenueKPIView(APIView):
    """
    API view for retrieving Periodic Revenue KPIs
    - Total periodic revenue
    - Revenue by DOT
    - Revenue by product
    - Anomaly detection
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Base query
            query = CAPeriodique.objects.all()

            # Get query parameters
            dot = request.query_params.get('dot', None)

            if dot:
                query = query.filter(dot=dot)

            # Apply filtering based on requirements
            # For Siège, take all products
            # For other DOTs, take only Specialized Line and LTE
            if dot and dot.lower() != 'siège':
                query = query.filter(
                    Q(product='Specialized Line') | Q(product='LTE')
                )

            # Calculate total revenue
            total_revenue = query.aggregate(
                total_pre_tax=Coalesce(
                    Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                total_tax=Coalesce(Sum('tax_amount'), 0,
                                   output_field=DecimalField()),
                total_amount=Coalesce(
                    Sum('total_amount'), 0, output_field=DecimalField()),
                total_discount=Coalesce(
                    Sum('discount'), 0, output_field=DecimalField())
            )

            # Group by DOT
            revenue_by_dot = list(query.values('dot').annotate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            ).order_by('dot'))

            # Group by product
            revenue_by_product = list(query.values('product').annotate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            ).order_by('product'))

            # Identify anomalies (empty cells)
            anomalies = {
                'empty_dot': query.filter(Q(dot__isnull=True) | Q(dot='')).count(),
                'empty_product': query.filter(Q(product__isnull=True) | Q(product='')).count(),
                'zero_amount': query.filter(Q(total_amount=0) | Q(total_amount__isnull=True)).count()
            }

            return Response({
                'total_revenue': total_revenue,
                'revenue_by_dot': revenue_by_dot,
                'revenue_by_product': revenue_by_product,
                'anomalies': anomalies
            })

        except Exception as e:
            logger.error(f"Error retrieving Periodic Revenue KPIs: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class NonPeriodicRevenueKPIView(APIView):
    """
    API view for retrieving Non-Periodic Revenue KPIs
    - Total non-periodic revenue
    - Revenue by DOT
    - Revenue by product
    - Revenue by sale type
    - Revenue by channel
    - Anomaly detection
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get query parameters
            year = request.query_params.get('year', None)
            dot = request.query_params.get('dot', None)

            # Start with all records
            query = CANonPeriodique.objects.all()

            # Apply filters if provided
            if dot:
                query = query.filter(dot__icontains=dot)

            # Get total count for debugging
            total_count = query.count()
            logger.info(
                f"NonPeriodicRevenueKPIView: Found {total_count} records")

            # Calculate total revenue
            total_revenue = query.aggregate(
                total_pre_tax=Coalesce(
                    Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                total_tax=Coalesce(Sum('tax_amount'), 0,
                                   output_field=DecimalField()),
                total_amount=Coalesce(
                    Sum('total_amount'), 0, output_field=DecimalField())
            )

            # Group by product
            revenue_by_product = list(query.values('product').annotate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            ).order_by('product'))

            # Group by sale type
            revenue_by_sale_type = list(query.values('sale_type').annotate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            ).order_by('sale_type'))

            # Group by channel
            revenue_by_channel = list(query.values('channel').annotate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            ).order_by('channel'))

            # Group by DOT
            revenue_by_dot = list(query.values('dot').annotate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            ).order_by('dot'))

            # Identify anomalies (empty cells)
            anomalies = {
                'empty_product': query.filter(Q(product__isnull=True) | Q(product='')).count(),
                'empty_sale_type': query.filter(Q(sale_type__isnull=True) | Q(sale_type='')).count(),
                'empty_channel': query.filter(Q(channel__isnull=True) | Q(channel='')).count(),
                'zero_amount': query.filter(Q(total_amount=0) | Q(total_amount__isnull=True)).count()
            }

            return Response({
                'total_revenue': total_revenue,
                'revenue_by_product': revenue_by_product,
                'revenue_by_sale_type': revenue_by_sale_type,
                'revenue_by_channel': revenue_by_channel,
                'revenue_by_dot': revenue_by_dot,
                'anomalies': anomalies,
                'total_count': total_count
            })

        except Exception as e:
            logger.error(
                f"Error retrieving Non-Periodic Revenue KPIs: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class SpecialRevenueKPIView(APIView):
    """
    API view for retrieving Special Revenue KPIs (DNT, RFD, CNT)
    - Total revenue by type
    - Revenue by DOT
    - Revenue by department
    - Anomaly detection
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get revenue type from query parameters
            revenue_type = request.query_params.get('type', 'dnt')
            dot = request.query_params.get('dot', None)
            department = request.query_params.get('department', None)
            year = request.query_params.get('year', None)

            # Select the appropriate model based on revenue type
            if revenue_type.lower() == 'dnt':
                # Start with all records
                query = CADNT.objects.all()

                # Apply filters if provided
                if dot:
                    query = query.filter(dot__icontains=dot)
                if department:
                    query = query.filter(department__icontains=department)

                # Get total count for debugging
                total_count = query.count()
                logger.info(
                    f"SpecialRevenueKPIView (DNT): Found {total_count} records")

                # Calculate total revenue
                total_revenue = query.aggregate(
                    total_pre_tax=Coalesce(
                        Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                    total_tax=Coalesce(Sum('tax_amount'), 0,
                                       output_field=DecimalField()),
                    total_amount=Coalesce(
                        Sum('total_amount'), 0, output_field=DecimalField())
                )

                # Group by DOT
                revenue_by_dot = list(query.values('dot').annotate(
                    total=Coalesce(Sum('total_amount'), 0,
                                   output_field=DecimalField())
                ).order_by('dot'))

                # Group by department
                revenue_by_department = list(query.values('department').annotate(
                    total=Coalesce(Sum('total_amount'), 0,
                                   output_field=DecimalField())
                ).order_by('department'))

                # Identify anomalies (empty cells)
                anomalies = {
                    'empty_transaction_id': query.filter(Q(transaction_id__isnull=True) | Q(transaction_id='')).count(),
                    'empty_transaction_type': query.filter(Q(transaction_type__isnull=True) | Q(transaction_type='')).count(),
                    'empty_customer_code': query.filter(Q(customer_code__isnull=True) | Q(customer_code='')).count(),
                    'zero_amount': query.filter(Q(total_amount=0) | Q(total_amount__isnull=True)).count()
                }

            elif revenue_type.lower() == 'rfd':
                # Start with all records
                query = CARFD.objects.all()

                # Apply filters if provided
                if dot:
                    query = query.filter(dot__icontains=dot)
                if department:
                    query = query.filter(department__icontains=department)

                # Get total count for debugging
                total_count = query.count()
                logger.info(
                    f"SpecialRevenueKPIView (RFD): Found {total_count} records")

                # Calculate total revenue
                total_revenue = query.aggregate(
                    total_pre_tax=Coalesce(
                        Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                    total_tax=Coalesce(Sum('tax_amount'), 0,
                                       output_field=DecimalField()),
                    total_amount=Coalesce(
                        Sum('total_amount'), 0, output_field=DecimalField()),
                    total_droit_timbre=Coalesce(
                        Sum('droit_timbre'), 0, output_field=DecimalField())
                )

                # Group by DOT
                revenue_by_dot = list(query.values('dot').annotate(
                    total=Coalesce(Sum('total_amount'), 0,
                                   output_field=DecimalField())
                ).order_by('dot'))

                # Group by department
                revenue_by_department = list(query.values('department').annotate(
                    total=Coalesce(Sum('total_amount'), 0,
                                   output_field=DecimalField())
                ).order_by('department'))

                # Identify anomalies (empty cells)
                anomalies = {
                    'empty_transaction_id': query.filter(Q(transaction_id__isnull=True) | Q(transaction_id='')).count(),
                    'empty_customer_code': query.filter(Q(customer_code__isnull=True) | Q(customer_code='')).count(),
                    'zero_amount': query.filter(Q(total_amount=0) | Q(total_amount__isnull=True)).count()
                }

            elif revenue_type.lower() == 'cnt':
                # Start with all records
                query = CACNT.objects.all()

                # Apply filters if provided
                if dot:
                    query = query.filter(dot__icontains=dot)
                if department:
                    query = query.filter(department__icontains=department)

                # Get total count for debugging
                total_count = query.count()
                logger.info(
                    f"SpecialRevenueKPIView (CNT): Found {total_count} records")

                # Calculate total revenue
                total_revenue = query.aggregate(
                    total_pre_tax=Coalesce(
                        Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                    total_tax=Coalesce(Sum('tax_amount'), 0,
                                       output_field=DecimalField()),
                    total_amount=Coalesce(
                        Sum('total_amount'), 0, output_field=DecimalField())
                )

                # Group by DOT
                revenue_by_dot = list(query.values('dot').annotate(
                    total=Coalesce(Sum('total_amount'), 0,
                                   output_field=DecimalField())
                ).order_by('dot'))

                # Group by department
                revenue_by_department = list(query.values('department').annotate(
                    total=Coalesce(Sum('total_amount'), 0,
                                   output_field=DecimalField())
                ).order_by('department'))

                # Identify anomalies (empty cells)
                anomalies = {
                    'empty_transaction_id': query.filter(Q(transaction_id__isnull=True) | Q(transaction_id='')).count(),
                    'empty_invoice_adjusted': query.filter(Q(invoice_adjusted__isnull=True) | Q(invoice_adjusted='')).count(),
                    'empty_customer_code': query.filter(Q(customer_code__isnull=True) | Q(customer_code='')).count(),
                    'zero_amount': query.filter(Q(total_amount=0) | Q(total_amount__isnull=True)).count()
                }
            else:
                return Response(
                    {'error': f"Invalid revenue type: {revenue_type}. Must be one of: dnt, rfd, cnt"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response({
                'revenue_type': revenue_type.upper(),
                'total_revenue': total_revenue,
                'revenue_by_dot': revenue_by_dot,
                'revenue_by_department': revenue_by_department,
                'anomalies': anomalies,
                'total_count': total_count
            })

        except Exception as e:
            logger.error(f"Error retrieving Special Revenue KPIs: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DashboardSummaryView(APIView):
    """
    API view for retrieving overview statistics for the admin dashboard
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get query parameters
            year = request.query_params.get('year')
            month = request.query_params.get('month')
            dot = request.query_params.get('dot')

            # Base queries
            receivables_query = CreancesNGBSS.objects.all()
            park_query = ParcCorporate.objects.all()
            revenue_query = JournalVentes.objects.all()
            collection_query = EtatFacture.objects.all()

            # Apply filters if provided
            if year:
                try:
                    year_int = int(year)
                    receivables_query = receivables_query.filter(year=year)
                    revenue_query = revenue_query.filter(
                        invoice_date__year=year_int)
                    collection_query = collection_query.filter(
                        invoice_date__year=year_int)
                except ValueError:
                    return Response(
                        {"error": "Year must be a valid integer"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            if month:
                try:
                    month_int = int(month)
                    revenue_query = revenue_query.filter(
                        invoice_date__month=month_int)
                    collection_query = collection_query.filter(
                        invoice_date__month=month_int)
                except ValueError:
                    return Response(
                        {"error": "Month must be a valid integer"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            if dot:
                # Use dot_code instead of dot for CreancesNGBSS
                receivables_query = receivables_query.filter(dot_code=dot)
                revenue_query = revenue_query.filter(organization=dot)
                collection_query = collection_query.filter(organization=dot)

            # Count empty fields in receivables using Q objects properly
            empty_fields_receivables = receivables_query.filter(
                Q(dot__isnull=True) |
                Q(actel__isnull=True) |
                Q(product__isnull=True) |
                Q(dot_code="") |
                Q(actel="") |
                Q(product="")
            ).count()

            # Calculate total revenue
            total_revenue = revenue_query.aggregate(
                total=Coalesce(Sum('revenue_amount'), 0,
                               output_field=DecimalField())
            )['total'] or 0

            # Calculate total collection
            total_collection = collection_query.aggregate(
                total=Coalesce(Sum('collection_amount'), 0,
                               output_field=DecimalField())
            )['total'] or 0

            # Calculate total receivables
            total_receivables = receivables_query.aggregate(
                total=Coalesce(Sum('creance_brut'), 0,
                               output_field=DecimalField())
            )['total'] or 0

            # Count total subscribers
            total_subscribers = park_query.count()

            # Count anomalies in park data
            empty_fields_park = park_query.filter(
                Q(customer_l1_code__isnull=True) |
                Q(customer_l1_code="") |
                Q(offer_name__isnull=True) |
                Q(offer_name="")
            ).count()

            # Prepare response data
            response_data = {
                'total_revenue': total_revenue,
                'total_collection': total_collection,
                'total_receivables': total_receivables,
                'total_subscribers': total_subscribers,
                'anomalies': {
                    'empty_fields_receivables': empty_fields_receivables,
                    'empty_fields_park': empty_fields_park,
                }
            }

            return Response(response_data)
        except Exception as e:
            logger.error(f"Error retrieving dashboard summary: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {"error": f"Error retrieving dashboard summary: {str(e)}"},
                status=500
            )


class UnifiedKPIView(APIView):
    """
    API view for retrieving unified KPIs across all data types
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get query parameters
            year = request.query_params.get('year', datetime.now().year)
            month = request.query_params.get('month', None)
            dot = request.query_params.get('dot', None)

            # Initialize DataProcessor
            data_processor = DataProcessor()

            # Get objectives from request or database
            objectives = {
                'revenue_objective': request.query_params.get('revenue_objective', None),
                'encaissement_objective': request.query_params.get('encaissement_objective', None)
            }

            # Convert objectives to float if provided
            if objectives['revenue_objective']:
                objectives['revenue_objective'] = float(
                    objectives['revenue_objective'])
            if objectives['encaissement_objective']:
                objectives['encaissement_objective'] = float(
                    objectives['encaissement_objective'])

            # Get previous year data for comparison
            previous_year = int(year) - 1

            # Fetch data for each data type

            # 1. Journal des Ventes
            journal_ventes_data = self._get_journal_ventes_data(
                year, month, dot)
            journal_ventes_prev_data = self._get_journal_ventes_data(
                previous_year, month, dot)

            # 2. État de Facture
            etat_facture_data = self._get_etat_facture_data(year, month, dot)
            etat_facture_prev_data = self._get_etat_facture_data(
                previous_year, month, dot)

            # 3. Parc Corporate
            parc_corporate_data = self._get_parc_corporate_data(
                year, month, dot)
            parc_corporate_prev_data = self._get_parc_corporate_data(
                previous_year, month, dot)

            # 4. Créances NGBSS
            creances_ngbss_data = self._get_creances_ngbss_data(
                year, month, dot)
            creances_ngbss_prev_data = self._get_creances_ngbss_data(
                previous_year, month, dot)

            # Calculate KPIs for each data type
            journal_ventes_kpis = data_processor.calculate_kpis(
                'journal_ventes',
                journal_ventes_data,
                objectives,
                self._get_previous_year_kpis(
                    journal_ventes_prev_data, 'journal_ventes')
            )

            etat_facture_kpis = data_processor.calculate_kpis(
                'etat_facture',
                etat_facture_data,
                objectives,
                self._get_previous_year_kpis(
                    etat_facture_prev_data, 'etat_facture')
            )

            parc_corporate_kpis = data_processor.calculate_kpis(
                'parc_corporate',
                parc_corporate_data,
                None,
                self._get_previous_year_kpis(
                    parc_corporate_prev_data, 'parc_corporate')
            )

            creances_ngbss_kpis = data_processor.calculate_kpis(
                'creances_ngbss',
                creances_ngbss_data,
                None,
                self._get_previous_year_kpis(
                    creances_ngbss_prev_data, 'creances_ngbss')
            )

            # Match Journal des Ventes and État de Facture
            if journal_ventes_data and etat_facture_data:
                matched_data, missing_invoices, match_kpis = data_processor.match_journal_ventes_etat_facture(
                    journal_ventes_data, etat_facture_data
                )
            else:
                matched_data, missing_invoices, match_kpis = [], {}, {}

            # Combine all KPIs
            unified_kpis = {
                'year': year,
                'month': month,
                'dot': dot,
                'journal_ventes': journal_ventes_kpis,
                'etat_facture': etat_facture_kpis,
                'parc_corporate': parc_corporate_kpis,
                'creances_ngbss': creances_ngbss_kpis,
                'matched_data': {
                    'kpis': match_kpis,
                    'missing_invoices_count': {
                        'missing_in_etat_facture': len(missing_invoices.get('missing_in_etat_facture', [])),
                        'missing_in_journal_ventes': len(missing_invoices.get('missing_in_journal_ventes', []))
                    }
                }
            }

            return Response(unified_kpis)

        except Exception as e:
            logger.error(f"Error retrieving unified KPIs: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _get_journal_ventes_data(self, year, month, dot):
        """Get Journal des Ventes data for the specified filters"""
        query = JournalVentes.objects.all()

        # Apply filters
        if year:
            query = query.filter(invoice_date__year=year)
        if month:
            query = query.filter(invoice_date__month=month)
        if dot:
            # Clean organization name as per requirements
            query = query.filter(organization__icontains=dot)

        # For headquarters (Siège), only include DCC and DCGC
        if dot and dot.lower() == 'siège':
            query = query.filter(organization__in=['DCC', 'DCGC'])

        # Convert to list of dictionaries
        return list(query.values())

    def _get_etat_facture_data(self, year, month, dot):
        """Get État de Facture data for the specified filters"""
        query = EtatFacture.objects.all()

        # Apply filters
        if year:
            query = query.filter(invoice_date__year=year)
        if month:
            query = query.filter(invoice_date__month=month)
        if dot:
            # Clean organization name as per requirements
            query = query.filter(organization__icontains=dot)

        # For headquarters (Siège), only include DCC and DCGC
        if dot and dot.lower() == 'siège':
            query = query.filter(organization__in=['DCC', 'DCGC'])

        # Convert to list of dictionaries
        return list(query.values())

    def _get_parc_corporate_data(self, year, month, dot):
        """Get Parc Corporate data for the specified filters"""
        query = ParcCorporate.objects.all()

        # Apply filters based on creation_date if available
        if year and hasattr(ParcCorporate, 'creation_date'):
            # Convert creation_date to datetime if it's a string
            query = query.extra(
                where=["EXTRACT(YEAR FROM creation_date::timestamp) = %s"],
                params=[year]
            )
        if month and hasattr(ParcCorporate, 'creation_date'):
            query = query.extra(
                where=["EXTRACT(MONTH FROM creation_date::timestamp) = %s"],
                params=[month]
            )

        # Convert to list of dictionaries
        return list(query.values())

    def _get_creances_ngbss_data(self, year, month, dot):
        """Get Créances NGBSS data for the specified filters"""
        query = CreancesNGBSS.objects.all()

        # Apply filters if applicable
        # Note: This depends on your CreancesNGBSS model structure

        # Convert to list of dictionaries
        return list(query.values())

    def _get_previous_year_kpis(self, data, data_type):
        """Calculate KPIs for previous year data"""
        if not data:
            return {}

        data_processor = DataProcessor()
        return data_processor.calculate_kpis(data_type, data)

    def _get_revenue_objectives(self, year, month=None, dot=None):
        """
        Get revenue objectives from the database

        Args:
            year: Year to get objectives for
            month: Month to get objectives for (optional)
            dot: DOT to filter by (optional)

        Returns:
            List of revenue objectives
        """
        # This is a placeholder - implement actual objective retrieval logic
        # based on your database structure

        query = RevenueObjective.objects.filter(year=year)

        if month:
            query = query.filter(month=month)

        if dot:
            query = query.filter(dot=dot)

        objectives = []
        for obj in query:
            objectives.append({
                'dot': obj.dot,
                'month': obj.month,
                'value': obj.target_amount
            })

        return objectives

    def _get_collection_objectives(self, year, month=None, dot=None):
        """
        Get collection objectives from the database

        Args:
            year: Year to get objectives for
            month: Month to get objectives for (optional)
            dot: DOT to filter by (optional)

        Returns:
            List of collection objectives
        """
        # This is a placeholder - implement actual objective retrieval logic
        # based on your database structure

        query = CollectionObjective.objects.filter(year=year)

        if month:
            query = query.filter(month=month)

        if dot:
            query = query.filter(dot=dot)

        objectives = []
        for obj in query:
            objectives.append({
                'dot': obj.dot,
                'month': obj.month,
                'value': obj.target_amount
            })

        return objectives

    def _get_invoiced_amount_data(self, year, month=None, dot=None):
        """
        Get invoiced amount data for collection rate calculation

        Args:
            year: Year to get data for
            month: Month to get data for (optional)
            dot: DOT to filter by (optional)

        Returns:
            List of invoiced amount data
        """
        # Get data from EtatFacture model
        from .models import EtatFacture
        from django.db.models import Sum

        query = EtatFacture.objects.filter(invoice_date__year=year)

        if month:
            query = query.filter(invoice_date__month=month)

        if dot:
            # Clean DOT name to match organization field format
            clean_dot = dot.replace('DOT_', '').replace(
                '_', '').replace('–', '')
            query = query.filter(organization=clean_dot)

        # Group by organization and sum total_amount
        result = query.values('organization').annotate(
            total=Sum('total_amount')
        )

        data = []
        for item in result:
            data.append({
                'dot': item['organization'],
                'value': item['total']
            })

        return data


class PerformanceRankingView(APIView):
    """
    API view for retrieving Top/Flop performance metrics
    - Top performing DOTs by revenue, collection, etc.
    - Flop performing DOTs by revenue, collection, etc.
    - DOTs with zero revenue or collection
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get query parameters
            year = request.query_params.get('year', datetime.now().year)
            month = request.query_params.get('month', None)
            # revenue, collection, etc.
            metric = request.query_params.get('metric', 'revenue')
            # Number of top/flop items
            limit = int(request.query_params.get('limit', 5))

            # Get performance rankings based on the requested metric
            if metric == 'revenue':
                rankings = self._get_revenue_rankings(year, month, limit)
            elif metric == 'collection':
                rankings = self._get_collection_rankings(year, month, limit)
            elif metric == 'receivables':
                rankings = self._get_receivables_rankings(year, month, limit)
            elif metric == 'corporate_park':
                rankings = self._get_corporate_park_rankings(
                    year, month, limit)
            else:
                return Response(
                    {'error': f"Invalid metric: {metric}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response(rankings)

        except Exception as e:
            logger.error(f"Error retrieving performance ranking: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _get_revenue_rankings(self, year, month, limit):
        """
        Get revenue performance rankings

        Args:
            year: The year to filter by
            month: The month to filter by
            limit: The number of top/flop items to return

        Returns:
            Dictionary with top performers, flop performers, and zero revenue DOTs
        """
        # Base query for Journal Ventes
        query = JournalVentes.objects.all()

        # Apply filters
        if year:
            query = query.filter(invoice_date__year=year)
        if month:
            query = query.filter(invoice_date__month=month)

        # Group by organization and calculate total revenue
        organizations = query.values('organization').annotate(
            total=Sum('revenue_amount')
        ).order_by('-total')

        # Get top performers
        top_performers = list(organizations[:limit])

        # Get flop performers (non-zero revenue)
        flop_performers = list(organizations.filter(
            total__gt=0).order_by('total')[:limit])

        # Get zero revenue organizations
        zero_revenue = list(organizations.filter(total=0))

        return {
            'top_performers': top_performers,
            'flop_performers': flop_performers,
            'zero_revenue': zero_revenue,
            'metric': 'revenue',
            'year': year,
            'month': month
        }

    def _get_collection_rankings(self, year, month, limit):
        """
        Get collection performance rankings

        Args:
            year: The year to filter by
            month: The month to filter by
            limit: The number of top/flop items to return

        Returns:
            Dictionary with top performers, flop performers, and zero collection DOTs
        """
        # Base query for Etat Facture
        query = EtatFacture.objects.all()

        # Apply filters
        if year:
            query = query.filter(invoice_date__year=year)
        if month:
            query = query.filter(invoice_date__month=month)

        # Group by organization and calculate total collection
        organizations = query.values('organization').annotate(
            total=Sum('collection_amount')
        ).order_by('-total')

        # Get top performers
        top_performers = list(organizations[:limit])

        # Get flop performers (non-zero collection)
        flop_performers = list(organizations.filter(
            total__gt=0).order_by('total')[:limit])

        # Get zero collection organizations
        zero_collection = list(organizations.filter(total=0))

        return {
            'top_performers': top_performers,
            'flop_performers': flop_performers,
            'zero_collection': zero_collection,
            'metric': 'collection',
            'year': year,
            'month': month
        }

    def _get_receivables_rankings(self, year, month, limit):
        """
        Get receivables performance rankings

        Args:
            year: The year to filter by
            month: The month to filter by
            limit: The number of top/flop items to return

        Returns:
            Dictionary with top performers, flop performers by receivables
        """
        # Base query for Creances NGBSS
        query = CreancesNGBSS.objects.all()

        # Apply filters
        if year:
            query = query.filter(year=year)
        if month:
            query = query.filter(month=month)

        # Group by DOT and calculate total receivables
        dots = query.values('dot').annotate(
            total=Sum('creance_net')
        ).order_by('-total')

        # Get top performers (highest receivables - this might be considered "flop" in business terms)
        highest_receivables = list(dots[:limit])

        # Get flop performers (lowest non-zero receivables - this might be considered "top" in business terms)
        lowest_receivables = list(dots.filter(
            total__gt=0).order_by('total')[:limit])

        # Get zero receivables DOTs
        zero_receivables = list(dots.filter(total=0))

        return {
            'highest_receivables': highest_receivables,
            'lowest_receivables': lowest_receivables,
            'zero_receivables': zero_receivables,
            'metric': 'receivables',
            'year': year,
            'month': month
        }

    def _get_corporate_park_rankings(self, year, month, limit):
        """
        Get corporate park performance rankings

        Args:
            year: The year to filter by
            month: The month to filter by
            limit: The number of top/flop items to return

        Returns:
            Dictionary with top performers, flop performers by subscriber count
        """
        # Base query for Parc Corporate
        query = ParcCorporate.objects.all()

        # Apply filters for creation_date if year and month are provided
        if year and month:
            query = query.filter(
                creation_date__year=year,
                creation_date__month=month
            )

        # Group by state and count subscribers
        states = query.values('state').annotate(
            total=Count('id')
        ).order_by('-total')

        # Get top performers (highest subscriber count)
        top_states = list(states[:limit])

        # Get flop performers (lowest non-zero subscriber count)
        flop_states = list(states.filter(
            total__gt=0).order_by('total')[:limit])

        # Get zero subscriber states
        zero_subscribers = list(states.filter(total=0))

        return {
            'top_states': top_states,
            'flop_states': flop_states,
            'zero_subscribers': zero_subscribers,
            'metric': 'corporate_park',
            'year': year,
            'month': month
        }


class NGBSSCollectionKPIView(APIView):
    """
    API view for NGBSS Collection KPIs
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get NGBSS Collection KPIs

        Query parameters:
        - year: Filter by year (default: current year)
        - month: Filter by month (optional)
        - dot: Filter by DOT (optional)
        - compare_with_previous: Compare with previous year (default: true)
        - compare_with_objectives: Compare with objectives (default: true)
        """
        try:
            # Get query parameters
            year = request.query_params.get('year', datetime.now().year)
            month = request.query_params.get('month')
            dot = request.query_params.get('dot')
            compare_with_previous = request.query_params.get(
                'compare_with_previous', 'true').lower() == 'true'
            compare_with_objectives = request.query_params.get(
                'compare_with_objectives', 'true').lower() == 'true'

            # Base query for current year collections
            current_year_query = Q(year=year)
            if month:
                current_year_query &= Q(month=month)
            if dot:
                current_year_query &= Q(dot=dot)
            current_year_query &= Q(is_previous_year=False)

            # Get current year collections
            current_year_collections = NGBSSCollection.objects.filter(
                current_year_query)

            # Calculate total current year collections
            total_current_year = current_year_collections.aggregate(
                total=Sum('collection_amount')
            )['total'] or 0

            # Initialize response data
            response_data = {
                'total_current_year': total_current_year,
                'by_dot': [],
                'by_month': [],
                'by_client_category': [],
                'by_product': []
            }

            # Group by DOT
            dot_data = current_year_collections.values('dot').annotate(
                total=Sum('collection_amount')
            ).order_by('-total')
            response_data['by_dot'] = list(dot_data)

            # Group by month if not filtered by month
            if not month:
                month_data = current_year_collections.values('month').annotate(
                    total=Sum('collection_amount')
                ).order_by('month')
                response_data['by_month'] = list(month_data)

            # Group by client category if available
            if 'customer_lev1' in [f.name for f in NGBSSCollection._meta.get_fields()]:
                category_data = current_year_collections.values('customer_lev1').annotate(
                    total=Sum('collection_amount')
                ).order_by('-total')
                response_data['by_client_category'] = list(category_data)

            # Group by product if available
            if 'product' in [f.name for f in NGBSSCollection._meta.get_fields()]:
                product_data = current_year_collections.values('product').annotate(
                    total=Sum('collection_amount')
                ).order_by('-total')
                response_data['by_product'] = list(product_data)

            # Compare with previous year if requested
            if compare_with_previous:
                # Base query for previous year collections
                previous_year_query = Q(year=int(year)-1)
                if month:
                    previous_year_query &= Q(month=month)
                if dot:
                    previous_year_query &= Q(dot=dot)
                previous_year_query &= Q(is_previous_year=True)

                # Get previous year collections
                previous_year_collections = NGBSSCollection.objects.filter(
                    previous_year_query)

                # Calculate total previous year collections
                total_previous_year = previous_year_collections.aggregate(
                    total=Sum('collection_amount')
                )['total'] or 0

                # Calculate change percentage
                if total_previous_year > 0:
                    change_percentage = (
                        (total_current_year - total_previous_year) / total_previous_year) * 100
                else:
                    change_percentage = 100 if total_current_year > 0 else 0

                # Add to response data
                response_data['total_previous_year'] = total_previous_year
                response_data['change_percentage'] = change_percentage

                # Group previous year by DOT
                previous_dot_data = previous_year_collections.values('dot').annotate(
                    total=Sum('collection_amount')
                ).order_by('-total')

                # Add previous year data to DOT data
                dot_comparison = []

                # Create a dictionary for quick lookup of previous year data by DOT
                previous_dot_dict = {item['dot']: item['total']
                                     for item in previous_dot_data}

                # Compare current year DOTs with previous year
                for dot_item in dot_data:
                    current_dot = dot_item['dot']
                    current_total = dot_item['total']
                    previous_total = previous_dot_dict.get(current_dot, 0)

                    # Calculate dot change percentage
                    if previous_total > 0:
                        dot_change = (
                            (current_total - previous_total) / previous_total) * 100
                    else:
                        dot_change = 100 if current_total > 0 else 0

                    dot_comparison.append({
                        'dot': current_dot,
                        'current_total': current_total,
                        'previous_total': previous_total,
                        'change_percentage': dot_change
                    })

                response_data['dot_comparison'] = dot_comparison

                # Compare with objectives if requested
                if compare_with_objectives:
                    # Get collection objectives
                    objectives_query = Q(year=year)
                    if month:
                        objectives_query &= Q(month=month)
                    else:
                        # Yearly objectives
                        objectives_query &= Q(month__isnull=True)

                    if dot:
                        objectives_query &= Q(dot=dot)

                    objectives = CollectionObjective.objects.filter(
                        objectives_query)

                    # Calculate total objective
                    total_objective = objectives.aggregate(
                        total=Sum('target_amount')
                    )['total'] or 0

                    # Calculate achievement percentage
                    if total_objective > 0:
                        achievement_percentage = (
                            total_current_year / total_objective) * 100
                    else:
                        achievement_percentage = 0

                    # Add to response data
                    response_data['total_objective'] = total_objective
                    response_data['achievement_percentage'] = achievement_percentage

                    # Group objectives by DOT
                    objective_dot_data = objectives.values('dot').annotate(
                        total=Sum('target_amount')
                    ).order_by('-total')

                    # Add objective data to DOT data
                    dot_achievement = []
                    for dot_item in response_data['by_dot']:
                        dot_name = dot_item['dot']
                        current_total = dot_item['total']
                        objective_total = next(
                            (item['total']
                             for item in objective_dot_data if item['dot'] == dot_name),
                            0
                        )

                        if objective_total > 0:
                            dot_achievement_pct = (
                                current_total / objective_total) * 100
                        else:
                            dot_achievement_pct = 0

                        dot_achievement.append({
                            'dot': dot_name,
                            'current_total': current_total,
                            'objective_total': objective_total,
                            'achievement_percentage': dot_achievement_pct
                        })

                    response_data['dot_achievement'] = dot_achievement

                    return Response(response_data)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UnfinishedInvoiceKPIView(APIView):
    """
    API view for Unfinished Invoice KPIs
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get Unfinished Invoice KPIs

        Query parameters:
        - dot: Filter by DOT (optional)
        - status: Filter by status (optional)
        - min_days: Minimum days pending (optional)
        - max_days: Maximum days pending (optional)
        """
        try:
            # Get query parameters
            dot = request.query_params.get('dot')
            status = request.query_params.get('status')
            min_days = request.query_params.get('min_days')
            max_days = request.query_params.get('max_days')

            # Base query
            query = Q()
            if dot:
                query &= Q(dot=dot)
            if status:
                query &= Q(status=status)
            if min_days:
                query &= Q(days_pending__gte=min_days)
            if max_days:
                query &= Q(days_pending__lte=max_days)

            # Get unfinished invoices
            unfinished_invoices = UnfinishedInvoice.objects.filter(query)

            # Calculate total unfinished invoice amount
            total_amount = unfinished_invoices.aggregate(
                total=Sum('invoice_amount')
            )['total'] or 0

            # Calculate average days pending
            avg_days_pending = unfinished_invoices.aggregate(
                avg=Avg('days_pending')
            )['avg'] or 0

            # Initialize response data
            response_data = {
                'total_count': unfinished_invoices.count(),
                'total_amount': total_amount,
                'avg_days_pending': avg_days_pending,
                'by_dot': [],
                'by_status': [],
                'by_age': [],
                'by_client': []
            }

            # Group by DOT
            dot_data = unfinished_invoices.values('dot').annotate(
                count=Count('id'),
                total=Sum('invoice_amount'),
                avg_days=Avg('days_pending')
            ).order_by('-total')
            response_data['by_dot'] = list(dot_data)

            # Group by status
            status_data = unfinished_invoices.values('status').annotate(
                count=Count('id'),
                total=Sum('invoice_amount'),
                avg_days=Avg('days_pending')
            ).order_by('-count')
            response_data['by_status'] = list(status_data)

            # Group by age (days pending)
            age_ranges = [
                {'min': 0, 'max': 30, 'label': '0-30 days'},
                {'min': 31, 'max': 60, 'label': '31-60 days'},
                {'min': 61, 'max': 90, 'label': '61-90 days'},
                {'min': 91, 'max': 180, 'label': '91-180 days'},
                {'min': 181, 'max': 365, 'label': '181-365 days'},
                {'min': 366, 'max': None, 'label': 'Over 365 days'}
            ]

            age_data = []
            for age_range in age_ranges:
                age_query = Q(days_pending__gte=age_range['min'])
                if age_range['max']:
                    age_query &= Q(days_pending__lte=age_range['max'])

                age_invoices = unfinished_invoices.filter(age_query)

                age_data.append({
                    'label': age_range['label'],
                    'count': age_invoices.count(),
                    'total': age_invoices.aggregate(total=Sum('invoice_amount'))['total'] or 0
                })

                response_data['by_age'] = age_data

                # Group by client (top 10)
                client_data = unfinished_invoices.values('client').annotate(
                    count=Count('id'),
                    total=Sum('invoice_amount'),
                    avg_days=Avg('days_pending')
                ).order_by('-total')[:10]
                response_data['by_client'] = list(client_data)

                return Response(response_data)

        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
