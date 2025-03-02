import pandas as pd
import numpy as np
import os
import re
import logging

logger = logging.getLogger(__name__)


class FileTypeDetector:
    """Detects file types based on content and filename"""

    @staticmethod
    def detect_file_type(file_path, file_name):
        """
        Detect file type based on content and filename
        Returns: file_type, detection_confidence, suggested_algorithm
        """
        file_name_lower = file_name.lower()

        # Try to detect from filename first
        if "facturation manuelle ar" in file_name_lower:
            return "facturation_manuelle", 0.9, "process_facturation_manuelle"
        elif "parc corporate ngbss" in file_name_lower:
            return "parc_corporate", 0.9, "process_parc_corporate"
        elif "créances ngbss" in file_name_lower or "creances ngbss" in file_name_lower:
            return "creances_ngbss", 0.9, "process_creances_ngbss"
        elif "ca cnt" in file_name_lower:
            return "ca_cnt", 0.9, "process_ca_cnt"
        elif "ca rfd" in file_name_lower:
            return "ca_rfd", 0.9, "process_ca_rfd"
        elif "ca dnt" in file_name_lower:
            return "ca_dnt", 0.9, "process_ca_dnt"
        elif "ca non periodique" in file_name_lower:
            return "ca_non_periodique", 0.9, "process_ca_non_periodique"
        elif "ca periodique" in file_name_lower:
            return "ca_periodique", 0.9, "process_ca_periodique"
        elif "etat de facture et encaissement" in file_name_lower:
            return "etat_facture", 0.9, "process_etat_facture"
        elif "journal des ventes" in file_name_lower:
            return "journal_ventes", 0.9, "process_journal_ventes"

        # If filename doesn't give enough info, check content
        try:
            # For Excel files
            if file_path.endswith(('.xlsx', '.xls')):
                df = pd.read_excel(file_path, nrows=5)
                columns = [str(col).lower() for col in df.columns]

                # Check for Facturation Manuelle AR
                if "mois" in columns and "date de facture" in columns and "n° factures" in columns:
                    return "facturation_manuelle", 0.8, "process_facturation_manuelle"

                # Check for Etat de facture
                if "n fact" in columns and "typ fact" in columns and "date fact" in columns:
                    if "facture avoir / annulation" in columns:
                        return "etat_facture", 0.8, "process_etat_facture"
                    else:
                        return "journal_ventes", 0.8, "process_journal_ventes"

            # For CSV files
            elif file_path.endswith('.csv'):
                # Try to read with different delimiters
                for delimiter in [';', ',']:
                    try:
                        df = pd.read_csv(
                            file_path, delimiter=delimiter, nrows=5)
                        columns = [str(col).lower() for col in df.columns]

                        # Check for CA periodique
                        if "do" in columns and "produit" in columns and "ht" in columns and "ttc" in columns and "discount" in columns:
                            return "ca_periodique", 0.8, "process_ca_periodique"

                        # Check for CA non periodique
                        if "do" in columns and "produit" in columns and "ht" in columns and "ttc" in columns and "type_vente" in columns:
                            return "ca_non_periodique", 0.8, "process_ca_non_periodique"

                        # Check for Parc Corporate
                        if "actel_code" in columns and "telecom_type" in columns and "offer_type" in columns:
                            return "parc_corporate", 0.8, "process_parc_corporate"

                        # Check for Créances NGBSS
                        if "dot" in columns and "actel" in columns and "mois" in columns and "invoice_amt" in columns:
                            return "creances_ngbss", 0.8, "process_creances_ngbss"

                        # Check for CA CNT
                        if "invoice_adjusted" in columns and "pri_identity" in columns and "trans_type" in columns:
                            if any(col for col in columns if "cnt" in col):
                                return "ca_cnt", 0.8, "process_ca_cnt"

                        # Check for CA RFD
                        if "trans_id" in columns and "full_name" in columns and "droit_timbre" in columns:
                            return "ca_rfd", 0.8, "process_ca_rfd"

                        # Check for CA DNT
                        if "pri_identity" in columns and "trans_type" in columns:
                            if any(col for col in columns if "dnt" in col):
                                return "ca_dnt", 0.8, "process_ca_dnt"

                    except Exception:
                        continue

        except Exception as e:
            logger.error(f"Error detecting file type: {str(e)}")

        # Default if no specific type detected
        return "unknown", 0.3, "process_generic"


