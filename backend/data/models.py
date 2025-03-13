from django.db import models
from users.models import CustomUser
import pandas as pd
from django.utils import timezone
from django.db.models import Q
import re
from datetime import datetime


class DOT(models.Model):
    """Model for storing DOT (Direction Opérationnelle Territoriale) information"""
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['code']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Invoice(models.Model):
    PROCESSING_STATUS = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('preview', 'Preview'),
        ('saved', 'Saved to Database'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ]

    invoice_number = models.CharField(max_length=100, unique=True)
    file = models.FileField(upload_to='invoices/')
    uploaded_by = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    upload_date = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20, choices=PROCESSING_STATUS, default='pending')
    processed_date = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)
    file_type = models.CharField(max_length=50, null=True, blank=True)
    detection_confidence = models.FloatField(null=True, blank=True)
    # anomalies = models.TextField(
    #     null=True, blank=True)  # Store anomalies as JSON

    class Meta:
        ordering = ['-upload_date']
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['status']),
            models.Index(fields=['upload_date']),
            models.Index(fields=['file_type']),
        ]

    def __str__(self):
        return f"{self.invoice_number} ({self.status})"


class ProcessedInvoiceData(models.Model):
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='processed_data')

    # Invoice fields
    month = models.CharField(max_length=20, blank=True, null=True)  # Mois
    invoice_date = models.DateField(null=True, blank=True)  # Date de Facture
    department = models.CharField(
        max_length=100, blank=True, null=True)  # Dépts
    invoice_number = models.CharField(max_length=100)  # N° Factures
    fiscal_year = models.CharField(
        max_length=10, blank=True, null=True)  # Exercices
    client = models.CharField(max_length=255, blank=True, null=True)  # Client
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant HT
    vat_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True)  # % TVA
    vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant TVA
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant TTC
    description = models.TextField(blank=True, null=True)  # Désignations
    period = models.CharField(max_length=100, blank=True, null=True)  # Période

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['client']),
            models.Index(fields=['invoice_date']),
        ]

    def __str__(self):
        return f"{self.invoice_number} - {self.client}"


