import os
import logging
import time
from django.core.management.base import BaseCommand
from django.core.cache import cache
from data.models import Invoice, ProgressTracker
from django.db import connection

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Diagnoses issues with bulk processing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--task-id',
            type=str,
            help='Task ID of a specific bulk processing task to diagnose',
            required=False
        )
        parser.add_argument(
            '--check-files',
            action='store_true',
            help='Check if invoice files exist on disk',
        )
        parser.add_argument(
            '--check-db',
            action='store_true',
            help='Check database connections and performance',
        )
        parser.add_argument(
            '--check-memory',
            action='store_true',
            help='Check memory usage during processing',
        )
        parser.add_argument(
            '--fix-status',
            action='store_true',
            help='Fix status of stuck invoices in processing state',
        )

    def handle(self, *args, **options):
        task_id = options.get('task_id')
        check_files = options.get('check_files', False)
        check_db = options.get('check_db', False)
        check_memory = options.get('check_memory', False)
        fix_status = options.get('fix_status', False)

        self.stdout.write(self.style.NOTICE(
            "Starting bulk processing diagnosis..."))

        # If no specific checks are requested, run all of them
        if not any([check_files, check_db, check_memory, fix_status]):
            check_files = check_db = check_memory = fix_status = True

        # Check cache for a specific task ID
        if task_id:
            self.check_task_status(task_id)

        # Check for invoice files existence
        if check_files:
            self.check_invoice_files()

        # Check database connections
        if check_db:
            self.check_database()

        # Check memory usage
        if check_memory:
            self.check_memory_usage()

        # Fix stuck invoices
        if fix_status:
            self.fix_stuck_invoices()

        self.stdout.write(self.style.SUCCESS("Diagnosis complete."))

    def check_task_status(self, task_id):
        """Check the status of a specific bulk processing task"""
        self.stdout.write(self.style.NOTICE(
            f"Checking status of task {task_id}..."))

        # Get the progress from cache
        progress = cache.get(f"bulk_processing_progress_{task_id}")
        if not progress:
            self.stdout.write(self.style.ERROR(
                f"Task {task_id} not found in cache or has expired."))
            return

        # Display task details
        self.stdout.write(self.style.SUCCESS(
            f"Task status: {progress.get('status', 'unknown')}"))
        self.stdout.write(self.style.SUCCESS(
            f"Progress: {progress.get('progress', 0)}%"))
        self.stdout.write(self.style.SUCCESS(
            f"Message: {progress.get('message', 'No message')}"))
        self.stdout.write(self.style.SUCCESS(
            f"Total invoices: {progress.get('total_invoices', 0)}"))
        self.stdout.write(self.style.SUCCESS(
            f"Completed: {progress.get('completed_invoices', 0)}"))
        self.stdout.write(self.style.SUCCESS(
            f"Failed: {progress.get('failed_invoices', 0)}"))

        # Show details of failed invoices
        invoice_statuses = progress.get('invoice_statuses', {})
        failed_invoices = {id: status for id, status in invoice_statuses.items()
                           if status.get('status') == 'failed'}

        if failed_invoices:
            self.stdout.write(self.style.ERROR(
                f"Found {len(failed_invoices)} failed invoices:"))
            for invoice_id, status in failed_invoices.items():
                self.stdout.write(self.style.ERROR(
                    f"Invoice {invoice_id}: {status.get('message', 'No error message')}"
                ))

    def check_invoice_files(self):
        """Check if invoice files exist on disk"""
        self.stdout.write(self.style.NOTICE("Checking invoice files..."))

        # Get invoices that might be in a processing state
        processing_invoices = Invoice.objects.filter(
            status__in=['pending', 'processing'])

        missing_files = []
        for invoice in processing_invoices:
            try:
                if not os.path.exists(invoice.file.path):
                    missing_files.append(invoice)
            except:
                missing_files.append(invoice)

        if missing_files:
            self.stdout.write(self.style.ERROR(
                f"Found {len(missing_files)} invoices with missing files:"
            ))
            for invoice in missing_files:
                self.stdout.write(self.style.ERROR(
                    f"Invoice {invoice.id} ({invoice.invoice_number}): File doesn't exist"
                ))
        else:
            self.stdout.write(self.style.SUCCESS("All invoice files exist."))

    def check_database(self):
        """Check database connections and performance"""
        self.stdout.write(self.style.NOTICE(
            "Checking database connections..."))

        # Check if we can execute a simple query
        try:
            with connection.cursor() as cursor:
                start_time = time.time()
                cursor.execute("SELECT 1")
                end_time = time.time()

            query_time = end_time - start_time
            self.stdout.write(self.style.SUCCESS(
                f"Database connection is working. Query time: {query_time:.5f} seconds"
            ))

            # Check number of connections
            with connection.cursor() as cursor:
                cursor.execute("SELECT count(*) FROM pg_stat_activity")
                connection_count = cursor.fetchone()[0]

            self.stdout.write(self.style.SUCCESS(
                f"Current database connections: {connection_count}"
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Database error: {str(e)}"))

    def check_memory_usage(self):
        """Check memory usage"""
        self.stdout.write(self.style.NOTICE("Checking memory usage..."))

        try:
            import psutil

            # Get memory usage
            process = psutil.Process(os.getpid())
            memory_info = process.memory_info()

            self.stdout.write(self.style.SUCCESS(
                f"Memory usage: {memory_info.rss / (1024 * 1024):.2f} MB"
            ))

            # System memory
            system_memory = psutil.virtual_memory()
            self.stdout.write(self.style.SUCCESS(
                f"System memory: {system_memory.total / (1024 * 1024 * 1024):.2f} GB total, "
                f"{system_memory.available / (1024 * 1024 * 1024):.2f} GB available, "
                f"{system_memory.percent}% used"
            ))

        except ImportError:
            self.stdout.write(self.style.WARNING(
                "Could not check memory usage. The 'psutil' package is not installed."
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"Error checking memory: {str(e)}"))

    def fix_stuck_invoices(self):
        """Fix invoices that are stuck in processing state"""
        self.stdout.write(self.style.NOTICE(
            "Finding and fixing stuck invoices..."))

        # Find invoices that have been in processing state for a long time
        stuck_invoices = Invoice.objects.filter(
            status='processing'
        )

        if not stuck_invoices:
            self.stdout.write(self.style.SUCCESS("No stuck invoices found."))
            return

        self.stdout.write(self.style.WARNING(
            f"Found {stuck_invoices.count()} invoices stuck in processing state"
        ))

        for invoice in stuck_invoices:
            # Check if there's a progress tracker for this invoice
            trackers = ProgressTracker.objects.filter(
                invoice=invoice,
                status__in=['pending', 'in_progress']
            )

            if trackers.exists():
                for tracker in trackers:
                    self.stdout.write(self.style.WARNING(
                        f"Marking tracker {tracker.id} for invoice {invoice.id} as failed"
                    ))
                    tracker.status = 'failed'
                    tracker.message = 'Marked as failed by diagnostic tool'
                    tracker.save()

            # Mark the invoice as failed
            self.stdout.write(self.style.WARNING(
                f"Marking invoice {invoice.id} ({invoice.invoice_number}) as failed"
            ))
            invoice.status = 'failed'
            invoice.error_message = 'Invoice processing was stuck and was reset by diagnostic tool'
            invoice.save()

        self.stdout.write(self.style.SUCCESS(
            f"Reset {stuck_invoices.count()} stuck invoices to failed state."
        ))
