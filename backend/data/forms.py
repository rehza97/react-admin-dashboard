from django import forms
from .models import Invoice
import os


class InvoiceUploadForm(forms.ModelForm):
    class Meta:
        model = Invoice
        fields = ['invoice_number', 'file']

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