class FacturationManuelle(models.Model):
    """Model for storing Facturation Manuelle AR data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='facturation_manuelle_data')

    # Specific fields for Facturation Manuelle
    month = models.CharField(max_length=20, blank=True, null=True)  # Mois
    invoice_date = models.DateField(null=True, blank=True)  # Date de Facture
    department = models.CharField(
        max_length=20, blank=True, null=True)  # Dépts
    invoice_number = models.CharField(max_length=100)  # N° Facture
    fiscal_year = models.CharField(
        max_length=10, blank=True, null=True)  # Exercices
    client = models.CharField(max_length=255, blank=True, null=True)  # Client
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant HT
    vat_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True)  # % TVA
    vat_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant TVA
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant TTC
    description = models.TextField(blank=True, null=True)  # Désignations
    period = models.CharField(max_length=100, blank=True, null=True)  # Période

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['fiscal_year']),
            models.Index(fields=['department']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['invoice_date']),
            # models.Index(fields=['organization']),
        ]

    def __str__(self):
        return f"Facturation {self.invoice_number} - {self.client}"


class JournalVentes(models.Model):
    """Model for storing Journal des Ventes (Sales Journal) data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='journal_ventes_data')

    # Specific fields for Journal des Ventes
    organization = models.CharField(
        max_length=100, blank=True, null=True)  # Org Name
    origin = models.CharField(max_length=50, blank=True, null=True)  # Origine
    invoice_number = models.CharField(max_length=100)  # N Fact
    invoice_type = models.CharField(
        max_length=20, blank=True, null=True)  # Typ Fact
    invoice_date = models.DateField(null=True, blank=True)  # Date Fact
    client = models.CharField(max_length=255, blank=True, null=True)  # Client
    currency = models.CharField(max_length=10, blank=True, null=True)  # Devise
    invoice_object = models.TextField(blank=True, null=True)  # Obj Fact
    account_code = models.CharField(
        max_length=20, blank=True, null=True)  # Cpt Comptable
    gl_date = models.DateField(null=True, blank=True)  # Date GL
    billing_period = models.CharField(
        max_length=100, blank=True, null=True)  # Periode de facturation
    reference = models.CharField(
        max_length=255, blank=True, null=True)  # Reference
    terminated_flag = models.CharField(
        max_length=5, blank=True, null=True)  # Termine Flag
    # Description (ligne de produit)
    description = models.TextField(blank=True, null=True)
    revenue_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Chiffre Aff Exe Dzd

    # Constants for filtering
    VALID_SIEGE_ORGS = ['DCC', 'DCGC']
    CURRENT_YEAR = datetime.now().year

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['organization']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['invoice_date']),
            models.Index(fields=['account_code']),
            models.Index(fields=['gl_date']),
        ]

    def __str__(self):
        return f"Journal Ventes {self.organization} - {self.invoice_number}"

    @classmethod
    def clean_organization_name(cls, org_name):
        """
        Clean organization name by removing DOT_, _, and -
        """
        if not org_name:
            return org_name

        # Remove DOT_, _, and -
        cleaned_name = org_name.replace(
            'DOT_', '').replace('_', '').replace('-', '')
        return cleaned_name

    @classmethod
    def get_filtered_queryset(cls, queryset=None):
        """
        Apply standard filtering rules to the queryset
        For AT Siège: keep only DCC and DCGC
        """
        if queryset is None:
            queryset = cls.objects.all()

        # Filter AT Siège to keep only DCC and DCGC
        return queryset.exclude(
            Q(organization__iexact='AT Siège') & ~Q(
                organization__in=cls.VALID_SIEGE_ORGS)
        )

    def check_empty_fields(self):
        """
        Check for empty fields and return a list of empty field names
        """
        empty_fields = []
        fields_to_check = [
            'organization', 'invoice_number', 'invoice_type', 'invoice_date',
            'client', 'invoice_object', 'account_code', 'gl_date',
            'billing_period', 'revenue_amount'
        ]

        for field in fields_to_check:
            value = getattr(self, field)
            if value is None or (isinstance(value, str) and not value.strip()):
                empty_fields.append(field)

        return empty_fields

    def is_previous_year_invoice(self):
        """
        Check if this is a previous year invoice based on account code or GL date
        """
        # Check account code ending with A
        if self.account_code and self.account_code.endswith('A'):
            return True

        # Check GL date from previous years
        if self.gl_date and self.gl_date.year < self.CURRENT_YEAR:
            return True

        return False

    def is_advance_invoice(self):
        """
        Check if this is an advance invoice based on invoice date
        """
        if self.invoice_date and self.invoice_date.year > self.CURRENT_YEAR:
            return True

        return False

    def has_anomaly_in_invoice_object(self):
        """
        Check if invoice object starts with @ (indicating previous year invoice)
        """
        return self.invoice_object and self.invoice_object.startswith('@')

    def has_anomaly_in_billing_period(self):
        """
        Check if billing period ends with a previous year
        """
        if not self.billing_period:
            return False

        # Check if billing period ends with a year that is not the current year
        years_pattern = r'(\d{4})$'
        match = re.search(years_pattern, self.billing_period)
        if match:
            year = int(match.group(1))
            return year < self.CURRENT_YEAR

        return False

    def get_anomalies(self):
        """
        Get a list of anomalies in the record
        """
        anomalies = []

        # Check for empty fields
        empty_fields = self.check_empty_fields()
        if empty_fields:
            anomalies.append({
                'type': 'empty_fields',
                'fields': empty_fields,
                'description': f"Empty values in fields: {', '.join(empty_fields)}"
            })

        # Check for AT Siège organization not in valid list
        if self.organization and self.organization.lower() == 'at siège' and self.organization not in self.VALID_SIEGE_ORGS:
            anomalies.append({
                'type': 'invalid_siege_organization',
                'value': self.organization,
                'description': f"Invalid AT Siège organization. Must be one of: {', '.join(self.VALID_SIEGE_ORGS)}"
            })

        # Check for previous year invoice
        if self.is_previous_year_invoice():
            anomalies.append({
                'type': 'previous_year_invoice',
                'account_code': self.account_code,
                'gl_date': self.gl_date,
                'description': "Invoice from previous year detected based on account code or GL date"
            })

        # Check for advance invoice
        if self.is_advance_invoice():
            anomalies.append({
                'type': 'advance_invoice',
                'invoice_date': self.invoice_date,
                'description': "Advance invoice detected based on invoice date"
            })

        # Check for anomaly in invoice object
        if self.has_anomaly_in_invoice_object():
            anomalies.append({
                'type': 'anomaly_invoice_object',
                'invoice_object': self.invoice_object,
                'description': "Invoice object starts with @ (indicating previous year invoice)"
            })

        # Check for anomaly in billing period
        if self.has_anomaly_in_billing_period():
            anomalies.append({
                'type': 'anomaly_billing_period',
                'billing_period': self.billing_period,
                'description': "Billing period ends with a previous year"
            })

        # Check for negative revenue amount
        if self.revenue_amount is not None and self.revenue_amount < 0:
            anomalies.append({
                'type': 'negative_revenue',
                'value': self.revenue_amount,
                'description': f"Negative revenue amount: {self.revenue_amount}"
            })

        return anomalies


