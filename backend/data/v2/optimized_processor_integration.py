"""
Utility module to integrate the OptimizedFileProcessor with the BulkProcessView.
This provides a clean way to adopt the optimized processor without changing the existing code.
"""

import os
import logging
import threading
from concurrent.futures import ThreadPoolExecutor
from django.core.cache import cache
from django.utils import timezone
from django.db import transaction

from ..file_processor import FileProcessor, FileTypeDetector
from .optimized_file_processor import OptimizedFileProcessor
from ..models import ProgressTracker

logger = logging.getLogger(__name__)


class OptimizedBulkProcessor:
    """
    Utility class to integrate the optimized file processor with bulk processing views.
    This acts as a drop-in enhancement for the existing BulkProcessView class.
    """

    @staticmethod
    def process_invoices(invoices, task_id, save_raw_data_method, max_workers=4):
        """
        Process multiple invoices using the optimized file processor

        Args:
            invoices: List of Invoice model instances to process
            task_id: Unique ID for tracking the task
            save_raw_data_method: Method to save the raw data to the database
            max_workers: Maximum number of concurrent threads

        Returns:
            None (runs asynchronously)
        """
        # Set CPU and memory limits
        # By default use 70% of CPU resources
        optimal_max_workers = max(1, int(os.cpu_count() * 0.7))
        max_workers = min(max_workers, optimal_max_workers)

        # Initialize variables for thread tracking
        total_invoices = len(invoices)
        completed_count = 0
        failed_count = 0
        invoice_results = {}

        # Initialize the bulk process progress
        cache.set(f"bulk_processing_progress_{task_id}", {
            'status': 'in_progress',
            'progress': 0,
            'message': f'Processing {total_invoices} invoices with {max_workers} workers',
            'start_time': timezone.now().isoformat(),
            'total_invoices': total_invoices,
            'completed_invoices': 0,
            'failed_invoices': 0,
            'invoice_statuses': {invoice.id: {'status': 'pending', 'progress': 0, 'message': 'Waiting to start'} for invoice in invoices}
        }, timeout=7200)

        # Function to process a single invoice
        def process_single_invoice(invoice):
            nonlocal completed_count, failed_count

            try:
                # Create a progress tracker for this invoice
                progress_tracker = ProgressTracker.objects.create(
                    invoice=invoice,
                    operation_type='process',
                    status='in_progress',
                    progress_percent=0.0,
                    current_item=0,
                    total_items=100,
                    message='Starting file processing'
                )

                # Update invoice status
                invoice.status = 'processing'
                invoice.save()

                # Update bulk processing progress
                current_progress = cache.get(
                    f"bulk_processing_progress_{task_id}")
                if current_progress:
                    current_progress['invoice_statuses'][invoice.id] = {
                        'status': 'processing',
                        'progress': 0,
                        'message': 'Starting file processing'
                    }
                    cache.set(
                        f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                # Get file path
                file_path = invoice.file.path

                # Update progress
                progress_tracker.progress_percent = 5.0
                progress_tracker.message = 'Starting optimized processing'
                progress_tracker.save()

                # Update progress in cache
                _update_cache_progress(
                    task_id, invoice.id, 5, 'Starting optimized processing')

                # Use the optimized file processor
                file_processor = OptimizedFileProcessor()
                file_type_detector = FileTypeDetector()

                # Update progress
                progress_tracker.progress_percent = 10.0
                progress_tracker.message = 'Detecting file type'
                progress_tracker.save()

                # Update progress in cache
                _update_cache_progress(
                    task_id, invoice.id, 10, 'Detecting file type')

                # Detect file type
                file_type, confidence, _ = file_type_detector.detect_file_type(
                    file_path, invoice.file.name
                )

                # Update invoice with file type
                invoice.file_type = file_type
                invoice.detection_confidence = confidence
                invoice.save()

                # Update progress
                progress_tracker.progress_percent = 20.0
                progress_tracker.message = f'File type detected: {file_type}'
                progress_tracker.save()

                # Update progress in cache
                _update_cache_progress(
                    task_id, invoice.id, 20, f'File type detected: {file_type}')

                # Process the file using the optimized processor
                raw_data, summary = OptimizedFileProcessor.process_file(
                    file_path,
                    invoice.file.name
                )

                # Update progress
                progress_tracker.progress_percent = 50.0
                progress_tracker.message = 'Extracted raw data from file'
                progress_tracker.save()

                # Update progress in cache
                _update_cache_progress(
                    task_id, invoice.id, 50, 'Extracted raw data from file')

                # Save the raw data to the database based on file type
                # Use a single transaction for the entire save operation
                with transaction.atomic():
                    save_raw_data_method(invoice, file_type, raw_data)

                # Update progress
                progress_tracker.progress_percent = 90.0
                progress_tracker.message = 'Raw data saved to database'
                progress_tracker.save()

                # Update progress in cache
                _update_cache_progress(
                    task_id, invoice.id, 90, 'Raw data saved to database')

                # Update invoice status
                invoice.status = 'preview'  # Set to preview since it's not cleaned yet
                invoice.processed_date = timezone.now()
                invoice.save()

                # Complete the progress tracker
                progress_tracker.progress_percent = 100.0
                progress_tracker.status = 'completed'
                progress_tracker.message = 'File processing completed successfully'
                progress_tracker.save()

                # Update completion counts and results
                completed_count += 1
                invoice_results[invoice.id] = {
                    'status': 'completed',
                    'message': 'File processing completed successfully',
                    'file_type': file_type,
                    'confidence': confidence
                }

                # Update bulk processing progress
                current_progress = cache.get(
                    f"bulk_processing_progress_{task_id}")
                if current_progress:
                    current_progress['completed_invoices'] = completed_count
                    current_progress['progress'] = (
                        completed_count + failed_count) * 100 / total_invoices
                    current_progress['invoice_statuses'][invoice.id] = {
                        'status': 'completed',
                        'progress': 100,
                        'message': 'File processing completed successfully'
                    }
                    cache.set(
                        f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                return invoice.id, True, None

            except Exception as e:
                logger.error(
                    f"Error processing invoice {invoice.id}: {str(e)}")

                # Update invoice status on error
                invoice.status = 'failed'
                invoice.error_message = str(e)
                invoice.save()

                # Update progress tracker on error if it exists
                try:
                    if 'progress_tracker' in locals():
                        progress_tracker.status = 'failed'
                        progress_tracker.message = f'Error: {str(e)}'
                        progress_tracker.save()
                except Exception:
                    pass

                # Update completion counts and results
                failed_count += 1
                invoice_results[invoice.id] = {
                    'status': 'failed',
                    'message': str(e)
                }

                # Update bulk processing progress
                current_progress = cache.get(
                    f"bulk_processing_progress_{task_id}")
                if current_progress:
                    current_progress['failed_invoices'] = failed_count
                    current_progress['progress'] = (
                        completed_count + failed_count) * 100 / total_invoices
                    current_progress['invoice_statuses'][invoice.id] = {
                        'status': 'failed',
                        'progress': 0,
                        'message': f'Error: {str(e)}'
                    }
                    cache.set(
                        f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

                return invoice.id, False, str(e)

        # Helper function to update cache
        def _update_cache_progress(task_id, invoice_id, progress, message):
            current_progress = cache.get(f"bulk_processing_progress_{task_id}")
            if current_progress:
                current_progress['invoice_statuses'][invoice_id] = {
                    'status': 'processing',
                    'progress': progress,
                    'message': message
                }
                cache.set(
                    f"bulk_processing_progress_{task_id}", current_progress, timeout=7200)

        # Function to run the bulk process with error handling
        def run_bulk_process():
            try:
                # Process all invoices using the thread pool
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    # Submit all invoices to the executor
                    futures = {executor.submit(
                        process_single_invoice, invoice): invoice.id for invoice in invoices}

                    # Wait for all tasks to complete
                    for future in futures:
                        future.result()  # This ensures all exceptions are propagated

                # Complete the bulk processing
                end_time = timezone.now().isoformat()
                cache.set(f"bulk_processing_progress_{task_id}", {
                    'status': 'completed',
                    'progress': 100,
                    'message': f'Completed processing {total_invoices} invoices. Success: {completed_count}, Failed: {failed_count}',
                    'start_time': timezone.now().isoformat(),
                    'end_time': end_time,
                    'total_invoices': total_invoices,
                    'completed_invoices': completed_count,
                    'failed_invoices': failed_count,
                    'invoice_statuses': invoice_results,
                    'optimized_processor': True
                }, timeout=7200)

            except Exception as e:
                logger.error(f"Error in bulk processing: {str(e)}")

                # Update bulk processing status on error
                cache.set(f"bulk_processing_progress_{task_id}", {
                    'status': 'failed',
                    'progress': (completed_count + failed_count) * 100 / total_invoices if total_invoices > 0 else 0,
                    'message': f'Error in bulk processing: {str(e)}',
                    'start_time': timezone.now().isoformat(),
                    'end_time': timezone.now().isoformat(),
                    'total_invoices': total_invoices,
                    'completed_invoices': completed_count,
                    'failed_invoices': failed_count,
                    'invoice_statuses': invoice_results,
                    'optimized_processor': True
                }, timeout=7200)

        # Start the bulk processing thread
        thread = threading.Thread(target=run_bulk_process)
        thread.start()

        return thread


def get_optimized_bulk_processor():
    """
    Factory function to get the optimized bulk processor.
    Used as a convenience method to access the processor.
    """
    return OptimizedBulkProcessor
