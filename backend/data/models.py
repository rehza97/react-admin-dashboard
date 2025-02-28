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
    status = models.CharField(max_length=20, choices=PROCESSING_STATUS, default='pending')
    processed_date = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ['-upload_date']
        indexes = [
            models.Index(fields=['invoice_number']),
            models.Index(fields=['status']),
            models.Index(fields=['upload_date']),
        ]

    def __str__(self):
        return f"{self.invoice_number} ({self.status})"

class ProcessedInvoiceData(models.Model):
    # Link to the original invoice file
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='processed_data')
    
    # Invoice fields
    month = models.CharField(max_length=20, blank=True, null=True)  # Mois
    invoice_date = models.DateField(null=True, blank=True)  # Date de Facture
    department = models.CharField(max_length=100, blank=True, null=True)  # Dépts
    invoice_number = models.CharField(max_length=100)  # N° Factures
    fiscal_year = models.CharField(max_length=10, blank=True, null=True)  # Exercices
    client = models.CharField(max_length=255, blank=True, null=True)  # Client
    amount_pre_tax = models.DecimalField(max_digits=15, decimal_places=2, null=True)  # Montant HT
    vat_percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True)  # % TVA
    vat_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True)  # Montant TVA
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True)  # Montant TTC
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

