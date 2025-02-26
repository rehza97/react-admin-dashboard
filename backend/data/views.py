import pandas as pd
from django.shortcuts import render, redirect
from django.contrib import messages
from .forms import UploadExcelForm
from .models import FacturationAR
from datetime import datetime
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import FacturationARSerializer

def upload_facturation_file(request):
    if request.method == 'POST':
        form = UploadExcelForm(request.POST, request.FILES)
        if form.is_valid():
            uploaded_file = request.FILES['file']
            try:
                # Read the Excel file into a Pandas DataFrame
                df = pd.read_excel(uploaded_file)
            except Exception as e:
                messages.error(request, f"Error reading file: {e}")
                return render(request, 'upload_facturation.html', {'form': form})
            
            # Data Cleaning and Filtering:
            # 1. Drop rows missing critical fields like InvoiceNumber or Amount.
            df.dropna(subset=['InvoiceNumber', 'Amount'], inplace=True)
            
            # 2. Convert the InvoiceDate column to datetime, and filter out invalid dates.
            if 'InvoiceDate' in df.columns:
                df['InvoiceDate'] = pd.to_datetime(df['InvoiceDate'], errors='coerce')
                df = df[df['InvoiceDate'].notnull()]
            else:
                messages.error(request, "InvoiceDate column not found.")
                return render(request, 'upload_facturation.html', {'form': form})
            
            # 3. Optionally, strip extra spaces from string fields.
            df['InvoiceNumber'] = df['InvoiceNumber'].astype(str).str.strip()
            df['ClientName'] = df['ClientName'].astype(str).str.strip()
            if 'Status' in df.columns:
                df['Status'] = df['Status'].astype(str).str.strip()
            else:
                df['Status'] = None  # Set a default if not present
            
            # 4. Filter out rows with negative or zero amounts, if that is considered invalid.
            df = df[df['Amount'] > 0]
            
            # 5. Rename columns if necessary to match your model field names
            df.rename(columns={
                'InvoiceNumber': 'invoice_number',
                'ClientName': 'client_name',
                'Amount': 'amount',
                'InvoiceDate': 'invoice_date',
                'Status': 'status'
            }, inplace=True)
            
            # Loop through the cleaned DataFrame and create or update model instances.
            for index, row in df.iterrows():
                try:
                    # Use get_or_create to avoid duplicate invoice entries.
                    obj, created = FacturationAR.objects.update_or_create(
                        invoice_number=row['invoice_number'],
                        defaults={
                            'client_name': row['client_name'],
                            'amount': row['amount'],
                            'invoice_date': row['invoice_date'].date() if not pd.isnull(row['invoice_date']) else None,
                            'status': row.get('status', None)
                        }
                    )
                except Exception as e:
                    messages.error(request, f"Error processing row {index}: {e}")
            
            messages.success(request, "Excel file processed and data uploaded successfully!")
            return redirect('upload_facturation_file')
    else:
        form = UploadExcelForm()
    
    return render(request, 'upload_facturation.html', {'form': form})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facturation_list(request):
    """
    List all facturation records.
    """
    facturations = FacturationAR.objects.all()
    serializer = FacturationARSerializer(facturations, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facturation_detail(request, pk):
    """
    Retrieve a facturation record.
    """
    try:
        facturation = FacturationAR.objects.get(pk=pk)
    except FacturationAR.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    serializer = FacturationARSerializer(facturation)
    return Response(serializer.data)
