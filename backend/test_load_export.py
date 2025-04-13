#!/usr/bin/env python
"""
Load Test for Export System

This script simulates high concurrency to test the export system's 
capacity and behavior under heavy load.
"""

import requests
import time
import json
import random
import threading
import argparse
import sys
from concurrent.futures import ThreadPoolExecutor

# Base URL and auth token
BASE_URL = 'http://localhost:8000'
AUTH_TOKEN = 'f3c764779498cfebcb0342a627d573de4cea376bc60aa2e943800e897146dc78'
EXPORT_URL = f'{BASE_URL}/data/export/corporate-park/'

# Sample data for testing
DOT_CODES = [
    'Adrar', 'Alger', 'Annaba', 'Batna', 'Bejaia', 'Biskra',
    'Bechar', 'Blida', 'Bouira', 'Tamanrasset', 'Tebessa', 'Tlemcen',
    'Tiaret', 'Tizi Ouzou', 'Jijel', 'Setif', 'Saida', 'Skikda',
    'Sidi Bel Abbes', 'Guelma', 'Constantine', 'Medea', 'Mostaganem',
    'Msila', 'Mascara', 'Ouargla', 'Oran'
]

EXPORT_FORMATS = ['excel', 'csv', 'pdf']

# Track statistics
stats = {
    'requests_sent': 0,
    'success_responses': 0,
    'error_responses': 0,
    'tasks_completed': 0,
    'tasks_failed': 0,
    'response_times': [],
    'start_time': None,
    'end_time': None
}

# Synchronization
stats_lock = threading.Lock()


def get_headers():
    """Get request headers with authentication token"""
    return {
        'Authorization': f'Token {AUTH_TOKEN}'
    }


def start_export(test_id, format_type=None, limit=None, dot_code=None):
    """Start an export with specific parameters"""
    global stats

    # Generate random parameters if not provided
    if format_type is None:
        format_type = random.choice(EXPORT_FORMATS)
    if limit is None:
        limit = random.randint(10, 100)
    if dot_code is None:
        dot_code = random.choice(DOT_CODES)

    params = {
        'export_format': format_type,
        'dot': dot_code,
        'limit': str(limit)
    }

    start_time = time.time()

    try:
        response = requests.get(
            EXPORT_URL,
            headers=get_headers(),
            params=params,
            timeout=30
        )

        duration = time.time() - start_time

        with stats_lock:
            stats['requests_sent'] += 1
            stats['response_times'].append(duration)

            if response.status_code == 200:
                stats['success_responses'] += 1
                data = response.json()
                task_id = data.get('task_id')

                if task_id:
                    print(
                        f"[{test_id}] Export started: {dot_code} ({format_type}) - Task ID: {task_id}")
                    return task_id, params
            else:
                stats['error_responses'] += 1
                print(
                    f"[{test_id}] Export failed: {response.status_code} - {response.text}")

    except Exception as e:
        with stats_lock:
            stats['error_responses'] += 1
        print(f"[{test_id}] Request error: {e}")

    return None, params


def check_task_status(task_id):
    """Check the status of an export task"""
    try:
        status_url = f'{EXPORT_URL}status/?task_id={task_id}'
        response = requests.get(status_url, headers=get_headers(), timeout=10)

        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Status check error for task {task_id}: {e}")

    return None


def monitor_task(test_id, task_id, max_attempts=60):
    """Monitor a task until completion or until max attempts reached"""
    global stats

    for attempt in range(max_attempts):
        status_data = check_task_status(task_id)

        if status_data:
            status = status_data.get('status')
            progress = status_data.get('progress', 0)

            if attempt % 5 == 0:  # Only print every 5th status check to reduce output
                print(f"[{test_id}] Task {task_id}: {status} - {progress}%")

            if status == 'completed':
                with stats_lock:
                    stats['tasks_completed'] += 1
                print(f"[{test_id}] ✅ Task {task_id} completed")
                return True
            elif status in ['failed', 'expired']:
                with stats_lock:
                    stats['tasks_failed'] += 1
                print(f"[{test_id}] ❌ Task {task_id} {status}")
                return False

        time.sleep(2)

    # If we get here, the task timed out
    with stats_lock:
        stats['tasks_failed'] += 1
    print(f"[{test_id}] ⏱️ Task {task_id} monitoring timed out")
    return False


def get_pool_status():
    """Get the current thread pool status"""
    try:
        response = requests.get(
            f'{EXPORT_URL}?pool_status=true',
            headers=get_headers(),
            timeout=10
        )

        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Failed to get pool status: {e}")

    return None


def run_worker(worker_id, total_exports, delay_min=0, delay_max=2):
    """Worker thread that sends export requests with random parameters"""
    exports_per_worker = total_exports
    tasks = []

    for i in range(exports_per_worker):
        # Random delay between requests to simulate real-world behavior
        if i > 0:
            time.sleep(random.uniform(delay_min, delay_max))

        test_id = f"W{worker_id}-{i+1}"
        task_id, params = start_export(test_id)

        if task_id:
            tasks.append((test_id, task_id, params))

    # Monitor all tasks started by this worker
    for test_id, task_id, params in tasks:
        monitor_task(test_id, task_id)