class FileProcessor:
    """Processes files based on their detected type"""

    @staticmethod
    def process_file(file_path, file_name):
        """
        Process a file based on its detected type
        Returns: processing_result, summary_data
        """
        detector = FileTypeDetector()
        file_type, confidence, algorithm = detector.detect_file_type(
            file_path, file_name)

        # Call the appropriate processing method based on the detected algorithm
        processing_method = getattr(
            FileProcessor, algorithm, FileProcessor.process_generic)
        result, summary = processing_method(file_path)

        # Add detected file type to summary
        if summary and isinstance(summary, dict):
            summary['detected_file_type'] = file_type

        return result, summary

    @staticmethod
    def process_facturation_manuelle(file_path):
        """Process Facturation Manuelle AR Excel files"""
        try:
            df = pd.read_excel(file_path, skiprows=1)  # Skip the title row

            # Clean up column names
            df.columns = [col.strip() for col in df.columns]

            # Basic processing
            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "total_montant_ht": float(df["Montant  HT"].sum()) if "Montant  HT" in df.columns else 0,
                "total_montant_ttc": float(df["Montant TTC"].sum()) if "Montant TTC" in df.columns else 0,
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                # Add numeric stats if applicable
                if pd.api.types.is_numeric_dtype(df[col]):
                    col_info.update({
                        "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                    })

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(f"Error processing Facturation Manuelle: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}

    @staticmethod
    def process_ca_periodique(file_path):
        """Process CA periodique CSV files"""
        try:
            df = pd.read_csv(file_path, delimiter=';')

            # Clean up column names and values
            df.columns = [col.strip() for col in df.columns]

            # Convert numeric columns
            for col in ['HT', 'TAX', 'TTC', 'DISCOUNT']:
                if col in df.columns:
                    # Remove spaces and replace commas with dots
                    df[col] = df[col].astype(str).str.replace(
                        ' ', '').str.replace(',', '.')
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate totals by product
            product_summary = df.groupby('PRODUIT').agg({
                'HT': 'sum',
                'TAX': 'sum',
                'TTC': 'sum'
            }).reset_index()

            # Calculate totals by DO (Direction Opérationnelle)
            do_summary = df.groupby('DO').agg({
                'HT': 'sum',
                'TAX': 'sum',
                'TTC': 'sum'
            }).reset_index()

            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "total_ht": float(df['HT'].sum()),
                "total_tax": float(df['TAX'].sum()),
                "total_ttc": float(df['TTC'].sum()),
                "product_summary": product_summary.to_dict('records'),
                "do_summary": do_summary.to_dict('records'),
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                # Add numeric stats if applicable
                if pd.api.types.is_numeric_dtype(df[col]):
                    col_info.update({
                        "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                    })

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(f"Error processing CA Periodique: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}

    @staticmethod
    def process_ca_non_periodique(file_path):
        """Process CA non periodique CSV files"""
        try:
            df = pd.read_csv(file_path, delimiter=';')

            # Clean up column names and values
            df.columns = [col.strip() for col in df.columns]

            # Convert numeric columns
            for col in ['HT', 'TAX', 'TTC']:
                if col in df.columns:
                    # Remove spaces and replace commas with dots
                    df[col] = df[col].astype(str).str.replace(
                        ' ', '').str.replace(',', '.')
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate totals by product and channel
            product_summary = df.groupby('PRODUIT').agg({
                'HT': 'sum',
                'TAX': 'sum',
                'TTC': 'sum'
            }).reset_index()

            channel_summary = df.groupby('CHANNEL').agg({
                'HT': 'sum',
                'TAX': 'sum',
                'TTC': 'sum'
            }).reset_index() if 'CHANNEL' in df.columns else None

            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "total_ht": float(df['HT'].sum()),
                "total_tax": float(df['TAX'].sum()),
                "total_ttc": float(df['TTC'].sum()),
                "product_summary": product_summary.to_dict('records'),
                "channel_summary": channel_summary.to_dict('records') if channel_summary is not None else None,
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                # Add numeric stats if applicable
                if pd.api.types.is_numeric_dtype(df[col]):
                    col_info.update({
                        "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                    })

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(f"Error processing CA Non Periodique: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}

    @staticmethod
    def process_ca_dnt(file_path):
        """Process CA DNT CSV files"""
        try:
            df = pd.read_csv(file_path, delimiter=';')

            # Clean up column names
            df.columns = [col.strip() for col in df.columns]

            # Convert numeric columns
            for col in ['TTC', 'TVA', 'HT']:
                if col in df.columns:
                    # Remove spaces and replace commas with dots
                    df[col] = df[col].astype(str).str.replace(
                        ' ', '').str.replace(',', '.')
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate totals by DO
            do_summary = df.groupby('DO').agg({
                'TTC': 'sum',
                'TVA': 'sum',
                'HT': 'sum'
            }).reset_index() if 'DO' in df.columns else None

            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "total_ttc": float(df['TTC'].sum()) if 'TTC' in df.columns else 0,
                "total_tva": float(df['TVA'].sum()) if 'TVA' in df.columns else 0,
                "total_ht": float(df['HT'].sum()) if 'HT' in df.columns else 0,
                "do_summary": do_summary.to_dict('records') if do_summary is not None else None,
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                # Add numeric stats if applicable
                if pd.api.types.is_numeric_dtype(df[col]):
                    col_info.update({
                        "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                    })

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(f"Error processing CA DNT: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}

    @staticmethod
    def process_ca_rfd(file_path):
        """Process CA RFD CSV files"""
        try:
            df = pd.read_csv(file_path, delimiter=';')

            # Clean up column names
            df.columns = [col.strip() for col in df.columns]

            # Convert numeric columns
            for col in ['TTC', 'DROIT_TIMBRE', 'TVA', 'HT']:
                if col in df.columns:
                    # Remove spaces and replace commas with dots
                    df[col] = df[col].astype(str).str.replace(
                        ' ', '').str.replace(',', '.')
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate totals by DO
            do_summary = df.groupby('DO').agg({
                'TTC': 'sum',
                'TVA': 'sum',
                'HT': 'sum',
                'DROIT_TIMBRE': 'sum'
            }).reset_index() if 'DO' in df.columns else None

            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "total_ttc": float(df['TTC'].sum()) if 'TTC' in df.columns else 0,
                "total_tva": float(df['TVA'].sum()) if 'TVA' in df.columns else 0,
                "total_ht": float(df['HT'].sum()) if 'HT' in df.columns else 0,
                "total_droit_timbre": float(df['DROIT_TIMBRE'].sum()) if 'DROIT_TIMBRE' in df.columns else 0,
                "do_summary": do_summary.to_dict('records') if do_summary is not None else None,
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                # Add numeric stats if applicable
                if pd.api.types.is_numeric_dtype(df[col]):
                    col_info.update({
                        "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                    })

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(f"Error processing CA RFD: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}

    @staticmethod
    def process_ca_cnt(file_path):
        """Process CA CNT CSV files"""
        try:
            df = pd.read_csv(file_path, delimiter=';')

            # Clean up column names
            df.columns = [col.strip() for col in df.columns]

            # Convert numeric columns
            for col in ['TTC', 'TVA', 'HT']:
                if col in df.columns:
                    # Remove spaces and replace commas with dots
                    df[col] = df[col].astype(str).str.replace(
                        ' ', '').str.replace(',', '.')
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate totals by DO
            do_summary = df.groupby('DO').agg({
                'TTC': 'sum',
                'TVA': 'sum',
                'HT': 'sum'
            }).reset_index() if 'DO' in df.columns else None

            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "total_ttc": float(df['TTC'].sum()) if 'TTC' in df.columns else 0,
                "total_tva": float(df['TVA'].sum()) if 'TVA' in df.columns else 0,
                "total_ht": float(df['HT'].sum()) if 'HT' in df.columns else 0,
                "do_summary": do_summary.to_dict('records') if do_summary is not None else None,
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                # Add numeric stats if applicable
                if pd.api.types.is_numeric_dtype(df[col]):
                    col_info.update({
                        "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                    })

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(f"Error processing CA CNT: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}

    @staticmethod
    def process_parc_corporate(file_path):
        """Process Parc Corporate NGBSS CSV files"""
        try:
            df = pd.read_csv(file_path, delimiter=';')

            # Clean up column names
            df.columns = [col.strip() for col in df.columns]

            # Calculate counts by telecom type
            telecom_summary = df.groupby('TELECOM_TYPE').size().reset_index(
                name='count') if 'TELECOM_TYPE' in df.columns else None

            # Calculate counts by offer type
            offer_summary = df.groupby('OFFER_TYPE').size().reset_index(
                name='count') if 'OFFER_TYPE' in df.columns else None

            # Calculate counts by customer type
            customer_summary = df.groupby('DESCRIPTION_CUSTOMER_L2').size().reset_index(
                name='count') if 'DESCRIPTION_CUSTOMER_L2' in df.columns else None

            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "telecom_summary": telecom_summary.to_dict('records') if telecom_summary is not None else None,
                "offer_summary": offer_summary.to_dict('records') if offer_summary is not None else None,
                "customer_summary": customer_summary.to_dict('records') if customer_summary is not None else None,
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(f"Error processing Parc Corporate: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}

    @staticmethod
    def process_creances_ngbss(file_path):
        """Process Créances NGBSS CSV files"""
        try:
            df = pd.read_csv(file_path, delimiter=';')

            # Clean up column names
            df.columns = [col.strip() for col in df.columns]

            # Convert numeric columns - these have spaces in them
            numeric_cols = [' INVOICE_AMT ', ' OPEN_AMT ', ' TAX_AMT ', ' INVOICE_AMT_HT ',
                            ' DISPUTE_AMT ', ' DISPUTE_TAX_AMT ', ' DISPUTE_NET_AMT ',
                            ' CREANCE_BRUT ', ' CREANCE_NET ', ' CREANCE_HT ']

            for col in numeric_cols:
                if col in df.columns:
                    # Remove spaces and replace commas with dots
                    df[col] = df[col].astype(str).str.replace(
                        ' ', '').str.replace(',', '.')
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate totals by DOT
            dot_summary = df.groupby('DOT').agg({
                ' INVOICE_AMT ': 'sum',
                ' OPEN_AMT ': 'sum',
                ' CREANCE_NET ': 'sum'
            }).reset_index() if 'DOT' in df.columns else None

            # Calculate totals by product
            product_summary = df.groupby('PRODUIT').agg({
                ' INVOICE_AMT ': 'sum',
                ' OPEN_AMT ': 'sum',
                ' CREANCE_NET ': 'sum'
            }).reset_index() if 'PRODUIT' in df.columns else None

            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "total_invoice_amt": float(df[' INVOICE_AMT '].sum()) if ' INVOICE_AMT ' in df.columns else 0,
                "total_open_amt": float(df[' OPEN_AMT '].sum()) if ' OPEN_AMT ' in df.columns else 0,
                "total_creance_net": float(df[' CREANCE_NET '].sum()) if ' CREANCE_NET ' in df.columns else 0,
                "dot_summary": dot_summary.to_dict('records') if dot_summary is not None else None,
                "product_summary": product_summary.to_dict('records') if product_summary is not None else None,
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                # Add numeric stats if applicable
                if pd.api.types.is_numeric_dtype(df[col]):
                    col_info.update({
                        "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                    })

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(f"Error processing Créances NGBSS: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}

    @staticmethod
    def process_etat_facture(file_path):
        """Process Etat de facture et encaissement Excel files"""
        try:
            # Skip the header rows
            df = pd.read_excel(file_path, skiprows=7)

            # Clean up column names
            df.columns = [col.strip() for col in df.columns]

            # Convert numeric columns
            numeric_cols = [' Montant Ht ', ' Montant Taxe ', ' Montant Ttc ',
                            ' Chiffre Aff Exe ', ' Encaissement ', ' Facture Avoir / Annulation ']

            for col in numeric_cols:
                if col in df.columns:
                    # Remove spaces and replace commas with dots
                    df[col] = df[col].astype(str).str.replace(
                        ' ', '').str.replace(',', '.')
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate totals by organization
            org_summary = df.groupby('Organisation').agg({
                ' Montant Ht ': 'sum',
                ' Montant Taxe ': 'sum',
                ' Montant Ttc ': 'sum',
                ' Encaissement ': 'sum'
            }).reset_index() if 'Organisation' in df.columns else None

            # Calculate totals by type
            type_summary = df.groupby('Type').agg({
                ' Montant Ht ': 'sum',
                ' Montant Taxe ': 'sum',
                ' Montant Ttc ': 'sum'
            }).reset_index() if 'Type' in df.columns else None

            summary = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "total_ht": float(df[' Montant Ht '].sum()),
                "total_tax": float(df[' Montant Taxe '].sum()),
                "total_ttc": float(df[' Montant Ttc '].sum()),
                "encaissement": float(df[' Encaissement '].sum()),
                "org_summary": org_summary.to_dict('records') if org_summary is not None else None,
                "type_summary": type_summary.to_dict('records') if type_summary is not None else None,
                "columns": []
            }

            # Generate column info
            for col in df.columns:
                col_info = {
                    "name": col,
                    "type": str(df[col].dtype),
                    "missing": int(df[col].isna().sum()),
                    "unique_values": int(df[col].nunique())
                }

                # Add numeric stats if applicable
                if pd.api.types.is_numeric_dtype(df[col]):
                    col_info.update({
                        "min": float(df[col].min()) if not pd.isna(df[col].min()) else None,
                        "max": float(df[col].max()) if not pd.isna(df[col].max()) else None,
                        "mean": float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                    })

                summary["columns"].append(col_info)

            # Return preview data and summary
            return df.head(10).to_dict('records'), summary

        except Exception as e:
            logger.error(
                f"Error processing Etat de facture et encaissement: {str(e)}")
            return {"error": str(e)}, {"error": str(e)}
