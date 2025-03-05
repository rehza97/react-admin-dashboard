from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse
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
    CACNT
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
    CACNTSerializer
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

logger = logging.getLogger(__name__)


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

            # Create the invoice directly without using the form or serializer validation
            invoice = Invoice(
                invoice_number=invoice_number,
                file=file,
                uploaded_by=request.user,
                status='pending'
            )

            # If file_type is provided, use it
            if file_type:
                invoice.file_type = file_type
                invoice.detection_confidence = 1.0  # Manual selection has 100% confidence
            else:
                # Try to detect file type automatically
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

    def post(self, request, pk=None):
        """Save processed data to the database"""
        logger.info(f"Saving invoice {pk} to database")

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

            # Check if the invoice is in a valid state for saving
            if invoice.status not in ['preview', 'processed']:
                return Response({
                    "error": f"Invoice is in {invoice.status} state and cannot be saved"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get the file type from the request or use the one from the invoice
            file_type = request.data.get('file_type', invoice.file_type)

            if file_type:
                # Get the file path
                file_path = invoice.file.path
                file_name = os.path.basename(file_path)

                # Use the file processor to get the data
                processor = FileProcessor()

                # Detect file type if not provided
                if not file_type:
                    detector = FileTypeDetector()
                    file_type, _, _ = detector.detect_file_type(
                        file_path, file_name)

                # Process based on file type
                if file_type == "facturation_manuelle":
                    preview_data, _ = processor.process_facturation_manuelle(
                        file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_facturation_manuelle(invoice, preview_data)
                elif file_type == "journal_ventes":
                    preview_data, _ = processor.process_journal_ventes(
                        file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_journal_ventes(invoice, preview_data)
                elif file_type == "etat_facture":
                    preview_data, _ = processor.process_etat_facture(file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_etat_facture(invoice, preview_data)
                elif file_type == "parc_corporate":
                    preview_data, _ = processor.process_parc_corporate(
                        file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_parc_corporate(invoice, preview_data)
                elif file_type == "creances_ngbss":
                    preview_data, _ = processor.process_creances_ngbss(
                        file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_creances_ngbss(invoice, preview_data)
                elif file_type == "ca_periodique":
                    preview_data, _ = processor.process_ca_periodique(
                        file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_ca_periodique(invoice, preview_data)
                elif file_type == "ca_non_periodique":
                    preview_data, _ = processor.process_ca_non_periodique(
                        file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_ca_non_periodique(invoice, preview_data)
                elif file_type == "ca_dnt":
                    preview_data, _ = processor.process_ca_dnt(file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_ca_dnt(invoice, preview_data)
                elif file_type == "ca_rfd":
                    preview_data, _ = processor.process_ca_rfd(file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_ca_rfd(invoice, preview_data)
                elif file_type == "ca_cnt":
                    preview_data, _ = processor.process_ca_cnt(file_path)
                    # Handle NaN values before saving
                    preview_data = handle_nan_values(preview_data)
                    self._save_ca_cnt(invoice, preview_data)
                else:
                    return Response({
                        "error": f"Unsupported file type: {file_type}"
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                # If processed_data is provided as an array, use it directly
                if not isinstance(processed_data, list):
                    return Response(
                        {"error": "Processed data must be an array"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Save the processed data based on file type
                if file_type == "facturation_manuelle":
                    self._save_facturation_manuelle(invoice, processed_data)
                elif file_type == "journal_ventes":
                    self._save_journal_ventes(invoice, processed_data)
                elif file_type == "etat_facture":
                    self._save_etat_facture(invoice, processed_data)
                elif file_type == "parc_corporate":
                    self._save_parc_corporate(invoice, processed_data)
                elif file_type == "creances_ngbss":
                    self._save_creances_ngbss(invoice, processed_data)
                elif file_type == "ca_periodique":
                    self._save_ca_periodique(invoice, processed_data)
                elif file_type == "ca_non_periodique":
                    self._save_ca_non_periodique(invoice, processed_data)
                elif file_type == "ca_dnt":
                    self._save_ca_dnt(invoice, processed_data)
                elif file_type == "ca_rfd":
                    self._save_ca_rfd(invoice, processed_data)
                elif file_type == "ca_cnt":
                    self._save_ca_cnt(invoice, processed_data)
                else:
                    # Default to ProcessedInvoiceData
                    self._save_processed_invoice_data(invoice, processed_data)

            # Update the invoice status
            invoice.status = 'saved'
            invoice.processed_date = timezone.now()
            invoice.save()

            return Response({"status": "success", "message": "Data saved to database"})

        except Exception as e:
            logger.error(f"Error saving invoice {pk} to database: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        for row in data:
            # Convert date fields
            invoice_date = self._parse_date(row.get('invoice_date'))
            gl_date = self._parse_date(row.get('gl_date'))

            # Create the JournalVentes record
            JournalVentes.objects.create(
                invoice=invoice,
                organization=row.get('organization', ''),
                origin=row.get('origin', ''),
                invoice_number=row.get('invoice_number', ''),
                invoice_type=row.get('invoice_type', ''),
                invoice_date=invoice_date,
                client=row.get('client', ''),
                currency=row.get('currency', ''),
                invoice_object=row.get('invoice_object', ''),
                account_code=row.get('account_code', ''),
                gl_date=gl_date,
                billing_period=row.get('billing_period', ''),
                reference=row.get('reference', ''),
                terminated_flag=row.get('terminated_flag', ''),
                description=row.get('description', ''),
                revenue_amount=row.get('revenue_amount')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to JournalVentes")
        return saved_count

    def _save_etat_facture(self, invoice, data):
        """Save data to EtatFacture model"""
        saved_count = 0
        for row in data:
            # Convert date fields
            invoice_date = self._parse_date(row.get('invoice_date'))
            payment_date = self._parse_date(row.get('payment_date'))

            # Create the EtatFacture record
            EtatFacture.objects.create(
                invoice=invoice,
                organization=row.get('organization', ''),
                source=row.get('source', ''),
                invoice_number=row.get('invoice_number', ''),
                invoice_type=row.get('invoice_type', ''),
                invoice_date=invoice_date,
                client=row.get('client', ''),
                invoice_object=row.get('invoice_object', ''),
                period=row.get('period', ''),
                terminated_flag=row.get('terminated_flag', ''),
                amount_pre_tax=row.get('amount_pre_tax'),
                tax_amount=row.get('tax_amount'),
                total_amount=row.get('total_amount'),
                revenue_amount=row.get('revenue_amount'),
                collection_amount=row.get('collection_amount'),
                payment_date=payment_date,
                invoice_credit_amount=row.get('invoice_credit_amount')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to EtatFacture")
        return saved_count

    def _save_parc_corporate(self, invoice, data):
        """Save data to ParcCorporate model"""
        saved_count = 0
        for row in data:
            # Convert date fields
            creation_date = self._parse_datetime(row.get('creation_date'))

            # Create the ParcCorporate record
            ParcCorporate.objects.create(
                invoice=invoice,
                actel_code=row.get('actel_code', ''),
                customer_l1_code=row.get('customer_l1_code', ''),
                customer_l1_desc=row.get('customer_l1_desc', ''),
                customer_l2_code=row.get('customer_l2_code', ''),
                customer_l2_desc=row.get('customer_l2_desc', ''),
                customer_l3_code=row.get('customer_l3_code', ''),
                customer_l3_desc=row.get('customer_l3_desc', ''),
                telecom_type=row.get('telecom_type', ''),
                offer_type=row.get('offer_type', ''),
                offer_name=row.get('offer_name', ''),
                subscriber_status=row.get('subscriber_status', ''),
                creation_date=creation_date,
                state=row.get('state', ''),
                customer_full_name=row.get('customer_full_name', '')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to ParcCorporate")
        return saved_count

    def _save_creances_ngbss(self, invoice, data):
        """Save data to CreancesNGBSS model"""
        saved_count = 0
        for row in data:
            # Create the CreancesNGBSS record
            CreancesNGBSS.objects.create(
                invoice=invoice,
                dot=row.get('dot', ''),
                actel=row.get('actel', ''),
                month=row.get('month', ''),
                year=row.get('year', ''),
                subscriber_status=row.get('subscriber_status', ''),
                product=row.get('product', ''),
                customer_lev1=row.get('customer_lev1', ''),
                customer_lev2=row.get('customer_lev2', ''),
                customer_lev3=row.get('customer_lev3', ''),
                invoice_amount=row.get('invoice_amount'),
                open_amount=row.get('open_amount'),
                tax_amount=row.get('tax_amount'),
                invoice_amount_ht=row.get('invoice_amount_ht'),
                dispute_amount=row.get('dispute_amount'),
                dispute_tax_amount=row.get('dispute_tax_amount'),
                dispute_net_amount=row.get('dispute_net_amount'),
                creance_brut=row.get('creance_brut'),
                creance_net=row.get('creance_net'),
                creance_ht=row.get('creance_ht')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to CreancesNGBSS")
        return saved_count

    def _save_ca_periodique(self, invoice, data):
        """Save data to CAPeriodique model"""
        saved_count = 0
        for row in data:
            # Create the CAPeriodique record
            CAPeriodique.objects.create(
                invoice=invoice,
                dot=row.get('dot', ''),
                product=row.get('product', ''),
                amount_pre_tax=row.get('amount_pre_tax') or row.get('ht'),
                tax_amount=row.get('tax_amount') or row.get('tax'),
                total_amount=row.get('total_amount') or row.get('ttc'),
                discount=row.get('discount')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to CAPeriodique")
        return saved_count

    def _save_ca_non_periodique(self, invoice, data):
        """Save data to CANonPeriodique model"""
        saved_count = 0
        for row in data:
            # Create the CANonPeriodique record
            CANonPeriodique.objects.create(
                invoice=invoice,
                dot=row.get('dot', ''),
                product=row.get('product', ''),
                amount_pre_tax=row.get('amount_pre_tax') or row.get('ht'),
                tax_amount=row.get('tax_amount') or row.get('tax'),
                total_amount=row.get('total_amount') or row.get('ttc'),
                sale_type=row.get('sale_type') or row.get('type_vente'),
                channel=row.get('channel')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to CANonPeriodique")
        return saved_count

    def _save_ca_dnt(self, invoice, data):
        """Save data to CADNT model"""
        saved_count = 0
        for row in data:
            # Convert date fields
            entry_date = self._parse_datetime(row.get('entry_date'))

            # Create the CADNT record
            CADNT.objects.create(
                invoice=invoice,
                pri_identity=row.get('pri_identity', ''),
                customer_code=row.get('customer_code', ''),
                full_name=row.get('full_name', ''),
                transaction_id=row.get('transaction_id', ''),
                transaction_type=row.get('transaction_type', ''),
                channel_id=row.get('channel_id', ''),
                ext_trans_type=row.get('ext_trans_type', ''),
                total_amount=row.get('total_amount') or row.get('ttc'),
                tax_amount=row.get('tax_amount') or row.get('tva'),
                amount_pre_tax=row.get('amount_pre_tax') or row.get('ht'),
                entry_date=entry_date,
                actel=row.get('actel', ''),
                dot=row.get('dot', ''),
                customer_lev1=row.get('customer_lev1', ''),
                customer_lev2=row.get('customer_lev2', ''),
                customer_lev3=row.get('customer_lev3', ''),
                department=row.get('department', '')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to CADNT")
        return saved_count

    def _save_ca_rfd(self, invoice, data):
        """Save data to CARFD model"""
        saved_count = 0
        for row in data:
            # Convert date fields
            entry_date = self._parse_datetime(row.get('entry_date'))

            # Create the CARFD record
            CARFD.objects.create(
                invoice=invoice,
                transaction_id=row.get('transaction_id', ''),
                full_name=row.get('full_name', ''),
                actel=row.get('actel', ''),
                dot=row.get('dot', ''),
                total_amount=row.get('total_amount') or row.get('ttc'),
                droit_timbre=row.get('droit_timbre'),
                tax_amount=row.get('tax_amount') or row.get('tva'),
                amount_pre_tax=row.get('amount_pre_tax') or row.get('ht'),
                entry_date=entry_date,
                customer_code=row.get('customer_code', ''),
                pri_identity=row.get('pri_identity', ''),
                customer_lev1=row.get('customer_lev1', ''),
                customer_lev2=row.get('customer_lev2', ''),
                customer_lev3=row.get('customer_lev3', ''),
                department=row.get('department', '')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to CARFD")
        return saved_count

    def _save_ca_cnt(self, invoice, data):
        """Save data to CACNT model"""
        saved_count = 0
        for row in data:
            # Convert date fields
            entry_date = self._parse_datetime(row.get('entry_date'))

            # Create the CACNT record
            CACNT.objects.create(
                invoice=invoice,
                invoice_adjusted=row.get('invoice_adjusted', ''),
                pri_identity=row.get('pri_identity', ''),
                customer_code=row.get('customer_code', ''),
                full_name=row.get('full_name', ''),
                transaction_id=row.get('transaction_id', ''),
                transaction_type=row.get('transaction_type', ''),
                channel_id=row.get('channel_id', ''),
                total_amount=row.get('total_amount') or row.get('ttc'),
                tax_amount=row.get('tax_amount') or row.get('tva'),
                amount_pre_tax=row.get('amount_pre_tax') or row.get('ht'),
                entry_date=entry_date,
                actel=row.get('actel', ''),
                dot=row.get('dot', ''),
                customer_lev1=row.get('customer_lev1', ''),
                customer_lev2=row.get('customer_lev2', ''),
                customer_lev3=row.get('customer_lev3', ''),
                department=row.get('department', '')
            )
            saved_count += 1

        logger.info(f"Saved {saved_count} records to CACNT")
        return saved_count

    def _parse_date(self, date_value):
        """Parse a date value from various formats"""
        if not date_value:
            return None

        if isinstance(date_value, datetime):
            return date_value.date()

        if isinstance(date_value, str):
            # Try different date formats
            formats = ['%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y',
                       '%d.%m.%Y', '%d %b %Y', '%d %B %Y']
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


class JournalVentesListView(generics.ListAPIView):
    """API view for listing Journal des Ventes data"""
    permission_classes = [IsAuthenticated]
    serializer_class = JournalVentesSerializer

    def get_queryset(self):
        """
        This view should return a list of all journal ventes records
        for the currently authenticated user.
        """
        user = self.request.user

        # Get query parameters
        invoice_id = self.request.query_params.get('invoice_id', None)
        organization = self.request.query_params.get('organization', None)
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)

        # Start with all records for this user
        queryset = JournalVentes.objects.filter(
            invoice__uploaded_by=user)

        # Apply filters if provided
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        if organization:
            queryset = queryset.filter(organization=organization)
        if start_date and end_date:
            queryset = queryset.filter(
                invoice_date__range=[start_date, end_date])
        elif start_date:
            queryset = queryset.filter(invoice_date__gte=start_date)
        elif end_date:
            queryset = queryset.filter(invoice_date__lte=end_date)

        return queryset


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


class EtatFactureListView(generics.ListAPIView):
    """API view for listing Etat de Facture et Encaissement data"""
    permission_classes = [IsAuthenticated]
    serializer_class = EtatFactureSerializer

    def get_queryset(self):
        """
        This view should return a list of all etat facture records
        for the currently authenticated user.
        """
        user = self.request.user

        # Get query parameters
        invoice_id = self.request.query_params.get('invoice_id', None)
        organization = self.request.query_params.get('organization', None)
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)

        # Start with all records for this user
        queryset = EtatFacture.objects.filter(
            invoice__uploaded_by=user)

        # Apply filters if provided
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)
        if organization:
            queryset = queryset.filter(organization=organization)
        if start_date and end_date:
            queryset = queryset.filter(
                invoice_date__range=[start_date, end_date])
        elif start_date:
            queryset = queryset.filter(invoice_date__gte=start_date)
        elif end_date:
            queryset = queryset.filter(invoice_date__lte=end_date)

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
class ParcCorporateListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ParcCorporateSerializer

    def get_queryset(self):
        user = self.request.user
        invoice_id = self.request.query_params.get('invoice_id', None)

        queryset = ParcCorporate.objects.filter(invoice__uploaded_by=user)
        if invoice_id:
            queryset = queryset.filter(invoice_id=invoice_id)

        return queryset


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
                    invoice=invoice).count()
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
