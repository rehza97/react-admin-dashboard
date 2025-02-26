from django.urls import path
from . import views

urlpatterns = [
    # Web interface route
    path('upload-facturation-form/', views.upload_facturation_form, name='upload_facturation_form'),
    
    # API Routes for React frontend
    path('data/upload-facturation/', views.upload_facturation_api, name='upload_facturation_api'),
    path('data/api/facturation/', views.facturation_list, name='facturation-list'),
    path('data/api/facturation/<int:pk>/', views.facturation_detail, name='facturation-detail'),
    path('data/api/facturation/<str:invoice_number>/download/', views.download_facturation, name='download-facturation'),
]