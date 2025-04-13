#!/usr/bin/env python
"""
Corporate Park Export API Validator

This script tests the Corporate Park export endpoints and validates the exported data.
It fetches real data from the APIs for testing and verifies the structure and content
of the exports to ensure they correctly represent the data in the system.

Usage:
  python test_corporate_park_exports.py [--auth TOKEN] [--url URL] [--format FORMAT]

Options:
  --auth TOKEN     Authentication token for API requests
  --url URL        Base URL for API (default: http://localhost:8000)
  --format FORMAT  Test specific format (excel, pdf, csv)
  --save           Save exported files to disk for inspection
"""

import requests
import json
import argparse
import sys
import os
import io
import random
import pandas as pd
import xlrd
from datetime import datetime

# Configuration


def parse_args():
    parser = argparse.ArgumentParser(
        description='Test and validate Corporate Park exports')
    parser.add_argument('--auth', dest='auth_token',
                        default='f3c764779498cfebcb0342a627d573de4cea376bc60aa2e943800e897146dc78',
                        help='Authentication token')
    parser.add_argument('--url', dest='base_url',
                        default='http://localhost:8000',
                        help='Base URL for API')
    parser.add_argument('--format', dest='format',
                        choices=['excel', 'pdf', 'csv'],
                        help='Test specific format only')
    parser.add_argument('--save', action='store_true',
                        help='Save exported files to disk')
    parser.add_argument('--save-dir', dest='save_dir',
                        default='./export_test_files',
                        help='Directory to save files')
    return parser.parse_args()


def get_headers(auth_token):
    """Get request headers with authentication"""
    headers = {'Content-Type': 'application/json'}
    if auth_token:
        headers['Authorization'] = f'Token {auth_token}'
    return headers


def fetch_parc_corporate_data(base_url, auth_token):
    """Fetch parc corporate data to compare with exports"""
    print("Fetching parc corporate data for validation...")

    headers = get_headers(auth_token)

    try:
        # First try the KPI endpoint
        response = requests.get(
            f"{base_url}/data/kpi/corporate-park/", headers=headers)

        if response.status_code == 200:
            kpi_data = response.json()
            print("Successfully fetched KPI data for validation")

            # Get total subscribers count for later validation
            total_subscribers = kpi_data.get('total_subscribers', 0)

            # Also get direct parc-corporate data to compare detailed records
            parc_response = requests.get(
                f"{base_url}/data/parc-corporate/", headers=headers)

            if parc_response.status_code == 200:
                parc_data = parc_response.json()
                print(
                    f"Successfully fetched parc-corporate data: {len(parc_data.get('results', [])) if isinstance(parc_data, dict) and 'results' in parc_data else 0} records")

                return {
                    'kpi_data': kpi_data,
                    'parc_data': parc_data,
                    'total_subscribers': total_subscribers
                }
            else:
                print(
                    f"Could not fetch parc-corporate data. Status code: {parc_response.status_code}")
                return {'kpi_data': kpi_data, 'total_subscribers': total_subscribers}

        else:
            print(
                f"Could not fetch KPI data. Status code: {response.status_code}")

            # Try the direct parc-corporate endpoint as fallback
            parc_response = requests.get(
                f"{base_url}/data/parc-corporate/", headers=headers)

            if parc_response.status_code == 200:
                parc_data = parc_response.json()
                print(
                    f"Successfully fetched parc-corporate data: {len(parc_data.get('results', [])) if isinstance(parc_data, dict) and 'results' in parc_data else 0} records")
                return {'parc_data': parc_data}

            print(f"Could not fetch any corporate park data for validation")
            return None

    except Exception as e:
        print(f"Error fetching corporate park data: {str(e)}")
        return None


