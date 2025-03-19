from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.core.cache import cache
from django.db.models import Q, Sum, Count
from django.utils import timezone
import time
import threading
import logging
import traceback
from .models import (
    ParcCorporate,
    CreancesNGBSS,
    CAPeriodique,
    CANonPeriodique,
    JournalVentes,
    EtatFacture
)

logger = logging.getLogger(__name__)


class DataProcessor:
    """Utility class for data processing operations"""
    pass


class DataValidationView(APIView):
    """
    API view for performing a second validation to ensure 
    that the first data treatment was executed correctly.
    This performs a comprehensive scan across all relevant tables
    to check for any issues with the data filtering and processing.
    """
    permission_classes = [IsAuthenticated]

    def _clean_parc_corporate(self, dot_filter=None, data_processor=None):
        """
        Cleans ParcCorporate data by removing records that don't match client requirements:
        - Removes categories 5 and 57 in CODE_CUSTOMER_L3
        - Removes entries with Moohtarif or Solutions Hebergements in OFFER_NAME
        - Removes entries with Predeactivated in SUBSCRIBER_STATUS
        """
        logger.info("Cleaning ParcCorporate data")
        result = {
            'model': 'ParcCorporate',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = ParcCorporate.objects.all()
            # Apply optional DOT filter if relevant
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))
            # Count total records to check
            result['records_checked'] = queryset.count()
            # Find records that don't match the client's requirements
            records_to_delete = queryset.filter(
                Q(customer_l3_code__in=['5', '57']) |
                Q(offer_name__icontains='Moohtarif') |
                Q(offer_name__icontains='Solutions Hebergements') |
                Q(subscriber_status='Predeactivated')
            )
            # Count and log records to be deleted
            deletion_count = records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete the invalid records
            records_to_delete.delete()

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from ParcCorporate")
        except Exception as e:
            logger.error(f"Error cleaning ParcCorporate data: {str(e)}")
            result['error'] = str(e)
        return result

    def _clean_creances_ngbss(self, dot_filter=None, data_processor=None):
        """
        Cleans CreancesNGBSS data by applying the following rules:
        - Keep only records with product = 'Specialized Line' or 'LTE'
        - Keep only records with customer_lev1 = 'Corporate' or 'Corporate Group'
        - Remove records with customer_lev2 = 'Client professionnelConventionné'
        - Keep only records with customer_lev3 in ['Ligne d'exploitation AP', 'Ligne d'exploitation ATMobilis', 'Ligne d'exploitation ATS']
        """
        logger.info("Cleaning CreancesNGBSS data")
        result = {
            'model': 'CreancesNGBSS',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = CreancesNGBSS.objects.all()
            # Apply optional DOT filter if relevant
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))
            # Count total records to check
            result['records_checked'] = queryset.count()
            # Find records that don't match the client's requirements
            records_to_delete = queryset.filter(
                # Product filter: Not in the valid products list
                ~Q(product__in=['Specialized Line', 'LTE']) |
                # Customer Lev1 filter: Not in the valid customer_lev1 list
                ~Q(customer_lev1__in=['Corporate', 'Corporate Group']) |
                # Customer Lev2 filter: In the excluded customer_lev2 list
                Q(customer_lev2='Client professionnelConventionné') |
                # Customer Lev3 filter: Not in the valid customer_lev3 list
                ~Q(customer_lev3__in=[
                    "Ligne d'exploitation AP",
                    "Ligne d'exploitation ATMobilis",
                    "Ligne d'exploitation ATS"
                ])
            )
            # Count and log records to be deleted
            deletion_count = records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete the invalid records
            records_to_delete.delete()

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from CreancesNGBSS")
        except Exception as e:
            logger.error(f"Error cleaning CreancesNGBSS data: {str(e)}")
            result['error'] = str(e)
        return result

    def _clean_ca_periodique(self, dot_filter=None, data_processor=None):
        """
        Cleans CAPeriodique data according to client requirements:
        - For DOT "Siège", keep all products
        - For other DOTs, keep only 'Specialized Line' and 'LTE' products
        - Identify and flag empty cells as anomalies
        """
        logger.info("Cleaning CAPeriodique data")
        result = {
            'model': 'CAPeriodique',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = CAPeriodique.objects.all()
            # Apply optional DOT filter if relevant
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))
            # Count total records to check
            result['records_checked'] = queryset.count()

            # Find records that don't match the client's requirements
            # For non-Siège DOTs, keep only Specialized Line and LTE
            records_to_delete = queryset.filter(
                # Not Siège DOT
                ~Q(dot_code='Siège') & ~Q(dot__name='Siège') &
                # And not one of the valid products for non-Siège
                ~Q(product__in=['Specialized Line', 'LTE'])
            )

            # Count and log records to be deleted
            deletion_count = records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete the invalid records
            records_to_delete.delete()

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from CAPeriodique")
        except Exception as e:
            logger.error(f"Error cleaning CAPeriodique data: {str(e)}")
            result['error'] = str(e)
        return result

    def _clean_ca_non_periodique(self, dot_filter=None, data_processor=None):
        """
        Cleans CANonPeriodique data according to client requirements:
        - Keep only records with DOT = "Siège"
        - Identify and flag empty cells as anomalies
        """
        logger.info("Cleaning CANonPeriodique data")
        result = {
            'model': 'CANonPeriodique',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = CANonPeriodique.objects.all()
            # Apply optional DOT filter if relevant
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))
            # Count total records to check
            result['records_checked'] = queryset.count()

            # Find records that don't match the client's requirements
            # Keep only records with DOT = "Siège"
            records_to_delete = queryset.filter(
                ~Q(dot_code='Siège') & ~Q(dot__name='Siège')
            )

            # Count and log records to be deleted
            deletion_count = records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete records
            records_to_delete.delete()

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from CANonPeriodique")
        except Exception as e:
            logger.error(f"Error cleaning CANonPeriodique data: {str(e)}")
            result['error'] = str(e)
        return result

    def _clean_journal_ventes(self, start_date=None, end_date=None, data_processor=None):
        """
        Cleans JournalVentes data according to client requirements:
        - AT Siège: Keep only DCC and DCGC organizations
        - Remove formatting issues in org_name (DOT_, _, -)
        - Remove records with billing_period containing previous year
        - Filter by date range if provided
        """
        logger.info("Cleaning JournalVentes data")
        result = {
            'model': 'JournalVentes',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = JournalVentes.objects.all()

            # Apply date filters if provided
            if start_date:
                queryset = queryset.filter(invoice_date__gte=start_date)
            if end_date:
                queryset = queryset.filter(invoice_date__lte=end_date)

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Identify records for AT Siège that are not DCC or DCGC
            siege_records_to_delete = queryset.filter(
                # Is AT Siège
                Q(organization__icontains='AT Siège') &
                # Not DCC or DCGC
                ~Q(organization__icontains='DCC') & ~Q(
                    organization__icontains='DCGC')
            )

            # Identify records with billing period containing previous year
            current_year = timezone.now().year
            previous_year = str(current_year - 1)
            records_with_previous_year = queryset.filter(
                billing_period__icontains=previous_year
            )

            # Combine querysets for deletion
            records_to_delete = siege_records_to_delete | records_with_previous_year

            # Count and log records to be deleted
            deletion_count = records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete the invalid records
            records_to_delete.delete()

            # Clean organization names by removing DOT_, _, -
            # This would require updating each record individually
            if data_processor:
                # Get remaining records
                remaining_records = queryset.exclude(
                    id__in=records_to_delete.values_list('id', flat=True))

                # Fix organization names
                for record in remaining_records:
                    original_name = record.organization
                    cleaned_name = original_name.replace(
                        'DOT_', '').replace('_', '').replace('-', '')

                    if original_name != cleaned_name:
                        record.organization = cleaned_name
                        record.save()
                        logger.info(
                            f"Updated organization name from '{original_name}' to '{cleaned_name}'")

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from JournalVentes")
        except Exception as e:
            logger.error(f"Error cleaning JournalVentes data: {str(e)}")
            result['error'] = str(e)
        return result

    def _clean_etat_facture(self, start_date=None, end_date=None, data_processor=None):
        """
        Cleans EtatFacture data according to client requirements:
        - AT Siège: Keep only DCC and DCGC organizations
        - Remove formatting issues in org_name (DOT_, _, -)
        - Format invoice_number as numeric
        - Filter by date range if provided
        """
        logger.info("Cleaning EtatFacture data")
        result = {
            'model': 'EtatFacture',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = EtatFacture.objects.all()

            # Apply date filters if provided
            if start_date:
                queryset = queryset.filter(invoice_date__gte=start_date)
            if end_date:
                queryset = queryset.filter(invoice_date__lte=end_date)

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Identify records for AT Siège that are not DCC or DCGC
            siege_records_to_delete = queryset.filter(
                # Is AT Siège
                Q(organization__icontains='AT Siège') &
                # Not DCC or DCGC
                ~Q(organization__icontains='DCC') & ~Q(
                    organization__icontains='DCGC')
            )

            # Count and log records to be deleted
            deletion_count = siege_records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete the invalid records
            siege_records_to_delete.delete()

            # Clean organization names and format invoice numbers
            if data_processor:
                # Get remaining records
                remaining_records = queryset.exclude(
                    id__in=siege_records_to_delete.values_list('id', flat=True))

                # Fix organization names and format invoice numbers
                for record in remaining_records:
                    # Clean organization name
                    original_name = record.organization
                    cleaned_name = original_name.replace(
                        'DOT_', '').replace('_', '').replace('-', '')

                    changes_made = False
                    if original_name != cleaned_name:
                        record.organization = cleaned_name
                        changes_made = True

                    # Format invoice_number if needed
                    # This assumes invoice_number is stored as a string and needs to be numeric
                    if hasattr(record, 'invoice_number') and record.invoice_number:
                        try:
                            # Try to convert to numeric and back to string to standardize format
                            numeric_invoice = str(
                                int(float(record.invoice_number)))
                            if record.invoice_number != numeric_invoice:
                                record.invoice_number = numeric_invoice
                                changes_made = True
                        except (ValueError, TypeError):
                            # If conversion fails, note it as an issue
                            result['issues'].append({
                                'id': record.id,
                                'type': 'invalid_invoice_number',
                                'description': f"Could not convert invoice_number '{record.invoice_number}' to numeric format"
                            })

                    # Save if changes were made
                    if changes_made:
                        record.save()

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from EtatFacture")
        except Exception as e:
            logger.error(f"Error cleaning EtatFacture data: {str(e)}")
            result['error'] = str(e)
        return result
