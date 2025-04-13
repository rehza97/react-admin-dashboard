import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from django.contrib.auth.models import User
from data.models import ParcCorporate, Invoice
from django.core.files.uploadedfile import SimpleUploadedFile
import os
import json
from datetime import datetime


class ExportAPITestCase(APITestCase):
    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )

        # Create test invoice
        self.invoice = Invoice.objects.create(
            invoice_number='TEST001',
            uploaded_by=self.user,
            upload_date=datetime.now(),
            status='processed'
        )

        # Create test file for invoice
        self.test_file = SimpleUploadedFile(
            "test_invoice.xlsx",
            b"file_content",
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        self.invoice.file = self.test_file
        self.invoice.save()

        # Create test ParcCorporate records
        self.parc_corporate = ParcCorporate.objects.create(
            dot_code='DOT001',
            state='Active',
            actel_code='ACT001',
            customer_l1_code='CL1',
            customer_l1_desc='Customer L1',
            customer_l2_code='CL2',
            customer_l2_desc='Customer L2',
            customer_l3_code='CL3',
            customer_l3_desc='Customer L3',
            customer_full_name='Test Customer',
            telecom_type='Mobile',
            offer_type='Standard',
            offer_name='Basic Plan',
            subscriber_status='Active',
            invoice=self.invoice
        )

        # Authenticate client
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        # Clean up test files
        if self.invoice.file:
            if os.path.exists(self.invoice.file.path):
                os.remove(self.invoice.file.path)

    def test_corporate_park_export_start(self):
        """Test starting a corporate park export"""
        url = reverse('export-corporate-park')
        response = self.client.get(url, {
            'export_format': 'excel',
            'dot': 'DOT001',
            'state': 'Active'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('task_id', response.json())
        self.assertEqual(response.json()['status'], 'processing')

    def test_corporate_park_export_status(self):
        """Test checking export status"""
        # First start an export
        url = reverse('export-corporate-park')
        start_response = self.client.get(url, {'export_format': 'excel'})
        task_id = start_response.json()['task_id']

        # Check status
        status_url = f"{url}status/"
        response = self.client.get(status_url, {'task_id': task_id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('status', response.json())

    def test_invoice_export_start(self):
        """Test starting an invoice export"""
        url = reverse('export-invoice')
        response = self.client.get(url, {
            'invoice_id': self.invoice.id,
            'export_format': 'excel'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('task_id', response.json())
        self.assertEqual(response.json()['status'], 'processing')

    def test_invoice_export_status(self):
        """Test checking invoice export status"""
        # First start an export
        url = reverse('export-invoice')
        start_response = self.client.get(url, {
            'invoice_id': self.invoice.id,
            'export_format': 'excel'
        })
        task_id = start_response.json()['task_id']

        # Check status
        status_url = reverse('export-invoice-status',
                             kwargs={'task_id': task_id})
        response = self.client.get(status_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('status', response.json())

    def test_export_with_filters(self):
        """Test export with various filters"""
        url = reverse('export-corporate-park')
        filters = {
            'export_format': 'excel',
            'dot': 'DOT001',
            'state': 'Active',
            'telecom_type': 'Mobile',
            'offer_name': 'Basic Plan',
            'customer_l2': 'CL2',
            'customer_l3': 'CL3',
            'subscriber_status': 'Active'
        }
        response = self.client.get(url, filters)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('task_id', response.json())

    def test_export_format_validation(self):
        """Test validation of export format"""
        url = reverse('export-corporate-park')
        response = self.client.get(url, {'export_format': 'invalid_format'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_export_cancel(self):
        """Test cancelling an export"""
        # Start an export
        url = reverse('export-corporate-park')
        start_response = self.client.get(url, {'export_format': 'excel'})
        task_id = start_response.json()['task_id']

        # Cancel the export
        cancel_response = self.client.get(url, {
            'task_id': task_id,
            'cancel': 'true'
        })

        self.assertEqual(cancel_response.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_response.json()['status'], 'cancelled')

    def test_unauthorized_access(self):
        """Test unauthorized access to export endpoints"""
        # Remove authentication
        self.client.force_authenticate(user=None)

        url = reverse('export-corporate-park')
        response = self.client.get(url, {'export_format': 'excel'})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invoice_not_found(self):
        """Test export with non-existent invoice"""
        url = reverse('export-invoice')
        response = self.client.get(url, {
            'invoice_id': 99999,  # Non-existent ID
            'export_format': 'excel'
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_export_empty_result(self):
        """Test export with filters that return no results"""
        url = reverse('export-corporate-park')
        response = self.client.get(url, {
            'export_format': 'excel',
            'dot': 'NONEXISTENT_DOT'
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # The actual export should later indicate no records found
