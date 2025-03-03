from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse
from django.core.exceptions import ValidationError
from .models import Invoice, ProcessedInvoiceData, FacturationManuelle
from .serializers import InvoiceSerializer, ProcessedInvoiceDataSerializer, FacturationManuelleSerializer
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
from .file_processor import FileTypeDetector, FileProcessor, handle_nan_values
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
            invoice.save()

            # Return a simple success response
            return Response({
                "id": invoice.id,
                "invoice_number": invoice.invoice_number,
                "file_name": file.name,
                "status": invoice.status
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

            # Use the file processor
            processor = FileProcessor()

            if processing_mode == 'automatic':
                # Let the processor automatically detect and process
                preview_data, summary_data = processor.process_file(
                    file_path, file_name)
            else:
                # Use the specified treatment
                # Map treatment to processing method
                treatment_map = {
                    'standard_ca_periodique': 'process_ca_periodique',
                    'detailed_ca_periodique': 'process_ca_periodique',
                    'standard_ca_non_periodique': 'process_ca_non_periodique',
                    'standard_ca_dnt': 'process_ca_dnt',
                    'standard_ca_rfd': 'process_ca_rfd',
                    'standard_ca_cnt': 'process_ca_cnt',
                    'standard_facturation_manuelle': 'process_facturation_manuelle',
                    'standard_parc_corporate': 'process_parc_corporate',
                    'standard_creances_ngbss': 'process_creances_ngbss',
                    'standard_etat_facture': 'process_etat_facture',
                    # Add mappings for other treatments
                }

                algorithm = treatment_map.get(treatment, 'process_generic')
                processing_method = getattr(
                    processor, algorithm, processor.process_generic)
                preview_data, summary_data = processing_method(file_path)

            # Update the invoice with processing results
            invoice.status = 'preview'
            invoice.save()

            # Prepare the response data
            response_data = {
                "preview_data": preview_data,
                "summary_data": summary_data,
                "file_name": file_name,
                "invoice_id": invoice.id,
                "status": invoice.status
            }

            return Response(response_data)

        except Exception as e:
            logger.error(f"Error processing file: {str(e)}")
            logger.error(traceback.format_exc())

            # Update invoice status to failed if it exists
            if 'invoice' in locals():
                invoice.status = 'failed'
                invoice.error_message = str(e)
                invoice.save()

            return Response({
                "error": f"Error processing file: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
        invoice_id = self.kwargs.get('invoice_id')
        # Ensure the user can only access their own data
        return ProcessedInvoiceData.objects.filter(
            invoice_id=invoice_id,
            invoice__uploaded_by=self.request.user
        )


class InvoiceSaveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        """Save processed data to the database"""
        logger.info(f"Saving invoice {pk} to database")

        try:
            # Get the invoice
            invoice = get_object_or_404(Invoice, pk=pk)

            # Check if the user has permission to access this invoice
            if invoice.uploaded_by != request.user and not request.user.is_staff:
                return Response(
                    {"error": "You do not have permission to access this invoice"},
                    status=status.HTTP_403_FORBIDDEN
                )

            # Get the processed data from the request
            processed_data = request.data.get('processed_data')
            file_type = request.data.get('file_type', '')

            # For backward compatibility, if processed_data is True or not provided,
            # we'll use the data from the preview
            if processed_data is True or processed_data is None:
                # The file has been processed, but we need to get the data from the preview
                # This is a simplified approach - in a real app, you might store the preview data
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
                if file_type == 'facturation_manuelle':
                    preview_data, _ = processor.process_facturation_manuelle(
                        file_path)

                    # Save each row as a FacturationManuelle record
                    for row in preview_data:
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
                else:
                    # For other file types, save to ProcessedInvoiceData
                    preview_data, _ = processor.process_file(
                        file_path, file_name)

                    # Save each row as a ProcessedInvoiceData record
                    for row in preview_data:
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
            else:
                # If processed_data is provided as an array, use it directly
                if not isinstance(processed_data, list):
                    return Response(
                        {"error": "Processed data must be an array"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Save the processed data
                for row in processed_data:
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

            # Update the invoice status
            invoice.status = 'saved'
            invoice.save()

            return Response({"status": "success", "message": "Data saved to database"})

        except Exception as e:
            logger.error(f"Error saving invoice {pk} to database: {str(e)}")
            logger.error(traceback.format_exc())
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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
            preview_data, summary_data = processor.process_file(
                file_path, file_name)

            # Prepare the response data
            response_data = {
                "preview_data": preview_data,
                "summary_data": summary_data,
                "file_name": file_name
            }

            # Return the inspection result
            return Response(response_data)

        except Exception as e:
            logger.error(f"Error inspecting file: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                "error": f"Error inspecting file: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
