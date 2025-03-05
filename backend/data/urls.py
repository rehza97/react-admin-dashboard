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
    path('invoices/<int:pk>/summary/',
         views.InvoiceSummaryView.as_view(), name='invoice-summary'),

    # Processed data
    path('processed-data/', views.ProcessedInvoiceDataListView.as_view(),
         name='processed-data-list'),
    path('processed-data/<int:pk>/', views.ProcessedInvoiceDataDetailView.as_view(),
         name='processed-data-detail'),

    # Facturation Manuelle data
    path('facturation-manuelle/', views.FacturationManuelleListView.as_view(),
         name='facturation-manuelle-list'),
    path('facturation-manuelle/<int:pk>/', views.FacturationManuelleDetailView.as_view(),
         name='facturation-manuelle-detail'),

    # Journal Ventes data
    path('journal-ventes/', views.JournalVentesListView.as_view(),
         name='journal-ventes-list'),
    path('journal-ventes/<int:pk>/', views.JournalVentesDetailView.as_view(),
         name='journal-ventes-detail'),

    # Etat Facture data
    path('etat-facture/', views.EtatFactureListView.as_view(),
         name='etat-facture-list'),
    path('etat-facture/<int:pk>/', views.EtatFactureDetailView.as_view(),
         name='etat-facture-detail'),

    # Parc Corporate data
    path('parc-corporate/', views.ParcCorporateListView.as_view(),
         name='parc-corporate-list'),
    path('parc-corporate/<int:pk>/', views.ParcCorporateDetailView.as_view(),
         name='parc-corporate-detail'),

    # Creances NGBSS data
    path('creances-ngbss/', views.CreancesNGBSSListView.as_view(),
         name='creances-ngbss-list'),
    path('creances-ngbss/<int:pk>/', views.CreancesNGBSSDetailView.as_view(),
         name='creances-ngbss-detail'),

    # CA Periodique data
    path('ca-periodique/', views.CAPeriodiqueListView.as_view(),
         name='ca-periodique-list'),
    path('ca-periodique/<int:pk>/', views.CAPeriodiqueDetailView.as_view(),
         name='ca-periodique-detail'),

    # CA Non Periodique data
    path('ca-non-periodique/', views.CANonPeriodiqueListView.as_view(),
         name='ca-non-periodique-list'),
    path('ca-non-periodique/<int:pk>/', views.CANonPeriodiqueDetailView.as_view(),
         name='ca-non-periodique-detail'),

    # CA DNT data
    path('ca-dnt/', views.CADNTListView.as_view(),
         name='ca-dnt-list'),
    path('ca-dnt/<int:pk>/', views.CADNTDetailView.as_view(),
         name='ca-dnt-detail'),

    # CA RFD data
    path('ca-rfd/', views.CARFDListView.as_view(),
         name='ca-rfd-list'),
    path('ca-rfd/<int:pk>/', views.CARFDDetailView.as_view(),
         name='ca-rfd-detail'),

    # CA CNT data
    path('ca-cnt/', views.CACNTListView.as_view(),
         name='ca-cnt-list'),
    path('ca-cnt/<int:pk>/', views.CACNTDetailView.as_view(),
         name='ca-cnt-detail'),

    # Debug endpoints
    path('debug-upload/', views.DebugUploadView.as_view(), name='debug-upload'),

    # File type selection
    path('file-types/', views.FileTypeListView.as_view(), name='file-type-list'),
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
