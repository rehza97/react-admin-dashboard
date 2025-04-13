#!/usr/bin/env python
"""
Test script for Corporate Park Export with file download

This script tests the export endpoint with multiple parameters and downloads the exported file.
"""

import requests
import json
import time
import os
import sys

# Base URL and auth token
BASE_URL = 'http://localhost:8000'
AUTH_TOKEN = 'f3c764779498cfebcb0342a627d573de4cea376bc60aa2e943800e897146dc78'
EXPORT_URL = f'{BASE_URL}/data/export/corporate-park/'
DOWNLOAD_DIR = './downloads'

# Create download directory if it doesn't exist
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Helper functions


def get_headers():
    """Get request headers with authentication"""
    return {
        'Authorization': f'Token {AUTH_TOKEN}'
    }


def start_export(params):
    """Start an export with the given parameters"""
    print(f"Starting export with parameters: {params}")
    response = requests.get(EXPORT_URL, headers=get_headers(), params=params)

    if response.status_code != 200:
        print(f"❌ Export failed: {response.status_code} - {response.text}")
        return None

    try:
        data = response.json()
        task_id = data.get('task_id')
        if not task_id:
            print(f"❌ No task ID in response: {data}")
            return None

        print(f"✅ Export started with task ID: {task_id}")
        return task_id
    except Exception as e:
        print(f"❌ Error parsing response: {str(e)}")
        return None


def wait_for_export(task_id, max_attempts=30, delay=2):
    """Poll the status endpoint until the export is complete or fails"""
    status_url = f'{EXPORT_URL}status/?task_id={task_id}'

    for attempt in range(max_attempts):
        try:
            response = requests.get(status_url, headers=get_headers())
            if response.status_code != 200:
                print(
                    f"❌ Status check failed: {response.status_code} - {response.text}")
                return None

            data = response.json()
            status = data.get('status')
            progress = data.get('progress', 0)

            print(f"Status: {status}, Progress: {progress}%")

            if status == 'completed':
                file_url = data.get('file_url')
                if file_url:
                    print(f"✅ Export completed: {file_url}")
                    return file_url
                else:
                    print("❌ No file URL in completed status")
                    return None

            elif status == 'failed':
                print(f"❌ Export failed: {data.get('error', 'Unknown error')}")
                return None

            time.sleep(delay)
        except Exception as e:
            print(f"❌ Error checking status: {str(e)}")
            return None

    print(f"❌ Export timed out after {max_attempts * delay} seconds")
    return None


def download_file(file_url, format_type):
    """Download the exported file"""
    full_url = f"{BASE_URL}{file_url}"
    print(f"Downloading file from: {full_url}")

    try:
        response = requests.get(full_url, headers=get_headers(), stream=True)
        if response.status_code != 200:
            print(
                f"❌ Download failed: {response.status_code} - {response.text}")
            return None

        # Get filename from URL or create one
        filename = os.path.basename(file_url)
        if not filename:
            filename = f"export.{format_type}"

        file_path = os.path.join(DOWNLOAD_DIR, filename)

        # Save file
        with open(file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"✅ File downloaded to: {file_path}")
        return file_path
    except Exception as e:
        print(f"❌ Error downloading file: {str(e)}")
        return None


def test_export_with_params(params, name):
    """Test exporting with parameters and download the file"""
    print(f"\n======== Test: {name} ========")

    # Start export
    task_id = start_export(params)
    if not task_id:
        return False

    # Wait for completion
    file_url = wait_for_export(task_id)
    if not file_url:
        return False

    # Download file
    format_type = params.get('export_format', 'excel')
    file_path = download_file(file_url, format_type)

    return file_path is not None

# Run tests with different parameter combinations


def main():
    tests = [
        {
            "name": "Multiple single-value parameters",
            "params": {
                "export_format": "excel",
                "dot": "Adrar",
                "state": "Active",
                "telecom_type": "Mobile",
                "subscriber_status": "Active",
                "year": "2023",
                "month": "12"
            }
        },
        {
            "name": "Array-style parameters",
            "params": {
                "export_format": "csv",
                "dot[]": ["Adrar", "Alger"],
                "state[]": ["Active", "Suspended"]
            }
        },
        {
            "name": "Mixed parameters",
            "params": {
                "export_format": "pdf",
                "dot": "Adrar",
                "state[]": ["Active", "Suspended"],
                "telecom_type": "Mobile"
            }
        }
    ]

    success_count = 0

    for test in tests:
        if test_export_with_params(test["params"], test["name"]):
            success_count += 1

    total_tests = len(tests)
    print(
        f"\n======== Test Results: {success_count}/{total_tests} passed ========")

    return 0 if success_count == total_tests else 1


if __name__ == "__main__":
    sys.exit(main())
