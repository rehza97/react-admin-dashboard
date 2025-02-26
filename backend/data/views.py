import pandas as pd
from django.shortcuts import render, redirect
from django.contrib import messages
from .forms import UploadExcelForm
from .models import FacturationAR
from datetime import datetime
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import FacturationARSerializer
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os

# Regular Django view for form-based file upload (web interface)
def upload_facturation_form(request):
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
            return redirect('upload_facturation_form')
    else:
        form = UploadExcelForm()
    
    return render(request, 'upload_facturation.html', {'form': form})

# REST API view for file upload (for React frontend)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_facturation_api(request):
    if 'file' not in request.FILES:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    file = request.FILES['file']
    
    # Validate file extension
    allowed_extensions = ['.xlsx', '.xls', '.csv']
    file_extension = os.path.splitext(file.name)[1].lower()
    if file_extension not in allowed_extensions:
        return Response(
            {'error': f'Invalid file type. Allowed types: {", ".join(allowed_extensions)}'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        # Read the file based on its type
        if file_extension == '.csv':
            df = pd.read_csv(file)
        else:
            df = pd.read_excel(file)

        # Validate required columns
        required_columns = ['invoice_number', 'client_name', 'amount', 'invoice_date']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            return Response(
                {'error': f'Missing required columns: {", ".join(missing_columns)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Process and save the data
        success_count = 0
        errors = []
        
        for index, row in df.iterrows():
            try:
                FacturationAR.objects.create(
                    invoice_number=str(row['invoice_number']),
                    client_name=str(row['client_name']),
                    amount=float(row['amount']),
                    invoice_date=pd.to_datetime(row['invoice_date']).date(),
                    status=str(row.get('status', 'pending'))
                )
                success_count += 1
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")

        response_data = {
            'message': f'Processed {success_count} records successfully',
            'total_rows': len(df),
            'successful_rows': success_count,
            'failed_rows': len(errors),
            'errors': errors[:10] if errors else None  # Return first 10 errors only
        }

        return Response(response_data, 
                       status=status.HTTP_201_CREATED if not errors else status.HTTP_207_MULTI_STATUS)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facturation_list(request):
    try:
        facturations = FacturationAR.objects.all().order_by('-created_at')
        serializer = FacturationARSerializer(facturations, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response([], status=status.HTTP_200_OK)  # Return empty list on error

@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def facturation_detail(request, pk):
    try:
        facturation = FacturationAR.objects.get(pk=pk)
    except FacturationAR.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = FacturationARSerializer(facturation)
        return Response(serializer.data)
    
    elif request.method == 'DELETE':
        facturation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# Add a download endpoint for files
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_facturation(request, invoice_number):
    try:
        facturation = FacturationAR.objects.get(invoice_number=invoice_number)
        # Here you would generate the file to download
        # This is a placeholder - you need to implement the actual file generation
        response = Response(...)
        response['Content-Disposition'] = f'attachment; filename="{invoice_number}.xlsx"'
        return response
    except FacturationAR.DoesNotExist:
        return Response({'error': 'File not found'}, status=status.HTTP_404_NOT_FOUND)