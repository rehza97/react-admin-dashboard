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
    CACNT,
    Anomaly
)
import re


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
    anomalies = serializers.SerializerMethodField()
    empty_fields = serializers.SerializerMethodField()
    is_previous_year_invoice = serializers.SerializerMethodField()
    is_advance_invoice = serializers.SerializerMethodField()
    clean_organization = serializers.SerializerMethodField()
    formatted_revenue_amount = serializers.SerializerMethodField()

    class Meta:
        model = JournalVentes
        fields = [
            'id',
            'invoice',
            'organization',
            'clean_organization',
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
            'formatted_revenue_amount',
            'created_at',
            'updated_at',
            'anomalies',
            'empty_fields',
            'is_previous_year_invoice',
            'is_advance_invoice'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'anomalies',
                            'empty_fields', 'is_previous_year_invoice',
                            'is_advance_invoice', 'clean_organization',
                            'formatted_revenue_amount']

    def get_anomalies(self, obj):
        """Get all anomalies for this record"""
        return obj.get_anomalies()

    def get_empty_fields(self, obj):
        """Get list of empty fields"""
        return obj.check_empty_fields()

    def get_is_previous_year_invoice(self, obj):
        """Check if this is a previous year invoice"""
        return obj.is_previous_year_invoice()

    def get_is_advance_invoice(self, obj):
        """Check if this is an advance invoice"""
        return obj.is_advance_invoice()

    def get_clean_organization(self, obj):
        """Get cleaned organization name"""
        return JournalVentes.clean_organization_name(obj.organization)

    def get_formatted_revenue_amount(self, obj):
        """Get formatted revenue amount without decimal point"""
        if obj.revenue_amount is None:
            return None
        # Format as integer (remove decimal point)
        return int(obj.revenue_amount)

    def validate(self, data):
        """
        Validate the data according to business rules
        """
        # Check organization for AT Siège
        organization = data.get('organization')
        if organization and organization.lower() == 'at siège' and organization not in JournalVentes.VALID_SIEGE_ORGS:
            raise serializers.ValidationError({
                'organization': f"Invalid AT Siège organization. Must be one of: {', '.join(JournalVentes.VALID_SIEGE_ORGS)}"
            })

        # Check account code for previous year invoice
        account_code = data.get('account_code')
        if account_code and account_code.endswith('A'):
            # This is not an error, but we'll note it
            data['is_previous_year'] = True

        # Check GL date for previous year invoice
        gl_date = data.get('gl_date')
        if gl_date and gl_date.year < JournalVentes.CURRENT_YEAR:
            # This is not an error, but we'll note it
            data['is_previous_year'] = True

        # Check invoice date for advance invoice
        invoice_date = data.get('invoice_date')
        if invoice_date and invoice_date.year > JournalVentes.CURRENT_YEAR:
            # This is not an error, but we'll note it
            data['is_advance'] = True

        # Check invoice object for anomaly
        invoice_object = data.get('invoice_object')
        if invoice_object and invoice_object.startswith('@'):
            # This is not an error, but we'll note it
            data['has_anomaly_in_object'] = True

        # Check billing period for anomaly
        billing_period = data.get('billing_period')
        if billing_period:
            years_pattern = r'(\d{4})$'
            match = re.search(years_pattern, billing_period)
            if match:
                year = int(match.group(1))
                if year < JournalVentes.CURRENT_YEAR:
                    # This is not an error, but we'll note it
                    data['has_anomaly_in_period'] = True

        # Check for negative revenue amount
        revenue_amount = data.get('revenue_amount')
        if revenue_amount is not None and revenue_amount < 0:
            raise serializers.ValidationError({
                'revenue_amount': f"Negative revenue amount not allowed: {revenue_amount}"
            })

        return data


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
    anomalies = serializers.SerializerMethodField()
    is_valid_record = serializers.SerializerMethodField()
    empty_fields = serializers.SerializerMethodField()

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
            'updated_at',
            'anomalies',
            'is_valid_record',
            'empty_fields'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'anomalies', 'is_valid_record', 'empty_fields']

    def get_anomalies(self, obj):
        """Get all anomalies for this record"""
        return obj.get_anomalies()

    def get_is_valid_record(self, obj):
        """Check if the record meets all filtering criteria"""
        return obj.is_valid_record()

    def get_empty_fields(self, obj):
        """Get list of empty fields"""
        return obj.check_empty_fields()

    def validate(self, data):
        """
        Validate the data according to business rules
        """
        # Check product
        if data.get('product') and data['product'] not in CreancesNGBSS.VALID_PRODUCTS:
            raise serializers.ValidationError({
                'product': f"Invalid product. Must be one of: {', '.join(CreancesNGBSS.VALID_PRODUCTS)}"
            })

        # Check customer_lev1
        if data.get('customer_lev1') and data['customer_lev1'] not in CreancesNGBSS.VALID_CUSTOMER_LEV1:
            raise serializers.ValidationError({
                'customer_lev1': f"Invalid customer level 1. Must be one of: {', '.join(CreancesNGBSS.VALID_CUSTOMER_LEV1)}"
            })

        # Check customer_lev2
        if data.get('customer_lev2') in CreancesNGBSS.EXCLUDED_CUSTOMER_LEV2:
            raise serializers.ValidationError({
                'customer_lev2': f"Customer level 2 value is excluded: {data['customer_lev2']}"
            })

        # Check customer_lev3
        if data.get('customer_lev3') and data['customer_lev3'] not in CreancesNGBSS.VALID_CUSTOMER_LEV3:
            raise serializers.ValidationError({
                'customer_lev3': f"Invalid customer level 3. Must be one of: {', '.join(CreancesNGBSS.VALID_CUSTOMER_LEV3)}"
            })

        return data


