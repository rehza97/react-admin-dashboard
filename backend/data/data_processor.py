import logging
import pandas as pd
import numpy as np
import os
from datetime import datetime, date
from django.db import transaction
from .models import (
    Invoice, ProcessedInvoiceData, FacturationManuelle, JournalVentes,
    EtatFacture, ParcCorporate, CreancesNGBSS, CAPeriodique, CANonPeriodique,
    CADNT, CARFD, CACNT, NGBSSCollection, UnfinishedInvoice
)
import re
from django.db.models import QuerySet
from django.db.models import Q
from decimal import Decimal
import traceback
from decimal import InvalidOperation

logger = logging.getLogger(__name__)


class DataProcessor:
    """
    Class for processing, cleaning, and filtering data before saving to database.
    This handles all the business rules for data transformation.
    """

    def __init__(self):
        # Initialize any configuration parameters here
        self.current_year = datetime.now().year
        self.anomalies = {
            'parc_corporate': [],
            'creances_ngbss': [],
            'ca_periodique': [],
            'ca_non_periodique': [],
            'ca_dnt': [],
            'ca_rfd': [],
            'ca_cnt': [],
            'journal_ventes': [],
            'etat_facture': [],
            'ngbss_collection': [],
            'unfinished_invoice': []
        }

    def process_and_clean_data(self, file_path, file_type, raw_data):
        """
        Main entry point for processing and cleaning data

        Args:
            file_path: Path to the original file
            file_type: Type of file being processed
            raw_data: The raw data from the file processor

        Returns:
            cleaned_data: Data after filtering and cleaning
            anomalies: Any anomalies detected during processing
            summary: Summary statistics about the data
        """
        logger.info(f"Processing and cleaning {file_type} data")

        # Reset anomalies for this processing run
        self.anomalies[file_type] = []

        # Call the appropriate processing method based on file type
        if file_type == 'parc_corporate':
            return self.process_parc_corporate(raw_data)
        elif file_type == 'creances_ngbss':
            return self.process_creances_ngbss(raw_data)
        elif file_type == 'ca_periodique':
            return self.process_ca_periodique(raw_data)
        elif file_type == 'ca_non_periodique':
            return self.process_ca_non_periodique(raw_data)
        elif file_type == 'ca_dnt':
            return self.process_ca_dnt(raw_data)
        elif file_type == 'ca_rfd':
            return self.process_ca_rfd(raw_data)
        elif file_type == 'ca_cnt':
            return self.process_ca_cnt(raw_data)
        elif file_type == 'journal_ventes':
            return self.process_journal_ventes(raw_data)
        elif file_type == 'etat_facture':
            return self.process_etat_facture(raw_data)
        elif file_type == 'ngbss_collection':
            return self.process_ngbss_collection(raw_data)
        elif file_type == 'unfinished_invoice':
            return self.process_unfinished_invoice(raw_data)
        else:
            logger.warning(
                f"No specific processing for {file_type}, returning raw data")
            return raw_data, self.anomalies[file_type], {"processed": len(raw_data)}

    def process_parc_corporate(self, raw_data):
        """
        Process Parc Corporate NGBSS data

        Filtering rules:
        - CODE_CUSTOMER_L3: remove rows where the value is 5 or 57
        - OFFER_NAME: remove rows containing "Moohtarif" or "Solutions Hebergements"
        - SUBSCRIBER_STATUS: remove rows where status = "Predeactivated"

        Args:
            raw_data: Raw data from file processor

        Returns:
            cleaned_data: Filtered and cleaned data
            anomalies: Anomalies detected during processing
            summary: Summary statistics
        """
        logger.info("Processing Parc Corporate data")

        try:
            # Enhance filtering logic
            filtered_data = []
            anomalies = []

            for item in raw_data:
                # Skip categories 5 and 57
                if item.get('customer_l3_code') in ['5', '57']:
                    anomalies.append({
                        'type': 'excluded_category',
                        'message': f"Excluded customer category {item.get('customer_l3_code')}",
                        'data': item
                    })
                    continue

                # Skip Moohtarif offers and Solutions Hebergements
                offer_name = item.get('offer_name', '').lower()
                if 'moohtarif' in offer_name or 'solutions hebergements' in offer_name:
                    anomalies.append({
                        'type': 'excluded_offer',
                        'message': f"Excluded offer {offer_name}",
                        'data': item
                    })
                    continue

                # Skip Predeactivated subscribers
                if item.get('subscriber_status') == 'Predeactivated':
                    anomalies.append({
                        'type': 'excluded_status',
                        'message': "Excluded Predeactivated subscriber",
                        'data': item
                    })
                    continue

                # Process valid data
                filtered_data.append(item)

            # Create summary statistics
            summary = {
                "total_original": len(raw_data),
                "total_processed": len(filtered_data),
                "total_filtered_out": len(raw_data) - len(filtered_data),
                "total_anomalies": len(anomalies)
            }

            # Add telecom type distribution
            telecom_types = {}
            for item in filtered_data:
                telecom_type = item.get('telecom_type', 'Unknown')
                telecom_types[telecom_type] = telecom_types.get(
                    telecom_type, 0) + 1
            summary["telecom_type_distribution"] = telecom_types

            # Add state (DOT) distribution
            states = {}
            for item in filtered_data:
                state = item.get('state', 'Unknown')
                states[state] = states.get(state, 0) + 1
            summary["state_distribution"] = states

            # Add offer name distribution
            offer_names = {}
            for item in filtered_data:
                offer_name = item.get('offer_name', 'Unknown')
                offer_names[offer_name] = offer_names.get(offer_name, 0) + 1
            summary["offer_name_distribution"] = offer_names

            # Add subscriber status distribution
            statuses = {}
            for item in filtered_data:
                status = item.get('subscriber_status', 'Unknown')
                statuses[status] = statuses.get(status, 0) + 1
            summary["subscriber_status_distribution"] = statuses

            return filtered_data, anomalies, summary

        except Exception as e:
            logger.error(f"Error processing Parc Corporate data: {str(e)}")
            return raw_data, [], {"error": str(e)}

    def process_creances_ngbss(self, raw_data):
        """Process Créances NGBSS data with filtering and anomaly detection"""
        try:
            # Apply initial filtering based on business rules
            filtered_data = []
            anomalies = []

            for record in raw_data:
                # Convert record to match model fields
                processed_record = {
                    'dot': record.get('DOT', ''),
                    'actel': record.get('ACTEL', ''),
                    'month': record.get('MOIS', ''),
                    'year': record.get('ANNEE', ''),
                    'subscriber_status': record.get('SUBS_STATUS', ''),
                    'product': record.get('PRODUIT', ''),
                    'customer_lev1': record.get('CUST_LEV1', ''),
                    'customer_lev2': record.get('CUST_LEV2', ''),
                    'customer_lev3': record.get('CUST_LEV3', ''),
                    'invoice_amount': self._parse_decimal(record.get('INVOICE_AMT', 0)),
                    'open_amount': self._parse_decimal(record.get('OPEN_AMT', 0)),
                    'tax_amount': self._parse_decimal(record.get('TAX_AMT', 0)),
                    'invoice_amount_ht': self._parse_decimal(record.get('INVOICE_AMT_HT', 0)),
                    'dispute_amount': self._parse_decimal(record.get('DISPUTE_AMT', 0)),
                    'dispute_tax_amount': self._parse_decimal(record.get('DISPUTE_TAX_AMT', 0)),
                    'dispute_net_amount': self._parse_decimal(record.get('DISPUTE_NET_AMT', 0)),
                    'creance_brut': self._parse_decimal(record.get('CREANCE_BRUT', 0)),
                    'creance_net': self._parse_decimal(record.get('CREANCE_NET', 0)),
                    'creance_ht': self._parse_decimal(record.get('CREANCE_HT', 0))
                }

                # Check if record meets filtering criteria
                if (processed_record['product'] in CreancesNGBSS.VALID_PRODUCTS and
                    processed_record['customer_lev1'] in CreancesNGBSS.VALID_CUSTOMER_LEV1 and
                    processed_record['customer_lev2'] not in CreancesNGBSS.EXCLUDED_CUSTOMER_LEV2 and
                        processed_record['customer_lev3'] in CreancesNGBSS.VALID_CUSTOMER_LEV3):
                    filtered_data.append(processed_record)
                else:
                    # Record anomaly for filtered out record
                    anomaly = {
                        'record': processed_record,
                        'reasons': []
                    }

                    if processed_record['product'] not in CreancesNGBSS.VALID_PRODUCTS:
                        anomaly['reasons'].append(
                            f"Invalid product: {processed_record['product']}")

                    if processed_record['customer_lev1'] not in CreancesNGBSS.VALID_CUSTOMER_LEV1:
                        anomaly['reasons'].append(
                            f"Invalid customer level 1: {processed_record['customer_lev1']}")

                    if processed_record['customer_lev2'] in CreancesNGBSS.EXCLUDED_CUSTOMER_LEV2:
                        anomaly['reasons'].append(
                            f"Excluded customer level 2: {processed_record['customer_lev2']}")

                    if processed_record['customer_lev3'] not in CreancesNGBSS.VALID_CUSTOMER_LEV3:
                        anomaly['reasons'].append(
                            f"Invalid customer level 3: {processed_record['customer_lev3']}")

                    anomalies.append(anomaly)

                # Check for empty fields
                empty_fields = []
                for field, value in processed_record.items():
                    if value is None or (isinstance(value, str) and not value.strip()):
                        empty_fields.append(field)

                if empty_fields:
                    anomalies.append({
                        'record': processed_record,
                        'type': 'empty_fields',
                        'fields': empty_fields
                    })

                # Check for negative amounts
                amount_fields = [
                    'invoice_amount', 'open_amount', 'tax_amount', 'invoice_amount_ht',
                    'dispute_amount', 'dispute_tax_amount', 'dispute_net_amount',
                    'creance_brut', 'creance_net', 'creance_ht'
                ]

                negative_amounts = []
                for field in amount_fields:
                    value = processed_record[field]
                    if value is not None and value < 0:
                        negative_amounts.append((field, value))

                if negative_amounts:
                    anomalies.append({
                        'record': processed_record,
                        'type': 'negative_amounts',
                        'fields': negative_amounts
                    })

            # Prepare summary data
            summary = {
                'total_records': len(raw_data),
                'filtered_records': len(filtered_data),
                'filtered_out_records': len(raw_data) - len(filtered_data),
                'anomalies_count': len(anomalies),
                'anomalies': anomalies,
                'filtering_criteria': {
                    'valid_products': CreancesNGBSS.VALID_PRODUCTS,
                    'valid_customer_lev1': CreancesNGBSS.VALID_CUSTOMER_LEV1,
                    'excluded_customer_lev2': CreancesNGBSS.EXCLUDED_CUSTOMER_LEV2,
                    'valid_customer_lev3': CreancesNGBSS.VALID_CUSTOMER_LEV3
                }
            }

            return filtered_data, summary

        except Exception as e:
            logger.error(f"Error processing Créances NGBSS data: {str(e)}")
            logger.error(traceback.format_exc())
            return [], {"error": str(e)}

    def _parse_decimal(self, value):
        """Helper method to parse decimal values"""
        try:
            if isinstance(value, (int, float)):
                return Decimal(str(value))
            elif isinstance(value, str):
                # Remove spaces and replace comma with dot
                clean_value = value.replace(' ', '').replace(',', '.')
                return Decimal(clean_value) if clean_value else Decimal('0')
            return Decimal('0')
        except (ValueError, InvalidOperation):
            return Decimal('0')

    def process_ca_periodique(self, raw_data):
        """
        Process CA Périodique (NGBSS) data

        Filtering rules:
        - If DO == "Siège" => keep all products
        - Otherwise => keep only 'Specialized Line' and 'LTE'
        - Identify empty cells as anomalies

        Args:
            raw_data: Raw data from file processor

        Returns:
            cleaned_data: Filtered and cleaned data
            anomalies: Anomalies detected during processing
            summary: Summary statistics
        """
        logger.info("Processing CA Périodique data")

        try:
            # Convert to DataFrame for easier processing
            df = pd.DataFrame(raw_data)

            if df.empty:
                logger.warning("Empty CA Périodique data")
                return [], [], {"processed": 0, "filtered": 0}

            # Store original count
            original_count = len(df)

            # Standardize column names (lowercase)
            df.columns = [col.lower() for col in df.columns]

            # Identify rows with missing values
            missing_values = df[df.isna().any(axis=1)].copy()
            if not missing_values.empty:
                self.anomalies['ca_periodique'].extend(
                    missing_values.to_dict('records'))
                logger.info(
                    f"Found {len(missing_values)} rows with missing values")

            # Apply filtering rules

            # Find the DO and Produit columns
            do_col = next(
                (col for col in df.columns if col.lower() == 'do'), None)
            produit_col = next(
                (col for col in df.columns if 'produit' in col.lower()), None)

            if do_col and produit_col:
                # Fill NaN values in DO column to avoid errors
                df[do_col] = df[do_col].fillna('')

                # Split into Siège and non-Siège dataframes
                df_siege = df[df[do_col].str.lower() == 'siège'].copy()
                df_non_siege = df[df[do_col].str.lower() != 'siège'].copy()

                # For non-Siège, keep only 'Specialized Line' and 'LTE'
                before_count = len(df_non_siege)
                df_non_siege = df_non_siege[df_non_siege[produit_col].astype(
                    str).isin(['Specialized Line', 'LTE'])]
                logger.info(
                    f"Filtered out {before_count - len(df_non_siege)} non-Siège rows with Produit not in ['Specialized Line', 'LTE']")

                # Combine the dataframes back
                df = pd.concat([df_siege, df_non_siege], ignore_index=True)
                logger.info(
                    f"After filtering: {len(df_siege)} Siège rows, {len(df_non_siege)} non-Siège rows")

            # Calculate summary statistics
            summary = {
                "total_original": original_count,
                "total_processed": len(df),
                "total_filtered_out": original_count - len(df),
                "total_anomalies": len(self.anomalies['ca_periodique'])
            }

            # Add DO distribution
            if do_col and not df.empty:
                do_counts = df[do_col].value_counts().to_dict()
                summary["do_distribution"] = do_counts

            # Add product distribution
            if produit_col and not df.empty:
                produit_counts = df[produit_col].value_counts().to_dict()
                summary["produit_distribution"] = produit_counts

            # Convert back to list of dictionaries
            cleaned_data = df.to_dict('records')

            return cleaned_data, self.anomalies['ca_periodique'], summary

        except Exception as e:
            logger.error(f"Error processing CA Périodique data: {str(e)}")
            return raw_data, [], {"error": str(e)}

    def process_ca_non_periodique(self, raw_data):
        """Process CA Non Periodique data with filtering and anomaly detection"""
        try:
            # Apply initial filtering based on business rules
            filtered_data = []
            anomalies = []

            for record in raw_data:
                # Convert record to match model fields
                processed_record = {
                    'dot': record.get('DO', ''),
                    'product': record.get('PRODUIT', ''),
                    'amount_pre_tax': self._parse_decimal(record.get('HT', 0)),
                    'tax_amount': self._parse_decimal(record.get('TAX', 0)),
                    'total_amount': self._parse_decimal(record.get('TTC', 0)),
                    'sale_type': record.get('TYPE_VENTE', ''),
                    'channel': record.get('CHANNEL', '')
                }

                # Check if record meets filtering criteria (only Siège)
                if processed_record['dot'] == CANonPeriodique.VALID_DOT:
                    filtered_data.append(processed_record)
                else:
                    # Record anomaly for filtered out record
                    anomalies.append({
                        'record': processed_record,
                        'type': 'invalid_dot',
                        'value': processed_record['dot'],
                        'description': f"Invalid DOT: {processed_record['dot']}. Must be: {CANonPeriodique.VALID_DOT}"
                    })

                # Check for empty fields
                empty_fields = []
                for field, value in processed_record.items():
                    if value is None or (isinstance(value, str) and not value.strip()):
                        empty_fields.append(field)

                if empty_fields:
                    anomalies.append({
                        'record': processed_record,
                        'type': 'empty_fields',
                        'fields': empty_fields,
                        'description': f"Empty values in fields: {', '.join(empty_fields)}"
                    })

                # Check for negative amounts
                amount_fields = [
                    ('amount_pre_tax', processed_record['amount_pre_tax']),
                    ('tax_amount', processed_record['tax_amount']),
                    ('total_amount', processed_record['total_amount'])
                ]

                negative_amounts = []
                for field_name, value in amount_fields:
                    if value is not None and value < 0:
                        negative_amounts.append((field_name, value))

                if negative_amounts:
                    anomalies.append({
                        'record': processed_record,
                        'type': 'negative_amounts',
                        'fields': negative_amounts,
                        'description': f"Negative amounts found: {', '.join(f'{field}: {value}' for field, value in negative_amounts)}"
                    })

            # Prepare summary data
            summary = {
                'total_records': len(raw_data),
                'filtered_records': len(filtered_data),
                'filtered_out_records': len(raw_data) - len(filtered_data),
                'anomalies_count': len(anomalies),
                'anomalies': anomalies,
                'filtering_criteria': {
                    'valid_dot': CANonPeriodique.VALID_DOT
                },
                'distributions': {
                    'by_dot': self._get_distribution(filtered_data, 'dot'),
                    'by_product': self._get_distribution(filtered_data, 'product'),
                    'by_channel': self._get_distribution(filtered_data, 'channel'),
                    'by_sale_type': self._get_distribution(filtered_data, 'sale_type')
                }
            }

            return filtered_data, summary

        except Exception as e:
            logger.error(f"Error processing CA Non Periodique data: {str(e)}")
            logger.error(traceback.format_exc())
            return [], {"error": str(e)}

    def _get_distribution(self, data, field):
        """Helper method to get distribution of values for a field"""
        distribution = {}
        for record in data:
            value = record.get(field, 'Unknown')
            if value is None or (isinstance(value, str) and not value.strip()):
                value = 'Unknown'
            distribution[value] = distribution.get(value, 0) + 1
        return distribution

    def process_ca_dnt(self, raw_data):
        """
        Process CA DNT (Ajustement NGBSS) data

        Filtering rules:
        - DO == "Siège"
        - Département == "Direction Commerciale Corporate"
        - Identify empty cells as anomalies

        Args:
            raw_data: Raw data from file processor

        Returns:
            cleaned_data: Filtered and cleaned data
            anomalies: Anomalies detected during processing
            summary: Summary statistics
        """
        logger.info("Processing CA DNT data")

        try:
            # Convert to DataFrame for easier processing
            df = pd.DataFrame(raw_data)

            if df.empty:
                logger.warning("Empty CA DNT data")
                return [], [], {"processed": 0, "filtered": 0}

            # Store original count
            original_count = len(df)

            # Standardize column names (lowercase)
            df.columns = [col.lower() for col in df.columns]

            # Identify rows with missing values
            missing_values = df[df.isna().any(axis=1)].copy()
            if not missing_values.empty:
                self.anomalies['ca_dnt'].extend(
                    missing_values.to_dict('records'))
                logger.info(
                    f"Found {len(missing_values)} rows with missing values")

            # Apply filtering rules

            # Find the DO and Département columns
            do_col = next(
                (col for col in df.columns if col.lower() == 'do'), None)
            dept_col = next((col for col in df.columns if 'département' in col.lower(
            ) or 'departement' in col.lower()), None)

            if do_col:
                # Keep only rows where DO == "Siège"
                before_count = len(df)
                df = df[df[do_col].astype(str).str.lower() == 'siège']
                logger.info(
                    f"Filtered out {before_count - len(df)} rows with DO != 'Siège'")

            if dept_col:
                # Keep only rows where Département == "Direction Commerciale Corporate"
                before_count = len(df)
                df = df[df[dept_col].astype(
                    str) == 'Direction Commerciale Corporate']
                logger.info(
                    f"Filtered out {before_count - len(df)} rows with Département != 'Direction Commerciale Corporate'")

            # Calculate summary statistics
            summary = {
                "total_original": original_count,
                "total_processed": len(df),
                "total_filtered_out": original_count - len(df),
                "total_anomalies": len(self.anomalies['ca_dnt'])
            }

            # Add additional statistics if needed
            amount_col = next((col for col in df.columns if 'montant' in col.lower(
            ) or 'amount' in col.lower()), None)
            if amount_col and not df.empty:
                try:
                    # Convert to numeric, coercing errors to NaN
                    df[amount_col] = pd.to_numeric(
                        df[amount_col], errors='coerce')

                    # Calculate total amount
                    total_amount = df[amount_col].sum()
                    summary["total_amount"] = float(total_amount)
                except Exception as e:
                    logger.warning(
                        f"Could not calculate amount statistics: {str(e)}")

            # Convert back to list of dictionaries
            cleaned_data = df.to_dict('records')

            return cleaned_data, self.anomalies['ca_dnt'], summary

        except Exception as e:
            logger.error(f"Error processing CA DNT data: {str(e)}")
            return raw_data, [], {"error": str(e)}

    def process_ca_rfd(self, raw_data):
        """
        Process CA RFD (Remboursement NGBSS) data

        Filtering rules:
        - DO == "Siège"
        - Département == "Direction Commerciale Corporate"
        - Identify empty cells as anomalies

        Args:
            raw_data: Raw data from file processor

        Returns:
            cleaned_data: Filtered and cleaned data
            anomalies: Anomalies detected during processing
            summary: Summary statistics
        """
        logger.info("Processing CA RFD data")

        try:
            # Convert to DataFrame for easier processing
            df = pd.DataFrame(raw_data)

            if df.empty:
                logger.warning("Empty CA RFD data")
                return [], [], {"processed": 0, "filtered": 0}

            # Store original count
            original_count = len(df)

            # Standardize column names (lowercase)
            df.columns = [col.lower() for col in df.columns]

            # Identify rows with missing values
            missing_values = df[df.isna().any(axis=1)].copy()
            if not missing_values.empty:
                self.anomalies['ca_rfd'].extend(
                    missing_values.to_dict('records'))
                logger.info(
                    f"Found {len(missing_values)} rows with missing values")

            # Apply filtering rules

            # Find the DO and Département columns
            do_col = next(
                (col for col in df.columns if col.lower() == 'do'), None)
            dept_col = next((col for col in df.columns if 'département' in col.lower(
            ) or 'departement' in col.lower()), None)

            if do_col:
                # Keep only rows where DO == "Siège"
                before_count = len(df)
                df = df[df[do_col].astype(str).str.lower() == 'siège']
                logger.info(
                    f"Filtered out {before_count - len(df)} rows with DO != 'Siège'")

            if dept_col:
                # Keep only rows where Département == "Direction Commerciale Corporate"
                before_count = len(df)
                df = df[df[dept_col].astype(
                    str) == 'Direction Commerciale Corporate']
                logger.info(
                    f"Filtered out {before_count - len(df)} rows with Département != 'Direction Commerciale Corporate'")

            # Calculate summary statistics
            summary = {
                "total_original": original_count,
                "total_processed": len(df),
                "total_filtered_out": original_count - len(df),
                "total_anomalies": len(self.anomalies['ca_rfd'])
            }

            # Add additional statistics if needed
            amount_col = next((col for col in df.columns if 'montant' in col.lower(
            ) or 'amount' in col.lower()), None)
            if amount_col and not df.empty:
                try:
                    # Convert to numeric, coercing errors to NaN
                    df[amount_col] = pd.to_numeric(
                        df[amount_col], errors='coerce')

                    # Calculate total amount
                    total_amount = df[amount_col].sum()
                    summary["total_amount"] = float(total_amount)
                except Exception as e:
                    logger.warning(
                        f"Could not calculate amount statistics: {str(e)}")

            # Convert back to list of dictionaries
            cleaned_data = df.to_dict('records')

            return cleaned_data, self.anomalies['ca_rfd'], summary

        except Exception as e:
            logger.error(f"Error processing CA RFD data: {str(e)}")
            return raw_data, [], {"error": str(e)}

    def process_ca_cnt(self, raw_data):
        """
        Process CA CNT (Annulation NGBSS) data

        Filtering rules:
        - DO == "Siège"
        - Département == "Direction Commerciale Corporate"
        - Identify empty cells as anomalies

        Args:
            raw_data: Raw data from file processor

        Returns:
            cleaned_data: Filtered and cleaned data
            anomalies: Anomalies detected during processing
            summary: Summary statistics
        """
        logger.info("Processing CA CNT data")

        try:
            # Convert to DataFrame for easier processing
            df = pd.DataFrame(raw_data)

            if df.empty:
                logger.warning("Empty CA CNT data")
                return [], [], {"processed": 0, "filtered": 0}

            # Store original count
            original_count = len(df)

            # Standardize column names (lowercase)
            df.columns = [col.lower() for col in df.columns]

            # Identify rows with missing values
            missing_values = df[df.isna().any(axis=1)].copy()
            if not missing_values.empty:
                self.anomalies['ca_cnt'].extend(
                    missing_values.to_dict('records'))
                logger.info(
                    f"Found {len(missing_values)} rows with missing values")

            # Apply filtering rules

            # Find the DO and Département columns
            do_col = next(
                (col for col in df.columns if col.lower() == 'do'), None)
            dept_col = next((col for col in df.columns if 'département' in col.lower(
            ) or 'departement' in col.lower()), None)

            if do_col:
                # Keep only rows where DO == "Siège"
                before_count = len(df)
                df = df[df[do_col].astype(str).str.lower() == 'siège']
                logger.info(
                    f"Filtered out {before_count - len(df)} rows with DO != 'Siège'")

            if dept_col:
                # Keep only rows where Département == "Direction Commerciale Corporate"
                before_count = len(df)
                df = df[df[dept_col].astype(
                    str) == 'Direction Commerciale Corporate']
                logger.info(
                    f"Filtered out {before_count - len(df)} rows with Département != 'Direction Commerciale Corporate'")

            # Calculate summary statistics
            summary = {
                "total_original": original_count,
                "total_processed": len(df),
                "total_filtered_out": original_count - len(df),
                "total_anomalies": len(self.anomalies['ca_cnt'])
            }

            # Add additional statistics if needed
            amount_col = next((col for col in df.columns if 'montant' in col.lower(
            ) or 'amount' in col.lower()), None)
            if amount_col and not df.empty:
                try:
                    # Convert to numeric, coercing errors to NaN
                    df[amount_col] = pd.to_numeric(
                        df[amount_col], errors='coerce')

                    # Calculate total amount
                    total_amount = df[amount_col].sum()
                    summary["total_amount"] = float(total_amount)
                except Exception as e:
                    logger.warning(
                        f"Could not calculate amount statistics: {str(e)}")

            # Convert back to list of dictionaries
            cleaned_data = df.to_dict('records')

            return cleaned_data, self.anomalies['ca_cnt'], summary

        except Exception as e:
            logger.error(f"Error processing CA CNT data: {str(e)}")
            return raw_data, [], {"error": str(e)}

    def process_journal_ventes(self, raw_data):
        """
        Process Journal des Ventes data with complex filtering and anomaly detection

        Processing requirements:
        1. Clean Org Name: remove DOT_, _, and -
        2. For AT Siège: keep only DCC and DCGC
        3. Sort by Org Name and N Fact
        4. Format Chiffre Aff Exe Dzd (remove decimal point)
        5. Identify and separate previous year invoices (account codes ending with A)
        6. Identify and separate invoices with GL date from previous years
        7. Identify and separate invoices with invoice date from future years (advance invoices)
        8. Identify anomalies in invoice object (starting with @)
        9. Identify anomalies in billing period (ending with previous year)

        Returns:
        - processed_data: Main processed data
        - summary: Summary with statistics and categorized data
        """
        try:
            # Initialize data structures
            processed_data = []
            previous_year_invoices = []
            advance_invoices = []
            anomalies = []

            # Current year for filtering
            current_year = datetime.now().year

            # Process each record
            for record in raw_data:
                # Clean and standardize fields
                cleaned_record = self._clean_journal_ventes_record(record)

                # Check for anomalies
                record_anomalies = self._check_journal_ventes_anomalies(
                    cleaned_record, current_year)

                # Add record to appropriate category
                if self._is_previous_year_invoice(cleaned_record, current_year):
                    previous_year_invoices.append(cleaned_record)
                elif self._is_advance_invoice(cleaned_record, current_year):
                    advance_invoices.append(cleaned_record)
                else:
                    processed_data.append(cleaned_record)

                # Add anomalies if any
                if record_anomalies:
                    anomalies.append({
                        'record': cleaned_record,
                        'anomalies': record_anomalies
                    })

            # Sort data by organization and invoice number
            processed_data = sorted(processed_data, key=lambda x: (
                x.get('organization', ''), x.get('invoice_number', '')))
            previous_year_invoices = sorted(previous_year_invoices, key=lambda x: (
                x.get('organization', ''), x.get('invoice_number', '')))
            advance_invoices = sorted(advance_invoices, key=lambda x: (
                x.get('organization', ''), x.get('invoice_number', '')))

            # Prepare summary
            summary = {
                'total_records': len(raw_data),
                'current_year_records': len(processed_data),
                'previous_year_records': len(previous_year_invoices),
                'advance_invoices': len(advance_invoices),
                'anomalies_count': len(anomalies),
                'anomalies': anomalies,
                'categorized_data': {
                    'previous_year_invoices': previous_year_invoices,
                    'advance_invoices': advance_invoices
                },
                'distributions': {
                    'by_organization': self._get_distribution(processed_data, 'organization'),
                    'by_account_code': self._get_distribution(processed_data, 'account_code'),
                    'by_invoice_type': self._get_distribution(processed_data, 'invoice_type')
                }
            }

            return processed_data, summary

        except Exception as e:
            logger.error(f"Error processing Journal des Ventes data: {str(e)}")
            logger.error(traceback.format_exc())
            return [], {"error": str(e)}

    def _clean_journal_ventes_record(self, record):
        """Clean and standardize Journal des Ventes record"""
        # Create a copy to avoid modifying the original
        cleaned = record.copy()

        # Clean organization name
        if 'Org Name' in cleaned:
            org_name = cleaned['Org Name']
            if org_name:
                cleaned['organization'] = JournalVentes.clean_organization_name(
                    org_name)
            else:
                cleaned['organization'] = org_name
            # Remove original field
            del cleaned['Org Name']

        # Map fields to model field names
        field_mapping = {
            'Origine': 'origin',
            'N Fact': 'invoice_number',
            'Typ Fact': 'invoice_type',
            'Date Fact': 'invoice_date',
            'Client': 'client',
            'Devise': 'currency',
            'Obj Fact': 'invoice_object',
            'Cpt Comptable': 'account_code',
            'Date GL': 'gl_date',
            'Periode de facturation': 'billing_period',
            'Reference': 'reference',
            'Termine Flag': 'terminated_flag',
            'Description': 'description',
            'Chiffre Aff Exe Dzd': 'revenue_amount'
        }

        # Apply field mapping
        for old_key, new_key in field_mapping.items():
            if old_key in cleaned:
                cleaned[new_key] = cleaned.pop(old_key)

        # Format revenue amount (remove decimal point)
        if 'revenue_amount' in cleaned and cleaned['revenue_amount']:
            try:
                # Convert to numeric value if it's a string
                if isinstance(cleaned['revenue_amount'], str):
                    # Remove dots (thousands separators)
                    cleaned['revenue_amount'] = cleaned['revenue_amount'].replace(
                        '.', '')
                    # Convert to float
                    cleaned['revenue_amount'] = float(
                        cleaned['revenue_amount'])
            except (ValueError, TypeError):
                logger.warning(
                    f"Could not convert revenue amount: {cleaned['revenue_amount']}")

        # Parse dates
        date_fields = ['invoice_date', 'gl_date']
        for field in date_fields:
            if field in cleaned and cleaned[field]:
                cleaned[field] = self._parse_date(cleaned[field])

        return cleaned

    def _check_journal_ventes_anomalies(self, record, current_year):
        """Check for anomalies in Journal des Ventes record"""
        anomalies = []

        # Check for empty fields
        empty_fields = []
        important_fields = ['organization', 'invoice_number', 'invoice_date', 'client',
                            'invoice_object', 'account_code', 'gl_date', 'revenue_amount']
        for field in important_fields:
            if field not in record or not record[field]:
                empty_fields.append(field)

        if empty_fields:
            anomalies.append({
                'type': 'empty_fields',
                'fields': empty_fields,
                'description': f"Empty values in fields: {', '.join(empty_fields)}"
            })

        # Check for AT Siège organization not in valid list
        if ('organization' in record and record['organization'] and
            record['organization'].lower() == 'at siège' and
                record['organization'] not in JournalVentes.VALID_SIEGE_ORGS):
            anomalies.append({
                'type': 'invalid_siege_organization',
                'value': record['organization'],
                'description': f"Invalid AT Siège organization. Must be one of: {', '.join(JournalVentes.VALID_SIEGE_ORGS)}"
            })

        # Check for previous year invoice based on account code
        if 'account_code' in record and record['account_code'] and record['account_code'].endswith('A'):
            anomalies.append({
                'type': 'previous_year_account_code',
                'value': record['account_code'],
                'description': f"Account code {record['account_code']} indicates previous year invoice"
            })

        # Check for previous year invoice based on GL date
        if 'gl_date' in record and record['gl_date'] and isinstance(record['gl_date'], date) and record['gl_date'].year < current_year:
            anomalies.append({
                'type': 'previous_year_gl_date',
                'value': record['gl_date'],
                'description': f"GL date {record['gl_date']} is from previous year"
            })

        # Check for advance invoice based on invoice date
        if 'invoice_date' in record and record['invoice_date'] and isinstance(record['invoice_date'], date) and record['invoice_date'].year > current_year:
            anomalies.append({
                'type': 'advance_invoice_date',
                'value': record['invoice_date'],
                'description': f"Invoice date {record['invoice_date']} is from future year"
            })

        # Check for anomaly in invoice object
        if 'invoice_object' in record and record['invoice_object'] and record['invoice_object'].startswith('@'):
            anomalies.append({
                'type': 'anomaly_invoice_object',
                'value': record['invoice_object'],
                'description': f"Invoice object starts with @ (indicating previous year invoice)"
            })

        # Check for anomaly in billing period
        if 'billing_period' in record and record['billing_period']:
            years_pattern = r'(\d{4})$'
            match = re.search(years_pattern, record['billing_period'])
            if match:
                year = int(match.group(1))
                if year < current_year:
                    anomalies.append({
                        'type': 'anomaly_billing_period',
                        'value': record['billing_period'],
                        'description': f"Billing period ends with previous year {year}"
                    })

        # Check for negative revenue amount
        if 'revenue_amount' in record and record['revenue_amount'] and record['revenue_amount'] < 0:
            anomalies.append({
                'type': 'negative_revenue',
                'value': record['revenue_amount'],
                'description': f"Negative revenue amount: {record['revenue_amount']}"
            })

        return anomalies

    def _is_previous_year_invoice(self, record, current_year):
        """Check if record is a previous year invoice"""
        # Check account code ending with A
        if 'account_code' in record and record['account_code'] and record['account_code'].endswith('A'):
            return True

        # Check GL date from previous years
        if 'gl_date' in record and record['gl_date'] and isinstance(record['gl_date'], date) and record['gl_date'].year < current_year:
            return True

        # Check invoice object starting with @
        if 'invoice_object' in record and record['invoice_object'] and record['invoice_object'].startswith('@'):
            return True

        # Check billing period ending with previous year
        if 'billing_period' in record and record['billing_period']:
            years_pattern = r'(\d{4})$'
            match = re.search(years_pattern, record['billing_period'])
            if match:
                year = int(match.group(1))
                if year < current_year:
                    return True

        return False

    def _is_advance_invoice(self, record, current_year):
        """Check if record is an advance invoice"""
        # Check invoice date from future years
        if 'invoice_date' in record and record['invoice_date'] and isinstance(record['invoice_date'], date) and record['invoice_date'].year > current_year:
            return True

        return False

    def _parse_date(self, date_value):
        """Parse date value from various formats"""
        if not date_value:
            return None

        if isinstance(date_value, (date, datetime)):
            return date_value if isinstance(date_value, date) else date_value.date()

        # Try different date formats
        date_formats = [
            '%Y-%m-%d',  # ISO format
            '%d/%m/%Y',  # DD/MM/YYYY
            '%d-%m-%Y',  # DD-MM-YYYY
            '%d.%m.%Y',  # DD.MM.YYYY
            '%m/%d/%Y',  # MM/DD/YYYY
            '%Y/%m/%d'   # YYYY/MM/DD
        ]

        # Remove any dots from the date string
        if isinstance(date_value, str):
            date_value = date_value.replace('.', '/')

        for fmt in date_formats:
            try:
                return datetime.strptime(date_value, fmt).date()
            except (ValueError, TypeError):
                continue

        logger.warning(f"Could not parse date: {date_value}")
        return None

    def process_etat_facture(self, raw_data):
        """
        Process État de Facture et Encaissement data

        Processing requirements:
        1. Clean Org Name: remove "DOT_", "_", and "–"
        2. For AT Siège: keep only DCC and DCGC
        3. Convert invoice numbers to numeric format
        4. Sort by organization and invoice number
        5. Format monetary values (replace "." with ",")
        6. Clean payment dates (remove ".")
        7. Handle duplicates based on (Organization & Invoice Number & Invoice Type)

        Args:
            raw_data: Raw data from file processor

        Returns:
            cleaned_data: Filtered and cleaned data
            anomalies: List of detected anomalies
            summary: Summary statistics
        """
        logger.info("Processing État de Facture data")

        try:
            # Initialize data structures
            processed_data = []
            anomalies = []
            duplicates = {}  # To track duplicates

            # Process each record
            for record in raw_data:
                try:
                    # 1. Clean and standardize organization name
                    org_name = record.get('organization', '')
                    if org_name:
                        org_name = org_name.replace('DOT_', '').replace(
                            '_', '').replace('–', '')
                        record['organization'] = org_name

                    # 2. Filter AT Siège records - keep only DCC and DCGC
                    if org_name.lower() == 'at siège' and record.get('source') not in ['DCC', 'DCGC']:
                        anomalies.append({
                            'type': 'invalid_siege_organization',
                            'description': f"Invalid AT Siège organization: {record.get('source')}",
                            'record': record
                        })
                        continue

                    # 3. Convert invoice number to numeric
                    invoice_number = record.get('invoice_number')
                    if invoice_number:
                        try:
                            record['invoice_number'] = int(
                                str(invoice_number).strip())
                        except (ValueError, TypeError):
                            anomalies.append({
                                'type': 'invalid_invoice_number',
                                'description': f"Invalid invoice number format: {invoice_number}",
                                'record': record
                            })

                    # 4. Format monetary values
                    monetary_fields = [
                        'amount_pre_tax',
                        'tax_amount',
                        'total_amount',
                        'revenue_amount',
                        'collection_amount',
                        'invoice_credit_amount'
                    ]

                    for field in monetary_fields:
                        value = record.get(field)
                        if value is not None:
                            if isinstance(value, str):
                                # Replace dots with commas for string values
                                record[field] = value.replace('.', ',')
                            elif isinstance(value, (int, float)):
                                # Format numeric values with commas
                                record[field] = f"{value:,.2f}".replace(
                                    '.', ',')

                    # 5. Clean payment date
                    payment_date = record.get('payment_date')
                    if payment_date and isinstance(payment_date, str):
                        record['payment_date'] = payment_date.replace('.', '')

                    # 6. Create composite key for duplicate detection
                    composite_key = f"{org_name}_{record.get('invoice_number')}_{record.get('invoice_type')}"

                    if composite_key in duplicates:
                        # This is a duplicate - handle according to requirements
                        # Clear monetary values for duplicate records
                        for field in monetary_fields:
                            record[field] = None

                        anomalies.append({
                            'type': 'duplicate_record',
                            'description': f"Duplicate record found for key: {composite_key}",
                            'original_record': duplicates[composite_key],
                            'duplicate_record': record
                        })
                    else:
                        duplicates[composite_key] = record

                    processed_data.append(record)

                except Exception as e:
                    logger.error(f"Error processing record: {str(e)}")
                    anomalies.append({
                        'type': 'processing_error',
                        'description': f"Error processing record: {str(e)}",
                        'record': record
                    })

            # Sort processed data by organization and invoice number
            processed_data.sort(key=lambda x: (
                x.get('organization', ''),
                x.get('invoice_number', 0)
            ))

            # Prepare summary statistics
            summary = {
                'total_records': len(raw_data),
                'processed_records': len(processed_data),
                'duplicate_records': len([a for a in anomalies if a['type'] == 'duplicate_record']),
                'invalid_records': len([a for a in anomalies if a['type'] != 'duplicate_record']),
                'total_anomalies': len(anomalies)
            }

            # Add distribution statistics
            summary['organization_distribution'] = self._get_distribution(
                processed_data, 'organization')
            summary['invoice_type_distribution'] = self._get_distribution(
                processed_data, 'invoice_type')

            return processed_data, anomalies, summary

        except Exception as e:
            logger.error(f"Error processing État de Facture data: {str(e)}")
            logger.error(traceback.format_exc())
            return [], [], {"error": str(e)}

    def match_journal_ventes_etat_facture(self, journal_ventes_data, etat_facture_data):
        """
        Match Journal des Ventes and État de Facture data to unify KPIs and calculate performance metrics.

        This method performs a left-join or merge on (Organization, Invoice Number, Invoice Type)
        to identify missing invoices, calculate KPIs, and identify special cases.

        Calculations include:
        - Evolution rates (compared to previous periods)
        - Achievement rates (compared to objectives)
        - Collection rates (amount collected vs. invoiced)
        - Identification of invoices outside current fiscal year
        - Identification of invoices outside normal operations

        Args:
            journal_ventes_data: Processed Journal des Ventes data
            etat_facture_data: Processed État de Facture data

        Returns:
            matched_data: Combined data with KPIs and flags
            missing_invoices: Invoices in one dataset but not the other
            kpi_summary: Summary of KPIs and performance metrics
        """
        logger.info("Matching Journal des Ventes and État de Facture data")

        try:
            # Convert to DataFrames for easier processing
            df_journal = pd.DataFrame(journal_ventes_data)
            df_etat = pd.DataFrame(etat_facture_data)

            # Handle empty dataframes
            if df_journal.empty:
                logger.warning("Journal des Ventes data is empty")
                return [], [], {"error": "Journal des Ventes data is empty"}

            if df_etat.empty:
                logger.warning("État de Facture data is empty")
                return [], [], {"error": "État de Facture data is empty"}

            # Clean organization names for consistent matching
            if 'organization' in df_journal.columns:
                df_journal['organization'] = df_journal['organization'].astype(str).apply(
                    lambda x: x.replace('DOT_', '').replace('_', '').replace('–', ''))

            if 'organization' in df_etat.columns:
                df_etat['organization'] = df_etat['organization'].astype(str).apply(
                    lambda x: x.replace('DOT_', '').replace('_', '').replace('–', ''))

            # Create matching keys for both dataframes
            df_journal['match_key'] = df_journal.apply(
                lambda row: f"{str(row.get('organization', '')).lower()}_{str(row.get('invoice_number', '')).lower()}_{str(row.get('invoice_type', '')).lower()}",
                axis=1
            )

            df_etat['match_key'] = df_etat.apply(
                lambda row: f"{str(row.get('organization', '')).lower()}_{str(row.get('invoice_number', '')).lower()}_{str(row.get('invoice_type', '')).lower()}",
                axis=1
            )

            # Identify current fiscal year
            current_year = datetime.now().year

            # Flag invoices outside current fiscal year in Journal des Ventes
            df_journal['outside_fiscal_year'] = False
            if 'gl_date' in df_journal.columns:
                df_journal.loc[df_journal['gl_date'].notna(), 'outside_fiscal_year'] = df_journal.loc[
                    df_journal['gl_date'].notna(), 'gl_date'
                ].apply(lambda x: x.year if isinstance(x, (date, datetime)) else current_year) != current_year

            # Flag invoices with account codes ending with 'A' (previous year)
            if 'account_code' in df_journal.columns:
                df_journal.loc[df_journal['account_code'].notna(), 'outside_fiscal_year'] = df_journal.loc[
                    df_journal['account_code'].notna(), 'account_code'
                ].astype(str).str.endswith('A') | df_journal['outside_fiscal_year']

            # Flag invoices outside normal operations (invoice object starts with @)
            df_journal['outside_normal_operations'] = False
            if 'invoice_object' in df_journal.columns:
                df_journal.loc[df_journal['invoice_object'].notna(), 'outside_normal_operations'] = df_journal.loc[
                    df_journal['invoice_object'].notna(), 'invoice_object'
                ].astype(str).str.startswith('@')

            # Flag advance invoices (future dates)
            if 'invoice_date' in df_journal.columns:
                df_journal.loc[df_journal['invoice_date'].notna(), 'outside_normal_operations'] = (
                    df_journal.loc[df_journal['invoice_date'].notna(), 'outside_normal_operations'] |
                    df_journal.loc[df_journal['invoice_date'].notna(), 'invoice_date'].apply(
                        lambda x: x.year if isinstance(
                            x, (date, datetime)) else current_year
                    ) > current_year
                )

            # Perform left join from Journal des Ventes to État de Facture
            merged_df = df_journal.merge(
                df_etat,
                on='match_key',
                how='left',
                suffixes=('_journal', '_etat')
            )

            # Identify missing invoices (in Journal but not in État)
            missing_in_etat = merged_df[merged_df['organization_etat'].isna(
            )]['match_key'].tolist()

            # Identify invoices in État but not in Journal
            missing_in_journal = df_etat[~df_etat['match_key'].isin(
                df_journal['match_key'])]['match_key'].tolist()

            # Calculate collection rate for each invoice
            merged_df['collection_rate'] = 0.0

            # Ensure revenue_amount and collection_amount are numeric
            if 'revenue_amount_journal' in merged_df.columns and 'collection_amount_etat' in merged_df.columns:
                # Convert to numeric, coercing errors to NaN
                merged_df['revenue_amount_journal'] = pd.to_numeric(
                    merged_df['revenue_amount_journal'], errors='coerce')
                merged_df['collection_amount_etat'] = pd.to_numeric(
                    merged_df['collection_amount_etat'], errors='coerce')

                # Calculate collection rate where revenue amount is not zero
                mask = (merged_df['revenue_amount_journal'] >
                        0) & merged_df['collection_amount_etat'].notna()
                merged_df.loc[mask, 'collection_rate'] = (
                    merged_df.loc[mask, 'collection_amount_etat'] /
                    merged_df.loc[mask, 'revenue_amount_journal']
                )

            # Group by organization to calculate organization-level KPIs
            org_kpis = {}
            if 'organization_journal' in merged_df.columns:
                for org, group in merged_df.groupby('organization_journal'):
                    if org and not pd.isna(org):
                        # Calculate total revenue and collection for the organization
                        total_revenue = group['revenue_amount_journal'].sum()
                        total_collection = group['collection_amount_etat'].sum(
                        )

                        # Calculate organization collection rate
                        org_collection_rate = total_collection / \
                            total_revenue if total_revenue > 0 else 0

                        # Store organization KPIs
                        org_kpis[org] = {
                            'total_revenue': float(total_revenue),
                            'total_collection': float(total_collection),
                            'collection_rate': float(org_collection_rate),
                            'invoice_count': len(group),
                            'outside_fiscal_year_count': int(group['outside_fiscal_year'].sum()),
                            'outside_normal_operations_count': int(group['outside_normal_operations'].sum())
                        }

            # Prepare the combined data for return
            # Convert back to records (dictionaries)
            combined_data = merged_df.to_dict('records')

            # Prepare missing invoices data
            missing_invoices = {
                'in_journal_not_in_etat': [
                    {'match_key': key, 'details': next((item for item in journal_ventes_data if
                                                        f"{str(item.get('organization', '')).lower()}_{str(item.get('invoice_number', '')).lower()}_{str(item.get('invoice_type', '')).lower()}" == key), {})}
                    for key in missing_in_etat
                ],
                'in_etat_not_in_journal': [
                    {'match_key': key, 'details': next((item for item in etat_facture_data if
                                                        f"{str(item.get('organization', '')).lower()}_{str(item.get('invoice_number', '')).lower()}_{str(item.get('invoice_type', '')).lower()}" == key), {})}
                    for key in missing_in_journal
                ]
            }

            # Calculate overall KPIs
            total_revenue = merged_df['revenue_amount_journal'].sum()
            total_collection = merged_df['collection_amount_etat'].sum()
            overall_collection_rate = total_collection / \
                total_revenue if total_revenue > 0 else 0

            # Prepare summary with KPIs
            kpi_summary = {
                'total_invoices': len(combined_data),
                'total_revenue': float(total_revenue),
                'total_collection': float(total_collection),
                'overall_collection_rate': float(overall_collection_rate),
                'missing_invoices_count': {
                    'in_journal_not_in_etat': len(missing_in_etat),
                    'in_etat_not_in_journal': len(missing_in_journal)
                },
                'outside_fiscal_year_count': int(merged_df['outside_fiscal_year'].sum()),
                'outside_normal_operations_count': int(merged_df['outside_normal_operations'].sum()),
                'organization_kpis': org_kpis
            }

            return combined_data, missing_invoices, kpi_summary

        except Exception as e:
            logger.error(
                f"Error matching Journal des Ventes and État de Facture data: {str(e)}")
            logger.error(traceback.format_exc())
            return [], [], {"error": str(e)}

    def calculate_kpis(self, data_type, processed_data, objectives=None, previous_year_data=None):
        """
        Calculate KPIs for the processed data

        Args:
            data_type: Type of data (e.g., 'journal_ventes', 'etat_facture', etc.)
            processed_data: Processed data
            objectives: Optional objectives data for comparison
            previous_year_data: Optional previous year data for comparison

        Returns:
            kpis: Dictionary of calculated KPIs
        """
        logger.info(f"Calculating KPIs for {data_type}")

        try:
            # Convert to DataFrame for easier processing
            df = pd.DataFrame(processed_data)

            if df.empty:
                logger.warning(f"Empty {data_type} data")
                return {"error": f"Empty {data_type} data"}

            # Standardize column names (lowercase)
            df.columns = [col.lower() for col in df.columns]

            # Initialize KPIs dictionary
            kpis = {
                "data_type": data_type,
                "total_records": len(df)
            }

            # Calculate KPIs based on data type
            if data_type == 'journal_ventes':
                # Find the revenue column
                chiffre_col = next((col for col in df.columns if 'chiffre aff exe' in col.lower(
                ) or 'revenue_amount' in col.lower()), None)

                if chiffre_col:
                    # Convert to numeric, coercing errors to NaN
                    df[chiffre_col] = pd.to_numeric(
                        df[chiffre_col], errors='coerce')

                    # Calculate total revenue
                    total_revenue = df[chiffre_col].sum()
                    kpis["total_revenue"] = float(total_revenue)

                    # Calculate average revenue
                    avg_revenue = df[chiffre_col].mean()
                    kpis["average_revenue"] = float(avg_revenue)

                    # Compare with objectives if available
                    if objectives and 'revenue_objective' in objectives:
                        revenue_objective = objectives['revenue_objective']
                        kpis["revenue_objective"] = revenue_objective
                        kpis["revenue_achievement_rate"] = float(
                            total_revenue / revenue_objective) if revenue_objective else 0

                    # Compare with previous year if available
                    if previous_year_data and 'total_revenue' in previous_year_data:
                        prev_revenue = previous_year_data['total_revenue']
                        kpis["previous_year_revenue"] = prev_revenue
                        kpis["revenue_growth_rate"] = float(
                            (total_revenue - prev_revenue) / prev_revenue) if prev_revenue else 0

                # Group by organization
                org_col = next((col for col in df.columns if 'org name' in col.lower(
                ) or 'organization' in col.lower()), None)
                if org_col and chiffre_col:
                    org_revenue = df.groupby(
                        org_col)[chiffre_col].sum().to_dict()
                    kpis["revenue_by_organization"] = org_revenue

            elif data_type == 'etat_facture':
                # Find the financial columns
                montant_ttc_col = next((col for col in df.columns if 'montant ttc' in col.lower(
                ) or 'total_amount' in col.lower()), None)
                encaissement_col = next((col for col in df.columns if 'encaissement' in col.lower(
                ) or 'collection_amount' in col.lower()), None)

                if montant_ttc_col:
                    # Convert to numeric, coercing errors to NaN
                    df[montant_ttc_col] = pd.to_numeric(
                        df[montant_ttc_col], errors='coerce')

                    # Calculate total TTC
                    total_ttc = df[montant_ttc_col].sum()
                    kpis["total_ttc"] = float(total_ttc)

                if encaissement_col:
                    # Convert to numeric, coercing errors to NaN
                    df[encaissement_col] = pd.to_numeric(
                        df[encaissement_col], errors='coerce')

                    # Calculate total encaissement
                    total_encaissement = df[encaissement_col].sum()
                    kpis["total_encaissement"] = float(total_encaissement)

                    # Compare with objectives if available
                    if objectives and 'encaissement_objective' in objectives:
                        encaissement_objective = objectives['encaissement_objective']
                        kpis["encaissement_objective"] = encaissement_objective
                        kpis["encaissement_achievement_rate"] = float(
                            total_encaissement / encaissement_objective) if encaissement_objective else 0

                    # Compare with previous year if available
                    if previous_year_data and 'total_encaissement' in previous_year_data:
                        prev_encaissement = previous_year_data['total_encaissement']
                        kpis["previous_year_encaissement"] = prev_encaissement
                        kpis["encaissement_growth_rate"] = float(
                            (total_encaissement - prev_encaissement) / prev_encaissement) if prev_encaissement else 0

                # Calculate encaissement rate
                if montant_ttc_col and encaissement_col:
                    kpis["encaissement_rate"] = float(
                        total_encaissement / total_ttc) if total_ttc else 0

            elif data_type == 'parc_corporate':
                # Count by telecom type
                telecom_type_col = next(
                    (col for col in df.columns if 'telecom_type' in col.lower()), None)
                if telecom_type_col:
                    telecom_counts = df[telecom_type_col].value_counts(
                    ).to_dict()
                    kpis["telecom_type_distribution"] = telecom_counts

                # Count by subscriber status
                status_col = next(
                    (col for col in df.columns if 'subscriber_status' in col.lower()), None)
                if status_col:
                    status_counts = df[status_col].value_counts().to_dict()
                    kpis["subscriber_status_distribution"] = status_counts

                # Count by offer name
                offer_name_col = next(
                    (col for col in df.columns if 'offer_name' in col.lower()), None)
                if offer_name_col:
                    offer_counts = df[offer_name_col].value_counts().to_dict()
                    kpis["offer_name_distribution"] = offer_counts

                # Count new lines created this month
                creation_date_col = next(
                    (col for col in df.columns if 'creation_date' in col.lower()), None)
                if creation_date_col:
                    # Convert to datetime
                    df[creation_date_col] = pd.to_datetime(
                        df[creation_date_col], errors='coerce')

                    # Get current month and year
                    current_month = datetime.now().month
                    current_year = datetime.now().year

                    # Count new lines created this month
                    new_lines = df[(df[creation_date_col].dt.month == current_month) & (
                        df[creation_date_col].dt.year == current_year)]
                    kpis["new_lines_this_month"] = len(new_lines)

                    # Compare with previous month if available
                    if previous_year_data and 'new_lines_this_month' in previous_year_data:
                        prev_new_lines = previous_year_data['new_lines_this_month']
                        kpis["previous_month_new_lines"] = prev_new_lines
                        kpis["new_lines_growth_rate"] = float(
                            (len(new_lines) - prev_new_lines) / prev_new_lines) if prev_new_lines else 0

            elif data_type == 'creances_ngbss':
                # Group by product
                produit_col = next(
                    (col for col in df.columns if 'produit' in col.lower()), None)
                if produit_col:
                    produit_counts = df[produit_col].value_counts().to_dict()
                    kpis["produit_distribution"] = produit_counts

                # Group by customer level
                cust_lev1_col = next(
                    (col for col in df.columns if 'cust_lev1' in col.lower()), None)
                if cust_lev1_col:
                    cust_lev1_counts = df[cust_lev1_col].value_counts(
                    ).to_dict()
                    kpis["cust_lev1_distribution"] = cust_lev1_counts

            return kpis

        except Exception as e:
            logger.error(f"Error calculating KPIs for {data_type}: {str(e)}")
            return {"error": str(e)}

    def detect_anomalies(self, data, file_type):
        """Detect anomalies in the processed data based on file type"""
        anomalies = []

        if not isinstance(data, list) or not data:
            return anomalies

        # Common checks for all file types
        for idx, record in enumerate(data):
            # Check for empty/null critical fields
            empty_fields = self._check_empty_fields(record, file_type)
            if empty_fields:
                anomalies.append({
                    'type': 'missing_data',
                    'description': f'Missing data in critical fields: {", ".join(empty_fields)}',
                    'data': {
                        'record_index': idx,
                        'missing_fields': empty_fields,
                        'record': record
                    }
                })

        # File-specific anomaly checks
        if file_type == 'parc_corporate':
            anomalies.extend(self._detect_parc_corporate_anomalies(data))
        elif file_type == 'creances_ngbss':
            anomalies.extend(self._detect_creances_ngbss_anomalies(data))
        elif file_type == 'ca_periodique':
            anomalies.extend(self._detect_ca_periodique_anomalies(data))
        elif file_type == 'ca_non_periodique':
            anomalies.extend(self._detect_ca_non_periodique_anomalies(data))
        elif file_type == 'ca_dnt':
            anomalies.extend(self._detect_ca_dnt_anomalies(data))
        elif file_type == 'ca_rfd':
            anomalies.extend(self._detect_ca_rfd_anomalies(data))
        elif file_type == 'ca_cnt':
            anomalies.extend(self._detect_ca_cnt_anomalies(data))
        elif file_type == 'journal_ventes':
            anomalies.extend(self._detect_journal_ventes_anomalies(data))
        elif file_type == 'etat_facture':
            anomalies.extend(self._detect_etat_facture_anomalies(data))

        return anomalies

    def _check_empty_fields(self, record, file_type):
        """Check for empty critical fields based on file type"""
        empty_fields = []

        # Define critical fields for each file type
        critical_fields = {
            'parc_corporate': ['actel_code', 'customer_l1_desc', 'telecom_type', 'offer_name', 'subscriber_status', 'state'],
            'creances_ngbss': ['dot', 'actel', 'month', 'year', 'product', 'customer_lev1', 'customer_lev2', 'customer_lev3'],
            'ca_periodique': ['dot', 'product', 'amount_pre_tax', 'tax_amount', 'total_amount'],
            'ca_non_periodique': ['dot', 'product', 'amount_pre_tax', 'tax_amount', 'total_amount'],
            'ca_dnt': ['dot', 'department', 'transaction_id', 'total_amount'],
            'ca_rfd': ['dot', 'department', 'transaction_id', 'total_amount'],
            'ca_cnt': ['dot', 'department', 'transaction_id', 'total_amount'],
            'journal_ventes': ['organization', 'invoice_number', 'invoice_date', 'client', 'revenue_amount'],
            'etat_facture': ['organization', 'invoice_number', 'invoice_date', 'client', 'total_amount']
        }

        if file_type in critical_fields:
            for field in critical_fields[file_type]:
                if field in record and (record[field] is None or record[field] == '' or
                                        (isinstance(record[field], str) and record[field].strip() == '')):
                    empty_fields.append(field)

        return empty_fields

    def _detect_parc_corporate_anomalies(self, data):
        """Detect anomalies specific to Parc Corporate data"""
        anomalies = []

        for idx, record in enumerate(data):
            # Check for Moohtarif in offer_name (should be excluded)
            if 'offer_name' in record and record['offer_name'] and (
                    'Moohtarif' in record['offer_name'] or 'Solutions Hebergements' in record['offer_name']):
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Offer name contains excluded terms: {record["offer_name"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'offer_name',
                        'value': record['offer_name'],
                        'record': record
                    }
                })

            # Check for excluded customer_l3_code values (5 and 57)
            if 'customer_l3_code' in record and record['customer_l3_code'] and (
                    record['customer_l3_code'] == '5' or record['customer_l3_code'] == '57'):
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Customer L3 code is excluded: {record["customer_l3_code"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'customer_l3_code',
                        'value': record['customer_l3_code'],
                        'record': record
                    }
                })

            # Check for Predeactivated subscriber status (should be excluded)
            if 'subscriber_status' in record and record['subscriber_status'] and record['subscriber_status'] == 'Predeactivated':
                anomalies.append({
                    'type': 'invalid_data',
                    'description': 'Subscriber status is Predeactivated (client résilié)',
                    'data': {
                        'record_index': idx,
                        'field': 'subscriber_status',
                        'value': record['subscriber_status'],
                        'record': record
                    }
                })

        return anomalies

    def _detect_creances_ngbss_anomalies(self, data):
        """Detect anomalies specific to Creances NGBSS data"""
        anomalies = []

        for idx, record in enumerate(data):
            # Check for products other than Specialized Line and LTE
            if 'product' in record and record['product'] and record['product'] not in ['Specialized Line', 'LTE']:
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Product is not in allowed list (Specialized Line, LTE): {record["product"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'product',
                        'value': record['product'],
                        'record': record
                    }
                })

            # Check for customer_lev1 values other than Corporate and Corporate Group
            if 'customer_lev1' in record and record['customer_lev1'] and record['customer_lev1'] not in ['Corporate', 'Corporate Group']:
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Customer Lev1 is not in allowed list (Corporate, Corporate Group): {record["customer_lev1"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'customer_lev1',
                        'value': record['customer_lev1'],
                        'record': record
                    }
                })

            # Check for customer_lev2 value "Client professionnelConventionné" (should be excluded)
            if 'customer_lev2' in record and record['customer_lev2'] and 'professionnelConvention' in record['customer_lev2']:
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Customer Lev2 contains excluded term: {record["customer_lev2"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'customer_lev2',
                        'value': record['customer_lev2'],
                        'record': record
                    }
                })

            # Check for customer_lev3 values not in allowed list
            allowed_cust_lev3 = ["Ligne d'exploitation AP",
                                 "Ligne d'exploitation ATMobilis", "Ligne d'exploitation ATS"]
            if 'customer_lev3' in record and record['customer_lev3'] and record['customer_lev3'] not in allowed_cust_lev3:
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Customer Lev3 is not in allowed list: {record["customer_lev3"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'customer_lev3',
                        'value': record['customer_lev3'],
                        'record': record
                    }
                })

        return anomalies

    def _detect_ca_periodique_anomalies(self, data):
        """Detect anomalies specific to CA Periodique data"""
        anomalies = []

        for idx, record in enumerate(data):
            # For DO other than Siège, check if product is not Specialized Line or LTE
            if 'dot' in record and record['dot'] and record['dot'] != 'Siège' and 'product' in record and record['product']:
                if record['product'] not in ['Specialized Line', 'LTE']:
                    anomalies.append({
                        'type': 'invalid_data',
                        'description': f'For DOT {record["dot"]}, product must be Specialized Line or LTE, found: {record["product"]}',
                        'data': {
                            'record_index': idx,
                            'field': 'product',
                            'value': record['product'],
                            'dot': record['dot'],
                            'record': record
                        }
                    })

        return anomalies

    def _detect_ca_non_periodique_anomalies(self, data):
        """Detect anomalies specific to CA Non Periodique data"""
        anomalies = []

        for idx, record in enumerate(data):
            # Check if DOT is not Siège
            if 'dot' in record and record['dot'] and record['dot'] != 'Siège':
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'DOT must be Siège, found: {record["dot"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'dot',
                        'value': record['dot'],
                        'record': record
                    }
                })

        return anomalies

    def _detect_ca_dnt_anomalies(self, data):
        """Detect anomalies specific to CA DNT data"""
        anomalies = []

        for idx, record in enumerate(data):
            # Check if DOT is not Siège
            if 'dot' in record and record['dot'] and record['dot'] != 'Siège':
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'DOT must be Siège, found: {record["dot"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'dot',
                        'value': record['dot'],
                        'record': record
                    }
                })

            # Check if department is not Direction Commerciale Corporate
            if 'department' in record and record['department'] and record['department'] != 'Direction Commerciale Corporate':
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Department must be Direction Commerciale Corporate, found: {record["department"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'department',
                        'value': record['department'],
                        'record': record
                    }
                })

        return anomalies

    def _detect_ca_rfd_anomalies(self, data):
        """Detect anomalies specific to CA RFD data"""
        anomalies = []

        for idx, record in enumerate(data):
            # Check if DOT is not Siège
            if 'dot' in record and record['dot'] and record['dot'] != 'Siège':
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'DOT must be Siège, found: {record["dot"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'dot',
                        'value': record['dot'],
                        'record': record
                    }
                })

            # Check if department is not Direction Commerciale Corporate
            if 'department' in record and record['department'] and record['department'] != 'Direction Commerciale Corporate':
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Department must be Direction Commerciale Corporate, found: {record["department"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'department',
                        'value': record['department'],
                        'record': record
                    }
                })

        return anomalies

    def _detect_ca_cnt_anomalies(self, data):
        """Detect anomalies specific to CA CNT data"""
        anomalies = []

        for idx, record in enumerate(data):
            # Check if DOT is not Siège
            if 'dot' in record and record['dot'] and record['dot'] != 'Siège':
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'DOT must be Siège, found: {record["dot"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'dot',
                        'value': record['dot'],
                        'record': record
                    }
                })

            # Check if department is not Direction Commerciale Corporate
            if 'department' in record and record['department'] and record['department'] != 'Direction Commerciale Corporate':
                anomalies.append({
                    'type': 'invalid_data',
                    'description': f'Department must be Direction Commerciale Corporate, found: {record["department"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'department',
                        'value': record['department'],
                        'record': record
                    }
                })

        return anomalies

    def _detect_journal_ventes_anomalies(self, data):
        """Detect anomalies specific to Journal Ventes data"""
        anomalies = []

        for idx, record in enumerate(data):
            # Check for Siège organization that is not DCC or DCGC
            if 'organization' in record and record['organization'] and record['organization'] == 'Siège':
                if 'department' in record and record['department'] and record['department'] not in ['DCC', 'DCGC']:
                    anomalies.append({
                        'type': 'invalid_data',
                        'description': f'For Siège organization, department must be DCC or DCGC, found: {record["department"]}',
                        'data': {
                            'record_index': idx,
                            'field': 'department',
                            'value': record['department'],
                            'organization': record['organization'],
                            'record': record
                        }
                    })

            # Check for invoice_object starting with @
            if 'invoice_object' in record and record['invoice_object'] and isinstance(record['invoice_object'], str) and record['invoice_object'].startswith('@'):
                anomalies.append({
                    'type': 'anomaly',
                    'description': f'Invoice object starts with @ (facture exercice antérieur): {record["invoice_object"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'invoice_object',
                        'value': record['invoice_object'],
                        'record': record
                    }
                })

            # Check for billing_period ending with previous year
            if 'billing_period' in record and record['billing_period'] and isinstance(record['billing_period'], str):
                current_year = datetime.now().year
                for year in range(current_year-5, current_year):
                    if record['billing_period'].endswith(str(year)):
                        anomalies.append({
                            'type': 'anomaly',
                            'description': f'Billing period ends with previous year (facture exercice antérieur): {record["billing_period"]}',
                            'data': {
                                'record_index': idx,
                                'field': 'billing_period',
                                'value': record['billing_period'],
                                'record': record
                            }
                        })
                        break

            # Check for account_code ending with A (facture exercice antérieur)
            if 'account_code' in record and record['account_code'] and isinstance(record['account_code'], str) and record['account_code'].endswith('A'):
                anomalies.append({
                    'type': 'anomaly',
                    'description': f'Account code ends with A (facture exercice antérieur): {record["account_code"]}',
                    'data': {
                        'record_index': idx,
                        'field': 'account_code',
                        'value': record['account_code'],
                        'record': record
                    }
                })

            # Check for gl_date from previous year
            if 'gl_date' in record and record['gl_date']:
                try:
                    current_year = datetime.now().year
                    if isinstance(record['gl_date'], str):
                        from datetime import datetime
                        gl_date = datetime.strptime(
                            record['gl_date'], '%Y-%m-%d')
                    else:
                        gl_date = record['gl_date']

                    if gl_date.year < current_year:
                        anomalies.append({
                            'type': 'anomaly',
                            'description': f'GL date is from previous year: {gl_date}',
                            'data': {
                                'record_index': idx,
                                'field': 'gl_date',
                                'value': record['gl_date'],
                                'record': record
                            }
                        })
                except Exception as e:
                    # If date parsing fails, log it as an anomaly
                    anomalies.append({
                        'type': 'invalid_data',
                        'description': f'Invalid GL date format: {record["gl_date"]}',
                        'data': {
                            'record_index': idx,
                            'field': 'gl_date',
                            'value': record['gl_date'],
                            'error': str(e),
                            'record': record
                        }
                    })

        return anomalies

    def _detect_etat_facture_anomalies(self, data):
        """Detect anomalies specific to Etat Facture data"""
        anomalies = []

        # Create a dictionary to track duplicates
        invoice_keys = {}

        for idx, record in enumerate(data):
            # Check for Siège organization that is not DCC or DCGC
            if 'organization' in record and record['organization'] and record['organization'] == 'Siège':
                if 'department' in record and record['department'] and record['department'] not in ['DCC', 'DCGC']:
                    anomalies.append({
                        'type': 'invalid_data',
                        'description': f'For Siège organization, department must be DCC or DCGC, found: {record["department"]}',
                        'data': {
                            'record_index': idx,
                            'field': 'department',
                            'value': record['department'],
                            'organization': record['organization'],
                            'record': record
                        }
                    })

            # Check for duplicate invoices (same organization, invoice_number, and invoice_type)
            if all(field in record for field in ['organization', 'invoice_number', 'invoice_type']):
                key = f"{record['organization']}_{record['invoice_number']}_{record['invoice_type']}"
                if key in invoice_keys:
                    # This is a duplicate (could be partial payment)
                    anomalies.append({
                        'type': 'duplicate_data',
                        'description': f'Duplicate invoice detected (possible partial payment): {key}',
                        'data': {
                            'record_index': idx,
                            'previous_index': invoice_keys[key],
                            'key': key,
                            'record': record
                        }
                    })
                else:
                    invoice_keys[key] = idx

        return anomalies

    def filter_parc_corporate(self, data):
        """
        Apply specific filters to ParcCorporate data as per client requirements:
        - Remove categories 5 and 57 from CODE_CUSTOMER_L3
        - Remove entries with Moohtarif or Solutions Hebergements in OFFER_NAME
        - Remove entries with Predeactivated in SUBSCRIBER_STATUS

        Args:
            data: List of ParcCorporate records or queryset

        Returns:
            Filtered data
        """
        if isinstance(data, QuerySet):
            # Filter the queryset directly
            filtered_data = data.exclude(
                customer_l3_code__in=['5', '57']
            ).exclude(
                offer_name__icontains='Moohtarif'
            ).exclude(
                offer_name__icontains='Solutions Hebergements'
            ).exclude(
                subscriber_status='Predeactivated'
            )
            return filtered_data
        else:
            # Filter a list of records
            filtered_data = []
            for record in data:
                # Skip records with excluded customer_l3_code
                if record.get('customer_l3_code') in ['5', '57']:
                    continue

                # Skip records with Moohtarif or Solutions Hebergements in offer_name
                offer_name = record.get('offer_name', '')
                if 'Moohtarif' in offer_name or 'Solutions Hebergements' in offer_name:
                    continue

                # Skip records with Predeactivated status
                if record.get('subscriber_status') == 'Predeactivated':
                    continue

                filtered_data.append(record)

            return filtered_data

    def filter_creances_ngbss(self, data):
        """
        Apply specific filters to CreancesNGBSS data as per client requirements:
        - Keep only Specialized Line and LTE products
        - Keep only Corporate and Corporate Group in CUST_LEV1
        - Remove Client professionnelConventionné from CUST_LEV2
        - Keep only specific values in CUST_LEV3

        Args:
            data: List of CreancesNGBSS records or queryset

        Returns:
            Filtered data
        """
        allowed_products = ['Specialized Line', 'LTE']
        allowed_cust_lev1 = ['Corporate', 'Corporate Group']
        excluded_cust_lev2 = ['Client professionnelConventionné']
        allowed_cust_lev3 = [
            'Ligne d\'exploitation AP',
            'Ligne d\'exploitation ATMobilis',
            'Ligne d\'exploitation ATS'
        ]

        if isinstance(data, QuerySet):
            # Filter the queryset directly
            filtered_data = data.filter(
                product__in=allowed_products,
                customer_lev1__in=allowed_cust_lev1
            ).exclude(
                customer_lev2__in=excluded_cust_lev2
            ).filter(
                customer_lev3__in=allowed_cust_lev3
            )
            return filtered_data
        else:
            # Filter a list of records
            filtered_data = []
            for record in data:
                # Check if product is in allowed list
                if record.get('product') not in allowed_products:
                    continue

                # Check if customer_lev1 is in allowed list
                if record.get('customer_lev1') not in allowed_cust_lev1:
                    continue

                # Skip records with excluded customer_lev2
                if record.get('customer_lev2') in excluded_cust_lev2:
                    continue

                # Check if customer_lev3 is in allowed list
                if record.get('customer_lev3') not in allowed_cust_lev3:
                    continue

                filtered_data.append(record)

            return filtered_data

    def filter_ca_periodique(self, data):
        """
        Apply specific filters to CA Periodique data as per client requirements:
        - For DO "Siège": Include all products
        - For other DOs: Keep only "Specialized Line" and "LTE" products

        Args:
            data: List of CAPeriodique records or queryset

        Returns:
            Filtered data
        """
        allowed_products = ['Specialized Line', 'LTE']

        if isinstance(data, QuerySet):
            # Filter the queryset directly - keep all Siège records and filter others
            filtered_data = data.filter(
                # Either dot is Siège OR product is in allowed list
                Q(dot='Siège') | Q(product__in=allowed_products)
            )
            return filtered_data
        else:
            # Filter a list of records
            filtered_data = []
            for record in data:
                dot = record.get('dot', '')
                product = record.get('product', '')

                # Keep all records for Siège
                if dot == 'Siège':
                    filtered_data.append(record)
                    continue

                # For other DOTs, only keep allowed products
                if product in allowed_products:
                    filtered_data.append(record)

            return filtered_data

    def filter_ca_non_periodique(self, data):
        """
        Apply specific filters to CA Non Periodique data as per client requirements:
        - Keep only "Siège" in DO

        Args:
            data: List of CANonPeriodique records or queryset

        Returns:
            Filtered data
        """
        if isinstance(data, QuerySet):
            # Filter the queryset directly
            filtered_data = data.filter(dot='Siège')
            return filtered_data
        else:
            # Filter a list of records
            filtered_data = []
            for record in data:
                if record.get('dot') == 'Siège':
                    filtered_data.append(record)

            return filtered_data

    def filter_ca_dnt(self, data):
        """
        Apply specific filters to CA DNT data as per client requirements:
        - Keep only "Siège" in DO
        - Keep only "Direction Commerciale Corporate" in Département

        Args:
            data: List of CADNT records or queryset

        Returns:
            Filtered data
        """
        if isinstance(data, QuerySet):
            # Filter the queryset directly
            filtered_data = data.filter(
                dot='Siège',
                department='Direction Commerciale Corporate'
            )
            return filtered_data
        else:
            # Filter a list of records
            filtered_data = []
            for record in data:
                if (record.get('dot') == 'Siège' and
                        record.get('department') == 'Direction Commerciale Corporate'):
                    filtered_data.append(record)

            return filtered_data

    def filter_ca_rfd(self, data):
        """
        Apply specific filters to CA RFD data as per client requirements:
        - Keep "Siège" in DO
        - Keep "Direction Commerciale Corporate" in Département

        Args:
            data: List of CARFD records or queryset

        Returns:
            Filtered data
        """
        if isinstance(data, QuerySet):
            # Filter the queryset directly
            filtered_data = data.filter(
                dot='Siège',
                department='Direction Commerciale Corporate'
            )
            return filtered_data
        else:
            # Filter a list of records
            filtered_data = []
            for record in data:
                if (record.get('dot') == 'Siège' and
                        record.get('department') == 'Direction Commerciale Corporate'):
                    filtered_data.append(record)

            return filtered_data

    def filter_ca_cnt(self, data):
        """
        Apply specific filters to CA CNT data as per client requirements:
        - Keep only "Siège" in DO
        - Keep only "Direction Commerciale Corporate" in Département

        Args:
            data: List of CACNT records or queryset

        Returns:
            Filtered data
        """
        if isinstance(data, QuerySet):
            # Filter the queryset directly
            filtered_data = data.filter(
                dot='Siège',
                department='Direction Commerciale Corporate'
            )
            return filtered_data
        else:
            # Filter a list of records
            filtered_data = []
            for record in data:
                if (record.get('dot') == 'Siège' and
                        record.get('department') == 'Direction Commerciale Corporate'):
                    filtered_data.append(record)

            return filtered_data

    def process_journal_ventes_advanced(self, data):
        """
        Apply advanced processing to Journal des ventes data as per client requirements:
        - Remove "DOT_", "_", and "–" from Org Name
        - For Org Name "AT Siège": Keep only "DCC" and "DCGC"
        - Sort by Org Name and N Fact
        - Remove "." from Chiffre Aff Exe Dzd
        - Identify accounting codes ending with "A" (previous year invoice)
        - Identify dates different from current year (previous year invoice)
        - Identify invoice dates different from current year (advance billing)
        - Identify cells starting with "@" in Obj Fact (anomaly)
        - Identify cells with dates ending with previous year in "Période de facturation" (anomaly)

        Args:
            data: List of JournalVentes records or queryset

        Returns:
            Processed data and categorized records
        """
        current_year = datetime.now().year
        previous_year = current_year - 1

        # Initialize categorized records
        categorized = {
            'main_data': [],
            'previous_year_invoice': [],
            'advance_billing': [],
            'anomalies': []
        }

        # Process each record
        processed_data = []

        for record in data:
            # Create a copy of the record for processing
            processed_record = record.copy() if isinstance(record, dict) else {
                field.name: getattr(record, field.name)
                for field in record._meta.fields
            }

            # Clean organization name
            org_name = processed_record.get('organization', '')
            org_name = org_name.replace('DOT_', '').replace(
                '_', '').replace('–', '')
            processed_record['organization'] = org_name

            # Filter AT Siège records
            if org_name == 'AT Siège' and processed_record.get('origin') not in ['DCC', 'DCGC']:
                continue

            # Clean revenue amount (remove dots)
            revenue_amount = processed_record.get('revenue_amount', 0)
            if isinstance(revenue_amount, str):
                revenue_amount = revenue_amount.replace('.', '')
                try:
                    revenue_amount = Decimal(revenue_amount)
                    processed_record['revenue_amount'] = revenue_amount
                except:
                    pass

            # Check account code for previous year invoice
            account_code = processed_record.get('account_code', '')
            if account_code and account_code.endswith('A'):
                categorized['previous_year_invoice'].append(processed_record)
                continue

            # Check GL date for previous year invoice
            gl_date = processed_record.get('gl_date')
            if gl_date and isinstance(gl_date, date) and gl_date.year != current_year:
                categorized['previous_year_invoice'].append(processed_record)
                continue

            # Check invoice date for advance billing
            invoice_date = processed_record.get('invoice_date')
            if invoice_date and isinstance(invoice_date, date) and invoice_date.year != current_year:
                categorized['advance_billing'].append(processed_record)
                continue

            # Check Obj Fact for anomalies
            obj_fact = processed_record.get('invoice_object', '')
            if obj_fact and isinstance(obj_fact, str) and obj_fact.startswith('@'):
                categorized['anomalies'].append(processed_record)
                continue

            # Check billing period for anomalies
            billing_period = processed_record.get('billing_period', '')
            if billing_period and isinstance(billing_period, str) and str(previous_year) in billing_period:
                categorized['anomalies'].append(processed_record)
                continue

            # If record passed all filters, add to main data
            categorized['main_data'].append(processed_record)
            processed_data.append(processed_record)

        # Sort by organization and invoice_number
        processed_data.sort(key=lambda x: (
            x.get('organization', ''), x.get('invoice_number', '')))

        return processed_data, categorized

    def process_etat_facture_advanced(self, data):
        """
        Apply advanced processing to Etat de facture data as per client requirements:
        - Remove "DOT_", "_", and "–" from Org Name
        - For Org Name "AT Siège": Keep only "DCC" and "DCGC"
        - Convert N Fact to numeric format
        - Sort by Org Name and N Fact
        - Replace "." with "," in monetary fields
        - Remove "." from Date Rglt
        - Add a column combining (Organisation & N Fact & Typ Fact)
        - Identify duplicates in this combined column

        Args:
            data: List of EtatFacture records or queryset

        Returns:
            Processed data and identified duplicates
        """
        # Process each record
        processed_data = []
        combined_keys = {}  # To track duplicates
        duplicates = []

        for record in data:
            # Create a copy of the record for processing
            processed_record = record.copy() if isinstance(record, dict) else {
                field.name: getattr(record, field.name)
                for field in record._meta.fields
            }

            # Clean organization name
            org_name = processed_record.get('organization', '')
            org_name = org_name.replace('DOT_', '').replace(
                '_', '').replace('–', '')
            processed_record['organization'] = org_name

            # Filter AT Siège records
            if org_name == 'AT Siège' and processed_record.get('source') not in ['DCC', 'DCGC']:
                continue

            # Convert invoice_number to numeric if it's a string
            invoice_number = processed_record.get('invoice_number', '')
            if isinstance(invoice_number, str):
                try:
                    processed_record['invoice_number'] = int(invoice_number)
                except:
                    pass

            # Replace dots with commas in monetary fields
            monetary_fields = [
                'amount_pre_tax', 'tax_amount', 'total_amount',
                'revenue_amount', 'collection_amount', 'invoice_credit_amount'
            ]

            for field in monetary_fields:
                value = processed_record.get(field)
                if isinstance(value, str):
                    processed_record[field] = value.replace('.', ',')

            # Clean payment date
            payment_date = processed_record.get('payment_date')
            if isinstance(payment_date, str):
                processed_record['payment_date'] = payment_date.replace(
                    '.', '')

            # Create combined key for duplicate detection
            combined_key = f"{org_name}_{invoice_number}_{processed_record.get('invoice_type', '')}"
            processed_record['combined_key'] = combined_key

            # Check for duplicates
            if combined_key in combined_keys:
                # Mark as duplicate
                duplicates.append(processed_record)
                # Clear certain fields in the duplicate as per requirements
                processed_record['amount_pre_tax'] = None
                processed_record['tax_amount'] = None
                processed_record['total_amount'] = None
                processed_record['revenue_amount'] = None
            else:
                combined_keys[combined_key] = True

            processed_data.append(processed_record)

        # Sort by organization and invoice_number
        processed_data.sort(key=lambda x: (
            x.get('organization', ''), x.get('invoice_number', '')))

        return processed_data, duplicates

    def match_journal_ventes_etat_facture_advanced(self, journal_data, etat_data, objectives=None, previous_year_data=None):
        """
        Advanced matching of Journal des Ventes and État de Facture with evolution and achievement rates.

        This method extends the basic matching functionality by adding:
        1. Evolution rates - comparing current data with previous year data
        2. Achievement rates - comparing current data with objectives
        3. Detailed organization-level analysis
        4. Trend analysis for collection rates

        Args:
            journal_data: Processed Journal des Ventes data
            etat_data: Processed État de Facture data
            objectives: Revenue and collection objectives by organization (optional)
            previous_year_data: Previous year's matched data for comparison (optional)

        Returns:
            matched_data: Combined data with KPIs, evolution rates, and achievement rates
            missing_invoices: Invoices in one dataset but not the other
            kpi_summary: Comprehensive summary of KPIs and performance metrics
        """
        logger.info(
            "Performing advanced matching of Journal des Ventes and État de Facture data")

        try:
            # First perform the basic matching
            combined_data, missing_invoices, basic_kpi_summary = self.match_journal_ventes_etat_facture(
                journal_data, etat_data
            )

            # Convert to DataFrame for advanced processing
            df = pd.DataFrame(combined_data)

            if df.empty:
                logger.warning("No matched data to perform advanced analysis")
                return combined_data, missing_invoices, basic_kpi_summary

            # Initialize advanced KPI summary
            advanced_kpi_summary = basic_kpi_summary.copy()
            advanced_kpi_summary['evolution_rates'] = {}
            advanced_kpi_summary['achievement_rates'] = {}

            # Calculate evolution rates if previous year data is available
            if previous_year_data:
                prev_df = pd.DataFrame(previous_year_data)

                if not prev_df.empty:
                    # Calculate overall evolution rates
                    current_revenue = df['revenue_amount_journal'].sum()
                    prev_revenue = prev_df['revenue_amount_journal'].sum()

                    current_collection = df['collection_amount_etat'].sum()
                    prev_collection = prev_df['collection_amount_etat'].sum()

                    # Revenue evolution rate
                    revenue_evolution = (
                        (current_revenue - prev_revenue) / prev_revenue) * 100 if prev_revenue > 0 else 0

                    # Collection evolution rate
                    collection_evolution = (
                        (current_collection - prev_collection) / prev_collection) * 100 if prev_collection > 0 else 0

                    # Store overall evolution rates
                    advanced_kpi_summary['evolution_rates']['overall'] = {
                        'revenue_evolution_rate': float(revenue_evolution),
                        'collection_evolution_rate': float(collection_evolution)
                    }

                    # Calculate organization-level evolution rates
                    if 'organization_journal' in df.columns:
                        org_evolution = {}

                        for org, group in df.groupby('organization_journal'):
                            if org and not pd.isna(org):
                                # Get previous year data for this organization
                                prev_org_data = prev_df[prev_df['organization_journal'] == org]

                                if not prev_org_data.empty:
                                    # Current year metrics
                                    org_revenue = group['revenue_amount_journal'].sum(
                                    )
                                    org_collection = group['collection_amount_etat'].sum(
                                    )

                                    # Previous year metrics
                                    prev_org_revenue = prev_org_data['revenue_amount_journal'].sum(
                                    )
                                    prev_org_collection = prev_org_data['collection_amount_etat'].sum(
                                    )

                                    # Calculate evolution rates
                                    org_revenue_evolution = (
                                        (org_revenue - prev_org_revenue) / prev_org_revenue) * 100 if prev_org_revenue > 0 else 0
                                    org_collection_evolution = (
                                        (org_collection - prev_org_collection) / prev_org_collection) * 100 if prev_org_collection > 0 else 0

                                    # Store organization evolution rates
                                    org_evolution[org] = {
                                        'revenue_evolution_rate': float(org_revenue_evolution),
                                        'collection_evolution_rate': float(org_collection_evolution),
                                        'previous_year_revenue': float(prev_org_revenue),
                                        'previous_year_collection': float(prev_org_collection)
                                    }

                        advanced_kpi_summary['evolution_rates']['by_organization'] = org_evolution

            # Calculate achievement rates if objectives are available
            if objectives:
                # Initialize achievement rates
                achievement_rates = {
                    'overall': {
                        'revenue_achievement_rate': 0,
                        'collection_achievement_rate': 0
                    },
                    'by_organization': {}
                }

                # Extract overall objectives if available
                overall_objective = next(
                    (obj for obj in objectives if obj.get('organization') == 'Overall'), None)

                if overall_objective:
                    # Calculate overall achievement rates
                    revenue_objective = overall_objective.get(
                        'revenue_objective', 0)
                    collection_objective = overall_objective.get(
                        'collection_objective', 0)

                    current_revenue = df['revenue_amount_journal'].sum()
                    current_collection = df['collection_amount_etat'].sum()

                    # Revenue achievement rate
                    revenue_achievement = (
                        current_revenue / revenue_objective) * 100 if revenue_objective > 0 else 0

                    # Collection achievement rate
                    collection_achievement = (
                        current_collection / collection_objective) * 100 if collection_objective > 0 else 0

                    # Store overall achievement rates
                    achievement_rates['overall'] = {
                        'revenue_achievement_rate': float(revenue_achievement),
                        'collection_achievement_rate': float(collection_achievement),
                        'revenue_objective': float(revenue_objective),
                        'collection_objective': float(collection_objective)
                    }

                # Calculate organization-level achievement rates
                if 'organization_journal' in df.columns:
                    for org, group in df.groupby('organization_journal'):
                        if org and not pd.isna(org):
                            # Find objective for this organization
                            org_objective = next(
                                (obj for obj in objectives if obj.get('organization') == org), None)

                            if org_objective:
                                # Extract objectives
                                org_revenue_objective = org_objective.get(
                                    'revenue_objective', 0)
                                org_collection_objective = org_objective.get(
                                    'collection_objective', 0)

                                # Current metrics
                                org_revenue = group['revenue_amount_journal'].sum(
                                )
                                org_collection = group['collection_amount_etat'].sum(
                                )

                                # Calculate achievement rates
                                org_revenue_achievement = (
                                    org_revenue / org_revenue_objective) * 100 if org_revenue_objective > 0 else 0
                                org_collection_achievement = (
                                    org_collection / org_collection_objective) * 100 if org_collection_objective > 0 else 0

                                # Store organization achievement rates
                                achievement_rates['by_organization'][org] = {
                                    'revenue_achievement_rate': float(org_revenue_achievement),
                                    'collection_achievement_rate': float(org_collection_achievement),
                                    'revenue_objective': float(org_revenue_objective),
                                    'collection_objective': float(org_collection_objective)
                                }

                advanced_kpi_summary['achievement_rates'] = achievement_rates

            # Add flags to the combined data for special cases
            for i, record in enumerate(combined_data):
                # Add evolution rate flags if previous year data is available
                if previous_year_data:
                    # Find matching record in previous year data
                    prev_record = next((
                        item for item in previous_year_data
                        if (item.get('organization_journal') == record.get('organization_journal') and
                            item.get('invoice_number_journal') == record.get('invoice_number_journal'))
                    ), None)

                    if prev_record:
                        # Calculate invoice-level evolution rates
                        current_revenue = record.get(
                            'revenue_amount_journal', 0) or 0
                        prev_revenue = prev_record.get(
                            'revenue_amount_journal', 0) or 0

                        revenue_evolution = (
                            (current_revenue - prev_revenue) / prev_revenue) * 100 if prev_revenue > 0 else 0

                        # Add evolution rate to the record
                        combined_data[i]['revenue_evolution_rate'] = revenue_evolution

                        # Flag significant changes (more than 20% increase or decrease)
                        combined_data[i]['significant_revenue_change'] = abs(
                            revenue_evolution) > 20

                # Add achievement rate flags if objectives are available
                if objectives and 'organization_journal' in df.columns:
                    for i, record in enumerate(combined_data):
                        org = record.get('organization_journal')

                        # Find objective for this organization
                        org_objective = next(
                            (obj for obj in objectives if obj.get('organization') == org), None)

                        if org_objective:
                            # Calculate pro-rated objective for this invoice
                            # This is a simplification - in reality, you might want to distribute objectives differently
                            org_revenue = advanced_kpi_summary['organization_kpis'].get(
                                org, {}).get('total_revenue', 0)
                            invoice_revenue = record.get(
                                'revenue_amount_journal', 0) or 0

                            # Calculate the invoice's share of the organization's revenue
                            revenue_share = invoice_revenue / org_revenue if org_revenue > 0 else 0

                            # Pro-rate the objective
                            revenue_objective = org_objective.get(
                                'revenue_objective', 0) * revenue_share

                            # Calculate achievement rate
                            achievement_rate = (
                                invoice_revenue / revenue_objective) * 100 if revenue_objective > 0 else 0

                            # Add achievement rate to the record
                            combined_data[i]['revenue_achievement_rate'] = achievement_rate

                            # Flag underperforming invoices (less than 80% of objective)
                            combined_data[i]['underperforming'] = achievement_rate < 80

            return combined_data, missing_invoices, advanced_kpi_summary

        except Exception as e:
            logger.error(
                f"Error in advanced matching of Journal des Ventes and État de Facture data: {str(e)}")
            logger.error(traceback.format_exc())
            return [], [], {"error": str(e)}

    def process_ngbss_collection(self, raw_data):
        """
        Process NGBSS Collection data for both current and previous years

        Args:
            raw_data: Raw data from file processor

        Returns:
            cleaned_data: Filtered and cleaned data
            anomalies: Anomalies detected during processing
            summary: Summary statistics
        """
        logger.info("Processing NGBSS Collection data")

        if raw_data.empty:
            logger.warning("Empty NGBSS Collection data")
            return raw_data, self.anomalies['ngbss_collection'], {"processed": 0}

        # Make a copy to avoid modifying the original
        data = raw_data.copy()

        # Clean and standardize column names
        data.columns = [col.strip().upper() for col in data.columns]

        # Ensure required columns exist
        required_columns = ['DOT', 'ORGANIZATION',
                            'INVOICE_NUMBER', 'PAYMENT_DATE', 'COLLECTION_AMOUNT']
        missing_columns = [
            col for col in required_columns if col not in data.columns]
        if missing_columns:
            logger.error(
                f"Missing required columns in NGBSS Collection data: {missing_columns}")
            return data, self.anomalies['ngbss_collection'], {"processed": 0, "error": f"Missing columns: {missing_columns}"}

        # Convert date columns
        if 'PAYMENT_DATE' in data.columns:
            data['PAYMENT_DATE'] = pd.to_datetime(
                data['PAYMENT_DATE'], errors='coerce')

        if 'INVOICE_DATE' in data.columns:
            data['INVOICE_DATE'] = pd.to_datetime(
                data['INVOICE_DATE'], errors='coerce')

        # Extract year and month from payment date
        if 'PAYMENT_DATE' in data.columns:
            data['YEAR'] = data['PAYMENT_DATE'].dt.year
            data['MONTH'] = data['PAYMENT_DATE'].dt.month

        # Determine if collection is from previous year
        current_year = datetime.now().year
        if 'YEAR' in data.columns:
            data['IS_PREVIOUS_YEAR'] = data['YEAR'] < current_year

        # Detect anomalies
        self._detect_ngbss_collection_anomalies(data)

        # Filter data according to business rules
        filtered_data = self.filter_ngbss_collection(data)

        # Calculate summary statistics
        summary = {
            "total_records": len(data),
            "processed_records": len(filtered_data),
            "current_year_collections": filtered_data[~filtered_data['IS_PREVIOUS_YEAR']]['COLLECTION_AMOUNT'].sum() if 'IS_PREVIOUS_YEAR' in filtered_data.columns else 0,
            "previous_year_collections": filtered_data[filtered_data['IS_PREVIOUS_YEAR']]['COLLECTION_AMOUNT'].sum() if 'IS_PREVIOUS_YEAR' in filtered_data.columns else 0,
            "anomalies_count": len(self.anomalies['ngbss_collection'])
        }

        logger.info(
            f"Processed {summary['processed_records']} NGBSS Collection records")
        return filtered_data, self.anomalies['ngbss_collection'], summary

    def process_unfinished_invoice(self, raw_data):
        """
        Process Unfinished Invoice data

        Args:
            raw_data: Raw data from file processor

        Returns:
            cleaned_data: Filtered and cleaned data
            anomalies: Anomalies detected during processing
            summary: Summary statistics
        """
        logger.info("Processing Unfinished Invoice data")

        if raw_data.empty:
            logger.warning("Empty Unfinished Invoice data")
            return raw_data, self.anomalies['unfinished_invoice'], {"processed": 0}

        # Make a copy to avoid modifying the original
        data = raw_data.copy()

        # Clean and standardize column names
        data.columns = [col.strip().upper() for col in data.columns]

        # Ensure required columns exist
        required_columns = ['DOT', 'INVOICE_NUMBER', 'INVOICE_DATE', 'STATUS']
        missing_columns = [
            col for col in required_columns if col not in data.columns]
        if missing_columns:
            logger.error(
                f"Missing required columns in Unfinished Invoice data: {missing_columns}")
            return data, self.anomalies['unfinished_invoice'], {"processed": 0, "error": f"Missing columns: {missing_columns}"}

        # Convert date columns
        if 'INVOICE_DATE' in data.columns:
            data['INVOICE_DATE'] = pd.to_datetime(
                data['INVOICE_DATE'], errors='coerce')

        # Calculate days pending
        if 'INVOICE_DATE' in data.columns:
            data['DAYS_PENDING'] = (
                datetime.now().date() - data['INVOICE_DATE'].dt.date).dt.days

        # Detect anomalies
        self._detect_unfinished_invoice_anomalies(data)

        # Calculate summary statistics
        summary = {
            "total_records": len(data),
            "processed_records": len(data),
            "avg_days_pending": data['DAYS_PENDING'].mean() if 'DAYS_PENDING' in data.columns else 0,
            "max_days_pending": data['DAYS_PENDING'].max() if 'DAYS_PENDING' in data.columns else 0,
            "anomalies_count": len(self.anomalies['unfinished_invoice'])
        }

        logger.info(
            f"Processed {summary['processed_records']} Unfinished Invoice records")
        return data, self.anomalies['unfinished_invoice'], summary

    def _detect_ngbss_collection_anomalies(self, data):
        """
        Detect anomalies in NGBSS Collection data

        Args:
            data: DataFrame containing NGBSS Collection data
        """
        # Check for empty fields in important columns
        for index, row in data.iterrows():
            # Check for missing values in critical fields
            if pd.isna(row.get('DOT')) or pd.isna(row.get('INVOICE_NUMBER')) or pd.isna(row.get('PAYMENT_DATE')) or pd.isna(row.get('COLLECTION_AMOUNT')):
                self.anomalies['ngbss_collection'].append({
                    'type': 'missing_data',
                    'description': f"Missing critical data in row {index}",
                    'row_index': index,
                    'data': row.to_dict()
                })

            # Check for zero or negative collection amounts
            if 'COLLECTION_AMOUNT' in row and not pd.isna(row['COLLECTION_AMOUNT']):
                if row['COLLECTION_AMOUNT'] <= 0:
                    self.anomalies['ngbss_collection'].append({
                        'type': 'invalid_data',
                        'description': f"Zero or negative collection amount: {row['COLLECTION_AMOUNT']}",
                        'row_index': index,
                        'data': row.to_dict()
                    })

            # Check for future payment dates
            if 'PAYMENT_DATE' in row and not pd.isna(row['PAYMENT_DATE']):
                if row['PAYMENT_DATE'].date() > datetime.now().date():
                    self.anomalies['ngbss_collection'].append({
                        'type': 'invalid_data',
                        'description': f"Future payment date: {row['PAYMENT_DATE']}",
                        'row_index': index,
                        'data': row.to_dict()
                    })

    def _detect_unfinished_invoice_anomalies(self, data):
        """
        Detect anomalies in Unfinished Invoice data

        Args:
            data: DataFrame containing Unfinished Invoice data
        """
        # Check for empty fields in important columns
        for index, row in data.iterrows():
            # Check for missing values in critical fields
            if pd.isna(row.get('DOT')) or pd.isna(row.get('INVOICE_NUMBER')) or pd.isna(row.get('INVOICE_DATE')) or pd.isna(row.get('STATUS')):
                self.anomalies['unfinished_invoice'].append({
                    'type': 'missing_data',
                    'description': f"Missing critical data in row {index}",
                    'row_index': index,
                    'data': row.to_dict()
                })

            # Check for future invoice dates
            if 'INVOICE_DATE' in row and not pd.isna(row['INVOICE_DATE']):
                if row['INVOICE_DATE'].date() > datetime.now().date():
                    self.anomalies['unfinished_invoice'].append({
                        'type': 'invalid_data',
                        'description': f"Future invoice date: {row['INVOICE_DATE']}",
                        'row_index': index,
                        'data': row.to_dict()
                    })

            # Check for very old unfinished invoices (more than 1 year)
            if 'DAYS_PENDING' in row and not pd.isna(row['DAYS_PENDING']):
                if row['DAYS_PENDING'] > 365:
                    self.anomalies['unfinished_invoice'].append({
                        'type': 'outlier',
                        'description': f"Very old unfinished invoice: {row['DAYS_PENDING']} days",
                        'row_index': index,
                        'data': row.to_dict()
                    })

    def filter_ngbss_collection(self, data):
        """
        Apply business rules to filter NGBSS Collection data

        Args:
            data: DataFrame containing NGBSS Collection data

        Returns:
            filtered_data: DataFrame after applying business rules
        """
        # Make a copy to avoid modifying the original
        filtered_data = data.copy()

        # Apply the same filtering logic as for encaissements NGBSS
        # Keep the same mode of operation as for créances NGBSS

        # Filter by product if the column exists
        if 'PRODUCT' in filtered_data.columns:
            filtered_data = filtered_data[
                filtered_data['PRODUCT'].isin(['Specialized Line', 'LTE'])
            ]

        # Filter by customer level 1 if the column exists
        if 'CUSTOMER_LEV1' in filtered_data.columns:
            filtered_data = filtered_data[
                filtered_data['CUSTOMER_LEV1'].isin(
                    ['Corporate', 'Corporate Group'])
            ]

        # Filter by customer level 2 if the column exists
        if 'CUSTOMER_LEV2' in filtered_data.columns:
            filtered_data = filtered_data[
                ~filtered_data['CUSTOMER_LEV2'].str.contains(
                    'Client professionnelConventionné', na=False)
            ]

        # Filter by customer level 3 if the column exists
        if 'CUSTOMER_LEV3' in filtered_data.columns:
            valid_values = [
                'Ligne d\'exploitation AP',
                'Ligne d\'exploitation ATMobilis',
                'Ligne d\'exploitation ATS'
            ]
            filtered_data = filtered_data[
                filtered_data['CUSTOMER_LEV3'].isin(valid_values)
            ]

        return filtered_data

    def generate_dashboard_data(self, journal_data, etat_data, parc_data=None, historical_data=None, period_count=6):
        """
        Generate enhanced dashboard data with advanced analytics and visualizations.

        Features:
        1. Identify structures with zero CA or zero collections
        2. Top/Flop structure rankings by revenue and collection
        3. Visualization data for offer quantities and physical park
        4. Trend analysis for CA, collections, and receivables

        Args:
            journal_data: Processed Journal des Ventes data
            etat_data: Processed État de Facture data
            parc_data: Processed Parc Corporate data (optional)
            historical_data: Historical data for trend analysis (optional)
            period_count: Number of periods to include in trend analysis (default: 6)

        Returns:
            dashboard_data: Comprehensive dashboard data with all enhancements
        """
        logger.info("Generating enhanced dashboard data")

        try:
            # Initialize dashboard data structure
            dashboard_data = {
                'zero_structures': {
                    'zero_ca': [],
                    'zero_collections': []
                },
                'rankings': {
                    'top_revenue': [],
                    'bottom_revenue': [],
                    'top_collection': [],
                    'bottom_collection': [],
                    'top_collection_rate': [],
                    'bottom_collection_rate': []
                },
                'offer_quantities': {},
                'physical_park': {},
                'trends': {
                    'ca': [],
                    'collections': [],
                    'receivables': []
                }
            }

            # First, match journal and etat data to get a unified view
            matched_data, missing_invoices, kpi_summary = self.match_journal_ventes_etat_facture(
                journal_data, etat_data
            )

            # Convert to DataFrame for easier analysis
            df = pd.DataFrame(matched_data) if matched_data else pd.DataFrame()

            if df.empty:
                logger.warning("No data available for dashboard generation")
                return dashboard_data

            # 1. Identify structures with zero CA or zero collections
            # Group by organization
            if 'organization_journal' in df.columns:
                org_metrics = df.groupby('organization_journal').agg({
                    'revenue_amount_journal': 'sum',
                    'collection_amount_etat': 'sum'
                }).reset_index()

                # Identify organizations with zero CA
                zero_ca_orgs = org_metrics[org_metrics['revenue_amount_journal'] == 0]
                dashboard_data['zero_structures']['zero_ca'] = zero_ca_orgs['organization_journal'].tolist(
                )

                # Identify organizations with zero collections
                zero_collection_orgs = org_metrics[org_metrics['collection_amount_etat'] == 0]
                dashboard_data['zero_structures']['zero_collections'] = zero_collection_orgs['organization_journal'].tolist(
                )

                # Calculate collection rate for each organization
                org_metrics['collection_rate'] = org_metrics.apply(
                    lambda x: (x['collection_amount_etat'] /
                               x['revenue_amount_journal']) * 100
                    if x['revenue_amount_journal'] > 0 else 0,
                    axis=1
                )

                # 2. Top/Flop structure rankings
                # Sort by revenue (descending)
                top_revenue = org_metrics.sort_values(
                    'revenue_amount_journal', ascending=False).head(5)
                dashboard_data['rankings']['top_revenue'] = [
                    {
                        'organization': row['organization_journal'],
                        'revenue': float(row['revenue_amount_journal']),
                        'percentage': float(row['revenue_amount_journal'] / org_metrics['revenue_amount_journal'].sum() * 100)
                    }
                    for _, row in top_revenue.iterrows()
                ]

                # Sort by revenue (ascending) for bottom performers
                bottom_revenue = org_metrics.sort_values(
                    'revenue_amount_journal', ascending=True).head(5)
                dashboard_data['rankings']['bottom_revenue'] = [
                    {
                        'organization': row['organization_journal'],
                        'revenue': float(row['revenue_amount_journal']),
                        'percentage': float(row['revenue_amount_journal'] / org_metrics['revenue_amount_journal'].sum() * 100)
                    }
                    for _, row in bottom_revenue.iterrows()
                ]

                # Sort by collection (descending)
                top_collection = org_metrics.sort_values(
                    'collection_amount_etat', ascending=False).head(5)
                dashboard_data['rankings']['top_collection'] = [
                    {
                        'organization': row['organization_journal'],
                        'collection': float(row['collection_amount_etat']),
                        'percentage': float(row['collection_amount_etat'] / org_metrics['collection_amount_etat'].sum() * 100)
                    }
                    for _, row in top_collection.iterrows()
                ]

                # Sort by collection (ascending) for bottom performers
                bottom_collection = org_metrics.sort_values(
                    'collection_amount_etat', ascending=True).head(5)
                dashboard_data['rankings']['bottom_collection'] = [
                    {
                        'organization': row['organization_journal'],
                        'collection': float(row['collection_amount_etat']),
                        'percentage': float(row['collection_amount_etat'] / org_metrics['collection_amount_etat'].sum() * 100)
                    }
                    for _, row in bottom_collection.iterrows()
                ]

                # Sort by collection rate (descending)
                # Filter out organizations with zero revenue to avoid misleading rates
                non_zero_revenue = org_metrics[org_metrics['revenue_amount_journal'] > 0]
                top_rate = non_zero_revenue.sort_values(
                    'collection_rate', ascending=False).head(5)
                dashboard_data['rankings']['top_collection_rate'] = [
                    {
                        'organization': row['organization_journal'],
                        'rate': float(row['collection_rate']),
                        'revenue': float(row['revenue_amount_journal']),
                        'collection': float(row['collection_amount_etat'])
                    }
                    for _, row in top_rate.iterrows()
                ]

                # Sort by collection rate (ascending) for bottom performers
                bottom_rate = non_zero_revenue.sort_values(
                    'collection_rate', ascending=True).head(5)
                dashboard_data['rankings']['bottom_collection_rate'] = [
                    {
                        'organization': row['organization_journal'],
                        'rate': float(row['collection_rate']),
                        'revenue': float(row['revenue_amount_journal']),
                        'collection': float(row['collection_amount_etat'])
                    }
                    for _, row in bottom_rate.iterrows()
                ]

            # 3. Visualization data for offer quantities and physical park
            if parc_data:
                parc_df = pd.DataFrame(parc_data)

                if not parc_df.empty:
                    # Offer quantities by offer type
                    if 'offer_type' in parc_df.columns:
                        offer_counts = parc_df['offer_type'].value_counts(
                        ).to_dict()
                        dashboard_data['offer_quantities'] = {
                            'by_offer_type': offer_counts,
                            'total': len(parc_df)
                        }

                    # Physical park by customer level and telecom type
                    if 'customer_l1_desc' in parc_df.columns and 'telecom_type' in parc_df.columns:
                        # Group by customer level 1 and telecom type
                        park_distribution = parc_df.groupby(
                            ['customer_l1_desc', 'telecom_type']).size().reset_index(name='count')

                        # Convert to nested dictionary structure
                        for _, row in park_distribution.iterrows():
                            customer = row['customer_l1_desc']
                            telecom = row['telecom_type']
                            count = row['count']

                            if customer not in dashboard_data['physical_park']:
                                dashboard_data['physical_park'][customer] = {}

                            dashboard_data['physical_park'][customer][telecom] = count

                    # Add subscriber status distribution
                    if 'subscriber_status' in parc_df.columns:
                        status_counts = parc_df['subscriber_status'].value_counts(
                        ).to_dict()
                        dashboard_data['physical_park']['status_distribution'] = status_counts

            # 4. Trend analysis for CA, collections, and receivables
            if historical_data:
                # Ensure historical_data is a list of period data
                if isinstance(historical_data, list) and len(historical_data) > 0:
                    # Combine current period with historical data
                    all_periods = historical_data.copy()

                    # Add current period data if not already included
                    current_period = {
                        'period': 'Current',
                        'total_revenue': float(df['revenue_amount_journal'].sum()),
                        'total_collection': float(df['collection_amount_etat'].sum() if 'collection_amount_etat' in df.columns else 0),
                        'total_receivables': float(df['revenue_amount_journal'].sum() - df['collection_amount_etat'].sum()
                                                   if 'collection_amount_etat' in df.columns else df['revenue_amount_journal'].sum())
                    }

                    # Check if current period is already in historical data
                    if not any(period.get('period') == 'Current' for period in all_periods):
                        all_periods.append(current_period)

                    # Sort periods chronologically (assuming they have a 'period' field)
                    all_periods.sort(key=lambda x: x.get('period', ''))

                    # Limit to the requested number of periods
                    recent_periods = all_periods[-period_count:] if len(
                        all_periods) > period_count else all_periods

                    # Extract trend data
                    dashboard_data['trends']['ca'] = [
                        {'period': period.get('period', f'Period {i}'), 'value': period.get(
                            'total_revenue', 0)}
                        for i, period in enumerate(recent_periods)
                    ]

                    dashboard_data['trends']['collections'] = [
                        {'period': period.get('period', f'Period {i}'), 'value': period.get(
                            'total_collection', 0)}
                        for i, period in enumerate(recent_periods)
                    ]

                    dashboard_data['trends']['receivables'] = [
                        {'period': period.get('period', f'Period {i}'), 'value': period.get(
                            'total_receivables', 0)}
                        for i, period in enumerate(recent_periods)
                    ]

                    # Calculate growth rates
                    if len(recent_periods) >= 2:
                        current = recent_periods[-1]
                        previous = recent_periods[-2]

                        # Revenue growth rate
                        if previous.get('total_revenue', 0) > 0:
                            revenue_growth = ((current.get('total_revenue', 0) - previous.get('total_revenue', 0)) /
                                              previous.get('total_revenue', 0)) * 100
                        else:
                            revenue_growth = 0

                        # Collection growth rate
                        if previous.get('total_collection', 0) > 0:
                            collection_growth = ((current.get('total_collection', 0) - previous.get('total_collection', 0)) /
                                                 previous.get('total_collection', 0)) * 100
                        else:
                            collection_growth = 0

                        # Receivables growth rate
                        if previous.get('total_receivables', 0) > 0:
                            receivables_growth = ((current.get('total_receivables', 0) - previous.get('total_receivables', 0)) /
                                                  previous.get('total_receivables', 0)) * 100
                        else:
                            receivables_growth = 0

                        dashboard_data['trends']['growth_rates'] = {
                            'revenue_growth': float(revenue_growth),
                            'collection_growth': float(collection_growth),
                            'receivables_growth': float(receivables_growth)
                        }

            # Add summary statistics
            dashboard_data['summary'] = {
                'total_organizations': len(org_metrics) if 'org_metrics' in locals() else 0,
                'total_revenue': float(df['revenue_amount_journal'].sum() if 'revenue_amount_journal' in df.columns else 0),
                'total_collection': float(df['collection_amount_etat'].sum() if 'collection_amount_etat' in df.columns else 0),
                'overall_collection_rate': float((df['collection_amount_etat'].sum() / df['revenue_amount_journal'].sum()) * 100
                                                 if 'collection_amount_etat' in df.columns and df['revenue_amount_journal'].sum() > 0
                                                 else 0),
                'zero_ca_count': len(dashboard_data['zero_structures']['zero_ca']),
                'zero_collection_count': len(dashboard_data['zero_structures']['zero_collections'])
            }

            return dashboard_data

        except Exception as e:
            logger.error(f"Error generating dashboard data: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                'error': str(e),
                'zero_structures': {'zero_ca': [], 'zero_collections': []},
                'rankings': {},
                'offer_quantities': {},
                'physical_park': {},
                'trends': {'ca': [], 'collections': [], 'receivables': []}
            }
