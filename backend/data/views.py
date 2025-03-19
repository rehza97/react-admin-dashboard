from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse, HttpResponse
from django.core.exceptions import ValidationError
from .models import (
    Invoice,
    ProcessedInvoiceData,
    FacturationManuelle,
    JournalVentes,
    EtatFacture,
    ParcCorporate,
    CreancesNGBSS,
    CAPeriodique,
    CANonPeriodique,
    CADNT,
    CARFD,
    CACNT,
    Anomaly,
    ProgressTracker,
    RevenueObjective,
    CollectionObjective,
    DOT
)
from .serializers import (
    InvoiceSerializer,
    ProcessedInvoiceDataSerializer,
    FacturationManuelleSerializer,
    JournalVentesSerializer,
    EtatFactureSerializer,
    ParcCorporateSerializer,
    CreancesNGBSSSerializer,
    CAPeriodiqueSerializer,
    CANonPeriodiqueSerializer,
    CADNTSerializer,
    CARFDSerializer,
    CACNTSerializer,
    AnomalySerializer
)
from .forms import InvoiceUploadForm
import logging
import pandas as pd
import numpy as np
import io
import json
from datetime import datetime
from django.utils import timezone
from rest_framework.decorators import action, api_view
from rest_framework.parsers import JSONParser
from django.shortcuts import get_object_or_404
from .file_processor import FileTypeDetector, FileProcessor, handle_nan_values, FILE_TYPE_PATTERNS
import os
import traceback
from .data_processor import DataProcessor
import xlsxwriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import csv
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count, Sum, Q, DecimalField
from django.db.models.functions import Coalesce
# Add import for DOTPermissionMixin
from users.permissions import DOTPermissionMixin
from django.contrib.auth import get_user_model
from django.conf import settings
from io import BytesIO
from django.db import transaction
import time
import threading
from django.core.cache import cache
import uuid
from datetime import datetime
from .cleanup_methods import (
    clean_parc_corporate, clean_creances_ngbss, clean_ca_non_periodique,
    clean_ca_periodique, clean_ca_cnt, clean_ca_dnt, clean_ca_rfd,
    clean_journal_ventes, clean_etat_facture
)
from threading import Thread


logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    """
    Simple view to check if the API is running.
    This endpoint can be used for health monitoring.
    """
    permission_classes = []  # Allow access without authentication

    def get(self, request):
        return Response(
            {"status": "ok", "message": "API is running"},
            status=status.HTTP_200_OK
        )


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000