class CAPeriodiqueSerializer(serializers.ModelSerializer):
    """Serializer for CA Periodique data"""
    anomalies = serializers.SerializerMethodField()
    is_valid_record = serializers.SerializerMethodField()
    empty_fields = serializers.SerializerMethodField()

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
            'updated_at',
            'anomalies',
            'is_valid_record',
            'empty_fields'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'anomalies', 'is_valid_record', 'empty_fields']

    def get_anomalies(self, obj):
        """Get all anomalies for this record"""
        return obj.get_anomalies()

    def get_is_valid_record(self, obj):
        """Check if the record meets all filtering criteria"""
        return obj.is_valid_record()

    def get_empty_fields(self, obj):
        """Get list of empty fields"""
        return obj.check_empty_fields()

    def validate(self, data):
        """
        Validate the data according to business rules
        """
        dot = data.get('dot')
        if dot and hasattr(dot, 'name'):
            if dot.name != CAPeriodique.VALID_DOT_SIEGE:
                # For non-Siège DOTs, validate product
                product = data.get('product')
                if product and product not in CAPeriodique.VALID_PRODUCTS_NON_SIEGE:
                    raise serializers.ValidationError({
                        'product': f"Invalid product for non-Siège DOT. Must be one of: {', '.join(CAPeriodique.VALID_PRODUCTS_NON_SIEGE)}"
                    })

        # Check for negative amounts
        amount_fields = ['amount_pre_tax',
                         'tax_amount', 'total_amount', 'discount']
        for field in amount_fields:
            value = data.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({
                    field: f"Negative amount not allowed: {value}"
                })

        return data


