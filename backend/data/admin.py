from django.contrib import admin
from .models import Invoice

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'uploaded_by', 'upload_date', 'status')
    list_filter = ('status', 'upload_date')
    search_fields = ('invoice_number', 'uploaded_by__email')
    ordering = ('-upload_date',)
