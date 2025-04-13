from django.core.management.base import BaseCommand
from data.models import DOT
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Fixes DOT codes that are too long'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-length',
            type=int,
            default=50,
            help='Maximum allowed length for DOT codes',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without making changes to see what would be affected',
        )

    def handle(self, *args, **options):
        max_length = options.get('max_length', 50)
        dry_run = options.get('dry_run', False)

        self.stdout.write(self.style.NOTICE(
            f'Checking for DOT codes longer than {max_length} characters...'
        ))

        # Get all DOT records and filter in Python for those with long codes
        all_dots = DOT.objects.all()
        long_codes = [dot for dot in all_dots if len(dot.code) > max_length]
        count = len(long_codes)

        if count == 0:
            self.stdout.write(self.style.SUCCESS(
                'No DOT codes found that exceed the maximum length.'
            ))
            return

        self.stdout.write(self.style.WARNING(
            f'Found {count} DOT codes that exceed the maximum length.'
        ))

        # Show the problematic codes
        for dot in long_codes:
            self.stdout.write(self.style.WARNING(
                f'DOT {dot.id}: "{dot.code}" (length: {len(dot.code)}) - will be truncated to "{dot.code[:max_length]}"'
            ))

        # Fix the codes if not in dry run mode
        if not dry_run:
            for dot in long_codes:
                old_code = dot.code
                dot.code = old_code[:max_length]
                dot.save()
                self.stdout.write(self.style.SUCCESS(
                    f'Truncated DOT {dot.id} code from "{old_code}" to "{dot.code}"'
                ))

            self.stdout.write(self.style.SUCCESS(
                f'Successfully fixed {count} DOT codes.'
            ))
        else:
            self.stdout.write(self.style.NOTICE(
                '[DRY RUN] No changes made. Run without --dry-run to apply fixes.'
            ))

        # Check for duplicate codes after truncation
        from django.db.models import Count
        duplicates = DOT.objects.values('code').annotate(
            count=Count('code')).filter(count__gt=1)

        if duplicates.exists():
            self.stdout.write(self.style.ERROR(
                f'WARNING: After truncation, there will be {duplicates.count()} duplicate DOT codes:'
            ))

            for dup in duplicates:
                dup_dots = DOT.objects.filter(code=dup['code'])
                self.stdout.write(self.style.ERROR(
                    f'Code: "{dup["code"]}" is used by {dup["count"]} DOTs: {", ".join([str(d.id) for d in dup_dots])}'
                ))

            self.stdout.write(self.style.ERROR(
                'You need to manually resolve these duplicates before proceeding with the migration.'
            ))
