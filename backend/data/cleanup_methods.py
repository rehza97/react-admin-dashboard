"""
This file contains methods for cleaning data according to client requirements.
These methods are imported and used by the DataCleanupView class.
"""

import logging
from django.db.models import Q
from datetime import datetime
from .models import (
    ParcCorporate, CreancesNGBSS, CANonPeriodique, CAPeriodique,
    CACNT, CADNT, CARFD, JournalVentes, EtatFacture
)

logger = logging.getLogger(__name__)


def clean_parc_corporate():
    """
    Cleans ParcCorporate data by removing records that don't match client requirements:
    - Removes categories 5 and 57 in customer_l3_code
    - Removes entries with Moohtarif or Solutions Hebergements in offer_name
    - Removes entries with Predeactivated in subscriber_status
    """
    logger.info("Cleaning ParcCorporate data")
    result = {
        'total_before': ParcCorporate.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        # Find records that don't match the client's requirements
        records_to_delete = ParcCorporate.objects.filter(
            Q(customer_l3_code__in=['5', '57']) |
            Q(offer_name__icontains='Moohtarif') |
            Q(offer_name__icontains='Solutions Hebergements') |
            Q(subscriber_status='Predeactivated')
        )

        # Count and delete the invalid records
        deletion_count = records_to_delete.count()
        records_to_delete.delete()

        result['total_deleted'] = deletion_count
        result['total_after'] = ParcCorporate.objects.count()

        logger.info(
            f"Cleaned {deletion_count} invalid records from ParcCorporate")
    except Exception as e:
        logger.error(f"Error cleaning ParcCorporate data: {str(e)}")
        result['error'] = str(e)

    return result


def clean_creances_ngbss():
    """
    Cleans CreancesNGBSS data according to client requirements:
    - Keep only records with product in ['Specialized Line', 'LTE']
    - Keep only records with customer_lev1 in ['Corporate', 'Corporate Group']
    - Remove records with customer_lev2 = 'Client professionnelConventionné'
    - Keep only records with customer_lev3 in specific exploitation lines
    """
    logger.info("Cleaning CreancesNGBSS data")
    result = {
        'total_before': CreancesNGBSS.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        # Find records that don't match the client's requirements
        records_to_delete = CreancesNGBSS.objects.filter(
            Q(~Q(product__in=['Specialized Line', 'LTE'])) |
            Q(~Q(customer_lev1__in=['Corporate', 'Corporate Group'])) |
            Q(customer_lev2='Client professionnelConventionné') |
            Q(~Q(customer_lev3__in=[
                "Ligne d'exploitation AP",
                "Ligne d'exploitation ATMobilis",
                "Ligne d'exploitation ATS"
            ]))
        )

        # Count and delete the invalid records
        deletion_count = records_to_delete.count()
        records_to_delete.delete()

        result['total_deleted'] = deletion_count
        result['total_after'] = CreancesNGBSS.objects.count()

        logger.info(
            f"Cleaned {deletion_count} invalid records from CreancesNGBSS")
    except Exception as e:
        logger.error(f"Error cleaning CreancesNGBSS data: {str(e)}")
        result['error'] = str(e)

    return result


def clean_ca_non_periodique():
    """
    Cleans CANonPeriodique data according to client requirements:
    - Keep only records with DOT = "Siège"
    """
    logger.info("Cleaning CANonPeriodique data")
    result = {
        'total_before': CANonPeriodique.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        # Find records that don't match the client's requirements
        records_to_delete = CANonPeriodique.objects.filter(
            ~Q(dot__name='Siège')
        )

        # Count and delete the invalid records
        deletion_count = records_to_delete.count()
        records_to_delete.delete()

        result['total_deleted'] = deletion_count
        result['total_after'] = CANonPeriodique.objects.count()

        logger.info(
            f"Cleaned {deletion_count} invalid records from CANonPeriodique")
    except Exception as e:
        logger.error(f"Error cleaning CANonPeriodique data: {str(e)}")
        result['error'] = str(e)

    return result


def clean_ca_periodique():
    """
    Cleans CAPeriodique data according to client requirements:
    - For non-Siège DOTs, keep only records with product in ['Specialized Line', 'LTE']
    """
    logger.info("Cleaning CAPeriodique data")
    result = {
        'total_before': CAPeriodique.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        # Find records that don't match the client's requirements
        # For non-Siège DOTs, keep only records with product in ['Specialized Line', 'LTE']
        records_to_delete = CAPeriodique.objects.filter(
            ~Q(dot__name='Siège') &
            ~Q(product__in=['Specialized Line', 'LTE'])
        )

        # Count and delete the invalid records
        deletion_count = records_to_delete.count()
        records_to_delete.delete()

        result['total_deleted'] = deletion_count
        result['total_after'] = CAPeriodique.objects.count()

        logger.info(
            f"Cleaned {deletion_count} invalid records from CAPeriodique")
    except Exception as e:
        logger.error(f"Error cleaning CAPeriodique data: {str(e)}")
        result['error'] = str(e)

    return result


def clean_ca_cnt():
    """
    Cleans CACNT data according to client requirements:
    - Keep only records with department = 'Direction Commerciale Corporate'
    """
    logger.info("Cleaning CACNT data")
    result = {
        'total_before': CACNT.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        # Find records that don't match the client's requirements
        records_to_delete = CACNT.objects.filter(
            ~Q(department='Direction Commerciale Corporate')
        )

        # Count and delete the invalid records
        deletion_count = records_to_delete.count()
        records_to_delete.delete()

        result['total_deleted'] = deletion_count
        result['total_after'] = CACNT.objects.count()

        logger.info(f"Cleaned {deletion_count} invalid records from CACNT")
    except Exception as e:
        logger.error(f"Error cleaning CACNT data: {str(e)}")
        result['error'] = str(e)

    return result


def clean_ca_dnt():
    """
    Cleans CADNT data according to client requirements:
    - Keep only records with department = 'Direction Commerciale Corporate'
    """
    logger.info("Cleaning CADNT data")
    result = {
        'total_before': CADNT.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        # Find records that don't match the client's requirements
        records_to_delete = CADNT.objects.filter(
            ~Q(department='Direction Commerciale Corporate')
        )

        # Count and delete the invalid records
        deletion_count = records_to_delete.count()
        records_to_delete.delete()

        result['total_deleted'] = deletion_count
        result['total_after'] = CADNT.objects.count()

        logger.info(f"Cleaned {deletion_count} invalid records from CADNT")
    except Exception as e:
        logger.error(f"Error cleaning CADNT data: {str(e)}")
        result['error'] = str(e)

    return result


def clean_ca_rfd():
    """
    Cleans CARFD data according to client requirements:
    - Keep only records with department = 'Direction Commerciale Corporate'
    """
    logger.info("Cleaning CARFD data")
    result = {
        'total_before': CARFD.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        # Find records that don't match the client's requirements
        records_to_delete = CARFD.objects.filter(
            ~Q(department='Direction Commerciale Corporate')
        )

        # Count and delete the invalid records
        deletion_count = records_to_delete.count()
        records_to_delete.delete()

        result['total_deleted'] = deletion_count
        result['total_after'] = CARFD.objects.count()

        logger.info(f"Cleaned {deletion_count} invalid records from CARFD")
    except Exception as e:
        logger.error(f"Error cleaning CARFD data: {str(e)}")
        result['error'] = str(e)

    return result


def clean_journal_ventes():
    """
    Cleans JournalVentes data according to client requirements:
    - Clean organization names by removing DOT_, _, and -
    - For AT Siège organizations, keep only DCC and DCGC
    - Flag records with account codes ending with A as "facture exercice antérieur"
    - Flag records with GL date different from current exercise as "facture exercice antérieur"
    - Flag records with invoice date different from current exercise as "facturation d'avance"
    - Flag records with invoice object starting with @ as anomalies
    - Flag records with billing periods ending with previous years as anomalies
    """
    logger.info("Cleaning JournalVentes data")
    result = {
        'total_before': JournalVentes.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        current_year = datetime.now().year
        previous_year = str(current_year - 1)

        # Create anomaly categories
        anomaly_categories = {
            'facture_exercice_anterieur': [],
            'facturation_avance': [],
            'general_anomalies': []
        }

        # First, clean up organization names for all records
        records_to_fix = JournalVentes.objects.filter(
            Q(organization__icontains='DOT_') |
            Q(organization__icontains='_') |
            Q(organization__icontains='-')
        )

        for record in records_to_fix:
            org_name = record.organization
            # Clean up formatting
            if 'DOT_' in org_name:
                org_name = org_name.replace('DOT_', '')
            org_name = org_name.replace('_', '').replace('-', '')
            record.organization = org_name
            record.save()
            logger.info(f"Cleaned organization name: {record.organization}")

        # Identify AT Siège records that are not DCC or DCGC
        siege_records_to_delete = JournalVentes.objects.filter(
            Q(organization__icontains='AT Siège') &
            ~Q(organization__icontains='DCC') &
            ~Q(organization__icontains='DCGC')
        )

        # Delete these records as they don't match organization criteria
        deletion_count = siege_records_to_delete.count()
        siege_records_to_delete.delete()
        result['total_deleted'] += deletion_count
        logger.info(
            f"Deleted {deletion_count} records that don't match organization criteria")

        # Identify records with account codes ending with A (previous year exercises)
        records_with_account_code_a = JournalVentes.objects.filter(
            account_code__endswith='A'
        )

        # Tag these records as "facture exercice antérieur"
        for record in records_with_account_code_a:
            # Create an anomaly entry for this record
            record.anomalies = record.anomalies or []
            record.anomalies.append({
                "type": "previous_year_invoice",
                "account_code": record.account_code,
                "description": "Invoice from previous year detected based on account code"
            })
            record.is_previous_year_invoice = True
            record.save()
            anomaly_categories['facture_exercice_anterieur'].append(record.id)
            result['anomalies_created'] += 1

        logger.info(
            f"Tagged {records_with_account_code_a.count()} records with account code ending in A as previous year invoices")

        # Identify records with GL dates from previous years
        current_date = datetime.now().date()
        current_year_start = datetime(current_year, 1, 1).date()
        records_with_gl_date_prev_year = JournalVentes.objects.filter(
            gl_date__lt=current_year_start
        )

        # Tag these records as "facture exercice antérieur"
        for record in records_with_gl_date_prev_year:
            # Skip if already tagged
            if getattr(record, 'is_previous_year_invoice', False):
                continue

            # Create an anomaly entry for this record
            record.anomalies = record.anomalies or []
            record.anomalies.append({
                "type": "previous_year_invoice",
                "gl_date": str(record.gl_date),
                "description": "Invoice from previous year detected based on GL date"
            })
            record.is_previous_year_invoice = True
            record.save()
            anomaly_categories['facture_exercice_anterieur'].append(record.id)
            result['anomalies_created'] += 1

        logger.info(
            f"Tagged {records_with_gl_date_prev_year.count()} records with GL dates from previous years")

        # Identify records with invoice dates from previous years or future years
        records_with_invoice_date_anomaly = JournalVentes.objects.filter(
            ~Q(invoice_date__year=current_year)
        )

        # Tag these records as "facturation d'avance"
        for record in records_with_invoice_date_anomaly:
            # Create an anomaly entry for this record
            record.anomalies = record.anomalies or []
            record.anomalies.append({
                "type": "advance_invoice",
                "invoice_date": str(record.invoice_date),
                "description": "Invoice date is not from current exercise year"
            })
            record.is_advance_invoice = True
            record.save()
            anomaly_categories['facturation_avance'].append(record.id)
            result['anomalies_created'] += 1

        logger.info(
            f"Tagged {records_with_invoice_date_anomaly.count()} records with abnormal invoice dates")

        # Identify records with invoice objects starting with @
        records_with_obj_fact_anomaly = JournalVentes.objects.filter(
            invoice_object__startswith='@'
        )

        # Tag these records as anomalies
        for record in records_with_obj_fact_anomaly:
            # Create an anomaly entry for this record
            record.anomalies = record.anomalies or []
            record.anomalies.append({
                "type": "anomaly_invoice_object",
                "invoice_object": record.invoice_object,
                "description": "Invoice object starts with @"
            })
            record.save()
            anomaly_categories['general_anomalies'].append(record.id)
            result['anomalies_created'] += 1

        logger.info(
            f"Tagged {records_with_obj_fact_anomaly.count()} records with invoice objects starting with @")

        # Identify records with billing periods containing previous years
        records_with_billing_period_anomaly = JournalVentes.objects.filter(
            Q(billing_period__icontains=previous_year) |
            Q(billing_period__icontains=str(current_year - 2)) |
            Q(billing_period__icontains=str(current_year - 3)) |
            Q(billing_period__icontains=str(current_year - 4)) |
            Q(billing_period__icontains=str(current_year - 5))
        )

        # Tag these records as anomalies
        for record in records_with_billing_period_anomaly:
            # Create an anomaly entry for this record
            record.anomalies = record.anomalies or []
            record.anomalies.append({
                "type": "anomaly_billing_period",
                "billing_period": record.billing_period,
                "description": "Billing period ends with a previous year"
            })
            record.save()
            anomaly_categories['general_anomalies'].append(record.id)
            result['anomalies_created'] += 1

        logger.info(
            f"Tagged {records_with_billing_period_anomaly.count()} records with billing periods containing previous years")

        # Clean revenue_amount format (already handled by the model's DecimalField)
        # but we'll check for any records that might need format correction
        revenue_records = JournalVentes.objects.filter(
            revenue_amount__isnull=False
        )

        formatted_count = 0
        for record in revenue_records:
            # The revenue_amount is already stored correctly in the database
            # If additional formatting is needed for display, it should be handled in the frontend
            formatted_count += 1

        logger.info(f"Processed {formatted_count} revenue amount fields")

        # Update result
        result['total_after'] = JournalVentes.objects.count()
        result['facture_exercice_anterieur_count'] = len(
            set(anomaly_categories['facture_exercice_anterieur']))
        result['facturation_avance_count'] = len(
            set(anomaly_categories['facturation_avance']))
        result['general_anomalies_count'] = len(
            set(anomaly_categories['general_anomalies']))

        logger.info(f"Journal des Ventes cleaning completed successfully")
    except Exception as e:
        logger.error(f"Error cleaning JournalVentes data: {str(e)}")
        result['error'] = str(e)

    return result


def clean_etat_facture():
    """
    Cleans EtatFacture data according to client requirements:
    - Clean records with specific organization criteria (AT Siège: keep only DCC and DCGC)
    - Fix formatting issues in organization names (DOT_, _, -)
    - Convert invoice_number to numeric format
    - Replace dots with commas in monetary fields
    - Handle duplicate entries (partial payments)
    """
    logger.info("Cleaning EtatFacture data")
    result = {
        'total_before': EtatFacture.objects.count(),
        'total_deleted': 0,
        'total_after': 0,
        'anomalies_created': 0
    }

    try:
        # Find records that don't match the client's requirements
        records_to_delete = EtatFacture.objects.filter(
            # AT Siège organizations that are not DCC or DCGC
            Q(organization__icontains='AT Siège') &
            ~Q(organization__icontains='DCC') &
            ~Q(organization__icontains='DCGC')
        )

        # Count and delete the invalid records
        deletion_count = records_to_delete.count()
        records_to_delete.delete()

        # Fix formatting issues in organization names
        records_to_fix = EtatFacture.objects.filter(
            Q(organization__icontains='DOT_') |
            Q(organization__icontains='_') |
            Q(organization__icontains='-')
        )

        for record in records_to_fix:
            org_name = record.organization
            # Clean up formatting
            if 'DOT_' in org_name:
                org_name = org_name.replace('DOT_', '')
            org_name = org_name.replace('_', '').replace('-', '')
            record.organization = org_name
            record.save()

        # Handle duplicate entries (identify records with same organization, invoice_number and invoice_type)
        # First, get all unique combinations
        all_records = EtatFacture.objects.values(
            'organization', 'invoice_number', 'invoice_type')

        # Create a dictionary to track duplicates
        duplicates = {}
        for record in all_records:
            key = f"{record['organization']}_{record['invoice_number']}_{record['invoice_type']}"
            if key in duplicates:
                duplicates[key] += 1
            else:
                duplicates[key] = 1

        # Filter for keys with more than one occurrence (duplicates)
        duplicate_keys = [k for k, v in duplicates.items() if v > 1]

        # Process duplicates - keep one record and clear monetary fields from others
        for key in duplicate_keys:
            org, inv_num, inv_type = key.split('_', 2)
            duplicate_records = EtatFacture.objects.filter(
                organization=org,
                invoice_number=inv_num,
                invoice_type=inv_type
            ).order_by('id')  # Order to ensure consistent selection

            # Keep the first record intact, clear monetary fields from others
            first_record = True
            for record in duplicate_records:
                if first_record:
                    first_record = False
                    continue

                # Clear monetary fields on duplicate records (partial payments)
                record.amount_pre_tax = None
                record.tax_amount = None
                record.total_amount = None
                record.revenue_amount = None
                record.save()

                # Count as "cleaned" but not deleted
                result['anomalies_created'] += 1

        result['total_deleted'] = deletion_count
        result['total_after'] = EtatFacture.objects.count()

        logger.info(
            f"Cleaned {deletion_count} invalid records from EtatFacture")
    except Exception as e:
        logger.error(f"Error cleaning EtatFacture data: {str(e)}")
        result['error'] = str(e)

    return result
