from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import Invoice
import os
import tempfile
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from .models import ParcCorporate, CreancesNGBSS, CAPeriodique, CANonPeriodique, DOT
from decimal import Decimal

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


class DataValidationViewTests(APITestCase):
    """Tests for the DataValidationView"""

    def setUp(self):
        # Create a test user
        self.user = CustomUser.objects.create_user(
            email='testuser@example.com',
            password='testpassword',
            first_name='Test',
            last_name='User'
        )

        # Create a test DOT
        self.dot = DOT.objects.create(
            code='TEST',
            name='Test DOT',
            description='Test DOT for validation tests'
        )

        # Create a test invoice
        self.invoice = Invoice.objects.create(
            invoice_number='TEST-VALIDATION-001',
            file='test_files/test.xlsx',
            uploaded_by=self.user,
            status='completed',
            file_type='parc_corporate'
        )

        # Create some test data with issues
        # 1. ParcCorporate with invalid customer_l3_code
        self.invalid_parc = ParcCorporate.objects.create(
            invoice=self.invoice,
            customer_l3_code='5',  # This should be filtered out
            customer_full_name='Test Customer',
            offer_name='Test Offer',
            subscriber_status='Active'
        )

        # 2. CreancesNGBSS with invalid product
        self.invalid_creances = CreancesNGBSS.objects.create(
            invoice=self.invoice,
            dot=self.dot,
            product='InvalidProduct',  # Not in VALID_PRODUCTS
            customer_lev1='Corporate',
            customer_lev3="Ligne d'exploitation AP",
            actel='TEST-ACTEL'
        )

        # 3. CAPeriodique with invalid product for non-Siège
        self.invalid_ca_periodique = CAPeriodique.objects.create(
            invoice=self.invoice,
            dot=self.dot,  # Not Siège
            product='InvalidProduct',  # Not in VALID_PRODUCTS_NON_SIEGE
            amount_pre_tax=Decimal('100.00'),
            total_amount=Decimal('119.00')
        )

        # 4. CANonPeriodique with invalid DOT
        self.invalid_ca_non_periodique = CANonPeriodique.objects.create(
            invoice=self.invoice,
            dot=self.dot,  # Not Siège
            product='Test Product',
            amount_pre_tax=Decimal('100.00'),
            total_amount=Decimal('119.00')
        )

        # Get authentication token
        self.client.force_authenticate(user=self.user)

    def test_validation_endpoint(self):
        """Test that the validation endpoint returns expected results"""
        url = reverse('data-validation')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Check that issues were found
        self.assertTrue(response.data['total_issues_found'] > 0)
        self.assertTrue(response.data['client_cleaning_required'])

        # Check specific validation results
        parc_results = response.data['validation_results']['parc_corporate']
        self.assertTrue(parc_results['records_with_issues'] > 0)
        self.assertTrue(any(
            issue['type'] == 'invalid_customer_l3_code' for issue in parc_results['issues']))

        creances_results = response.data['validation_results']['creances_ngbss']
        self.assertTrue(creances_results['records_with_issues'] > 0)
        self.assertTrue(
            any(issue['type'] == 'invalid_product' for issue in creances_results['issues']))

        ca_periodique_results = response.data['validation_results']['ca_periodique']
        self.assertTrue(ca_periodique_results['records_with_issues'] > 0)
        self.assertTrue(any(
            issue['type'] == 'invalid_product_for_non_siege' for issue in ca_periodique_results['issues']))

        ca_non_periodique_results = response.data['validation_results']['ca_non_periodique']
        self.assertTrue(ca_non_periodique_results['records_with_issues'] > 0)
        self.assertTrue(any(
            issue['type'] == 'invalid_dot' for issue in ca_non_periodique_results['issues']))

    def test_cleaning_endpoint(self):
        """Test that the cleaning endpoint correctly removes invalid records"""
        # First, verify that our invalid records exist
        self.assertTrue(ParcCorporate.objects.filter(
            customer_l3_code='5').exists())
        self.assertTrue(CreancesNGBSS.objects.filter(
            product='InvalidProduct').exists())
        self.assertTrue(CAPeriodique.objects.filter(
            product='InvalidProduct').exists())
        self.assertTrue(CANonPeriodique.objects.filter(dot=self.dot).exists())

        # Call the cleaning endpoint
        url = reverse('data-cleaning')
        response = self.client.post(url, {
            'validate_first': True,
            'models_to_clean': [
                'parc_corporate',
                'creances_ngbss',
                'ca_periodique',
                'ca_non_periodique'
            ]
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')

        # Verify that invalid records were removed
        self.assertFalse(ParcCorporate.objects.filter(
            customer_l3_code='5').exists())
        self.assertFalse(CreancesNGBSS.objects.filter(
            product='InvalidProduct').exists())
        self.assertFalse(CAPeriodique.objects.filter(
            product='InvalidProduct').exists())
        self.assertFalse(CANonPeriodique.objects.filter(dot=self.dot).exists())

        # Check cleaning results
        self.assertTrue(response.data['total_records_cleaned'] > 0)
        self.assertEqual(len(response.data['models_cleaned']), 4)