class EtatFacture(models.Model):
    """Model for storing Etat de Facture et Encaissement data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='etat_facture_data')

    # Specific fields for Etat de Facture
    organization = models.CharField(
        max_length=100, blank=True, null=True)  # Organisation
    source = models.CharField(max_length=50, blank=True, null=True)  # Source
    invoice_number = models.CharField(max_length=100)  # N Fact
    invoice_type = models.CharField(
        max_length=20, blank=True, null=True)  # Typ Fact
    invoice_date = models.DateField(null=True, blank=True)  # Date Fact
    client = models.CharField(max_length=255, blank=True, null=True)  # Client
    invoice_object = models.TextField(blank=True, null=True)  # Obj Fact
    period = models.CharField(max_length=100, blank=True, null=True)  # Periode
    terminated_flag = models.CharField(
        max_length=5, blank=True, null=True)  # Termine Flag
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant Ht
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant Taxe
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Montant Ttc
    revenue_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Chiffre Aff Exe
    collection_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Encaissement
    payment_date = models.DateField(null=True, blank=True)  # Date Rglt
    invoice_credit_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Facture Avoir / Annulation

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['organization']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['payment_date']),
        ]

    def __str__(self):
        return f"Etat Facture {self.invoice_number} - {self.client}"


class ParcCorporate(models.Model):
    """Model for storing Parc Corporate NGBSS data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='parc_corporate_data')

    # Specific fields for Parc Corporate
    actel_code = models.CharField(
        max_length=100, blank=True, null=True)  # ACTEL_CODE
    customer_l1_code = models.CharField(
        max_length=20, blank=True, null=True)  # CODE_CUSTOMER_L1
    customer_l1_desc = models.CharField(
        max_length=100, blank=True, null=True)  # DESCRIPTION_CUSTOMER_L1
    customer_l2_code = models.CharField(
        max_length=20, blank=True, null=True)  # CODE_CUSTOMER_L2
    customer_l2_desc = models.CharField(
        max_length=100, blank=True, null=True)  # DESCRIPTION_CUSTOMER_L2
    customer_l3_code = models.CharField(
        max_length=20, blank=True, null=True)  # CODE_CUSTOMER_L3
    customer_l3_desc = models.CharField(
        max_length=100, blank=True, null=True)  # DESCRIPTION_CUSTOMER_L3
    telecom_type = models.CharField(
        max_length=50, blank=True, null=True)  # TELECOM_TYPE
    offer_type = models.CharField(
        max_length=50, blank=True, null=True)  # OFFER_TYPE
    offer_name = models.CharField(
        max_length=100, blank=True, null=True)  # OFFER_NAME
    subscriber_status = models.CharField(
        max_length=50, blank=True, null=True)  # SUBSCRIBER_STATUS
    creation_date = models.DateTimeField(
        null=True, blank=True)  # CREATION_DATE
    state = models.CharField(max_length=50, blank=True, null=True)  # STATE
    customer_full_name = models.CharField(
        max_length=255, blank=True, null=True)  # CUSTOMER_FULL_NAME

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-creation_date']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['telecom_type']),
            models.Index(fields=['offer_type']),
            models.Index(fields=['state']),
            models.Index(fields=['subscriber_status']),
        ]

    def __str__(self):
        return f"Parc Corporate {self.customer_full_name} - {self.telecom_type}"


