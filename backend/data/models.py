from django.db import models
from django.utils import timezone

# Create your models here.


class FacturationAR(models.Model):
    invoice_number = models.CharField(max_length=100, unique=True)
    client_name = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    invoice_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=100, null=True, blank=True, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    file_size = models.PositiveIntegerField(default=0)  # Added to store file size
    
    def __str__(self):
        return f"{self.invoice_number} - {self.client_name}"
    
    class Meta:
        verbose_name = "Facturation AR"
        verbose_name_plural = "Facturation AR"
        ordering = ['-created_at']

class FacturationManuelle(models.Model):
    """Model for manual facturation data."""
    mois = models.CharField(max_length=50)
    date_facture = models.DateField()
    departement = models.CharField(max_length=100)
    numero_facture = models.CharField(max_length=100)
    exercice = models.IntegerField()
    client = models.CharField(max_length=255)
    montant_ht = models.DecimalField(max_digits=10, decimal_places=2)
    tva_rate = models.DecimalField(max_digits=5, decimal_places=2)
    montant_tva = models.DecimalField(max_digits=10, decimal_places=2)
    montant_ttc = models.DecimalField(max_digits=10, decimal_places=2)
    designation = models.TextField(blank=True)
    periode = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invoice {self.numero_facture} - {self.client}"