class InvoiceUploadView(generics.CreateAPIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def post(self, request, *args, **kwargs):
        try:
            # Get the file and invoice number directly
            file = request.FILES.get('file')
            invoice_number = request.POST.get('invoice_number')
            # Optional manual file type
            file_type = request.POST.get('file_type')
            # New parameter to control auto-processing
            auto_process = request.POST.get(
                'auto_process', 'true').lower() == 'true'

            # Log file details for debugging
            if file:
                logger.info(
                    f"Upload attempt - File: {file.name}, Size: {file.size}")
            else:
                logger.info("Upload attempt - No file provided")

            if not file:
                return Response(
                    {"error": "No file was provided"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check file extension manually
            ext = os.path.splitext(file.name)[1]
            valid_extensions = ['.csv', '.xlsx', '.xls']
            if not ext.lower() in valid_extensions:
                return Response(
                    {"error": "Unsupported file extension. Please upload a CSV or Excel file."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if an invoice with this number already exists
            existing_invoice = None
            try:
                existing_invoice = Invoice.objects.get(
                    invoice_number=invoice_number)
                logger.info(
                    f"Found existing invoice with number {invoice_number}, updating instead of creating new")

                # Delete the old file if it exists
                if existing_invoice.file:
                    existing_invoice.file.delete(save=False)

                # Update the existing invoice
                existing_invoice.file = file
                existing_invoice.status = 'pending'
                existing_invoice.error_message = None
                existing_invoice.processed_date = None

                # If file_type is provided, update it
                if file_type:
                    existing_invoice.file_type = file_type
                    existing_invoice.detection_confidence = 1.0
                else:
                    existing_invoice.file_type = None
                    existing_invoice.detection_confidence = None

                invoice = existing_invoice
            except Invoice.DoesNotExist:
                # Create a new invoice if one doesn't exist
                invoice = Invoice(
                    invoice_number=invoice_number,
                    file=file,
                    uploaded_by=request.user,
                    status='pending'
                )

            # If file_type is provided and we're creating a new invoice, use it
            if file_type and not existing_invoice:
                invoice.file_type = file_type
                invoice.detection_confidence = 1.0  # Manual selection has 100% confidence
            elif not existing_invoice:
                # Try to detect file type automatically for new invoices
                try:
                    # Save the file first so we can access it
                    invoice.save()

                    # Now detect the file type
                    detector = FileTypeDetector()
                    detected_type, confidence, _ = detector.detect_file_type(
                        invoice.file.path, file.name)

                    # Update the invoice with the detected type
                    invoice.file_type = detected_type
                    invoice.detection_confidence = confidence
                except Exception as e:
                    logger.warning(f"Error detecting file type: {str(e)}")
                    # Continue without file type detection

            # Save the invoice
            invoice.save()

            # If auto_process is enabled, process and save the data immediately
            if auto_process and invoice.file_type:
                try:
                    # Process the file
                    processor = FileProcessor()
                    file_path = invoice.file.path
                    file_name = os.path.basename(file.name)

                    # Map file type to processing method
                    file_type_map = {
                        'facturation_manuelle': 'process_facturation_manuelle',
                        'ca_periodique': 'process_ca_periodique',
                        'ca_non_periodique': 'process_ca_non_periodique',
                        'ca_dnt': 'process_ca_dnt',
                        'ca_rfd': 'process_ca_rfd',
                        'ca_cnt': 'process_ca_cnt',
                        'parc_corporate': 'process_parc_corporate',
                        'creances_ngbss': 'process_creances_ngbss',
                        'etat_facture': 'process_etat_facture',
                        'journal_ventes': 'process_journal_ventes'
                    }

                    algorithm = file_type_map.get(
                        invoice.file_type, 'process_generic')
                    processing_method = getattr(
                        processor, algorithm, processor.process_generic)
                    processed_data, summary_data = processing_method(file_path)

                    # Handle NaN values
                    processed_data = handle_nan_values(processed_data)

                    # Save the processed data
                    saver = InvoiceSaveView()
                    if invoice.file_type == "facturation_manuelle":
                        saver._save_facturation_manuelle(
                            invoice, processed_data)
                    elif invoice.file_type == "journal_ventes":
                        saver._save_journal_ventes(invoice, processed_data)
                    elif invoice.file_type == "etat_facture":
                        saver._save_etat_facture(invoice, processed_data)
                    elif invoice.file_type == "parc_corporate":
                        saver._save_parc_corporate(invoice, processed_data)
                    elif invoice.file_type == "creances_ngbss":
                        saver._save_creances_ngbss(invoice, processed_data)
                    elif invoice.file_type == "ca_periodique":
                        saver._save_ca_periodique(invoice, processed_data)
                    elif invoice.file_type == "ca_non_periodique":
                        saver._save_ca_non_periodique(invoice, processed_data)
                    elif invoice.file_type == "ca_dnt":
                        saver._save_ca_dnt(invoice, processed_data)
                    elif invoice.file_type == "ca_rfd":
                        saver._save_ca_rfd(invoice, processed_data)
                    elif invoice.file_type == "ca_cnt":
                        saver._save_ca_cnt(invoice, processed_data)
                    else:
                        # Default to ProcessedInvoiceData
                        saver._save_processed_invoice_data(
                            invoice, processed_data)

                    # Update invoice status
                    invoice.status = 'saved'
                    invoice.processed_date = timezone.now()
                    invoice.save()

                    # Return a success response with summary data
                    return Response({
                        "id": invoice.id,
                        "invoice_number": invoice.invoice_number,
                        "file_name": file.name,
                        "status": invoice.status,
                        "file_type": invoice.file_type,
                        "detection_confidence": invoice.detection_confidence,
                        "summary_data": summary_data,
                        "message": "File processed and data saved successfully"
                    }, status=status.HTTP_201_CREATED)
                except Exception as e:
                    logger.error(f"Error during auto-processing: {str(e)}")
                    logger.error(traceback.format_exc())
                    # Update invoice status to failed
                    invoice.status = 'failed'
                    invoice.error_message = str(e)
                    invoice.save()
                    # Continue with the normal response

            # Return a simple success response
            return Response({
                "id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "file_name": file.name,
                "status": invoice.status,
                "file_type": invoice.file_type,
                "detection_confidence": invoice.detection_confidence
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            import traceback
            logger.error(f"Error during file upload: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {"error": f"Failed to upload file: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InvoiceListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        queryset = Invoice.objects.filter(uploaded_by=self.request.user)

        # Add filtering options
        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status=status)

        # Add date range filtering
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        if start_date and end_date:
            queryset = queryset.filter(
                upload_date__range=[start_date, end_date])

        return queryset.order_by('-upload_date')


class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        return Invoice.objects.filter(uploaded_by=self.request.user)

    def update(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(
                instance, data=request.data, partial=True)

            if serializer.is_valid():
                serializer.save()
                logger.info(
                    f"File updated by {request.user.email}: {instance.invoice_number}")
                return Response(serializer.data)

            return Response(
                {"error": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        except Exception as e:
            logger.error(f"Error updating file: {str(e)}")
            return Response(
                {"error": "Failed to update file"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            # Delete the actual file
            instance.file.delete(save=False)
            self.perform_destroy(instance)
            logger.info(
                f"File deleted by {request.user.email}: {instance.invoice_number}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return Response(
                {"error": "Failed to delete file"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InvoiceProcessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        try:
            # Get the invoice
            invoice = get_object_or_404(
                Invoice, pk=pk, uploaded_by=request.user)

            # Check if the invoice is in a valid state for processing
            if invoice.status not in ['pending', 'preview']:
                return Response({
                    "error": f"Invoice is in {invoice.status} state and cannot be processed"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get the file path
            file_path = invoice.file.path
            file_name = os.path.basename(invoice.file.name)

            # Get processing options from request
            processing_options = request.data.get('processing_options', {})

            # Get the processing mode and treatment
            processing_mode = processing_options.get(
                'processingMode', 'automatic')
            treatment = processing_options.get('treatment', '')
            file_type = processing_options.get('fileType', '')

            # New option to save directly without returning preview data
            save_directly = processing_options.get('saveDirectly', False)

            # Use the file processor
            processor = FileProcessor()

            if processing_mode == 'automatic':
                # Let the processor automatically detect and process
                preview_data, summary_data = processor.process_file(
                    file_path, file_name)

                # Store the detected file type in the invoice
                if summary_data and 'detected_file_type' in summary_data:
                    invoice.file_type = summary_data['detected_file_type']
                    invoice.detection_confidence = summary_data.get(
                        'detection_confidence', 0.0)
                    invoice.save()
            elif file_type:
                # Use the specified file type
                # Map file type to processing method
                file_type_map = {
                    'facturation_manuelle': 'process_facturation_manuelle',
                    'ca_periodique': 'process_ca_periodique',
                    'ca_non_periodique': 'process_ca_non_periodique',
                    'ca_dnt': 'process_ca_dnt',
                    'ca_rfd': 'process_ca_rfd',
                    'ca_cnt': 'process_ca_cnt',
                    'parc_corporate': 'process_parc_corporate',
                    'creances_ngbss': 'process_creances_ngbss',
                    'etat_facture': 'process_etat_facture',
                    'journal_ventes': 'process_journal_ventes'
                }

                algorithm = file_type_map.get(file_type, 'process_generic')
                processing_method = getattr(
                    processor, algorithm, processor.process_generic)
                preview_data, summary_data = processing_method(file_path)

                # Update the invoice with the specified file type
                invoice.file_type = file_type
                invoice.detection_confidence = 1.0  # Manual selection is 100% confident
                invoice.save()
            else:
                return Response({
                    "error": "No processing mode or file type specified"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Make sure all NaN values are handled before returning the response
            preview_data = handle_nan_values(preview_data)
            summary_data = handle_nan_values(summary_data)

            # If save_directly is True, save the data to the database
            if save_directly:
                try:
                    # Save the processed data
                    saver = InvoiceSaveView()
                    if invoice.file_type == "facturation_manuelle":
                        saver._save_facturation_manuelle(invoice, preview_data)
                    elif invoice.file_type == "journal_ventes":
                        saver._save_journal_ventes(invoice, preview_data)
                    elif invoice.file_type == "etat_facture":
                        saver._save_etat_facture(invoice, preview_data)
                    elif invoice.file_type == "parc_corporate":
                        saver._save_parc_corporate(invoice, preview_data)
                    elif invoice.file_type == "creances_ngbss":
                        saver._save_creances_ngbss(invoice, preview_data)
                    elif invoice.file_type == "ca_periodique":
                        saver._save_ca_periodique(invoice, preview_data)
                    elif invoice.file_type == "ca_non_periodique":
                        saver._save_ca_non_periodique(invoice, preview_data)
                    elif invoice.file_type == "ca_dnt":
                        saver._save_ca_dnt(invoice, preview_data)
                    elif invoice.file_type == "ca_rfd":
                        saver._save_ca_rfd(invoice, preview_data)
                    elif invoice.file_type == "ca_cnt":
                        saver._save_ca_cnt(invoice, preview_data)
                    else:
                        # Default to ProcessedInvoiceData
                        saver._save_processed_invoice_data(
                            invoice, preview_data)

                    # Update invoice status
                    invoice.status = 'saved'
                    invoice.processed_date = timezone.now()
                    invoice.save()

                    # Return a success response with summary data only
                    return Response({
                        "status": "success",
                        "message": "Data processed and saved to database",
                        "summary_data": summary_data,
                        "file_type": invoice.file_type,
                        "detection_confidence": invoice.detection_confidence,
                        "row_count": summary_data.get('row_count', 0) if isinstance(summary_data, dict) else 0
                    })
                except Exception as e:
                    logger.error(f"Error saving processed data: {str(e)}")
                    logger.error(traceback.format_exc())
                    # Update invoice status to failed
                    invoice.status = 'failed'
                    invoice.error_message = str(e)
                    invoice.save()
                    return Response(
                        {"error": f"Failed to save processed data: {str(e)}"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )

            # Update invoice status to preview if not saving directly
            invoice.status = 'preview'
            invoice.save()

            # Return the processed data
            return Response({
                "preview_data": preview_data,  # Return all processed data
                "summary_data": summary_data,
                "file_name": file_name,
                "file_type": invoice.file_type,
                "detection_confidence": invoice.detection_confidence
            })

        except Exception as e:
            logger.error(f"Error processing file: {str(e)}")
            logger.error(traceback.format_exc())

            # Update invoice status to failed if it exists
            if 'invoice' in locals():
                invoice.status = 'failed'
                invoice.error_message = str(e)
                invoice.save()

            return Response(
                {"error": f"Failed to process file: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InvoiceDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            invoice = Invoice.objects.get(pk=pk, uploaded_by=request.user)
            if not invoice.file:
                return Response(
                    {"error": "File not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            response = FileResponse(invoice.file, as_attachment=True)
            response['Content-Disposition'] = f'attachment; filename="{invoice.file.name}"'
            logger.info(
                f"File downloaded by {request.user.email}: {invoice.invoice_number}")
            return response

        except Invoice.DoesNotExist:
            return Response(
                {"error": "File not found"},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error downloading file: {str(e)}")
            return Response(
                {"error": "Failed to download file"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ProcessedInvoiceDataListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProcessedInvoiceDataSerializer

    def get_queryset(self):
        invoice_id = self.request.query_params.get('invoice_id')
        # Ensure the user can only access their own data
        queryset = ProcessedInvoiceData.objects.filter(
            invoice__uploaded_by=self.request.user
        )
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        return queryset


class ProcessedInvoiceDataDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProcessedInvoiceDataSerializer

    def get_queryset(self):
        return ProcessedInvoiceData.objects.filter(
            invoice__uploaded_by=self.request.user
        )


class InvoiceSaveView(APIView):
    permission_classes = [IsAuthenticated]

    def _map_fields(self, row, field_mappings, model_name):
        """Helper method to map Excel fields to model fields and handle data conversion"""
        model_data = {}

        # Map the fields from the Excel file to the model fields
        for excel_field, value in row.items():
            # Normalize the field name (uppercase, remove spaces)
            normalized_field = excel_field.upper().replace(' ', '_')

            # Check if the normalized field is in our mappings
            if normalized_field in field_mappings:
                model_field = field_mappings[normalized_field]
                model_data[model_field] = value
            elif excel_field in field_mappings:
                model_field = field_mappings[excel_field]
                model_data[model_field] = value

        # Special handling for DOT fields
        if 'dot_code' in model_data:
            dot_code = model_data['dot_code']
            if dot_code:
                try:
                    # Try to get or create the DOT instance
                    dot_instance, _ = DOT.objects.get_or_create(
                        code=dot_code,
                        defaults={'name': dot_code}
                    )
                    model_data['dot'] = dot_instance
                except Exception as e:
                    logger.warning(
                        f"Error getting/creating DOT with code {dot_code} in {model_name}: {str(e)}")

        # Log the mapping for debugging
        logger.debug(
            f"Field mapping for {model_name}: Excel fields {list(row.keys())} -> Model fields {list(model_data.keys())}")

        return model_data

    def post(self, request, pk=None):
        """
        Save processed data to the database
        """
        try:
            # Get the invoice
            invoice = get_object_or_404(Invoice, pk=pk)

            # Check if the invoice is in the correct state
            if invoice.status not in ['preview', 'processing']:
                return Response({
                    'error': f'Invoice is in {invoice.status} state and cannot be saved'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get the processed data from the request
            data = request.data.get('data', None)
            file_type = request.data.get('file_type', None)

            # If no data is provided, try to get it from the session
            if not data:
                # TODO: Implement session-based data retrieval if needed
                return Response({
                    'error': 'No data provided'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Process options
            options = request.data.get('options', {})

            # Create a data processor
            processor = DataProcessor()

            # Process the data
            processed_result = processor.process_and_clean_data(
                invoice.file.path, file_type, data)

            processed_data = processed_result['processed_data']
            anomalies = processed_result.get('anomalies', [])

            # Save the processed data to the database
            self._save_processed_invoice_data(invoice, processed_data)

            # Save specific data based on file type
            if file_type == 'facturation_manuelle':
                self._save_facturation_manuelle(invoice, processed_data)
            elif file_type == 'journal_ventes':
                self._save_journal_ventes(invoice, processed_data)
            elif file_type == 'etat_facture':
                self._save_etat_facture(invoice, processed_data)
            elif file_type == 'parc_corporate':
                self._save_parc_corporate(invoice, processed_data)
            elif file_type == 'creances_ngbss':
                self._save_creances_ngbss(invoice, processed_data)
            elif file_type == 'ca_periodique':
                self._save_ca_periodique(invoice, processed_data)
            elif file_type == 'ca_non_periodique':
                self._save_ca_non_periodique(invoice, processed_data)
            elif file_type == 'ca_dnt':
                self._save_ca_dnt(invoice, processed_data)
            elif file_type == 'ca_rfd':
                self._save_ca_rfd(invoice, processed_data)
            elif file_type == 'ca_cnt':
                self._save_ca_cnt(invoice, processed_data)

            # Save detected anomalies
            self._save_anomalies(invoice, anomalies)

            # Update invoice status
            invoice.status = 'saved'
            invoice.processed_date = timezone.now()
            invoice.save()

            return Response({
                'message': 'Data saved successfully',
                'invoice_id': invoice.id,
                'file_type': file_type,
                'records_saved': len(processed_data),
                'anomalies_detected': len(anomalies)
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error saving data: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _save_anomalies(self, invoice, anomalies):
        """Save detected anomalies to the database"""
        if not anomalies:
            return

        # Map anomaly types from detection to model types
        anomaly_type_mapping = {
            'missing_data': 'missing_data',
            'duplicate_data': 'duplicate_data',
            'invalid_data': 'invalid_data',
            'anomaly': 'other',
            'outlier': 'outlier',
            'inconsistent_data': 'inconsistent_data'
        }

        for anomaly in anomalies:
            # Get the anomaly type, defaulting to 'other' if not recognized
            anomaly_type = anomaly_type_mapping.get(
                anomaly.get('type', ''), 'other')

            # Create the anomaly record
            Anomaly.objects.create(
                invoice=invoice,
                type=anomaly_type,
                description=anomaly.get('description', 'Unknown anomaly'),
                data=anomaly.get('data', {}),
                status='open'
            )

    def _save_processed_invoice_data(self, invoice, data):
        """Save data to ProcessedInvoiceData model"""
        saved_count = 0
        for row in data:
            # Convert data types as needed
            invoice_date = row.get('invoice_date')
            if isinstance(invoice_date, str):
                try:
                    invoice_date = datetime.strptime(
                        invoice_date, '%Y-%m-%d').date()
                except ValueError:
                    invoice_date = None

            # Create the ProcessedInvoiceData record
            ProcessedInvoiceData.objects.create(
                invoice=invoice,
                month=row.get('month', ''),
                invoice_date=invoice_date,
                department=row.get('department', ''),
                invoice_number=row.get('invoice_number', ''),
                fiscal_year=row.get('fiscal_year', ''),
                client=row.get('client', ''),
                amount_pre_tax=row.get('amount_pre_tax'),
                vat_percentage=row.get('vat_percentage'),
                vat_amount=row.get('vat_amount'),
                total_amount=row.get('total_amount'),
                description=row.get('description', ''),
                period=row.get('period', '')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to ProcessedInvoiceData")
        return saved_count

    def _save_facturation_manuelle(self, invoice, data):
        """Save data to FacturationManuelle model"""
        saved_count = 0
        for row in data:
            # Convert data types as needed
            invoice_date = row.get('invoice_date')
            if isinstance(invoice_date, str):
                try:
                    invoice_date = datetime.strptime(
                        invoice_date, '%Y-%m-%d').date()
                except ValueError:
                    invoice_date = None

            # Create the FacturationManuelle record
            FacturationManuelle.objects.create(
                invoice=invoice,
                month=row.get('month', ''),
                invoice_date=invoice_date,
                department=row.get('department', ''),
                invoice_number=row.get('invoice_number', ''),
                fiscal_year=row.get('fiscal_year', ''),
                client=row.get('client', ''),
                amount_pre_tax=row.get('amount_pre_tax'),
                vat_percentage=row.get('vat_percentage'),
                vat_amount=row.get('vat_amount'),
                total_amount=row.get('total_amount'),
                description=row.get('description', ''),
                period=row.get('period', '')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to FacturationManuelle")
        return saved_count

    def _save_journal_ventes(self, invoice, data):
        """Save data to JournalVentes model"""
        saved_count = 0

        # Debug: Log the first row to see what fields are available
        if data and len(data) > 0:
            logger.info(f"First row of JournalVentes data: {data[0]}")
            logger.info(f"Available keys in first row: {list(data[0].keys())}")

        # Define possible field mappings (Excel column name -> model field)
        field_mappings = {
            # DOT field mappings
            'DO': 'dot_code',
            'DOT': 'dot_code',
            'DOT_CODE': 'dot_code',

            # Organization field mappings
            'ORGANISATION': 'organization',
            'ORGANIZATION': 'organization',
            'ORG': 'organization',
            'ORGANISME': 'organization',

            # Origin field mappings
            'ORIGINE': 'origin',
            'ORIGIN': 'origin',
            'SOURCE': 'origin',

            # Invoice number field mappings
            'NUMERO_FACTURE': 'invoice_number',
            'INVOICE_NUMBER': 'invoice_number',
            'N_FACTURE': 'invoice_number',
            'NUM_FACTURE': 'invoice_number',
            'FACTURE_NO': 'invoice_number',

            # Invoice type field mappings
            'TYPE_FACTURE': 'invoice_type',
            'INVOICE_TYPE': 'invoice_type',
            'TYPE': 'invoice_type',

            # Invoice date field mappings
            'DATE_FACTURE': 'invoice_date',
            'INVOICE_DATE': 'invoice_date',
            'DATE': 'invoice_date',

            # Client field mappings
            'CLIENT': 'client',
            'NOM_CLIENT': 'client',
            'CUSTOMER': 'client',
            'CLIENT_NAME': 'client',

            # Currency field mappings
            'DEVISE': 'currency',
            'CURRENCY': 'currency',

            # Invoice object field mappings
            'OBJET_FACTURE': 'invoice_object',
            'OBJECT': 'invoice_object',
            'DESCRIPTION_FACTURE': 'invoice_object',

            # Account code field mappings
            'COMPTE_COMPTABLE': 'account_code',
            'ACCOUNT_CODE': 'account_code',
            'COMPTE': 'account_code',

            # GL date field mappings
            'DATE_GL': 'gl_date',
            'GL_DATE': 'gl_date',

            # Billing period field mappings
            'PERIODE_FACTURATION': 'billing_period',
            'PERIODE': 'billing_period',
            'PERIOD': 'billing_period',
            'BILLING_PERIOD': 'billing_period',

            # Reference field mappings
            'REFERENCE': 'reference',
            'REF': 'reference',

            # Flag field mappings
            'TERMINE_FLAG': 'terminated_flag',
            'FLAG': 'terminated_flag',

            # Description field mappings
            'DESCRIPTION': 'description',
            'DESC': 'description',

            # Revenue amount field mappings
            'CHIFFRE_AFFAIRES': 'revenue_amount',
            'CA': 'revenue_amount',
            'REVENUE': 'revenue_amount',
            'REVENUE_AMOUNT': 'revenue_amount',
            'MONTANT': 'revenue_amount',
            'AMOUNT': 'revenue_amount',
        }

        for row in data:
            try:
                # Create a data dictionary for the model
                model_data = {'invoice': invoice}

                # Use the helper method to map fields
                mapped_data = self._map_fields(
                    row, field_mappings, "JournalVentes")
                model_data.update(mapped_data)

                # Parse date fields if they exist
                if 'invoice_date' in model_data and model_data['invoice_date']:
                    try:
                        model_data['invoice_date'] = self._parse_date(
                            model_data['invoice_date'])
                    except:
                        model_data['invoice_date'] = None

                if 'gl_date' in model_data and model_data['gl_date']:
                    try:
                        model_data['gl_date'] = self._parse_date(
                            model_data['gl_date'])
                    except:
                        model_data['gl_date'] = None

            # Create the JournalVentes record
                JournalVentes.objects.create(**model_data)
                saved_count += 1

                # Log the first few records for debugging
                if saved_count <= 3:
                    logger.info(
                        f"Saved JournalVentes record #{saved_count}: {model_data}")

            except Exception as e:
                logger.error(f"Error saving JournalVentes record: {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to JournalVentes")
        return saved_count

    def _save_etat_facture(self, invoice, data):
        """Save data to EtatFacture model"""
        saved_count = 0

        # Debug: Log the first row to see what fields are available
        if data and len(data) > 0:
            logger.info(f"First row of EtatFacture data: {data[0]}")
            logger.info(f"Available keys in first row: {list(data[0].keys())}")

        # Define possible field mappings (Excel column name -> model field)
        field_mappings = {
            # DOT field mappings
            'DO': 'dot_code',
            'DOT': 'dot_code',
            'DOT_CODE': 'dot_code',

            # Organization field mappings
            'ORGANISATION': 'organization',
            'ORGANIZATION': 'organization',
            'ORG': 'organization',
            'ORGANISME': 'organization',

            # Source field mappings
            'SOURCE': 'source',
            'SRC': 'source',

            # Invoice number field mappings
            'NUMERO_FACTURE': 'invoice_number',
            'INVOICE_NUMBER': 'invoice_number',
            'N_FACTURE': 'invoice_number',
            'NUM_FACTURE': 'invoice_number',
            'FACTURE_NO': 'invoice_number',

            # Invoice type field mappings
            'TYPE_FACTURE': 'invoice_type',
            'INVOICE_TYPE': 'invoice_type',
            'TYPE': 'invoice_type',

            # Invoice date field mappings
            'DATE_FACTURE': 'invoice_date',
            'INVOICE_DATE': 'invoice_date',
            'DATE': 'invoice_date',

            # Client field mappings
            'NOM_CLIENT': 'client',
            'CLIENT': 'client',
            'CUSTOMER': 'client',
            'CLIENT_NAME': 'client',

            # Invoice object field mappings
            'OBJET_FACTURE': 'invoice_object',
            'OBJECT': 'invoice_object',
            'DESCRIPTION': 'invoice_object',

            # Period field mappings
            'PERIODE_FACTURATION': 'period',
            'PERIODE': 'period',
            'PERIOD': 'period',

            # Flag field mappings
            'TERMINE_FLAG': 'terminated_flag',
            'FLAG': 'terminated_flag',

            # Amount pre-tax field mappings
            'MONTANT_HT': 'amount_pre_tax',
            'HT': 'amount_pre_tax',
            'AMOUNT_PRE_TAX': 'amount_pre_tax',

            # Tax amount field mappings
            'MONTANT_TVA': 'tax_amount',
            'TVA': 'tax_amount',
            'TAX': 'tax_amount',
            'TAX_AMOUNT': 'tax_amount',

            # Total amount field mappings
            'MONTANT_TTC': 'total_amount',
            'TTC': 'total_amount',
            'TOTAL': 'total_amount',
            'TOTAL_AMOUNT': 'total_amount',

            # Revenue amount field mappings
            'CHIFFRE_AFFAIRES': 'revenue_amount',
            'CA': 'revenue_amount',
            'REVENUE': 'revenue_amount',
            'REVENUE_AMOUNT': 'revenue_amount',

            # Collection amount field mappings
            'MONTANT_ENCAISSE': 'collection_amount',
            'ENCAISSEMENT': 'collection_amount',
            'COLLECTION': 'collection_amount',
            'COLLECTION_AMOUNT': 'collection_amount',

            # Payment date field mappings
            'DATE_ENCAISSEMENT': 'payment_date',
            'DATE_PAYMENT': 'payment_date',
            'PAYMENT_DATE': 'payment_date',

            # Invoice credit amount field mappings
            'FACTURE_AVOIR': 'invoice_credit_amount',
            'AVOIR': 'invoice_credit_amount',
            'CREDIT': 'invoice_credit_amount',
            'CREDIT_AMOUNT': 'invoice_credit_amount',
        }

        for row in data:
            try:
                # Create a data dictionary for the model
                model_data = {'invoice': invoice}

                # Use the helper method to map fields
                mapped_data = self._map_fields(
                    row, field_mappings, "EtatFacture")
                model_data.update(mapped_data)

                # Parse date fields if they exist
                if 'invoice_date' in model_data and model_data['invoice_date']:
                    try:
                        model_data['invoice_date'] = self._parse_date(
                            model_data['invoice_date'])
                    except:
                        model_data['invoice_date'] = None

                if 'payment_date' in model_data and model_data['payment_date']:
                    try:
                        model_data['payment_date'] = self._parse_date(
                            model_data['payment_date'])
                    except:
                        model_data['payment_date'] = None

                # Create the EtatFacture record
                EtatFacture.objects.create(**model_data)
                saved_count += 1

                # Log the first few records for debugging
                if saved_count <= 3:
                    logger.info(
                        f"Saved EtatFacture record #{saved_count}: {model_data}")

            except Exception as e:
                logger.error(f"Error saving EtatFacture record: {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to EtatFacture")
        return saved_count

    def _save_parc_corporate(self, invoice, data):
        """Save data to ParcCorporate model"""
        saved_count = 0
        filtered_out_count = 0

        # Debug: Log the first row to see what fields are available
        if data and len(data) > 0:
            logger.info(f"First row of ParcCorporate data: {data[0]}")
            logger.info(f"Available keys in first row: {list(data[0].keys())}")

        # Define field mappings (Excel column name -> model field)
        field_mappings = {
            # Actel code field mappings
            'ACTEL_CODE': 'actel_code',
            'ACTEL CODE': 'actel_code',
            'ACTEL': 'actel_code',

            # Customer L1 code field mappings
            'CODE_CUSTOMER_L1': 'customer_l1_code',
            'CUSTOMER_L1_CODE': 'customer_l1_code',
            'CUSTOMER L1 CODE': 'customer_l1_code',

            # Customer L1 desc field mappings
            'DESCRIPTION_CUSTOMER_L1': 'customer_l1_desc',
            'CUSTOMER_L1_DESC': 'customer_l1_desc',
            'CUSTOMER L1 DESC': 'customer_l1_desc',

            # Customer L2 code field mappings
            'CODE_CUSTOMER_L2': 'customer_l2_code',
            'CUSTOMER_L2_CODE': 'customer_l2_code',
            'CUSTOMER L2 CODE': 'customer_l2_code',

            # Customer L2 desc field mappings
            'DESCRIPTION_CUSTOMER_L2': 'customer_l2_desc',
            'CUSTOMER_L2_DESC': 'customer_l2_desc',
            'CUSTOMER L2 DESC': 'customer_l2_desc',

            # Customer L3 code field mappings
            'CODE_CUSTOMER_L3': 'customer_l3_code',
            'CUSTOMER_L3_CODE': 'customer_l3_code',
            'CUSTOMER L3 CODE': 'customer_l3_code',

            # Customer L3 desc field mappings
            'DESCRIPTION_CUSTOMER_L3': 'customer_l3_desc',
            'CUSTOMER_L3_DESC': 'customer_l3_desc',
            'CUSTOMER L3 DESC': 'customer_l3_desc',

            # Telecom type field mappings
            'TELECOM_TYPE': 'telecom_type',
            'TELECOM TYPE': 'telecom_type',

            # Offer type field mappings
            'OFFER_TYPE': 'offer_type',
            'OFFER TYPE': 'offer_type',

            # Offer name field mappings
            'OFFER_NAME': 'offer_name',
            'OFFER NAME': 'offer_name',

            # Subscriber status field mappings
            'SUBSCRIBER_STATUS': 'subscriber_status',
            'SUBSCRIBER STATUS': 'subscriber_status',

            # Creation date field mappings
            'CREATION_DATE': 'creation_date',
            'CREATION DATE': 'creation_date',

            # State field mappings
            'STATE': 'state',

            # Customer full name field mappings
            'CUSTOMER_FULL_NAME': 'customer_full_name',
            'CUSTOMER FULL NAME': 'customer_full_name',
        }

        for row in data:
            try:
                # Use the helper method to map fields
                mapped_data = self._map_fields(
                    row, field_mappings, "ParcCorporate")

                # Apply client's filtering requirements

                # 1. Filter out records with customer_l3_code = 5 or 57
                customer_l3_code = mapped_data.get('customer_l3_code', '')
                if customer_l3_code in ['5', '57']:
                    filtered_out_count += 1
                    continue

                # 2. Filter out records with offer_name containing "Moohtarif" or "Solutions Hebergements"
                offer_name = mapped_data.get('offer_name', '')
                if 'Moohtarif' in offer_name or 'Solutions Hebergements' in offer_name:
                    filtered_out_count += 1
                    continue

                # 3. Filter out records with subscriber_status = "Predeactivated"
                subscriber_status = mapped_data.get('subscriber_status', '')
                if subscriber_status == 'Predeactivated':
                    filtered_out_count += 1
                    continue

                # Handle DOT - store in state field if needed
                dot_code = row.get('DO', '') or row.get(
                    'DOT', '') or row.get('DOT_CODE', '')

                # Parse creation_date if it exists and make it timezone-aware
                if 'creation_date' in mapped_data and mapped_data['creation_date']:
                    try:
                        # Parse the datetime
                        naive_datetime = self._parse_datetime(
                            mapped_data['creation_date'])

                        # Make it timezone-aware by adding the current timezone
                        if naive_datetime and timezone.is_naive(naive_datetime):
                            mapped_data['creation_date'] = timezone.make_aware(
                                naive_datetime)
                        else:
                            mapped_data['creation_date'] = naive_datetime
                    except Exception as e:
                        logger.warning(
                            f"Error parsing creation_date: {str(e)}")
                        mapped_data['creation_date'] = None

                # Get state value, append DOT code if available
                state = mapped_data.get('state', '')
                if dot_code and dot_code not in state:
                    state = f"{state} (DOT: {dot_code})" if state else f"DOT: {dot_code}"
                mapped_data['state'] = state

                # Create the model instance
                model_data = {'invoice': invoice}
                model_data.update(mapped_data)

                ParcCorporate.objects.create(**model_data)
                saved_count += 1

                # Log the first few records for debugging
                if saved_count <= 3:
                    logger.info(
                        f"Saved ParcCorporate record #{saved_count}: {model_data}")

            except Exception as e:
                logger.error(f"Error saving ParcCorporate record: {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to ParcCorporate")
        logger.info(
            f"Filtered out {filtered_out_count} records based on client requirements")
        return saved_count

    def _save_creances_ngbss(self, invoice, data):
        """Save data to CreancesNGBSS model"""
        saved_count = 0
        start_time = timezone.now()

        # Debug: Log the first row to see what fields are available
        if data and len(data) > 0:
            logger.info(f"First row of CreancesNGBSS data: {data[0]}")
            logger.info(f"Available keys in first row: {list(data[0].keys())}")

        # Define possible field mappings (Excel column name -> model field)
        field_mappings = {
            # DOT field mappings
            'DO': 'dot_code',
            'DOT': 'dot_code',
            'DOT_CODE': 'dot_code',

            # ACTEL field mappings
            'ACTEL': 'actel',
            'ACTEL_CODE': 'actel',

            # Month field mappings
            'MOIS': 'month',
            'MONTH': 'month',

            # Year field mappings
            'ANNEE': 'year',
            'YEAR': 'year',

            # Subscriber status field mappings
            'SUBS_STATUS': 'subscriber_status',
            'SUBSCRIBER_STATUS': 'subscriber_status',
            'STATUS': 'subscriber_status',

            # Product field mappings
            'PRODUIT': 'product',
            'PRODUCT': 'product',

            # Customer level field mappings
            'CUST_LEV1': 'customer_lev1',
            'CUSTOMER_LEV1': 'customer_lev1',
            'CUST_LEV2': 'customer_lev2',
            'CUSTOMER_LEV2': 'customer_lev2',
            'CUST_LEV3': 'customer_lev3',
            'CUSTOMER_LEV3': 'customer_lev3',

            # Invoice amount field mappings
            'INVOICE_AMT': 'invoice_amount',
            'INVOICE_AMOUNT': 'invoice_amount',
            'MONTANT_FACTURE': 'invoice_amount',

            # Open amount field mappings
            'OPEN_AMT': 'open_amount',
            'OPEN_AMOUNT': 'open_amount',
            'MONTANT_OUVERT': 'open_amount',

            # Tax amount field mappings
            'TAX_AMT': 'tax_amount',
            'TAX_AMOUNT': 'tax_amount',
            'MONTANT_TVA': 'tax_amount',
            'TVA': 'tax_amount',

            # Invoice amount HT field mappings
            'INVOICE_AMT_HT': 'invoice_amount_ht',
            'INVOICE_AMOUNT_HT': 'invoice_amount_ht',
            'MONTANT_FACTURE_HT': 'invoice_amount_ht',
            'HT': 'invoice_amount_ht',

            # Dispute amount field mappings
            'DISPUTE_AMT': 'dispute_amount',
            'DISPUTE_AMOUNT': 'dispute_amount',
            'MONTANT_LITIGE': 'dispute_amount',

            # Dispute tax amount field mappings
            'DISPUTE_TAX_AMT': 'dispute_tax_amount',
            'DISPUTE_TAX_AMOUNT': 'dispute_tax_amount',
            'MONTANT_TVA_LITIGE': 'dispute_tax_amount',

            # Dispute net amount field mappings
            'DISPUTE_NET_AMT': 'dispute_net_amount',
            'DISPUTE_NET_AMOUNT': 'dispute_net_amount',
            'MONTANT_NET_LITIGE': 'dispute_net_amount',

            # Creance brut field mappings
            'CREANCE_BRUT': 'creance_brut',
            'CREANCE_BRUTE': 'creance_brut',
            'GROSS_RECEIVABLE': 'creance_brut',

            # Creance net field mappings
            'CREANCE_NET': 'creance_net',
            'NET_RECEIVABLE': 'creance_net',

            # Creance HT field mappings
            'CREANCE_HT': 'creance_ht',
            'RECEIVABLE_HT': 'creance_ht',

            # Generic amount field - map to invoice_amount if present
            'MONTANT': 'invoice_amount',
            'AMOUNT': 'invoice_amount',
        }

        for row in data:
            try:
                # Create a data dictionary for the model
                model_data = {'invoice': invoice}

                # Use the helper method to map fields
                mapped_data = self._map_fields(
                    row, field_mappings, "CreancesNGBSS")
                model_data.update(mapped_data)

                # Parse decimal values safely
                decimal_fields = [
                    'invoice_amount', 'open_amount', 'tax_amount', 'invoice_amount_ht',
                    'dispute_amount', 'dispute_tax_amount', 'dispute_net_amount',
                    'creance_brut', 'creance_net', 'creance_ht'
                ]

                for field in decimal_fields:
                    if field in model_data and model_data[field] is not None:
                        try:
                            if isinstance(model_data[field], str):
                                # Clean the string value
                                clean_value = model_data[field].replace(
                                    ',', '.').replace(' ', '')
                                model_data[field] = float(
                                    clean_value) if clean_value else 0
                        except (ValueError, TypeError):
                            model_data[field] = 0

                # Create the CreancesNGBSS record
                CreancesNGBSS.objects.create(**model_data)
                saved_count += 1

                # Log the first few records for debugging
                if saved_count <= 3:
                    logger.info(
                        f"Saved CreancesNGBSS record #{saved_count}: {model_data}")

            except Exception as e:
                logger.error(f"Error saving CreancesNGBSS record: {str(e)}")
                logger.error(f"Problematic row data: {row}")
                # Continue with next record

        # Calculate final stats
        total_time = (timezone.now() - start_time).total_seconds()
        records_per_second = saved_count / total_time if total_time > 0 else 0

        logger.info(
            f"Saved {saved_count} records to CreancesNGBSS in {total_time:.2f} seconds ({records_per_second:.2f} records/sec)")
        return saved_count

    def _save_ca_periodique(self, invoice, data):
        """Save data to CAPeriodique model"""
        saved_count = 0
        for row in data:
            dot_code = row.get('DO', '')

            # Get or create DOT instance
            dot_instance = None
            if dot_code:
                try:
                    dot_instance, _ = DOT.objects.get_or_create(
                        code=dot_code,
                        defaults={'name': dot_code}
                    )
                except Exception as e:
                    logger.warning(
                        f"Error getting/creating DOT with code {dot_code}: {str(e)}")

            try:
                CAPeriodique.objects.create(
                    invoice=invoice,
                    dot=dot_instance,
                    dot_code=dot_code,  # Store the original code as backup
                    product=row.get('PRODUIT', ''),
                    amount_pre_tax=row.get('HT', 0),
                    tax_amount=row.get('TAX', 0),
                    total_amount=row.get('TTC', 0),
                    discount=row.get('DISCOUNT', 0)
                )
                saved_count += 1
            except Exception as e:
                logger.error(f"Error saving CAPeriodique record: {str(e)}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to CAPeriodique")
        return saved_count

    def _save_ca_non_periodique(self, invoice, data):
        """Save data to CANonPeriodique model"""
        saved_count = 0
        for row in data:
            dot_code = row.get('DO', '')

            # Get or create DOT instance
            dot_instance = None
            if dot_code:
                try:
                    dot_instance, _ = DOT.objects.get_or_create(
                        code=dot_code,
                        defaults={'name': dot_code}
                    )
                except Exception as e:
                    logger.warning(
                        f"Error getting/creating DOT with code {dot_code}: {str(e)}")

            try:
                CANonPeriodique.objects.create(
                    invoice=invoice,
                    dot=dot_instance,
                    dot_code=dot_code,  # Store the original code as backup
                    product=row.get('PRODUIT', ''),
                    amount_pre_tax=row.get('HT', 0),
                    tax_amount=row.get('TAX', 0),
                    total_amount=row.get('TTC', 0),
                    sale_type=row.get('TYPE_VENTE', ''),
                    channel=row.get('CHANNEL', '')
                )
                saved_count += 1
            except Exception as e:
                logger.error(f"Error saving CANonPeriodique record: {str(e)}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to CANonPeriodique")
        return saved_count

    def _save_ca_dnt(self, invoice, data):
        """Save data to CADNT model"""
        saved_count = 0
        for row in data:
            dot_code = row.get('DO', '')

            # Get or create DOT instance
            dot_instance = None
            if dot_code:
                try:
                    dot_instance, _ = DOT.objects.get_or_create(
                        code=dot_code,
                        defaults={'name': dot_code}
                    )
                except Exception as e:
                    logger.warning(
                        f"Error getting/creating DOT with code {dot_code}: {str(e)}")

            try:
                # Parse date if available
                entry_date = None
                if 'ENTRY_DATE' in row and row['ENTRY_DATE']:
                    try:
                        entry_date = self._parse_datetime(row['ENTRY_DATE'])
                    except:
                        pass

                CADNT.objects.create(
                    invoice=invoice,
                    pri_identity=row.get('PRI_IDENTITY', ''),
                    customer_code=row.get('CUST_CODE', ''),
                    full_name=row.get('FULL_NAME', ''),
                    transaction_id=row.get('TRANS_ID', ''),
                    transaction_type=row.get('TRANS_TYPE', ''),
                    channel_id=row.get('CHANNEL_ID', ''),
                    ext_trans_type=row.get('EXT_TRANS_TYPE', ''),
                    total_amount=row.get('TTC', 0),
                    tax_amount=row.get('TVA', 0),
                    amount_pre_tax=row.get('HT', 0),
                    entry_date=entry_date,
                    actel=row.get('ACTEL', ''),
                    dot=dot_instance,
                    dot_code=dot_code,  # Store the original code as backup
                    customer_lev1=row.get('CUST_LEV1', ''),
                    customer_lev2=row.get('CUST_LEV2', ''),
                    customer_lev3=row.get('CUST_LEV3', ''),
                    department=row.get('DEPARTEMENT', '')
                )
                saved_count += 1
            except Exception as e:
                logger.error(f"Error saving CADNT record: {str(e)}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to CADNT")
        return saved_count

    def _save_ca_rfd(self, invoice, data):
        """Save data to CARFD model"""
        saved_count = 0
        for row in data:
            dot_code = row.get('DO', '')

            # Get or create DOT instance
            dot_instance = None
            if dot_code:
                try:
                    dot_instance, _ = DOT.objects.get_or_create(
                        code=dot_code,
                        defaults={'name': dot_code}
                    )
                except Exception as e:
                    logger.warning(
                        f"Error getting/creating DOT with code {dot_code}: {str(e)}")

            try:
                # Parse date if available
                entry_date = None
                if 'ENTRY_DATE' in row and row['ENTRY_DATE']:
                    try:
                        entry_date = self._parse_datetime(row['ENTRY_DATE'])
                    except:
                        pass

                # Create CARFD record with only the fields that exist in the model
                CARFD.objects.create(
                    invoice=invoice,
                    pri_identity=row.get('PRI_IDENTITY', ''),
                    customer_code=row.get('CUST_CODE', ''),
                    full_name=row.get('FULL_NAME', ''),
                    transaction_id=row.get('TRANS_ID', ''),
                    actel=row.get('ACTEL', ''),
                    dot=dot_instance,
                    dot_code=dot_code,  # Store the original code as backup
                    total_amount=row.get('TTC', 0),
                    droit_timbre=row.get('DROIT_TIMBRE', 0),
                    tax_amount=row.get('TVA', 0),
                    amount_pre_tax=row.get('HT', 0),
                    entry_date=entry_date,
                    customer_lev1=row.get('CUST_LEV1', ''),
                    customer_lev2=row.get('CUST_LEV2', ''),
                    customer_lev3=row.get('CUST_LEV3', ''),
                    department=row.get('DEPARTEMENT', '')
                )
                saved_count += 1
            except Exception as e:
                logger.error(f"Error saving CARFD record: {str(e)}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to CARFD")
        return saved_count

    def _save_ca_cnt(self, invoice, data):
        """Save data to CACNT model"""
        saved_count = 0
        for row in data:
            dot_code = row.get('DO', '')

            # Get or create DOT instance
            dot_instance = None
            if dot_code:
                try:
                    dot_instance, _ = DOT.objects.get_or_create(
                        code=dot_code,
                        defaults={'name': dot_code}
                    )
                except Exception as e:
                    logger.warning(
                        f"Error getting/creating DOT with code {dot_code}: {str(e)}")

            try:
                # Parse date if available
                entry_date = None
                if 'ENTRY_DATE' in row and row['ENTRY_DATE']:
                    try:
                        entry_date = self._parse_datetime(row['ENTRY_DATE'])
                    except:
                        pass

                # Create CACNT record with only the fields that exist in the model
                CACNT.objects.create(
                    invoice=invoice,
                    invoice_adjusted=row.get('INVOICE_ADJUSTED', ''),
                    pri_identity=row.get('PRI_IDENTITY', ''),
                    customer_code=row.get('CUST_CODE', ''),
                    full_name=row.get('FULL_NAME', ''),
                    transaction_id=row.get('TRANS_ID', ''),
                    transaction_type=row.get('TRANS_TYPE', ''),
                    channel_id=row.get('CHANNEL_ID', ''),
                    total_amount=row.get('TTC', 0),
                    tax_amount=row.get('TVA', 0),
                    amount_pre_tax=row.get('HT', 0),
                    entry_date=entry_date,
                    actel=row.get('ACTEL', ''),
                    dot=dot_instance,
                    dot_code=dot_code,  # Store the original code as backup
                    customer_lev1=row.get('CUST_LEV1', ''),
                    customer_lev2=row.get('CUST_LEV2', ''),
                    customer_lev3=row.get('CUST_LEV3', ''),
                    department=row.get('DEPARTEMENT', '')
                )
                saved_count += 1
            except Exception as e:
                logger.error(f"Error saving CACNT record: {str(e)}")
                # Continue with next record

        logger.info(f"Saved {saved_count} records to CACNT")
        return saved_count

    def _parse_date(self, date_value):
        """Parse a date value from various formats"""
        if not date_value:
            return None

        if isinstance(date_value, datetime):
            return date_value.date()

        if isinstance(date_value, str):
            # Try to handle ISO format with T separator first
            if 'T' in date_value:
                try:
                    return datetime.fromisoformat(date_value.replace('Z', '+00:00')).date()
                except ValueError:
                    pass

            # Try to handle French abbreviated month formats like "20 févr. 24"
            french_months = {
                'janv.': '01', 'févr.': '02', 'mars': '03', 'avr.': '04',
                'mai': '05', 'juin': '06', 'juil.': '07', 'août': '08',
                'sept.': '09', 'oct.': '10', 'nov.': '11', 'déc.': '12'
            }

            for month_fr, month_num in french_months.items():
                if month_fr in date_value.lower():
                    try:
                        # Extract day and year
                        parts = date_value.split()
                        day = parts[0]
                        year = parts[-1]

                        # Handle 2-digit year
                        if len(year) == 2:
                            year = f"20{year}"

                        # Create a standard format date
                        standard_date = f"{day}/{month_num}/{year}"
                        return datetime.strptime(standard_date, "%d/%m/%Y").date()
                    except (ValueError, IndexError):
                        pass

            # Try different date formats
            formats = [
                '%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y',
                '%d.%m.%Y', '%d %b %Y', '%d %B %Y',
                '%m/%d/%Y', '%Y/%m/%d', '%d-%b-%Y',
                '%d %b. %Y', '%d %B, %Y'
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(date_value, fmt).date()
                except ValueError:
                    continue

            return None

    def _parse_datetime(self, datetime_value):
        """Parse a datetime value from various formats"""
        if not datetime_value:
            return None

        if isinstance(datetime_value, datetime):
            return datetime_value

        if isinstance(datetime_value, str):
            # Try different datetime formats
            formats = [
                '%Y-%m-%d %H:%M:%S',
                '%d/%m/%Y %H:%M:%S',
                '%d-%m-%Y %H:%M:%S',
                '%d.%m.%Y %H:%M:%S',
                '%d %b %Y %H:%M:%S',
                '%d %B %Y %H:%M:%S'
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(datetime_value, fmt)
                except ValueError:
                    continue

            return None


class InvoiceInspectView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            # Get the invoice
            invoice = get_object_or_404(
                Invoice, pk=pk, uploaded_by=request.user)

            # Get the file path
            file_path = invoice.file.path
            file_name = os.path.basename(invoice.file.name)

            # Process the file to get preview data and summary
            processor = FileProcessor()

            # If the invoice already has a file type, use it
            if invoice.file_type:
                # Map file type to processing method
                file_type_map = {
                    'facturation_manuelle': 'process_facturation_manuelle',
                    'ca_periodique': 'process_ca_periodique',
                    'ca_non_periodique': 'process_ca_non_periodique',
                    'ca_dnt': 'process_ca_dnt',
                    'ca_rfd': 'process_ca_rfd',
                    'ca_cnt': 'process_ca_cnt',
                    'parc_corporate': 'process_parc_corporate',
                    'creances_ngbss': 'process_creances_ngbss',
                    'etat_facture': 'process_etat_facture',
                    'journal_ventes': 'process_journal_ventes'
                }

                algorithm = file_type_map.get(
                    invoice.file_type, 'process_generic')
                processing_method = getattr(
                    processor, algorithm, processor.process_generic)
                preview_data, summary_data = processing_method(file_path)
            else:
                # Let the processor automatically detect and process
                preview_data, summary_data = processor.process_file(
                    file_path, file_name)

            # Update the invoice with the detected file type
            if summary_data and 'detected_file_type' in summary_data:
                invoice.file_type = summary_data['detected_file_type']
                invoice.detection_confidence = summary_data.get(
                    'detection_confidence', 0.0)
                invoice.save()

            # Make sure all NaN values are handled before returning the response
            preview_data = handle_nan_values(preview_data)
            summary_data = handle_nan_values(summary_data)

            # Return the response
            return Response({
                'preview_data': preview_data,  # Return all processed data
                'summary_data': summary_data,
                'file_name': file_name,
                'file_type': invoice.file_type,
                'detection_confidence': invoice.detection_confidence
            })

        except Exception as e:
            logger.error(f"Error inspecting invoice {pk}: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DebugUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            # Try to access the file directly from request.FILES
            if 'file' in request.FILES:
                file = request.FILES['file']
                logger.info(
                    f"Debug upload - File name: {file.name}, Size: {file.size}, Content type: {file.content_type}")

                # Don't save the file, just return success
                return Response({
                    "message": "File received successfully",
                    "size": file.size,
                    "name": file.name,
                    "content_type": file.content_type
                }, status=200)
            else:
                logger.error("No file found in request.FILES")
                return Response({"error": "No file provided"}, status=400)

        except Exception as e:
            logger.error(f"Debug upload error: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({"error": str(e)}, status=500)


class FacturationManuelleListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FacturationManuelleSerializer

    def get_queryset(self):
        """
        This view should return a list of all facturation manuelle records
        for the currently authenticated user.
        """
        user = self.request.user

        # Get query parameters
        invoice_id = self.request.query_params.get('invoice_id', None)
        fiscal_year = self.request.query_params.get('fiscal_year', None)
        department = self.request.query_params.get('department', None)

        # Start with all records for this user
        queryset = FacturationManuelle.objects.filter(
            invoice__uploaded_by=user)

        # Apply filters if provided
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        if fiscal_year:
            queryset = queryset.filter(fiscal_year=fiscal_year)
        if department:
            queryset = queryset.filter(department=department)

        return queryset


class FacturationManuelleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FacturationManuelleSerializer

    def get_queryset(self):
        """
        This view should return facturation manuelle records
        for the currently authenticated user.
        """
        user = self.request.user
        return FacturationManuelle.objects.filter(invoice__uploaded_by=user)


class JournalVentesListView(DOTPermissionMixin, generics.ListAPIView):
    """API view for listing Journal des Ventes data"""
    permission_classes = [IsAuthenticated]
    serializer_class = JournalVentesSerializer
    pagination_class = StandardResultsSetPagination
    dot_field = 'dot'  # Specify the field name for DOT in this model
    queryset = JournalVentes.objects.all()  # Add this line to fix the error

    def get_queryset(self):
        """
        Override to apply filters and sorting.
        """
        queryset = super().get_queryset()

        # Apply filters from query parameters
        filters = {}

        # Filter by invoice date range
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')

        if from_date:
            try:
                from_date = datetime.strptime(from_date, '%Y-%m-%d').date()
                filters['invoice_date__gte'] = from_date
            except ValueError:
                pass

        if to_date:
            try:
                to_date = datetime.strptime(to_date, '%Y-%m-%d').date()
                filters['invoice_date__lte'] = to_date
            except ValueError:
                pass

        # Filter by invoice number (partial match)
        invoice_number = self.request.query_params.get('invoice_number')
        if invoice_number:
            filters['invoice_number__icontains'] = invoice_number

        # Filter by client (partial match)
        client = self.request.query_params.get('client')
        if client:
            filters['client__icontains'] = client

        # Filter by organization (partial match)
        organization = self.request.query_params.get('organization')
        if organization:
            filters['organization__icontains'] = organization

        # Apply all filters
        return queryset.filter(**filters).order_by('-invoice_date')


class JournalVentesDetailView(generics.RetrieveUpdateDestroyAPIView):
    """API view for retrieving, updating or deleting a Journal des Ventes record"""
    permission_classes = [IsAuthenticated]
    serializer_class = JournalVentesSerializer

    def get_queryset(self):
        """
        This view should return journal ventes records
        for the currently authenticated user.
        """
        user = self.request.user
        return JournalVentes.objects.filter(invoice__uploaded_by=user)


class EtatFactureListView(DOTPermissionMixin, generics.ListAPIView):
    """API view for listing Etat de Facture et Encaissement data"""
    permission_classes = [IsAuthenticated]
    serializer_class = EtatFactureSerializer
    dot_field = 'dot'  # Specify the field name for DOT in this model
    queryset = EtatFacture.objects.all()

    def get_queryset(self):
        queryset = super().get_queryset()

        # Apply additional filters from query parameters
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')

        if year:
            queryset = queryset.filter(year=year)
        if month:
            queryset = queryset.filter(month=month)

        # Get the invoice parameter from the request
        invoice_id = self.request.query_params.get('invoice')
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        return queryset


class EtatFactureDetailView(generics.RetrieveUpdateDestroyAPIView):
    """API view for retrieving, updating or deleting an Etat de Facture record"""
    permission_classes = [IsAuthenticated]
    serializer_class = EtatFactureSerializer

    def get_queryset(self):
        """
        This view should return etat facture records
        for the currently authenticated user.
        """
        user = self.request.user
        return EtatFacture.objects.filter(invoice__uploaded_by=user)


class FileTypeListView(APIView):
    """API view for listing available file types"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return a list of all available file types"""
        file_types = []

        # Get file types from FILE_TYPE_PATTERNS
        for file_type, patterns in FILE_TYPE_PATTERNS.items():
            display_name = file_type.replace('_', ' ').title()
            file_types.append({
                'id': file_type,
                'name': display_name,
                'patterns': patterns
            })

        return Response(file_types)


# Add these classes for the remaining models
class ParcCorporateListView(DOTPermissionMixin, generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ParcCorporateSerializer
    dot_field = 'dot'  # Specify the field name for DOT in this model
    queryset = ParcCorporate.objects.all()  # Add this line to fix the error

    def get_queryset(self):
        """
        Override to apply filters and sorting.
        """
        queryset = super().get_queryset()

        # Apply filters from query parameters
        filters = {}

        # Filter by creation date range
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')

        if from_date:
            try:
                from_date = datetime.strptime(from_date, '%Y-%m-%d').date()
                filters['creation_date__gte'] = from_date
            except ValueError:
                pass

        if to_date:
            try:
                to_date = datetime.strptime(to_date, '%Y-%m-%d').date()
                filters['creation_date__lte'] = to_date
            except ValueError:
                pass

        # Filter by customer full name (partial match)
        customer = self.request.query_params.get('customer')
        if customer:
            filters['customer_full_name__icontains'] = customer

        # Filter by state (DOT)
        state = self.request.query_params.get('state')
        if state:
            filters['state__icontains'] = state

        # Filter by offer name
        offer = self.request.query_params.get('offer')
        if offer:
            filters['offer_name__icontains'] = offer

        # Filter by subscriber status
        status = self.request.query_params.get('status')
        if status:
            filters['subscriber_status'] = status

        # Apply all filters
        return queryset.filter(**filters).order_by('-creation_date')


class ParcCorporateDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ParcCorporateSerializer

    def get_queryset(self):
        user = self.request.user
        return ParcCorporate.objects.filter(invoice__uploaded_by=user)


class CreancesNGBSSListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CreancesNGBSSSerializer

    def get_queryset(self):
        user = self.request.user
        invoice_id = self.request.query_params.get('invoice_id', None)

        queryset = CreancesNGBSS.objects.filter(invoice__uploaded_by=user)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        return queryset


class CreancesNGBSSDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CreancesNGBSSSerializer

    def get_queryset(self):
        user = self.request.user
        return CreancesNGBSS.objects.filter(invoice__uploaded_by=user)


class CAPeriodiqueListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CAPeriodiqueSerializer

    def get_queryset(self):
        user = self.request.user
        invoice_id = self.request.query_params.get('invoice_id', None)
        queryset = CAPeriodique.objects.filter(invoice__uploaded_by=user)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        return queryset


class CAPeriodiqueDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CAPeriodiqueSerializer

    def get_queryset(self):
        user = self.request.user
        return CAPeriodique.objects.filter(invoice__uploaded_by=user)


class CANonPeriodiqueListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CANonPeriodiqueSerializer

    def get_queryset(self):
        user = self.request.user
        invoice_id = self.request.query_params.get('invoice_id', None)

        queryset = CANonPeriodique.objects.filter(invoice__uploaded_by=user)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        return queryset


class CANonPeriodiqueDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CANonPeriodiqueSerializer

    def get_queryset(self):
        user = self.request.user
        return CANonPeriodique.objects.filter(invoice__uploaded_by=user)


class CADNTListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CADNTSerializer

    def get_queryset(self):
        user = self.request.user
        invoice_id = self.request.query_params.get('invoice_id', None)

        queryset = CADNT.objects.filter(invoice__uploaded_by=user)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        return queryset


class CADNTDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CADNTSerializer

    def get_queryset(self):
        user = self.request.user
        return CADNT.objects.filter(invoice__uploaded_by=user)


class CARFDListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CARFDSerializer

    def get_queryset(self):
        user = self.request.user
        invoice_id = self.request.query_params.get('invoice_id', None)

        queryset = CARFD.objects.filter(invoice__uploaded_by=user)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        return queryset


class CARFDDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CARFDSerializer

    def get_queryset(self):
        user = self.request.user
        return CARFD.objects.filter(invoice__uploaded_by=user)


class CACNTListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CACNTSerializer

    def get_queryset(self):
        user = self.request.user
        invoice_id = self.request.query_params.get('invoice_id', None)

        queryset = CACNT.objects.filter(invoice__uploaded_by=user)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        return queryset


class CACNTDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CACNTSerializer

    def get_queryset(self):
        user = self.request.user
        return CACNT.objects.filter(invoice__uploaded_by=user)


class InvoiceSummaryView(APIView):
    """API view for getting summary data for an invoice without fetching all processed data"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            # Get the invoice
            invoice = get_object_or_404(
                Invoice, pk=pk, uploaded_by=request.user)

            # Check if the user has permission to access this invoice
            if invoice.uploaded_by != request.user and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to access this invoice"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Get the file path
            file_path = invoice.file.path
            file_name = os.path.basename(invoice.file.name)

            # Use the file processor to get summary data
            processor = FileProcessor()

            # Map file type to processing method
            file_type_map = {
                'facturation_manuelle': 'process_facturation_manuelle',
                'ca_periodique': 'process_ca_periodique',
                'ca_non_periodique': 'process_ca_non_periodique',
                'ca_dnt': 'process_ca_dnt',
                'ca_rfd': 'process_ca_rfd',
                'ca_cnt': 'process_ca_cnt',
                'parc_corporate': 'process_parc_corporate',
                'creances_ngbss': 'process_creances_ngbss',
                'etat_facture': 'process_etat_facture',
                'journal_ventes': 'process_journal_ventes'
            }

            # Get row counts from database
            data_counts = {}

            # Check each related model and count rows
            if invoice.file_type == 'facturation_manuelle':
                data_counts['facturation_manuelle'] = FacturationManuelle.objects.filter(
                    invoice=invoice).count()
            elif invoice.file_type == 'journal_ventes':
                data_counts['journal_ventes'] = JournalVentes.objects.filter(
                    invoice=invoice).count()
            elif invoice.file_type == 'etat_facture':
                data_counts['etat_facture'] = EtatFacture.objects.filter(
                    invoice=invoice).count()
            elif invoice.file_type == 'parc_corporate':
                data_counts['parc_corporate'] = ParcCorporate.objects.filter(
                    invoice=invoice).count()
            elif invoice.file_type == 'creances_ngbss':
                data_counts['creances_ngbss'] = CreancesNGBSS.objects.filter(
                    invoice=invoice).count()
            elif invoice.file_type == 'ca_periodique':
                data_counts['ca_periodique'] = CAPeriodique.objects.filter(
                    invoice=invoice).count()
            elif invoice.file_type == 'ca_non_periodique':
                data_counts['ca_non_periodique'] = CANonPeriodique.objects.filter(
                    invoice_id=invoice).count()
            elif invoice.file_type == 'ca_dnt':
                data_counts['ca_dnt'] = CADNT.objects.filter(
                    invoice=invoice).count()
            elif invoice.file_type == 'ca_rfd':
                data_counts['ca_rfd'] = CARFD.objects.filter(
                    invoice=invoice).count()
            elif invoice.file_type == 'ca_cnt':
                data_counts['ca_cnt'] = CACNT.objects.filter(
                    invoice=invoice).count()

            # Get processed data count
            processed_data_count = ProcessedInvoiceData.objects.filter(
                invoice=invoice).count()
            data_counts['processed_data'] = processed_data_count

            # Get basic file info
            file_info = {
                'file_name': file_name,
                'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
                'file_type': invoice.file_type,
                'detection_confidence': invoice.detection_confidence,
                'upload_date': invoice.upload_date,
                'status': invoice.status,
                'processed_date': invoice.processed_date,
                'data_counts': data_counts
            }

            # If the invoice is in saved state, we don't need to process the file again
            if invoice.status == 'saved':
                return Response(file_info)

            # If not saved, try to get summary data by processing the file
            try:
                algorithm = file_type_map.get(
                    invoice.file_type, 'process_generic')
                processing_method = getattr(
                    processor, algorithm, processor.process_generic)
                _, summary_data = processing_method(file_path)

                # Handle NaN values
                summary_data = handle_nan_values(summary_data)

                # Add summary data to response
                file_info['summary_data'] = summary_data
            except Exception as e:
                logger.warning(f"Could not generate summary data: {str(e)}")
                file_info['summary_error'] = str(e)

            return Response(file_info)

        except Exception as e:
            logger.error(f"Error getting invoice summary: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {"error": f"Failed to get invoice summary: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ExportDataView(APIView):
    """
    API view for exporting data in various formats
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        try:
            # Get query parameters
            data_type = request.query_params.get('data_type', 'revenue')
            export_format = request.query_params.get('format', 'excel')
            year = request.query_params.get('year', datetime.now().year)
            month = request.query_params.get('month', None)
            dot = request.query_params.get('dot', None)

            # Get data based on data_type
            if data_type == 'revenue':
                data = self._get_revenue_data(year, month, dot)
            elif data_type == 'collection':
                data = self._get_collection_data(year, month, dot)
            elif data_type == 'receivables':
                data = self._get_receivables_data(year, month, dot)
            elif data_type == 'corporate_park':
                data = self._get_corporate_park_data(year, month, dot)
            else:
                return Response(
                    {'error': f"Invalid data_type: {data_type}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Export data in the requested format
            if export_format == 'excel':
                return self._export_excel(data, data_type)
            elif export_format == 'csv':
                return self._export_csv(data, data_type)
            elif export_format == 'pdf':
                return self._export_pdf(data, data_type)
            else:
                return Response(
                    {'error': f"Invalid format: {export_format}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"Error exporting data: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _get_revenue_data(self, year, month, dot):
        # Query JournalVentes for revenue data
        query = JournalVentes.objects.all()
        if year:
            query = query.filter(invoice_date__year=year)
        if month:
            query = query.filter(invoice_date__month=month)
        if dot:
            query = query.filter(organization__icontains=dot)

        # Serialize the data
        serializer = JournalVentesSerializer(query, many=True)
        return serializer.data

    def _get_collection_data(self, year, month, dot):
        """
        Get collection data for export

        Args:
            year: The year to filter by
            month: The month to filter by
            dot: The DOT to filter by

        Returns:
            Serialized collection data
        """
        # Query EtatFacture for collection data
        query = EtatFacture.objects.all()
        if year:
            query = query.filter(invoice_date__year=year)
        if month:
            query = query.filter(invoice_date__month=month)
        if dot:
            query = query.filter(organization__icontains=dot)

        # Serialize the data
        serializer = EtatFactureSerializer(query, many=True)
        return serializer.data

    def _get_receivables_data(self, year, month, dot):
        """
        Get receivables data for export

        Args:
            year: The year to filter by
            month: The month to filter by
            dot: The DOT to filter by

        Returns:
            Serialized receivables data
        """
        # Query CreancesNGBSS for receivables data
        query = CreancesNGBSS.objects.all()
        if year:
            query = query.filter(year=year)
        if month:
            query = query.filter(month=month)
        if dot:
            query = query.filter(dot__icontains=dot)

        # Serialize the data
        serializer = CreancesNGBSSSerializer(query, many=True)
        return serializer.data

    def _get_corporate_park_data(self, year, month, dot):
        """
        Get corporate park data for export

        Args:
            year: The year to filter by
            month: The month to filter by
            dot: The DOT to filter by

        Returns:
            Serialized corporate park data
        """
        # Query ParcCorporate for corporate park data
        query = ParcCorporate.objects.all()
        if year and month:
            # Filter by creation_date year and month
            query = query.filter(
                creation_date__year=year,
                creation_date__month=month
            )
        if dot:
            query = query.filter(state__icontains=dot)

        # Serialize the data
        serializer = ParcCorporateSerializer(query, many=True)
        return serializer.data

    def _export_excel(self, data, data_type):
        # Create an in-memory output file
        output = io.BytesIO()

        # Create a workbook and add a worksheet
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet(data_type.capitalize())

        # Add headers
        headers = list(data[0].keys()) if data else []
        for col, header in enumerate(headers):
            worksheet.write(0, col, header)

        # Add data
        for row, item in enumerate(data, 1):
            for col, header in enumerate(headers):
                worksheet.write(row, col, item.get(header, ''))

        # Close the workbook
        workbook.close()

        # Prepare response
        output.seek(0)
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{data_type}_{datetime.now().strftime("%Y%m%d")}.xlsx"'

        return response

    def _export_csv(self, data, data_type):
        """
        Export data as CSV file

        Args:
            data: The data to export
            data_type: The type of data being exported (used for filename)

        Returns:
            HttpResponse with CSV content
        """
        # Create CSV response
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{data_type}_{datetime.now().strftime("%Y%m%d")}.csv"'

        # Create CSV writer
        writer = csv.writer(response)

        # Write headers
        if data:
            headers = data[0].keys()
            writer.writerow(headers)

            # Write data rows
            for item in data:
                writer.writerow([item.get(header, '') for header in headers])

        return response

    def _export_pdf(self, data, data_type):
        """
        Export data as PDF file

        Args:
            data: The data to export
            data_type: The type of data being exported (used for filename and title)

        Returns:
            HttpResponse with PDF content
        """
        # Create PDF response
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{data_type}_{datetime.now().strftime("%Y%m%d")}.pdf"'

        # Create PDF document
        buffer = io.BytesIO()
        p = canvas.Canvas(buffer, pagesize=letter)

        # Add title
        p.setFont("Helvetica-Bold", 16)
        p.drawString(30, 750, f"{data_type.capitalize()} Report")
        p.setFont("Helvetica", 12)

        # Add date
        p.drawString(
            30, 730, f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Add data
        y = 700
        if data:
            headers = list(data[0].keys())

            # Draw headers
            x = 30
            p.setFont("Helvetica-Bold", 10)
            for header in headers[:5]:  # Limit to 5 columns for readability
                p.drawString(x, y, header)
                x += 100

            # Draw data rows
            p.setFont("Helvetica", 10)
            y -= 20
            for item in data[:30]:  # Limit to 30 rows for simplicity
                x = 30
                for header in headers[:5]:
                    value = str(item.get(header, ''))
                    if len(value) > 15:
                        value = value[:12] + '...'
                    p.drawString(x, y, value)
                    x += 100
                y -= 20
                if y < 50:
                    p.showPage()
                    p.setFont("Helvetica", 10)
                    y = 750

        p.save()
        pdf = buffer.getvalue()
        buffer.close()
        response.write(pdf)

        return response


class AnomalyListView(generics.ListAPIView):
    """API view for listing anomalies"""
    permission_classes = [IsAuthenticated]
    serializer_class = AnomalySerializer

    def get_queryset(self):
        """
        Return a filtered queryset of anomalies based on query parameters
        """
        queryset = Anomaly.objects.all()

        # Filter by invoice ID
        invoice_id = self.request.query_params.get('invoice', None)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        # Filter by anomaly type
        anomaly_type = self.request.query_params.get('type', None)
        if anomaly_type:
            queryset = queryset.filter(type=anomaly_type)

        # Filter by status
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)

        # Filter by date range
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)

        if start_date:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                queryset = queryset.filter(created_at__gte=start_date)
            except ValueError:
                pass

        if end_date:
            try:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                # Add one day to include the end date
                end_date = end_date + timezone.timedelta(days=1)
                queryset = queryset.filter(created_at__lt=end_date)
            except ValueError:
                pass

        # Search by description
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(description__icontains=search)

        # Order by created_at by default (newest first)
        return queryset.order_by('-created_at')


class AnomalyDetailView(generics.RetrieveUpdateAPIView):
    """API view for retrieving and updating an anomaly"""
    permission_classes = [IsAuthenticated]
    serializer_class = AnomalySerializer
    queryset = Anomaly.objects.all()

    def update(self, request, *args, **kwargs):
        """
        Update an anomaly, including status changes and resolution notes
        """
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # If status is being changed to 'resolved', set the resolved_by field
        if 'status' in request.data and request.data['status'] == 'resolved':
            request.data['resolved_by'] = request.user.id

        serializer = self.get_serializer(
            instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Log the anomaly update
        logger.info(f"Anomaly {instance.id} updated by {request.user.email}: "
                    f"Status changed to {instance.status}")

        return Response(serializer.data)


class AnomalyResolveView(APIView):
    """API view for resolving an anomaly"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """
        Mark an anomaly as resolved with resolution notes
        """
        try:
            anomaly = get_object_or_404(Anomaly, pk=pk)

            # Check if already resolved
            if anomaly.status == 'resolved':
                return Response({
                    'error': 'Anomaly is already resolved'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get resolution notes
            resolution_notes = request.data.get('resolution_notes', '')
            if not resolution_notes:
                return Response({
                    'error': 'Resolution notes are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Update the anomaly
            anomaly.status = 'resolved'
            anomaly.resolved_by = request.user
            anomaly.resolution_notes = resolution_notes
            anomaly.save()

            # Log the resolution
            logger.info(
                f"Anomaly {pk} resolved by {request.user.email}: {resolution_notes}")

            # Return the updated anomaly
            serializer = AnomalySerializer(anomaly)
            return Response(serializer.data)

        except Exception as e:
            logger.error(f"Error resolving anomaly: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProgressTrackerView(APIView):
    """API view for tracking progress of long-running operations"""
    permission_classes = [IsAuthenticated]

    def get(self, request, invoice_id=None):
        """Get progress information for an invoice"""
        try:
            if invoice_id:
                # Get progress for a specific invoice
                invoice = get_object_or_404(
                    Invoice, pk=invoice_id, uploaded_by=request.user)
                progress_trackers = ProgressTracker.objects.filter(
                    invoice=invoice).order_by('-start_time')

                # If there are no progress trackers, check the invoice status
                if not progress_trackers.exists():
                    return Response({
                        'invoice_id': invoice.id,
                        'status': invoice.status,
                        'message': invoice.error_message or f'Invoice status: {invoice.status}',
                        'progress_percent': 100 if invoice.status == 'saved' else 0
                    })

                # Get the latest progress tracker
                latest_tracker = progress_trackers.first()

                return Response({
                    'invoice_id': invoice.id,
                    'operation_type': latest_tracker.operation_type,
                    'status': latest_tracker.status,
                    'progress_percent': latest_tracker.progress_percent,
                    'current_item': latest_tracker.current_item,
                    'total_items': latest_tracker.total_items,
                    'message': latest_tracker.message or invoice.error_message
                })
            else:
                # Get progress for all invoices
                invoices = Invoice.objects.filter(
                    uploaded_by=request.user).order_by('-upload_date')[:10]
                results = []

                for invoice in invoices:
                    latest_tracker = ProgressTracker.objects.filter(
                        invoice=invoice).order_by('-start_time').first()

                    if latest_tracker:
                        results.append({
                            'invoice_id': invoice.id,
                            'invoice_number': invoice.invoice_number,
                            'status': latest_tracker.status,
                            'progress_percent': latest_tracker.progress_percent,
                            'message': latest_tracker.message or invoice.error_message
                        })
                    else:
                        results.append({
                            'invoice_id': invoice.id,
                            'invoice_number': invoice.invoice_number,
                            'status': invoice.status,
                            'progress_percent': 100 if invoice.status == 'saved' else 0,
                            'message': invoice.error_message or f'Invoice status: {invoice.status}'
                        })

                return Response(results)

        except Exception as e:
            logger.error(f"Error getting progress information: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnomalyStatsView(APIView):
    """API view for getting anomaly statistics"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get statistics about anomalies
        """
        try:
            # Get total counts
            total_anomalies = Anomaly.objects.count()
            open_anomalies = Anomaly.objects.filter(status='open').count()
            in_progress_anomalies = Anomaly.objects.filter(
                status='in_progress').count()
            resolved_anomalies = Anomaly.objects.filter(
                status='resolved').count()
            ignored_anomalies = Anomaly.objects.filter(
                status='ignored').count()

            # Get counts by type
            type_counts = Anomaly.objects.values(
                'type').annotate(count=Count('id'))

            # Get counts by invoice
            invoice_counts = Anomaly.objects.values(
                'invoice').annotate(count=Count('id'))

            # Get top invoices with anomalies
            top_invoices = []
            for item in invoice_counts.order_by('-count')[:5]:
                invoice_id = item['invoice']
                try:
                    invoice = Invoice.objects.get(id=invoice_id)
                    top_invoices.append({
                        'invoice_id': invoice_id,
                        'invoice_number': invoice.invoice_number,
                        'anomaly_count': item['count']
                    })
                except Invoice.DoesNotExist:
                    pass

            # Get recent anomalies
            recent_anomalies = Anomaly.objects.order_by('-created_at')[:5]
            recent_anomalies_data = AnomalySerializer(
                recent_anomalies, many=True).data

            return Response({
                'total_anomalies': total_anomalies,
                'by_status': {
                    'open': open_anomalies,
                    'in_progress': in_progress_anomalies,
                    'resolved': resolved_anomalies,
                    'ignored': ignored_anomalies
                },
                'by_type': list(type_counts),
                'top_invoices': top_invoices,
                'recent_anomalies': recent_anomalies_data
            })

        except Exception as e:
            logger.error(f"Error getting anomaly statistics: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AnomalyTypesView(APIView):
    """API view for getting anomaly types"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get all available anomaly types
        """
        try:
            # Get the anomaly types from the model choices
            types = [
                {'id': type_id, 'name': type_name}
                for type_id, type_name in Anomaly.ANOMALY_TYPES
            ]

            return Response({
                'types': types
            })

        except Exception as e:
            logger.error(f"Error getting anomaly types: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DatabaseAnomalyScanner:
    """
    Class for scanning the database to detect anomalies across records
    and between different data models.
    """

    def __init__(self):
        self.anomalies = []
        self.invoice = None  # Initialize invoice attribute

    def scan_all(self, invoice=None):
        """
        Run all anomaly detection scans

        Args:
            invoice: Optional Invoice object to limit the scan to a specific invoice

        Returns:
            List of detected anomalies
        """
        scan_methods = [
            self.scan_journal_ventes_duplicates,
            self.scan_etat_facture_duplicates,
            self.scan_revenue_outliers,
            self.scan_collection_outliers,
            self.scan_journal_etat_mismatches,
            self.scan_zero_values,
            self.scan_temporal_patterns,
            self.scan_empty_cells,
            self.scan_dot_field_validity  # Add the new scan method
        ]

        self.anomalies = []  # Reset anomalies list
        self.invoice = invoice  # Store invoice for filtering

        for scan_method in scan_methods:
            try:
                logger.info(f"Running scan: {scan_method.__name__}")
                scan_method()
            except Exception as e:
                logger.error(f"Error in {scan_method.__name__}: {str(e)}")
                logger.error(traceback.format_exc())
                # Continue with next scan method instead of failing completely

        return self.anomalies

    def scan_empty_cells(self):
        """
        Scan for empty cells in important fields across all data models
        """
        logger.info("Scanning for empty cells in important fields")

        # Define important fields for each model
        model_fields = {
            JournalVentes: ['invoice_number', 'invoice_date', 'client', 'revenue_amount'],
            EtatFacture: ['invoice_number', 'invoice_date', 'client', 'total_amount'],
            ParcCorporate: ['actel_code', 'customer_l1_code', 'customer_full_name'],
            CreancesNGBSS: ['dot', 'actel', 'invoice_amount', 'open_amount'],
            CAPeriodique: ['dot', 'product', 'amount_pre_tax', 'total_amount'],
            CANonPeriodique: ['dot', 'product', 'amount_pre_tax', 'total_amount'],
            CADNT: ['transaction_id', 'customer_code', 'full_name', 'total_amount'],
            CARFD: ['transaction_id', 'full_name', 'total_amount'],
            CACNT: ['transaction_id', 'customer_code',
                    'full_name', 'total_amount']
        }

        # Scan each model for empty important fields
        for model, fields in model_fields.items():
            queryset = model.objects.all()

            # Filter by invoice if specified
            if self.invoice:
                queryset = queryset.filter(invoice=self.invoice)

            # Limit to a reasonable number of records for performance
            queryset = queryset[:1000]

            for record in queryset:
                empty_fields = []

                for field in fields:
                    value = getattr(record, field, None)
                    # Check for None, empty string, or empty collections
                    if value is None or value == '' or (hasattr(value, '__len__') and len(value) == 0):
                        empty_fields.append(field)

                if empty_fields:
                    # Create an anomaly for this record with empty fields
                    self._create_anomaly(
                        invoice=record.invoice,
                        anomaly_type='missing_data',
                        description=f"Empty important fields in {model.__name__}: {', '.join(empty_fields)}",
                        data={
                            'model': model.__name__,
                            'record_id': record.id,
                            'empty_fields': empty_fields
                        }
                    )

    def scan_journal_ventes_duplicates(self):
        """Detect duplicate invoice numbers in Journal Ventes"""
        # Find records with the same invoice_number but different data
        duplicates = JournalVentes.objects.values('invoice_number', 'organization') \
            .annotate(count=Count('id')) \
            .filter(count__gt=1)

        for dup in duplicates:
            records = JournalVentes.objects.filter(
                invoice_number=dup['invoice_number'],
                organization=dup['organization']
            )

            # Check if these are true duplicates (different data)
            if self._has_different_values(records, ['revenue_amount', 'client']):
                self._create_anomaly(
                    records[0].invoice,
                    'duplicate_data',
                    f"Duplicate invoice number {dup['invoice_number']} in {dup['organization']} with different values",
                    {
                        'invoice_number': dup['invoice_number'],
                        'organization': dup['organization'],
                        'record_count': dup['count'],
                        'record_ids': list(records.values_list('id', flat=True))
                    }
                )

    def scan_revenue_outliers(self):
        """Detect statistical outliers in revenue amounts"""
        # For each organization, find revenue outliers
        orgs = JournalVentes.objects.values_list(
            'organization', flat=True).distinct()

        for org in orgs:
            # Get revenue statistics for this organization
            revenues = JournalVentes.objects.filter(organization=org) \
                .values_list('revenue_amount', flat=True)

            if len(revenues) < 5:  # Need enough data for meaningful statistics
                continue

            # Convert all values to float for calculations
            float_revenues = [float(x) for x in revenues]

            # Calculate mean and standard deviation
            mean = sum(float_revenues) / len(float_revenues)
            std_dev = (sum((x - mean) ** 2 for x in float_revenues) /
                       len(float_revenues)) ** 0.5

            # Find outliers (more than 3 standard deviations from mean)
            threshold = 3 * std_dev
            # Convert mean + threshold back to Decimal for database query
            threshold_value = mean + threshold

            outliers = JournalVentes.objects.filter(
                organization=org,
                revenue_amount__gt=threshold_value
            )

            for outlier in outliers:
                self._create_anomaly(
                    outlier.invoice,
                    'outlier',
                    f"Revenue outlier detected: {outlier.revenue_amount} (org mean: {mean:.2f})",
                    {
                        'record_id': outlier.id,
                        'invoice_number': outlier.invoice_number,
                        'organization': outlier.organization,
                        'revenue_amount': float(outlier.revenue_amount),
                        'mean_revenue': mean,
                        'std_dev': std_dev,
                        'z_score': float((float(outlier.revenue_amount) - mean) / std_dev)
                    }
                )

    def scan_journal_etat_mismatches(self):
        """Detect mismatches between Journal Ventes and Etat Facture"""
        # Find invoice numbers that exist in both tables
        journal_invoices = set(JournalVentes.objects.values_list(
            'invoice_number', 'organization'))
        etat_invoices = set(EtatFacture.objects.values_list(
            'invoice_number', 'organization'))

        # Find common invoice numbers
        common_invoices = journal_invoices.intersection(etat_invoices)

        for invoice_num, org in common_invoices:
            journal = JournalVentes.objects.filter(
                invoice_number=invoice_num, organization=org).first()
            etat = EtatFacture.objects.filter(
                invoice_number=invoice_num, organization=org).first()

            # Check for significant revenue discrepancies
            if journal and etat and abs(journal.revenue_amount - etat.revenue_amount) > 0.01:
                self._create_anomaly(
                    journal.invoice,
                    'inconsistent_data',
                    f"Revenue mismatch between Journal Ventes and Etat Facture for invoice {invoice_num}",
                    {
                        'invoice_number': invoice_num,
                        'organization': org,
                        'journal_revenue': float(journal.revenue_amount),
                        'etat_revenue': float(etat.revenue_amount),
                        'difference': float(journal.revenue_amount - etat.revenue_amount),
                        'journal_id': journal.id,
                        'etat_id': etat.id
                    }
                )

    def scan_zero_values(self):
        """Detect zero values in important financial fields"""
        # Check for zero revenue in Journal Ventes
        zero_revenue = JournalVentes.objects.filter(revenue_amount=0)

        for record in zero_revenue:
            self._create_anomaly(
                record.invoice,
                'invalid_data',
                f"Zero revenue amount for invoice {record.invoice_number} in {record.organization}",
                {
                    'record_id': record.id,
                    'invoice_number': record.invoice_number,
                    'organization': record.organization
                }
            )

        # Check for zero collection in Etat Facture
        zero_collection = EtatFacture.objects.filter(
            collection_amount=0,
            total_amount__gt=0  # Only flag if there was an amount to collect
        )

        for record in zero_collection:
            self._create_anomaly(
                record.invoice,
                'missing_data',
                f"Zero collection amount for invoice {record.invoice_number} with total {record.total_amount}",
                {
                    'record_id': record.id,
                    'invoice_number': record.invoice_number,
                    'organization': record.organization,
                    'total_amount': float(record.total_amount)
                }
            )

    def scan_temporal_patterns(self):
        """Detect unusual temporal patterns in data"""
        # Group by month and check for unusual drops or spikes
        current_year = datetime.now().year

        # Analyze monthly revenue patterns
        monthly_revenue = JournalVentes.objects.filter(
            invoice_date__year=current_year
        ).values('invoice_date__month').annotate(
            total=Sum('revenue_amount')
        ).order_by('invoice_date__month')

        if len(monthly_revenue) < 3:  # Need at least 3 months for trend analysis
            return

        # Convert to list for easier analysis
        revenues = [item['total'] for item in monthly_revenue]
        months = [item['invoice_date__month'] for item in monthly_revenue]

        # Check for significant drops (more than 50% from previous month)
        for i in range(1, len(revenues)):
            if revenues[i] < revenues[i-1] * 0.5:
                self._create_anomaly(
                    None,  # This is a system-level anomaly, not tied to a specific invoice
                    'outlier',
                    f"Significant revenue drop detected in month {months[i]}",
                    {
                        'month': months[i],
                        'current_revenue': float(revenues[i]),
                        'previous_revenue': float(revenues[i-1]),
                        'drop_percentage': float((revenues[i-1] - revenues[i]) / revenues[i-1] * 100)
                    }
                )

    def scan_collection_outliers(self):
        """Detect statistical outliers in collection amounts"""
        # For each organization, find collection outliers
        orgs = EtatFacture.objects.values_list(
            'organization', flat=True).distinct()

        for org in orgs:
            # Get collection statistics for this organization
            collections = EtatFacture.objects.filter(organization=org) \
                .values_list('collection_amount', flat=True)

            if len(collections) < 5:  # Need enough data for meaningful statistics
                continue

            # Calculate mean and standard deviation
            mean = sum(collections) / len(collections)
            # Convert Decimal to float before performing power operations
            std_dev = (sum((float(x) - float(mean)) ** 2 for x in collections) /
                       len(collections)) ** 0.5

            # Find outliers (more than 3 standard deviations from mean)
            threshold = 3 * std_dev
            outliers = EtatFacture.objects.filter(
                organization=org,
                collection_amount__gt=mean + threshold
            )

            for outlier in outliers:
                self._create_anomaly(
                    outlier.invoice,
                    'outlier',
                    f"Collection outlier detected: {outlier.collection_amount} (org mean: {mean:.2f})",
                    {
                        'record_id': outlier.id,
                        'invoice_number': outlier.invoice_number,
                        'organization': outlier.organization,
                        'collection_amount': float(outlier.collection_amount),
                        'mean_collection': float(mean),
                        'std_dev': float(std_dev),
                        'z_score': float((outlier.collection_amount - mean) / std_dev)
                    }
                )

    def scan_etat_facture_duplicates(self):
        """Detect duplicate invoice numbers in Etat Facture"""
        # Find records with the same invoice_number but different data
        duplicates = EtatFacture.objects.values('invoice_number', 'organization') \
            .annotate(count=Count('id')) \
            .filter(count__gt=1)

        for dup in duplicates:
            records = EtatFacture.objects.filter(
                invoice_number=dup['invoice_number'],
                organization=dup['organization']
            )

            # Check if these are true duplicates (different data)
            if self._has_different_values(records, ['total_amount', 'client']):
                self._create_anomaly(
                    records[0].invoice,
                    'duplicate_data',
                    f"Duplicate invoice number {dup['invoice_number']} in {dup['organization']} with different values",
                    {
                        'invoice_number': dup['invoice_number'],
                        'organization': dup['organization'],
                        'record_count': dup['count'],
                        'record_ids': list(records.values_list('id', flat=True))
                    }
                )

    def _has_different_values(self, queryset, fields):
        """Check if records have different values for specified fields"""
        values = set()
        for record in queryset:
            value_tuple = tuple(getattr(record, field) for field in fields)
            values.add(value_tuple)
        return len(values) > 1

    def _create_anomaly(self, invoice, anomaly_type, description, data):
        """Create an anomaly record"""
        # For system-level anomalies without a specific invoice, use the most recent
        if invoice is None:
            invoice = Invoice.objects.order_by('-upload_date').first()
            if invoice is None:
                return  # No invoices in system, can't create anomaly

        # Create the anomaly
        anomaly = Anomaly.objects.create(
            invoice=invoice,
            type=anomaly_type,
            description=description,
            data=data,
            status='open'
        )

        self.anomalies.append(anomaly)
        return anomaly

    def _detect_journal_ventes_anomalies(self, data):
        """
        Detect anomalies in Journal des ventes data:
        - Identify cells starting with "@" in Obj Fact
        - Identify cells with dates ending with previous year in "Période de facturation"
        - Identify records with zero revenue
        - Identify records with missing important fields

        Args:
            data: List of JournalVentes records

        Returns:
            List of detected anomalies
        """
        anomalies = []
        current_year = datetime.now().year
        previous_year = current_year - 1

        for record in data:
            # Check for cells starting with "@" in Obj Fact
            obj_fact = record.invoice_object if hasattr(
                record, 'invoice_object') else record.get('invoice_object', '')
            if obj_fact and isinstance(obj_fact, str) and obj_fact.startswith('@'):
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f"Invoice object starts with '@' (previous year invoice): {obj_fact}",
                    'record_id': record.id if hasattr(record, 'id') else record.get('id'),
                    'invoice_number': record.invoice_number if hasattr(record, 'invoice_number') else record.get('invoice_number', '')
                })

            # Check for dates ending with previous year in "Période de facturation"
            billing_period = record.billing_period if hasattr(
                record, 'billing_period') else record.get('billing_period', '')
            if billing_period and isinstance(billing_period, str) and str(previous_year) in billing_period:
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f"Billing period contains previous year: {billing_period}",
                    'record_id': record.id if hasattr(record, 'id') else record.get('id'),
                    'invoice_number': record.invoice_number if hasattr(record, 'invoice_number') else record.get('invoice_number', '')
                })

            # Check for zero revenue
            revenue_amount = record.revenue_amount if hasattr(
                record, 'revenue_amount') else record.get('revenue_amount', 0)
            if revenue_amount == 0:
                anomalies.append({
                    'type': 'zero_value',
                    'description': f"Zero revenue amount for invoice {record.invoice_number if hasattr(record, 'invoice_number') else record.get('invoice_number', '')}",
                    'record_id': record.id if hasattr(record, 'id') else record.get('id'),
                    'invoice_number': record.invoice_number if hasattr(record, 'invoice_number') else record.get('invoice_number', '')
                })

            # Check for missing important fields
            important_fields = ['invoice_number',
                                'invoice_date', 'client', 'revenue_amount']
            missing_fields = []

            for field in important_fields:
                value = getattr(record, field, None) if hasattr(
                    record, field) else record.get(field)
                if value is None or value == '' or (hasattr(value, '__len__') and len(value) == 0):
                    missing_fields.append(field)

            if missing_fields:
                anomalies.append({
                    'type': 'missing_data',
                    'description': f"Missing important fields: {', '.join(missing_fields)}",
                    'record_id': record.id if hasattr(record, 'id') else record.get('id'),
                    'invoice_number': record.invoice_number if hasattr(record, 'invoice_number') else record.get('invoice_number', ''),
                    'missing_fields': missing_fields
                })

        return anomalies

    def _detect_etat_facture_anomalies(self, data):
        """
        Detect anomalies in Etat de facture data:
        - Identify duplicate invoices (partial collection)
        - Identify records with zero collection amount but non-zero total amount
        - Identify records with missing important fields

        Args:
            data: List of EtatFacture records

        Returns:
            List of detected anomalies
        """
        anomalies = []

        # Track duplicates
        invoice_counts = {}

        for record in data:
            # Create a key for duplicate detection
            org = record.organization if hasattr(
                record, 'organization') else record.get('organization', '')
            invoice_num = record.invoice_number if hasattr(
                record, 'invoice_number') else record.get('invoice_number', '')
            invoice_type = record.invoice_type if hasattr(
                record, 'invoice_type') else record.get('invoice_type', '')

            key = f"{org}_{invoice_num}_{invoice_type}"

            # Count occurrences
            invoice_counts[key] = invoice_counts.get(key, 0) + 1

            # Check for zero collection with non-zero total
            total_amount = record.total_amount if hasattr(
                record, 'total_amount') else record.get('total_amount', 0)
            collection_amount = record.collection_amount if hasattr(
                record, 'collection_amount') else record.get('collection_amount', 0)

            if total_amount > 0 and collection_amount == 0:
                anomalies.append({
                    'type': 'zero_value',
                    'description': f"Zero collection amount for invoice {invoice_num} with total {total_amount}",
                    'record_id': record.id if hasattr(record, 'id') else record.get('id'),
                    'invoice_number': invoice_num,
                    'total_amount': float(total_amount)
                })

            # Check for missing important fields
            important_fields = ['invoice_number',
                                'invoice_date', 'client', 'total_amount']
            missing_fields = []

            for field in important_fields:
                value = getattr(record, field, None) if hasattr(
                    record, field) else record.get(field)
                if value is None or value == '' or (hasattr(value, '__len__') and len(value) == 0):
                    missing_fields.append(field)

            if missing_fields:
                anomalies.append({
                    'type': 'missing_data',
                    'description': f"Missing important fields: {', '.join(missing_fields)}",
                    'record_id': record.id if hasattr(record, 'id') else record.get('id'),
                    'invoice_number': invoice_num,
                    'missing_fields': missing_fields
                })

        # Add duplicate anomalies
        for key, count in invoice_counts.items():
            if count > 1:
                org, invoice_num, invoice_type = key.split('_')
                anomalies.append({
                    'type': 'duplicate_data',
                    'description': f"Duplicate invoice {invoice_num} in {org} (partial collection)",
                    'invoice_number': invoice_num,
                    'organization': org,
                    'invoice_type': invoice_type,
                    'count': count
                })

        return anomalies

    def scan_dot_field_validity(self):
        """Scan for DOT field validity issues across models with DOT fields"""
        dot_field_models = [CreancesNGBSS, CAPeriodique,
                            CANonPeriodique, CADNT, CARFD, CACNT]
        batch_size = 1000

        for model in dot_field_models:
            # Get base queryset
            queryset = model.objects.all()

            # Filter by invoice if specified
            if self.invoice:
                queryset = queryset.filter(invoice=self.invoice)

            # Process in batches for better performance
            total_processed = 0
            total_records = queryset.count()
            offset = 0

            while offset < total_records:
                batch = queryset[offset:offset+batch_size]

                for record in batch:
                    # Check both the FK and legacy field
                    dot_fk = getattr(record, 'dot', None)
                    dot_code = getattr(record, 'dot_code', '')

                    # Check for mismatches between FK and legacy field
                    if dot_fk and dot_code and dot_fk.code != dot_code:
                        self._create_anomaly(
                            invoice=record.invoice,
                            anomaly_type='inconsistent_data',
                            description=f"DOT field mismatch in {model.__name__}: FK={dot_fk.code}, legacy={dot_code}",
                            data={
                                'model': model.__name__,
                                'record_id': record.id,
                                'dot_fk': str(dot_fk),
                                'dot_code': dot_code
                            }
                        )

                offset += batch_size
                total_processed += len(batch)
                logger.info(
                    f"Processed {total_processed}/{total_records} records from {model.__name__}")


class TriggerAnomalyScanView(APIView):
    """API view for triggering a database anomaly scan"""
    permission_classes = [IsAdminUser]  # Restrict to admins

    def post(self, request):
        """
        Trigger a full database scan for anomalies
        This is a potentially resource-intensive operation
        """
        try:
            # Get optional parameters
            scan_types = request.data.get('scan_types', None)
            invoice_id = request.data.get('invoice_id', None)

            # Create scanner instance
            scanner = DatabaseAnomalyScanner()

            # Track start time for performance monitoring
            start_time = timezone.now()

            # Get specific invoice if ID provided
            invoice = None
            if invoice_id:
                try:
                    invoice = Invoice.objects.get(id=invoice_id)
                except Invoice.DoesNotExist:
                    return Response(
                        {"error": f"Invoice with ID {invoice_id} not found"},
                        status=status.HTTP_404_NOT_FOUND
                    )

            # Set the invoice attribute regardless of scan type
            scanner.invoice = invoice

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

            # Calculate execution time
            execution_time = (timezone.now() - start_time).total_seconds()

            # Log the scan results
            logger.info(
                f"Database anomaly scan completed by {request.user.email}. "
                f"Found {len(anomalies)} anomalies in {execution_time:.2f} seconds."
            )

            # Return detailed response
            return Response({
                'message': f'Scan completed. Detected {len(anomalies)} anomalies.',
                'anomaly_count': len(anomalies),
                'execution_time_seconds': execution_time,
                'scan_date': timezone.now(),
                'triggered_by': request.user.email,
                'anomalies': AnomalySerializer(anomalies, many=True).data
            })

        except Exception as e:
            logger.error(f"Error during anomaly scan: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ComprehensiveReportView(APIView):
    """
    API view for generating comprehensive reports that combine data from multiple sources
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Get query parameters
            year = request.query_params.get('year', datetime.now().year)
            month = request.query_params.get('month', None)
            dot = request.query_params.get('dot', None)
            report_type = request.query_params.get(
                'type', 'revenue_collection')

            # Initialize data processor
            data_processor = DataProcessor()

            # Check DOT permission
            if dot and not self._has_dot_permission(request.user, dot):
                return Response(
                    {'error': f'You do not have permission to access data for DOT: {dot}'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if report_type == 'revenue_collection':
                # Generate revenue and collection report
                report_data = self._generate_revenue_collection_report(
                    data_processor, year, month, dot)
            elif report_type == 'corporate_park':
                # Generate corporate park report
                report_data = self._generate_corporate_park_report(
                    data_processor, year, month, dot)
            elif report_type == 'receivables':
                # Generate receivables report
                report_data = self._generate_receivables_report(
                    data_processor, year, month, dot)
            else:
                return Response(
                    {'error': f'Invalid report type: {report_type}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return Response(report_data)

        except Exception as e:
            logger.error(f"Error generating report: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _has_dot_permission(self, user, dot):
        """Check if user has permission to access the specified DOT"""
        # TEMPORARY TESTING CODE - REMOVE IN PRODUCTION
        # Return True for all users and DOTs during testing
        return True

        # Original code - uncomment when testing is complete
        """
        # Admins and superusers have access to all DOTs
        if user.is_staff or user.is_superuser:
            return True

        # Get user's authorized DOTs
        authorized_dots = user.get_authorized_dots()

        # Check if user has access to the requested DOT
        return dot in authorized_dots
        """

    def _generate_revenue_collection_report(self, data_processor, year, month=None, dot=None):
        """
        Generate a comprehensive report that combines Journal des ventes and Etat de facture data
        to provide a complete view of revenue and collection metrics.

        Args:
            data_processor: DataProcessor instance
            year: Year to generate report for
            month: Month to generate report for (optional)
            dot: DOT to filter by (optional)

        Returns:
            Dictionary with comprehensive report data
        """
        # Get Journal des ventes data
        journal_query = JournalVentes.objects.all()

        # Apply filters
        if year:
            journal_query = journal_query.filter(invoice_date__year=year)
        if month:
            journal_query = journal_query.filter(invoice_date__month=month)
        if dot:
            # Clean DOT name
            clean_dot = dot.replace('DOT_', '').replace(
                '_', '').replace('–', '')
            journal_query = journal_query.filter(
                organization__icontains=clean_dot)

        # For headquarters (Siège), only include DCC and DCGC
        if dot and dot.lower() == 'siège':
            journal_query = journal_query.filter(
                Q(organization__icontains='DCC') |
                Q(organization__icontains='DCGC')
            )

        # Get Etat de facture data
        etat_query = EtatFacture.objects.all()

        # Apply filters
        if year:
            etat_query = etat_query.filter(invoice_date__year=year)
        if month:
            etat_query = etat_query.filter(invoice_date__month=month)
        if dot:
            # Clean DOT name
            clean_dot = dot.replace('DOT_', '').replace(
                '_', '').replace('–', '')
            etat_query = etat_query.filter(organization__icontains=clean_dot)

        # For headquarters (Siège), only include DCC and DCGC
        if dot and dot.lower() == 'siège':
            etat_query = etat_query.filter(
                Q(organization__icontains='DCC') |
                Q(organization__icontains='DCGC')
            )

        # Process Journal des ventes data
        journal_data = list(journal_query)
        processed_journal, journal_categories = data_processor.process_journal_ventes_advanced(
            journal_data)

        # Process Etat de facture data
        etat_data = list(etat_query)
        processed_etat, etat_duplicates = data_processor.process_etat_facture_advanced(
            etat_data)

        # Match Journal des ventes with Etat de facture data
        matched_data = data_processor.match_journal_ventes_etat_facture_advanced(
            processed_journal, processed_etat
        )

        # Initialize values to prevent errors
        total_revenue = 0
        total_invoiced = 0
        total_collection = 0

        # Check if matched_data exists and is non-empty
        if matched_data:
            try:
                # Check if matched_data contains dictionary-like objects or lists
                if matched_data and isinstance(matched_data[0], dict):
                    # Process the data when it's a dictionary
                    total_revenue = sum(record.get('revenue_amount', 0)
                                        for record in matched_data)
                    total_invoiced = sum(record.get('total_amount', 0)
                                         for record in matched_data)
                    total_collection = sum(record.get('collection_amount', 0)
                                           for record in matched_data)
                else:
                    # For lists or other types, get data through direct aggregation
                    # Aggregate directly from the original data sources
                    total_revenue = journal_query.aggregate(
                        total=Coalesce(Sum('revenue_amount'), 0,
                                       output_field=DecimalField())
                    )['total'] or 0

                    total_collection = etat_query.aggregate(
                        total=Coalesce(Sum('collection_amount'),
                                       0, output_field=DecimalField())
                    )['total'] or 0

                    total_invoiced = etat_query.aggregate(
                        total=Coalesce(Sum('total_amount'), 0,
                                       output_field=DecimalField())
                    )['total'] or 0
            except Exception as e:
                logger.error(f"Error calculating report metrics: {str(e)}")
                # Fallback to direct aggregation if there's any error
                total_revenue = journal_query.aggregate(
                    total=Coalesce(Sum('revenue_amount'), 0,
                                   output_field=DecimalField())
                )['total'] or 0

                total_collection = etat_query.aggregate(
                    total=Coalesce(Sum('collection_amount'), 0,
                                   output_field=DecimalField())
                )['total'] or 0

                total_invoiced = etat_query.aggregate(
                    total=Coalesce(Sum('total_amount'), 0,
                                   output_field=DecimalField())
                )['total'] or 0
        else:
            # If matched_data is empty, get totals directly from queries
            total_revenue = journal_query.aggregate(
                total=Coalesce(Sum('revenue_amount'), 0,
                               output_field=DecimalField())
            )['total'] or 0

            total_collection = etat_query.aggregate(
                total=Coalesce(Sum('collection_amount'), 0,
                               output_field=DecimalField())
            )['total'] or 0

            total_invoiced = etat_query.aggregate(
                total=Coalesce(Sum('total_amount'), 0,
                               output_field=DecimalField())
            )['total'] or 0

        # Calculate collection rate
        collection_rate = 0
        if total_invoiced > 0:
            collection_rate = (total_collection / total_invoiced) * 100

        # Get revenue objectives
        revenue_objectives = RevenueObjective.objects.filter(year=year)
        if month:
            revenue_objectives = revenue_objectives.filter(month=month)
        if dot:
            revenue_objectives = revenue_objectives.filter(dot=dot)

        total_revenue_objective = sum(
            obj.target_amount for obj in revenue_objectives)

        # Calculate revenue achievement rate
        revenue_achievement_rate = 0
        if total_revenue_objective > 0:
            revenue_achievement_rate = (
                total_revenue / total_revenue_objective) * 100

        # Get collection objectives
        collection_objectives = CollectionObjective.objects.filter(year=year)
        if month:
            collection_objectives = collection_objectives.filter(month=month)
        if dot:
            collection_objectives = collection_objectives.filter(dot=dot)

        total_collection_objective = sum(
            obj.target_amount for obj in collection_objectives)

        # Calculate collection achievement rate
        collection_achievement_rate = 0
        if total_collection_objective > 0:
            collection_achievement_rate = (
                total_collection / total_collection_objective) * 100

        # Get previous year data for comparison
        previous_year = int(year) - 1

        # Get previous year Journal des ventes data
        previous_journal_query = JournalVentes.objects.filter(
            invoice_date__year=previous_year)
        if month:
            previous_journal_query = previous_journal_query.filter(
                invoice_date__month=month)
        if dot and clean_dot:
            previous_journal_query = previous_journal_query.filter(
                organization__icontains=clean_dot)

        # For headquarters (Siège), only include DCC and DCGC
        if dot and dot.lower() == 'siège':
            previous_journal_query = previous_journal_query.filter(
                Q(organization__icontains='DCC') |
                Q(organization__icontains='DCGC')
            )

        previous_total_revenue = previous_journal_query.aggregate(
            total=Coalesce(Sum('revenue_amount'), 0,
                           output_field=DecimalField())
        )['total']

        # Get previous year Etat de facture data
        previous_etat_query = EtatFacture.objects.filter(
            invoice_date__year=previous_year)
        if month:
            previous_etat_query = previous_etat_query.filter(
                invoice_date__month=month)
        if dot and clean_dot:
            previous_etat_query = previous_etat_query.filter(
                organization__icontains=clean_dot)

        # For headquarters (Siège), only include DCC and DCGC
        if dot and dot.lower() == 'siège':
            previous_etat_query = previous_etat_query.filter(
                Q(organization__icontains='DCC') |
                Q(organization__icontains='DCGC')
            )

        previous_total_collection = previous_etat_query.aggregate(
            total=Coalesce(Sum('collection_amount'), 0,
                           output_field=DecimalField())
        )['total']

        # Calculate growth rates
        revenue_growth_rate = 0
        if previous_total_revenue > 0:
            revenue_growth_rate = (
                (total_revenue - previous_total_revenue) / previous_total_revenue) * 100

        collection_growth_rate = 0
        if previous_total_collection > 0:
            collection_growth_rate = (
                (total_collection - previous_total_collection) / previous_total_collection) * 100

        # Detect anomalies
        journal_anomalies = self._detect_journal_ventes_anomalies(journal_data)
        etat_anomalies = self._detect_etat_facture_anomalies(etat_data)

        # For data_sample, provide a safe fallback if matched_data is problematic
        data_sample = []
        try:
            # Check if matched_data is a valid source for data sample
            if matched_data and isinstance(matched_data, list):
                # Take up to 100 records
                data_sample = matched_data[:100]
            else:
                # Fallback to direct queryset values
                data_sample = list(journal_query.values()[
                                   :50]) + list(etat_query.values()[:50])
        except Exception as e:
            logger.error(f"Error preparing data sample: {str(e)}")
            # Empty list as last resort
            data_sample = []

        # Prepare report data
        report_data = {
            'filters': {
                'year': year,
                'month': month,
                'dot': dot
            },
            'summary': {
                'total_revenue': float(total_revenue),
                'total_invoiced': float(total_invoiced),
                'total_collection': float(total_collection),
                'collection_rate': float(collection_rate),
                'revenue_objective': float(total_revenue_objective),
                'revenue_achievement_rate': float(revenue_achievement_rate),
                'collection_objective': float(total_collection_objective),
                'collection_achievement_rate': float(collection_achievement_rate),
                'previous_year_revenue': float(previous_total_revenue),
                'previous_year_collection': float(previous_total_collection),
                'revenue_growth_rate': float(revenue_growth_rate),
                'collection_growth_rate': float(collection_growth_rate)
            },
            'categories': {
                'main_data_count': len(journal_categories.get('main_data', [])),
                'previous_year_invoice_count': len(journal_categories.get('previous_year_invoice', [])),
                'advance_billing_count': len(journal_categories.get('advance_billing', [])),
                'anomalies_count': len(journal_categories.get('anomalies', []))
            },
            'anomalies': {
                'journal_anomalies': journal_anomalies,
                'etat_anomalies': etat_anomalies,
                'total_anomalies': len(journal_anomalies) + len(etat_anomalies)
            },
            # Provide safe data sample
            'data_sample': data_sample
        }

        return report_data

    def _generate_corporate_park_report(self, data_processor, year, month=None, dot=None):
        """
        Generate a comprehensive report for Corporate NGBSS Park data.

        Args:
            data_processor: DataProcessor instance
            year: Year to generate report for
            month: Month to generate report for (optional)
            dot: DOT to filter by (optional)

        Returns:
            Dictionary with comprehensive report data
        """
        # Get ParcCorporate data
        query = ParcCorporate.objects.all()

        # Apply filters
        if dot:
            query = query.filter(state=dot)

        # Apply date filters based on creation_date
        if year:
            query = query.filter(creation_date__year=year)
        if month:
            query = query.filter(creation_date__month=month)

        # Apply specific filters as per client requirements
        filtered_data = data_processor.filter_parc_corporate(query)

        # Calculate metrics
        total_subscribers = filtered_data.count()

        # Group by State (DOT)
        subscribers_by_state = filtered_data.values('state').annotate(
            count=Count('id')
        ).order_by('-count')

        # Group by OFFER_NAME
        subscribers_by_offer = filtered_data.values('offer_name').annotate(
            count=Count('id')
        ).order_by('-count')

        # Group by CODE_CUSTOMER_L2
        subscribers_by_customer_l2 = filtered_data.values('customer_l2_code', 'customer_l2_desc').annotate(
            count=Count('id')
        ).order_by('-count')

        # Group by TELECOM_TYPE
        subscribers_by_telecom_type = filtered_data.values('telecom_type').annotate(
            count=Count('id')
        ).order_by('-count')

        # Group by SUBSCRIBER_STATUS
        subscribers_by_status = filtered_data.values('subscriber_status').annotate(
            count=Count('id')
        ).order_by('-count')

        # Track new creations
        current_month = datetime.now().month
        current_year = datetime.now().year

        # Get new creations for current month
        new_creations_query = filtered_data.filter(
            creation_date__year=current_year,
            creation_date__month=current_month
        )

        new_creations_count = new_creations_query.count()

        # Get new creations by TELECOM_TYPE
        new_creations_by_telecom_type = new_creations_query.values('telecom_type').annotate(
            count=Count('id')
        ).order_by('-count')

        # Compare with previous month
        previous_month = current_month - 1 if current_month > 1 else 12
        previous_month_year = current_year if current_month > 1 else current_year - 1

        previous_month_query = ParcCorporate.objects.filter(
            creation_date__year=previous_month_year,
            creation_date__month=previous_month
        )

        # Apply specific filters as per client requirements
        previous_month_filtered = data_processor.filter_parc_corporate(
            previous_month_query)
        previous_month_count = previous_month_filtered.count()

        # Calculate growth rate
        growth_rate = 0
        if previous_month_count > 0:
            growth_rate = (
                (total_subscribers - previous_month_count) / previous_month_count) * 100

        # Prepare report data
        report_data = {
            'filters': {
                'year': year,
                'month': month,
                'dot': dot
            },
            'summary': {
                'total_subscribers': total_subscribers,
                'previous_month_subscribers': previous_month_count,
                'growth_rate': float(growth_rate),
                'new_creations_count': new_creations_count
            },
            'breakdowns': {
                'by_state': list(subscribers_by_state),
                'by_offer': list(subscribers_by_offer),
                'by_customer_l2': list(subscribers_by_customer_l2),
                'by_telecom_type': list(subscribers_by_telecom_type),
                'by_status': list(subscribers_by_status),
                'new_creations_by_telecom_type': list(new_creations_by_telecom_type)
            },
            # Limit to 100 records for API response
            'data_sample': list(filtered_data.values()[:100])
        }

        return report_data

    def _generate_receivables_report(self, data_processor, year, month=None, dot=None):
        """
        Generate a comprehensive report for Receivables (Créances NGBSS) data.

        Args:
            data_processor: DataProcessor instance
            year: Year to generate report for
            month: Month to generate report for (optional)
            dot: DOT to filter by (optional)

        Returns:
            Dictionary with comprehensive report data
        """
        # Get CreancesNGBSS data
        query = CreancesNGBSS.objects.all()

        # Apply filters
        if dot:
            query = query.filter(dot=dot)
        if year:
            query = query.filter(year=year)
        if month:
            query = query.filter(month=month)

        # Apply specific filters as per client requirements
        filtered_data = data_processor.filter_creances_ngbss(query)

        # Calculate metrics
        total_receivables = filtered_data.aggregate(
            total=Coalesce(Sum('creance_brut'), 0, output_field=DecimalField())
        )['total']

        # Group by age/year
        receivables_by_year = filtered_data.values('year').annotate(
            total=Sum('creance_brut')
        ).order_by('year')

        # Group by DOT
        receivables_by_dot = filtered_data.values('dot').annotate(
            total=Sum('creance_brut')
        ).order_by('-total')

        # Group by client category (CUST_LEV1)
        receivables_by_category = filtered_data.values('customer_lev1').annotate(
            total=Sum('creance_brut')
        ).order_by('-total')

        # Group by product
        receivables_by_product = filtered_data.values('product').annotate(
            total=Sum('creance_brut')
        ).order_by('-total')

        # Detect anomalies (empty cells)
        anomalies = []
        for record in filtered_data:
            important_fields = ['dot', 'actel',
                                'invoice_amount', 'open_amount']
            missing_fields = []

            for field in important_fields:
                value = getattr(record, field, None)
                if value is None or value == '' or (hasattr(value, '__len__') and len(value) == 0):
                    missing_fields.append(field)

            if missing_fields:
                anomalies.append({
                    'type': 'missing_data',
                    'description': f"Missing important fields: {', '.join(missing_fields)}",
                    'record_id': record.id,
                    'missing_fields': missing_fields
                })

        # Prepare report data
        report_data = {
            'filters': {
                'year': year,
                'month': month,
                'dot': dot
            },
            'summary': {
                'total_receivables': float(total_receivables),
                'record_count': filtered_data.count(),
                'anomalies_count': len(anomalies)
            },
            'breakdowns': {
                'by_year': list(receivables_by_year),
                'by_dot': list(receivables_by_dot),
                'by_category': list(receivables_by_category),
                'by_product': list(receivables_by_product)
            },
            'anomalies': anomalies,
            # Limit to 100 records for API response
            'data_sample': list(filtered_data.values()[:100])
        }

        return report_data

    def _detect_journal_ventes_anomalies(self, data):
        """
        Detect anomalies in Journal des ventes data

        Args:
            data: List of JournalVentes objects

        Returns:
            List of anomalies detected
        """
        anomalies = []

        for record in data:
            # Check for @ in invoice object
            if record.invoice_object and '@' in record.invoice_object:
                anomalies.append({
                    'type': 'journal_ventes_anomaly',
                    'description': f'Invoice object contains @ symbol: {record.invoice_object}',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number
                })

            # Check for dates in billing period from previous year
            if record.billing_period:
                try:
                    # Extract year from billing period if it's in a format like "Jan 2023"
                    import re
                    year_match = re.search(r'20\d{2}', record.billing_period)
                    if year_match:
                        period_year = int(year_match.group(0))
                        invoice_year = record.invoice_date.year if record.invoice_date else None

                        if invoice_year and period_year < invoice_year:
                            anomalies.append({
                                'type': 'journal_ventes_anomaly',
                                'description': f'Billing period ({record.billing_period}) contains a previous year compared to invoice date ({record.invoice_date})',
                                'record_id': record.id,
                                'invoice_number': record.invoice_number
                            })
                except Exception as e:
                    # If there's an error parsing, it might be an anomaly itself
                    anomalies.append({
                        'type': 'journal_ventes_anomaly',
                        'description': f'Unusual billing period format: {record.billing_period}',
                        'record_id': record.id,
                        'invoice_number': record.invoice_number
                    })

            # Check for zero revenue
            if record.revenue_amount == 0:
                anomalies.append({
                    'type': 'journal_ventes_anomaly',
                    'description': 'Revenue amount is zero',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number
                })

            # Check for missing important fields
            if not record.invoice_number:
                anomalies.append({
                    'type': 'journal_ventes_anomaly',
                    'description': 'Missing invoice number',
                    'record_id': record.id,
                    'invoice_number': 'N/A'
                })

            if not record.invoice_date:
                anomalies.append({
                    'type': 'journal_ventes_anomaly',
                    'description': 'Missing invoice date',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number or 'N/A'
                })

            if not record.client:
                anomalies.append({
                    'type': 'journal_ventes_anomaly',
                    'description': 'Missing client information',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number or 'N/A'
                })

            if record.revenue_amount is None:
                anomalies.append({
                    'type': 'journal_ventes_anomaly',
                    'description': 'Missing revenue amount',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number or 'N/A'
                })

        return anomalies

    def _detect_etat_facture_anomalies(self, data):
        """
        Detect anomalies in Etat de facture data

        Args:
            data: List of EtatFacture objects

        Returns:
            List of anomalies detected
        """
        anomalies = []

        # Check for duplicate invoices (partial collection)
        invoice_numbers = {}

        for record in data:
            if record.invoice_number:
                if record.invoice_number in invoice_numbers:
                    # This is a duplicate invoice number
                    invoice_numbers[record.invoice_number].append(record)
                else:
                    invoice_numbers[record.invoice_number] = [record]

        # Check duplicates for partial collections
        for invoice_number, records in invoice_numbers.items():
            if len(records) > 1:
                # Check if this is a partial collection case
                total_collected = sum(
                    r.collection_amount or 0 for r in records)
                total_amount = records[0].total_amount if records[0].total_amount else 0

                if total_collected < total_amount:
                    anomalies.append({
                        'type': 'etat_facture_anomaly',
                        'description': f'Partial collection detected for invoice {invoice_number}. Collected: {total_collected}, Total: {total_amount}',
                        'record_id': records[0].id,
                        'invoice_number': invoice_number
                    })

        # Check individual records
        for record in data:
            # Check for zero collection but non-zero total
            if record.collection_amount == 0 and record.total_amount and record.total_amount > 0:
                anomalies.append({
                    'type': 'etat_facture_anomaly',
                    'description': 'Zero collection amount for non-zero invoice',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number or 'N/A'
                })

            # Check for missing important fields
            if not record.invoice_number:
                anomalies.append({
                    'type': 'etat_facture_anomaly',
                    'description': 'Missing invoice number',
                    'record_id': record.id,
                    'invoice_number': 'N/A'
                })

            if not record.invoice_date:
                anomalies.append({
                    'type': 'etat_facture_anomaly',
                    'description': 'Missing invoice date',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number or 'N/A'
                })

            if not record.client:
                anomalies.append({
                    'type': 'etat_facture_anomaly',
                    'description': 'Missing client information',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number or 'N/A'
                })

            if record.total_amount is None:
                anomalies.append({
                    'type': 'etat_facture_anomaly',
                    'description': 'Missing total amount',
                    'record_id': record.id,
                    'invoice_number': record.invoice_number or 'N/A'
                })

        return anomalies


class ComprehensiveReportExportView(APIView):
    """
    API view for exporting comprehensive reports in various formats
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, report_type=None):
        try:
            # Get query parameters
            year = request.query_params.get('year', datetime.now().year)
            month = request.query_params.get('month', None)
            dot = request.query_params.get('dot', None)
            export_format = request.query_params.get('format', 'excel')

            # If report_type is not provided in the URL path, get it from query parameters
            if report_type is None:
                report_type = request.query_params.get(
                    'type', 'revenue_collection')

            # Import the export views here to avoid circular imports
            from .export_views import RevenueCollectionExportView, CorporateParkExportView, ReceivablesExportView

            # For specific report types, delegate to the specialized export views
            if report_type == 'revenue_collection':
                return RevenueCollectionExportView().get(request)
            elif report_type == 'corporate_park':
                return CorporateParkExportView().get(request)
            elif report_type == 'receivables':
                return ReceivablesExportView().get(request)
            else:
                return Response(
                    {'error': f'Invalid report type: {report_type}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            logger.error(f"Error exporting report: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DashboardOverviewView(APIView):
    """
    API view for retrieving overview statistics for the admin dashboard
    - Number of users (active and disabled)
    - Number of files uploaded
    - Database size
    - Other helpful admin metrics
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            logger.info(
                "DashboardOverviewView: Starting to gather dashboard data")
            User = get_user_model()

            # User statistics
            total_users = User.objects.count()
            active_users = User.objects.filter(is_active=True).count()
            disabled_users = User.objects.filter(is_active=False).count()
            logger.info(
                f"DashboardOverviewView: User stats - total: {total_users}, active: {active_users}, disabled: {disabled_users}")

            # File statistics
            total_files = Invoice.objects.count()
            logger.info(
                f"DashboardOverviewView: File stats - total: {total_files}")

            # Get file sizes
            total_file_size = 0
            try:
                if total_files > 0:
                    # Sum the size of all invoice files
                    for invoice in Invoice.objects.all():
                        if invoice.file and hasattr(invoice.file, 'path') and os.path.exists(invoice.file.path):
                            try:
                                total_file_size += os.path.getsize(
                                    invoice.file.path)
                            except (OSError, IOError) as e:
                                logger.warning(
                                    f"Could not get size of file {invoice.file.path}: {str(e)}")
            except Exception as e:
                logger.error(f"Error calculating file sizes: {str(e)}")

            logger.info(
                f"DashboardOverviewView: Total file size: {total_file_size}")

            # Data statistics
            try:
                journal_ventes_count = JournalVentes.objects.count()
                etat_facture_count = EtatFacture.objects.count()
                parc_corporate_count = ParcCorporate.objects.count()
                creances_ngbss_count = CreancesNGBSS.objects.count()
                logger.info(
                    f"DashboardOverviewView: Data stats - JV: {journal_ventes_count}, EF: {etat_facture_count}, PC: {parc_corporate_count}, CN: {creances_ngbss_count}")
            except Exception as e:
                logger.error(f"Error getting data statistics: {str(e)}")
                journal_ventes_count = 0
                etat_facture_count = 0
                parc_corporate_count = 0
                creances_ngbss_count = 0

            # Anomaly statistics
            try:
                total_anomalies = Anomaly.objects.count()
                open_anomalies = Anomaly.objects.filter(status='open').count()
                logger.info(
                    f"DashboardOverviewView: Anomaly stats - total: {total_anomalies}, open: {open_anomalies}")
            except Exception as e:
                logger.error(f"Error getting anomaly statistics: {str(e)}")
                total_anomalies = 0
                open_anomalies = 0

            # Recent activity
            try:
                recent_uploads = Invoice.objects.order_by('-upload_date')[:5].values(
                    'invoice_number', 'upload_date', 'status', 'uploaded_by__email'
                )
                logger.info(
                    f"DashboardOverviewView: Recent uploads count: {len(recent_uploads)}")
            except Exception as e:
                logger.error(f"Error getting recent uploads: {str(e)}")
                recent_uploads = []

            # DOT statistics
            dots = set()
            try:
                for model in [JournalVentes, EtatFacture, ParcCorporate, CreancesNGBSS,
                              CAPeriodique, CANonPeriodique, CADNT, CARFD, CACNT]:
                    if hasattr(model, 'objects') and hasattr(model.objects, 'values_list'):
                        # Check if the model has a 'dot' field
                        if 'dot' in [f.name for f in model._meta.fields]:
                            model_dots = model.objects.values_list(
                                'dot', flat=True).distinct()
                            dots.update([d for d in model_dots if d])
                logger.info(f"DashboardOverviewView: DOT count: {len(dots)}")
            except Exception as e:
                logger.error(f"Error getting DOT statistics: {str(e)}")

            # Format file size for display
            def format_size(size_bytes):
                if size_bytes < 1024:
                    return f"{size_bytes} bytes"
                elif size_bytes < 1024 * 1024:
                    return f"{size_bytes / 1024:.2f} KB"
                elif size_bytes < 1024 * 1024 * 1024:
                    return f"{size_bytes / (1024 * 1024):.2f} MB"
                else:
                    return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

            response_data = {
                'users': {
                    'total': total_users,
                    'active': active_users,
                    'disabled': disabled_users
                },
                'files': {
                    'total': total_files,
                    'size': format_size(total_file_size)
                },
                'data': {
                    'journal_ventes': journal_ventes_count,
                    'etat_facture': etat_facture_count,
                    'parc_corporate': parc_corporate_count,
                    'creances_ngbss': creances_ngbss_count,
                    'total_records': journal_ventes_count + etat_facture_count +
                    parc_corporate_count + creances_ngbss_count
                },
                'anomalies': {
                    'total': total_anomalies,
                    'open': open_anomalies
                },
                'recent_uploads': list(recent_uploads),
                'dots': {
                    'count': len(dots),
                    'list': list(dots)
                }
            }

            logger.info(f"DashboardOverviewView: Returning response data")
            return Response(response_data)
        except Exception as e:
            logger.error(f"DashboardOverviewView: Error occurred: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'error': str(e),
                'detail': 'An error occurred while gathering dashboard data'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DashboardEnhancedView(APIView):
    """
    API view for enhanced dashboard data with advanced analytics and visualizations.

    Features:
    1. Identify structures with zero CA or zero collections
    2. Top/Flop structure rankings by revenue and collection
    3. Visualization data for offer quantities and physical park
    4. Trend analysis for CA, collections, and receivables
    5. DOT data health metrics and consistency checks
    """
    permission_classes = [IsAuthenticated]

    def get_dot_health_metrics(self):
        """Generate metrics about DOT data health across models"""
        from django.db.models import F, Q

        dot_field_models = [CreancesNGBSS, CAPeriodique,
                            CANonPeriodique, CADNT, CARFD, CACNT]
        metrics = {}

        for model in dot_field_models:
            model_name = model.__name__
            total_records = model.objects.count()

            metrics[model_name] = {
                'total_records': total_records,
                'missing_dot_fk': model.objects.filter(dot__isnull=True).count(),
                'missing_dot_code': model.objects.filter(
                    Q(dot_code__isnull=True) | Q(dot_code='')).count(),
                'inconsistent': 0  # We'll calculate this
            }

            # Calculate inconsistencies more efficiently
            # This query identifies records where FK code doesn't match legacy code
            inconsistent_records = model.objects.filter(
                dot__isnull=False
            ).exclude(
                dot_code=F('dot__code')
            )

            metrics[model_name]['inconsistent'] = inconsistent_records.count()

            # Calculate percentages for easier interpretation
            if total_records > 0:
                metrics[model_name]['missing_dot_fk_pct'] = round(
                    (metrics[model_name]['missing_dot_fk'] / total_records) * 100, 2)
                metrics[model_name]['missing_dot_code_pct'] = round(
                    (metrics[model_name]['missing_dot_code'] / total_records) * 100, 2)
                metrics[model_name]['inconsistent_pct'] = round(
                    (metrics[model_name]['inconsistent'] / total_records) * 100, 2)
                metrics[model_name]['health_score'] = 100 - \
                    metrics[model_name]['inconsistent_pct']
            else:
                metrics[model_name]['missing_dot_fk_pct'] = 0
                metrics[model_name]['missing_dot_code_pct'] = 0
                metrics[model_name]['inconsistent_pct'] = 0
                metrics[model_name]['health_score'] = 100

        return metrics

    def get(self, request):
        """
        Get enhanced dashboard data with advanced analytics.

        Query parameters:
        - year: Year for data filtering (default: current year)
        - month: Month for data filtering (optional)
        - dot: DOT code for filtering (optional)
        - period_count: Number of periods for historical data (default: 12)
        """
        try:
            # Get query parameters
            year = request.query_params.get('year', datetime.now().year)
            month = request.query_params.get('month')
            dot = request.query_params.get('dot')
            period_count = int(request.query_params.get('period_count', 12))

            # Convert year to integer
            try:
                year = int(year)
            except (TypeError, ValueError):
                year = datetime.now().year

            # Convert month to integer if provided
            if month:
                try:
                    month = int(month)
                    if month < 1 or month > 12:
                        return Response(
                            {"error": f"Month must be between 1 and 12"},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except (TypeError, ValueError):
                    month = None

            # Validate year
            try:
                year = int(year)
                if month < 1 or month > 12:
                    return Response(
                        {"error": f"Month must be between 1 and 12, got: {month}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except (ValueError, TypeError):
                return Response(
                    {"error": f"Invalid month format: {month}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check DOT permission if dot is provided
            if dot and not self._has_dot_permission(request.user, dot):
                return Response(
                    {"error": f"You don't have permission to access data for DOT: {dot}"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Get Journal des Ventes data
            journal_queryset = JournalVentes.objects.all()

            # Apply filters
            if year:
                # Filter by year in invoice_date
                journal_queryset = journal_queryset.filter(
                    invoice_date__year=year
                )

            if month:
                # Filter by month in invoice_date
                journal_queryset = journal_queryset.filter(
                    invoice_date__month=month
                )

            if dot:
                # Filter by DOT
                journal_queryset = journal_queryset.filter(
                    invoice__processed_data__department=dot
                )

            # Get État de Facture data with the same filters
            etat_queryset = EtatFacture.objects.all()

            if year:
                etat_queryset = etat_queryset.filter(
                    invoice_date__year=year
                )

            if month:
                etat_queryset = etat_queryset.filter(
                    invoice_date__month=month
                )

            if dot:
                etat_queryset = etat_queryset.filter(
                    invoice__processed_data__department=dot
                )

            # Get Parc Corporate data
            parc_queryset = ParcCorporate.objects.all()

            # Convert querysets to lists of dictionaries
            journal_data = JournalVentesSerializer(
                journal_queryset, many=True).data
            etat_data = EtatFactureSerializer(etat_queryset, many=True).data
            parc_data = ParcCorporateSerializer(parc_queryset, many=True).data

            # Get historical data for trend analysis
            historical_data = self._get_historical_data(
                year, month, dot, period_count)

            # Initialize data processor
            data_processor = DataProcessor()

            # Generate dashboard data
            dashboard_data = data_processor.generate_dashboard_data(
                journal_data=journal_data,
                etat_data=etat_data,
                parc_data=parc_data,
                historical_data=historical_data,
                period_count=period_count
            )

            # Add metadata
            dashboard_data['metadata'] = {
                'year': year,
                'month': month,
                'dot': dot,
                'generated_at': datetime.now().isoformat(),
                'period_count': period_count
            }

            return Response(dashboard_data)

        except Exception as e:
            logger.error(f"Error in enhanced dashboard view: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _has_dot_permission(self, user, dot):
        """Check if user has permission to access data for the specified DOT"""
        # If user is superuser or staff, allow access to all DOTs
        if user.is_superuser or user.is_staff:
            return True

        # Check if user has access to the specified DOT
        return user.dots.filter(code=dot).exists()

    def _get_historical_data(self, year, month, dot, period_count):
        """Get historical data for trend analysis"""
        historical_data = []

        # Current year and month
        current_year = datetime.now().year
        current_month = datetime.now().month

        # Calculate start year and month for historical data
        if month:
            # If month is specified, get data for the same month in previous years
            # and previous months in the current year
            start_year = year - (period_count // 12) - 1

            for hist_year in range(start_year, current_year + 1):
                # Skip future years
                if hist_year > current_year:
                    continue

                # For current year, only include months up to the current month
                max_month = current_month if hist_year == current_year else 12

                for hist_month in range(1, max_month + 1):
                    # Skip future periods
                    if hist_year == current_year and hist_month > current_month:
                        continue

                    # Skip the requested period as it will be added separately
                    if hist_year == year and hist_month == month:
                        continue

                    # Get data for this period
                    period_data = self._get_period_data(
                        hist_year, hist_month, dot)

                    if period_data:
                        historical_data.append(period_data)
        else:
            # If only year is specified, get data for previous years
            for hist_year in range(year - period_count, current_year + 1):
                # Skip future years and the requested year
                if hist_year > current_year or hist_year == year:
                    continue

                # Get data for this year
                period_data = self._get_period_data(hist_year, None, dot)

                if period_data:
                    historical_data.append(period_data)

        # Sort by year and month
        historical_data.sort(key=lambda x: (
            x.get('year', 0), x.get('month', 0)))

        # Limit to the requested number of periods
        return historical_data[-period_count:] if len(historical_data) > period_count else historical_data

    def _get_period_data(self, year, month, dot):
        """Get aggregated data for a specific period"""
        # Filter Journal des Ventes data
        journal_queryset = JournalVentes.objects.all()

        if year:
            journal_queryset = journal_queryset.filter(invoice_date__year=year)

        if month:
            journal_queryset = journal_queryset.filter(
                invoice_date__month=month)

        if dot:
            journal_queryset = journal_queryset.filter(
                invoice__processed_data__department=dot)

        # Filter État de Facture data
        etat_queryset = EtatFacture.objects.all()

        if year:
            etat_queryset = etat_queryset.filter(invoice_date__year=year)

        if month:
            etat_queryset = etat_queryset.filter(invoice_date__month=month)

        if dot:
            etat_queryset = etat_queryset.filter(
                invoice__processed_data__department=dot)

        # Calculate aggregates
        total_revenue = journal_queryset.aggregate(Sum('revenue_amount'))[
            'revenue_amount__sum'] or 0
        total_collection = etat_queryset.aggregate(Sum('collection_amount'))[
            'collection_amount__sum'] or 0
        total_receivables = total_revenue - total_collection

        # Format period label
        if month:
            period_label = f"{year}-{month:02d}"
        else:
            period_label = str(year)

        return {
            'period': period_label,
            'year': year,
            'month': month,
            'total_revenue': float(total_revenue),
            'total_collection': float(total_collection),
            'total_receivables': float(total_receivables)
        }


class BaseExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, format=None):
        # Get parameters
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        dot = request.query_params.get('dot')

        # Generate Excel file
        output = BytesIO()
        workbook = xlsxwriter.Workbook(output)

        # Add data to workbook

        workbook.close()

        # Prepare response
        output.seek(0)
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename=export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        return response


class RevenueCollectionExportView(BaseExportView):
    def get(self, request, format=None):
        # Implement revenue collection export logic
        pass


class CorporateParkExportView(BaseExportView):
    def get(self, request, format=None):
        # Implement corporate park export logic
        pass


class ReceivablesExportView(BaseExportView):
    def get(self, request, format=None):
        # Implement receivables export logic
        pass


class DataValidationView(APIView):
    """
    API view for performing a second validation to ensure 
    that the first data treatment was executed correctly.
    This performs a comprehensive scan across all relevant tables
    to check for any issues with the data filtering and processing.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Analyzes the database to check if the first treatment was correctly executed.
        Returns a detailed report of any issues found.
        """
        try:
            # Get optional filter parameters
            dot_filter = request.query_params.get('dot', None)
            start_date = request.query_params.get('start_date', None)
            end_date = request.query_params.get('end_date', None)

            # Create a unique task ID for tracking this validation operation
            task_id = f"validation_{request.user.id}_{int(time.time())}"

            # Initialize validation progress tracking
            cache.set(f"validation_progress_{task_id}", {
                'status': 'initializing',
                'progress': 0,
                # We have 6 validation steps (one for each model)
                'total_steps': 6,
                'current_step': 0,
                'step_name': 'Preparing validation',
                'time_started': timezone.now().isoformat(),
                'estimated_completion': None,
                'time_elapsed': 0,
                'time_remaining': None
            }, timeout=3600)  # 1 hour timeout

            # Start validation in a background thread to allow progress tracking
            validation_thread = threading.Thread(
                target=self._run_validation_process,
                args=(request, dot_filter, start_date, end_date, task_id)
            )
            validation_thread.daemon = True
            validation_thread.start()

            return Response({
                'status': 'started',
                'message': 'Validation process started',
                'task_id': task_id
            })

        except Exception as e:
            logger.error(f"Error starting data validation: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'status': 'error',
                'error': str(e),
                'traceback': traceback.format_exc()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _run_validation_process(self, request, dot_filter, start_date, end_date, task_id):
        """Run the validation process in a background thread with progress tracking"""
        try:
            start_time = time.time()

            # Initialize validation report
            validation_report = {
                'status': 'success',
                'validation_date': timezone.now(),
                'performed_by': request.user.email,
                'validation_results': {},
                'total_issues_found': 0,
                'tables_validated': 0,
                'records_checked': 0,
                'records_with_issues': 0,
                'client_cleaning_required': False,
                'issues_by_client': {},  # Track issues grouped by client
                'task_id': task_id,
                'time_started': timezone.now().isoformat(),
                'time_completed': None,
                'execution_time_seconds': 0
            }

            # Update progress to 0%
            self._update_validation_progress(
                task_id, 0, 'Starting validation process', start_time)

            # Run specific validations for each data model
            model_steps = [
                ('parc_corporate', self._validate_parc_corporate, dot_filter),
                ('creances_ngbss', self._validate_creances_ngbss, dot_filter),
                ('ca_periodique', self._validate_ca_periodique, dot_filter),
                ('ca_non_periodique', self._validate_ca_non_periodique, dot_filter),
                ('journal_ventes', self._validate_journal_ventes, start_date, end_date),
                ('etat_facture', self._validate_etat_facture, start_date, end_date)
            ]

            # Process each validation step
            for i, (model_name, validation_func, *args) in enumerate(model_steps):
                # Update progress for current step
                progress_pct = int((i / len(model_steps)) * 100)
                self._update_validation_progress(
                    task_id, progress_pct, f"Validating {model_name}", start_time)

                # Run validation
                validation_report['validation_results'][model_name] = validation_func(
                    *args)

                # Small delay to allow the UI to update progress
                time.sleep(0.1)

            # Calculate summary statistics
            total_issues = 0
            records_with_issues = 0
            records_checked = 0

            for model_name, results in validation_report['validation_results'].items():
                total_issues += len(results['issues'])
                records_with_issues += results['records_with_issues']
                records_checked += results['records_checked']

                # Analyze issues by client
                for issue in results['issues']:
                    client = issue.get('client', 'Unknown')
                    if client not in validation_report['issues_by_client']:
                        validation_report['issues_by_client'][client] = []
                    validation_report['issues_by_client'][client].append({
                        'model': model_name,
                        **issue
                    })

            validation_report['total_issues_found'] = total_issues
            validation_report['tables_validated'] = len(
                validation_report['validation_results'])
            validation_report['records_checked'] = records_checked
            validation_report['records_with_issues'] = records_with_issues

            # Determine if cleaning is required based on threshold
            if records_with_issues > 0:
                validation_report['client_cleaning_required'] = True

            # Update completion info
            end_time = time.time()
            execution_time = end_time - start_time
            validation_report['time_completed'] = timezone.now().isoformat()
            validation_report['execution_time_seconds'] = execution_time

            # Mark as complete with 100% progress
            self._update_validation_progress(
                task_id, 100, 'Validation complete', start_time, is_complete=True)

            # Store the final report in cache for retrieval
            cache.set(f"validation_result_{task_id}",
                      validation_report, timeout=3600)

        except Exception as e:
            logger.error(f"Error during validation process: {str(e)}")
            logger.error(traceback.format_exc())

            # Update progress to error state
            cache.set(f"validation_progress_{task_id}", {
                'status': 'error',
                'error_message': str(e),
                'time_elapsed': time.time() - start_time
            }, timeout=3600)

    def _update_validation_progress(self, task_id, progress_percentage, step_description, start_time, is_complete=False):
        """Update the progress tracking information for the validation task"""
        elapsed_time = time.time() - start_time

        # Calculate estimated remaining time based on progress
        if progress_percentage > 0 and not is_complete:
            estimated_total_time = elapsed_time * (100 / progress_percentage)
            remaining_time = estimated_total_time - elapsed_time
            estimated_completion = (
                timezone.now() + timezone.timedelta(seconds=remaining_time)).isoformat()
        else:
            remaining_time = None
            estimated_completion = None

        progress_data = {
            'status': 'complete' if is_complete else 'in_progress',
            'progress': progress_percentage,
            'total_steps': 6,
            'current_step': int((progress_percentage / 100) * 6),
            'step_name': step_description,
            'time_started': (timezone.now() - timezone.timedelta(seconds=elapsed_time)).isoformat(),
            'time_elapsed': elapsed_time,
            'time_remaining': remaining_time,
            'estimated_completion': estimated_completion
        }

        # Save progress to cache
        cache.set(f"validation_progress_{task_id}",
                  progress_data, timeout=3600)

    def post(self, request):
        """
        Trigger cleaning process on database based on validation results
        """
        try:
            # Get validation parameters
            validate_first = request.data.get('validate_first', True)
            models_to_clean = request.data.get('models_to_clean', [])
            dot_filter = request.data.get('dot', None)
            start_date = request.data.get('start_date', None)
            end_date = request.data.get('end_date', None)

            # Create a unique task ID for tracking this cleaning operation
            task_id = f"cleaning_{request.user.id}_{int(time.time())}"

            # Initialize cleaning progress tracking
            cache.set(f"cleaning_progress_{task_id}", {
                'status': 'initializing',
                'progress': 0,
                'total_steps': len(models_to_clean) + (1 if validate_first else 0),
                'current_step': 0,
                'step_name': 'Preparing cleaning process',
                'time_started': timezone.now().isoformat(),
                'estimated_completion': None,
                'time_elapsed': 0,
                'time_remaining': None
            }, timeout=3600)

            # Start cleaning in a background thread to allow progress tracking
            cleaning_thread = threading.Thread(
                target=self._run_cleaning_process,
                args=(request, validate_first, models_to_clean,
                      dot_filter, start_date, end_date, task_id)
            )
            cleaning_thread.daemon = True
            cleaning_thread.start()

            return Response({
                'status': 'started',
                'message': 'Cleaning process started',
                'task_id': task_id
            })

        except Exception as e:
            logger.error(f"Error starting data cleaning: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'status': 'error',
                'error': str(e),
                'traceback': traceback.format_exc()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _run_cleaning_process(self, request, validate_first, models_to_clean, dot_filter, start_date, end_date, task_id):
        """Run the cleaning process in a background thread with progress tracking"""
        try:
            start_time = time.time()

            # Validate first if required
            validation_results = None
            if validate_first:
                # Update progress
                self._update_cleaning_progress(
                    task_id, 0, 'Running validation before cleaning', start_time)

                # Create a validation task and wait for it to complete
                validation_task_id = f"pre_cleaning_validation_{task_id}"
                self._run_validation_process(
                    request, dot_filter, start_date, end_date, validation_task_id)

                # Wait for validation to complete (poll the cache)
                while True:
                    progress = cache.get(
                        f"validation_progress_{validation_task_id}")
                    if progress and (progress['status'] == 'complete' or progress['status'] == 'error'):
                        break
                    time.sleep(0.5)

                # Get validation results
                validation_results = cache.get(
                    f"validation_result_{validation_task_id}")

                # Check if cleaning is required
                if validation_results and not validation_results.get('client_cleaning_required', False):
                    # No cleaning needed
                    cache.set(f"cleaning_progress_{task_id}", {
                        'status': 'complete',
                        'progress': 100,
                        'step_name': 'Validation complete. No cleaning required.',
                        'time_elapsed': time.time() - start_time,
                        'time_remaining': 0,
                        'result': {
                            'status': 'success',
                            'message': 'Validation complete. No cleaning required.',
                            'validation_results': validation_results
                        }
                    }, timeout=3600)
                    return

            # Initialize cleaning results
            cleaning_results = {
                'status': 'success',
                'cleaned_date': timezone.now(),
                'performed_by': request.user.email,
                'cleaning_results': {},
                'total_records_cleaned': 0,
                'models_cleaned': [],
                'task_id': task_id,
                'time_started': timezone.now().isoformat(),
                'time_completed': None,
                'execution_time_seconds': 0
            }

            # Track progress of each cleaning operation
            data_processor = DataProcessor()

            # Determine how many steps we have based on models
            total_steps = len(models_to_clean)
            current_step = 0

            # Clean selected models
            for model_name in models_to_clean:
                current_step += 1
                progress_pct = int((current_step / total_steps) * 100)

                self._update_cleaning_progress(
                    task_id, progress_pct, f"Cleaning {model_name}", start_time)

                # Call the appropriate cleaning method based on model name
                if model_name == 'parc_corporate':
                    cleaning_results['cleaning_results'][model_name] = self._clean_parc_corporate(
                        dot_filter, data_processor)
                    cleaning_results['total_records_cleaned'] += cleaning_results['cleaning_results'][model_name]['records_cleaned']
                    cleaning_results['models_cleaned'].append(model_name)

                elif model_name == 'creances_ngbss':
                    cleaning_results['cleaning_results'][model_name] = self._clean_creances_ngbss(
                        dot_filter, data_processor)
                    cleaning_results['total_records_cleaned'] += cleaning_results['cleaning_results'][model_name]['records_cleaned']
                    cleaning_results['models_cleaned'].append(model_name)

                elif model_name == 'ca_periodique':
                    cleaning_results['cleaning_results'][model_name] = self._clean_ca_periodique(
                        dot_filter, data_processor)
                    cleaning_results['total_records_cleaned'] += cleaning_results['cleaning_results'][model_name]['records_cleaned']
                    cleaning_results['models_cleaned'].append(model_name)

                elif model_name == 'ca_non_periodique':
                    cleaning_results['cleaning_results'][model_name] = self._clean_ca_non_periodique(
                        dot_filter, data_processor)
                    cleaning_results['total_records_cleaned'] += cleaning_results['cleaning_results'][model_name]['records_cleaned']
                    cleaning_results['models_cleaned'].append(model_name)

                elif model_name == 'journal_ventes':
                    cleaning_results['cleaning_results'][model_name] = self._clean_journal_ventes(
                        start_date, end_date, data_processor)
                    cleaning_results['total_records_cleaned'] += cleaning_results['cleaning_results'][model_name]['records_cleaned']
                    cleaning_results['models_cleaned'].append(model_name)

                elif model_name == 'etat_facture':
                    cleaning_results['cleaning_results'][model_name] = self._clean_etat_facture(
                        start_date, end_date, data_processor)
                    cleaning_results['total_records_cleaned'] += cleaning_results['cleaning_results'][model_name]['records_cleaned']
                    cleaning_results['models_cleaned'].append(model_name)

            # Update completion info
            end_time = time.time()
            execution_time = end_time - start_time
            cleaning_results['time_completed'] = timezone.now().isoformat()
            cleaning_results['execution_time_seconds'] = execution_time

            # Mark as complete with 100% progress
            self._update_cleaning_progress(
                task_id, 100, 'Cleaning complete', start_time, is_complete=True)

            # Store the final result in cache for retrieval
            result = {
                'status': 'success',
                'message': f'Cleaning complete. {cleaning_results["total_records_cleaned"]} records cleaned.',
                'cleaning_results': cleaning_results,
                'validation_results': validation_results
            }

            cache.set(f"cleaning_result_{task_id}", result, timeout=3600)

        except Exception as e:
            logger.error(f"Error during cleaning process: {str(e)}")
            logger.error(traceback.format_exc())

            # Update progress to error state
            cache.set(f"cleaning_progress_{task_id}", {
                'status': 'error',
                'error_message': str(e),
                'time_elapsed': time.time() - start_time
            }, timeout=3600)

    def _update_cleaning_progress(self, task_id, progress_percentage, step_description, start_time, is_complete=False):
        """Update the progress tracking information for the cleaning task"""
        elapsed_time = time.time() - start_time

        # Calculate estimated remaining time based on progress
        if progress_percentage > 0 and not is_complete:
            estimated_total_time = elapsed_time * (100 / progress_percentage)
            remaining_time = estimated_total_time - elapsed_time
            estimated_completion = (
                timezone.now() + timezone.timedelta(seconds=remaining_time)).isoformat()
        else:
            remaining_time = None
            estimated_completion = None

        progress_data = {
            'status': 'complete' if is_complete else 'in_progress',
            'progress': progress_percentage,
            'total_steps': 6,  # Same as validation for consistency
            'current_step': int((progress_percentage / 100) * 6),
            'step_name': step_description,
            'time_started': (timezone.now() - timezone.timedelta(seconds=elapsed_time)).isoformat(),
            'time_elapsed': elapsed_time,
            'time_remaining': remaining_time,
            'estimated_completion': estimated_completion
        }

        # Save progress to cache
        cache.set(f"cleaning_progress_{task_id}", progress_data, timeout=3600)

    # Existing validation and cleaning methods are still needed
    # The code below keeps the existing methods unchanged

    def _validate_parc_corporate(self, dot_filter=None):
        """
        Validates ParcCorporate data against client requirements:
        - Should NOT contain categories 5 and 57 in CODE_CUSTOMER_L3
        - Should NOT contain entries with Moohtarif or Solutions Hebergements in OFFER_NAME
        - Should NOT contain entries with Predeactivated in SUBSCRIBER_STATUS
        """
        logger.info("Validating ParcCorporate data")

        result = {
            'model': 'ParcCorporate',
            'records_checked': 0,
            'records_with_issues': 0,
            'issues': []
        }

        try:
            # Base queryset
            queryset = ParcCorporate.objects.all()

            # Apply optional DOT filter if relevant
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Check for invalid customer_l3_code (should be filtered out)
            invalid_customer_l3 = queryset.filter(
                customer_l3_code__in=['5', '57'])
            for record in invalid_customer_l3:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_customer_l3_code',
                    'description': f"Record has invalid customer_l3_code: {record.customer_l3_code} - should have been filtered out",
                    'invoice_id': record.invoice.id,
                    'client': record.customer_full_name
                })

            # Check for Moohtarif or Solutions Hebergements in offer_name
            invalid_offer_name = queryset.filter(
                Q(offer_name__icontains='Moohtarif') |
                Q(offer_name__icontains='Solutions Hebergements')
            )
            for record in invalid_offer_name:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_offer_name',
                    'description': f"Record has invalid offer_name: {record.offer_name} - should have been filtered out",
                    'invoice_id': record.invoice.id,
                    'client': record.customer_full_name
                })

            # Check for Predeactivated subscriber status
            invalid_status = queryset.filter(
                subscriber_status='Predeactivated')
            for record in invalid_status:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_subscriber_status',
                    'description': f"Record has Predeactivated subscriber_status - should have been filtered out",
                    'invoice_id': record.invoice.id,
                    'client': record.customer_full_name
                })

        except Exception as e:
            logger.error(f"Error validating ParcCorporate data: {str(e)}")
            result['error'] = str(e)

        return result

    def _validate_creances_ngbss(self, dot_filter=None):
        """
        Validates CreancesNGBSS data against client requirements:
        - Check that all records have product in VALID_PRODUCTS
        - Check that all records have customer_lev1 in VALID_CUSTOMER_LEV1
        - Check that no records have customer_lev2 in EXCLUDED_CUSTOMER_LEV2
        - Check that all records have customer_lev3 in VALID_CUSTOMER_LEV3
        """
        logger.info("Validating CreancesNGBSS data")

        result = {
            'model': 'CreancesNGBSS',
            'records_checked': 0,
            'records_with_issues': 0,
            'issues': []
        }

        try:
            # Base queryset
            queryset = CreancesNGBSS.objects.all()

            # Apply optional DOT filter
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Check for invalid products
            invalid_products = queryset.exclude(
                product__in=CreancesNGBSS.VALID_PRODUCTS)
            for record in invalid_products:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_product',
                    'description': f"Record has invalid product: {record.product} - should have been filtered out",
                    'invoice_id': record.invoice.id,
                    'client': record.actel
                })

            # Check for invalid customer_lev1
            invalid_customer_lev1 = queryset.exclude(
                customer_lev1__in=CreancesNGBSS.VALID_CUSTOMER_LEV1)
            for record in invalid_customer_lev1:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_customer_lev1',
                    'description': f"Record has invalid customer_lev1: {record.customer_lev1} - should have been filtered out",
                    'invoice_id': record.invoice.id,
                    'client': record.actel
                })

            # Check for excluded customer_lev2
            invalid_customer_lev2 = queryset.filter(
                customer_lev2__in=CreancesNGBSS.EXCLUDED_CUSTOMER_LEV2)
            for record in invalid_customer_lev2:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'excluded_customer_lev2',
                    'description': f"Record has excluded customer_lev2: {record.customer_lev2} - should have been filtered out",
                    'invoice_id': record.invoice.id,
                    'client': record.actel
                })

            # Check for invalid customer_lev3
            invalid_customer_lev3 = queryset.exclude(
                customer_lev3__in=CreancesNGBSS.VALID_CUSTOMER_LEV3)
            for record in invalid_customer_lev3:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_customer_lev3',
                    'description': f"Record has invalid customer_lev3: {record.customer_lev3} - should have been filtered out",
                    'invoice_id': record.invoice.id,
                    'client': record.actel
                })

        except Exception as e:
            logger.error(f"Error validating CreancesNGBSS data: {str(e)}")
            result['error'] = str(e)

        return result

    def _validate_ca_periodique(self, dot_filter=None):
        """
        Validates CAPeriodique data against client requirements:
        - For DOT "Siège", all products should be retained
        - For other DOTs, only 'Specialized Line' and 'LTE' should be retained
        """
        logger.info("Validating CAPeriodique data")

        result = {
            'model': 'CAPeriodique',
            'records_checked': 0,
            'records_with_issues': 0,
            'issues': []
        }

        try:
            # Base queryset
            queryset = CAPeriodique.objects.all()

            # Apply optional DOT filter
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Check records for non-Siège DOTs with invalid products
            invalid_products = queryset.exclude(
                Q(dot_code=CAPeriodique.VALID_DOT_SIEGE) |
                Q(dot__name=CAPeriodique.VALID_DOT_SIEGE)
            ).exclude(
                product__in=CAPeriodique.VALID_PRODUCTS_NON_SIEGE
            )

            for record in invalid_products:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_product_for_non_siege',
                    'description': f"Non-Siège record (DOT: {record.dot or record.dot_code}) has invalid product: {record.product} - should have been filtered out",
                    'invoice_id': record.invoice.id,
                    'dot': str(record.dot or record.dot_code),
                    'product': record.product
                })

        except Exception as e:
            logger.error(f"Error validating CAPeriodique data: {str(e)}")
            result['error'] = str(e)

        return result

    def _validate_ca_non_periodique(self, dot_filter=None):
        """
        Validates CANonPeriodique data against client requirements:
        - All records should have dot equal to "Siège"
        """
        logger.info("Validating CANonPeriodique data")

        result = {
            'model': 'CANonPeriodique',
            'records_checked': 0,
            'records_with_issues': 0,
            'issues': []
        }

        try:
            # Base queryset
            queryset = CANonPeriodique.objects.all()

            # Apply optional DOT filter
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Check for invalid DOT (should be only Siège)
            invalid_dot = queryset.exclude(
                Q(dot_code=CANonPeriodique.VALID_DOT) |
                Q(dot__name=CANonPeriodique.VALID_DOT)
            )

            for record in invalid_dot:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'invalid_dot',
                    'description': f"Record has invalid DOT: {record.dot or record.dot_code} - should be {CANonPeriodique.VALID_DOT}",
                    'invoice_id': record.invoice.id,
                    'dot': str(record.dot or record.dot_code)
                })

        except Exception as e:
            logger.error(f"Error validating CANonPeriodique data: {str(e)}")
            result['error'] = str(e)

        return result

    def _validate_journal_ventes(self, start_date=None, end_date=None):
        """
        Validates JournalVentes data against client requirements:
        - Records from VALID_SIEGE_ORGS should be kept
        - Validate filtering as per client requirements
        """
        logger.info("Validating JournalVentes data")

        result = {
            'model': 'JournalVentes',
            'records_checked': 0,
            'records_with_issues': 0,
            'issues': []
        }

        try:
            # Base queryset
            queryset = JournalVentes.objects.all()

            # Apply date filters if provided
            if start_date:
                queryset = queryset.filter(invoice_date__gte=start_date)
            if end_date:
                queryset = queryset.filter(invoice_date__lte=end_date)

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Check for inconsistencies or errors in journal ventes
            # For example, check for records with previous year in billing period that should be excluded
            current_year = datetime.now().year
            previous_year = str(current_year - 1)

            records_with_previous_year = queryset.filter(
                billing_period__icontains=previous_year
            )

            for record in records_with_previous_year:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'previous_year_billing_period',
                    'description': f"Record has previous year in billing period: {record.billing_period}",
                    'invoice_id': record.invoice.id,
                    'client': record.client
                })

            # Check for non-VALID_SIEGE_ORGS organizations
            if hasattr(JournalVentes, 'VALID_SIEGE_ORGS'):
                invalid_org = queryset.exclude(
                    organization__in=JournalVentes.VALID_SIEGE_ORGS)

                for record in invalid_org:
                    result['records_with_issues'] += 1
                    result['issues'].append({
                        'id': record.id,
                        'type': 'invalid_organization',
                        'description': f"Record has invalid organization: {record.organization} - should be in {JournalVentes.VALID_SIEGE_ORGS}",
                        'invoice_id': record.invoice.id,
                        'client': record.client
                    })

        except Exception as e:
            logger.error(f"Error validating JournalVentes data: {str(e)}")
            result['error'] = str(e)

        return result

    def _validate_etat_facture(self, start_date=None, end_date=None):
        """
        Validates EtatFacture data against client requirements
        """
        logger.info("Validating EtatFacture data")

        result = {
            'model': 'EtatFacture',
            'records_checked': 0,
            'records_with_issues': 0,
            'issues': []
        }

        try:
            # Base queryset
            queryset = EtatFacture.objects.all()

            # Apply date filters if provided
            if start_date:
                queryset = queryset.filter(invoice_date__gte=start_date)
            if end_date:
                queryset = queryset.filter(invoice_date__lte=end_date)

            # Count total records to check
            result['records_checked'] = queryset.count()

            # Check for records with zero collection amount but non-zero total amount
            zero_collection = queryset.filter(
                collection_amount=0,
                total_amount__gt=0
            )

            for record in zero_collection:
                result['records_with_issues'] += 1
                result['issues'].append({
                    'id': record.id,
                    'type': 'zero_collection',
                    'description': f"Record has zero collection amount but non-zero total amount",
                    'invoice_id': record.invoice.id,
                    'client': record.client,
                    'total_amount': float(record.total_amount)
                })

            # Check for other specific validations based on client requirements
            # ...

        except Exception as e:
            logger.error(f"Error validating EtatFacture data: {str(e)}")
            result['error'] = str(e)

        return result

    # Add our cleaning methods to DataValidationView
    def _clean_parc_corporate(self, dot_filter=None, data_processor=None):
        """
        Cleans ParcCorporate data by removing records that don't match client requirements:
        - Removes categories 5 and 57 in CODE_CUSTOMER_L3
        - Removes entries with Moohtarif or Solutions Hebergements in OFFER_NAME
        - Removes entries with Predeactivated in SUBSCRIBER_STATUS
        """
        logger.info("Cleaning ParcCorporate data")
        result = {
            'model': 'ParcCorporate',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = ParcCorporate.objects.all()
            # Apply optional DOT filter if relevant
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))
            # Count total records to check
            result['records_checked'] = queryset.count()
            # Find records that don't match the client's requirements
            records_to_delete = queryset.filter(
                Q(customer_l3_code__in=['5', '57']) |
                Q(offer_name__icontains='Moohtarif') |
                Q(offer_name__icontains='Solutions Hebergements') |
                Q(subscriber_status='Predeactivated')
            )
            # Count and log records to be deleted
            deletion_count = records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete the invalid records
            records_to_delete.delete()

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from ParcCorporate")
        except Exception as e:
            logger.error(f"Error cleaning ParcCorporate data: {str(e)}")
            result['error'] = str(e)
        return result

    def _clean_creances_ngbss(self, dot_filter=None, data_processor=None):
        """
        Cleans CreancesNGBSS data by applying the following rules:
        - Keep only records with product = 'Specialized Line' or 'LTE'
        - Keep only records with customer_lev1 = 'Corporate' or 'Corporate Group'
        - Remove records with customer_lev2 = 'Client professionnelConventionné'
        - Keep only records with customer_lev3 in ['Ligne d'exploitation AP', 'Ligne d'exploitation ATMobilis', 'Ligne d'exploitation ATS']
        """
        logger.info("Cleaning CreancesNGBSS data")
        result = {
            'model': 'CreancesNGBSS',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = CreancesNGBSS.objects.all()
            # Apply optional DOT filter if relevant
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))
            # Count total records to check
            result['records_checked'] = queryset.count()
            # Find records that don't match the client's requirements
            records_to_delete = queryset.filter(
                # Product filter: Not in the valid products list
                ~Q(product__in=['Specialized Line', 'LTE']) |
                # Customer Lev1 filter: Not in the valid customer_lev1 list
                ~Q(customer_lev1__in=['Corporate', 'Corporate Group']) |
                # Customer Lev2 filter: In the excluded customer_lev2 list
                Q(customer_lev2='Client professionnelConventionné') |
                # Customer Lev3 filter: Not in the valid customer_lev3 list
                ~Q(customer_lev3__in=[
                    "Ligne d'exploitation AP",
                    "Ligne d'exploitation ATMobilis",
                    "Ligne d'exploitation ATS"
                ])
            )
            # Count and log records to be deleted
            deletion_count = records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete the invalid records
            records_to_delete.delete()

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from CreancesNGBSS")
        except Exception as e:
            logger.error(f"Error cleaning CreancesNGBSS data: {str(e)}")
            result['error'] = str(e)
        return result

    def _clean_ca_non_periodique(self, dot_filter=None, data_processor=None):
        """
        Cleans CANonPeriodique data according to client requirements:
        - Keep only records with DOT = "Siège"
        - Identify and flag empty cells as anomalies
        """
        logger.info("Cleaning CANonPeriodique data")
        result = {
            'model': 'CANonPeriodique',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }
        try:
            # Base queryset
            queryset = CANonPeriodique.objects.all()
            # Apply optional DOT filter if relevant
            if dot_filter:
                queryset = queryset.filter(
                    Q(dot_code=dot_filter) | Q(dot__code=dot_filter))
            # Count total records to check
            result['records_checked'] = queryset.count()

            # Find records that don't match the client's requirements
            # Keep only records with DOT = "Siège"
            records_to_delete = queryset.filter(
                ~Q(dot_code='Siège') & ~Q(dot__name='Siège')
            )

            # Count and log records to be deleted
            deletion_count = records_to_delete.count()
            result['deleted_records'] = deletion_count

            # Delete records
            records_to_delete.delete()

            result['records_cleaned'] = result['records_checked'] - deletion_count

            logger.info(
                f"Cleaned {deletion_count} invalid records from CANonPeriodique")
        except Exception as e:
            logger.error(f"Error cleaning CANonPeriodique data: {str(e)}")
            result['error'] = str(e)
        return result

    def _clean_ca_periodique(self, dot_filter=None, data_processor=None):
        """
        Cleans CAPeriodique data according to client requirements:
        - For non-Siège DOTs, keep only records with product in ['Specialized Line', 'LTE']
        """
        logger.info("Cleaning CAPeriodique data")
        result = {
            'model': 'CAPeriodique',
            'records_checked': 0,
            'records_cleaned': 0,
            'deleted_records': 0,
            'issues': []
        }

        try:
            # Find records that don't match the client's requirements
            # For non-Siège DOTs, keep only records with product in ['Specialized Line', 'LTE']
            records_to_delete = CAPeriodique.objects.filter(
                ~Q(dot_code='Siège') & ~Q(dot__name='Siège') &
                ~Q(product__in=['Specialized Line', 'LTE'])
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CAPeriodique.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from CAPeriodique")
        except Exception as e:
            logger.error(f"Error cleaning CAPeriodique data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_ca_cnt(self):
        """
        Cleans CACNT data according to client requirements:
        - Keep only records with department = 'Direction Commerciale Corporate'
        """
        logger.info("Cleaning CACNT data")
        result = {
            'total_before': CACNT.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = CACNT.objects.filter(
                ~Q(department='Direction Commerciale Corporate')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CACNT.objects.count()

            logger.info(f"Cleaned {deletion_count} invalid records from CACNT")
        except Exception as e:
            logger.error(f"Error cleaning CACNT data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_ca_dnt(self):
        """
        Cleans CADNT data according to client requirements:
        - Keep only records with department = 'Direction Commerciale Corporate'
        """
        logger.info("Cleaning CADNT data")
        result = {
            'total_before': CADNT.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = CADNT.objects.filter(
                ~Q(department='Direction Commerciale Corporate')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CADNT.objects.count()

            logger.info(f"Cleaned {deletion_count} invalid records from CADNT")
        except Exception as e:
            logger.error(f"Error cleaning CADNT data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_ca_rfd(self):
        """
        Cleans CARFD data according to client requirements:
        - Keep only records with department = 'Direction Commerciale Corporate'
        """
        logger.info("Cleaning CARFD data")
        result = {
            'total_before': CARFD.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = CARFD.objects.filter(
                ~Q(department='Direction Commerciale Corporate')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CARFD.objects.count()

            logger.info(f"Cleaned {deletion_count} invalid records from CARFD")
        except Exception as e:
            logger.error(f"Error cleaning CARFD data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_journal_ventes(self):
        """
        Cleans JournalVentes data according to client requirements:
        - Clean records with specific organization criteria
        - Remove records from previous years
        - Fix formatting issues in organization names
        """
        logger.info("Cleaning JournalVentes data")
        result = {
            'total_before': JournalVentes.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            current_year = datetime.now().year
            previous_year = str(current_year - 1)

            # Find records that don't match the client's requirements
            records_to_delete = JournalVentes.objects.filter(
                Q(
                    Q(organization__icontains='AT Siège') &
                    ~Q(organization__icontains='DCC') &
                    ~Q(organization__icontains='DCGC')
                ) |
                Q(billing_period__icontains=previous_year)
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            # Fix formatting issues
            records_to_fix = JournalVentes.objects.filter(
                Q(organization__icontains='DOT_') |
                Q(organization__icontains='_') |
                Q(organization__icontains='-')
            )

            for record in records_to_fix:
                org_name = record.organization
                # Clean up formatting
                if 'DOT_' in org_name:
                    org_name = org_name.replace('DOT_', 'DOT ')
                org_name = org_name.replace('_', ' ').replace('-', ' ')
                record.organization = org_name
                record.save()

            result['total_deleted'] = deletion_count
            result['total_after'] = JournalVentes.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from JournalVentes")
        except Exception as e:
            logger.error(f"Error cleaning JournalVentes data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_etat_facture(self):
        """
        Cleans EtatFacture data according to client requirements:
        - Clean records with specific organization criteria
        - Fix formatting issues in organization names
        """
        logger.info("Cleaning EtatFacture data")
        result = {
            'total_before': EtatFacture.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = EtatFacture.objects.filter(
                Q(organization__icontains='AT Siège') &
                ~Q(organization__icontains='DCC') &
                ~Q(organization__icontains='DCGC')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            # Fix formatting issues
            records_to_fix = EtatFacture.objects.filter(
                Q(organization__icontains='DOT_') |
                Q(organization__icontains='_') |
                Q(organization__icontains='-')
            )

            for record in records_to_fix:
                org_name = record.organization
                # Clean up formatting
                if 'DOT_' in org_name:
                    org_name = org_name.replace('DOT_', 'DOT ')
                org_name = org_name.replace('_', ' ').replace('-', ' ')
                record.organization = org_name
                record.save()

            result['total_deleted'] = deletion_count
            result['total_after'] = EtatFacture.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from EtatFacture")
        except Exception as e:
            logger.error(f"Error cleaning EtatFacture data: {str(e)}")
            result['error'] = str(e)

        return result


class ValidationProgressView(APIView):
    """
    API view for retrieving progress information for validation and cleaning operations.
    Provides real-time updates on the progress of long-running validation and cleaning tasks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get progress information for a validation or cleaning task
        """
        task_id = request.query_params.get('task_id')
        task_type = request.query_params.get(
            'type', 'validation')  # validation or cleaning

        if not task_id:
            return Response({
                'status': 'error',
                'message': 'Missing task_id parameter'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get progress information from cache
        progress_key = f"{task_type}_progress_{task_id}"
        progress_data = cache.get(progress_key)

        if not progress_data:
            return Response({
                'status': 'error',
                'message': f'No {task_type} task found with ID {task_id}'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if the task is complete and we should return results
        if progress_data.get('status') == 'complete':
            result_key = f"{task_type}_result_{task_id}"
            result_data = cache.get(result_key)

            if result_data:
                # Include result data with the response
                progress_data['result'] = result_data

        return Response(progress_data)


class DataCleanupView(APIView):
    """
    API view for cleaning the database according to client requirements.
    This view applies specific filtering rules to each data type and removes
    or updates records that don't match the criteria.
    """
    permission_classes = [IsAuthenticated]

    def _analyze_parc_corporate(self):
        """Analyze ParcCorporate data to identify records needing cleaning"""
        try:
            queryset = ParcCorporate.objects.all()
            records_to_clean = {
                'total': queryset.count(),
                'customer_l3_code': queryset.filter(customer_l3_code__in=['5', '57']).count(),
                'offer_name': queryset.filter(
                    Q(offer_name__icontains='Moohtarif') |
                    Q(offer_name__icontains='Solutions Hebergements')
                ).count(),
                'subscriber_status': queryset.filter(subscriber_status='Predeactivated').count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing ParcCorporate data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def _analyze_creances_ngbss(self):
        """Analyze CreancesNGBSS data to identify records needing cleaning"""
        try:
            queryset = CreancesNGBSS.objects.all()
            records_to_clean = {
                'total': queryset.count(),
                'product': queryset.filter(~Q(product__in=['Specialized Line', 'LTE'])).count(),
                'customer_lev1': queryset.filter(~Q(customer_lev1__in=['Corporate', 'Corporate Group'])).count(),
                'customer_lev2': queryset.filter(customer_lev2='Client professionnelConventionné').count(),
                'customer_lev3': queryset.filter(~Q(customer_lev3__in=[
                    "Ligne d'exploitation AP",
                    "Ligne d'exploitation ATMobilis",
                    "Ligne d'exploitation ATS"
                ])).count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing CreancesNGBSS data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def _analyze_ca_periodique(self):
        """Analyze CAPeriodique data to identify records needing cleaning"""
        try:
            queryset = CAPeriodique.objects.all()
            records_to_clean = {
                'total': queryset.count(),
                'product': queryset.filter(
                    ~Q(dot_code='Siège') & ~Q(dot__name='Siège') &
                    ~Q(product__in=['Specialized Line', 'LTE'])
                ).count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing CAPeriodique data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def _analyze_ca_non_periodique(self):
        """Analyze CANonPeriodique data to identify records needing cleaning"""
        try:
            queryset = CANonPeriodique.objects.all()
            records_to_clean = {
                'total': queryset.count(),
                'dot': queryset.filter(~Q(dot_code='Siège') & ~Q(dot__name='Siège')).count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing CANonPeriodique data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def _analyze_ca_cnt(self):
        """Analyze CACNT data to identify records needing cleaning"""
        try:
            queryset = CACNT.objects.all()
            records_to_clean = {
                'total': queryset.count(),
                'department': queryset.filter(~Q(department='Direction Commerciale Corporate')).count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing CACNT data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def _analyze_ca_dnt(self):
        """Analyze CADNT data to identify records needing cleaning"""
        try:
            queryset = CADNT.objects.all()
            records_to_clean = {
                'total': queryset.count(),
                'department': queryset.filter(~Q(department='Direction Commerciale Corporate')).count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing CADNT data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def _analyze_ca_rfd(self):
        """Analyze CARFD data to identify records needing cleaning"""
        try:
            queryset = CARFD.objects.all()
            records_to_clean = {
                'total': queryset.count(),
                'department': queryset.filter(~Q(department='Direction Commerciale Corporate')).count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing CARFD data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def _analyze_journal_ventes(self):
        """Analyze JournalVentes data to identify records needing cleaning"""
        try:
            queryset = JournalVentes.objects.all()
            current_year = datetime.now().year
            previous_year = str(current_year - 1)

            records_to_clean = {
                'total': queryset.count(),
                'organization': queryset.filter(
                    Q(organization__icontains='AT Siège') &
                    ~Q(organization__icontains='DCC') &
                    ~Q(organization__icontains='DCGC')
                ).count(),
                'billing_period': queryset.filter(billing_period__icontains=previous_year).count(),
                'formatting': queryset.filter(
                    Q(organization__icontains='DOT_') |
                    Q(organization__icontains='_') |
                    Q(organization__icontains='-')
                ).count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing JournalVentes data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def _analyze_etat_facture(self):
        """Analyze EtatFacture data to identify records needing cleaning"""
        try:
            queryset = EtatFacture.objects.all()
            records_to_clean = {
                'total': queryset.count(),
                'organization': queryset.filter(
                    Q(organization__icontains='AT Siège') &
                    ~Q(organization__icontains='DCC') &
                    ~Q(organization__icontains='DCGC')
                ).count(),
                'formatting': queryset.filter(
                    Q(organization__icontains='DOT_') |
                    Q(organization__icontains='_') |
                    Q(organization__icontains='-')
                ).count()
            }
            return {'records_to_clean': records_to_clean}
        except Exception as e:
            logger.error(f"Error analyzing EtatFacture data: {str(e)}")
            return {'records_to_clean': {'error': str(e)}}

    def get(self, request):
        """
        Analyze the current state of data and identify records that need to be cleaned
        based on the specified rules.
        """
        data_type = request.query_params.get('data_type', 'all')
        response_data = {
            'status': 'success',
            'records_to_clean': {},
            'cleaning_rules': {}
        }

        if data_type == 'all' or data_type == 'parc_corporate':
            parc_data = self._analyze_parc_corporate()
            response_data['records_to_clean']['parc_corporate'] = parc_data['records_to_clean']
            response_data['cleaning_rules']['parc_corporate'] = {
                'CUSTOMER_L3_CODE': 'Remove codes 5 and 57',
                'OFFER_NAME': 'Remove Moohtarif and Solutions Hebergements',
                'SUBSCRIBER_STATUS': 'Remove Predeactivated status'
            }

        if data_type == 'all' or data_type == 'creances_ngbss':
            creances_data = self._analyze_creances_ngbss()
            response_data['records_to_clean']['creances_ngbss'] = creances_data['records_to_clean']
            response_data['cleaning_rules']['creances_ngbss'] = {
                'PRODUCT': 'Keep only Specialized Line and LTE',
                'CUST_LEV1': 'Keep only Corporate and Corporate Group',
                'CUST_LEV2': 'Remove Client professionnelConventionné',
                'CUST_LEV3': 'Keep only Ligne d\'exploitation AP, Ligne d\'exploitation ATMobilis, and Ligne d\'exploitation ATS',
                'EMPTY_FIELDS': 'Identify empty fields as anomalies'
            }

        if data_type == 'all' or data_type == 'ca_non_periodique':
            ca_non_periodique_data = self._analyze_ca_non_periodique()
            response_data['records_to_clean']['ca_non_periodique'] = ca_non_periodique_data['records_to_clean']
            response_data['cleaning_rules']['ca_non_periodique'] = {
                'EMPTY_FIELDS': 'Identify empty fields as anomalies'
            }

        if data_type == 'all' or data_type == 'ca_periodique':
            ca_periodique_data = self._analyze_ca_periodique()
            response_data['records_to_clean']['ca_periodique'] = ca_periodique_data['records_to_clean']
            response_data['cleaning_rules']['ca_periodique'] = {
                'PRODUCT': 'Keep only Specialized Line and LTE',
                'EMPTY_FIELDS': 'Identify empty fields as anomalies'
            }

        if data_type == 'all' or data_type == 'ca_cnt':
            ca_cnt_data = self._analyze_ca_cnt()
            response_data['records_to_clean']['ca_cnt'] = ca_cnt_data['records_to_clean']
            response_data['cleaning_rules']['ca_cnt'] = {
                'DEPARTMENT': 'Keep only Direction Commerciale Corporate',
                'EMPTY_FIELDS': 'Identify empty fields as anomalies'
            }

        if data_type == 'all' or data_type == 'ca_dnt':
            ca_dnt_data = self._analyze_ca_dnt()
            response_data['records_to_clean']['ca_dnt'] = ca_dnt_data['records_to_clean']
            response_data['cleaning_rules']['ca_dnt'] = {
                'DEPARTMENT': 'Keep only Direction Commerciale Corporate',
                'EMPTY_FIELDS': 'Identify empty fields as anomalies'
            }

        if data_type == 'all' or data_type == 'ca_rfd':
            ca_rfd_data = self._analyze_ca_rfd()
            response_data['records_to_clean']['ca_rfd'] = ca_rfd_data['records_to_clean']
            response_data['cleaning_rules']['ca_rfd'] = {
                'DEPARTMENT': 'Keep only Direction Commerciale Corporate',
                'EMPTY_FIELDS': 'Identify empty fields as anomalies'
            }

        if data_type == 'all' or data_type == 'journal_ventes':
            journal_ventes_data = self._analyze_journal_ventes()
            response_data['records_to_clean']['journal_ventes'] = journal_ventes_data['records_to_clean']
            response_data['cleaning_rules']['journal_ventes'] = {
                'ORG_NAME': 'Clean up org_name field',
                'PRODUCT_CODE': 'Keep only specific product codes',
                'EMPTY_FIELDS': 'Identify empty fields as anomalies'
            }

        if data_type == 'all' or data_type == 'etat_facture':
            etat_facture_data = self._analyze_etat_facture()
            response_data['records_to_clean']['etat_facture'] = etat_facture_data['records_to_clean']
            response_data['cleaning_rules']['etat_facture'] = {
                'ORG_NAME': 'Clean up org_name field',
                'PRODUCT_CODE': 'Keep only specific product codes',
                'EMPTY_FIELDS': 'Identify empty fields as anomalies'
            }

        return Response(response_data)

    def post(self, request):
        """
        Start the data cleanup process for the specified data type.
        """
        data_type = request.data.get('data_type')
        if not data_type:
            return Response({
                'status': 'error',
                'message': 'data_type is required'
            }, status=400)

        # Generate a unique task ID
        task_id = f'cleanup_{uuid.uuid4().hex}'

        # Start the cleanup process in a background thread
        thread = threading.Thread(
            target=self._run_cleanup_process,
            args=(request, data_type, task_id)
        )
        thread.daemon = True
        thread.start()

        return Response({
            'status': 'success',
            'message': 'Cleanup process started',
            'task_id': task_id
        })

    def _run_cleanup_process(self, request, data_type, task_id):
        """
        Run the cleanup process for the specified data type.
        """
        try:
            # Initialize progress in cache
            start_time = time.time()
            cache.set(f'cleanup_progress_{task_id}', {
                'status': 'running',
                'progress': 0,
                'step': 'Starting cleanup process...',
                'start_time': start_time,
                'elapsed_time': 0
            }, timeout=3600)  # 1 hour timeout

            results = {}

            # Update progress for each data type
            if data_type == 'all' or data_type == 'parc_corporate':
                self._update_cleanup_progress(
                    task_id, 10, 'Cleaning Parc Corporate NGBSS...', start_time)
                results['parc_corporate'] = clean_parc_corporate()

            if data_type == 'all' or data_type == 'creances_ngbss':
                self._update_cleanup_progress(
                    task_id, 20, 'Cleaning Créances NGBSS...', start_time)
                results['creances_ngbss'] = clean_creances_ngbss()

            if data_type == 'all' or data_type == 'ca_non_periodique':
                self._update_cleanup_progress(
                    task_id, 30, 'Cleaning CA Non Périodique...', start_time)
                results['ca_non_periodique'] = clean_ca_non_periodique()

            if data_type == 'all' or data_type == 'ca_periodique':
                self._update_cleanup_progress(
                    task_id, 40, 'Cleaning CA Périodique...', start_time)
                results['ca_periodique'] = clean_ca_periodique()

            if data_type == 'all' or data_type == 'ca_cnt':
                self._update_cleanup_progress(
                    task_id, 50, 'Cleaning CA CNT...', start_time)
                results['ca_cnt'] = clean_ca_cnt()

            if data_type == 'all' or data_type == 'ca_dnt':
                self._update_cleanup_progress(
                    task_id, 60, 'Cleaning CA DNT...', start_time)
                results['ca_dnt'] = clean_ca_dnt()

            if data_type == 'all' or data_type == 'ca_rfd':
                self._update_cleanup_progress(
                    task_id, 70, 'Cleaning CA RFD...', start_time)
                results['ca_rfd'] = clean_ca_rfd()

            if data_type == 'all' or data_type == 'journal_ventes':
                self._update_cleanup_progress(
                    task_id, 80, 'Cleaning Journal des Ventes...', start_time)
                results['journal_ventes'] = clean_journal_ventes()

            if data_type == 'all' or data_type == 'etat_facture':
                self._update_cleanup_progress(
                    task_id, 90, 'Cleaning État de Facture...', start_time)
                results['etat_facture'] = clean_etat_facture()

            # Store the results in cache
            cache.set(f'cleanup_result_{task_id}', results, timeout=3600)

            # Update final progress
            self._update_cleanup_progress(
                task_id, 100, 'Cleanup completed successfully', start_time, is_complete=True)

        except Exception as e:
            # Store error in cache
            cache.set(f'cleanup_result_{task_id}', {
                'status': 'error',
                'message': str(e)
            }, timeout=3600)

            # Update progress with error
            self._update_cleanup_progress(
                task_id, 0, f'Error: {str(e)}', start_time, is_complete=True)
            logger.error(f"Error in cleanup process: {str(e)}")

    def _clean_parc_corporate(self):
        """
        Cleans ParcCorporate data by removing records that don't match client requirements:
        - Removes categories 5 and 57 in customer_l3_code
        - Removes entries with Moohtarif or Solutions Hebergements in offer_name
        - Removes entries with Predeactivated in subscriber_status
        """
        logger.info("Cleaning ParcCorporate data")
        result = {
            'total_before': ParcCorporate.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = ParcCorporate.objects.filter(
                Q(customer_l3_code__in=['5', '57']) |
                Q(offer_name__icontains='Moohtarif') |
                Q(offer_name__icontains='Solutions Hebergements') |
                Q(subscriber_status='Predeactivated')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = ParcCorporate.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from ParcCorporate")
        except Exception as e:
            logger.error(f"Error cleaning ParcCorporate data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_creances_ngbss(self):
        """
        Cleans CreancesNGBSS data according to client requirements:
        - Keep only records with product in ['Specialized Line', 'LTE']
        - Keep only records with customer_lev1 in ['Corporate', 'Corporate Group']
        - Remove records with customer_lev2 = 'Client professionnelConventionné'
        - Keep only records with customer_lev3 in specific exploitation lines
        """
        logger.info("Cleaning CreancesNGBSS data")
        result = {
            'total_before': CreancesNGBSS.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = CreancesNGBSS.objects.filter(
                Q(~Q(product__in=['Specialized Line', 'LTE'])) |
                Q(~Q(customer_lev1__in=['Corporate', 'Corporate Group'])) |
                Q(customer_lev2='Client professionnelConventionné') |
                Q(~Q(customer_lev3__in=[
                    "Ligne d'exploitation AP",
                    "Ligne d'exploitation ATMobilis",
                    "Ligne d'exploitation ATS"
                ]))
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CreancesNGBSS.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from CreancesNGBSS")
        except Exception as e:
            logger.error(f"Error cleaning CreancesNGBSS data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_ca_non_periodique(self):
        """
        Cleans CANonPeriodique data according to client requirements:
        - Keep only records with DOT = "Siège"
        """
        logger.info("Cleaning CANonPeriodique data")
        result = {
            'total_before': CANonPeriodique.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = CANonPeriodique.objects.filter(
                ~Q(dot_code='Siège') & ~Q(dot__name='Siège')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CANonPeriodique.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from CANonPeriodique")
        except Exception as e:
            logger.error(f"Error cleaning CANonPeriodique data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_ca_periodique(self):
        """
        Cleans CAPeriodique data according to client requirements:
        - For non-Siège DOTs, keep only records with product in ['Specialized Line', 'LTE']
        """
        logger.info("Cleaning CAPeriodique data")
        result = {
            'total_before': CAPeriodique.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            # For non-Siège DOTs, keep only records with product in ['Specialized Line', 'LTE']
            records_to_delete = CAPeriodique.objects.filter(
                ~Q(dot_code='Siège') & ~Q(dot__name='Siège') &
                ~Q(product__in=['Specialized Line', 'LTE'])
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CAPeriodique.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from CAPeriodique")
        except Exception as e:
            logger.error(f"Error cleaning CAPeriodique data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_ca_cnt(self):
        """
        Cleans CACNT data according to client requirements:
        - Keep only records with department = 'Direction Commerciale Corporate'
        """
        logger.info("Cleaning CACNT data")
        result = {
            'total_before': CACNT.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = CACNT.objects.filter(
                ~Q(department='Direction Commerciale Corporate')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CACNT.objects.count()

            logger.info(f"Cleaned {deletion_count} invalid records from CACNT")
        except Exception as e:
            logger.error(f"Error cleaning CACNT data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_ca_dnt(self):
        """
        Cleans CADNT data according to client requirements:
        - Keep only records with department = 'Direction Commerciale Corporate'
        """
        logger.info("Cleaning CADNT data")
        result = {
            'total_before': CADNT.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = CADNT.objects.filter(
                ~Q(department='Direction Commerciale Corporate')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CADNT.objects.count()

            logger.info(f"Cleaned {deletion_count} invalid records from CADNT")
        except Exception as e:
            logger.error(f"Error cleaning CADNT data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_ca_rfd(self):
        """
        Cleans CARFD data according to client requirements:
        - Keep only records with department = 'Direction Commerciale Corporate'
        """
        logger.info("Cleaning CARFD data")
        result = {
            'total_before': CARFD.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = CARFD.objects.filter(
                ~Q(department='Direction Commerciale Corporate')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            result['total_deleted'] = deletion_count
            result['total_after'] = CARFD.objects.count()

            logger.info(f"Cleaned {deletion_count} invalid records from CARFD")
        except Exception as e:
            logger.error(f"Error cleaning CARFD data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_journal_ventes(self):
        """
        Cleans JournalVentes data according to client requirements:
        - Clean records with specific organization criteria
        - Remove records from previous years
        - Fix formatting issues in organization names
        """
        logger.info("Cleaning JournalVentes data")
        result = {
            'total_before': JournalVentes.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            current_year = datetime.now().year
            previous_year = str(current_year - 1)

            # Find records that don't match the client's requirements
            records_to_delete = JournalVentes.objects.filter(
                Q(
                    Q(organization__icontains='AT Siège') &
                    ~Q(organization__icontains='DCC') &
                    ~Q(organization__icontains='DCGC')
                ) |
                Q(billing_period__icontains=previous_year)
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            # Fix formatting issues
            records_to_fix = JournalVentes.objects.filter(
                Q(organization__icontains='DOT_') |
                Q(organization__icontains='_') |
                Q(organization__icontains='-')
            )

            for record in records_to_fix:
                org_name = record.organization
                # Clean up formatting
                if 'DOT_' in org_name:
                    org_name = org_name.replace('DOT_', 'DOT ')
                org_name = org_name.replace('_', ' ').replace('-', ' ')
                record.organization = org_name
                record.save()

            result['total_deleted'] = deletion_count
            result['total_after'] = JournalVentes.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from JournalVentes")
        except Exception as e:
            logger.error(f"Error cleaning JournalVentes data: {str(e)}")
            result['error'] = str(e)

        return result

    def _clean_etat_facture(self):
        """
        Cleans EtatFacture data according to client requirements:
        - Clean records with specific organization criteria
        - Fix formatting issues in organization names
        """
        logger.info("Cleaning EtatFacture data")
        result = {
            'total_before': EtatFacture.objects.count(),
            'total_deleted': 0,
            'total_after': 0,
            'anomalies_created': 0
        }

        try:
            # Find records that don't match the client's requirements
            records_to_delete = EtatFacture.objects.filter(
                Q(organization__icontains='AT Siège') &
                ~Q(organization__icontains='DCC') &
                ~Q(organization__icontains='DCGC')
            )

            # Count and delete the invalid records
            deletion_count = records_to_delete.count()
            records_to_delete.delete()

            # Fix formatting issues
            records_to_fix = EtatFacture.objects.filter(
                Q(organization__icontains='DOT_') |
                Q(organization__icontains='_') |
                Q(organization__icontains='-')
            )

            for record in records_to_fix:
                org_name = record.organization
                # Clean up formatting
                if 'DOT_' in org_name:
                    org_name = org_name.replace('DOT_', 'DOT ')
                org_name = org_name.replace('_', ' ').replace('-', ' ')
                record.organization = org_name
                record.save()

            result['total_deleted'] = deletion_count
            result['total_after'] = EtatFacture.objects.count()

            logger.info(
                f"Cleaned {deletion_count} invalid records from EtatFacture")
        except Exception as e:
            logger.error(f"Error cleaning EtatFacture data: {str(e)}")
            result['error'] = str(e)

        return result

    def _update_cleanup_progress(self, task_id, progress_percentage, step_description, start_time, is_complete=False):
        """
        Update the progress of the cleanup process in the cache
        """
        progress_key = f"cleanup_progress_{task_id}"

        progress_data = {
            'status': 'complete' if is_complete else 'in_progress',
            'progress': progress_percentage,
            'step': step_description,
            'start_time': start_time,
            'elapsed_time': time.time() - start_time
        }

        cache.set(progress_key, progress_data,
                  timeout=86400)  # 24-hour timeout

    def post(self, request):
        # Get data type from request
        data_type = request.data.get('data_type', 'all')

        # Create a unique task ID for tracking progress
        task_id = str(uuid.uuid4())

        # Start cleanup process in a background thread
        thread = threading.Thread(target=self._run_cleanup_process,
                                  args=(request, data_type, task_id))
        thread.daemon = True
        thread.start()

        # Return task ID for frontend to track progress
        return Response({
            'task_id': task_id,
            'message': 'Data cleanup started',
            'status': 'running'
        })

    def _run_cleanup_process(self, request, data_type, task_id):
        """Run the cleanup process in a background thread"""
        try:
            # Initialize progress tracker
            self._update_cleanup_progress(task_id, 0, 'Starting cleanup process...',
                                          time.time())

            results = {}

            # Determine which models to clean based on data_type
            models_to_clean = []
            if data_type == 'all':
                models_to_clean = [
                    ('parc_corporate', clean_parc_corporate),
                    ('creances_ngbss', clean_creances_ngbss),
                    ('ca_non_periodique', clean_ca_non_periodique),
                    ('ca_periodique', clean_ca_periodique),
                    ('ca_cnt', clean_ca_cnt),
                    ('ca_dnt', clean_ca_dnt),
                    ('ca_rfd', clean_ca_rfd),
                    ('journal_ventes', clean_journal_ventes),
                    ('etat_facture', clean_etat_facture)
                ]
            else:
                # Map data_type to its corresponding cleanup function
                cleanup_map = {
                    'parc_corporate': clean_parc_corporate,
                    'creances_ngbss': clean_creances_ngbss,
                    'ca_non_periodique': clean_ca_non_periodique,
                    'ca_periodique': clean_ca_periodique,
                    'ca_cnt': clean_ca_cnt,
                    'ca_dnt': clean_ca_dnt,
                    'ca_rfd': clean_ca_rfd,
                    'journal_ventes': clean_journal_ventes,
                    'etat_facture': clean_etat_facture
                }
                if data_type in cleanup_map:
                    models_to_clean = [(data_type, cleanup_map[data_type])]
                else:
                    raise ValueError(f"Invalid data type: {data_type}")

            # Clean each model and track progress
            total_models = len(models_to_clean)
            for i, (model_name, cleanup_func) in enumerate(models_to_clean):
                progress = int((i / total_models) * 100)
                self._update_cleanup_progress(
                    task_id, progress, f"Cleaning {model_name} data...", time.time())

                # Call the cleanup function and store results
                result = cleanup_func()
                results[model_name] = result

                # Update progress
                progress = int(((i + 1) / total_models) * 100)
                self._update_cleanup_progress(
                    task_id, progress,
                    f"Completed cleaning {model_name} data", time.time())

            # Finalize progress
            self._update_cleanup_progress(
                task_id, 100, "Data cleanup completed", time.time(), is_complete=True)

            # Store the final results in the progress tracker
            progress_tracker = CleanupProgressView.objects.get(task_id=task_id)
            progress_tracker.result = results
            progress_tracker.save()

        except Exception as e:
            logger.error(f"Error in data cleanup process: {str(e)}")
            logger.error(traceback.format_exc())
            self._update_cleanup_progress(
                task_id, 0, f"Error: {str(e)}", time.time(), is_complete=True)

            # Store the error in the progress tracker
            try:
                progress_tracker = CleanupProgressView.objects.get(
                    task_id=task_id)
                progress_tracker.error = str(e)
                progress_tracker.status = 'failed'
                progress_tracker.save()
            except Exception as inner_e:
                logger.error(
                    f"Failed to update progress tracker: {str(inner_e)}")

    def _backup_data_before_cleanup(self, data_type):
        """Create a JSON backup of data before cleanup operations"""
        from django.core.serializers import serialize
        import os
        from datetime import datetime
        from django.conf import settings

        models_map = {
            'parc_corporate': ParcCorporate,
            'creances_ngbss': CreancesNGBSS,
            'ca_non_periodique': CANonPeriodique,
            'ca_periodique': CAPeriodique,
            'ca_cnt': CACNT,
            'ca_dnt': CADNT,
            'ca_rfd': CARFD,
            'journal_ventes': JournalVentes,
            'etat_facture': EtatFacture
        }

        if data_type not in models_map and data_type != 'all':
            logger.warning(f"Invalid data type for backup: {data_type}")
            return False

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_dir = os.path.join(settings.MEDIA_ROOT, 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        logger.info(f"Creating backup before cleaning {data_type}")

        if data_type == 'all':
            for model_name, model in models_map.items():
                filename = os.path.join(
                    backup_dir, f"{model_name}_{timestamp}.json")
                with open(filename, 'w') as f:
                    # Limit to 10,000 records to avoid memory issues
                    data = serialize('json', model.objects.all()[:10000])
                    f.write(data)
                logger.info(f"Backed up {model_name} to {filename}")
        else:
            model = models_map[data_type]
            filename = os.path.join(
                backup_dir, f"{data_type}_{timestamp}.json")
            with open(filename, 'w') as f:
                data = serialize('json', model.objects.all()[:10000])
                f.write(data)
            logger.info(f"Backed up {data_type} to {filename}")

        return True

    def _run_cleanup_process(self, request, data_type, task_id):
        """Run the cleanup process in a background thread"""
        try:
            # Initialize progress tracker
            self._update_cleanup_progress(task_id, 0, 'Starting cleanup process...',
                                          time.time())

            results = {}

            # Determine which models to clean based on data_type
            models_to_clean = []
            if data_type == 'all':
                models_to_clean = [
                    ('parc_corporate', clean_parc_corporate),
                    ('creances_ngbss', clean_creances_ngbss),
                    ('ca_non_periodique', clean_ca_non_periodique),
                    ('ca_periodique', clean_ca_periodique),
                    ('ca_cnt', clean_ca_cnt),
                    ('ca_dnt', clean_ca_dnt),
                    ('ca_rfd', clean_ca_rfd),
                    ('journal_ventes', clean_journal_ventes),
                    ('etat_facture', clean_etat_facture)
                ]
            else:
                # Map data_type to its corresponding cleanup function
                cleanup_map = {
                    'parc_corporate': clean_parc_corporate,
                    'creances_ngbss': clean_creances_ngbss,
                    'ca_non_periodique': clean_ca_non_periodique,
                    'ca_periodique': clean_ca_periodique,
                    'ca_cnt': clean_ca_cnt,
                    'ca_dnt': clean_ca_dnt,
                    'ca_rfd': clean_ca_rfd,
                    'journal_ventes': clean_journal_ventes,
                    'etat_facture': clean_etat_facture
                }
                if data_type in cleanup_map:
                    models_to_clean = [(data_type, cleanup_map[data_type])]
                else:
                    raise ValueError(f"Invalid data type: {data_type}")

            # Clean each model and track progress
            total_models = len(models_to_clean)
            for i, (model_name, cleanup_func) in enumerate(models_to_clean):
                progress = int((i / total_models) * 100)
                self._update_cleanup_progress(
                    task_id, progress, f"Cleaning {model_name} data...", time.time())

                # Call the cleanup function and store results
                result = cleanup_func()
                results[model_name] = result

                # Update progress
                progress = int(((i + 1) / total_models) * 100)
                self._update_cleanup_progress(
                    task_id, progress,
                    f"Completed cleaning {model_name} data", time.time())

            # Finalize progress
            self._update_cleanup_progress(
                task_id, 100, "Data cleanup completed", time.time(), is_complete=True)

            # Store the final results in the progress tracker
            progress_tracker = CleanupProgressView.objects.get(task_id=task_id)
            progress_tracker.result = results
            progress_tracker.save()

        except Exception as e:
            logger.error(f"Error in data cleanup process: {str(e)}")
            logger.error(traceback.format_exc())
            self._update_cleanup_progress(
                task_id, 0, f"Error: {str(e)}", time.time(), is_complete=True)

            # Store the error in the progress tracker
            try:
                progress_tracker = CleanupProgressView.objects.get(
                    task_id=task_id)
                progress_tracker.error = str(e)
                progress_tracker.status = 'failed'
                progress_tracker.save()
            except Exception as inner_e:
                logger.error(
                    f"Failed to update progress tracker: {str(inner_e)}")


class CleanupProgressView(APIView):
    """
    API view for retrieving progress information for cleanup operations.
    Provides real-time updates on the progress of data cleanup tasks.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        task_type = 'cleanup'

        if not task_id:
            return Response({
                'status': 'error',
                'message': 'task_id parameter is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get progress information from cache
        progress_key = f"{task_type}_progress_{task_id}"
        progress_data = cache.get(progress_key)

        if not progress_data:
            return Response({
                'status': 'error',
                'message': f'No {task_type} task found with ID {task_id}'
            }, status=status.HTTP_404_NOT_FOUND)

        # Check if the task is complete and we should return results
        if progress_data.get('status') == 'complete':
            result_key = f"{task_type}_result_{task_id}"
            result_data = cache.get(result_key)

            if result_data:
                # Include result data with the response
                progress_data['result'] = result_data

        return Response(progress_data)


class DOTSView(APIView):
    """
    API view for retrieving the list of available DOTs (Direction Opérationnelle Territoriale)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Get a list of all available DOTs across all models
        """
        try:
            # Fetch all active DOTs from the DOT model
            dots = DOT.objects.filter(is_active=True)

            # Convert to serializable format
            dot_list = [
                {
                    'id': dot.id,
                    'code': dot.code,
                    'name': dot.name
                }
                for dot in dots
            ]

            return Response({
                'status': 'success',
                'dots': dot_list
            })
        except Exception as e:
            logger.error(f"Error retrieving DOTs: {str(e)}")
            return Response({
                'status': 'error',
                'message': str(e)
            }, status=500)
