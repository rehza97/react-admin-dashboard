from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from . import kpi_views
from . import export_views
from . import periodic_kpi_views
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
import traceback
import logging
# from . import export_views
from .views import (
    DOTSView,
    AnomalyBulkDeleteView,
    AnomalySourceDeleteView,
    AnomalyTypeDeleteView,
    AnomalyStatisticsView,
    AnomalyKPIView,
    AnomalyTableView,
    AnomalyFiltersView,
    AnomalyDashboardView,
    ModelAnomalyScanView,

)

from decimal import Decimal
logger = logging.getLogger(__name__)

router = DefaultRouter()

urlpatterns = [
    # Health check endpoint
    path('health-check/', views.HealthCheckView.as_view(), name='health-check'),

    # Invoice endpoints
    path('invoices/', views.InvoiceListView.as_view(), name='invoice-list'),
    path('invoices/<int:pk>/', views.InvoiceDetailView.as_view(),
         name='invoice-detail'),
    path('invoices/upload/', views.InvoiceUploadView.as_view(),
         name='invoice-upload'),
    path('invoices/<int:pk>/process/',
         views.InvoiceProcessView.as_view(), name='invoice-process'),
    path('invoices/<int:pk>/save/',
         views.InvoiceSaveView.as_view(), name='invoice-save'),
    path('invoices/<int:pk>/download/',
         views.InvoiceDownloadView.as_view(), name='invoice-download'),
    path('invoices/<int:pk>/inspect/',
         views.InvoiceInspectView.as_view(), name='invoice-inspect'),

    # Processed data endpoints
    path('processed-data/', views.ProcessedInvoiceDataListView.as_view(),
         name='processed-data-list'),
    path('processed-data/<int:pk>/',
         views.ProcessedInvoiceDataDetailView.as_view(), name='processed-data-detail'),

    # Facturation Manuelle endpoints
    path('facturation-manuelle/', views.FacturationManuelleListView.as_view(),
         name='facturation-manuelle-list'),
    path('facturation-manuelle/<int:pk>/',
         views.FacturationManuelleDetailView.as_view(), name='facturation-manuelle-detail'),

    # Journal des Ventes endpoints
    path('journal-ventes/', views.JournalVentesListView.as_view(),
         name='journal-ventes-list'),
    path('journal-ventes/<int:pk>/',
         views.JournalVentesDetailView.as_view(), name='journal-ventes-detail'),

    # Etat de Facture endpoints
    path('etat-facture/', views.EtatFactureListView.as_view(),
         name='etat-facture-list'),
    path('etat-facture/<int:pk>/', views.EtatFactureDetailView.as_view(),
         name='etat-facture-detail'),

    # Parc Corporate endpoints
    path('parc-corporate/', views.ParcCorporateListView.as_view(),
         name='parc-corporate-list'),
    path('parc-corporate/<int:pk>/',
         views.ParcCorporateDetailView.as_view(), name='parc-corporate-detail'),

    # Creances NGBSS endpoints
    path('creances-ngbss/', views.CreancesNGBSSListView.as_view(),
         name='creances-ngbss-list'),
    path('creances-ngbss/<int:pk>/',
         views.CreancesNGBSSDetailView.as_view(), name='creances-ngbss-detail'),

    # CA Periodique endpoints
    path('ca-periodique/', views.CAPeriodiqueListView.as_view(),
         name='ca-periodique-list'),
    path('ca-periodique/<int:pk>/', views.CAPeriodiqueDetailView.as_view(),
         name='ca-periodique-detail'),

    # CA Non Periodique endpoints
    path('ca-non-periodique/', views.CANonPeriodiqueListView.as_view(),
         name='ca-non-periodique-list'),
    path('ca-non-periodique/<int:pk>/',
         views.CANonPeriodiqueDetailView.as_view(), name='ca-non-periodique-detail'),

    # CA DNT endpoints
    path('ca-dnt/', views.CADNTListView.as_view(), name='ca-dnt-list'),
    path('ca-dnt/<int:pk>/', views.CADNTDetailView.as_view(), name='ca-dnt-detail'),

    # CA RFD endpoints
    path('ca-rfd/', views.CARFDListView.as_view(), name='ca-rfd-list'),
    path('ca-rfd/<int:pk>/', views.CARFDDetailView.as_view(), name='ca-rfd-detail'),

    # CA CNT endpoints
    path('ca-cnt/', views.CACNTListView.as_view(), name='ca-cnt-list'),
    path('ca-cnt/<int:pk>/', views.CACNTDetailView.as_view(), name='ca-cnt-detail'),

    # File type endpoints
    path('file-types/', views.FileTypeListView.as_view(), name='file-type-list'),

    # Invoice summary endpoint
    path('invoices/<int:pk>/summary/',
         views.InvoiceSummaryView.as_view(), name='invoice-summary'),

    # Debug upload endpoint
    path('debug/upload/', views.DebugUploadView.as_view(), name='debug-upload'),



    # Preview data endpoint
    path('preview/corporate-park/', views.CorporateParkPreviewView.as_view(),
         name='preview-corporate-park'),

    # Export endpoints with clear naming
    path('export/corporate-park/', export_views.CorporateParkExportView.as_view(),
         name='export-corporate-park'),

    # Add export endpoints for Non-Periodic Revenue
    path('export/ca-non-periodique/', export_views.CANonPeriodiqueExportView.as_view(),
         name='export-ca-non-periodique'),
    path('export/ca-non-periodique/status/', export_views.CANonPeriodiqueExportView.as_view(),
         name='export-ca-non-periodique-status'),

    # Status endpoint
    path('export/corporate-park/status/', export_views.CorporateParkExportView.as_view(),
         name='export-corporate-park-status'),

    # Additional pattern without trailing slash
    path('export/corporate-park', export_views.CorporateParkExportView.as_view(),
         name='export-corporate-park-no-slash'),

    # Anomalies endpoints
    path('anomalies/', views.AnomalyListView.as_view(), name='anomaly-list'),
    path('anomalies/<int:pk>/', views.AnomalyDetailView.as_view(),
         name='anomaly-detail'),
    path('anomalies/<int:pk>/resolve/',
         views.AnomalyResolveView.as_view(), name='anomaly-resolve'),
    path('anomalies/stats/', views.AnomalyStatsView.as_view(), name='anomaly-stats'),
    path('anomalies/types/', views.AnomalyTypesView.as_view(), name='anomaly-types'),
    path('anomalies/scan/', views.TriggerAnomalyScanView.as_view(),
         name='anomaly-scan'),

    # New anomaly scanner endpoints
    path('anomalies/statistics/',
         AnomalyStatisticsView.as_view(), name='anomaly-statistics'),
    path('anomalies/kpis/',
         AnomalyKPIView.as_view(), name='anomaly-kpis'),
    path('anomalies/table/',
         AnomalyTableView.as_view(), name='anomaly-table'),
    path('anomalies/filters/',
         AnomalyFiltersView.as_view(), name='anomaly-filters'),
    path('anomalies/dashboard/',
         AnomalyDashboardView.as_view(), name='anomaly-dashboard'),

    # Specialized scan endpoints for frontend compatibility
    path('anomalies/scan/revenue-outliers/', views.ScanRevenueOutliersView.as_view(),
         name='scan-revenue-outliers'),
    path('anomalies/scan/collection-outliers/', views.ScanCollectionOutliersView.as_view(),
         name='scan-collection-outliers'),
    path('anomalies/scan/temporal-patterns/', views.ScanTemporalPatternsView.as_view(),
         name='scan-temporal-patterns'),
    path('anomalies/scan/zero-values/', views.ScanZeroValuesView.as_view(),
         name='scan-zero-values'),
    path('anomalies/scan/duplicates/', views.ScanDuplicatesView.as_view(),
         name='scan-duplicates'),
    path('anomalies/scan/empty-cells/', views.ScanEmptyCellsView.as_view(),
         name='scan-empty-cells'),
    path('anomalies/scan/dot-validity/', views.ScanDOTValidityView.as_view(),
         name='scan-dot-validity'),

    # NGBSS specialized scan endpoints
    path('anomalies/scan/creances-ngbss-empty-cells/',
         views.ScanCreancesNGBSSEmptyCellsView.as_view(), name='scan-creances-ngbss-empty-cells'),
    path('anomalies/scan/ca-periodique-empty-cells/',
         views.ScanCAPeriodiqueEmptyCellsView.as_view(), name='scan-ca-periodique-empty-cells'),
    path('anomalies/scan/ca-non-periodique-empty-cells/',
         views.ScanCANonPeriodiqueEmptyCellsView.as_view(), name='scan-ca-non-periodique-empty-cells'),
    path('anomalies/scan/ca-cnt-empty-cells/',
         views.ScanCACNTEmptyCellsView.as_view(), name='scan-ca-cnt-empty-cells'),
    path('anomalies/scan/ca-dnt-empty-cells/',
         views.ScanCADNTEmptyCellsView.as_view(), name='scan-ca-dnt-empty-cells'),
    path('anomalies/scan/ca-rfd-empty-cells/',
         views.ScanCARFDEmptyCellsView.as_view(), name='scan-ca-rfd-empty-cells'),

    # Bulk operations endpoints
    path('anomalies/bulk-delete/',
         AnomalyBulkDeleteView.as_view(), name='anomaly-bulk-delete'),
    path('anomalies/delete-by-source/',
         AnomalySourceDeleteView.as_view(), name='anomaly-source-delete'),
    path('anomalies/delete-by-type/',
         AnomalyTypeDeleteView.as_view(), name='anomaly-type-delete'),

    # Data validation endpoints
    path('validation/', views.DataValidationView.as_view(), name='data-validation'),
    path('cleaning/', views.DataValidationView.as_view(), name='data-cleaning'),

    # Progress tracking
    path('progress/', views.ProgressTrackerView.as_view(), name='progress-list'),
    path('progress/<int:invoice_id>/',
         views.ProgressTrackerView.as_view(), name='progress-detail'),

    # Validation progress
    path('validation-progress/', views.ValidationProgressView.as_view(),
         name='validation-progress'),

    # Comprehensive reports
    path('reports/', views.ComprehensiveReportView.as_view(),
         name='comprehensive-reports'),
    # path('reports/export/revenue_collection/',
    #      export_views.RevenueCollectionExportView.as_view(), name='export_revenue_collection'),
    # path('reports/export/corporate_park/',
    #      export_views.CorporateParkExportView.as_view(), name='export_corporate_park'),
    # path('reports/export/receivables/',
    #      export_views.ReceivablesExportView.as_view(), name='export_receivables'),
    #     path('reports/export/<str:report_type>/',
    #          views.ComprehensiveReportExportView.as_view(), name='export_report'),
    #     path('reports/export/', views.ComprehensiveReportExportView.as_view(),
    #          name='export_report_generic'),

    # Dashboard overview
    path('dashboard/overview/', views.DashboardOverviewView.as_view(),
         name='dashboard-overview'),

    # Enhanced dashboard with advanced analytics
    path('dashboard/enhanced/', views.DashboardEnhancedView.as_view(),
         name='dashboard-enhanced'),

    # File upload and processing - Using DebugUploadView instead of non-existent FileUploadView
    path('upload/', views.DebugUploadView.as_view(), name='file-upload'),

    # KPI endpoints - Keep only the ones that exist
    path('kpi/dashboard-summary/', kpi_views.DashboardSummaryView.as_view(),
         name='kpi-dashboard-summary'),
    path('kpi/revenue/', kpi_views.RevenueKPIView.as_view(), name='kpi-revenue'),
    path('kpi/collection/', kpi_views.CollectionKPIView.as_view(),
         name='kpi-collection'),
    path('kpi/receivables/', kpi_views.ReceivablesKPIView.as_view(),
         name='kpi-receivables'),
    path('kpi/corporate-park/', kpi_views.CorporateNGBSSParkKPIView.as_view(),
         name='kpi-corporate-park'),
    path('kpi/corporate-park/years/', kpi_views.CorporateParkYearsView.as_view(),
         name='corporate-park-years'),
    # path('kpi/anomalies/', kpi_views.AnomaliesKPIView.as_view(), name='kpi-anomalies'),
    # path('kpi/top-flop/', kpi_views.TopFlopKPIView.as_view(), name='kpi-top-flop'),
    # path('kpi/objectives/', kpi_views.ObjectivesKPIView.as_view(), name='kpi-objectives'),
    path('kpi/ngbss-collection/', kpi_views.NGBSSCollectionKPIView.as_view(),
         name='kpi-ngbss-collection'),

    # Add endpoint for Periodic Revenue KPI
    path('kpi/ca-periodique/', periodic_kpi_views.PeriodicRevenueKPIView.as_view(),
         name='kpi-ca-periodique'),

    path('kpi/performance-ranking/', kpi_views.PerformanceRankingView.as_view(),
         name='kpi-performance-ranking'),

    # New cleanup routes
    path('data-cleanup/', views.DataCleanupView.as_view(), name='data-cleanup'),
    path('cleanup-progress/<str:task_id>/', views.CleanupProgressView.as_view(),
         name='cleanup-progress'),

    path('dots/', DOTSView.as_view(), name='dots-list'),

    # Model-specific anomaly scanning
    path('anomalies/scan-model/', ModelAnomalyScanView.as_view(),
         name='scan-model-anomalies'),

    path('kpi/receivables/non-periodic/', kpi_views.CANonPeriodiqueKPIView.as_view(),
         name='receivables-non-periodic-kpi'),
    path('kpi/ca-non-periodique/', kpi_views.CANonPeriodiqueKPIView.as_view(),
         name='kpi-ca-non-periodique'),

    # Add endpoint for DCISIT Revenue KPI
    path('kpi/revenue/dcisit/', kpi_views.DCISITRevenueKPIView.as_view(),
         name='kpi-revenue-dcisit'),

    # Add endpoint for Siège Revenue KPI
    path('kpi/revenue/siege/', kpi_views.SiegeRevenueKPIView.as_view(),
         name='kpi-revenue-siege'),
    path('kpi/revenue/dot-corporate/', kpi_views.DOTCorporateRevenueKPIView.as_view(),
         name='kpi-revenue-dot-corporate'),
    path('kpi/collections/dot-corporate/', kpi_views.DOTCorporateCollectionKPIView.as_view(),
         name='kpi-collections-dot-corporate'),
]

urlpatterns += router.urls
