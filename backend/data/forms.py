from django import forms
from .models import Invoice
import os
from .file_processor import FILE_TYPE_PATTERNS


class InvoiceUploadForm(forms.ModelForm):
    # Add a field for manual file type selection
    FILE_TYPE_CHOICES = [
        ('', 'Auto-detect'),
        ('facturation_manuelle', 'Facturation Manuelle'),
        ('ca_periodique', 'CA Periodique'),
        ('ca_non_periodique', 'CA Non Periodique'),
        ('ca_dnt', 'CA DNT'),
        ('ca_rfd', 'CA RFD'),
        ('ca_cnt', 'CA CNT'),
        ('parc_corporate', 'Parc Corporate'),
        ('creances_ngbss', 'Creances NGBSS'),
        ('etat_facture', 'Etat de Facture'),
        ('journal_ventes', 'Journal des Ventes'),
    ]

    file_type = forms.ChoiceField(
        choices=FILE_TYPE_CHOICES,
        required=False,
        help_text="Select the type of file you are uploading, or leave blank for auto-detection."
    )

    # Add a field for auto-processing option
    auto_process = forms.BooleanField(
        required=False,
        initial=True,
        help_text="Automatically process and save the data after upload."
    )

    class Meta:
        model = Invoice
        fields = ['invoice_number', 'file', 'file_type', 'auto_process']

    def clean_file(self):
        file = self.cleaned_data.get('file')
        if file:
            # Check file extension
            ext = os.path.splitext(file.name)[1]
            valid_extensions = ['.csv', '.xlsx', '.xls']
            if not ext.lower() in valid_extensions:
                raise forms.ValidationError(
                    'Unsupported file extension. Please upload a CSV or Excel file.')

            # Remove file size check completely
            # Don't even have commented code here that might cause issues
        return file

    def save(self, commit=True):
        instance = super().save(commit=False)

        # If a file type was manually selected, set the confidence to 1.0
        if self.cleaned_data.get('file_type'):
            instance.file_type = self.cleaned_data.get('file_type')
            instance.detection_confidence = 1.0

        if commit:
            instance.save()

        return instance
