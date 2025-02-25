from django.db import models

# Create your models here.

from django.db import models

# CA Commercial manuel Siège/Facturation Manuelle AR 2024
class FacturationManuelle(models.Model):
    mois = models.CharField(max_length=50)                 # or IntegerField, depending on how you store "Mois"
    date_facture = models.DateField()
    departement = models.CharField(max_length=100)         # e.g. "Dépts"
    numero_facture = models.CharField(max_length=100)      # "N° Factures"
    exercice = models.IntegerField()                       # e.g. 2023, 2024, etc.
    client = models.CharField(max_length=255)
    montant_ht = models.DecimalField(max_digits=10, decimal_places=2)
    tva_rate = models.DecimalField(max_digits=5, decimal_places=2)  # "% TVA"
    montant_tva = models.DecimalField(max_digits=10, decimal_places=2)
    montant_ttc = models.DecimalField(max_digits=10, decimal_places=2)
    designation = models.TextField(blank=True)             # or CharField if short
    periode = models.CharField(max_length=50, blank=True)  # or DateField, depending on usage

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Invoice {self.invoice_number} - {self.client_name}"
