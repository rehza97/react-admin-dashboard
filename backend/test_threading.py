#!/usr/bin/env python
"""
Test script for verifying thread pool management in export functionality

This script tests how the system handles multiple concurrent export requests
and provides information about thread pool utilization.
"""

import requests
import json
import time
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

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


def start_export(dot_code, limit=10, format_type='excel'):
    """Start an export with specific parameters"""
    print(
        f"Starting export for DOT: {dot_code}, format: {format_type}, limit: {limit}")
    response = requests.get(
        EXPORT_URL,
        headers=get_headers(),
        params={
            'export_format': format_type,
            'dot': dot_code,
            'limit': str(limit)
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

    data = response.json()
    status = data.get('status')
    progress = data.get('progress', 0)

    return {
        'status': status,
        'progress': progress,
        'task_id': task_id
    }


def monitor_task(task_id, max_attempts=120, delay=2):
    """Monitor a task until completion or failure"""
    for attempt in range(max_attempts):
        status_data = check_status(task_id)
        if not status_data:
            time.sleep(delay)
            continue

        status = status_data.get('status')
        progress = status_data.get('progress')

        print(f"Task {task_id}: {status} - {progress}%")

        if status in ['completed', 'failed', 'expired']:
            return status

        time.sleep(delay)

    return "timeout"


def get_pool_status():
    """Get the status of the thread pools"""
    response = requests.get(
        f'{EXPORT_URL}?pool_status=true',
        headers=get_headers()
    )

    if response.status_code != 200:
        print(
            f"❌ Failed to get pool status: {response.status_code} - {response.text}")
        return None

    data = response.json()
    return data


def run_concurrent_exports(num_exports=6, dot_codes=None):
    """Run multiple exports concurrently"""
    if dot_codes is None:
        dot_codes = ['Adrar', 'Alger', 'Annaba', 'Batna', 'Bejaia', 'Biskra']

    dot_codes = dot_codes[:num_exports]  # Only use as many as needed

    # Start exports
    tasks = []
    for i, dot in enumerate(dot_codes):
        # Alternate between different formats for testing
        format_type = ['excel', 'csv', 'pdf'][i % 3]

        # Use different batch sizes
        limit = 10 * (i + 1)

        task_id = start_export(dot, limit, format_type)
        if task_id:
            tasks.append(task_id)

    # Start a thread pool to monitor all tasks
    with ThreadPoolExecutor(max_workers=num_exports) as executor:
        futures = {executor.submit(monitor_task, task_id)                   : task_id for task_id in tasks}

        # Display pool status periodically
        start_time = time.time()
        while time.time() - start_time < 60:  # Monitor for up to 60 seconds
            pool_status = get_pool_status()
            if pool_status:
                print("\nThread Pool Status:")
                print(f"Export Pool: {pool_status['export_pool']}")
                print(f"Processing Pool: {pool_status['processing_pool']}")
                print(f"Batch Size: {pool_status['batch_size']}")

                # Check if all tasks have completed
                export_pool = pool_status['export_pool']
                active_threads = export_pool['active_threads']
                if active_threads == 0 and all(f.done() for f in futures):
                    print("All exports completed.")
                    break

            time.sleep(5)

    # Check final status of all tasks
    results = {}
    for task_id in tasks:
        status = check_status(task_id)
        if status:
            results[task_id] = status

    return results


def main():
    print("\n======== Testing Thread Pool Management ========")

    # Check initial pool status
    initial_status = get_pool_status()
    if initial_status:
        print("Initial Thread Pool Configuration:")
        print(
            f"Export Pool Max Workers: {initial_status['export_pool']['max_workers']}")
        print(
            f"Processing Pool Max Workers: {initial_status['processing_pool']['max_workers']}")
        print(f"Batch Size: {initial_status['batch_size']}")

    # Run concurrent exports
    print("\nStarting concurrent exports...")
    results = run_concurrent_exports(6)

    # Print summary
    print("\n======== Export Results ========")
    completed = sum(1 for status in results.values()
                    if status.get('status') == 'completed')
    failed = sum(1 for status in results.values()
                 if status.get('status') == 'failed')
    other = len(results) - completed - failed

    print(f"Total exports: {len(results)}")
    print(f"Completed: {completed}")
    print(f"Failed: {failed}")
    print(f"Other status: {other}")

    # Get final pool status
    final_status = get_pool_status()
    if final_status:
        print("\nFinal Thread Pool Status:")
        print(f"Total tasks: {final_status['export_pool']['total_tasks']}")
        print(
            f"Completed tasks: {final_status['export_pool']['completed_tasks']}")
        print(f"Failed tasks: {final_status['export_pool']['failed_tasks']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
