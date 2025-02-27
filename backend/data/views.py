from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse
from django.core.exceptions import ValidationError
from .models import Invoice
from .serializers import InvoiceSerializer
from .forms import InvoiceUploadForm
import logging

logger = logging.getLogger(__name__)

class InvoiceUploadView(generics.CreateAPIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def post(self, request, *args, **kwargs):
        try:
            # Validate file using the form
            form = InvoiceUploadForm(request.POST, request.FILES)
            if not form.is_valid():
                return Response(
                    {"error": form.errors}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create serializer with validated form data
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                serializer.save()
                logger.info(
                    f"File uploaded successfully by {request.user.email}: {serializer.data['invoice_number']}"
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            
            return Response(
                {"error": serializer.errors}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except ValidationError as e:
            logger.error(f"Validation error during upload: {str(e)}")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error during file upload: {str(e)}")
            return Response(
                {"error": "Failed to upload file"}, 
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
            queryset = queryset.filter(upload_date__range=[start_date, end_date])
            
        return queryset.order_by('-upload_date')

class InvoiceDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer
    
    def get_queryset(self):
        return Invoice.objects.filter(uploaded_by=self.request.user)
    
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            # Delete the actual file
            instance.file.delete(save=False)
            self.perform_destroy(instance)
            logger.info(f"File deleted by {request.user.email}: {instance.invoice_number}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return Response(
                {"error": "Failed to delete file"}, 
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
            logger.info(f"File downloaded by {request.user.email}: {invoice.invoice_number}")
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
