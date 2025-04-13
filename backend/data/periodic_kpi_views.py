import logging
import traceback
from django.db.models import Sum, Count, Q, Case, When, Value, DecimalField, IntegerField, ExpressionWrapper, FloatField
from django.db.models.functions import Coalesce, ExtractYear, ExtractMonth, TruncMonth
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import CAPeriodique, CADNT, CARFD, CACNT, DOT

logger = logging.getLogger(__name__)


class PeriodicRevenueKPIView(APIView):
    """
    API view specifically for retrieving Periodic Revenue KPIs

    C.A Périodique = C.A Périodique + C.A DNT + C.A RFD + C.A CNT
    (DNT=Ajustement, RFD=Remboursement, CNT=Annulation)

    Filters by DOT, Product, Operation (18 fichier Périodique, CNT, RFD, DNT)

    Processing of 18 Périodique files: 
    - For DOT column, use "siège"
    - For Product column, use LTE, Specialized Line, and X25

    Processing of RFD, CNT, and DNT files:
    - DOT column: Siège
    - DEPARTMENT column: Direction Commerciale Corporate
    - CUST_LEV2 column: all except 302

    After processing RFD, CNT, and DNT files:
    - PRI_IDENTITY column: A=ADSL, F=FTTX, LS=Specialized Line, PART=Specialized Line
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Debug incoming request
            logger.info("=== PERIODIC REVENUE KPI REQUEST ===")
            logger.info(f"Request parameters: {dict(request.query_params)}")

            # Get query parameters
            dot = request.query_params.get('dot', None)
            product = request.query_params.get('product', None)
            operation = request.query_params.get('operation', None)

            logger.info(
                f"Filters - DOT: '{dot}', Product: '{product}', Operation: '{operation}'")

            # 1. Process CA Periodique data
            logger.info("Processing CA Periodique data...")
            periodique_query = CAPeriodique.objects.all()
            logger.info(
                f"Initial CA Periodique count: {periodique_query.count()}")

            # Apply DOT filter to CA Periodique
            if dot and dot.strip():
                logger.info(f"Applying DOT filter to CA Periodique: {dot}")
                try:
                    if dot.isdigit():
                        dot_id = int(dot)
                        logger.info(f"DOT is numeric: {dot_id}")
                        periodique_query = periodique_query.filter(
                            dot_id=dot_id)
                    else:
                        # Try to find DOT by name or code
                        dot_obj = DOT.objects.filter(
                            Q(name__icontains=dot) |
                            Q(code__icontains=dot)
                        ).first()

                        if dot_obj:
                            logger.info(
                                f"Found DOT object: id={dot_obj.id}, name={dot_obj.name}")
                            periodique_query = periodique_query.filter(
                                dot=dot_obj)
                        else:
                            logger.info(
                                f"No DOT object found, using string filter")
                            periodique_query = periodique_query.filter(
                                dot_code__icontains=dot)
                except (ValueError, TypeError) as e:
                    logger.info(f"Error processing DOT: {str(e)}")
                    periodique_query = periodique_query.filter(
                        dot_code__icontains=dot)

                # Apply filtering based on requirements
                # For Siège, take all products
                # For other DOTs, take LTE, Specialized Line, and X25
                if dot.lower() != 'siège':
                    logger.info(
                        "Applying product filter (LTE + Specialized Line + X25)")
                    periodique_query = periodique_query.filter(
                        Q(product='Specialized Line') | Q(
                            product='LTE') | Q(product='X25')
                    )
                else:
                    logger.info("DOT is Siège - not applying product filter")

            # Apply Product filter if specified
            if product and product.strip():
                logger.info(
                    f"Applying product filter to CA Periodique: {product}")
                periodique_query = periodique_query.filter(
                    product__icontains=product)

            logger.info(
                f"Filtered CA Periodique count: {periodique_query.count()}")

            # 2. Process CA DNT (Adjustment) data
            logger.info("Processing CA DNT data...")
            dnt_query = CADNT.objects.all()
            logger.info(f"Initial CA DNT count: {dnt_query.count()}")

            # Apply filters to DNT
            if dot and dot.strip() and dot.lower() == 'siège':
                logger.info("Applying Siège filters to DNT")
                dnt_query = dnt_query.filter(
                    dot__icontains='Siège',
                    department__icontains='Direction Commerciale Corporate'
                ).exclude(customer_lev2='302')

            logger.info(f"Filtered CA DNT count: {dnt_query.count()}")

            # 3. Process CA RFD (Reimbursement) data
            logger.info("Processing CA RFD data...")
            rfd_query = CARFD.objects.all()
            logger.info(f"Initial CA RFD count: {rfd_query.count()}")

            # Apply filters to RFD
            if dot and dot.strip() and dot.lower() == 'siège':
                logger.info("Applying Siège filters to RFD")
                rfd_query = rfd_query.filter(
                    dot__icontains='Siège',
                    department__icontains='Direction Commerciale Corporate'
                ).exclude(customer_lev2='302')

            logger.info(f"Filtered CA RFD count: {rfd_query.count()}")

            # 4. Process CA CNT (Cancellation) data
            logger.info("Processing CA CNT data...")
            cnt_query = CACNT.objects.all()
            logger.info(f"Initial CA CNT count: {cnt_query.count()}")

            # Apply filters to CNT
            if dot and dot.strip() and dot.lower() == 'siège':
                logger.info("Applying Siège filters to CNT")
                cnt_query = cnt_query.filter(
                    dot__icontains='Siège',
                    department__icontains='Direction Commerciale Corporate'
                ).exclude(customer_lev2='302')

            logger.info(f"Filtered CA CNT count: {cnt_query.count()}")

            # Calculate total revenue for each source
            periodique_total = periodique_query.aggregate(
                total_pre_tax=Coalesce(
                    Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                total_tax=Coalesce(Sum('tax_amount'), 0,
                                   output_field=DecimalField()),
                total_amount=Coalesce(
                    Sum('total_amount'), 0, output_field=DecimalField()),
                total_discount=Coalesce(
                    Sum('discount'), 0, output_field=DecimalField())
            )

            dnt_total = dnt_query.aggregate(
                total_pre_tax=Coalesce(
                    Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                total_tax=Coalesce(Sum('tax_amount'), 0,
                                   output_field=DecimalField()),
                total_amount=Coalesce(
                    Sum('total_amount'), 0, output_field=DecimalField())
            )

            rfd_total = rfd_query.aggregate(
                total_pre_tax=Coalesce(
                    Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                total_tax=Coalesce(Sum('tax_amount'), 0,
                                   output_field=DecimalField()),
                total_amount=Coalesce(
                    Sum('total_amount'), 0, output_field=DecimalField())
            )

            cnt_total = cnt_query.aggregate(
                total_pre_tax=Coalesce(
                    Sum('amount_pre_tax'), 0, output_field=DecimalField()),
                total_tax=Coalesce(Sum('tax_amount'), 0,
                                   output_field=DecimalField()),
                total_amount=Coalesce(
                    Sum('total_amount'), 0, output_field=DecimalField())
            )

            # Calculate combined total
            total_amount = (
                periodique_total['total_amount'] +
                dnt_total['total_amount'] +
                rfd_total['total_amount'] +
                cnt_total['total_amount']
            )

            total_pre_tax = (
                periodique_total['total_pre_tax'] +
                dnt_total['total_pre_tax'] +
                rfd_total['total_pre_tax'] +
                cnt_total['total_pre_tax']
            )

            total_tax = (
                periodique_total['total_tax'] +
                dnt_total['total_tax'] +
                rfd_total['total_tax'] +
                cnt_total['total_tax']
            )

            # Combined total revenue
            total_revenue = {
                'total_pre_tax': total_pre_tax,
                'total_tax': total_tax,
                'total_amount': total_amount,
                # Only periodique has discount
                'total_discount': periodique_total['total_discount']
            }

            logger.info(f"Total revenue calculated: {total_revenue}")

            # Get breakdown by component
            breakdown_by_component = {
                'periodique': {
                    'total_amount': float(periodique_total['total_amount']),
                    'percentage': float(periodique_total['total_amount'] / total_amount * 100) if total_amount else 0
                },
                'dnt': {
                    'total_amount': float(dnt_total['total_amount']),
                    'percentage': float(dnt_total['total_amount'] / total_amount * 100) if total_amount else 0
                },
                'rfd': {
                    'total_amount': float(rfd_total['total_amount']),
                    'percentage': float(rfd_total['total_amount'] / total_amount * 100) if total_amount else 0
                },
                'cnt': {
                    'total_amount': float(cnt_total['total_amount']),
                    'percentage': float(cnt_total['total_amount'] / total_amount * 100) if total_amount else 0
                }
            }

            # Group periodique by DOT
            revenue_by_dot = list(periodique_query.values('dot').annotate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            ).order_by('dot'))

            # Group periodique by product
            revenue_by_product = list(periodique_query.values('product').annotate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            ).order_by('product'))

            # Group by operations/transaction types (for the Operations tab)
            # Since we don't have a specific operation field, we'll create a simulated one
            # using the sources (periodique, dnt, rfd, cnt)
            revenue_by_operation = [
                {
                    'operation': 'Périodique',
                    'total': float(periodique_total['total_amount']),
                    'pre_tax': float(periodique_total['total_pre_tax']),
                    'tax': float(periodique_total['total_tax'])
                },
                {
                    'operation': 'Ajustement (DNT)',
                    'total': float(dnt_total['total_amount']),
                    'pre_tax': float(dnt_total['total_pre_tax']),
                    'tax': float(dnt_total['total_tax'])
                },
                {
                    'operation': 'Remboursement (RFD)',
                    'total': float(rfd_total['total_amount']),
                    'pre_tax': float(rfd_total['total_pre_tax']),
                    'tax': float(rfd_total['total_tax'])
                },
                {
                    'operation': 'Annulation (CNT)',
                    'total': float(cnt_total['total_amount']),
                    'pre_tax': float(cnt_total['total_pre_tax']),
                    'tax': float(cnt_total['total_tax'])
                }
            ]

            # Identify anomalies
            try:
                # Only check for NULL in foreign key fields
                empty_dot_count = periodique_query.filter(
                    dot__isnull=True).count()

                # For string fields, check both NULL and empty string
                empty_product_count = periodique_query.filter(
                    Q(product__isnull=True) | Q(product='')
                ).count()

                zero_amount_count = periodique_query.filter(
                    Q(total_amount=0) | Q(total_amount__isnull=True)
                ).count()

                anomalies = {
                    'empty_dot': empty_dot_count,
                    'empty_product': empty_product_count,
                    'zero_amount': zero_amount_count
                }
            except Exception as anomaly_error:
                logger.error(
                    f"Error calculating anomalies: {str(anomaly_error)}")
                logger.error(traceback.format_exc())
                anomalies = {
                    'error': str(anomaly_error)
                }

            # Prepare response data
            response_data = {
                'total_revenue': total_revenue,
                'breakdown_by_component': breakdown_by_component,
                'revenue_by_dot': revenue_by_dot,
                'revenue_by_product': revenue_by_product,
                'revenue_by_operation': revenue_by_operation,
                'anomalies': anomalies,
                'counts': {
                    'periodique': periodique_query.count(),
                    'dnt': dnt_query.count(),
                    'rfd': rfd_query.count(),
                    'cnt': cnt_query.count()
                }
            }

            logger.info("=== END PERIODIC REVENUE KPI REQUEST ===")
            return Response(response_data)

        except Exception as e:
            logger.error(f"Error retrieving Periodic Revenue KPIs: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {'error': str(e), 'detail': traceback.format_exc()},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
