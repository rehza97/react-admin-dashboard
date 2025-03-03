from django.urls import path
from . import views
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import traceback
import logging

logger = logging.getLogger(__name__)

urlpatterns = [
    # File upload and management
    path('upload-facturation/', views.InvoiceUploadView.as_view(),
         name='upload-facturation'),
    path('invoices/', views.InvoiceListView.as_view(), name='invoice-list'),
    path('invoices/<int:pk>/', views.InvoiceDetailView.as_view(),
         name='invoice-detail'),
    path('invoices/<int:pk>/download/',
         views.InvoiceDownloadView.as_view(), name='invoice-download'),

    # File processing
    path('invoices/<int:pk>/inspect/',
         views.InvoiceInspectView.as_view(), name='invoice-inspect'),
    path('invoices/<int:pk>/process/',
         views.InvoiceProcessView.as_view(), name='invoice-process'),
    path('invoices/<int:pk>/save/',
         views.InvoiceSaveView.as_view(), name='invoice-save'),

    # Processed data
    path('processed-data/', views.ProcessedInvoiceDataListView.as_view(),
         name='processed-data-list'),

    # Facturation Manuelle data
    path('facturation-manuelle/', views.FacturationManuelleListView.as_view(),
         name='facturation-manuelle-list'),
    path('facturation-manuelle/<int:pk>/', views.FacturationManuelleDetailView.as_view(),
         name='facturation-manuelle-detail'),

    # Debug endpoints
    path('debug-upload/', views.DebugUploadView.as_view(), name='debug-upload'),
]


class DebugUploadView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        try:
            file = request.FILES.get('file')
            if not file:
                return Response({"error": "No file provided"}, status=400)

            # Log file details
            logger.info(
                f"Debug upload - File name: {file.name}, Size: {file.size}, Content type: {file.content_type}")

            # Don't save the file, just return success
            return Response({"message": "File received successfully", "size": file.size}, status=200)
        except Exception as e:
            logger.error(f"Debug upload error: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({"error": str(e)}, status=500)