class CreancesNGBSS(models.Model):
    """Model for storing Créances NGBSS data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='creances_ngbss_data')

    # Specific fields for Créances NGBSS
    dot = models.ForeignKey(
        DOT,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='creances_ngbss_data',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=50, blank=True, null=True)
    actel = models.CharField(max_length=100, blank=True, null=True)  # ACTEL
    month = models.CharField(max_length=10, blank=True, null=True)  # MOIS
    year = models.CharField(max_length=10, blank=True, null=True)  # ANNEE
    subscriber_status = models.CharField(
        max_length=50, blank=True, null=True)  # SUBS_STATUS
    product = models.CharField(max_length=50, blank=True, null=True)  # PRODUIT
    customer_lev1 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV1
    customer_lev2 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV2
    customer_lev3 = models.CharField(
        max_length=100, blank=True, null=True)  # CUST_LEV3
    invoice_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # INVOICE_AMT
    open_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # OPEN_AMT
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TAX_AMT
    invoice_amount_ht = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # INVOICE_AMT_HT
    dispute_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # DISPUTE_AMT
    dispute_tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # DISPUTE_TAX_AMT
    dispute_net_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # DISPUTE_NET_AMT
    creance_brut = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # CREANCE_BRUT
    creance_net = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # CREANCE_NET
    creance_ht = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # CREANCE_HT

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Constants for filtering
    VALID_PRODUCTS = ['Specialized Line', 'LTE']
    VALID_CUSTOMER_LEV1 = ['Corporate', 'Corporate Group']
    EXCLUDED_CUSTOMER_LEV2 = ['Client professionnelConventionné']
    VALID_CUSTOMER_LEV3 = [
        "Ligne d'exploitation AP",
        "Ligne d'exploitation ATMobilis",
        "Ligne d'exploitation ATS"
    ]

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['dot']),
            models.Index(fields=['product']),
            models.Index(fields=['year']),
            models.Index(fields=['customer_lev1']),
        ]

    def __str__(self):
        return f"Créances NGBSS {self.dot} - {self.product}"

    @classmethod
    def get_filtered_queryset(cls, queryset=None):
        """
        Apply standard filtering rules to the queryset
        """
        if queryset is None:
            queryset = cls.objects.all()

        return queryset.filter(
            product__in=cls.VALID_PRODUCTS,
            customer_lev1__in=cls.VALID_CUSTOMER_LEV1,
            customer_lev3__in=cls.VALID_CUSTOMER_LEV3
        ).exclude(
            customer_lev2__in=cls.EXCLUDED_CUSTOMER_LEV2
        )

    def check_empty_fields(self):
        """
        Check for empty fields and return a list of empty field names
        """
        empty_fields = []
        fields_to_check = [
            'dot', 'actel', 'month', 'year', 'product',
            'customer_lev1', 'customer_lev2', 'customer_lev3'
        ]

        for field in fields_to_check:
            value = getattr(self, field)
            if value is None or (isinstance(value, str) and not value.strip()):
                empty_fields.append(field)

        return empty_fields

    def is_valid_record(self):
        """
        Check if the record meets all filtering criteria
        """
        if self.product not in self.VALID_PRODUCTS:
            return False
        if self.customer_lev1 not in self.VALID_CUSTOMER_LEV1:
            return False
        if self.customer_lev2 in self.EXCLUDED_CUSTOMER_LEV2:
            return False
        if self.customer_lev3 not in self.VALID_CUSTOMER_LEV3:
            return False
        return True

    def get_anomalies(self):
        """
        Get a list of anomalies in the record
        """
        anomalies = []

        # Check for empty fields
        empty_fields = self.check_empty_fields()
        if empty_fields:
            anomalies.append({
                'type': 'empty_fields',
                'fields': empty_fields,
                'description': f"Empty values in fields: {', '.join(empty_fields)}"
            })

        # Check for invalid product
        if self.product and self.product not in self.VALID_PRODUCTS:
            anomalies.append({
                'type': 'invalid_product',
                'value': self.product,
                'description': f"Invalid product: {self.product}. Must be one of: {', '.join(self.VALID_PRODUCTS)}"
            })

        # Check for invalid customer level 1
        if self.customer_lev1 and self.customer_lev1 not in self.VALID_CUSTOMER_LEV1:
            anomalies.append({
                'type': 'invalid_customer_lev1',
                'value': self.customer_lev1,
                'description': f"Invalid customer level 1: {self.customer_lev1}. Must be one of: {', '.join(self.VALID_CUSTOMER_LEV1)}"
            })

        # Check for excluded customer level 2
        if self.customer_lev2 in self.EXCLUDED_CUSTOMER_LEV2:
            anomalies.append({
                'type': 'excluded_customer_lev2',
                'value': self.customer_lev2,
                'description': f"Excluded customer level 2: {self.customer_lev2}"
            })

        # Check for invalid customer level 3
        if self.customer_lev3 and self.customer_lev3 not in self.VALID_CUSTOMER_LEV3:
            anomalies.append({
                'type': 'invalid_customer_lev3',
                'value': self.customer_lev3,
                'description': f"Invalid customer level 3: {self.customer_lev3}. Must be one of: {', '.join(self.VALID_CUSTOMER_LEV3)}"
            })

        # Check for negative amounts
        amount_fields = [
            ('invoice_amount', self.invoice_amount),
            ('open_amount', self.open_amount),
            ('tax_amount', self.tax_amount),
            ('invoice_amount_ht', self.invoice_amount_ht),
            ('creance_brut', self.creance_brut),
            ('creance_net', self.creance_net),
            ('creance_ht', self.creance_ht)
        ]

        for field_name, value in amount_fields:
            if value is not None and value < 0:
                anomalies.append({
                    'type': 'negative_amount',
                    'field': field_name,
                    'value': value,
                    'description': f"Negative amount in {field_name}: {value}"
                })

        return anomalies


class CAPeriodique(models.Model):
    """Model for storing CA Periodique data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='ca_periodique_data')

    # Specific fields for CA Periodique
    dot = models.ForeignKey(
        DOT,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ca_periodique_data',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=50, blank=True, null=True)
    product = models.CharField(max_length=50, blank=True, null=True)  # PRODUIT
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # HT
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TAX
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TTC
    discount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # DISCOUNT

    # Constants for filtering
    VALID_DOT_SIEGE = "Siège"
    VALID_PRODUCTS_NON_SIEGE = ['Specialized Line', 'LTE']

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['dot']),
            models.Index(fields=['product']),
        ]

    def __str__(self):
        return f"CA Periodique {self.dot} - {self.product}"

    @classmethod
    def get_filtered_queryset(cls, queryset=None):
        """
        Apply standard filtering rules to the queryset
        For Siège: keep all products
        For other DOTs: keep only Specialized Line and LTE
        """
        if queryset is None:
            queryset = cls.objects.all()

        return queryset.filter(
            Q(dot__name=cls.VALID_DOT_SIEGE) |  # All products for Siège
            # Only specific products for other DOTs
            (Q(dot__name != cls.VALID_DOT_SIEGE) & Q(
                product__in=cls.VALID_PRODUCTS_NON_SIEGE))
        )

    def check_empty_fields(self):
        """
        Check for empty fields and return a list of empty field names
        """
        empty_fields = []
        fields_to_check = [
            'dot', 'product', 'amount_pre_tax', 'tax_amount',
            'total_amount', 'discount'
        ]

        for field in fields_to_check:
            value = getattr(self, field)
            if value is None or (isinstance(value, str) and not value.strip()):
                empty_fields.append(field)

        return empty_fields

    def is_valid_record(self):
        """
        Check if the record meets all filtering criteria
        """
        if hasattr(self.dot, 'name'):
            if self.dot.name == self.VALID_DOT_SIEGE:
                return True  # All products allowed for Siège
            return self.product in self.VALID_PRODUCTS_NON_SIEGE
        return False

    def get_anomalies(self):
        """
        Get a list of anomalies in the record
        """
        anomalies = []

        # Check for empty fields
        empty_fields = self.check_empty_fields()
        if empty_fields:
            anomalies.append({
                'type': 'empty_fields',
                'fields': empty_fields,
                'description': f"Empty values in fields: {', '.join(empty_fields)}"
            })

        # Check for invalid product for non-Siège DOT
        if hasattr(self.dot, 'name') and self.dot.name != self.VALID_DOT_SIEGE:
            if self.product not in self.VALID_PRODUCTS_NON_SIEGE:
                anomalies.append({
                    'type': 'invalid_product',
                    'value': self.product,
                    'description': f"Invalid product for non-Siège DOT: {self.product}. Must be one of: {', '.join(self.VALID_PRODUCTS_NON_SIEGE)}"
                })

        # Check for negative amounts
        amount_fields = [
            ('amount_pre_tax', self.amount_pre_tax),
            ('tax_amount', self.tax_amount),
            ('total_amount', self.total_amount),
            ('discount', self.discount)
        ]

        for field_name, value in amount_fields:
            if value is not None and value < 0:
                anomalies.append({
                    'type': 'negative_amount',
                    'field': field_name,
                    'value': value,
                    'description': f"Negative amount in {field_name}: {value}"
                })

        return anomalies


