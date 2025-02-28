from django import forms
from .models import Invoice

class InvoiceUploadForm(forms.ModelForm):
    class Meta:
        model = Invoice
        fields = ['invoice_number', 'file']

    def clean_file(self):
        file = self.cleaned_data.get('file')
        if file:
            # Check file extension
            ext = file.name.split('.')[-1].lower()
            if ext not in ['csv', 'xlsx', 'xls']:
                raise forms.ValidationError("Only CSV and Excel files are allowed")
            # Check file size (5MB limit)
            if file.size > 5 * 1024 * 1024:
                raise forms.ValidationError("File size must be under 5MB")
        return file


