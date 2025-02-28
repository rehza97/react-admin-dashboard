from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import FileResponse
from django.core.exceptions import ValidationError
from .models import Invoice, ProcessedInvoiceData
from .serializers import InvoiceSerializer, ProcessedInvoiceDataSerializer
from .forms import InvoiceUploadForm
import logging
import pandas as pd
import numpy as np
import io
import json
from datetime import datetime
from django.utils import timezone
from rest_framework.decorators import action, api_view
from rest_framework.parsers import JSONParser

logger = logging.getLogger(__name__)

class InvoiceUploadView(generics.CreateAPIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def post(self, request, *args, **kwargs):
        try:
            # Validate file using the form
            form = InvoiceUploadForm(request.POST, request.FILES)
            if not form.is_valid():
                return Response(
                    {"error": form.errors}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create serializer with validated form data
            serializer = self.get_serializer(data=request.data)
            if serializer.is_valid():
                serializer.save()
                logger.info(
                    f"File uploaded successfully by {request.user.email}: {serializer.data['invoice_number']}"
                )
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            
            return Response(
                {"error": serializer.errors}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except ValidationError as e:
            logger.error(f"Validation error during upload: {str(e)}")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error during file upload: {str(e)}")
            return Response(
                {"error": "Failed to upload file"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class InvoiceListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        queryset = Invoice.objects.filter(uploaded_by=self.request.user)
        
        # Add filtering options
        status = self.request.query_params.get('status', None)
        if status:
            queryset = queryset.filter(status=status)
            
        # Add date range filtering
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        if start_date and end_date:
            queryset = queryset.filter(upload_date__range=[start_date, end_date])
            
        return queryset.order_by('-upload_date')

class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = InvoiceSerializer
    
    def get_queryset(self):
        return Invoice.objects.filter(uploaded_by=self.request.user)
    
    def update(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            
            if serializer.is_valid():
                serializer.save()
                logger.info(f"File updated by {request.user.email}: {instance.invoice_number}")
                return Response(serializer.data)
                
            return Response(
                {"error": serializer.errors}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except Exception as e:
            logger.error(f"Error updating file: {str(e)}")
            return Response(
                {"error": "Failed to update file"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            # Delete the actual file
            instance.file.delete(save=False)
            self.perform_destroy(instance)
            logger.info(f"File deleted by {request.user.email}: {instance.invoice_number}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return Response(
                {"error": "Failed to delete file"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class InvoiceProcessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        """Process the Excel file for the invoice"""
        try:
            invoice = Invoice.objects.get(pk=pk, uploaded_by=request.user)
            
            if invoice.status not in ['pending', 'processing']:
                return Response(
                    {"error": "File is already processed"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update status to processing
            invoice.status = 'processing'
            invoice.save()
            
            # Get the file
            file_path = invoice.file.path
            
            # Process based on file type
            if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
                result = self.process_excel(file_path, request.data.get('processing_options', {}))
            elif file_path.endswith('.csv'):
                result = self.process_csv(file_path, request.data.get('processing_options', {}))
            else:
                raise ValueError("Unsupported file format")
            
            # Update the invoice with processing results
            invoice.status = 'preview'
            invoice.processed_date = timezone.now()
            invoice.save()
            
            return Response({
                "message": "File processed successfully",
                "preview": result['preview'],
                "summary": result['summary']
            })
            
        except Invoice.DoesNotExist:
            return Response(
                {"error": "File not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            # If there's an error, update status to failed
            if 'invoice' in locals() and invoice:
                invoice.status = 'failed'
                invoice.error_message = str(e)
                invoice.save()
            
            logger.error(f"Error processing file {pk}: {str(e)}")
            return Response(
                {"error": f"Failed to process file: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def process_excel(self, file_path, options):
        """Process Excel file and extract invoice data"""
        try:
            logger.info(f"Starting Excel processing for file: {file_path}")
            logger.info(f"Processing options: {json.dumps(options)}")
            
            # Read the Excel file
            logger.info(f"Reading Excel file: {file_path}")
            df = pd.read_excel(file_path)
            logger.info(f"Excel file loaded successfully. Shape: {df.shape}")
            
            # Log column names for debugging
            columns = list(df.columns)
            logger.info(f"Columns in file: {columns}")
            
            # Apply cleaning and filtering based on options
            if options.get('remove_duplicates', True):
                logger.info("Removing duplicates...")
                initial_rows = len(df)
                df = df.drop_duplicates()
                logger.info(f"Duplicates removed. Rows before: {initial_rows}, after: {len(df)}")
                
            if options.get('handle_missing', True):
                logger.info("Handling missing values...")
                # Log missing values before filling
                missing_before = df.isna().sum().to_dict()
                logger.info(f"Missing values before filling: {missing_before}")
                
                # Define expected columns and their default values
                expected_columns = {
                    'Mois': '',
                    'Date de Facture': None,
                    'Dépts': '',
                    'N° Factures': '',
                    'Exercices': '',
                    'Client': '',
                    'Montant HT': 0,
                    '% TVA': 0,
                    'Montant TVA': 0,
                    'Montant TTC': 0,
                    'Désignations': '',
                    'Période': ''
                }
                
                # Fill missing values only for columns that exist
                for col, default_value in expected_columns.items():
                    if col in df.columns:
                        logger.info(f"Filling missing values for column: {col}")
                        df[col] = df[col].fillna(default_value)
                    else:
                        logger.info(f"Column '{col}' not found in the file, creating with default values")
                        df[col] = default_value
                
                # Log missing values after filling
                missing_after = df.isna().sum().to_dict()
                logger.info(f"Missing values after filling: {missing_after}")
            
            # Apply any custom filters from options
            if 'filters' in options and options['filters']:
                logger.info(f"Applying filters: {options['filters']}")
                for filter_item in options['filters']:
                    column = filter_item.get('column')
                    value = filter_item.get('value')
                    operator = filter_item.get('operator', 'equals')
                    
                    logger.info(f"Applying filter: {column} {operator} {value}")
                    rows_before = len(df)
                    
                    if column and value is not None and column in df.columns:
                        if operator == 'equals':
                            df = df[df[column] == value]
                        elif operator == 'contains':
                            df = df[df[column].astype(str).str.contains(value, na=False)]
                        elif operator == 'greater_than':
                            df = df[df[column] > value]
                        elif operator == 'less_than':
                            df = df[df[column] < value]
                    
                    logger.info(f"Filter applied. Rows before: {rows_before}, after: {len(df)}")
                else:
                    logger.warning(f"Skipping filter for column '{column}' as it doesn't exist in the dataframe")
            
            # Standardize column names (map French to English)
            logger.info("Standardizing column names...")
            column_mapping = {
                'Mois': 'month',
                'Date de Facture': 'invoice_date',
                'Dépts': 'department',
                'N° Factures': 'invoice_number',
                'Exercices': 'fiscal_year',
                'Client': 'client',
                'Montant HT': 'amount_pre_tax',
                '% TVA': 'vat_percentage',
                'Montant TVA': 'vat_amount',
                'Montant TTC': 'total_amount',
                'Désignations': 'description',
                'Période': 'period'
            }
            
            # Rename columns if they exist
            renamed_columns = []
            for fr_col, en_col in column_mapping.items():
                if fr_col in df.columns:
                    df = df.rename(columns={fr_col: en_col})
                    renamed_columns.append(f"{fr_col} -> {en_col}")
            
            logger.info(f"Columns renamed: {renamed_columns}")
            logger.info(f"Final columns: {list(df.columns)}")
            
            # Convert date columns to proper format
            if 'invoice_date' in df.columns:
                logger.info("Converting invoice_date to datetime...")
                invalid_dates_count = pd.to_datetime(df['invoice_date'], errors='coerce').isna().sum()
                logger.info(f"Invalid dates found: {invalid_dates_count}")
                df['invoice_date'] = pd.to_datetime(df['invoice_date'], errors='coerce')
            
            # Generate summary statistics
            logger.info("Generating summary statistics...")
            summary = self._generate_summary(df)
            
            # Return preview and data
            logger.info(f"Processing complete. Final dataframe shape: {df.shape}")
            return {
                'preview': df.head(10).to_dict('records'),
                'summary': summary,
                'full_data': df.to_dict('records')
            }
            
        except Exception as e:
            logger.error(f"Error processing Excel file: {str(e)}", exc_info=True)
            # Add more detailed error information
            if isinstance(e, KeyError):
                logger.error(f"Column not found: {str(e)}")
                raise ValueError(f"Column not found in the Excel file: {str(e)}")
            elif isinstance(e, pd.errors.ParserError):
                logger.error("Invalid Excel file format")
                raise ValueError("The file is not a valid Excel file")
            elif isinstance(e, FileNotFoundError):
                logger.error(f"File not found: {file_path}")
                raise ValueError("The file could not be found")
            else:
                raise
    
    def _generate_summary(self, df):
        """Generate summary statistics for the dataframe"""
        summary = {
            'row_count': len(df),
            'column_count': len(df.columns),
            'columns': []
        }
        
        # Generate summary for each column
        for column in df.columns:
            col_summary = {
                'name': column,
                'type': str(df[column].dtype)
            }
            
            # Add numeric stats if column is numeric
            if df[column].dtype in [np.int64, np.float64]:
                col_summary.update({
                    'min': float(df[column].min()) if not pd.isna(df[column].min()) else None,
                    'max': float(df[column].max()) if not pd.isna(df[column].max()) else None,
                    'mean': float(df[column].mean()) if not pd.isna(df[column].mean()) else None,
                    'missing': int(df[column].isna().sum())
                })
            else:
                # Add string stats
                col_summary.update({
                    'unique_values': int(df[column].nunique()),
                    'missing': int(df[column].isna().sum())
                })
            
            summary['columns'].append(col_summary)
        
        return summary
    
    def process_csv(self, file_path, options):
        """Process CSV file with cleaning and filtering"""
        # Read the CSV file
        df = pd.read_csv(file_path)
        
        # Apply cleaning and filtering
        df = self.apply_data_cleaning(df, options)
        
        # Generate preview (first 10 rows)
        preview = df.head(10).to_dict('records')
        
        # Generate summary statistics
        summary = self._generate_summary(df)
        
        return {
            'preview': preview,
            'summary': summary,
            'full_data': df.to_dict('records')
        }
    
    def apply_data_cleaning(self, df, options):
        """Apply data cleaning and filtering based on options"""
        # Example cleaning operations (customize based on your requirements)
        
        # 1. Remove duplicates if specified
        if options.get('remove_duplicates', True):
            df = df.drop_duplicates()
            
        # 2. Handle missing values
        if options.get('handle_missing', True):
            # Replace missing values with specified or default values
            for column in df.columns:
                if df[column].dtype == np.number:
                    df[column] = df[column].fillna(0)
                else:
                    df[column] = df[column].fillna('')
        
        # 3. Apply custom filters if provided
        filters = options.get('filters', [])
        for filter_obj in filters:
            column = filter_obj.get('column')
            operation = filter_obj.get('operation')
            value = filter_obj.get('value')
            
            if column and operation and value is not None:
                if operation == 'equals':
                    df = df[df[column] == value]
                elif operation == 'not_equals':
                    df = df[df[column] != value]
                elif operation == 'greater_than':
                    df = df[df[column] > value]
                elif operation == 'less_than':
                    df = df[df[column] < value]
                elif operation == 'contains':
                    df = df[df[column].astype(str).str.contains(str(value))]
        
        # 4. Apply transformations if specified
        transforms = options.get('transforms', [])
        for transform in transforms:
            column = transform.get('column')
            operation = transform.get('operation')
            
            if column and operation:
                if operation == 'uppercase':
                    df[column] = df[column].astype(str).str.upper()
                elif operation == 'lowercase':
                    df[column] = df[column].astype(str).str.lower()
                elif operation == 'trim':
                    df[column] = df[column].astype(str).str.strip()
        
        return df

    @action(detail=True, methods=['post'])
    def save_to_database(self, request, pk=None):
        """Save processed data to database"""
        try:
            instance = self.get_object()
            
            if instance.status != 'preview':
                return Response(
                    {"error": "File must be in preview status to save to database"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update status to saved
            instance.status = 'saved'
            instance.save()
            
            # Here you would implement the actual database saving logic
            # This could involve creating entries in another model
            
            return Response({
                "message": "Data saved to database successfully"
            })
            
        except Exception as e:
            logger.error(f"Error saving to database for file {pk}: {str(e)}")
            return Response(
                {"error": f"Failed to save to database: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def inspect_excel_file(self, file_path):
        """Inspect Excel file structure and return column information"""
        try:
            # Read just the header to get column names
            df_header = pd.read_excel(file_path, nrows=0)
            columns = list(df_header.columns)
            
            # Read a few rows to get data types
            df_sample = pd.read_excel(file_path, nrows=5)
            
            column_info = []
            for col in columns:
                dtype = str(df_sample[col].dtype)
                sample = df_sample[col].iloc[0] if not df_sample.empty else None
                column_info.append({
                    'name': col,
                    'type': dtype,
                    'sample': str(sample) if sample is not None else None
                })
            
            return {
                'file_path': file_path,
                'columns': column_info,
                'column_count': len(columns)
            }
        except Exception as e:
            logger.error(f"Error inspecting Excel file: {str(e)}", exc_info=True)
            return {
                'file_path': file_path,
                'error': str(e),
                'columns': []
            }

class InvoiceDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            invoice = Invoice.objects.get(pk=pk, uploaded_by=request.user)
            if not invoice.file:
                return Response(
                    {"error": "File not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
                
            response = FileResponse(invoice.file, as_attachment=True)
            response['Content-Disposition'] = f'attachment; filename="{invoice.file.name}"'
            logger.info(f"File downloaded by {request.user.email}: {invoice.invoice_number}")
            return response
            
        except Invoice.DoesNotExist:
            return Response(
                {"error": "File not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error downloading file: {str(e)}")
            return Response(
                {"error": "Failed to download file"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ProcessedInvoiceDataListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProcessedInvoiceDataSerializer
    
    def get_queryset(self):
        invoice_id = self.kwargs.get('invoice_id')
        # Ensure the user can only access their own data
        return ProcessedInvoiceData.objects.filter(
            invoice_id=invoice_id,
            invoice__uploaded_by=self.request.user
            )

class InvoiceSaveView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk=None):
        """Save processed data to database"""
        try:
            invoice = Invoice.objects.get(pk=pk, uploaded_by=request.user)
            
            if invoice.status != 'preview':
                return Response(
                    {"error": "File must be in preview status to save to database"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get the processed data
            # In a real implementation, you would retrieve this from cache/session
            # For this example, we'll reprocess the file
            file_path = invoice.file.path
            
            if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
                result = self.process_excel(file_path, request.data.get('processing_options', {}))
            elif file_path.endswith('.csv'):
                result = self.process_csv(file_path, request.data.get('processing_options', {}))
            else:
                raise ValueError("Unsupported file format")
            
            # Get the full processed data
            processed_data = result.get('full_data', [])
            
            # Save each row to the database
            saved_count = 0
            for row in processed_data:
                try:
                    # Create a new ProcessedInvoiceData record
                    ProcessedInvoiceData.objects.create(
                        invoice=invoice,
                        month=row.get('month', ''),
                        invoice_date=row.get('invoice_date'),
                        department=row.get('department', ''),
                        invoice_number=row.get('invoice_number', ''),
                        fiscal_year=row.get('fiscal_year', ''),
                        client=row.get('client', ''),
                        amount_pre_tax=row.get('amount_pre_tax', 0),
                        vat_percentage=row.get('vat_percentage', 0),
                        vat_amount=row.get('vat_amount', 0),
                        total_amount=row.get('total_amount', 0),
                        description=row.get('description', ''),
                        period=row.get('period', '')
                    )
                    saved_count += 1
                except Exception as e:
                    logger.error(f"Error saving row: {str(e)}")
                    # Continue with next row
            
            # Update status to saved
            invoice.status = 'saved'
            invoice.save()
            
            return Response({
                "message": f"Data saved to database successfully. {saved_count} records created."
            })
            
        except Invoice.DoesNotExist:
            return Response(
                {"error": "File not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error saving to database for file {pk}: {str(e)}")
            return Response(
                {"error": f"Failed to save to database: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
