from django.urls import path
from . import views

urlpatterns = [
    # Upload a new invoice file
    path('upload-facturation/',
         views.InvoiceUploadView.as_view(),
         name='upload-invoice'),

    # List all invoices for the current user
    path('api/facturation/',
         views.InvoiceListView.as_view(),
         name='invoice-list'),

    # Retrieve or delete a specific invoice
    path('api/facturation/<int:pk>/',
         views.InvoiceDetailView.as_view(),
         name='invoice-detail'),

    # Download a specific invoice file
    path('api/facturation/<int:pk>/download/',
         views.InvoiceDownloadView.as_view(),
         name='invoice-download'),

    # Updated action URLs
    path('api/facturation/<int:pk>/process/',
         views.InvoiceProcessView.as_view(),
         name='invoice-process'),

    # View processed data for an invoice
    path('api/facturation/<int:invoice_id>/processed-data/',
         views.ProcessedInvoiceDataListView.as_view(),
         name='processed-invoice-data'),

    # Inspect an invoice file
    path('api/facturation/<int:pk>/inspect/',
         views.InvoiceInspectView.as_view(),
         name='invoice-inspect'),

    # Save processed invoice data to database
    path('api/facturation/<int:pk>/save/',
         views.InvoiceSaveView.as_view(),
         name='invoice-save'),
]