class CANonPeriodiqueSerializer(serializers.ModelSerializer):
    """Serializer for CA Non Periodique data"""
    anomalies = serializers.SerializerMethodField()
    is_valid_record = serializers.SerializerMethodField()
    empty_fields = serializers.SerializerMethodField()

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
            'updated_at',
            'anomalies',
            'is_valid_record',
            'empty_fields'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'anomalies', 'is_valid_record', 'empty_fields']

    def get_anomalies(self, obj):
        """Get all anomalies for this record"""
        return obj.get_anomalies()

    def get_is_valid_record(self, obj):
        """Check if the record meets all filtering criteria"""
        return obj.is_valid_record()

    def get_empty_fields(self, obj):
        """Get list of empty fields"""
        return obj.check_empty_fields()

    def validate(self, data):
        """
        Validate the data according to business rules
        """
        # Check DOT
        dot = data.get('dot')
        if dot and hasattr(dot, 'name') and dot.name != CANonPeriodique.VALID_DOT:
            raise serializers.ValidationError({
                'dot': f"Invalid DOT. Must be: {CANonPeriodique.VALID_DOT}"
            })

        # Check for required numeric fields
        amount_fields = ['amount_pre_tax', 'tax_amount', 'total_amount']
        for field in amount_fields:
            value = data.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({
                    field: f"Negative amount not allowed: {value}"
                })

        return data


class CABaseSerializer(serializers.ModelSerializer):
    """Base serializer for CA CNT, DNT, and RFD data"""
    anomalies = serializers.SerializerMethodField()
    is_valid_record = serializers.SerializerMethodField()
    empty_fields = serializers.SerializerMethodField()

    def get_anomalies(self, obj):
        """Get all anomalies for this record"""
        return obj.get_anomalies()

    def get_is_valid_record(self, obj):
        """Check if the record meets all filtering criteria"""
        return obj.is_valid_record()

    def get_empty_fields(self, obj):
        """Get list of empty fields"""
        return obj.check_empty_fields()

    def validate(self, data):
        """
        Validate the data according to business rules
        """
        # Check DOT
        dot = data.get('dot')
        if dot and hasattr(dot, 'name') and dot.name != self.Meta.model.VALID_DOT:
            raise serializers.ValidationError({
                'dot': f"Invalid DOT. Must be: {self.Meta.model.VALID_DOT}"
            })

        # Check Department
        department = data.get('department')
        if department and department != self.Meta.model.VALID_DEPARTMENT:
            raise serializers.ValidationError({
                'department': f"Invalid department. Must be: {self.Meta.model.VALID_DEPARTMENT}"
            })

        # Check for negative amounts
        amount_fields = ['amount_pre_tax', 'tax_amount', 'total_amount']
        for field in amount_fields:
            value = data.get(field)
            if value is not None and value < 0:
                raise serializers.ValidationError({
                    field: f"Negative amount not allowed: {value}"
                })

        return data


class CADNTSerializer(CABaseSerializer):
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
            'updated_at',
            'anomalies',
            'is_valid_record',
            'empty_fields'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'anomalies', 'is_valid_record', 'empty_fields']


class CARFDSerializer(CABaseSerializer):
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
            'updated_at',
            'anomalies',
            'is_valid_record',
            'empty_fields'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'anomalies', 'is_valid_record', 'empty_fields']


class CACNTSerializer(CABaseSerializer):
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
            'updated_at',
            'anomalies',
            'is_valid_record',
            'empty_fields'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at',
                            'anomalies', 'is_valid_record', 'empty_fields']


class AnomalySerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(
        source='invoice.invoice_number', read_only=True)
    type_display = serializers.CharField(
        source='get_type_display', read_only=True)
    status_display = serializers.CharField(
        source='get_status_display', read_only=True)
    resolved_by_email = serializers.EmailField(
        source='resolved_by.email', read_only=True)
    data_source_display = serializers.CharField(
        source='get_data_source_display', read_only=True)

    class Meta:
        model = Anomaly
        fields = [
            'id',
            'invoice',
            'invoice_number',
            'type',
            'type_display',
            'description',
            'data',
            'status',
            'status_display',
            'created_at',
            'updated_at',
            'resolved_by',
            'resolved_by_email',
            'resolution_notes',
            'data_source',
            'data_source_display'
        ]
        read_only_fields = ['id', 'invoice', 'type',
                            'description', 'data', 'created_at', 'updated_at']
