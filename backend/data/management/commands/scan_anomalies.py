from django.core.management.base import BaseCommand
from django.utils import timezone
from data.models import Invoice
from data.anomaly_scanner import DatabaseAnomalyScanner
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Run the database anomaly scanner'

    def add_arguments(self, parser):
        parser.add_argument(
            '--invoice-id',
            type=int,
            help='Optional invoice ID to limit the scan to a specific invoice',
        )

    def handle(self, *args, **options):
        try:
            # Get start time
            start_time = timezone.now()

            # Initialize scanner
            scanner = DatabaseAnomalyScanner()

            # Get specific invoice if ID provided
            invoice = None
            if options['invoice_id']:
                try:
                    invoice = Invoice.objects.get(id=options['invoice_id'])
                    self.stdout.write(f"Scanning invoice {invoice.id}")
                except Invoice.DoesNotExist:
                    self.stderr.write(
                        f"Invoice with ID {options['invoice_id']} not found")
                    return

            # Run the scan
            self.stdout.write("Starting anomaly scan...")
            anomalies = scanner.scan_all(invoice=invoice)

            # Calculate duration
            duration = (timezone.now() - start_time).total_seconds()

            # Print results
            self.stdout.write(self.style.SUCCESS(
                f"\nScan completed in {duration:.2f} seconds"
            ))
            self.stdout.write(f"Found {len(anomalies)} anomalies")

            # Print anomaly summary
            if anomalies:
                self.stdout.write("\nAnomaly Summary:")
                anomaly_types = {}
                for anomaly in anomalies:
                    anomaly_types[anomaly.type] = anomaly_types.get(
                        anomaly.type, 0) + 1

                for anomaly_type, count in anomaly_types.items():
                    self.stdout.write(f"- {anomaly_type}: {count}")

        except Exception as e:
            self.stderr.write(f"Error during scan: {str(e)}")
            logger.exception("Error during anomaly scan")
