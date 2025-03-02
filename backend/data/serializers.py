from rest_framework import serializers
from .models import Invoice, ProcessedInvoiceData


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
    file_type = serializers.CharField(read_only=True, required=False)
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
                            'has_errors', 'status_display']

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
