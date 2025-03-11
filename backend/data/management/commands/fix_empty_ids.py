from django.core.management.base import BaseCommand
from django.db import transaction
from data.models import YourReceivablesModel  # Replace with your actual model
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Fix empty ID fields in receivables data for 2025'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=str, default='2025',
                            help='Year to fix data for')
        parser.add_argument('--fix', action='store_true',
                            help='Actually fix the data (without this flag, just reports issues)')

    def handle(self, *args, **options):
        year = options['year']
        fix = options['fix']

        # Get all records for the specified year
        queryset = YourReceivablesModel.objects.filter(year=year)

        invalid_count = 0
        fixed_count = 0

        if fix:
            self.stdout.write(self.style.WARNING(
                f"Fixing invalid IDs for year {year}..."))
        else:
            self.stdout.write(self.style.WARNING(
                f"Checking for invalid IDs for year {year} (dry run)..."))

        for index, record in enumerate(queryset):
            if record.id is None or record.id == '' or not str(record.id).isdigit():
                invalid_count += 1

                if fix:
                    try:
                        with transaction.atomic():
                            # Generate a new ID (you may need to adjust this logic)
                            new_id = 900000 + index

                            # Update the record
                            record.id = new_id
                            record.save()
                            fixed_count += 1

                            self.stdout.write(
                                f"Fixed record: old ID '{record.id}' -> new ID '{new_id}'")
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(
                            f"Error fixing record: {str(e)}"))
                else:
                    self.stdout.write(
                        f"Found record with invalid ID: '{record.id}'")

        if fix:
            self.stdout.write(self.style.SUCCESS(
                f"Fixed {fixed_count} of {invalid_count} invalid records for year {year}"))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Found {invalid_count} invalid records for year {year} (run with --fix to repair)"))
