from django.contrib import admin
from .models import (
    Invoice,
    ProcessedInvoiceData,
    FacturationManuelle,
    JournalVentes,
    EtatFacture,
    ParcCorporate,
    CreancesNGBSS,
    CAPeriodique,
    CANonPeriodique,
    CADNT,
    CARFD,
    CACNT,
    Anomaly,
    ProgressTracker,
    RevenueObjective,
    CollectionObjective,
    NGBSSCollection,
    UnfinishedInvoice,
    DOT
)


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'uploaded_by',
                    'upload_date', 'status', 'file_type')
    list_filter = ('status', 'upload_date', 'file_type')
    search_fields = ('invoice_number', 'uploaded_by__email', 'file_type')
    ordering = ('-upload_date',)


@admin.register(ProcessedInvoiceData)
class ProcessedInvoiceDataAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'month', 'invoice_date', 'department', 'invoice_number', 'fiscal_year',
                    'client', 'amount_pre_tax', 'vat_percentage', 'vat_amount', 'total_amount', 'description', 'period')
    list_filter = ('invoice__status', 'invoice_date', 'fiscal_year')
    search_fields = ('invoice__invoice_number', 'department', 'client')
    ordering = ('invoice__upload_date',)


@admin.register(FacturationManuelle)
class FacturationManuelleAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'month', 'invoice_date', 'department', 'invoice_number', 'fiscal_year',
                    'client', 'amount_pre_tax', 'vat_percentage', 'vat_amount', 'total_amount', 'description', 'period')
    list_filter = ('invoice__status', 'invoice_date', 'fiscal_year')
    search_fields = ('invoice__invoice_number', 'department', 'client')
    ordering = ('invoice__upload_date',)


@admin.register(JournalVentes)
class JournalVentesAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'organization', 'invoice_number',
                    'invoice_type', 'invoice_date', 'client', 'revenue_amount')
    list_filter = ('invoice__status', 'invoice_date', 'organization')
    search_fields = ('invoice__invoice_number',
                     'organization', 'client', 'invoice_number')
    ordering = ('invoice__upload_date',)


@admin.register(EtatFacture)
class EtatFactureAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'organization', 'invoice_number', 'invoice_type',
                    'invoice_date', 'client', 'amount_pre_tax', 'total_amount', 'collection_amount')
    list_filter = ('invoice__status', 'invoice_date', 'organization')
    search_fields = ('invoice__invoice_number',
                     'organization', 'client', 'invoice_number')
    ordering = ('invoice__upload_date',)


@admin.register(ParcCorporate)
class ParcCorporateAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'actel_code', 'telecom_type', 'offer_type',
                    'subscriber_status', 'state', 'customer_full_name')
    list_filter = ('invoice__status', 'telecom_type',
                   'offer_type', 'subscriber_status', 'state')
    search_fields = ('invoice__invoice_number',
                     'actel_code', 'customer_full_name')
    ordering = ('invoice__upload_date',)


@admin.register(CreancesNGBSS)
class CreancesNGBSSAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'dot', 'actel', 'month', 'year',
                    'product', 'invoice_amount', 'open_amount', 'creance_net')
    list_filter = ('invoice__status', 'year', 'month', 'dot', 'product')
    search_fields = ('invoice__invoice_number', 'dot', 'actel')
    ordering = ('invoice__upload_date',)


@admin.register(CAPeriodique)
class CAPeriodiqueAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'dot', 'product', 'amount_pre_tax',
                    'tax_amount', 'total_amount', 'discount')
    list_filter = ('invoice__status', 'dot', 'product')
    search_fields = ('invoice__invoice_number', 'dot', 'product')
    ordering = ('invoice__upload_date',)


@admin.register(CANonPeriodique)
class CANonPeriodiqueAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'dot', 'product', 'amount_pre_tax',
                    'tax_amount', 'total_amount', 'sale_type', 'channel')
    list_filter = ('invoice__status', 'dot', 'product', 'channel')
    search_fields = ('invoice__invoice_number', 'dot', 'product')
    ordering = ('invoice__upload_date',)


@admin.register(CADNT)
class CADNTAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'transaction_id', 'full_name', 'dot',
                    'amount_pre_tax', 'tax_amount', 'total_amount', 'department')
    list_filter = ('invoice__status', 'dot', 'department')
    search_fields = ('invoice__invoice_number', 'transaction_id', 'full_name')
    ordering = ('invoice__upload_date',)


@admin.register(CARFD)
class CARFDAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'transaction_id', 'full_name', 'dot',
                    'amount_pre_tax', 'tax_amount', 'total_amount', 'department')
    list_filter = ('invoice__status', 'dot', 'department')
    search_fields = ('invoice__invoice_number', 'transaction_id', 'full_name')
    ordering = ('invoice__upload_date',)


@admin.register(CACNT)
class CACNTAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'transaction_id', 'full_name', 'dot',
                    'amount_pre_tax', 'tax_amount', 'total_amount', 'department')
    list_filter = ('invoice__status', 'dot', 'department')
    search_fields = ('invoice__invoice_number', 'transaction_id', 'full_name')
    ordering = ('invoice__upload_date',)


@admin.register(Anomaly)
class AnomalyAdmin(admin.ModelAdmin):
    list_display = ['id', 'type', 'description',
                    'status', 'created_at', 'updated_at']
    list_filter = ['status', 'type', 'created_at', 'updated_at']
    search_fields = ['description', 'invoice__invoice_number']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['invoice', 'resolved_by']
    fieldsets = (
        (None, {
            'fields': ('invoice', 'type', 'description', 'data')
        }),
        ('Resolution', {
            'fields': ('status', 'resolved_by', 'resolution_notes')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


@admin.register(DOT)
class DOTAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('code', 'name', 'description')
    ordering = ('code',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('code', 'name', 'description', 'is_active')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