def fetch_dot_data(base_url, auth_token):
    """Fetch DOT data for testing"""
    print("Fetching DOT data...")

    headers = get_headers(auth_token)
    dots = []

    try:
        # Try both possible endpoints for DOT data
        dot_endpoints = [
            "/api/auth/dots/",
            "/data/dots/"
        ]

        for endpoint in dot_endpoints:
            try:
                response = requests.get(
                    f"{base_url}{endpoint}", headers=headers)
                if response.status_code == 200:
                    data = response.json()

                    # Extract DOT codes based on the response structure
                    if isinstance(data, dict) and 'dots' in data:
                        # Format: {"dots": [{"code": "ALG", ...}, ...]}
                        dots = [dot['code']
                                for dot in data['dots'] if 'code' in dot]
                    elif isinstance(data, list):
                        # Format: [{"code": "ALG", ...}, ...]
                        dots = [dot['code'] for dot in data if 'code' in dot]

                    if dots:
                        print(
                            f"Found {len(dots)} DOTs: {dots[:5]}{' ...' if len(dots) > 5 else ''}")
                        break
            except requests.RequestException as e:
                print(f"Error fetching DOTs from {endpoint}: {str(e)}")

        # If we couldn't get DOTs, use defaults
        if not dots:
            print("Using default DOTs")
            dots = ["ALG", "ORA"]

        return dots

    except Exception as e:
        print(f"Error fetching DOTs: {str(e)}")
        return ["ALG", "ORA"]  # Default DOTs


def export_corporate_park(base_url, auth_token, format, filters=None, endpoint=None):
    """Export corporate park data with the given format and filters"""
    if endpoint is None:
        # Try both endpoints - first the new one, then fall back to the old one
        endpoints = [
            "/data/export/corporate-park/",
            "/data/reports/export/corporate_park/"
        ]
    else:
        endpoints = [endpoint]

    if filters is None:
        filters = {}

    # Add format to filters
    params = {"format": format, **filters}

    headers = get_headers(auth_token)
    headers.pop('Content-Type', None)  # Remove Content-Type for file downloads

    for endpoint in endpoints:
        try:
            print(f"Exporting corporate park data from {endpoint}")
            print(f"Parameters: {params}")

            # Use stream=True for file downloads
            response = requests.get(
                f"{base_url}{endpoint}",
                headers=headers,
                params=params,
                stream=True
            )

            if response.status_code == 200:
                print(f"Export successful!")

                # Get content info
                content_type = response.headers.get('Content-Type', '')
                content_length = response.headers.get('Content-Length', '0')
                filename = None

                # Try to get filename from Content-Disposition
                content_disposition = response.headers.get(
                    'Content-Disposition', '')
                if content_disposition:
                    import re
                    match = re.search(r'filename="(.+)"', content_disposition)
                    if match:
                        filename = match.group(1)

                print(f"Content Type: {content_type}")
                print(f"Content Length: {content_length} bytes")
                if filename:
                    print(f"Filename: {filename}")

                # Return the response for validation
                return {
                    'response': response,
                    'content_type': content_type,
                    'filename': filename,
                    'endpoint': endpoint
                }

            else:
                print(f"Export failed with status code {response.status_code}")
                if response.headers.get('Content-Type', '').startswith('application/json'):
                    try:
                        print(f"Error details: {response.json()}")
                    except:
                        print(f"Response text: {response.text[:500]}")

        except Exception as e:
            print(f"Error exporting from {endpoint}: {str(e)}")

    print("All export attempts failed")
    return None


def validate_excel_export(export_result, validation_data, save_dir=None):
    """Validate the content of an Excel export"""
    print("\nValidating Excel export...")

    if not export_result or not export_result.get('response'):
        print("No export data to validate")
        return False

    response = export_result['response']

    try:
        # Load Excel data from response content
        excel_data = pd.read_excel(io.BytesIO(response.content))

        # Check if we got data
        if excel_data.empty:
            print("Export contains no data")
            return False

        print(
            f"Export contains {len(excel_data)} rows and {len(excel_data.columns)} columns")
        print(f"Columns: {list(excel_data.columns)}")

        # Print sample data
        print("\nSample data (first 5 rows):")
        print(excel_data.head())

        # Validate against source data if available
        if validation_data and validation_data.get('total_subscribers'):
            total_subscribers = validation_data['total_subscribers']
            # Allow for some difference due to filtering
            if len(excel_data) > total_subscribers * 1.1:
                print(
                    f"WARNING: Export has more rows ({len(excel_data)}) than expected total subscribers ({total_subscribers})")
            else:
                print(
                    f"Row count validation passed: {len(excel_data)} rows exported vs {total_subscribers} total subscribers")

        # Check for essential columns
        essential_columns = [
            'DOT', 'telecom_type', 'subscriber_status', 'customer_l2_code', 'customer_l3_code'
        ]

        missing_columns = [col for col in essential_columns if not any(
            existing.lower() == col.lower() for existing in excel_data.columns)]

        if missing_columns:
            print(f"WARNING: Missing essential columns: {missing_columns}")
        else:
            print("Column validation passed: All essential columns present")

        # Save the file if requested
        if save_dir:
            if not os.path.exists(save_dir):
                os.makedirs(save_dir)

            filename = export_result.get(
                'filename') or f"corporate_park_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            file_path = os.path.join(save_dir, filename)

            with open(file_path, 'wb') as f:
                f.write(response.content)

            print(f"Saved Excel file to: {file_path}")

        return True

    except Exception as e:
        print(f"Error validating Excel export: {str(e)}")
        return False


