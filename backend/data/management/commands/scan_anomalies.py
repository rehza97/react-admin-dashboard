from django.core.management.base import BaseCommand
from data.views import DatabaseAnomalyScanner
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Scan database for anomalies'

    def add_arguments(self, parser):
        parser.add_argument('--invoice-id', type=int,
                            help='Specific invoice ID to scan')
        parser.add_argument('--scan-types', nargs='+',
                            help='Specific scan types to run. Available types: '
                                 'journal_ventes_duplicates, etat_facture_duplicates, '
                                 'revenue_outliers, collection_outliers, '
                                 'journal_etat_mismatches, zero_values, '
                                 'temporal_patterns, empty_cells')
        parser.add_argument('--data-source', type=str,
                            help='Filter anomalies by data source (e.g., journal_ventes, etat_facture)')

    def handle(self, *args, **options):
        try:
            scanner = DatabaseAnomalyScanner()

            # Get specific invoice if ID provided
            invoice = None
            if options['invoice_id']:
                from data.models import Invoice
                try:
                    invoice = Invoice.objects.get(id=options['invoice_id'])
                    self.stdout.write(
                        f"Scanning invoice: {invoice.invoice_number}")
                except Invoice.DoesNotExist:
                    self.stderr.write(
                        f"Invoice with ID {options['invoice_id']} not found")
                    return

            # Run specific scans or all scans
            if options['scan_types']:
                anomalies = []
                for scan_type in options['scan_types']:
                    self.stdout.write(f"Running scan: {scan_type}")
                    scan_method = getattr(scanner, f"scan_{scan_type}", None)
                    if scan_method and callable(scan_method):
                        scan_method()
                    else:
                        self.stderr.write(f"Unknown scan type: {scan_type}")
                anomalies = scanner.anomalies
            else:
                # Run all scans
                self.stdout.write("Running all scan types")
                anomalies = scanner.scan_all(invoice=invoice)

            # Filter by data source if provided
            if options['data_source']:
                data_source = options['data_source']
                original_count = len(anomalies)
                anomalies = [
                    a for a in anomalies if a.data_source == data_source]
                self.stdout.write(
                    f"Filtered to {len(anomalies)} anomalies from data source '{data_source}' (was {original_count})")

            self.stdout.write(self.style.SUCCESS(
                f'Detected {len(anomalies)} anomalies'
            ))

            # Print summary of detected anomalies
            anomaly_types = {}
            data_sources = {}
            for anomaly in anomalies:
                anomaly_types[anomaly.type] = anomaly_types.get(
                    anomaly.type, 0) + 1
                if anomaly.data_source:
                    data_sources[anomaly.data_source] = data_sources.get(
                        anomaly.data_source, 0) + 1

            for anomaly_type, count in anomaly_types.items():
                self.stdout.write(f"- {anomaly_type}: {count} anomalies")

            if data_sources:
                self.stdout.write("\nAnomaly sources:")
                for source, count in data_sources.items():
                    self.stdout.write(f"- {source}: {count} anomalies")

        except Exception as e:
            import traceback
            self.stderr.write(self.style.ERROR(f"Error during scan: {str(e)}"))
            self.stderr.write(traceback.format_exc())
