from django.contrib import admin
from .models import *

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'uploaded_by', 'upload_date', 'status')
    list_filter = ('status', 'upload_date')
    search_fields = ('invoice_number', 'uploaded_by__email')
    ordering = ('-upload_date',)

@admin.register(ProcessedInvoiceData)
class ProcessedInvoiceDataAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'month', 'invoice_date', 'department', 'invoice_number', 'fiscal_year', 'client', 'amount_pre_tax', 'vat_percentage', 'vat_amount', 'total_amount', 'description', 'period')
    list_filter = ('invoice__status',)
    search_fields = ('invoice__invoice_number', 'department', 'client')
    ordering = ('invoice__upload_date',)

@admin.register(FacturationManuelle)
class FacturationManuelleAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'month', 'invoice_date', 'department', 'invoice_number', 'fiscal_year', 'client', 'amount_pre_tax', 'vat_percentage', 'vat_amount', 'total_amount', 'description', 'period')
    list_filter = ('invoice__status',)
    search_fields = ('invoice__invoice_number', 'department', 'client')
    ordering = ('invoice__upload_date',)


