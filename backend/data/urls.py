from django.urls import path
from . import views

urlpatterns = [
    path('upload-facturation/', views.upload_facturation_file, name='upload_facturation_file'),
    path('api/facturation/', views.facturation_list, name='facturation-list'),
    path('api/facturation/<int:pk>/', views.facturation_detail, name='facturation-detail'),
] 