def print_stats():
    """Print the current statistics"""
    with stats_lock:
        success_rate = (stats['success_responses'] / stats['requests_sent']
                        * 100) if stats['requests_sent'] > 0 else 0
        completion_rate = (stats['tasks_completed'] / stats['success_responses']
                           * 100) if stats['success_responses'] > 0 else 0
        avg_response_time = sum(stats['response_times']) / len(
            stats['response_times']) if stats['response_times'] else 0

        print("\n-------- CURRENT STATISTICS --------")
        print(f"Requests sent: {stats['requests_sent']}")
        print(
            f"Successful responses: {stats['success_responses']} ({success_rate:.1f}%)")
        print(f"Error responses: {stats['error_responses']}")
        print(
            f"Tasks completed: {stats['tasks_completed']} ({completion_rate:.1f}%)")
        print(f"Tasks failed: {stats['tasks_failed']}")
        print(f"Average response time: {avg_response_time:.3f}s")

        if stats['start_time']:
            elapsed = time.time() - stats['start_time']
            print(f"Test running for: {elapsed:.1f}s")
        print("-----------------------------------\n")


def pool_status_monitor(interval=10, max_duration=300):
    """Monitor and print the thread pool status periodically"""
    start_time = time.time()

    while time.time() - start_time < max_duration:
        pool_status = get_pool_status()

        if pool_status:
            print("\n-------- THREAD POOL STATUS --------")
            export_pool = pool_status.get('export_pool', {})
            processing_pool = pool_status.get('processing_pool', {})

            print(
                f"Export Pool: {export_pool.get('active_threads', 0)}/{export_pool.get('max_workers', 0)} active threads")
            print(f"Pending tasks: {export_pool.get('pending_tasks', 0)}")
            print(f"Total tasks: {export_pool.get('total_tasks', 0)}")
            print(
                f"Completed: {export_pool.get('completed_tasks', 0)}, Failed: {export_pool.get('failed_tasks', 0)}")

            print(
                f"Processing Pool: {processing_pool.get('active_threads', 0)}/{processing_pool.get('max_workers', 0)} active threads")
            print(f"Pending tasks: {processing_pool.get('pending_tasks', 0)}")

            batch_size = pool_status.get('batch_size', 0)
            cleaned_files = pool_status.get('cleaned_files', 0)
            print(f"Batch size: {batch_size}, Cleaned files: {cleaned_files}")
            print("-----------------------------------\n")

            # Also print our test statistics
            print_stats()

        # If all workers have completed their tasks and the export pool is empty, we can stop monitoring
        if stats['requests_sent'] > 0 and stats['tasks_completed'] + stats['tasks_failed'] >= stats['success_responses']:
            if pool_status and export_pool.get('active_threads', 0) == 0:
                print(
                    "All tasks completed and no active export threads. Ending monitoring.")
                break

        time.sleep(interval)


def run_load_test(num_workers, exports_per_worker, max_duration=300):
    """Run the load test with the specified parameters"""
    global stats

    stats['start_time'] = time.time()

    print(
        f"\n==== Starting Load Test with {num_workers} workers, {exports_per_worker} exports per worker ====\n")

    # Start the pool status monitor in a separate thread
    monitor_thread = threading.Thread(
        target=pool_status_monitor,
        args=(10, max_duration),
        daemon=True
    )
    monitor_thread.start()

    # Start worker threads to generate load
    workers = []
    for i in range(num_workers):
        worker = threading.Thread(
            target=run_worker,
            args=(i+1, exports_per_worker),
            daemon=True
        )
        workers.append(worker)
        worker.start()
        # Brief delay between starting workers to avoid thundering herd
        time.sleep(0.5)

    # Wait for all workers to complete or timeout
    for worker in workers:
        worker.join(timeout=max_duration)

    # Record end time and print final stats
    stats['end_time'] = time.time()
    elapsed = stats['end_time'] - stats['start_time']

    print("\n==== Load Test Complete ====")
    print(f"Total test duration: {elapsed:.1f} seconds")
    print_stats()

    # Check if there are still active threads in the export system
    final_status = get_pool_status()
    if final_status:
        export_pool = final_status.get('export_pool', {})
        active_threads = export_pool.get('active_threads', 0)
        if active_threads > 0:
            print(
                f"Warning: {active_threads} export threads still active after test completion")

    # Wait for monitor thread to complete
    monitor_thread.join(timeout=10)

    return 0


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Export System Load Test')
    parser.add_argument('--workers', '-w', type=int, default=5,
                        help='Number of concurrent worker threads (default: 5)')
    parser.add_argument('--exports', '-e', type=int, default=3,
                        help='Number of exports per worker thread (default: 3)')
    parser.add_argument('--duration', '-d', type=int, default=300,
                        help='Maximum test duration in seconds (default: 300)')

    return parser.parse_args()


def main():
    args = parse_arguments()

    try:
        return run_load_test(args.workers, args.exports, args.duration)
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        print_stats()
        return 1


if __name__ == "__main__":
    sys.exit(main())
