from decimal import Decimal
from django.db.models import Count, Avg, StdDev, Sum, Q, F, Max, Min
from django.utils import timezone
from datetime import datetime, timedelta
from django.core.exceptions import FieldError
from django.core.paginator import Paginator
import concurrent.futures
import multiprocessing
from django.db import transaction
from itertools import islice
from .models import (
    JournalVentes,
    EtatFacture,
    ParcCorporate,
    CreancesNGBSS,
    CAPeriodique,
    CANonPeriodique,
    CADNT,
    CARFD,
    CACNT,
    Anomaly,
    Invoice,
    DOT
)
import json
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)


class DatabaseAnomalyScanner:
    """
    A class responsible for scanning the database for various types of anomalies.
    This includes duplicate checks, outlier detection, and data consistency validation.
    """

    BATCH_SIZE = 5000  # Optimal batch size for bulk operations

    # Mapping of model names to data source values
    DATA_SOURCE_MAPPING = {
        'Journal Ventes': 'journal_ventes',
        'Etat Facture': 'etat_facture',
        'Parc Corporate': 'parc_corporate',
        'Creances NGBSS': 'creances_ngbss',
        'CA Periodique': 'ca_periodique',
        'CA Non Periodique': 'ca_non_periodique',
        'CA DNT': 'ca_dnt',
        'CA RFD': 'ca_rfd',
        'CA CNT': 'ca_cnt'
    }

    def __init__(self):
        """Initialize the scanner with default parameters"""
        self.anomalies = []
        self.invoice = None
        # Get the number of CPU cores for optimal thread count
        self.max_workers = multiprocessing.cpu_count() * 2
        self.anomaly_batch = []  # Buffer for batch creation

    def scan_all(self, invoice=None):
        """
        Run all available anomaly scans in parallel using ThreadPoolExecutor
        Args:
            invoice: Optional invoice to limit the scan to
        Returns:
            List of detected anomalies
        """
        self.invoice = invoice

        # Define scan tasks with their methods and descriptions
        scan_tasks = [
            (self.scan_empty_cells, "Scanning for empty cells"),
            (self.scan_creances_ngbss_empty_cells,
             "Scanning for empty cells in Créance NGBSS"),
            (self.scan_ca_periodique_empty_cells,
             "Scanning for empty cells in CA Périodique"),
            (self.scan_ca_non_periodique_empty_cells,
             "Scanning for empty cells in CA Non Périodique"),
            (self.scan_ca_cnt_empty_cells,
             "Scanning for empty cells in CA CNT (Annulation)"),
            (self.scan_ca_dnt_empty_cells,
             "Scanning for empty cells in CA DNT (Ajustement)"),
            (self.scan_ca_rfd_empty_cells,
             "Scanning for empty cells in CA RFD (Remboursement)"),
            (self.scan_journal_ventes_duplicates,
             "Scanning for Journal Ventes duplicates"),
            (self.scan_revenue_outliers, "Scanning for revenue outliers"),
            (self.scan_journal_etat_mismatches,
             "Scanning for Journal-Etat mismatches"),
            (self.scan_zero_values, "Scanning for zero values"),
            (self.scan_temporal_patterns, "Scanning for temporal patterns"),
            (self.scan_collection_outliers, "Scanning for collection outliers"),
            (self.scan_etat_facture_duplicates,
             "Scanning for Etat Facture duplicates"),
            (self.scan_dot_field_validity, "Scanning DOT field validity")
        ]

        # Use ThreadPoolExecutor for parallel execution
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all tasks
            future_to_task = {executor.submit(task_method): description
                              for task_method, description in scan_tasks}

            # Process completed tasks
            for future in concurrent.futures.as_completed(future_to_task):
                task_description = future_to_task[future]
                try:
                    future.result()
                    print(f"✓ Completed: {task_description}")
                except Exception as e:
                    print(f"✗ Error in {task_description}: {str(e)}")

        # Create any remaining buffered anomalies
        if self.anomaly_batch:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

        return self.anomalies

    def scan_empty_cells(self):
        """Detect empty cells in critical fields using batch processing"""
        anomaly_data = []

        # Process JournalVentes in chunks
        queryset = JournalVentes.objects.filter(revenue_amount__isnull=True)
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        # Process in chunks to avoid memory issues
        while True:
            chunk = list(queryset[:self.BATCH_SIZE])
            if not chunk:
                break

            for record in chunk:
                anomaly_data.append({
                    'invoice': record.invoice,
                    'type': 'empty_field',
                    'description': f"Empty revenue amount in Journal Ventes record {record.id}",
                    'data': {'record_id': record.id},
                    'data_source': 'journal_ventes'
                })

            if len(anomaly_data) >= self.BATCH_SIZE:
                self._batch_create_anomalies(anomaly_data)
                anomaly_data = []

            queryset = queryset.exclude(id__in=[r.id for r in chunk])

        # Process EtatFacture in chunks
        queryset = EtatFacture.objects.filter(total_amount__isnull=True)
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        while True:
            chunk = list(queryset[:self.BATCH_SIZE])
            if not chunk:
                break

            for record in chunk:
                anomaly_data.append({
                    'invoice': record.invoice,
                    'type': 'empty_field',
                    'description': f"Empty total amount in Etat Facture record {record.id}",
                    'data': {'record_id': record.id},
                    'data_source': 'etat_facture'
                })

            if len(anomaly_data) >= self.BATCH_SIZE:
                self._batch_create_anomalies(anomaly_data)
                anomaly_data = []

            queryset = queryset.exclude(id__in=[r.id for r in chunk])

        # Create any remaining anomalies
        if anomaly_data:
            self._batch_create_anomalies(anomaly_data)

    def scan_creances_ngbss_empty_cells(self):
        """Detect empty cells in Créance NGBSS critical fields"""
        anomaly_data = []

        # Important fields that should not be empty
        critical_fields = [
            ('dot', 'DOT'),
            ('actel', 'ACTEL'),
            ('month', 'Month'),
            ('year', 'Year'),
            ('product', 'Product'),
            ('customer_lev1', 'Customer Level 1'),
            ('customer_lev2', 'Customer Level 2'),
            ('customer_lev3', 'Customer Level 3'),
            ('invoice_amount', 'Invoice Amount'),
            ('open_amount', 'Open Amount'),
            ('tax_amount', 'Tax Amount'),
            ('creance_brut', 'Creance Brut')
        ]

        # Process CreancesNGBSS in chunks
        base_queryset = CreancesNGBSS.objects.all()
        if self.invoice:
            base_queryset = base_queryset.filter(invoice=self.invoice)

        for field_name, field_display in critical_fields:
            # For each field, check for null or empty values
            field_lookup = f"{field_name}__isnull"
            empty_lookup = Q(**{field_lookup: True})

            # For string fields, also check for empty strings
            if field_name in ['dot_code', 'actel', 'month', 'year', 'subscriber_status',
                              'product', 'customer_lev1', 'customer_lev2', 'customer_lev3']:
                empty_lookup |= Q(**{field_name: ''})

            queryset = base_queryset.filter(empty_lookup)

            while True:
                chunk = list(queryset[:self.BATCH_SIZE])
                if not chunk:
                    break

                for record in chunk:
                    anomaly_data.append({
                        'invoice': record.invoice,
                        'type': 'empty_field',
                        'description': f"Empty {field_display} in Créance NGBSS record {record.id}",
                        'data': {
                            'record_id': record.id,
                            'field': field_name
                        },
                        'data_source': 'creances_ngbss'
                    })

                if len(anomaly_data) >= self.BATCH_SIZE:
                    self._batch_create_anomalies(anomaly_data)
                    anomaly_data = []

                queryset = queryset.exclude(id__in=[r.id for r in chunk])

        # Create any remaining anomalies
        if anomaly_data:
            self._batch_create_anomalies(anomaly_data)

    def scan_ca_periodique_empty_cells(self):
        """Detect empty cells in CA périodique (NGBSS) critical fields"""
        anomaly_data = []

        # Important fields that should not be empty
        critical_fields = [
            ('dot', 'DOT'),
            ('month', 'Month'),
            ('year', 'Year'),
            ('product', 'Product'),
            ('amount', 'Amount'),
            ('client', 'Client')
        ]

        # Process CAPeriodique in chunks
        base_queryset = CAPeriodique.objects.all()
        if self.invoice:
            base_queryset = base_queryset.filter(invoice=self.invoice)

        # Filter critical fields to only include those that exist in the model
        model_fields = [f.name for f in CAPeriodique._meta.get_fields()]
        valid_critical_fields = [(field, display) for field, display in critical_fields
                                 if field in model_fields]

        for field_name, field_display in valid_critical_fields:
            # For each field, check for null or empty values
            field_lookup = f"{field_name}__isnull"
            empty_lookup = Q(**{field_lookup: True})

            # For string fields, also check for empty strings
            if field_name in ['month', 'year', 'product', 'client']:
                empty_lookup |= Q(**{field_name: ''})

            queryset = base_queryset.filter(empty_lookup)

            while True:
                chunk = list(queryset[:self.BATCH_SIZE])
                if not chunk:
                    break

                for record in chunk:
                    anomaly_data.append({
                        'invoice': record.invoice,
                        'type': 'empty_field',
                        'description': f"Empty {field_display} in CA Périodique record {record.id}",
                        'data': {
                            'record_id': record.id,
                            'field': field_name
                        },
                        'data_source': 'ca_periodique'
                    })

                if len(anomaly_data) >= self.BATCH_SIZE:
                    self._batch_create_anomalies(anomaly_data)
                    anomaly_data = []

                queryset = queryset.exclude(id__in=[r.id for r in chunk])

        # Create any remaining anomalies
        if anomaly_data:
            self._batch_create_anomalies(anomaly_data)

    def scan_ca_non_periodique_empty_cells(self):
        """Detect empty cells in CA non périodique (NGBSS) critical fields"""
        anomaly_data = []

        # Important fields that should not be empty
        critical_fields = [
            ('dot', 'DOT'),
            ('month', 'Month'),
            ('year', 'Year'),
            ('product', 'Product'),
            ('amount', 'Amount'),
            ('client', 'Client')
        ]

        # Process CANonPeriodique in chunks
        base_queryset = CANonPeriodique.objects.all()
        if self.invoice:
            base_queryset = base_queryset.filter(invoice=self.invoice)

        # Filter critical fields to only include those that exist in the model
        model_fields = [f.name for f in CANonPeriodique._meta.get_fields()]
        valid_critical_fields = [(field, display) for field, display in critical_fields
                                 if field in model_fields]

        for field_name, field_display in valid_critical_fields:
            # For each field, check for null or empty values
            field_lookup = f"{field_name}__isnull"
            empty_lookup = Q(**{field_lookup: True})

            # For string fields, also check for empty strings
            if field_name in ['month', 'year', 'product', 'client']:
                empty_lookup |= Q(**{field_name: ''})

            queryset = base_queryset.filter(empty_lookup)

            while True:
                chunk = list(queryset[:self.BATCH_SIZE])
                if not chunk:
                    break

                for record in chunk:
                    anomaly_data.append({
                        'invoice': record.invoice,
                        'type': 'empty_field',
                        'description': f"Empty {field_display} in CA Non Périodique record {record.id}",
                        'data': {
                            'record_id': record.id,
                            'field': field_name
                        },
                        'data_source': 'ca_non_periodique'
                    })

                if len(anomaly_data) >= self.BATCH_SIZE:
                    self._batch_create_anomalies(anomaly_data)
                    anomaly_data = []

                queryset = queryset.exclude(id__in=[r.id for r in chunk])

        # Create any remaining anomalies
        if anomaly_data:
            self._batch_create_anomalies(anomaly_data)

    def scan_ca_cnt_empty_cells(self):
        """Detect empty cells in CA CNT (Annulation NGBSS) critical fields"""
        anomaly_data = []

        # Important fields that should not be empty
        critical_fields = [
            ('dot', 'DOT'),
            ('month', 'Month'),
            ('year', 'Year'),
            ('amount', 'Amount'),
            ('client', 'Client'),
            ('invoice_number', 'Invoice Number')
        ]

        # Process CACNT in chunks
        base_queryset = CACNT.objects.all()
        if self.invoice:
            base_queryset = base_queryset.filter(invoice=self.invoice)

        # Filter critical fields to only include those that exist in the model
        model_fields = [f.name for f in CACNT._meta.get_fields()]
        valid_critical_fields = [(field, display) for field, display in critical_fields
                                 if field in model_fields]

        for field_name, field_display in valid_critical_fields:
            # For each field, check for null or empty values
            field_lookup = f"{field_name}__isnull"
            empty_lookup = Q(**{field_lookup: True})

            # For string fields, also check for empty strings
            if field_name in ['month', 'year', 'client', 'invoice_number']:
                empty_lookup |= Q(**{field_name: ''})

            queryset = base_queryset.filter(empty_lookup)

            while True:
                chunk = list(queryset[:self.BATCH_SIZE])
                if not chunk:
                    break

                for record in chunk:
                    anomaly_data.append({
                        'invoice': record.invoice,
                        'type': 'empty_field',
                        'description': f"Empty {field_display} in CA CNT (Annulation) record {record.id}",
                        'data': {
                            'record_id': record.id,
                            'field': field_name
                        },
                        'data_source': 'ca_cnt'
                    })

                if len(anomaly_data) >= self.BATCH_SIZE:
                    self._batch_create_anomalies(anomaly_data)
                    anomaly_data = []

                queryset = queryset.exclude(id__in=[r.id for r in chunk])

        # Create any remaining anomalies
        if anomaly_data:
            self._batch_create_anomalies(anomaly_data)

    def scan_ca_dnt_empty_cells(self):
        """Detect empty cells in CA DNT (Ajustement NGBSS) critical fields"""
        anomaly_data = []

        # Important fields that should not be empty
        critical_fields = [
            ('dot', 'DOT'),
            ('month', 'Month'),
            ('year', 'Year'),
            ('amount', 'Amount'),
            ('client', 'Client'),
            ('invoice_number', 'Invoice Number')
        ]

        # Process CADNT in chunks
        base_queryset = CADNT.objects.all()
        if self.invoice:
            base_queryset = base_queryset.filter(invoice=self.invoice)

        # Filter critical fields to only include those that exist in the model
        model_fields = [f.name for f in CADNT._meta.get_fields()]
        valid_critical_fields = [(field, display) for field, display in critical_fields
                                 if field in model_fields]

        for field_name, field_display in valid_critical_fields:
            # For each field, check for null or empty values
            field_lookup = f"{field_name}__isnull"
            empty_lookup = Q(**{field_lookup: True})

            # For string fields, also check for empty strings
            if field_name in ['month', 'year', 'client', 'invoice_number']:
                empty_lookup |= Q(**{field_name: ''})

            queryset = base_queryset.filter(empty_lookup)

            while True:
                chunk = list(queryset[:self.BATCH_SIZE])
                if not chunk:
                    break

                for record in chunk:
                    anomaly_data.append({
                        'invoice': record.invoice,
                        'type': 'empty_field',
                        'description': f"Empty {field_display} in CA DNT (Ajustement) record {record.id}",
                        'data': {
                            'record_id': record.id,
                            'field': field_name
                        },
                        'data_source': 'ca_dnt'
                    })

                if len(anomaly_data) >= self.BATCH_SIZE:
                    self._batch_create_anomalies(anomaly_data)
                    anomaly_data = []

                queryset = queryset.exclude(id__in=[r.id for r in chunk])

        # Create any remaining anomalies
        if anomaly_data:
            self._batch_create_anomalies(anomaly_data)

    def scan_ca_rfd_empty_cells(self):
        """Detect empty cells in CA RFD (Remboursement NGBSS) as outliers"""
        anomaly_data = []

        # Important fields that should not be empty
        critical_fields = [
            ('dot', 'DOT'),
            ('month', 'Month'),
            ('year', 'Year'),
            ('amount', 'Amount'),
            ('client', 'Client'),
            ('invoice_number', 'Invoice Number')
        ]

        # Process CARFD in chunks
        base_queryset = CARFD.objects.all()
        if self.invoice:
            base_queryset = base_queryset.filter(invoice=self.invoice)

        # Filter critical fields to only include those that exist in the model
        model_fields = [f.name for f in CARFD._meta.get_fields()]
        valid_critical_fields = [(field, display) for field, display in critical_fields
                                 if field in model_fields]

        for field_name, field_display in valid_critical_fields:
            # For each field, check for null or empty values
            field_lookup = f"{field_name}__isnull"
            empty_lookup = Q(**{field_lookup: True})

            # For string fields, also check for empty strings
            if field_name in ['month', 'year', 'client', 'invoice_number']:
                empty_lookup |= Q(**{field_name: ''})

            queryset = base_queryset.filter(empty_lookup)

            while True:
                chunk = list(queryset[:self.BATCH_SIZE])
                if not chunk:
                    break

                for record in chunk:
                    # For CA RFD, empty cells are treated as outliers as per requirement
                    anomaly_data.append({
                        'invoice': record.invoice,
                        'type': 'outlier',  # Using outlier type instead of empty_field
                        'description': f"Empty {field_display} detected as outlier in CA RFD (Remboursement) record {record.id}",
                        'data': {
                            'record_id': record.id,
                            'field': field_name
                        },
                        'data_source': 'ca_rfd'
                    })

                if len(anomaly_data) >= self.BATCH_SIZE:
                    self._batch_create_anomalies(anomaly_data)
                    anomaly_data = []

                queryset = queryset.exclude(id__in=[r.id for r in chunk])

        # Create any remaining anomalies
        if anomaly_data:
            self._batch_create_anomalies(anomaly_data)

    def scan_journal_ventes_duplicates(self):
        """Detect duplicate invoice numbers in Journal Ventes"""
        # Find records with the same invoice_number but different data
        queryset = JournalVentes.objects.all()
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        duplicates = queryset.values('invoice_number', 'organization') \
            .annotate(count=Count('id')) \
            .filter(count__gt=1)

        for dup in duplicates:
            records = JournalVentes.objects.filter(
                invoice_number=dup['invoice_number'],
                organization=dup['organization']
            )

            # Check if these are true duplicates (different data)
            if self._has_different_values(records, ['revenue_amount', 'client']):
                self._create_anomaly(
                    records[0].invoice,
                    'duplicate_data',
                    f"Duplicate invoice number {dup['invoice_number']} in {dup['organization']} with different values",
                    {
                        'invoice_number': dup['invoice_number'],
                        'organization': dup['organization'],
                        'record_ids': list(records.values_list('id', flat=True))
                    },
                    data_source='journal_ventes'
                )

    def scan_revenue_outliers(self):
        """Run only the revenue outliers scan and return detected anomalies"""
        self.anomalies = []
        self.anomaly_batch = []

        # Implementation from scan_revenue_outliers method
        queryset = JournalVentes.objects.all()
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        organizations = queryset.values_list(
            'organization', flat=True).distinct()

        for org in organizations:
            # Get revenue data for this organization
            revenues = queryset.filter(organization=org).values_list(
                'revenue_amount', flat=True)

            if len(revenues) < 5:  # Skip if not enough data points
                continue

            # Convert all values to float for calculations
            float_revenues = [float(x) for x in revenues if x is not None]
            if not float_revenues:  # Skip if no valid values
                continue

            # Calculate mean and standard deviation
            mean = sum(float_revenues) / len(float_revenues)
            variance = sum(
                (x - mean) ** 2 for x in float_revenues) / len(float_revenues)
            std_dev = variance ** 0.5

            # Define threshold (e.g., 3 standard deviations)
            threshold = mean + (3 * std_dev)

            # Find outliers
            outliers = queryset.filter(
                organization=org,
                revenue_amount__gt=threshold
            )

            for outlier in outliers:
                # Convert to float for calculation
                revenue_amount = float(outlier.revenue_amount)
                z_score = (revenue_amount - mean) / \
                    std_dev if std_dev > 0 else 0

                self._create_anomaly(
                    outlier.invoice,
                    'outlier',
                    f"Revenue outlier detected: {outlier.revenue_amount} (org mean: {mean:.2f})",
                    {
                        'record_id': outlier.id,
                        'invoice_number': outlier.invoice_number,
                        'organization': outlier.organization,
                        'revenue_amount': revenue_amount,
                        'mean_revenue': mean,
                        'std_dev': std_dev,
                        'z_score': z_score
                    },
                    data_source='journal_ventes'
                )

        # Create any remaining buffered anomalies
        if self.anomaly_batch:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

        return self.anomalies

    def scan_collection_outliers(self):
        """Run only the collection outliers scan and return detected anomalies"""
        self.anomalies = []
        self.anomaly_batch = []

        # Implementation from scan_collection_outliers method
        queryset = EtatFacture.objects.all()
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        organizations = queryset.values_list(
            'organization', flat=True).distinct()

        for org in organizations:
            # Get collection data for this organization
            collections = queryset.filter(
                organization=org).values_list('total_amount', flat=True)

            if len(collections) < 5:  # Skip if not enough data points
                continue

            # Convert all values to float for calculations
            float_collections = [float(x)
                                 for x in collections if x is not None]
            if not float_collections:  # Skip if no valid values
                continue

            # Calculate mean and standard deviation
            mean = sum(float_collections) / len(float_collections)
            variance = sum(
                (x - mean) ** 2 for x in float_collections) / len(float_collections)
            std_dev = variance ** 0.5

            # Define threshold (e.g., 3 standard deviations)
            threshold = mean + (3 * std_dev)

            # Find outliers
            outliers = queryset.filter(
                organization=org,
                total_amount__gt=threshold
            )

            for outlier in outliers:
                # Convert to float for calculation
                total_amount = float(outlier.total_amount)
                z_score = (total_amount - mean) / std_dev if std_dev > 0 else 0

                self._create_anomaly(
                    outlier.invoice,
                    'outlier',
                    f"Collection outlier detected: {outlier.total_amount} (org mean: {mean:.2f})",
                    {
                        'record_id': outlier.id,
                        'invoice_number': outlier.invoice_number,
                        'organization': outlier.organization,
                        'total_amount': total_amount,
                        'mean_collection': mean,
                        'std_dev': std_dev,
                        'z_score': z_score
                    },
                    data_source='etat_facture'
                )

        # Create any remaining buffered anomalies
        if self.anomaly_batch:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

        return self.anomalies

    def scan_temporal_patterns(self):
        """Run only the temporal patterns scan and return detected anomalies"""
        self.anomalies = []
        self.anomaly_batch = []

        # Implementation from scan_temporal_patterns method
        queryset = JournalVentes.objects.all()
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        organizations = queryset.values_list(
            'organization', flat=True).distinct()

        for org in organizations:
            # Get monthly revenue totals
            monthly_revenue = queryset.filter(organization=org) \
                .values('invoice_date__year', 'invoice_date__month') \
                .annotate(total_revenue=Sum('revenue_amount')) \
                .order_by('invoice_date__year', 'invoice_date__month')

            if len(monthly_revenue) < 3:  # Skip if not enough data points
                continue

            # Detect significant drops in revenue
            for i in range(1, len(monthly_revenue)):
                prev_month = monthly_revenue[i-1]
                curr_month = monthly_revenue[i]

                prev_revenue = float(prev_month['total_revenue'])
                curr_revenue = float(curr_month['total_revenue'])

                # If revenue dropped by more than 50%
                if curr_revenue < prev_revenue * 0.5:
                    self._create_anomaly(
                        None,  # No specific invoice
                        'temporal_pattern',
                        f"Significant revenue drop detected for {org}",
                        {
                            'organization': org,
                            'year': curr_month['invoice_date__year'],
                            'month': curr_month['invoice_date__month'],
                            'previous_revenue': prev_revenue,
                            'current_revenue': curr_revenue,
                            'drop_percentage': ((prev_revenue - curr_revenue) / prev_revenue) * 100
                        },
                        data_source='journal_ventes'
                    )

        # Create any remaining buffered anomalies
        if self.anomaly_batch:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

        return self.anomalies

    def scan_zero_values(self):
        """Run only the zero values scan and return detected anomalies"""
        self.anomalies = []
        self.anomaly_batch = []

        # Implementation from scan_zero_values method
        # Check for zero revenue in Journal Ventes
        queryset = JournalVentes.objects.filter(revenue_amount=0)
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        for record in queryset:
            self._create_anomaly(
                record.invoice,
                'zero_value',
                f"Zero revenue amount found in Journal Ventes for invoice {record.invoice_number}",
                {
                    'record_id': record.id,
                    'invoice_number': record.invoice_number,
                    'organization': record.organization
                },
                data_source='journal_ventes'
            )

        # Check for zero collection in Etat Facture
        queryset = EtatFacture.objects.filter(total_amount=0)
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        for record in queryset:
            self._create_anomaly(
                record.invoice,
                'zero_value',
                f"Zero total amount found in Etat Facture for invoice {record.invoice_number}",
                {
                    'record_id': record.id,
                    'invoice_number': record.invoice_number,
                    'organization': record.organization
                },
                data_source='etat_facture'
            )

        # Create any remaining buffered anomalies
        if self.anomaly_batch:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

        return self.anomalies

    def scan_journal_etat_mismatches(self):
        """Detect mismatches between Journal Ventes and Etat Facture"""
        # Get all invoice numbers from both tables
        queryset_journal = JournalVentes.objects.all()
        queryset_etat = EtatFacture.objects.all()

        if self.invoice:
            queryset_journal = queryset_journal.filter(invoice=self.invoice)
            queryset_etat = queryset_etat.filter(invoice=self.invoice)

        journal_invoices = set(
            queryset_journal.values_list('invoice_number', flat=True))
        etat_invoices = set(queryset_etat.values_list(
            'invoice_number', flat=True))

        # Find invoices that appear in one table but not the other
        missing_in_etat = journal_invoices - etat_invoices
        missing_in_journal = etat_invoices - journal_invoices

        # Create anomalies for missing records
        for invoice_number in missing_in_etat:
            # Use filter() instead of get() to handle multiple records with the same invoice_number
            journal_records = queryset_journal.filter(
                invoice_number=invoice_number)
            # Use the first record for the anomaly
            if journal_records.exists():
                journal_record = journal_records.first()
                self._create_anomaly(
                    journal_record.invoice,
                    'missing_record',
                    f"Invoice {invoice_number} exists in Journal Ventes but not in Etat Facture",
                    {'invoice_number': invoice_number},
                    data_source='journal_ventes'
                )

        for invoice_number in missing_in_journal:
            # Use filter() instead of get() to handle multiple records with the same invoice_number
            etat_records = queryset_etat.filter(invoice_number=invoice_number)
            # Use the first record for the anomaly
            if etat_records.exists():
                etat_record = etat_records.first()
                self._create_anomaly(
                    etat_record.invoice,
                    'missing_record',
                    f"Invoice {invoice_number} exists in Etat Facture but not in Journal Ventes",
                    {'invoice_number': invoice_number},
                    data_source='etat_facture'
                )

    def scan_etat_facture_duplicates(self):
        """Detect duplicate invoice numbers in Etat Facture"""
        # Find records with the same invoice_number but different data
        queryset = EtatFacture.objects.all()
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        duplicates = queryset.values('invoice_number', 'organization') \
            .annotate(count=Count('id')) \
            .filter(count__gt=1)

        for dup in duplicates:
            records = EtatFacture.objects.filter(
                invoice_number=dup['invoice_number'],
                organization=dup['organization']
            )

            # Check if these are true duplicates (different data)
            if self._has_different_values(records, ['total_amount', 'client']):
                self._create_anomaly(
                    records[0].invoice,
                    'duplicate_data',
                    f"Duplicate invoice number {dup['invoice_number']} in {dup['organization']} with different values",
                    {
                        'invoice_number': dup['invoice_number'],
                        'organization': dup['organization'],
                        'record_ids': list(records.values_list('id', flat=True))
                    },
                    data_source='etat_facture'
                )

    def scan_dot_field_validity(self):
        """Check validity of DOT fields across all models with DOT relationships"""
        # Models that have DOT relationships
        models_to_check = [
            (ParcCorporate, 'Parc Corporate'),
            (CreancesNGBSS, 'Creances NGBSS'),
            (CAPeriodique, 'CA Periodique'),
            (CANonPeriodique, 'CA Non Periodique'),
            (CADNT, 'CA DNT'),
            (CARFD, 'CA RFD'),
            (CACNT, 'CA CNT')
        ]

        # Get valid DOTs from the DOT model
        valid_dots = set(DOT.objects.filter(
            is_active=True).values_list('id', flat=True))

        for model, model_name in models_to_check:
            queryset = model.objects.all()
            if self.invoice:
                queryset = queryset.filter(invoice=self.invoice)

            try:
                # Check records with invalid DOT relationships
                invalid_records = queryset.filter(
                    Q(dot__isnull=True) |  # Missing DOT relationship
                    ~Q(dot__id__in=valid_dots)  # DOT not in valid set
                )

                for record in invalid_records:
                    dot_value = record.dot.id if record.dot else None
                    dot_code = record.dot_code if hasattr(
                        record, 'dot_code') else None

                    description = "Missing DOT relationship" if dot_value is None else f"Invalid DOT value: {dot_value}"
                    if dot_code:
                        description += f" (code: {dot_code})"

                    self._create_anomaly(
                        record.invoice,
                        'invalid_dot',
                        f"{description} in {model_name}",
                        {
                            'model': model_name,
                            'record_id': record.id,
                            'dot_id': dot_value,
                            'dot_code': dot_code
                        },
                        data_source=self.DATA_SOURCE_MAPPING.get(model_name)
                    )

                # Check for mismatches between dot and dot_code
                if hasattr(model, 'dot_code'):
                    mismatches = queryset.filter(
                        ~Q(dot_code=None) & ~Q(dot=None)
                    ).exclude(dot_code=F('dot__code'))

                    for record in mismatches:
                        self._create_anomaly(
                            record.invoice,
                            'dot_mismatch',
                            f"DOT code mismatch in {model_name}: code '{record.dot_code}' doesn't match DOT relationship",
                            {
                                'model': model_name,
                                'record_id': record.id,
                                'dot_id': record.dot.id if record.dot else None,
                                'dot_code': record.dot_code,
                                'dot_actual_code': record.dot.code if record.dot else None
                            },
                            data_source=self.DATA_SOURCE_MAPPING.get(
                                model_name)
                        )

            except FieldError as e:
                print(f"Error checking DOT fields for {model_name}: {str(e)}")
                continue
            except Exception as e:
                print(
                    f"Unexpected error checking DOT fields for {model_name}: {str(e)}")
                continue

    def _has_different_values(self, queryset, fields):
        """Helper method to check if a queryset has different values for specified fields"""
        values = set()
        for record in queryset:
            value_tuple = tuple(getattr(record, field) for field in fields)
            values.add(value_tuple)
        return len(values) > 1

    @transaction.atomic
    def _batch_create_anomalies(self, anomaly_data_list):
        """Create anomalies in batch for better performance"""
        try:
            if not anomaly_data_list:
                return []

            # Clean any problematic values in the data
            clean_data_list = []
            for item in anomaly_data_list:
                try:
                    # Ensure invoice exists
                    if 'invoice' not in item or item['invoice'] is None:
                        # Get default invoice if one is set in scanner
                        if self.invoice:
                            item['invoice'] = self.invoice
                        else:
                            # Find the most recent invoice as a fallback
                            try:
                                item['invoice'] = Invoice.objects.order_by(
                                    '-upload_date').first()
                            except Exception as e:
                                logger.error(
                                    f"Failed to get fallback invoice: {str(e)}")
                                # Skip this item if we can't find a valid invoice
                                continue

                    # Ensure data is sanitized
                    if 'data' in item and item['data'] is not None:
                        # Make sure any record_id fields are not empty strings
                        if 'record_id' in item['data'] and item['data']['record_id'] == '':
                            item['data']['record_id'] = None

                        # Check for any id fields that might be empty strings
                        for key, value in list(item['data'].items()):
                            if key.endswith('_id') and value == '':
                                item['data'][key] = None
                            # Remove any None keys to prevent serialization issues
                            if value is None and key != 'record_id':
                                item['data'].pop(key, None)

                    # Ensure all required fields are present
                    if all(key in item for key in ['invoice', 'type', 'description']):
                        clean_data_list.append(item)
                    else:
                        logger.warning(
                            f"Skipping anomaly with missing required fields: {item}")
                except Exception as e:
                    logger.error(f"Error sanitizing anomaly data: {str(e)}")
                    # Skip the problematic item

            anomalies = []
            for data in clean_data_list:
                try:
                    anomaly = Anomaly(
                        invoice=data['invoice'],
                        type=data['type'],
                        description=data['description'],
                        data=data.get('data', {}),
                        status='open',  # Ensure a default status is set
                        data_source=data.get('data_source', '')
                    )
                    anomalies.append(anomaly)
                except Exception as e:
                    logger.error(f"Error creating anomaly object: {str(e)}")
                    # Continue with the rest

            if anomalies:
                try:
                    created = Anomaly.objects.bulk_create(anomalies)
                    self.anomalies.extend(created)
                    return created
                except Exception as e:
                    logger.error(f"Error in bulk_create: {str(e)}")
            return []

        except Exception as e:
            logger.error(f"Error in batch creating anomalies: {str(e)}")
            return []

    def _create_anomaly(self, invoice, anomaly_type, description, data, data_source=None):
        """
        Create an anomaly with the specified attributes
        - If we have less than BATCH_SIZE anomalies, add to batch for later creation
        - If batch size reached, create all anomalies in batch
        """
        # Ensure that any ID fields in data are valid (not empty strings)
        if data and isinstance(data, dict):
            safe_data = {}
            for key, value in data.items():
                # Handle IDs which should be numbers, not empty strings
                if key.endswith('_id') and value == '':
                    safe_data[key] = None
                else:
                    safe_data[key] = value
            data = safe_data

            # Special handling for record_id
            if 'record_id' in data and data['record_id'] == '':
                data['record_id'] = None

        # Add to batch
        self.anomaly_batch.append({
            'invoice': invoice,
            'type': anomaly_type,
            'description': description,
            'data': data,
            'data_source': data_source
        })

        # Create if batch size reached
        if len(self.anomaly_batch) >= self.BATCH_SIZE:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

    def _safe_get_id(self, record, id_field='id'):
        """
        Safely retrieve an ID field from a record, ensuring it's not an empty string
        Args:
            record: The record to get the ID from
            id_field: The field name to retrieve (default: 'id')
        Returns:
            The ID value or None if it's an empty string or not present
        """
        try:
            value = getattr(record, id_field, None)
            if value == '':
                return None
            if value is not None:
                # Try to convert to int if it's a string representing a number
                if isinstance(value, str) and value.isdigit():
                    return int(value)
            return value
        except (AttributeError, ValueError, TypeError) as e:
            logger.error(f"Error in _safe_get_id: {str(e)}")
            return None

    @transaction.atomic
    def delete_anomalies(self, filters=None, older_than=None, batch_size=1000):
        """
        Delete anomalies based on filters with batch processing
        Args:
            filters (dict): Dictionary of filters to apply (e.g., {'type': 'duplicate_data'})
            older_than (int): Delete anomalies older than specified days
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            int: Number of anomalies deleted
        """
        queryset = Anomaly.objects.all()
        total_deleted = 0

        # Apply filters if provided
        if filters:
            queryset = queryset.filter(**filters)

        # Apply age filter if provided
        if older_than:
            cutoff_date = timezone.now() - timedelta(days=older_than)
            queryset = queryset.filter(created_at__lt=cutoff_date)

        try:
            # Get total count for progress tracking
            total_count = queryset.count()
            if total_count == 0:
                return 0

            # Delete in batches
            while True:
                # Get IDs for the next batch
                batch_ids = list(queryset.values_list(
                    'id', flat=True)[:batch_size])
                if not batch_ids:
                    break

                # Delete the batch
                deleted_count = Anomaly.objects.filter(
                    id__in=batch_ids).delete()[0]
                total_deleted += deleted_count

                print(f"Deleted {total_deleted}/{total_count} anomalies...")

            print(f"Successfully deleted {total_deleted} anomalies")
            return total_deleted

        except Exception as e:
            print(f"Error during anomaly deletion: {str(e)}")
            raise

    @transaction.atomic
    def delete_anomalies_by_data_source(self, data_source, batch_size=1000):
        """
        Delete all anomalies for a specific data source
        Args:
            data_source (str): Data source to delete anomalies for
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            int: Number of anomalies deleted
        """
        return self.delete_anomalies(
            filters={'data_source': data_source},
            batch_size=batch_size
        )

    @transaction.atomic
    def delete_anomalies_by_type(self, anomaly_type, batch_size=1000):
        """
        Delete all anomalies of a specific type
        Args:
            anomaly_type (str): Type of anomalies to delete
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            int: Number of anomalies deleted
        """
        return self.delete_anomalies(
            filters={'type': anomaly_type},
            batch_size=batch_size
        )

    @transaction.atomic
    def delete_resolved_anomalies(self, older_than=None, batch_size=1000):
        """
        Delete resolved anomalies
        Args:
            older_than (int): Delete resolved anomalies older than specified days
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            int: Number of anomalies deleted
        """
        return self.delete_anomalies(
            filters={'status': 'resolved'},
            older_than=older_than,
            batch_size=batch_size
        )

    @transaction.atomic
    def delete_anomalies_by_invoice(self, invoice_id, batch_size=1000):
        """
        Delete all anomalies for a specific invoice
        Args:
            invoice_id: ID of the invoice to delete anomalies for
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            int: Number of anomalies deleted
        """
        return self.delete_anomalies(
            filters={'invoice_id': invoice_id},
            batch_size=batch_size
        )

    @transaction.atomic
    def cleanup_old_anomalies(self, days=30, batch_size=1000):
        """
        Delete anomalies older than specified number of days
        Args:
            days (int): Delete anomalies older than this many days
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            int: Number of anomalies deleted
        """
        return self.delete_anomalies(
            older_than=days,
            batch_size=batch_size
        )

    @transaction.atomic
    def wipe_all_anomalies(self, batch_size=5000):
        """
        Completely wipe all anomalies from the database
        Args:
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            int: Number of anomalies deleted
        """
        try:
            total_count = Anomaly.objects.count()
            if total_count == 0:
                print("No anomalies to delete")
                return 0

            print(f"Starting complete wipe of {total_count} anomalies...")
            deleted = self.delete_anomalies(batch_size=batch_size)
            print(
                f"Successfully wiped all {deleted} anomalies from the database")
            return deleted
        except Exception as e:
            print(f"Error during complete wipe: {str(e)}")
            raise

    @transaction.atomic
    def bulk_delete_by_sources(self, sources, batch_size=5000):
        """
        Delete anomalies for multiple data sources
        Args:
            sources (list): List of data source identifiers to delete
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            dict: Count of deleted anomalies per source
        """
        results = {}
        total_deleted = 0

        try:
            for source in sources:
                if source not in self.DATA_SOURCE_MAPPING.values():
                    print(
                        f"Warning: Invalid data source '{source}', skipping...")
                    continue

                print(f"Deleting anomalies for source: {source}")
                deleted = self.delete_anomalies_by_data_source(
                    source, batch_size)
                results[source] = deleted
                total_deleted += deleted

            print(f"\nBulk deletion complete:")
            for source, count in results.items():
                print(f"- {source}: {count} anomalies deleted")
            print(f"Total anomalies deleted: {total_deleted}")

            return results
        except Exception as e:
            print(f"Error during bulk source deletion: {str(e)}")
            raise

    @transaction.atomic
    def bulk_delete_by_types(self, types, batch_size=5000):
        """
        Delete anomalies for multiple anomaly types
        Args:
            types (list): List of anomaly types to delete
            batch_size (int): Number of anomalies to delete in each batch
        Returns:
            dict: Count of deleted anomalies per type
        """
        results = {}
        total_deleted = 0

        valid_types = [t[0] for t in Anomaly.ANOMALY_TYPES]

        try:
            for anomaly_type in types:
                if anomaly_type not in valid_types:
                    print(
                        f"Warning: Invalid anomaly type '{anomaly_type}', skipping...")
                    continue

                print(f"Deleting anomalies of type: {anomaly_type}")
                deleted = self.delete_anomalies_by_type(
                    anomaly_type, batch_size)
                results[anomaly_type] = deleted
                total_deleted += deleted

            print(f"\nBulk deletion complete:")
            for anomaly_type, count in results.items():
                print(f"- {anomaly_type}: {count} anomalies deleted")
            print(f"Total anomalies deleted: {total_deleted}")

            return results
        except Exception as e:
            print(f"Error during bulk type deletion: {str(e)}")
            raise

    def get_deletion_stats(self):
        """
        Get statistics about current anomalies for deletion planning
        Returns:
            dict: Statistics about anomalies by type and source
        """
        stats = {
            'total_count': Anomaly.objects.count(),
            'by_type': {},
            'by_source': {},
            'by_status': {},
            'age_distribution': {
                'last_24h': 0,
                'last_week': 0,
                'last_month': 0,
                'older': 0
            }
        }

        # Count by type
        type_counts = Anomaly.objects.values(
            'type').annotate(count=Count('id'))
        stats['by_type'] = {item['type']: item['count']
                            for item in type_counts}

        # Count by source
        source_counts = Anomaly.objects.values(
            'data_source').annotate(count=Count('id'))
        stats['by_source'] = {item['data_source']: item['count']
                              for item in source_counts}

        # Count by status
        status_counts = Anomaly.objects.values(
            'status').annotate(count=Count('id'))
        stats['by_status'] = {item['status']: item['count']
                              for item in status_counts}

        # Age distribution
        now = timezone.now()
        stats['age_distribution']['last_24h'] = Anomaly.objects.filter(
            created_at__gte=now - timedelta(days=1)).count()
        stats['age_distribution']['last_week'] = Anomaly.objects.filter(
            created_at__gte=now - timedelta(days=7)).count()
        stats['age_distribution']['last_month'] = Anomaly.objects.filter(
            created_at__gte=now - timedelta(days=30)).count()
        stats['age_distribution']['older'] = Anomaly.objects.filter(
            created_at__lt=now - timedelta(days=30)).count()

        return stats

    def get_statistics(self):
        """
        Get comprehensive statistics about anomalies
        Returns:
            dict: Detailed statistics about anomalies
        """
        stats = {
            'total_anomalies': Anomaly.objects.count(),
            'anomalies_by_type': self._get_anomalies_by_type(),
            'anomalies_by_source': self._get_anomalies_by_source(),
            'anomalies_by_status': self._get_anomalies_by_status(),
            'recent_trends': self._get_recent_trends(),
            'severity_distribution': self._get_severity_distribution(),
            'resolution_metrics': self._get_resolution_metrics(),
            'top_affected_organizations': self._get_top_affected_organizations(),
            'detection_rate': self._get_detection_rate()
        }
        return stats

    def _get_anomalies_by_type(self):
        """Get distribution of anomalies by type"""
        return dict(Anomaly.objects.values('type')
                    .annotate(count=Count('id'))
                    .values_list('type', 'count'))

    def _get_anomalies_by_source(self):
        """Get distribution of anomalies by data source"""
        return dict(Anomaly.objects.values('data_source')
                    .annotate(count=Count('id'))
                    .values_list('data_source', 'count'))

    def _get_anomalies_by_status(self):
        """Get distribution of anomalies by status"""
        return dict(Anomaly.objects.values('status')
                    .annotate(count=Count('id'))
                    .values_list('status', 'count'))

    def _get_recent_trends(self):
        """Get anomaly detection trends over time"""
        now = timezone.now()
        periods = {
            'last_24h': now - timedelta(days=1),
            'last_week': now - timedelta(weeks=1),
            'last_month': now - timedelta(days=30)
        }

        trends = {}
        for period_name, start_date in periods.items():
            trends[period_name] = {
                'total': Anomaly.objects.filter(created_at__gte=start_date).count(),
                'by_type': dict(
                    Anomaly.objects.filter(created_at__gte=start_date)
                    .values('type')
                    .annotate(count=Count('id'))
                    .values_list('type', 'count')
                )
            }
        return trends

    def _get_severity_distribution(self):
        """Get distribution of anomalies by severity"""
        return {
            'critical': Anomaly.objects.filter(Q(type='duplicate_data') | Q(type='invalid_dot')).count(),
            'high': Anomaly.objects.filter(Q(type='outlier') | Q(type='missing_record')).count(),
            'medium': Anomaly.objects.filter(Q(type='zero_value') | Q(type='temporal_pattern')).count(),
            'low': Anomaly.objects.filter(Q(type='empty_field')).count()
        }

    def _get_resolution_metrics(self):
        """Get metrics about anomaly resolution"""
        total = Anomaly.objects.count()
        resolved = Anomaly.objects.filter(status='resolved').count()
        pending = Anomaly.objects.filter(status='pending').count()

        return {
            'resolution_rate': (resolved / total * 100) if total > 0 else 0,
            'average_resolution_time': self._calculate_average_resolution_time(),
            'resolved_count': resolved,
            'pending_count': pending
        }

    def _calculate_average_resolution_time(self):
        """Calculate average time to resolve anomalies"""
        resolved_anomalies = Anomaly.objects.filter(
            status='resolved'
        )

        if not resolved_anomalies.exists():
            return None

        total_time = timedelta()
        count = 0

        for anomaly in resolved_anomalies:
            if anomaly.updated_at and anomaly.created_at:
                total_time += anomaly.updated_at - anomaly.created_at
                count += 1

        return (total_time / count).total_seconds() if count > 0 else None

    def _get_top_affected_organizations(self, limit=10):
        """Get organizations most affected by anomalies"""
        return list(Anomaly.objects.values('data__organization')
                    .annotate(count=Count('id'))
                    .order_by('-count')[:limit])

    def _get_detection_rate(self):
        """Calculate anomaly detection rate over time"""
        now = timezone.now()
        last_week = now - timedelta(weeks=1)

        daily_counts = (
            Anomaly.objects.filter(created_at__gte=last_week)
            .extra({'date': "date(created_at)"})
            .values('date')
            .annotate(count=Count('id'))
            .order_by('date')
        )

        return list(daily_counts)

    def get_kpis(self):
        """
        Get Key Performance Indicators for anomaly detection
        Returns:
            dict: KPI metrics
        """
        return {
            'total_anomalies': self._get_total_anomalies_kpi(),
            'resolution_rate': self._get_resolution_rate_kpi(),
            'critical_anomalies': self._get_critical_anomalies_kpi(),
            'data_quality_score': self._calculate_data_quality_score(),
            'trend_indicators': self._get_trend_indicators(),
            'efficiency_metrics': self._get_efficiency_metrics()
        }

    def _get_total_anomalies_kpi(self):
        """Get total anomalies KPI with trend"""
        now = timezone.now()
        current_period = Anomaly.objects.filter(
            created_at__gte=now - timedelta(days=30)).count()
        previous_period = Anomaly.objects.filter(
            created_at__gte=now - timedelta(days=60),
            created_at__lt=now - timedelta(days=30)
        ).count()

        trend_percentage = (
            ((current_period - previous_period) / previous_period * 100)
            if previous_period > 0 else 0
        )

        return {
            'current': current_period,
            'previous': previous_period,
            'trend': trend_percentage
        }

    def _get_resolution_rate_kpi(self):
        """Get resolution rate KPI"""
        total = Anomaly.objects.count()
        resolved = Anomaly.objects.filter(status='resolved').count()
        rate = (resolved / total * 100) if total > 0 else 0

        return {
            'rate': rate,
            'resolved': resolved,
            'total': total
        }

    def _get_critical_anomalies_kpi(self):
        """Get critical anomalies KPI"""
        critical_types = ['duplicate_data', 'invalid_dot']
        return {
            'count': Anomaly.objects.filter(type__in=critical_types).count(),
            'unresolved': Anomaly.objects.filter(
                type__in=critical_types,
                status='pending'
            ).count()
        }

    def _calculate_data_quality_score(self):
        """Calculate overall data quality score"""
        total_records = sum([
            JournalVentes.objects.count(),
            EtatFacture.objects.count(),
            ParcCorporate.objects.count()
        ])

        total_anomalies = Anomaly.objects.count()

        if total_records == 0:
            return 100

        score = 100 - (total_anomalies / total_records * 100)
        return max(0, min(100, score))

    def _get_trend_indicators(self):
        """Get trend indicators for different metrics"""
        now = timezone.now()
        week_ago = now - timedelta(weeks=1)

        return {
            'new_anomalies': Anomaly.objects.filter(
                created_at__gte=week_ago).count(),
            'resolved_anomalies': Anomaly.objects.filter(
                status='resolved',
                updated_at__gte=week_ago).count(),
            'critical_anomalies': Anomaly.objects.filter(
                created_at__gte=week_ago,
                type__in=['duplicate_data', 'invalid_dot']
            ).count()
        }

    def _get_efficiency_metrics(self):
        """Get efficiency metrics for anomaly detection"""
        return {
            'avg_resolution_time': self._calculate_average_resolution_time(),
            'detection_accuracy': self._calculate_detection_accuracy(),
            'false_positive_rate': self._calculate_false_positive_rate()
        }

    def _calculate_detection_accuracy(self):
        """Calculate detection accuracy based on resolved anomalies"""
        total_resolved = Anomaly.objects.filter(status='resolved').count()
        false_positives = Anomaly.objects.filter(
            status='resolved',
            resolution_notes__icontains='false positive'
        ).count()

        if total_resolved == 0:
            return 100

        return ((total_resolved - false_positives) / total_resolved * 100)

    def _calculate_false_positive_rate(self):
        """Calculate false positive rate"""
        total_resolved = Anomaly.objects.filter(status='resolved').count()
        false_positives = Anomaly.objects.filter(
            status='resolved',
            resolution_notes__icontains='false positive'
        ).count()

        if total_resolved == 0:
            return 0

        return (false_positives / total_resolved * 100)

    def get_anomalies_table(self, page=1, page_size=10, filters=None, sort_by=None):
        """
        Get paginated and filtered anomalies table
        Args:
            page (int): Page number
            page_size (int): Number of items per page
            filters (dict): Filter parameters
            sort_by (str): Field to sort by (prefix with '-' for descending)
        Returns:
            dict: Paginated anomalies with metadata
        """
        queryset = Anomaly.objects.all()

        # Apply filters
        if filters:
            if 'type' in filters:
                queryset = queryset.filter(type=filters['type'])
            if 'status' in filters:
                queryset = queryset.filter(status=filters['status'])
            if 'data_source' in filters:
                queryset = queryset.filter(data_source=filters['data_source'])
            if 'date_from' in filters:
                queryset = queryset.filter(
                    created_at__gte=filters['date_from'])
            if 'date_to' in filters:
                queryset = queryset.filter(created_at__lte=filters['date_to'])
            if 'organization' in filters:
                queryset = queryset.filter(
                    data__organization=filters['organization'])
            if 'severity' in filters:
                if filters['severity'] == 'critical':
                    queryset = queryset.filter(
                        Q(type='duplicate_data') | Q(type='invalid_dot'))
                elif filters['severity'] == 'high':
                    queryset = queryset.filter(
                        Q(type='outlier') | Q(type='missing_record'))
                elif filters['severity'] == 'medium':
                    queryset = queryset.filter(
                        Q(type='zero_value') | Q(type='temporal_pattern'))
                elif filters['severity'] == 'low':
                    queryset = queryset.filter(Q(type='empty_field'))

        # Apply sorting
        if sort_by:
            queryset = queryset.order_by(sort_by)
        else:
            queryset = queryset.order_by('-created_at')  # Default sort

        # Apply pagination
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)

        # Prepare response
        return {
            'total_count': paginator.count,
            'total_pages': paginator.num_pages,
            'current_page': page,
            'page_size': page_size,
            'results': [
                {
                    'id': item.id,
                    'type': item.type,
                    'description': item.description,
                    'status': item.status,
                    'data_source': item.data_source,
                    'created_at': item.created_at,
                    'resolved_at': item.resolved_at,
                    'data': item.data,
                    'severity': self._get_anomaly_severity(item.type)
                }
                for item in page_obj
            ]
        }

    def _get_anomaly_severity(self, anomaly_type):
        """Determine severity level for an anomaly type"""
        severity_mapping = {
            'duplicate_data': 'critical',
            'invalid_dot': 'critical',
            'outlier': 'high',
            'missing_record': 'high',
            'zero_value': 'medium',
            'temporal_pattern': 'medium',
            'empty_field': 'low'
        }
        return severity_mapping.get(anomaly_type, 'medium')

    def get_available_filters(self):
        """
        Get available filter options for the anomalies table
        Returns:
            dict: Available filter options
        """
        return {
            'types': list(set(Anomaly.objects.values_list('type', flat=True))),
            'statuses': list(set(Anomaly.objects.values_list('status', flat=True))),
            'data_sources': list(set(Anomaly.objects.values_list('data_source', flat=True))),
            'organizations': list(set(
                org for org in Anomaly.objects.values_list('data__organization', flat=True)
                if org is not None
            )),
            'severity_levels': ['critical', 'high', 'medium', 'low']
        }

    def scan_journal_ventes_anomalies(self):
        """Scan anomalies specifically for Journal des Ventes"""
        self.anomalies = []
        self.anomaly_batch = []

        # Check for duplicates
        self.scan_journal_ventes_duplicates()

        # Check for revenue outliers
        queryset = JournalVentes.objects.all()
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        organizations = queryset.values_list(
            'organization', flat=True).distinct()

        for org in organizations:
            revenues = queryset.filter(organization=org).values_list(
                'revenue_amount', flat=True)
            if len(revenues) < 5:
                continue

            float_revenues = [float(x) for x in revenues if x is not None]
            if not float_revenues:
                continue

            mean = sum(float_revenues) / len(float_revenues)
            variance = sum(
                (x - mean) ** 2 for x in float_revenues) / len(float_revenues)
            std_dev = variance ** 0.5
            threshold = mean + (3 * std_dev)

            outliers = queryset.filter(
                organization=org, revenue_amount__gt=threshold)
            for outlier in outliers:
                revenue_amount = float(outlier.revenue_amount)
                z_score = (revenue_amount - mean) / \
                    std_dev if std_dev > 0 else 0
                self._create_anomaly(
                    outlier.invoice,
                    'outlier',
                    f"Revenue outlier detected in Journal Ventes: {outlier.revenue_amount} (org mean: {mean:.2f})",
                    {
                        'record_id': outlier.id,
                        'invoice_number': outlier.invoice_number,
                        'organization': outlier.organization,
                        'revenue_amount': revenue_amount,
                        'mean_revenue': mean,
                        'std_dev': std_dev,
                        'z_score': z_score
                    },
                    data_source='journal_ventes'
                )

        # Check for zero values
        zero_values = queryset.filter(revenue_amount=0)
        for record in zero_values:
            self._create_anomaly(
                record.invoice,
                'zero_value',
                f"Zero revenue amount found in Journal Ventes for invoice {record.invoice_number}",
                {
                    'record_id': record.id,
                    'invoice_number': record.invoice_number,
                    'organization': record.organization
                },
                data_source='journal_ventes'
            )

        # Create any remaining buffered anomalies
        if self.anomaly_batch:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

        return self.anomalies

    def scan_etat_facture_anomalies(self):
        """Scan anomalies specifically for Etat de Facture"""
        self.anomalies = []
        self.anomaly_batch = []

        # Check for duplicates
        self.scan_etat_facture_duplicates()

        # Check for collection outliers
        queryset = EtatFacture.objects.all()
        if self.invoice:
            queryset = queryset.filter(invoice=self.invoice)

        organizations = queryset.values_list(
            'organization', flat=True).distinct()

        for org in organizations:
            collections = queryset.filter(
                organization=org).values_list('total_amount', flat=True)
            if len(collections) < 5:
                continue

            float_collections = [float(x)
                                 for x in collections if x is not None]
            if not float_collections:
                continue

            mean = sum(float_collections) / len(float_collections)
            variance = sum(
                (x - mean) ** 2 for x in float_collections) / len(float_collections)
            std_dev = variance ** 0.5
            threshold = mean + (3 * std_dev)

            outliers = queryset.filter(
                organization=org, total_amount__gt=threshold)
            for outlier in outliers:
                total_amount = float(outlier.total_amount)
                z_score = (total_amount - mean) / std_dev if std_dev > 0 else 0
                self._create_anomaly(
                    outlier.invoice,
                    'outlier',
                    f"Collection outlier detected in Etat Facture: {outlier.total_amount} (org mean: {mean:.2f})",
                    {
                        'record_id': outlier.id,
                        'invoice_number': outlier.invoice_number,
                        'organization': outlier.organization,
                        'total_amount': total_amount,
                        'mean_collection': mean,
                        'std_dev': std_dev,
                        'z_score': z_score
                    },
                    data_source='etat_facture'
                )

        # Check for zero values
        zero_values = queryset.filter(total_amount=0)
        for record in zero_values:
            self._create_anomaly(
                record.invoice,
                'zero_value',
                f"Zero total amount found in Etat Facture for invoice {record.invoice_number}",
                {
                    'record_id': record.id,
                    'invoice_number': record.invoice_number,
                    'organization': record.organization
                },
                data_source='etat_facture'
            )

        # Create any remaining buffered anomalies
        if self.anomaly_batch:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

        return self.anomalies

    def scan_parc_corporate_anomalies(self):
        """Scan anomalies specifically for Parc Corporate"""
        self.anomalies = []
        self.anomaly_batch = []

        try:
            queryset = ParcCorporate.objects.all()
            if self.invoice:
                queryset = queryset.filter(invoice=self.invoice)

            # Get model fields for validation
            model_fields = [f.name for f in ParcCorporate._meta.get_fields()]

            # Check DOT validity
            try:
                valid_dots = set(DOT.objects.filter(
                    is_active=True).values_list('id', flat=True))
                invalid_records = queryset.filter(
                    Q(dot__isnull=True) |  # Missing DOT relationship
                    ~Q(dot__id__in=valid_dots)  # DOT not in valid set
                )

                for record in invalid_records:
                    try:
                        dot_value = record.dot.id if record.dot else None
                        self._create_anomaly(
                            record.invoice,
                            'invalid_dot',
                            f"Invalid DOT value in Parc Corporate: {dot_value}",
                            {
                                'record_id': self._safe_get_id(record),
                                'dot_id': dot_value
                            },
                            data_source='parc_corporate'
                        )
                    except Exception as e:
                        logger.error(f"Error creating DOT anomaly: {str(e)}")
            except Exception as e:
                logger.error(f"Error checking DOT validity: {str(e)}")

            # Check for zero or negative values in amount fields
            amount_fields = [
                ('amount_pre_tax', 'Amount Pre-Tax'),
                ('total_amount', 'Total Amount'),
                ('tax_amount', 'Tax Amount')
            ]

            for field_name, field_display in amount_fields:
                if field_name in model_fields:
                    try:
                        # Check for null, zero, or negative values
                        invalid_records = queryset.filter(
                            Q(**{f"{field_name}__isnull": True}) |
                            Q(**{f"{field_name}__lte": 0})
                        )

                        for record in invalid_records:
                            try:
                                field_value = getattr(record, field_name, None)
                                description = "Empty " if field_value is None else "Zero or negative "
                                record_id = self._safe_get_id(record)
                                if record_id is not None:
                                    self._create_anomaly(
                                        record.invoice,
                                        'invalid_amount',
                                        f"{description}{field_display} in Parc Corporate record {record_id}: {field_value}",
                                        {
                                            'record_id': record_id,
                                            'field': field_name,
                                            'value': field_value
                                        },
                                        data_source='parc_corporate'
                                    )
                            except Exception as e:
                                logger.error(
                                    f"Error creating amount anomaly: {str(e)}")
                    except Exception as e:
                        logger.error(
                            f"Error checking {field_name} values: {str(e)}")

            # Check for empty critical fields
            critical_fields = [
                ('product', 'Product'),
                ('dot', 'DOT'),
                ('dot_code', 'DOT Code')
            ]

            # Filter critical fields to only include those that exist in the model
            valid_critical_fields = [(field, display) for field, display in critical_fields
                                     if field in model_fields]

            for field_name, field_display in valid_critical_fields:
                try:
                    # Different handling for dot field which is a ForeignKey
                    if field_name == 'dot':
                        # Avoid using field__isnull for dot field to prevent the ID error
                        empty_records = []
                        try:
                            for record in queryset:
                                try:
                                    if getattr(record, 'dot', None) is None:
                                        empty_records.append(record)
                                except Exception as e:
                                    logger.error(
                                        f"Error checking dot field of record: {str(e)}")
                        except Exception as e:
                            logger.error(
                                f"Error looping through queryset for dot field: {str(e)}")
                        else:
                            empty_records = queryset.filter(
                                **{f"{field_name}__isnull": True}) | queryset.filter(**{field_name: ''})

                        for record in empty_records:
                            try:
                                record_id = self._safe_get_id(record)
                                if record_id is not None:
                                    self._create_anomaly(
                                        record.invoice,
                                        'empty_field',
                                        f"Empty {field_display} in Parc Corporate record {record_id}",
                                        {
                                            'record_id': record_id,
                                            'field': field_name
                                        },
                                        data_source='parc_corporate'
                                    )
                            except Exception as e:
                                logger.error(
                                    f"Error creating empty field anomaly: {str(e)}")
                except Exception as e:
                    logger.error(
                        f"Error checking empty {field_name}: {str(e)}")

            # Check for inconsistency between discount and amounts
            if all(field in model_fields for field in ['discount', 'amount_pre_tax', 'total_amount']):
                try:
                    records = queryset.filter(~Q(discount=None) & ~Q(
                        amount_pre_tax=None) & ~Q(total_amount=None))
                    for record in records:
                        try:
                            # Check if discount is not properly reflected in the total amount
                            expected_total = float(
                                record.amount_pre_tax) * (1 - float(record.discount)/100)
                            actual_total = float(record.total_amount)

                            # Allow for small floating point differences (1% tolerance)
                            if abs(expected_total - actual_total) > (expected_total * 0.01):
                                record_id = self._safe_get_id(record)
                                if record_id is not None:
                                    self._create_anomaly(
                                        record.invoice,
                                        'amount_mismatch',
                                        f"Amount mismatch in Parc Corporate record {record_id}: Discount {record.discount}% " +
                                        f"not properly applied. Expected ~{expected_total:.2f}, got {actual_total:.2f}",
                                        {
                                            'record_id': record_id,
                                            'discount': float(record.discount),
                                            'amount_pre_tax': float(record.amount_pre_tax),
                                            'expected_total': expected_total,
                                            'actual_total': actual_total
                                        },
                                        data_source='parc_corporate'
                                    )
                        except Exception as e:
                            logger.error(
                                f"Error checking amount mismatch: {str(e)}")
                except Exception as e:
                    logger.error(f"Error in amount mismatch scan: {str(e)}")

        except Exception as e:
            logger.error(f"Error in Parc Corporate anomaly scan: {str(e)}")

        # Create any remaining buffered anomalies
        try:
            if self.anomaly_batch:
                self._batch_create_anomalies(self.anomaly_batch)
                self.anomaly_batch = []
        except Exception as e:
            logger.error(f"Error creating batch anomalies: {str(e)}")

        return self.anomalies

    def scan_ngbss_anomalies(self):
        """Scan anomalies for all NGBSS-related models"""
        self.anomalies = []
        self.anomaly_batch = []

        # Scan Creances NGBSS
        self.scan_creances_ngbss_empty_cells()

        # Scan CA Periodique
        self.scan_ca_periodique_empty_cells()

        # Scan CA Non Periodique
        self.scan_ca_non_periodique_empty_cells()

        # Scan CA CNT
        self.scan_ca_cnt_empty_cells()

        # Scan CA DNT
        self.scan_ca_dnt_empty_cells()

        # Scan CA RFD
        self.scan_ca_rfd_empty_cells()

        # Create any remaining buffered anomalies
        if self.anomaly_batch:
            self._batch_create_anomalies(self.anomaly_batch)
            self.anomaly_batch = []

        return self.anomalies

    def get_model_anomalies(self, model_name):
        """
        Get anomalies for a specific model
        Args:
            model_name (str): Name of the model to scan ('journal_ventes', 'etat_facture', 'parc_corporate', 'ngbss')
        Returns:
            list: Detected anomalies for the specified model
        """
        scan_methods = {
            'journal_ventes': self.scan_journal_ventes_anomalies,
            'etat_facture': self.scan_etat_facture_anomalies,
            'parc_corporate': self.scan_parc_corporate_anomalies,
            'ngbss': self.scan_ngbss_anomalies
        }

        if model_name not in scan_methods:
            raise ValueError(f"Invalid model name: {model_name}")

        return scan_methods[model_name]()

    def _validate_subscriber_id(self, subscriber_id):
        """
        Validate subscriber ID format and pattern
        Returns tuple (is_valid, error_message)
        """
        try:
            if subscriber_id is None:
                return False, "Subscriber ID cannot be empty"

            if not subscriber_id:
                return False, "Subscriber ID cannot be empty"

            # Add pattern validation - assuming subscriber ID should be alphanumeric
            # and at least 5 characters long
            if not isinstance(subscriber_id, str):
                try:
                    # Try to convert to string
                    subscriber_id = str(subscriber_id)
                except:
                    return False, "Subscriber ID must be a string"

            if len(subscriber_id) < 5:
                return False, "Subscriber ID must be at least 5 characters long"

            if not subscriber_id.isalnum():
                return False, "Subscriber ID must contain only letters and numbers"

            return True, None
        except Exception as e:
            logger.error(f"Error in _validate_subscriber_id: {str(e)}")
            return False, f"Validation error: {str(e)}"

    def _validate_month(self, month):
        """
        Validate month value
        Returns tuple (is_valid, error_message)
        """
        try:
            if month is None:
                return False, "Month cannot be empty"

            if month == '':
                return False, "Month cannot be empty"

            try:
                month = int(month)
            except (ValueError, TypeError):
                return False, "Month must be a valid integer"

            if not 1 <= month <= 12:
                return False, "Month must be between 1 and 12"

            return True, None
        except Exception as e:
            logger.error(f"Error in _validate_month: {str(e)}")
            return False, f"Validation error: {str(e)}"
