from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import Invoice
import os
import tempfile
from django.core.files.uploadedfile import SimpleUploadedFile

User = get_user_model()


class DirectProcessingTests(TestCase):
    def setUp(self):
        # Create a test user
        self.user = User.objects.create_user(
            email='testuser@example.com',
            password='testpassword123',
            first_name='Test',
            last_name='User'
        )

        # Set up the API client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        # Create a simple CSV file for testing
        self.csv_content = b"Mois,Date de Facture,Depts,N Facture,Exercices,Client,Montant HT,% TVA,Montant TVA,Montant TTC,Designations,Periode\n" \
            b"Janvier,2023-01-15,IT,INV001,2023,Client A,1000,19,190,1190,Service IT,Q1 2023\n" \
            b"Fevrier,2023-02-20,Marketing,INV002,2023,Client B,2000,19,380,2380,Marketing Services,Q1 2023"

        self.temp_file = tempfile.NamedTemporaryFile(
            suffix='.csv', delete=False)
        self.temp_file.write(self.csv_content)
        self.temp_file.close()

    def tearDown(self):
        # Clean up the temporary file
        if os.path.exists(self.temp_file.name):
            os.unlink(self.temp_file.name)

    def test_auto_process_on_upload(self):
        """Test that files are automatically processed and saved when auto_process is enabled"""
        # Create a test file
        with open(self.temp_file.name, 'rb') as f:
            file_obj = SimpleUploadedFile(
                name='test_facturation.csv',
                content=f.read(),
                content_type='text/csv'
            )

        # Upload the file with auto_process=true
        response = self.client.post(
            reverse('upload-facturation'),
            {
                'invoice_number': 'TEST001',
                'file': file_obj,
                'file_type': 'facturation_manuelle',
                'auto_process': 'true'
            },
            format='multipart'
        )

        # Check that the upload was successful
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Get the invoice ID from the response
        invoice_id = response.data['id']

        # Check that the invoice exists and is in 'saved' status
        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.status, 'saved')

        # Check that the data was saved to the database
        self.assertTrue(invoice.facturation_manuelle_data.exists())
        # We had 2 rows in our CSV
        self.assertEqual(invoice.facturation_manuelle_data.count(), 2)

    def test_direct_save_on_process(self):
        """Test that files can be processed and saved directly with the saveDirectly option"""
        # First create an invoice without auto-processing
        with open(self.temp_file.name, 'rb') as f:
            file_obj = SimpleUploadedFile(
                name='test_facturation.csv',
                content=f.read(),
                content_type='text/csv'
            )

        # Upload the file with auto_process=false
        response = self.client.post(
            reverse('upload-facturation'),
            {
                'invoice_number': 'TEST002',
                'file': file_obj,
                'file_type': 'facturation_manuelle',
                'auto_process': 'false'
            },
            format='multipart'
        )

        # Check that the upload was successful
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Get the invoice ID from the response
        invoice_id = response.data['id']

        # Now process the file with saveDirectly=true
        response = self.client.post(
            reverse('invoice-process', kwargs={'pk': invoice_id}),
            {
                'processing_options': {
                    'processingMode': 'automatic',
                    'fileType': 'facturation_manuelle',
                    'saveDirectly': True
                }
            },
            format='json'
        )

        # Check that the processing was successful
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check that the invoice exists and is in 'saved' status
        invoice = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice.status, 'saved')

        # Check that the data was saved to the database
        self.assertTrue(invoice.facturation_manuelle_data.exists())
        # We had 2 rows in our CSV
        self.assertEqual(invoice.facturation_manuelle_data.count(), 2)

    def test_summary_view(self):
        """Test that the summary view returns the correct data"""
        # First create and process an invoice
        with open(self.temp_file.name, 'rb') as f:
            file_obj = SimpleUploadedFile(
                name='test_facturation.csv',
                content=f.read(),
                content_type='text/csv'
            )

        # Upload the file with auto_process=true
        response = self.client.post(
            reverse('upload-facturation'),
            {
                'invoice_number': 'TEST003',
                'file': file_obj,
                'file_type': 'facturation_manuelle',
                'auto_process': 'true'
            },
            format='multipart'
        )

        # Get the invoice ID from the response
        invoice_id = response.data['id']

        # Get the summary data
        response = self.client.get(
            reverse('invoice-summary', kwargs={'pk': invoice_id})
        )

        # Check that the request was successful
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check that the summary contains the expected data
        self.assertIn('data_counts', response.data)
        self.assertIn('facturation_manuelle', response.data['data_counts'])
        # We had 2 rows in our CSV
        self.assertEqual(response.data['data_counts']
                         ['facturation_manuelle'], 2)
