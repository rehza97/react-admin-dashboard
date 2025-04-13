#!/usr/bin/env python
"""
Test script for verifying file cleanup functionality

This script tests if export files are properly deleted after the cleanup period.
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

# Helper functions


def get_headers():
    """Get request headers with authentication"""
    return {
        'Authorization': f'Token {AUTH_TOKEN}'
    }


def start_export():
    """Start an export with specific filters to create a smaller dataset"""
    print("Starting export with specific filters for faster processing...")
    response = requests.get(
        EXPORT_URL,
        headers=get_headers(),
        params={
            'export_format': 'excel',
            'dot': 'Adrar',  # Specific DOT to limit data
            'limit': '10'    # Limit to 10 records
        }
    )

    if response.status_code != 200:
        print(f"❌ Export failed: {response.status_code} - {response.text}")
        return None

    data = response.json()
    task_id = data.get('task_id')
    if not task_id:
        print(f"❌ No task ID in response: {data}")
        return None

    print(f"✅ Export started with task ID: {task_id}")
    return task_id


def check_status(task_id):
    """Check the status of the export task"""
    status_url = f'{EXPORT_URL}status/?task_id={task_id}'
    response = requests.get(status_url, headers=get_headers())

    if response.status_code != 200:
        print(
            f"❌ Status check failed: {response.status_code} - {response.text}")
        return None

    print(f"Status response: {response.text}")
    return response.json()


def download_file(file_url):
    """Download the file to verify it exists"""
    full_url = f"{BASE_URL}{file_url}"
    print(f"Downloading file from: {full_url}")

    response = requests.get(full_url, headers=get_headers(), stream=True)
    if response.status_code != 200:
        print(f"❌ Download failed: {response.status_code}")
        return False

    print(f"✅ File download successful (status code: {response.status_code})")
    return True

# Main test function


def test_file_cleanup():
    # Step 1: Start an export
    task_id = start_export()
    if not task_id:
        return False

    # Step 2: Wait for export to complete
    file_url = None
    max_attempts = 120  # Wait up to 2 minutes for export to complete
    for i in range(max_attempts):
        time.sleep(1)
        status_data = check_status(task_id)

        if not status_data:
            continue

        status = status_data.get('status')
        progress = status_data.get('progress', 0)

        if status == 'completed':
            file_url = status_data.get('file_url')
            print(f"✅ Export completed with file URL: {file_url}")
            break

        if status == 'failed':
            print(
                f"❌ Export failed: {status_data.get('error', 'Unknown error')}")
            return False

    if not file_url:
        print("❌ Export did not complete within the expected time")
        return False

    # Step 3: Verify file exists
    if not download_file(file_url):
        print("❌ File could not be downloaded immediately after export")
        return False

    # Step 4: Wait for the cleanup period plus a buffer
    # 15 seconds (matching FILE_RETENTION_SECONDS in export_views.py)
    cleanup_time = 15
    buffer_time = 5    # 5 seconds extra
    total_wait = cleanup_time + buffer_time

    print(f"Waiting {total_wait} seconds for file to be cleaned up...")
    time.sleep(total_wait)

    # Step 5: Try to download file again, it should fail
    print("Attempting to download file after cleanup period...")
    file_exists = download_file(file_url)

    if file_exists:
        print("❌ File still exists after cleanup period!")
        return False

    # Step 6: Check status API to see if it properly reports file as expired
    status_data = check_status(task_id)
    if not status_data:
        print("❌ Could not check status after cleanup")
        return False

    if status_data.get('status') != 'expired':
        print(f"❌ Status is not 'expired' after cleanup: {status_data}")
        return False

    print("✅ File was properly cleaned up and status is reported as 'expired'")
    return True


if __name__ == "__main__":
    print("\n======== Testing File Cleanup ========")
    result = test_file_cleanup()

    if result:
        print("\n✅ File cleanup test PASSED!")
        sys.exit(0)
    else:
        print("\n❌ File cleanup test FAILED!")
        sys.exit(1)
