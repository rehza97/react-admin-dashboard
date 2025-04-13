import logging
from django.core.management.base import BaseCommand
from django.db.models import Count
from django.db import connections
from data.models import (
    Invoice, ProgressTracker, JournalVentes,
    EtatFacture, ParcCorporate, DOT
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Checks and reports on bulk processing compatibility with current models'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Fix issues automatically where possible',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show more detailed information',
        )

    def handle(self, *args, **options):
        fix = options.get('fix', False)
        verbose = options.get('verbose', False)

        self.stdout.write(self.style.NOTICE(
            "Starting bulk processing compatibility check..."))

        # Check database connection
        self.check_db_connection()

        # Check model fields for compatibility
        self.check_model_compatibility(fix, verbose)

        # Check for stuck processing records
        self.check_stuck_processing(fix, verbose)

        # Check DOT references
        self.check_dot_references(fix, verbose)

        self.stdout.write(self.style.SUCCESS("Check completed."))

    def check_db_connection(self):
        """Check if database connection is working properly"""
        self.stdout.write(self.style.NOTICE("Checking database connection..."))

        try:
            connection = connections['default']
            connection.cursor()
            self.stdout.write(self.style.SUCCESS(
                "Database connection successful."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"Database connection failed: {str(e)}"))

    def check_model_compatibility(self, fix, verbose):
        """Check model fields compatibility with bulk processor"""
        self.stdout.write(self.style.NOTICE("Checking model compatibility..."))

        # Check ParcCorporate for dot_code field
        try:
            # Try to create a test object with all valid fields
            test_invoice = Invoice.objects.first()
            if test_invoice:
                # Test ParcCorporate
                pc_fields = {
                    'invoice': test_invoice,
                    'actel_code': 'TEST',
                    'state': 'TEST'
                }

                # Add common extra fields that might cause issues
                for field in ['dot', 'dot_code']:
                    pc_fields_test = pc_fields.copy()
                    pc_fields_test[field] = 'TEST'
                    try:
                        ParcCorporate.objects.create(**pc_fields_test)
                        self.stdout.write(self.style.WARNING(
                            f"ParcCorporate: Field '{field}' was accepted unexpectedly"
                        ))
                    except Exception as e:
                        if 'dot_code' in str(e) or 'dot' in str(e):
                            self.stdout.write(self.style.SUCCESS(
                                f"ParcCorporate: Field '{field}' correctly throws an error"
                            ))
                        else:
                            self.stdout.write(self.style.ERROR(
                                f"ParcCorporate: Unexpected error testing field '{field}': {str(e)}"
                            ))

                # Test EtatFacture
                ef_fields = {
                    'invoice': test_invoice,
                    'invoice_number': 'TEST',
                }

                # Add common extra fields that might cause issues
                for field in ['dot', 'dot_code']:
                    ef_fields_test = ef_fields.copy()
                    ef_fields_test[field] = 'TEST'
                    try:
                        EtatFacture.objects.create(**ef_fields_test)
                        self.stdout.write(self.style.WARNING(
                            f"EtatFacture: Field '{field}' was accepted unexpectedly"
                        ))
                    except Exception as e:
                        if 'dot_code' in str(e) or 'dot' in str(e):
                            self.stdout.write(self.style.SUCCESS(
                                f"EtatFacture: Field '{field}' correctly throws an error"
                            ))
                        else:
                            self.stdout.write(self.style.ERROR(
                                f"EtatFacture: Unexpected error testing field '{field}': {str(e)}"
                            ))

                # Test JournalVentes
                jv_fields = {
                    'invoice': test_invoice,
                    'invoice_number': 'TEST',
                }

                # Add common extra fields that might cause issues
                for field in ['dot', 'dot_code']:
                    jv_fields_test = jv_fields.copy()
                    jv_fields_test[field] = 'TEST'
                    try:
                        JournalVentes.objects.create(**jv_fields_test)
                        self.stdout.write(self.style.WARNING(
                            f"JournalVentes: Field '{field}' was accepted unexpectedly"
                        ))
                    except Exception as e:
                        if 'dot_code' in str(e) or 'dot' in str(e):
                            self.stdout.write(self.style.SUCCESS(
                                f"JournalVentes: Field '{field}' correctly throws an error"
                            ))
                        else:
                            self.stdout.write(self.style.ERROR(
                                f"JournalVentes: Unexpected error testing field '{field}': {str(e)}"
                            ))
            else:
                self.stdout.write(self.style.WARNING(
                    "No invoices found for testing field compatibility"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"Error checking model compatibility: {str(e)}"))

    def check_stuck_processing(self, fix, verbose):
        """Check for invoices stuck in processing state"""
        self.stdout.write(self.style.NOTICE(
            "Checking for stuck processing invoices..."))

        stuck_invoices = Invoice.objects.filter(status='processing')
        count = stuck_invoices.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No stuck invoices found."))
            return

        self.stdout.write(self.style.WARNING(
            f"Found {count} invoices stuck in processing state"))

        # Show details if verbose
        if verbose:
            for invoice in stuck_invoices:
                self.stdout.write(self.style.WARNING(
                    f"Invoice {invoice.id} ({invoice.invoice_number}) stuck in processing"
                ))

                # Check for trackers
                trackers = ProgressTracker.objects.filter(invoice=invoice)
                if trackers.exists():
                    for tracker in trackers:
                        self.stdout.write(self.style.WARNING(
                            f"  - Tracker {tracker.id}: {tracker.status} - {tracker.message}"
                        ))
                else:
                    self.stdout.write(self.style.WARNING(
                        "  - No progress trackers found for this invoice"
                    ))

        # Fix if requested
        if fix:
            self.stdout.write(self.style.WARNING(
                f"Fixing {count} stuck invoices..."))

            for invoice in stuck_invoices:
                # Update trackers
                trackers = ProgressTracker.objects.filter(
                    invoice=invoice,
                    status__in=['in_progress', 'pending']
                )
                for tracker in trackers:
                    tracker.status = 'failed'
                    tracker.message = 'Marked as failed by compatibility check tool'
                    tracker.save()

                # Update invoice
                invoice.status = 'failed'
                invoice.error_message = 'Processing got stuck and was reset by compatibility check tool'
                invoice.save()

            self.stdout.write(self.style.SUCCESS(
                f"Successfully reset {count} stuck invoices"))

    def check_dot_references(self, fix, verbose):
        """Check DOT references in all models"""
        self.stdout.write(self.style.NOTICE("Checking DOT references..."))

        # Check DOT lengths
        long_codes = DOT.objects.extra(where=["LENGTH(code) > 50"])
        long_count = long_codes.count()

        if long_count > 0:
            self.stdout.write(self.style.WARNING(
                f"Found {long_count} DOT codes longer than 50 characters"
            ))

            if verbose:
                for dot in long_codes:
                    self.stdout.write(self.style.WARNING(
                        f"DOT {dot.id}: {dot.code[:30]}... (length: {len(dot.code)})"
                    ))

            if fix:
                self.stdout.write(self.style.WARNING(
                    f"Truncating {long_count} long DOT codes..."))

                for dot in long_codes:
                    old_code = dot.code
                    dot.code = old_code[:50]
                    dot.save()

                self.stdout.write(self.style.SUCCESS(
                    f"Successfully truncated {long_count} DOT codes"))
        else:
            self.stdout.write(self.style.SUCCESS(
                "No DOT codes longer than 50 characters found."))

        # Check for duplicate DOT codes
        duplicates = DOT.objects.values('code').annotate(
            count=Count('code')).filter(count__gt=1)

        if duplicates.exists():
            self.stdout.write(self.style.WARNING(
                f"Found {duplicates.count()} duplicate DOT codes"
            ))

            if verbose:
                for dup in duplicates:
                    dup_dots = DOT.objects.filter(code=dup['code'])
                    self.stdout.write(self.style.WARNING(
                        f"Code '{dup['code']}' is used by {dup['count']} DOTs: {', '.join([str(d.id) for d in dup_dots])}"
                    ))
        else:
            self.stdout.write(self.style.SUCCESS(
                "No duplicate DOT codes found."))
