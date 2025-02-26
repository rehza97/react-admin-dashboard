from django import forms

class UploadExcelForm(forms.Form):
    """Form for uploading Excel files."""
    file = forms.FileField(
        label='Select an Excel file',
        help_text='Max. 5 megabytes',
        widget=forms.FileInput(attrs={'accept': '.xlsx, .xls'})
    ) 
    
    
   
