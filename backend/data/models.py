from django.db import models
from users.models import CustomUser


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

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-invoice_date']
        indexes = [
            models.Index(fields=['invoice']),
            models.Index(fields=['organization']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['gl_date']),
        ]

    def __str__(self):
        return f"Journal {self.invoice_number} - {self.client}"


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
    dot = models.CharField(max_length=50, blank=True, null=True)  # DOT
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


class CAPeriodique(models.Model):
    """Model for storing CA Periodique data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='ca_periodique_data')

    # Specific fields for CA Periodique
    dot = models.CharField(max_length=50, blank=True, null=True)  # DO
    product = models.CharField(max_length=50, blank=True, null=True)  # PRODUIT
    amount_pre_tax = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # HT
    tax_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TAX
    total_amount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # TTC
    discount = models.DecimalField(
        max_digits=15, decimal_places=2, null=True)  # DISCOUNT

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


class CANonPeriodique(models.Model):
    """Model for storing CA Non Periodique data"""
    # Link to the original invoice file
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='ca_non_periodique_data')

    # Specific fields for CA Non Periodique
    dot = models.CharField(max_length=50, blank=True, null=True)  # DO
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


class CADNT(models.Model):
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
    dot = models.CharField(max_length=50, blank=True, null=True)  # DO
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


class CARFD(models.Model):
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
    dot = models.CharField(max_length=50, blank=True, null=True)  # DO
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


class CACNT(models.Model):
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
    dot = models.CharField(max_length=50, blank=True, null=True)  # DO
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
