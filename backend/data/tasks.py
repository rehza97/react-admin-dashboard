from celery import shared_task
from .views import DatabaseAnomalyScanner
import logging

logger = logging.getLogger(__name__)


@shared_task
def scan_database_for_anomalies(scan_types=None, invoice_id=None):
    """
    Celery task to scan the database for anomalies

    Args:
        scan_types: Optional list of specific scan types to run
        invoice_id: Optional ID of a specific invoice to scan

    Returns:
        Dict with scan results
    """
    try:
        scanner = DatabaseAnomalyScanner()

        # Get specific invoice if ID provided
        invoice = None
        if invoice_id:
            from .models import Invoice
            try:
                invoice = Invoice.objects.get(id=invoice_id)
            except Invoice.DoesNotExist:
                logger.error(f"Invoice with ID {invoice_id} not found")
                return {"error": f"Invoice with ID {invoice_id} not found"}

        # Run specific scans or all scans
        if scan_types:
            anomalies = []
            for scan_type in scan_types:
                scan_method = getattr(scanner, f"scan_{scan_type}", None)
                if scan_method and callable(scan_method):
                    scan_method()
            anomalies = scanner.anomalies
        else:
            # Run all scans
            anomalies = scanner.scan_all(invoice=invoice)

        # Return results (but not the full serialized anomalies to avoid memory issues)
        return {
            'message': f'Scan completed. Detected {len(anomalies)} anomalies.',
            'anomaly_count': len(anomalies),
            'anomaly_ids': [a.id for a in anomalies]
        }
    except Exception as e:
        logger.error(f"Error during anomaly scan task: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {"error": str(e)}
