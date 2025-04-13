#!/usr/bin/env python
"""
Corporate Park Export Test with Real Data

This script first fetches available DOT codes from the API, then tests
the export of corporate park data using one of those DOT codes as a filter.

Usage:
  python test_export_with_real_data.py [--auth TOKEN] [--url URL] [--download]
"""

import requests
import json
import argparse
import sys
import time
import os
import csv

# Default configuration
DEFAULT_AUTH_TOKEN = 'f3c764779498cfebcb0342a627d573de4cea376bc60aa2e943800e897146dc78'
DEFAULT_BASE_URL = 'http://localhost:8000'


def parse_args():
    parser = argparse.ArgumentParser(
        description='Test Corporate Park Export with real data')
    parser.add_argument('--auth', dest='auth_token',
                        default=DEFAULT_AUTH_TOKEN,
                        help='Authentication token')
    parser.add_argument('--url', dest='base_url',
                        default=DEFAULT_BASE_URL,
                        help='Base URL for API')
    parser.add_argument('--download', action='store_true',
                        help='Download the file when complete')
    parser.add_argument('--save-dir', dest='save_dir',
                        default='./downloads',
                        help='Directory to save downloaded files')
    parser.add_argument('--dots', dest='dots',
                        help='Comma-separated list of DOT codes to test (optional)')
    return parser.parse_args()


def get_headers(auth_token):
    """Get request headers with authentication"""
    headers = {'Content-Type': 'application/json'}
    if auth_token:
        headers['Authorization'] = f'Token {auth_token}'
    return headers


def fetch_available_dots(base_url, auth_token):
    """Fetch available DOT codes from the API"""
    print("\n======== Fetching Available DOT Codes ========")

    # Try different possible dot endpoints
    dot_endpoints = [
        "data/dots/",
        "api/auth/dots/"
    ]

    headers = get_headers(auth_token)

    for endpoint in dot_endpoints:
        try:
            print(f"Trying endpoint: {base_url}/{endpoint}")
            response = requests.get(
                f"{base_url}/{endpoint}",
                headers=headers
            )

            if response.status_code == 200:
                data = response.json()

                # Handle different response formats
                dots = []
                if isinstance(data, dict) and 'dots' in data:
                    dots = [dot['code']
                            for dot in data['dots'] if 'code' in dot]
                elif isinstance(data, list):
                    dots = [dot['code'] for dot in data if 'code' in dot]

                if dots:
                    print(f"✅ Found {len(dots)} DOT codes")
                    print(f"Example DOTs: {', '.join(dots[:5])}")
                    return dots
        except Exception as e:
            print(f"❌ Error fetching from {endpoint}: {str(e)}")

    print("⚠️ Could not fetch DOT codes from API, using default values")
    return ["ADR", "ALG", "ORA"]  # Default fallback values


def fetch_corporate_park_preview(base_url, auth_token, dot_code=None):
    """Fetch a preview of corporate park data to verify filter works"""
    print(
        f"\n======== Fetching Corporate Park Preview for DOT: {dot_code} ========")

    endpoint = "data/preview/corporate-park/"
    headers = get_headers(auth_token)

    params = {
        "page": 1,
        "page_size": 10
    }

    if dot_code:
        params["dot"] = dot_code

    try:
        response = requests.get(
            f"{base_url}/{endpoint}",
            headers=headers,
            params=params
        )

        if response.status_code == 200:
            data = response.json()
            results = data.get('results', [])
            total = data.get('pagination', {}).get('total_count', 0)

            print(
                f"✅ Preview shows {total} total records with filter DOT: {dot_code}")
            print(f"First few records:")

            for i, record in enumerate(results[:3]):
                print(
                    f"  Record {i+1}: DOT={record.get('dot_code')}, Name={record.get('customer_full_name')}")

            return results, total
        else:
            print(f"❌ Error fetching preview: {response.status_code}")
            print(response.text)
            return [], 0

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return [], 0


def test_dot_filtered_export(base_url, auth_token, dot_code, download=False, save_dir='./downloads'):
    """Test exporting corporate park data filtered by specific DOT code"""
    print(
        f"\n======== Testing Corporate Park Export with DOT Filter: {dot_code} ========")

    endpoint = "data/export/corporate-park/"

    # Remove Content-Type for file downloads
    headers = get_headers(auth_token)
    headers.pop('Content-Type', None)

    # Try direct URL without params first
    try:
        print(f"\nTesting direct URL access...")
        response = requests.get(
            f"{base_url}/{endpoint}",
            headers=headers
        )
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {str(e)}")

    # Try different parameter formats
    param_formats = [
        {"export_format": "excel", "dot": dot_code},  # Standard format
        {"export_format": "csv", "dot": dot_code},  # CSV format
        {"export_format": "pdf", "dot": dot_code},  # PDF format
    ]

    for params in param_formats:
        format_name = params.get("export_format", "excel").upper()
        param_type = "dot"

        print(
            f"\nTesting {format_name} export with parameter {param_type}: {params}")

        try:
            response = requests.get(
                f"{base_url}/{endpoint}",
                headers=headers,
                params=params
            )

            print(f"Status code: {response.status_code}")
            print(f"Response: {response.text[:100]}...")

            if response.status_code == 200:
                print("✅ Export request successful!")
                return True
            else:
                print(f"❌ Failed: {response.text}")

        except Exception as e:
            print(f"❌ Error: {str(e)}")

    return False


def run_tests(args):
    """Run the DOT filtered export tests with real data"""
    base_url = args.base_url
    auth_token = args.auth_token
    download = args.download
    save_dir = args.save_dir

    print(f"Testing Corporate Park Export with Real Data")
    print(f"Base URL: {base_url}")
    print(f"Auth Token: {'Provided' if auth_token else 'None'}")
    print(f"Download Files: {'Yes' if download else 'No'}")

    # Step 1: Get DOT codes to test with
    if args.dots:
        # Use provided dots
        test_dots = args.dots.split(',')
        print(f"Using provided DOT codes: {', '.join(test_dots)}")
    else:
        # Fetch dots from API
        all_dots = fetch_available_dots(base_url, auth_token)
        # Pick first 2 dots to test with (to keep test runtime reasonable)
        test_dots = all_dots[:2] if len(all_dots) > 1 else all_dots
        print(f"Selected DOTs for testing: {', '.join(test_dots)}")

    # Step 2: For each DOT, first get a preview then test export
    for dot_code in test_dots:
        # First get a preview to confirm data exists
        preview_data, total_count = fetch_corporate_park_preview(
            base_url, auth_token, dot_code)

        if total_count > 0:
            print(
                f"✅ Found {total_count} records for DOT: {dot_code}, proceeding with export test")
            # Now test export with that DOT filter
            test_dot_filtered_export(
                base_url, auth_token, dot_code, download, save_dir)
        else:
            print(
                f"⚠️ No data found for DOT: {dot_code}, skipping export test")

    print("\n======== All Tests Complete ========")


if __name__ == "__main__":
    args = parse_args()
    run_tests(args)