class CANonPeriodique(models.Model):
    """Model for storing CA Non Periodique data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='ca_non_periodique_data')

    # Specific fields for CA Non Periodique
    dot = models.ForeignKey(
        DOT,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ca_non_periodique_data',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=50, blank=True, null=True)
    product = models.CharField(max_length=50, blank=True, null=True)  # PRODUIT
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # HT
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TAX
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TTC
    sale_type = models.CharField(
        max_length=100, blank=True, null=True)  # TYPE_VENTE
    channel = models.CharField(max_length=50, blank=True, null=True)  # CHANNEL

    # Constants for filtering
    VALID_DOT = "Siège"

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['dot']),
            models.Index(fields=['product']),
            models.Index(fields=['channel']),
        ]

    def __str__(self):
        return f"CA Non Periodique {self.dot} - {self.product}"

    @classmethod
    def get_filtered_queryset(cls, queryset=None):
        """
        Apply standard filtering rules to the queryset
        """
        if queryset is None:
            queryset = cls.objects.all()

        return queryset.filter(
            Q(dot__name=cls.VALID_DOT) | Q(dot_code=cls.VALID_DOT)
        )

    def check_empty_fields(self):
        """
        Check for empty fields and return a list of empty field names
        """
        empty_fields = []
        fields_to_check = [
            'dot', 'product', 'amount_pre_tax', 'tax_amount',
            'total_amount', 'sale_type', 'channel'
        ]

        for field in fields_to_check:
            value = getattr(self, field)
            if value is None or (isinstance(value, str) and not value.strip()):
                empty_fields.append(field)

        return empty_fields

    def is_valid_record(self):
        """
        Check if the record meets all filtering criteria
        """
        if hasattr(self.dot, 'name'):
            return self.dot.name == self.VALID_DOT
        return self.dot_code == self.VALID_DOT

    def get_anomalies(self):
        """
        Get a list of anomalies in the record
        """
        anomalies = []

        # Check for empty fields
        empty_fields = self.check_empty_fields()
        if empty_fields:
            anomalies.append({
                'type': 'empty_fields',
                'fields': empty_fields,
                'description': f"Empty values in fields: {', '.join(empty_fields)}"
            })

        # Check for invalid DOT
        if not self.is_valid_record():
            dot_value = self.dot.name if hasattr(
                self.dot, 'name') else self.dot_code
            anomalies.append({
                'type': 'invalid_dot',
                'value': dot_value,
                'description': f"Invalid DOT: {dot_value}. Must be: {self.VALID_DOT}"
            })

        # Check for negative amounts
        amount_fields = [
            ('amount_pre_tax', self.amount_pre_tax),
            ('tax_amount', self.tax_amount),
            ('total_amount', self.total_amount)
        ]

        for field_name, value in amount_fields:
            if value is not None and value < 0:
                anomalies.append({
                    'type': 'negative_amount',
                    'field': field_name,
                    'value': value,
                    'description': f"Negative amount in {field_name}: {value}"
                })

        return anomalies


class CorporateCABase(models.Model):
    """Abstract base model for CA CNT, DNT, and RFD with common filtering rules"""
    # Constants for filtering
    VALID_DOT = "Siège"
    VALID_DEPARTMENT = "Direction Commerciale Corporate"

    class Meta:
        abstract = True

    @classmethod
    def get_filtered_queryset(cls, queryset=None):
        """
        Apply standard filtering rules to the queryset
        """
        if queryset is None:
            queryset = cls.objects.all()

        return queryset.filter(
            Q(dot__name=cls.VALID_DOT) | Q(dot_code=cls.VALID_DOT),
            department=cls.VALID_DEPARTMENT
        )

    def check_empty_fields(self):
        """
        Check for empty fields and return a list of empty field names
        """
        empty_fields = []
        fields_to_check = [
            'dot', 'department', 'transaction_id', 'amount_pre_tax',
            'tax_amount', 'total_amount'
        ]

        for field in fields_to_check:
            value = getattr(self, field)
            if value is None or (isinstance(value, str) and not value.strip()):
                empty_fields.append(field)

        return empty_fields

    def is_valid_record(self):
        """
        Check if the record meets all filtering criteria
        """
        dot_valid = False
        if hasattr(self.dot, 'name'):
            dot_valid = self.dot.name == self.VALID_DOT
        else:
            dot_valid = self.dot_code == self.VALID_DOT

        return dot_valid and self.department == self.VALID_DEPARTMENT

    def get_anomalies(self):
        """
        Get a list of anomalies in the record
        """
        anomalies = []

        # Check for empty fields
        empty_fields = self.check_empty_fields()
        if empty_fields:
            anomalies.append({
                'type': 'empty_fields',
                'fields': empty_fields,
                'description': f"Empty values in fields: {', '.join(empty_fields)}"
            })

        # Check for invalid DOT
        if not self.is_valid_record():
            dot_value = self.dot.name if hasattr(
                self.dot, 'name') else self.dot_code
            anomalies.append({
                'type': 'invalid_dot_or_department',
                'dot': dot_value,
                'department': self.department,
                'description': f"Invalid DOT or Department. Must be DOT: {self.VALID_DOT} and Department: {self.VALID_DEPARTMENT}"
            })

        # Check for negative amounts
        amount_fields = [
            ('amount_pre_tax', self.amount_pre_tax),
            ('tax_amount', self.tax_amount),
            ('total_amount', self.total_amount)
        ]

        for field_name, value in amount_fields:
            if value is not None and value < 0:
                anomalies.append({
                    'type': 'negative_amount',
                    'field': field_name,
                    'value': value,
                    'description': f"Negative amount in {field_name}: {value}"
                })

        return anomalies


class CADNT(CorporateCABase):
    """Model for storing CA DNT data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='ca_dnt_data')

    # Specific fields for CA DNT
    pri_identity = models.CharField(
        max_length=50, blank=True, null=True)  # PRI_IDENTITY
    customer_code = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_CODE
    full_name = models.CharField(
        max_length=255, blank=True, null=True)  # FULL_NAME
    transaction_id = models.CharField(
        max_length=50, blank=True, null=True)  # TRANS_ID
    transaction_type = models.CharField(
        max_length=20, blank=True, null=True)  # TRANS_TYPE
    channel_id = models.CharField(
        max_length=20, blank=True, null=True)  # CHANNEL_ID
    ext_trans_type = models.CharField(
        max_length=20, blank=True, null=True)  # EXT_TRANS_TYPE
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TTC
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TVA
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # HT
    entry_date = models.DateTimeField(null=True, blank=True)  # ENTRY_DATE
    actel = models.CharField(max_length=100, blank=True, null=True)  # ACTEL
    dot = models.ForeignKey(
        DOT,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ca_dnt_data',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=50, blank=True, null=True)
    customer_lev1 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV1
    customer_lev2 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV2
    customer_lev3 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV3
    department = models.CharField(
        max_length=100, blank=True, null=True)  # DEPARTEMENT

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-entry_date']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['dot']),
            models.Index(fields=['transaction_id']),
            models.Index(fields=['department']),
        ]

    def __str__(self):
        return f"CA DNT {self.transaction_id} - {self.full_name}"


