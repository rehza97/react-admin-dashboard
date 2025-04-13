# data/export_views.py
# Primary implementation of export views used in URL patterns
# This module is imported in views.py for the ComprehensiveReportExportView

import csv
import io
import os
import threading
import traceback
import uuid
import logging
import time
import shutil
import concurrent.futures
import gc
from django.conf import settings
from openpyxl import Workbook
from rest_framework import status
import xlsxwriter
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils.timezone import now
from .models import (
    Invoice, ProcessedInvoiceData, FacturationManuelle, JournalVentes,
    EtatFacture, ParcCorporate, CreancesNGBSS, CAPeriodique, CANonPeriodique,
    CADNT, CARFD, CACNT, RevenueObjective, CollectionObjective, NGBSSCollection, UnfinishedInvoice, DOT
)
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import letter, landscape, A4, A3, A2
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from .serializers import ParcCorporateSerializer
from rest_framework.viewsets import ViewSet
from reportlab.lib.enums import TA_LEFT, TA_CENTER

# Configure logger
logger = logging.getLogger(__name__)

# Create a directory for storing export files
EXPORT_DIR = os.path.join(settings.MEDIA_ROOT, 'exports')
os.makedirs(EXPORT_DIR, exist_ok=True)

# Export configuration settings
FILE_RETENTION_SECONDS = 120  # 2 minutes
MAX_WORKER_THREADS = 4       # Maximum number of concurrent export worker threads
BATCH_SIZE = 5000            # Records per batch for processing
DATA_PROCESSING_THREADS = 2  # Threads for data processing within each export
TASK_RETENTION_MINUTES = 60  # How long to keep completed tasks in memory
# Seconds between memory cleanup runs (15 minutes)
MEMORY_CLEANUP_INTERVAL = 900

# Dictionary to track export tasks and cleaned up files
export_tasks = {}
cleaned_files = {}  # Maps task_id to cleanup status
last_cleanup_time = time.time()

# ThreadPoolExecutor for managing export threads
export_thread_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=MAX_WORKER_THREADS)

# ThreadPoolExecutor for data processing within exports
data_processing_pool = concurrent.futures.ThreadPoolExecutor(
    max_workers=DATA_PROCESSING_THREADS)


def cleanup_memory():
    """Clean up memory by removing old tasks and forcing garbage collection"""
    global last_cleanup_time

    # Only run cleanup if enough time has passed since last cleanup
    current_time = time.time()
    if current_time - last_cleanup_time < MEMORY_CLEANUP_INTERVAL:
        return

    logger.info("Starting memory cleanup process")
    cleanup_count = 0

    # Get current time for comparison
    now = datetime.now()
    cutoff_time = now - timedelta(minutes=TASK_RETENTION_MINUTES)

    # Cleanup old completed tasks
    tasks_to_remove = []
    for task_id, task in export_tasks.items():
        # Check if task has completion timestamp and is old enough to remove
        if hasattr(task, 'completion_time') and task.completion_time:
            task_time = datetime.fromisoformat(task.completion_time)
            if task_time < cutoff_time:
                tasks_to_remove.append(task_id)
                cleanup_count += 1

    # Remove the old tasks
    for task_id in tasks_to_remove:
        del export_tasks[task_id]

    # Clean up old entries in cleaned_files
    files_to_remove = []
    for task_id, cleanup_info in cleaned_files.items():
        if 'cleaned_at' in cleanup_info:
            try:
                cleaned_time = datetime.fromisoformat(
                    cleanup_info['cleaned_at'])
                if cleaned_time < cutoff_time:
                    files_to_remove.append(task_id)
                    cleanup_count += 1
            except (ValueError, TypeError):
                # If timestamp is invalid, remove it anyway
                files_to_remove.append(task_id)

    # Remove old cleaned files entries
    for task_id in files_to_remove:
        del cleaned_files[task_id]

    # Force garbage collection
    gc.collect()

    # Update last cleanup time
    last_cleanup_time = current_time

    logger.info(
        f"Memory cleanup complete. Removed {cleanup_count} old entries.")
    logger.info(
        f"Remaining tasks: {len(export_tasks)}, Remaining cleanup records: {len(cleaned_files)}")

    # Log memory usage if psutil is available
    try:
        import psutil
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        logger.info(
            f"Current memory usage: {memory_info.rss / 1024 / 1024:.2f} MB")
    except ImportError:
        pass


class FileCleanupThread(threading.Thread):
    """Thread to delete export files after a specified time period"""

    def __init__(self, task_id, file_path, delay_seconds):
        threading.Thread.__init__(self)
        self.daemon = True  # Make thread daemon so it exits when main thread exits
        self.task_id = task_id
        self.file_path = file_path
        self.delay_seconds = delay_seconds

    def run(self):
        try:
            logger.info(
                f"Scheduling deletion of {self.file_path} in {self.delay_seconds} seconds")
            time.sleep(self.delay_seconds)

            if os.path.exists(self.file_path):
                os.remove(self.file_path)
                logger.info(
                    f"Successfully deleted export file: {self.file_path}")
                # Mark file as cleaned up
                cleaned_files[self.task_id] = {
                    "cleaned_at": datetime.now().isoformat(),
                    "original_path": self.file_path
                }
            else:
                logger.warning(
                    f"File not found for deletion: {self.file_path}")

            # Explicitly mark variables for garbage collection
            self.file_path = None

            # Run memory cleanup check
            cleanup_memory()

        except Exception as e:
            logger.error(f"Error during file cleanup: {str(e)}")
            logger.error(traceback.format_exc())


