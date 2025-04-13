import os
from django.core.management.base import BaseCommand
from data.models import Invoice
from django.db.models import Q
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Cleans up invoice records that point to missing files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without making changes to see what would be affected',
        )
        parser.add_argument(
            '--mark-failed',
            action='store_true',
            help='Instead of deleting records, mark them as failed',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Only clean up invoices for a specific user ID',
        )
        parser.add_argument(
            '--status',
            type=str,
            help='Only clean up invoices with a specific status',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        mark_failed = options.get('mark_failed', False)
        user_id = options.get('user_id')
        status = options.get('status')

        self.stdout.write(self.style.NOTICE(
            'Starting cleanup of invoice records with missing files...'
        ))

        # Build the base queryset
        queryset = Invoice.objects.all()

        # Apply filters if specified
        if user_id:
            queryset = queryset.filter(uploaded_by_id=user_id)
        if status:
            queryset = queryset.filter(status=status)

        # Count before filtering
        total_invoices = queryset.count()
        self.stdout.write(self.style.NOTICE(
            f'Found {total_invoices} invoice records in total'
        ))

        # Initialize counters
        missing_file_count = 0
        processed_count = 0

        # Process each invoice
        for invoice in queryset:
            processed_count += 1

            # Show progress every 100 records
            if processed_count % 100 == 0:
                self.stdout.write(self.style.NOTICE(
                    f'Processed {processed_count}/{total_invoices} invoices...'
                ))

            # Check if file exists
            file_missing = False
            try:
                if not invoice.file or not os.path.exists(invoice.file.path):
                    file_missing = True
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f'Error checking file for invoice {invoice.id}: {str(e)}'
                ))
                file_missing = True

            if file_missing:
                missing_file_count += 1

                if dry_run:
                    self.stdout.write(self.style.WARNING(
                        f'[DRY RUN] Would process invoice {invoice.id} - {invoice.invoice_number} (Status: {invoice.status})'
                    ))
                else:
                    if mark_failed:
                        # Mark the invoice as failed
                        invoice.status = 'failed'
                        invoice.error_message = 'File not found on disk'
                        invoice.save()
                        self.stdout.write(self.style.SUCCESS(
                            f'Marked invoice {invoice.id} - {invoice.invoice_number} as failed'
                        ))
                    else:
                        # Delete the invoice
                        invoice_number = invoice.invoice_number
                        invoice.delete()
                        self.stdout.write(self.style.SUCCESS(
                            f'Deleted invoice {invoice_number} from database'
                        ))

        # Final summary
        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f'[DRY RUN] Found {missing_file_count} invoices with missing files out of {total_invoices} total'
            ))
        else:
            action = 'Marked as failed' if mark_failed else 'Deleted'
            self.stdout.write(self.style.SUCCESS(
                f'{action} {missing_file_count} invoices with missing files out of {total_invoices} total'
            ))
