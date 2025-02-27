from django.db import models
from users.models import CustomUser

class Invoice(models.Model):
    PROCESSING_STATUS = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
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