class ExportThread(threading.Thread):
    def __init__(self, task_id, queryset, format_type, filters):
        threading.Thread.__init__(self)
        self.task_id = task_id
        self.queryset = queryset
        self.format_type = format_type
        self.filters = filters
        self.status = "processing"
        self.progress = 0
        self.file_path = None
        self.error = None
        self.data_processing_pool = data_processing_pool  # Use the shared pool
        self.completion_time = None
        self.cancelled = False  # Flag to indicate if the export has been cancelled
        self.row_count = None  # Store the number of rows being exported

    def cancel(self):
        """Cancel the export process"""
        if self.status == "processing":
            self.cancelled = True
            self.status = "cancelled"
            self.error = "Export cancelled by user"
            logger.info(f"Export task {self.task_id} has been cancelled")
            return True
        return False

    def _process_batch(self, batch, format_type):
        """Process a batch of data - can be run in parallel"""
        try:
            # If cancelled, return empty list
            if self.cancelled:
                return []

            # Serialize the batch
            result = ParcCorporateSerializer(batch, many=True).data
            # Clear the batch reference to help with memory cleanup
            batch = None
            return result
        except Exception as e:
            logger.error(f"Error processing batch: {str(e)}")
            return []

    def run(self):
        try:
            # Get total count for progress tracking
            total_count = self.queryset.count()
            self.row_count = total_count  # Store the row count
            batch_size = BATCH_SIZE  # Use the configurable batch size

            # Create timestamp for filename
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

            # Determine the export type based on the queryset model
            model_name = self.queryset.model.__name__ if hasattr(
                self.queryset, 'model') else None

            if model_name == 'CANonPeriodique':
                # Use specialized export for CANonPeriodique
                filename = f'non_periodic_revenue_export_{timestamp}'
                self._export_ca_non_periodique(
                    total_count, batch_size, filename, self.format_type)
            else:
                # Default export for other models (like ParcCorporate)
                filename = f'corporate_park_export_{timestamp}'

                # Process based on format type
                if self.format_type == 'excel':
                    self._export_excel(total_count, batch_size, filename)
                elif self.format_type == 'csv':
                    self._export_csv(total_count, batch_size, filename)
                elif self.format_type == 'pdf':
                    self._export_pdf(total_count, batch_size, filename)
                else:
                    self.error = f"Invalid format: {self.format_type}"
                    self.status = "failed"
                    return

            # Check if export was cancelled during processing
            if self.cancelled:
                self.status = "cancelled"
                # Delete the partial file if it exists
                if self.file_path and os.path.exists(self.file_path):
                    try:
                        os.remove(self.file_path)
                        logger.info(
                            f"Deleted partial export file after cancellation: {self.file_path}")
                    except Exception as e:
                        logger.error(
                            f"Error deleting cancelled export file: {str(e)}")
                return

            # Ensure the file is properly written and verify it exists
            if self.file_path and os.path.exists(self.file_path):
                # Get file size
                file_size = os.path.getsize(self.file_path)

                # Verify the file has content (not empty)
                if file_size == 0:
                    self.error = "Generated file is empty"
                    self.status = "failed"
                    return

                # Force a sync to ensure file is properly written to disk
                os.sync() if hasattr(os, 'sync') else None

                logger.info(
                    f"Export completed successfully: {self.file_path} ({file_size} bytes)")
                self.status = "completed"
                self.progress = 100
                self.completion_time = datetime.now().isoformat()

                # Schedule file cleanup after retention period
                cleanup_thread = FileCleanupThread(
                    self.task_id, self.file_path, FILE_RETENTION_SECONDS)
                cleanup_thread.start()
                logger.info(f"File cleanup scheduled for {self.file_path}")
            else:
                self.error = "File was not created"
                self.status = "failed"

            # Clear queryset reference to help with memory
            self.queryset = None

            # Run memory cleanup
            cleanup_memory()

        except Exception as e:
            logger.error(f"Error during export: {str(e)}")
            logger.error(traceback.format_exc())
            self.error = str(e)
            self.status = "failed"
            self.completion_time = datetime.now().isoformat()

            # Delete partial file if it exists
            if self.file_path and os.path.exists(self.file_path):
                try:
                    os.remove(self.file_path)
                except Exception as file_err:
                    logger.error(
                        f"Error deleting partial file: {str(file_err)}")

    def _export_excel(self, total_count, batch_size, filename):
        # Use xlsxwriter with constant_memory mode to reduce memory usage
        file_path = os.path.join(EXPORT_DIR, f"{filename}.xlsx")

        workbook = xlsxwriter.Workbook(file_path, {'constant_memory': True})
        worksheet = workbook.add_worksheet('Corporate Park Data')

        # Define formats
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#CCCCCC',
            'border': 1
        })

        # Write headers
        headers = [
            'DOT', 'State', 'Actel Code', 'Customer L1 Code', 'Customer L1 Description',
            'Customer L2 Code', 'Customer L2 Description', 'Customer L3 Code',
            'Customer L3 Description', 'Customer Full Name', 'Telecom Type',
            'Offer Type', 'Offer Name', 'Status', 'Creation Date'
        ]

        for col, header in enumerate(headers):
            worksheet.write(0, col, header, header_format)

        # Process in batches
        processed = 0
        row_idx = 1

        for offset in range(0, total_count, batch_size):
            # Check if export was cancelled
            if self.cancelled:
                break

            # Use values() to avoid loading full model instances
            batch = list(self.queryset[offset:offset+batch_size].values(
                'dot_code', 'state', 'actel_code', 'customer_l1_code',
                'customer_l1_desc', 'customer_l2_code', 'customer_l2_desc',
                'customer_l3_code', 'customer_l3_desc', 'customer_full_name',
                'telecom_type', 'offer_type', 'offer_name', 'subscriber_status',
                'creation_date'
            ))

            # Write rows directly to the worksheet
            for item in batch:
                worksheet.write(row_idx, 0, item.get('dot_code', ''))
                worksheet.write(row_idx, 1, item.get('state', ''))
                worksheet.write(row_idx, 2, item.get('actel_code', ''))
                worksheet.write(row_idx, 3, item.get('customer_l1_code', ''))
                worksheet.write(row_idx, 4, item.get('customer_l1_desc', ''))
                worksheet.write(row_idx, 5, item.get('customer_l2_code', ''))
                worksheet.write(row_idx, 6, item.get('customer_l2_desc', ''))
                worksheet.write(row_idx, 7, item.get('customer_l3_code', ''))
                worksheet.write(row_idx, 8, item.get('customer_l3_desc', ''))
                worksheet.write(row_idx, 9, item.get('customer_full_name', ''))
                worksheet.write(row_idx, 10, item.get('telecom_type', ''))
                worksheet.write(row_idx, 11, item.get('offer_type', ''))
                worksheet.write(row_idx, 12, item.get('offer_name', ''))
                worksheet.write(row_idx, 13, item.get('subscriber_status', ''))
                worksheet.write(row_idx, 14, str(
                    item.get('creation_date', '')))
                row_idx += 1

            # Update progress and clear memory
            processed += len(batch)
            self.progress = int((processed / total_count) * 100)
            batch = None
            gc.collect()

        # Close the workbook
        workbook.close()
        self.file_path = file_path

    def _export_csv(self, total_count, batch_size, filename):
        # Implementation for CSV export with better memory management
        file_path = os.path.join(EXPORT_DIR, f"{filename}.csv")
        with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            # Write headers
            writer.writerow([
                'DOT', 'State', 'Actel Code', 'Customer L1 Code', 'Customer L1 Description',
                'Customer L2 Code', 'Customer L2 Description', 'Customer L3 Code',
                'Customer L3 Description', 'Customer Full Name', 'Telecom Type',
                'Offer Type', 'Offer Name', 'Status', 'Creation Date'
            ])

            # Process in batches with direct value access to avoid serialization overhead
            processed = 0
            for offset in range(0, total_count, batch_size):
                # Check if export was cancelled
                if self.cancelled:
                    break

                # Use values() to avoid loading full model instances
                batch = list(self.queryset[offset:offset+batch_size].values(
                    'dot_code', 'state', 'actel_code', 'customer_l1_code',
                    'customer_l1_desc', 'customer_l2_code', 'customer_l2_desc',
                    'customer_l3_code', 'customer_l3_desc', 'customer_full_name',
                    'telecom_type', 'offer_type', 'offer_name', 'subscriber_status',
                    'creation_date'
                ))

                for item in batch:
                    # Handle potential special characters by ensuring all values are strings
                    values = [
                        str(item.get('dot_code', '')),
                        str(item.get('state', '')),
                        str(item.get('actel_code', '')),
                        str(item.get('customer_l1_code', '')),
                        str(item.get('customer_l1_desc', '')),
                        str(item.get('customer_l2_code', '')),
                        str(item.get('customer_l2_desc', '')),
                        str(item.get('customer_l3_code', '')),
                        str(item.get('customer_l3_desc', '')),
                        str(item.get('customer_full_name', '')),
                        str(item.get('telecom_type', '')),
                        str(item.get('offer_type', '')),
                        str(item.get('offer_name', '')),
                        str(item.get('subscriber_status', '')),
                        str(item.get('creation_date', ''))
                    ]
                    writer.writerow(values)

                processed += len(batch)
                self.progress = int((processed / total_count) * 100)

                # Clear batch from memory
                batch = None

                # Force garbage collection every few batches
                if (offset // batch_size) % 5 == 0:
                    gc.collect()

        self.file_path = file_path

    def _export_pdf(self, total_count, batch_size, filename):
        # PDF export with memory optimizations
        file_path = os.path.join(EXPORT_DIR, f"{filename}.pdf")

        # Create PDF document with A2 size for even larger tables
        doc = SimpleDocTemplate(
            file_path,
            pagesize=landscape(A2),  # Use A2 landscape for maximum width
            rightMargin=10,
            leftMargin=10,
            topMargin=15,
            bottomMargin=15
        )

        # Container for 'Flowable' objects
        elements = []

        # Define styles for document
        styles = getSampleStyleSheet()
        title_style = styles['Heading1']
        title_style.alignment = 1  # Center alignment

        # Add title
        elements.append(Paragraph("Corporate Park Export", title_style))
        elements.append(Spacer(1, 8))

        # Current date
        date_style = styles['Normal']
        date_style.alignment = 1  # Center alignment
        elements.append(Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", date_style))
        elements.append(Spacer(1, 8))

        # Define paragraph style for cell content to enable wrapping
        cell_style = styles['Normal'].clone('CellStyle')
        cell_style.fontSize = 8  # More readable font size
        cell_style.leading = 10  # Line spacing
        cell_style.alignment = TA_LEFT

        # Define table style with more space between columns
        style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            # Larger, more readable header font
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            # Larger, more readable data font
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),  # Visible grid lines
            # More padding for readability
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            # More padding for readability
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            # More padding for readability
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            # More padding for readability
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            # Top align content for better text wrapping
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ])

        # Create header row for table - use all fields from CSV and match the screenshot
        table_data = [
            ['DOT', 'State', 'Actel Code', 'Customer L1', 'Customer L2', 'Customer L3',
             'Customer Full Name', 'Telecom Type', 'Offer Type', 'Offer Name',
             'Status', 'Creation Date']
        ]

        # Because PDFs can become very large, we'll limit the total number of rows
        max_rows_for_pdf = 10000  # Adjust as needed
        limit = min(total_count, max_rows_for_pdf)

        # Process in batches
        processed = 0

        # Use smaller subbatches for PDF to better manage memory
        pdf_batch_size = min(batch_size, 1000)

        # Helper function to wrap text for PDF cells
        def wrap_text(text, add_para=True):
            if not text:
                return ""
            # Use Paragraph objects for cell content to enable automatic wrapping
            if add_para:
                return Paragraph(text, cell_style)
            return text

        for offset in range(0, limit, pdf_batch_size):
            # Check if export was cancelled
            if self.cancelled:
                break

            # Use values() to avoid loading full model instances
            batch = list(self.queryset[offset:offset+pdf_batch_size].values(
                'dot_code', 'state', 'actel_code',
                'customer_l1_code', 'customer_l1_desc',
                'customer_l2_code', 'customer_l2_desc',
                'customer_l3_code', 'customer_l3_desc',
                'customer_full_name',
                'telecom_type', 'offer_type', 'offer_name',
                'subscriber_status', 'creation_date'
            ))

            for item in batch:
                # Format values with wrapped text
                customer_l1 = f"{item.get('customer_l1_code', '') or ''} - {str(item.get('customer_l1_desc', '') or '')}"
                customer_l2 = f"{item.get('customer_l2_code', '') or ''} - {str(item.get('customer_l2_desc', '') or '')}"
                customer_l3 = f"{item.get('customer_l3_code', '') or ''} - {str(item.get('customer_l3_desc', '') or '')}"

                # Format the date for better display
                creation_date = item.get('creation_date', '')
                if creation_date:
                    try:
                        # Format date if it's a valid date object
                        if isinstance(creation_date, datetime):
                            creation_date = creation_date.strftime(
                                '%Y-%m-%d %H:%M:%S')
                    except Exception:
                        creation_date = str(creation_date)

                table_data.append([
                    str(item.get('dot_code', '') or ''),
                    str(item.get('state', '') or ''),
                    str(item.get('actel_code', '') or ''),
                    wrap_text(customer_l1),
                    wrap_text(customer_l2),
                    wrap_text(customer_l3),
                    wrap_text(str(item.get('customer_full_name', '') or '')),
                    str(item.get('telecom_type', '') or ''),
                    str(item.get('offer_type', '') or ''),
                    wrap_text(str(item.get('offer_name', '') or '')),
                    str(item.get('subscriber_status', '') or ''),
                    str(creation_date or '')
                ])

            processed += len(batch)
            self.progress = int(
                (processed / min(total_count, max_rows_for_pdf)) * 100)

            # Clear batch from memory
            batch = None

            # Force garbage collection periodically
            if (offset // pdf_batch_size) % 5 == 0:
                gc.collect()

        # Calculate relative column widths based on expected content size
        # Adjusted to better fit the data seen in screenshot
        table_width = doc.width - 20  # Leave minimal margin
        col_widths = [
            0.05 * table_width,  # DOT (narrower)
            0.05 * table_width,  # State (narrower)
            0.07 * table_width,  # Actel Code
            0.10 * table_width,  # Customer L1
            0.10 * table_width,  # Customer L2
            0.10 * table_width,  # Customer L3
            0.10 * table_width,  # Customer Full Name
            0.07 * table_width,  # Telecom Type
            0.08 * table_width,  # Offer Type
            0.12 * table_width,  # Offer Name (wider to fit long names)
            0.06 * table_width,  # Status
            0.10 * table_width,  # Creation Date
        ]

        # Create the table with calculated column widths and repeating header row
        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(style)
        elements.append(table)

        # Build the document with row height calculation to accommodate wrapped text
        doc.build(elements)

        # Clear table data to free memory
        table_data = None
        elements = None

        self.file_path = file_path

    def _export_ca_non_periodique(self, total_count, batch_size, filename, format_type):
        """
        Special export method for CANonPeriodique data
        """
        # Use the appropriate export format
        if format_type == 'excel':
            file_path = os.path.join(EXPORT_DIR, f"{filename}.xlsx")

            # Create a workbook with constant_memory mode for better performance
            workbook = xlsxwriter.Workbook(
                file_path, {'constant_memory': True})
            worksheet = workbook.add_worksheet('Non-Periodic Revenue Data')

            # Define formats
            header_format = workbook.add_format({
                'bold': True,
                'bg_color': '#CCCCCC',
                'border': 1
            })

            # Define headers based on CANonPeriodique model
            headers = [
                'DOT', 'Product', 'Sale Type', 'Channel',
                'Amount (Pre-tax)', 'Tax Amount', 'Total Amount',
                'Created At'
            ]

            for col, header in enumerate(headers):
                worksheet.write(0, col, header, header_format)

            # Process in batches
            processed = 0
            row_idx = 1

            for offset in range(0, total_count, batch_size):
                # Check if export was cancelled
                if self.cancelled:
                    break

                # Use values() to reduce memory usage
                batch = list(self.queryset[offset:offset+batch_size].values(
                    'dot', 'product', 'sale_type', 'channel',
                    'amount_pre_tax', 'tax_amount', 'total_amount',
                    'created_at'
                ))

                # Write rows directly to the worksheet
                for item in batch:
                    worksheet.write(row_idx, 0, str(item.get('dot', '')))
                    worksheet.write(row_idx, 1, str(item.get('product', '')))
                    worksheet.write(row_idx, 2, str(item.get('sale_type', '')))
                    worksheet.write(row_idx, 3, str(item.get('channel', '')))
                    worksheet.write(row_idx, 4, float(
                        item.get('amount_pre_tax', 0) or 0))
                    worksheet.write(row_idx, 5, float(
                        item.get('tax_amount', 0) or 0))
                    worksheet.write(row_idx, 6, float(
                        item.get('total_amount', 0) or 0))
                    worksheet.write(row_idx, 7, str(
                        item.get('created_at', '')))
                    row_idx += 1

                # Update progress and clear memory
                processed += len(batch)
                self.progress = int((processed / total_count) * 100)
                batch = None
                gc.collect()

            # Close the workbook
            workbook.close()
            self.file_path = file_path

        elif format_type == 'csv':
            file_path = os.path.join(EXPORT_DIR, f"{filename}.csv")

            with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)

                # Write headers
                writer.writerow([
                    'DOT', 'Product', 'Sale Type', 'Channel',
                    'Amount (Pre-tax)', 'Tax Amount', 'Total Amount',
                    'Created At'
                ])

                # Process in batches
                processed = 0

                for offset in range(0, total_count, batch_size):
                    # Check if export was cancelled
                    if self.cancelled:
                        break

                    # Use values() to reduce memory usage
                    batch = list(self.queryset[offset:offset+batch_size].values(
                        'dot', 'product', 'sale_type', 'channel',
                        'amount_pre_tax', 'tax_amount', 'total_amount',
                        'created_at'
                    ))

                    for item in batch:
                        # Prepare row data
                        row = [
                            str(item.get('dot', '')),
                            str(item.get('product', '')),
                            str(item.get('sale_type', '')),
                            str(item.get('channel', '')),
                            str(item.get('amount_pre_tax', 0) or 0),
                            str(item.get('tax_amount', 0) or 0),
                            str(item.get('total_amount', 0) or 0),
                            str(item.get('created_at', ''))
                        ]
                        writer.writerow(row)

                    # Update progress and clear memory
                    processed += len(batch)
                    self.progress = int((processed / total_count) * 100)
                    batch = None

                    # Force garbage collection periodically
                    if (offset // batch_size) % 5 == 0:
                        gc.collect()

            self.file_path = file_path

        else:
            raise ValueError(f"Unsupported format type: {format_type}")


class CorporateParkExportView(APIView):
    """
    API view for exporting corporate park data with background threading and thread pooling
    """
    permission_classes = [IsAuthenticated]

    def get_filtered_queryset(self, request):
        # Get filter parameters, handling both single values and lists
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        # Debug logging for all parameters
        logger.info("[EXPORT DEBUG] Raw query parameters: %s",
                    dict(request.query_params))

        # Handle dot parameter in various formats
        dot = None
        if 'dot' in request.query_params:
            dot = request.query_params.getlist('dot')
        elif 'dot[]' in request.query_params:
            dot = request.query_params.getlist('dot[]')

        # Handle exclude_dot parameter in various formats
        excluded_dots = []

        # Check for exclude_dot in various formats (single, multiple, array notation)
        for param_name in ['exclude_dot', 'exclude_dot[]']:
            if param_name in request.query_params:
                # Get all values for this parameter
                values = request.query_params.getlist(param_name)
                for val in values:
                    if val:  # Only add non-empty values
                        if ',' in val:  # Handle comma-separated values
                            excluded_dots.extend(
                                [dot.strip() for dot in val.split(',') if dot.strip()])
                        else:
                            excluded_dots.append(val.strip())

        # Remove duplicates while preserving order
        if excluded_dots:
            seen = set()
            excluded_dots = [x for x in excluded_dots if not (
                x in seen or seen.add(x))]

        logger.info(
            f"[EXPORT DEBUG] Parsed exclude_dot parameters: {excluded_dots}")

        # Handle actel_code parameter in various formats
        actel_code = []

        # Check for actel_code in various formats (single, multiple, array notation)
        for param_name in ['actel_code', 'actel_code[]']:
            if param_name in request.query_params:
                # Get all values for this parameter
                values = request.query_params.getlist(param_name)
                for val in values:
                    if val:  # Only add non-empty values
                        if ',' in val:  # Handle comma-separated values
                            actel_code.extend(
                                [code.strip() for code in val.split(',') if code.strip()])
                        else:
                            actel_code.append(val.strip())

        # Remove duplicates while preserving order
        if actel_code:
            seen = set()
            actel_code = [x for x in actel_code if not (
                x in seen or seen.add(x))]

        logger.info(
            f"[EXPORT DEBUG] Parsed actel_code parameters: {actel_code}")

        subscriber_status = request.query_params.getlist(
            'subscriber_status[]') or request.query_params.getlist('subscriber_status')
        telecom_type = request.query_params.getlist(
            'telecom_type[]') or request.query_params.getlist('telecom_type')
        offer_name = request.query_params.getlist(
            'offer_name[]') or request.query_params.getlist('offer_name')
        customer_l2 = request.query_params.getlist(
            'customer_l2[]') or request.query_params.getlist('customer_l2')
        customer_l3 = request.query_params.getlist(
            'customer_l3[]') or request.query_params.getlist('customer_l3')
        state = request.query_params.getlist(
            'state[]') or request.query_params.getlist('state')

        # Debug logging for all filters
        print(f"hadi export")
        logger.info("[EXPORT DEBUG] Filter parameters:")
        logger.info(f"DOT: {dot}")
        logger.info(f"Excluded DOTs: {excluded_dots}")
        logger.info(f"Actel Code: {actel_code}")
        logger.info(f"Subscriber Status: {subscriber_status}")
        logger.info(f"Telecom Type: {telecom_type}")
        logger.info(f"Offer Name: {offer_name}")
        logger.info(f"Customer L2: {customer_l2}")
        logger.info(f"Customer L3: {customer_l3}")
        logger.info(f"Year: {year}")
        logger.info(f"Month: {month}")
        logger.info(f"State: {state}")

        # Base query with required filters
        query = ParcCorporate.objects.filter(
            ~Q(customer_l3_code__in=['5', '57']),
            ~Q(offer_name__icontains='Moohtarif'),
            ~Q(offer_name__icontains='Solutions Hebergements'),
            ~Q(subscriber_status='Predeactivated')
        )

        # Apply filters
        if dot:
            logger.info("[EXPORT DEBUG] Applying DOT filter: %s", dot)
            query = query.filter(dot_code__in=dot)

        if excluded_dots:
            logger.info(
                "[EXPORT DEBUG] Applying excluded DOTs filter: %s", excluded_dots)
            # Only exclude dots that aren't already in the include filter
            dots_to_exclude = excluded_dots
            if dot:
                dots_to_exclude = [d for d in excluded_dots if d not in dot]
                if len(dots_to_exclude) < len(excluded_dots):
                    logger.info("[EXPORT DEBUG] Some excluded DOTs were also in the include filter and were not excluded: %s",
                                [d for d in excluded_dots if d in dot])

            if dots_to_exclude:
                query = query.exclude(dot_code__in=dots_to_exclude)

        if actel_code:
            logger.info(
                "[EXPORT DEBUG] Applying Actel code filter: %s", actel_code)
            # Use the full actel code string as it appears in the database
            logger.info(
                "[EXPORT DEBUG] Using full actel codes with descriptions: %s", actel_code)
            query = query.filter(actel_code__in=actel_code)

        if subscriber_status:
            logger.info(
                "[EXPORT DEBUG] Applying subscriber status filter: %s", subscriber_status)
            query = query.filter(subscriber_status__in=subscriber_status)

        if telecom_type:
            logger.info(
                "[EXPORT DEBUG] Applying telecom type filter: %s", telecom_type)
            query = query.filter(telecom_type__in=telecom_type)

        if offer_name:
            logger.info(
                "[EXPORT DEBUG] Applying offer name filter: %s", offer_name)
            # Clean up offer names that might contain problematic characters like quotes
            clean_offer_names = []
            for name in offer_name:
                if name:
                    # Handle special case where there's a trailing single quote
                    if name.endswith("'"):
                        # Check if it looks like an escape sequence
                        if not name.endswith("\\'"):
                            # For values like "10M_ADSL_Prepaid_corporate'"
                            # Strip the trailing quote that might be a URL encoding error
                            name = name.rstrip("'")

                    clean_offer_names.append(name)

            if clean_offer_names:
                logger.info(
                    "[EXPORT DEBUG] Processed offer names: %s", clean_offer_names)
                query = query.filter(offer_name__in=clean_offer_names)

        if customer_l2:
            logger.info(
                "[EXPORT DEBUG] Applying customer L2 filter: %s", customer_l2)
            query = query.filter(customer_l2_code__in=customer_l2)

        if customer_l3:
            logger.info(
                "[EXPORT DEBUG] Applying customer L3 filter: %s", customer_l3)
            query = query.filter(customer_l3_code__in=customer_l3)

        if state:
            logger.info("[EXPORT DEBUG] Applying state filter: %s", state)
            query = query.filter(state__in=state)

        # Apply year/month filter if provided
        if year and month:
            try:
                year = int(year)
                month = int(month)
                logger.info(
                    f"[EXPORT DEBUG] Applying year/month filter: {year}/{month}")
                query = query.filter(
                    creation_date__year=year,
                    creation_date__month=month
                )
            except (ValueError, TypeError) as e:
                logger.error(
                    f"[EXPORT DEBUG] Error applying year/month filter: {str(e)}")

        # Log final query count and SQL
        final_count = query.count()
        logger.info(f"[EXPORT DEBUG] Final query count: {final_count}")

        # Log the raw SQL for better debugging
        try:
            from django.db import connection
            # Execute the query to generate SQL
            list(query[:1])
            # Get the last executed query
            if connection.queries:
                last_query = connection.queries[-1]['sql']
                logger.info(
                    f"[EXPORT DEBUG] Actual executed SQL: {last_query}")
        except Exception as e:
            logger.error(f"[EXPORT DEBUG] Error logging SQL: {str(e)}")

        # Log the query object representation
        logger.info(f"[EXPORT DEBUG] Query object: {query.query}")

        return query

    def get_file(self, file_path):
        """Stream a file from the server to the client with proper headers"""
        if os.path.exists(file_path):
            # Get file size
            file_size = os.path.getsize(file_path)

            # Verify the file has content
            if file_size == 0:
                return JsonResponse({"detail": "File is empty"}, status=400)

            # Get the filename from the path
            filename = os.path.basename(file_path)

            # Determine content type based on file extension
            content_type = 'application/octet-stream'  # Default
            if file_path.endswith('.pdf'):
                content_type = 'application/pdf'
            elif file_path.endswith('.xlsx'):
                content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            elif file_path.endswith('.csv'):
                content_type = 'text/csv'

            # Create the response with proper headers
            with open(file_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type=content_type)
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                response['Content-Length'] = file_size
                return response
        else:
            return JsonResponse({"detail": "File not found"}, status=404)

    def get(self, request, *args, **kwargs):
        """
        Handle GET requests for export
        """
        # Check if we're cancelling an existing task
        task_id = request.query_params.get('task_id')
        cancel = request.query_params.get('cancel') == 'true'

        if cancel and task_id:
            return self.cancel_export(task_id)

        # Check if we're requesting thread pool status
        pool_status = request.query_params.get('pool_status')
        if pool_status:
            return self._get_thread_pool_status()

        # Check if we're requesting a file directly
        file_path = request.query_params.get('file_path')
        if file_path:
            # Ensure the path is within EXPORT_DIR for security
            file_path = os.path.abspath(os.path.join(
                EXPORT_DIR, os.path.basename(file_path)))
            if not file_path.startswith(EXPORT_DIR):
                return JsonResponse({"detail": "Invalid file path"}, status=400)

            return self.get_file(file_path)

        # Check if we're getting the status of an export
        if request.path.endswith('/status/') and task_id:
            if task_id in export_tasks:
                task = export_tasks[task_id]
                response_data = {
                    "status": task.status,
                    "progress": task.progress
                }

                # Add error info if failed
                if task.status == "failed" and task.error:
                    response_data["error"] = task.error

                # Add file URL if completed
                if task.status == "completed" and task.file_path:
                    # Create a relative URL to the file
                    file_name = os.path.basename(task.file_path)
                    response_data["file_url"] = f"/media/exports/{file_name}"

                # Add remaining time estimate if available
                if hasattr(task, 'progress') and task.progress > 0 and task.status == "processing":
                    # Calculate remaining time if we have a start time
                    if hasattr(task, 'start_time'):
                        elapsed_seconds = (
                            datetime.now() - task.start_time).total_seconds()
                        if elapsed_seconds > 0 and task.progress > 0:
                            total_estimated = (
                                elapsed_seconds * 100) / task.progress
                            remaining_seconds = total_estimated - elapsed_seconds
                            response_data["remaining_time"] = int(
                                remaining_seconds)

                # Add row count if available
                if hasattr(task, 'row_count') and task.row_count is not None:
                    response_data["row_count"] = task.row_count

                return JsonResponse(response_data)
            else:
                return JsonResponse({"status": "not_found"}, status=404)

        # Get format parameter
        export_format = request.query_params.get('export_format', 'excel')
        if export_format not in ['excel', 'csv', 'pdf']:
            return JsonResponse({"detail": "Invalid format"}, status=400)

        # Apply filters from query params
        queryset = self.get_filtered_queryset(request)

        # Create a unique task ID
        task_id = str(uuid.uuid4())

        # Initialize start time for this export
        start_time = datetime.now()

        # Create and start the export thread
        export_thread = ExportThread(
            task_id, queryset, export_format, request.query_params)
        export_thread.start_time = start_time  # Add start time attribute

        # Store the thread in the tasks dictionary
        export_tasks[task_id] = export_thread

        # Submit to thread pool instead of starting directly
        export_thread_pool.submit(export_thread.run)

        return JsonResponse({
            "task_id": task_id,
            "status": "processing",
            "progress": 0
        })

    def cancel_export(self, task_id):
        """Cancel an export in progress"""
        if task_id in export_tasks:
            task = export_tasks[task_id]
            if task.status == "processing":
                success = task.cancel()
                if success:
                    return JsonResponse({
                        "status": "cancelled",
                        "message": "Export has been cancelled"
                    })
                else:
                    return JsonResponse({
                        "status": "error",
                        "error": "Failed to cancel export"
                    }, status=400)
            else:
                return JsonResponse({
                    "status": "error",
                    "error": f"Cannot cancel export in status: {task.status}"
                }, status=400)
        else:
            return JsonResponse({
                "status": "error",
                "error": "Export task not found"
            }, status=404)

    def _get_thread_pool_status(self):
        """Return the status of the thread pools"""
        # Run memory cleanup check
        cleanup_memory()

        export_pool_stats = {
            'max_workers': MAX_WORKER_THREADS,
            'active_threads': len([t for t in export_tasks.values() if t.status == 'processing']),
            'total_tasks': len(export_tasks),
            'completed_tasks': len([t for t in export_tasks.values() if t.status == 'completed']),
            'failed_tasks': len([t for t in export_tasks.values() if t.status == 'failed']),
            'cancelled_tasks': len([t for t in export_tasks.values() if t.status == 'cancelled']),
            'cleaned_files': len(cleaned_files)
        }

        # Get processing thread status
        processing_pool_stats = {
            'max_workers': DATA_PROCESSING_THREADS
        }

        # Include memory usage statistics if psutil is available
        memory_stats = {}
        try:
            import psutil
            process = psutil.Process(os.getpid())
            memory = process.memory_info()
            memory_stats = {
                'rss_mb': memory.rss / 1024 / 1024,  # RSS in MB
                'vms_mb': memory.vms / 1024 / 1024,  # VMS in MB
                'percent': process.memory_percent()   # Memory usage as percent
            }
        except ImportError:
            memory_stats = {
                "error": "psutil not installed, memory stats unavailable"}

        return JsonResponse({
            'export_pool': export_pool_stats,
            'processing_pool': processing_pool_stats,
            'batch_size': BATCH_SIZE,
            'retention_seconds': FILE_RETENTION_SECONDS,
            'memory_usage': memory_stats,
            'task_retention_minutes': TASK_RETENTION_MINUTES,
            'last_cleanup': datetime.fromtimestamp(last_cleanup_time).isoformat()
        })


def submit_export_task(task_id, queryset, format_type, filters):
    """Submit an export task to the thread pool"""
    export_thread = ExportThread(task_id, queryset, format_type, filters)
    export_tasks[task_id] = export_thread

    # Submit to thread pool instead of starting directly
    future = export_thread_pool.submit(export_thread.run)
    logger.info(f"Export task {task_id} submitted to thread pool")
    return task_id


class CANonPeriodiqueExportView(APIView):
    """
    API view for exporting Non-Periodic Revenue data
    """
    permission_classes = [IsAuthenticated]

    def get_filtered_queryset(self, request):
        # Get filter parameters
        dot_filter = request.query_params.getlist('dot')
        product_filter = request.query_params.getlist('product')
        sale_type_filter = request.query_params.getlist('sale_type')
        channel_filter = request.query_params.getlist('channel')

        # Start with all records
        queryset = CANonPeriodique.objects.all()

        # Apply filters
        if dot_filter:
            queryset = queryset.filter(dot__in=dot_filter)
        if product_filter:
            queryset = queryset.filter(product__in=product_filter)
        if sale_type_filter:
            queryset = queryset.filter(sale_type__in=sale_type_filter)
        if channel_filter:
            queryset = queryset.filter(channel__in=channel_filter)

        return queryset

    def get_file(self, file_path):
        """Stream a file from the server to the client with proper headers"""
        if os.path.exists(file_path):
            # Get file size
            file_size = os.path.getsize(file_path)

            # Verify the file has content
            if file_size == 0:
                return JsonResponse({"detail": "File is empty"}, status=400)

            # Get the filename from the path
            filename = os.path.basename(file_path)

            # Determine content type based on file extension
            content_type = 'application/octet-stream'  # Default
            if file_path.endswith('.xlsx'):
                content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            elif file_path.endswith('.csv'):
                content_type = 'text/csv'

            # Create the response with proper headers
            with open(file_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type=content_type)
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                response['Content-Length'] = file_size
                return response
        else:
            return JsonResponse({"detail": "File not found"}, status=404)

    def get(self, request, *args, **kwargs):
        """
        Handle GET requests for export
        """
        # Check if we're cancelling an existing task
        task_id = request.query_params.get('task_id')
        cancel = request.query_params.get('cancel') == 'true'

        if cancel and task_id:
            return self.cancel_export(task_id)

        # Check if we're requesting a file directly
        file_path = request.query_params.get('file_path')
        if file_path:
            # Ensure the path is within EXPORT_DIR for security
            file_path = os.path.abspath(os.path.join(
                EXPORT_DIR, os.path.basename(file_path)))
            if not file_path.startswith(EXPORT_DIR):
                return JsonResponse({"detail": "Invalid file path"}, status=400)

            return self.get_file(file_path)

        # Check if we're getting the status of an export
        if request.path.endswith('/status/') and task_id:
            if task_id in export_tasks:
                task = export_tasks[task_id]
                response_data = {
                    "status": task.status,
                    "progress": task.progress
                }

                # Add error info if failed
                if task.status == "failed" and task.error:
                    response_data["error"] = task.error

                # Add file URL if completed
                if task.status == "completed" and task.file_path:
                    # Create a relative URL to the file
                    file_name = os.path.basename(task.file_path)
                    response_data["file_url"] = f"/media/exports/{file_name}"

                # Add row count if available
                if hasattr(task, 'row_count') and task.row_count is not None:
                    response_data["row_count"] = task.row_count

                return JsonResponse(response_data)
            else:
                return JsonResponse({"status": "not_found"}, status=404)

        # Get format parameter
        export_format = request.query_params.get('export_format', 'excel')
        if export_format not in ['excel', 'csv']:
            return JsonResponse({"detail": "Invalid format"}, status=400)

        # Apply filters from query params
        queryset = self.get_filtered_queryset(request)

        # Create a unique task ID
        task_id = str(uuid.uuid4())

        # Initialize start time for this export
        start_time = datetime.now()

        # Create and start the export thread
        export_thread = ExportThread(
            task_id, queryset, export_format, request.query_params)
        export_thread.start_time = start_time  # Add start time attribute

        # Store the thread in the tasks dictionary
        export_tasks[task_id] = export_thread

        # Submit to thread pool instead of starting directly
        export_thread_pool.submit(export_thread.run)

        return JsonResponse({
            "task_id": task_id,
            "status": "processing",
            "progress": 0
        })

    def cancel_export(self, task_id):
        """Cancel an export in progress"""
        if task_id in export_tasks:
            task = export_tasks[task_id]
            if task.status == "processing":
                success = task.cancel()
                if success:
                    return JsonResponse({
                        "status": "cancelled",
                        "message": "Export has been cancelled"
                    })
                else:
                    return JsonResponse({
                        "status": "error",
                        "error": "Failed to cancel export"
                    }, status=400)
            else:
                return JsonResponse({
                    "status": "error",
                    "error": f"Cannot cancel export in status: {task.status}"
                }, status=400)
        else:
            return JsonResponse({
                "status": "error",
                "error": "Export task not found"
            }, status=404)


class CANonPeriodiqueKPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            print('\n=== RECEIVED FILTER PARAMETERS ===')
            print(f"All query parameters: {request.query_params}")

            # Print each individual parameter
            if request.query_params:
                print("Individual parameters:")
                for key, values in request.query_params.items():
                    print(f"  {key}: {values}")
            else:
                print("No query parameters received")

            # Print specific filter parameters if they exist
            dot_filter = request.query_params.getlist('dot')
            product_filter = request.query_params.getlist('product')
            sale_type_filter = request.query_params.getlist('sale_type')
            channel_filter = request.query_params.getlist('channel')

            print(f"DOT filter: {dot_filter}")
            print(f"Product filter: {product_filter}")
            print(f"Sale Type filter: {sale_type_filter}")
            print(f"Channel filter: {channel_filter}")
            print('=== END OF FILTER PARAMETERS ===\n')

            # Get unfiltered queryset for count comparison
            print('Getting initial unfiltered queryset')
            unfiltered_queryset = CANonPeriodique.objects.all()
            unfiltered_count = unfiltered_queryset.count()
            print(
                f"Total records in database (unfiltered): {unfiltered_count}")

            # Start with all records
            queryset = CANonPeriodique.objects.all()

            # Apply filters based on request parameters
            if dot_filter:
                print(f"Applying DOT filter: {dot_filter}")
                queryset = queryset.filter(dot__in=dot_filter)
                print(f"Records after DOT filter: {queryset.count()}")

            if product_filter:
                print(f"Applying Product filter: {product_filter}")
                queryset = queryset.filter(product__in=product_filter)
                print(f"Records after Product filter: {queryset.count()}")

            if sale_type_filter:
                print(f"Applying Sale Type filter: {sale_type_filter}")
                queryset = queryset.filter(sale_type__in=sale_type_filter)
                print(f"Records after Sale Type filter: {queryset.count()}")

            if channel_filter:
                print(f"Applying Channel filter: {channel_filter}")
                queryset = queryset.filter(channel__in=channel_filter)
                print(f"Records after Channel filter: {queryset.count()}")

            # Final count after all filters
            filtered_count = queryset.count()
            print(f"Final filtered record count: {filtered_count}")
            print(
                f"Filters reduced records by: {unfiltered_count - filtered_count}")

            # Calculate total amounts
            total_revenue = queryset.aggregate(
                total=Sum('total_amount'),
                pre_tax=Sum('amount_pre_tax'),
                tax=Sum('tax_amount')
            )

            # Calculate by product
            product_stats = queryset.values('product').annotate(
                count=Count('id'),
                total=Sum('total_amount'),
                pre_tax=Sum('amount_pre_tax'),
                tax=Sum('tax_amount')
            ).order_by('-total')

            # Calculate by channel
            channel_stats = queryset.values('channel').annotate(
                count=Count('id'),
                total=Sum('total_amount'),
                pre_tax=Sum('amount_pre_tax'),
                tax=Sum('tax_amount')
            ).order_by('-total')

            # Calculate by sale type
            sale_type_stats = queryset.values('sale_type').annotate(
                count=Count('id'),
                total=Sum('total_amount'),
                pre_tax=Sum('amount_pre_tax'),
                tax=Sum('tax_amount')
            ).order_by('-total')

            # Calculate monthly trends
            monthly_trends = queryset.annotate(
                month=TruncMonth('created_at')
            ).values('month').annotate(
                count=Count('id'),
                total=Sum('total_amount'),
                pre_tax=Sum('amount_pre_tax'),
                tax=Sum('tax_amount')
            ).order_by('month')

            # Calculate anomaly statistics
            anomaly_stats = {
                'total_records': queryset.count(),
                'empty_fields': queryset.filter(
                    Q(dot__isnull=True) |
                    Q(product__isnull=True) |
                    Q(amount_pre_tax__isnull=True) |
                    Q(tax_amount__isnull=True) |
                    Q(total_amount__isnull=True) |
                    Q(sale_type__isnull=True) |
                    Q(channel__isnull=True)
                ).count(),
                'negative_amounts': queryset.filter(
                    Q(amount_pre_tax__lt=0) |
                    Q(tax_amount__lt=0) |
                    Q(total_amount__lt=0)
                ).count()
            }

            # Add filter information to the response
            applied_filters = {}
            if dot_filter:
                applied_filters['dot'] = dot_filter
            if product_filter:
                applied_filters['product'] = product_filter
            if sale_type_filter:
                applied_filters['sale_type'] = sale_type_filter
            if channel_filter:
                applied_filters['channel'] = channel_filter

            return Response({
                'summary': {
                    'total_revenue': total_revenue,
                    'total_records': queryset.count(),
                    'anomaly_stats': anomaly_stats,
                    'unfiltered_count': unfiltered_count,
                    'filtered_count': filtered_count,
                    'applied_filters': applied_filters
                },
                'by_product': product_stats,
                'by_channel': channel_stats,
                'by_sale_type': sale_type_stats,
                'monthly_trends': monthly_trends
            })

        except Exception as e:
            logger.error(f"Error in CANonPeriodiqueKPIView: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {'error': 'Failed to fetch KPI data', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
