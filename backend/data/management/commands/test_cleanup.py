import logging
from django.core.management.base import BaseCommand
from django.db.models import Q
from datetime import datetime
from data.cleanup_methods import clean_journal_ventes
from data.models import JournalVentes

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Test the Journal des Ventes cleanup function'

    def handle(self, *args, **options):
        self.stdout.write('Starting cleanup test...')
        self.test_filters()
        self.stdout.write('-' * 50)
        self.run_cleanup()
        self.stdout.write('Test completed.')

    def test_filters(self):
        """Test the filters used in the clean_journal_ventes function"""
        current_year = datetime.now().year
        previous_year = str(current_year - 1)

        self.stdout.write(
            f"Current year: {current_year}, Previous year: {previous_year}")
        self.stdout.write(f"Total records: {JournalVentes.objects.count()}")

        # Test each filter separately
        records_with_at_siege = JournalVentes.objects.filter(
            Q(organization__icontains='AT Siège') &
            ~Q(organization__icontains='DCC') &
            ~Q(organization__icontains='DCGC')
        ).count()
        self.stdout.write(
            f"Records with AT Siège (not DCC or DCGC): {records_with_at_siege}")

        records_with_account_code_a = JournalVentes.objects.filter(
            account_code__endswith='A'
        ).count()
        self.stdout.write(
            f"Records with account_code ending in A: {records_with_account_code_a}")

        records_with_gl_date_prev_year = JournalVentes.objects.filter(
            gl_date__year__lt=current_year
        ).count()
        self.stdout.write(
            f"Records with gl_date from previous years: {records_with_gl_date_prev_year}")

        records_with_billing_period_prev_year = JournalVentes.objects.filter(
            Q(billing_period__icontains=previous_year) |
            Q(billing_period__icontains=str(current_year - 2)) |
            Q(billing_period__icontains=str(current_year - 3)) |
            Q(billing_period__icontains=str(current_year - 4)) |
            Q(billing_period__icontains=str(current_year - 5))
        ).count()
        self.stdout.write(
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
        self.stdout.write(
            f"Total records to delete (combined filter): {records_to_delete}")

        # Check a few individual records to see if they match filters
        sample_records = JournalVentes.objects.all()[:5]
        for record in sample_records:
            self.stdout.write(f"\nSample record: ID {record.id}")
            self.stdout.write(f"organization: '{record.organization}'")
            self.stdout.write(f"account_code: '{record.account_code}'")
            self.stdout.write(f"gl_date: {record.gl_date}")
            self.stdout.write(f"billing_period: '{record.billing_period}'")

            # Check if this record would be deleted
            matches_filter = JournalVentes.objects.filter(
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
                Q(billing_period__icontains=str(current_year - 5)),
                id=record.id
            ).exists()
            self.stdout.write(f"Would be deleted: {matches_filter}")

    def run_cleanup(self):
        """Run the clean_journal_ventes function and print the result"""
        self.stdout.write("Running clean_journal_ventes...")
        result = clean_journal_ventes()
        self.stdout.write(f"Result: {result}")

        # Check if records were actually deleted
        self.stdout.write(
            f"Records after cleanup: {JournalVentes.objects.count()}")