class CARFD(CorporateCABase):
    """Model for storing CA RFD data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='ca_rfd_data')

    # Specific fields for CA RFD
    transaction_id = models.CharField(
        max_length=50, blank=True, null=True)  # TRANS_ID
    full_name = models.CharField(
        max_length=255, blank=True, null=True)  # FULL_NAME
    actel = models.CharField(max_length=100, blank=True, null=True)  # ACTEL
    dot = models.ForeignKey(
        DOT,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ca_rfd_data',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=50, blank=True, null=True)
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TTC
    droit_timbre = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # DROIT_TIMBRE
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TVA
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # HT
    entry_date = models.DateTimeField(null=True, blank=True)  # ENTRY_DATE
    customer_code = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_CODE
    pri_identity = models.CharField(
        max_length=50, blank=True, null=True)  # PRI_IDENTITY
    customer_lev1 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV1
    customer_lev2 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV2
    customer_lev3 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV3
    department = models.CharField(
        max_length=100, blank=True, null=True)  # DEPARTEMENT

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-entry_date']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['dot']),
            models.Index(fields=['transaction_id']),
            models.Index(fields=['department']),
        ]

    def __str__(self):
        return f"CA RFD {self.transaction_id} - {self.full_name}"


class CACNT(CorporateCABase):
    """Model for storing CA CNT data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='ca_cnt_data')

    # Specific fields for CA CNT
    invoice_adjusted = models.CharField(
        max_length=50, blank=True, null=True)  # INVOICE_ADJUSTED
    pri_identity = models.CharField(
        max_length=50, blank=True, null=True)  # PRI_IDENTITY
    customer_code = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_CODE
    full_name = models.CharField(
        max_length=255, blank=True, null=True)  # FULL_NAME
    transaction_id = models.CharField(
        max_length=50, blank=True, null=True)  # TRANS_ID
    transaction_type = models.CharField(
        max_length=20, blank=True, null=True)  # TRANS_TYPE
    channel_id = models.CharField(
        max_length=20, blank=True, null=True)  # CHANNEL_ID
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TTC
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TVA
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # HT
    entry_date = models.DateTimeField(null=True, blank=True)  # ENTRY_DATE
    actel = models.CharField(max_length=100, blank=True, null=True)  # ACTEL
    dot = models.ForeignKey(
        DOT,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ca_cnt_data',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=50, blank=True, null=True)
    customer_lev1 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV1
    customer_lev2 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV2
    customer_lev3 = models.CharField(
        max_length=50, blank=True, null=True)  # CUST_LEV3
    department = models.CharField(
        max_length=100, blank=True, null=True)  # DEPARTEMENT

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-entry_date']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['dot']),
            models.Index(fields=['transaction_id']),
            models.Index(fields=['department']),
        ]

    def __str__(self):
        return f"CA CNT {self.transaction_id} - {self.full_name}"


