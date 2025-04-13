from django.urls import path
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()

app_name = 'data_v2'

urlpatterns = [
    # Health check endpoint
    path('health-check/', views.HealthCheckView.as_view(), name='v2-health-check'),

    # Base endpoints (will extend these as we implement each feature)
    path('invoices/', views.InvoiceListView.as_view(), name='invoice-list'),
    # path('invoices/<int:pk>/', views.InvoiceDetailView.as_view(),
    #      name='invoice-detail'),
    path('invoices/upload/', views.InvoiceUploadView.as_view(),
         name='invoice-upload'),

    # Cleaning endpoints - commented out for now
    # path('invoices/<int:pk>/clean/',
    #      views.InvoiceCleanView.as_view(), name='invoice-clean'),
    # path('clean/', views.BulkCleanView.as_view(), name='bulk-clean'),
    # path('cleaning-tasks/', views.CleaningTasksView.as_view(),
    #      name='cleaning-tasks'),
    # path('invoices/<int:pk>/cleaning-status/',
    #      views.InvoiceCleaningStatusView.as_view(), name='invoice-cleaning-status'),

    # Add a path for processing invoices to save raw data
    path('invoices/<int:pk>/process/',
         views.InvoiceProcessView.as_view(), name='invoice-process'),

    # Add a path for bulk processing of multiple invoices
    path('process-bulk/',
         views.BulkProcessView.as_view(), name='bulk-process'),

    # Journal entries - commented out until implemented
    # path('journal-ventes/', views.JournalVentesListView.as_view(),
    #      name='journal-ventes-list'),
    # path('journal-achats/', views.JournalAchatsListView.as_view(),
    #      name='journal-achats-list'),

    # Client and supplier endpoints
    # path('clients/', views.ClientListCreateView.as_view(), name='client-list'),
    # path('clients/<int:pk>/', views.ClientDetailView.as_view(), name='client-detail'),
    # path('suppliers/', views.SupplierListCreateView.as_view(), name='supplier-list'),
    # path('suppliers/<int:pk>/', views.SupplierDetailView.as_view(),
    #      name='supplier-detail'),

    # Data model endpoints with cleaning status awareness
    # path('facturation-manuelle/', views.FacturationManuelleListView.as_view(),
    #      name='v2-facturation-manuelle-list'),
    # path('facturation-manuelle/<int:pk>/', views.FacturationManuelleDetailView.as_view(),
    #      name='v2-facturation-manuelle-detail'),

    # path('etat-facture/', views.EtatFactureListView.as_view(),
    #      name='v2-etat-facture-list'),
    # path('etat-facture/<int:pk>/', views.EtatFactureDetailView.as_view(),
    #      name='v2-etat-facture-detail'),

    # path('parc-corporate/', views.ParcCorporateListView.as_view(),
    #      name='v2-parc-corporate-list'),
    # path('parc-corporate/<int:pk>/', views.ParcCorporateDetailView.as_view(),
    #      name='v2-parc-corporate-detail'),

    # path('creances-ngbss/', views.CreancesNGBSSListView.as_view(),
    #      name='v2-creances-ngbss-list'),
    # path('creances-ngbss/<int:pk>/', views.CreancesNGBSSDetailView.as_view(),
    #      name='v2-creances-ngbss-detail'),

    # path('ca-periodique/', views.CAPeriodiqueListView.as_view(),
    #      name='v2-ca-periodique-list'),
    # path('ca-periodique/<int:pk>/', views.CAPeriodiqueDetailView.as_view(),
    #      name='v2-ca-periodique-detail'),

    # path('ca-non-periodique/', views.CANonPeriodiqueListView.as_view(),
    #      name='v2-ca-non-periodique-list'),
    # path('ca-non-periodique/<int:pk>/', views.CANonPeriodiqueDetailView.as_view(),
    #      name='v2-ca-non-periodique-detail'),

    # path('ca-dnt/', views.CADNTListView.as_view(), name='v2-ca-dnt-list'),
    # path('ca-dnt/<int:pk>/', views.CADNTDetailView.as_view(),
    #      name='v2-ca-dnt-detail'),

    # path('ca-rfd/', views.CARFDListView.as_view(), name='v2-ca-rfd-list'),
    # path('ca-rfd/<int:pk>/', views.CARFDDetailView.as_view(),
    #      name='v2-ca-rfd-detail'),

    # path('ca-cnt/', views.CACNTListView.as_view(), name='v2-ca-cnt-list'),
    # path('ca-cnt/<int:pk>/', views.CACNTDetailView.as_view(),
    #      name='v2-ca-cnt-detail'),

    # Other utility endpoints
    # path('file-types/', views.FileTypeListView.as_view(), name='v2-file-type-list'),
    # path('dots/', views.DOTSView.as_view(), name='v2-dots-list'),

    # Anomalies endpoints with awareness of cleaning status
    # path('anomalies/', views.AnomalyListView.as_view(), name='v2-anomaly-list'),
    # path('anomalies/<int:pk>/', views.AnomalyDetailView.as_view(),
    #      name='v2-anomaly-detail'),
    # path('anomalies/<int:pk>/resolve/',
    #      views.AnomalyResolveView.as_view(), name='v2-anomaly-resolve'),
    # path('anomalies/stats/', views.AnomalyStatsView.as_view(),
    #      name='v2-anomaly-stats'),

    # Dashboard endpoints
    # path('dashboard/overview/', views.DashboardOverviewView.as_view(),
    #      name='v2-dashboard-overview'),
    # path('dashboard/enhanced/', views.DashboardEnhancedView.as_view(),
    #      name='v2-dashboard-enhanced'),
]

urlpatterns += router.urls