def validate_csv_export(export_result, validation_data, save_dir=None):
    """Validate the content of a CSV export"""
    print("\nValidating CSV export...")

    if not export_result or not export_result.get('response'):
        print("No export data to validate")
        return False

    response = export_result['response']

    try:
        # Load CSV data from response content
        csv_data = pd.read_csv(io.BytesIO(response.content))

        # Check if we got data
        if csv_data.empty:
            print("Export contains no data")
            return False

        print(
            f"Export contains {len(csv_data)} rows and {len(csv_data.columns)} columns")
        print(f"Columns: {list(csv_data.columns)}")

        # Print sample data
        print("\nSample data (first 5 rows):")
        print(csv_data.head())

        # Validate against source data if available
        if validation_data and validation_data.get('total_subscribers'):
            total_subscribers = validation_data['total_subscribers']
            # Allow for some difference due to filtering
            if len(csv_data) > total_subscribers * 1.1:
                print(
                    f"WARNING: Export has more rows ({len(csv_data)}) than expected total subscribers ({total_subscribers})")
            else:
                print(
                    f"Row count validation passed: {len(csv_data)} rows exported vs {total_subscribers} total subscribers")

        # Check for essential columns
        essential_columns = [
            'DOT', 'telecom_type', 'subscriber_status', 'customer_l2_code', 'customer_l3_code'
        ]

        missing_columns = [col for col in essential_columns if not any(
            existing.lower() == col.lower() for existing in csv_data.columns)]

        if missing_columns:
            print(f"WARNING: Missing essential columns: {missing_columns}")
        else:
            print("Column validation passed: All essential columns present")

        # Save the file if requested
        if save_dir:
            if not os.path.exists(save_dir):
                os.makedirs(save_dir)

            filename = export_result.get(
                'filename') or f"corporate_park_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            file_path = os.path.join(save_dir, filename)

            with open(file_path, 'wb') as f:
                f.write(response.content)

            print(f"Saved CSV file to: {file_path}")

        return True

    except Exception as e:
        print(f"Error validating CSV export: {str(e)}")
        return False


def validate_pdf_export(export_result, validation_data, save_dir=None):
    """Validate the content of a PDF export (basic checks only)"""
    print("\nValidating PDF export...")

    if not export_result or not export_result.get('response'):
        print("No export data to validate")
        return False

    response = export_result['response']

    try:
        # For PDF we can only do basic checks
        content_type = export_result.get('content_type', '')
        if not content_type.startswith('application/pdf'):
            print(f"WARNING: Content type is not PDF: {content_type}")

        # Check content size
        content_size = len(response.content)
        print(f"PDF size: {content_size} bytes")

        if content_size < 1000:  # Arbitrary small size threshold
            print("WARNING: PDF file is suspiciously small")

        # Save the file if requested
        if save_dir:
            if not os.path.exists(save_dir):
                os.makedirs(save_dir)

            filename = export_result.get(
                'filename') or f"corporate_park_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            file_path = os.path.join(save_dir, filename)

            with open(file_path, 'wb') as f:
                f.write(response.content)

            print(f"Saved PDF file to: {file_path}")
            print(
                "Note: PDF content cannot be automatically validated - please check the saved file manually")

        return True

    except Exception as e:
        print(f"Error validating PDF export: {str(e)}")
        return False