class Anomaly(models.Model):
    ANOMALY_TYPES = [
        ('missing_data', 'Missing Data'),
        ('duplicate_data', 'Duplicate Data'),
        ('invalid_data', 'Invalid Data'),
        ('outlier', 'Outlier'),
        ('inconsistent_data', 'Inconsistent Data'),
        ('other', 'Other')
    ]

    ANOMALY_STATUS = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('ignored', 'Ignored')
    ]

    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='invoice_anomalies')
    type = models.CharField(max_length=50, choices=ANOMALY_TYPES)
    description = models.TextField()
    data = models.JSONField(null=True, blank=True)  # Store the anomalous data
    status = models.CharField(
        max_length=20, choices=ANOMALY_STATUS, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_by = models.ForeignKey(
        'users.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_anomalies'
    )
    resolution_notes = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['type']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.get_type_display()} - {self.invoice.invoice_number} ({self.get_status_display()})"


class ProgressTracker(models.Model):
    """Model for tracking progress of long-running operations"""
    OPERATION_TYPES = [
        ('upload', 'File Upload'),
        ('process', 'Data Processing'),
        ('save', 'Data Saving'),
        ('export', 'Data Export'),
        ('other', 'Other Operation')
    ]

    STATUS_TYPES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ]

    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='progress_trackers')
    operation_type = models.CharField(max_length=20, choices=OPERATION_TYPES)
    status = models.CharField(
        max_length=20, choices=STATUS_TYPES, default='pending')
    progress_percent = models.FloatField(default=0.0)
    current_item = models.IntegerField(default=0)
    total_items = models.IntegerField(default=0)
    start_time = models.DateTimeField(auto_now_add=True)
    last_update_time = models.DateTimeField(auto_now=True)
    estimated_completion_time = models.DateTimeField(null=True, blank=True)
    message = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-start_time']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['operation_type']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.get_operation_type_display()} - {self.progress_percent:.1f}%"

    def update_progress(self, current_item, message=None):
        """Update progress information"""
        self.current_item = current_item
        if self.total_items > 0:
            self.progress_percent = (current_item / self.total_items) * 100

        # Calculate estimated completion time
        if current_item > 0 and self.total_items > 0:
            elapsed_time = (timezone.now() - self.start_time).total_seconds()
            estimated_total_time = elapsed_time / current_item * self.total_items
            remaining_seconds = estimated_total_time - elapsed_time
            self.estimated_completion_time = timezone.now(
            ) + timezone.timedelta(seconds=remaining_seconds)

        if message:
            self.message = message

        self.save()


