from datetime import datetime
from django.db.models import Q
from data.models import JournalVentes
from data.cleanup_methods import clean_journal_ventes
import os
import sys
import django
import logging

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
django.setup()


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_filters():
    """Test the filters used in the clean_journal_ventes function"""
    current_year = datetime.now().year
    previous_year = str(current_year - 1)

    logger.info(
        f"Current year: {current_year}, Previous year: {previous_year}")
    logger.info(f"Total records: {JournalVentes.objects.count()}")

    # Test each filter separately
    records_with_at_siege = JournalVentes.objects.filter(
        Q(organization__icontains='AT Siège') &
        ~Q(organization__icontains='DCC') &
        ~Q(organization__icontains='DCGC')
    ).count()
    logger.info(
        f"Records with AT Siège (not DCC or DCGC): {records_with_at_siege}")

    records_with_account_code_a = JournalVentes.objects.filter(
        account_code__endswith='A'
    ).count()
    logger.info(
        f"Records with account_code ending in A: {records_with_account_code_a}")

    records_with_gl_date_prev_year = JournalVentes.objects.filter(
        gl_date__year__lt=current_year
    ).count()
    logger.info(
        f"Records with gl_date from previous years: {records_with_gl_date_prev_year}")

    records_with_billing_period_prev_year = JournalVentes.objects.filter(
        Q(billing_period__icontains=previous_year) |
        Q(billing_period__icontains=str(current_year - 2)) |
        Q(billing_period__icontains=str(current_year - 3)) |
        Q(billing_period__icontains=str(current_year - 4)) |
        Q(billing_period__icontains=str(current_year - 5))
    ).count()
    logger.info(
        f"Records with billing_period containing previous years: {records_with_billing_period_prev_year}")

    # Test the combined filter
    records_to_delete = JournalVentes.objects.filter(
        Q(
            Q(organization__icontains='AT Siège') &
            ~Q(organization__icontains='DCC') &
            ~Q(organization__icontains='DCGC')
        ) |
        Q(account_code__endswith='A') |
        Q(gl_date__year__lt=current_year) |
        Q(billing_period__icontains=previous_year) |
        Q(billing_period__icontains=str(current_year - 2)) |
        Q(billing_period__icontains=str(current_year - 3)) |
        Q(billing_period__icontains=str(current_year - 4)) |
        Q(billing_period__icontains=str(current_year - 5))
    ).count()
    logger.info(
        f"Total records to delete (combined filter): {records_to_delete}")


def run_cleanup():
    """Run the clean_journal_ventes function and print the result"""
    logger.info("Running clean_journal_ventes...")
    result = clean_journal_ventes()
    logger.info(f"Result: {result}")

    # Check if records were actually deleted
    logger.info(f"Records after cleanup: {JournalVentes.objects.count()}")


if __name__ == "__main__":
    logger.info("Starting test script...")
    test_filters()
    logger.info("-" * 50)
    run_cleanup()
    logger.info("Test completed.")