def run_tests(args):
    """Run corporate park export tests with validation"""
    print(f"Starting Corporate Park Export tests at {datetime.now()}")
    print(f"Base URL: {args.base_url}")

    # Fetch validation data
    validation_data = fetch_parc_corporate_data(args.base_url, args.auth_token)
    dots = fetch_dot_data(args.base_url, args.auth_token)

    # Define formats to test
    formats = ['excel', 'csv', 'pdf'] if not args.format else [args.format]

    # Track results
    results = {
        'total_tests': 0,
        'successful_tests': 0,
        'failed_tests': 0
    }

    # Test basic format exports (no filters)
    print("\n" + "="*30 + " TESTING BASIC EXPORTS " + "="*30)
    for format in formats:
        results['total_tests'] += 1
        export_result = export_corporate_park(
            args.base_url, args.auth_token, format)

        if export_result:
            # Validate based on format
            if format == 'excel':
                if validate_excel_export(export_result, validation_data, args.save_dir if args.save else None):
                    results['successful_tests'] += 1
                else:
                    results['failed_tests'] += 1
            elif format == 'csv':
                if validate_csv_export(export_result, validation_data, args.save_dir if args.save else None):
                    results['successful_tests'] += 1
                else:
                    results['failed_tests'] += 1
            elif format == 'pdf':
                if validate_pdf_export(export_result, validation_data, args.save_dir if args.save else None):
                    results['successful_tests'] += 1
                else:
                    results['failed_tests'] += 1
        else:
            results['failed_tests'] += 1

    # Test with DOT filter
    if dots and len(dots) > 0:
        print("\n" + "="*30 + " TESTING DOT FILTERED EXPORTS " + "="*30)
        for format in formats:
            results['total_tests'] += 1
            export_result = export_corporate_park(
                args.base_url, args.auth_token, format, {'dot': dots[0]})

            if export_result:
                # Validate based on format
                if format == 'excel':
                    if validate_excel_export(export_result, validation_data, args.save_dir if args.save else None):
                        results['successful_tests'] += 1
                    else:
                        results['failed_tests'] += 1
                elif format == 'csv':
                    if validate_csv_export(export_result, validation_data, args.save_dir if args.save else None):
                        results['successful_tests'] += 1
                    else:
                        results['failed_tests'] += 1
                elif format == 'pdf':
                    if validate_pdf_export(export_result, validation_data, args.save_dir if args.save else None):
                        results['successful_tests'] += 1
                    else:
                        results['failed_tests'] += 1
            else:
                results['failed_tests'] += 1

    # Test with year/month filter
    print("\n" + "="*30 + " TESTING YEAR/MONTH FILTERED EXPORTS " + "="*30)
    for format in formats:
        results['total_tests'] += 1
        export_result = export_corporate_park(
            args.base_url, args.auth_token, format, {'year': 2024, 'month': 1})

        if export_result:
            # Validate based on format
            if format == 'excel':
                if validate_excel_export(export_result, validation_data, args.save_dir if args.save else None):
                    results['successful_tests'] += 1
                else:
                    results['failed_tests'] += 1
            elif format == 'csv':
                if validate_csv_export(export_result, validation_data, args.save_dir if args.save else None):
                    results['successful_tests'] += 1
                else:
                    results['failed_tests'] += 1
            elif format == 'pdf':
                if validate_pdf_export(export_result, validation_data, args.save_dir if args.save else None):
                    results['successful_tests'] += 1
                else:
                    results['failed_tests'] += 1
        else:
            results['failed_tests'] += 1

    # Print summary
    print("\n" + "="*30 + " TEST RESULTS SUMMARY " + "="*30)
    print(f"Total tests: {results['total_tests']}")
    print(f"Successful: {results['successful_tests']}")
    print(f"Failed: {results['failed_tests']}")
    print(
        f"Success rate: {results['successful_tests']/results['total_tests']*100 if results['total_tests'] > 0 else 0:.1f}%")
    print("="*70)


if __name__ == "__main__":
    args = parse_args()
    run_tests(args)