class RevenueObjective(models.Model):
    """Model for storing revenue objectives by DOT, year, and month"""
    dot = models.ForeignKey(
        DOT,
        on_delete=models.CASCADE,
        related_name='revenue_objectives',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=100, blank=True, null=True)
    year = models.IntegerField()
    # Null for yearly objectives
    month = models.IntegerField(null=True, blank=True)
    target_amount = models.DecimalField(max_digits=15, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('dot', 'year', 'month')
        indexes = [
            models.Index(fields=['dot']),
            models.Index(fields=['year']),
            models.Index(fields=['month']),
        ]

    def __str__(self):
        month_str = str(self.month) if self.month else 'Year'
        return f"Revenue Objective: {self.dot} - {self.year}/{month_str} - {self.target_amount}"


class CollectionObjective(models.Model):
    """Model for storing collection objectives by DOT, year, and month"""
    dot = models.ForeignKey(
        DOT,
        on_delete=models.CASCADE,
        related_name='collection_objectives',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=100, blank=True, null=True)
    year = models.IntegerField()
    # Null for yearly objectives
    month = models.IntegerField(null=True, blank=True)
    target_amount = models.DecimalField(max_digits=15, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('dot', 'year', 'month')
        indexes = [
            models.Index(fields=['dot']),
            models.Index(fields=['year']),
            models.Index(fields=['month']),
        ]

    def __str__(self):
        month_str = f"-{self.month}" if self.month else ""
        return f"{self.dot} {self.year}{month_str}: {self.target_amount}"


class NGBSSCollection(models.Model):
    """Model for storing NGBSS collections data for current and previous years"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='ngbss_collection_data')

    # Specific fields for NGBSS Collections
    dot = models.ForeignKey(
        DOT,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ngbss_collections',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=50, blank=True, null=True)
    organization = models.CharField(
        max_length=100, blank=True, null=True)  # Organization
    invoice_number = models.CharField(max_length=100)  # Invoice Number
    invoice_type = models.CharField(
        max_length=20, blank=True, null=True)  # Invoice Type
    invoice_date = models.DateField(null=True, blank=True)  # Invoice Date
    payment_date = models.DateField(null=True, blank=True)  # Payment Date
    client = models.CharField(max_length=255, blank=True, null=True)  # Client
    client_code = models.CharField(
        max_length=50, blank=True, null=True)  # Client Code
    invoice_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Invoice Amount
    collection_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Collection Amount
    year = models.IntegerField(null=True, blank=True)  # Year of collection
    month = models.IntegerField(null=True, blank=True)  # Month of collection
    # Flag for previous year collections
    is_previous_year = models.BooleanField(default=False)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-payment_date']
        indexes = [
            models.Index(fields=['dot']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['payment_date']),
            models.Index(fields=['year']),
            models.Index(fields=['month']),
            models.Index(fields=['is_previous_year']),
        ]

    def __str__(self):
        return f"{self.invoice_number} - {self.client} - {self.collection_amount}"


class UnfinishedInvoice(models.Model):
    """Model for storing unfinished invoices data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='unfinished_invoice_data')

    # Specific fields for Unfinished Invoices
    dot = models.ForeignKey(
        DOT,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='unfinished_invoices',
        verbose_name="DOT"
    )
    # Legacy field for backward compatibility
    dot_code = models.CharField(max_length=50, blank=True, null=True)
    organization = models.CharField(
        max_length=100, blank=True, null=True)  # Organization
    invoice_number = models.CharField(max_length=100)  # Invoice Number
    invoice_type = models.CharField(
        max_length=20, blank=True, null=True)  # Invoice Type
    invoice_date = models.DateField(null=True, blank=True)  # Invoice Date
    client = models.CharField(max_length=255, blank=True, null=True)  # Client
    client_code = models.CharField(
        max_length=50, blank=True, null=True)  # Client Code
    invoice_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # Invoice Amount
    status = models.CharField(max_length=50, blank=True, null=True)  # Status
    # Reason for being unfinished
    reason = models.TextField(blank=True, null=True)
    days_pending = models.IntegerField(null=True, blank=True)  # Days pending

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['dot']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['invoice_date']),
            models.Index(fields=['status']),
            models.Index(fields=['days_pending']),
        ]

    def __str__(self):
        return f"{self.invoice_number} - {self.client} - {self.status}"
