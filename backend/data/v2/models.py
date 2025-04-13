from django.db import models
from datetime import datetime

# Import the existing models to extend them
from ..models import (
    Invoice, DOT, JournalVentes, EtatFacture, ParcCorporate, CreancesNGBSS,
    CAPeriodique, CANonPeriodique, CADNT, CARFD, CACNT
)

# Define cleaning status choices
CLEANING_STATUS_CHOICES = [
    ('raw', 'Raw Data'),
    ('cleaning', 'Currently Cleaning'),
    ('cleaned', 'Cleaned'),
    ('filtered_out', 'Filtered Out')
]

# You can use this mixin to add cleaning status to your models


class CleaningStatusMixin(models.Model):
    """
    Mixin to add cleaning status to models in V2 API
    """
    cleaning_status = models.CharField(
        max_length=20,
        choices=CLEANING_STATUS_CHOICES,
        default='raw',
        db_index=True
    )

    class Meta:
        abstract = True
