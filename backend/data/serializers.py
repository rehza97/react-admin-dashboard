from rest_framework import serializers
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
    CACNT
)


class ProcessedInvoiceDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessedInvoiceData
        fields = [
            'id',
            'invoice',
            'month',
            'invoice_date',
            'department',
            'invoice_number',
            'fiscal_year',
            'client',
            'amount_pre_tax',
            'vat_percentage',
            'vat_amount',
            'total_amount',
            'description',
            'period',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class InvoiceSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    file_type = serializers.CharField(read_only=False, required=False)
    detection_confidence = serializers.FloatField(
        read_only=True, required=False)
    uploaded_by = serializers.ReadOnlyField(source='uploaded_by.email')
    processed_data_count = serializers.SerializerMethodField()
    has_errors = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'file',
            'file_url',
            'file_size',
            'file_type',
            'detection_confidence',
            'uploaded_by',
            'upload_date',
            'status',
            'status_display',
            'processed_date',
            'error_message',
            'processed_data_count',
            'has_errors'
        ]
        read_only_fields = ['upload_date', 'uploaded_by', 'file_url', 'file_size',
                            'processed_date', 'error_message', 'processed_data_count',
                            'has_errors', 'status_display', 'detection_confidence']

    def get_file_url(self, obj):
        if obj.file:
            return self.context['request'].build_absolute_uri(obj.file.url)
        return None

    def get_file_size(self, obj):
        if obj.file:
            return obj.file.size
        return 0

    def get_processed_data_count(self, obj):
        return obj.processed_data.count()

    def get_has_errors(self, obj):
        return bool(obj.error_message)

    def get_status_display(self, obj):
        return dict(Invoice.PROCESSING_STATUS).get(obj.status, obj.status)

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Handle status updates
        instance.status = validated_data.get('status', instance.status)
        return super().update(instance, validated_data)


class InvoiceDetailSerializer(InvoiceSerializer):
    """Extended serializer for detailed invoice view with processed data"""
    processed_data = ProcessedInvoiceDataSerializer(many=True, read_only=True)

    class Meta(InvoiceSerializer.Meta):
        fields = InvoiceSerializer.Meta.fields + ['processed_data']


class FacturationManuelleSerializer(serializers.ModelSerializer):
    """Serializer for Facturation Manuelle AR data"""
    class Meta:
        model = FacturationManuelle
        fields = [
            'id',
            'invoice',
            'month',
            'invoice_date',
            'department',
            'invoice_number',
            'fiscal_year',
            'client',
            'amount_pre_tax',
            'vat_percentage',
            'vat_amount',
            'total_amount',
            'description',
            'period',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class JournalVentesSerializer(serializers.ModelSerializer):
    """Serializer for Journal des Ventes data"""
    class Meta:
        model = JournalVentes
        fields = [
            'id',
            'invoice',
            'organization',
            'origin',
            'invoice_number',
            'invoice_type',
            'invoice_date',
            'client',
            'currency',
            'invoice_object',
            'account_code',
            'gl_date',
            'billing_period',
            'reference',
            'terminated_flag',
            'description',
            'revenue_amount',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class EtatFactureSerializer(serializers.ModelSerializer):
    """Serializer for Etat de Facture et Encaissement data"""
    class Meta:
        model = EtatFacture
        fields = [
            'id',
            'invoice',
            'organization',
            'source',
            'invoice_number',
            'invoice_type',
            'invoice_date',
            'client',
            'invoice_object',
            'period',
            'terminated_flag',
            'amount_pre_tax',
            'tax_amount',
            'total_amount',
            'revenue_amount',
            'collection_amount',
            'payment_date',
            'invoice_credit_amount',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ParcCorporateSerializer(serializers.ModelSerializer):
    """Serializer for Parc Corporate NGBSS data"""
    class Meta:
        model = ParcCorporate
        fields = [
            'id',
            'invoice',
            'actel_code',
            'customer_l1_code',
            'customer_l1_desc',
            'customer_l2_code',
            'customer_l2_desc',
            'customer_l3_code',
            'customer_l3_desc',
            'telecom_type',
            'offer_type',
            'offer_name',
            'subscriber_status',
            'creation_date',
            'state',
            'customer_full_name',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CreancesNGBSSSerializer(serializers.ModelSerializer):
    """Serializer for Créances NGBSS data"""
    class Meta:
        model = CreancesNGBSS
        fields = [
            'id',
            'invoice',
            'dot',
            'actel',
            'month',
            'year',
            'subscriber_status',
            'product',
            'customer_lev1',
            'customer_lev2',
            'customer_lev3',
            'invoice_amount',
            'open_amount',
            'tax_amount',
            'invoice_amount_ht',
            'dispute_amount',
            'dispute_tax_amount',
            'dispute_net_amount',
            'creance_brut',
            'creance_net',
            'creance_ht',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CAPeriodiqueSerializer(serializers.ModelSerializer):
    """Serializer for CA Periodique data"""
    class Meta:
        model = CAPeriodique
        fields = [
            'id',
            'invoice',
            'dot',
            'product',
            'amount_pre_tax',
            'tax_amount',
            'total_amount',
            'discount',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CANonPeriodiqueSerializer(serializers.ModelSerializer):
    """Serializer for CA Non Periodique data"""
    class Meta:
        model = CANonPeriodique
        fields = [
            'id',
            'invoice',
            'dot',
            'product',
            'amount_pre_tax',
            'tax_amount',
            'total_amount',
            'sale_type',
            'channel',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CADNTSerializer(serializers.ModelSerializer):
    """Serializer for CA DNT data"""
    class Meta:
        model = CADNT
        fields = [
            'id',
            'invoice',
            'pri_identity',
            'customer_code',
            'full_name',
            'transaction_id',
            'transaction_type',
            'channel_id',
            'ext_trans_type',
            'total_amount',
            'tax_amount',
            'amount_pre_tax',
            'entry_date',
            'actel',
            'dot',
            'customer_lev1',
            'customer_lev2',
            'customer_lev3',
            'department',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CARFDSerializer(serializers.ModelSerializer):
    """Serializer for CA RFD data"""
    class Meta:
        model = CARFD
        fields = [
            'id',
            'invoice',
            'transaction_id',
            'full_name',
            'actel',
            'dot',
            'total_amount',
            'droit_timbre',
            'tax_amount',
            'amount_pre_tax',
            'entry_date',
            'customer_code',
            'pri_identity',
            'customer_lev1',
            'customer_lev2',
            'customer_lev3',
            'department',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class CACNTSerializer(serializers.ModelSerializer):
    """Serializer for CA CNT data"""
    class Meta:
        model = CACNT
        fields = [
            'id',
            'invoice',
            'invoice_adjusted',
            'pri_identity',
            'customer_code',
            'full_name',
            'transaction_id',
            'transaction_type',
            'channel_id',
            'total_amount',
            'tax_amount',
            'amount_pre_tax',
            'entry_date',
            'actel',
            'dot',
            'customer_lev1',
            'customer_lev2',
            'customer_lev3',
            'department',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
