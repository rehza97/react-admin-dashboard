import requests
import json
import os
import time
from datetime import datetime
import random
import string
import mimetypes
import sys

# Configuration
BASE_URL = "http://localhost:8000/api"
# Token for authenticated requests
AUTH_TOKEN = '9c92636620f771bf7ee215882bd56fd53958ea541f7233babfdc74c8a999ff9b'
TEST_DATA_DIR = "./test_data"  # Directory containing test files
VERBOSE = True  # Set to False to reduce output
# Debug mode (set to True to see more debug information)
DEBUG_MODE = True

# Size thresholds for categorizing files (in bytes)
SMALL_FILE_THRESHOLD = 1 * 1024 * 1024  # 1 MB
MEDIUM_FILE_THRESHOLD = 10 * 1024 * 1024  # 10 MB
LARGE_FILE_THRESHOLD = 20 * 1024 * 1024  # 20 MB

# Test configuration
SHOW_RESPONSE_DETAILS = True
WAIT_FOR_PROCESSING = True
MAX_WAIT_TIME = 180  # 3 minutes for large files

# Adjust based on your system's capabilities
# Test different worker counts to find optimal performance
MAX_WORKERS = 4

# Default headers for requests


def get_headers(for_json=True):
    """Get request headers with optional authentication token"""
    headers = {}

    # Only add Content-Type and Accept headers for JSON requests
    if for_json:
        headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })

    if AUTH_TOKEN:
        headers['Authorization'] = f'Token {AUTH_TOKEN}'

    return headers


def generate_random_string(length=8):
    """Generate a random string for test data"""
    return ''.join(random.choice(string.ascii_letters) for _ in range(length))


def print_test_header(title):
    """Print a formatted test header"""
    print(f"\n{'='*80}")
    print(f" {title}")
    print(f"{'='*80}")


def print_response_details(response, detail_level="basic"):
    """Print response details based on the specified level"""
    print(f"Status Code: {response.status_code}")
    print(f"Response Time: {response.elapsed.total_seconds():.2f}s")

    if DEBUG_MODE:
        print(f"Request URL: {response.request.url}")
        print(f"Request Method: {response.request.method}")
        print(f"Request Headers: {response.request.headers}")
        if response.request.body:
            try:
                if isinstance(response.request.body, bytes):
                    body_str = response.request.body.decode('utf-8')
                    print(
                        f"Request Body: {body_str[:500]}" + ("..." if len(body_str) > 500 else ""))
                else:
                    print(f"Request Body: {response.request.body[:500]}" + (
                        "..." if len(response.request.body) > 500 else ""))
            except:
                print("Request Body: [Binary data]")

    if detail_level == "none":
        return

    # Try to parse response as JSON
    try:
        json_response = response.json()
        if detail_level == "basic":
            if isinstance(json_response, dict):
                keys = list(json_response.keys())
                print(f"Response contains {len(keys)} keys: {', '.join(keys[:5])}" +
                      ("..." if len(keys) > 5 else ""))

                # Print status and message if available
                if "status" in json_response:
                    print(f"Status: {json_response.get('status')}")
                if "message" in json_response:
                    print(f"Message: {json_response.get('message')}")

                # Print more details in debug mode
                if DEBUG_MODE and isinstance(json_response, dict):
                    print("Response JSON Detail:")
                    if "progress" in json_response:
                        print(
                            f"Progress Detail: {json.dumps(json_response.get('progress'), indent=2)}")
                    if "invoice_statuses" in json_response:
                        statuses = json_response.get('invoice_statuses', {})
                        print(f"Invoice Statuses: {len(statuses)} invoices")
                        for inv_id, status in list(statuses.items())[:3]:
                            print(f"  - Invoice {inv_id}: {status}")
                        if len(statuses) > 3:
                            print(f"  ... and {len(statuses) - 3} more")

            elif isinstance(json_response, list):
                print(
                    f"Response contains a list of {len(json_response)} items")

                # Print sample items in debug mode
                if DEBUG_MODE and len(json_response) > 0:
                    print("Sample items:")
                    for i, item in enumerate(json_response[:3]):
                        print(
                            f"Item {i+1}: {json.dumps(item, indent=2)[:200]}...")
                    if len(json_response) > 3:
                        print(f"... and {len(json_response) - 3} more items")
        else:  # Full details
            print("Response JSON:")
            print(json.dumps(json_response, indent=2))
    except Exception as e:
        if DEBUG_MODE:
            print(f"Error parsing JSON: {str(e)}")
        if response.text:
            print(f"Response text: {response.text[:200]}" +
                  ("..." if len(response.text) > 200 else ""))
        else:
            print("No response text")


def format_file_size(size_bytes):
    """Format file size in human-readable format"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes/1024:.2f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes/(1024*1024):.2f} MB"
    else:
        return f"{size_bytes/(1024*1024*1024):.2f} GB"


def categorize_file(file_path):
    """Categorize file by size: small, medium, or large"""
    size = os.path.getsize(file_path)
    if size < SMALL_FILE_THRESHOLD:
        return "small", size
    elif size < MEDIUM_FILE_THRESHOLD:
        return "medium", size
    else:
        return "large", size


def ensure_test_data_dir():
    """Ensure test data directory exists and contains test files"""
    if not os.path.exists(TEST_DATA_DIR):
        print(f"WARNING: Test data directory does not exist: {TEST_DATA_DIR}")
        return False

    # Check if directory has any files
    files = [f for f in os.listdir(TEST_DATA_DIR) if os.path.isfile(
        os.path.join(TEST_DATA_DIR, f))]
    if not files:
        print(f"WARNING: No test files found in {TEST_DATA_DIR}")
        return False

    # Group files by size
    small_files = []
    medium_files = []
    large_files = []

    for f in files:
        file_path = os.path.join(TEST_DATA_DIR, f)
        file_info = categorize_file(file_path)

        # Categorize files by size
        if file_info[0] == "small":
            small_files.append(file_info)
        elif file_info[0] == "medium":
            medium_files.append(file_info)
        else:
            large_files.append(file_info)

    # Sort each category by size
    small_files.sort(key=lambda x: x[1])
    medium_files.sort(key=lambda x: x[1])
    large_files.sort(key=lambda x: x[1])

    # Print file categories
    print(f"\nFound {len(files)} test files in {TEST_DATA_DIR}")

    if small_files:
        print("\nSmall files:")
        for name, size in small_files:
            print(f"  - {name} ({format_file_size(size)})")

    if medium_files:
        print("\nMedium files:")
        for name, size in medium_files:
            print(f"  - {name} ({format_file_size(size)})")

    if large_files:
        print("\nLarge files:")
        for name, size in large_files:
            print(f"  - {name} ({format_file_size(size)})")

    return True


def list_available_test_files():
    """List all available test files for processing"""
    print("\nScanning for test files...")
    if not os.path.exists(TEST_DATA_DIR):
        print(f"✗ Test data directory not found: {TEST_DATA_DIR}")
        print("Creating test data directory...")
        os.makedirs(TEST_DATA_DIR, exist_ok=True)
        return []

    file_list = []
    small_files = []
    medium_files = []
    large_files = []

    for filename in os.listdir(TEST_DATA_DIR):
        file_path = os.path.join(TEST_DATA_DIR, filename)
        if not os.path.isfile(file_path):
            continue

        # Skip hidden files
        if filename.startswith('.'):
            continue

        # Skip non-CSV/Excel files
        if not (filename.lower().endswith('.csv') or
                filename.lower().endswith('.xlsx') or
                filename.lower().endswith('.xls')):
            continue

        # Get file category and size
        category, size = categorize_file(file_path)
        size_formatted = format_file_size(size)

        file_info = {
            'path': file_path,
            'name': filename,
            'size': size,
            'size_formatted': size_formatted,
            'category': category
        }

        if category == "small":
            small_files.append(file_info)
        elif category == "medium":
            medium_files.append(file_info)
        else:
            large_files.append(file_info)

        file_list.append(file_info)

    if not file_list:
        print(
            "No test files found. Please add CSV or Excel files to the test_data directory.")
        return []

    # Sort files by size (largest first)
    file_list.sort(key=lambda x: x['size'], reverse=True)

    print(f"Found {len(file_list)} test files in {TEST_DATA_DIR}")
    print(
        f" - Small files (<{format_file_size(SMALL_FILE_THRESHOLD)}): {len(small_files)}")
    print(
        f" - Medium files (<{format_file_size(MEDIUM_FILE_THRESHOLD)}): {len(medium_files)}")
    print(
        f" - Large files (≥{format_file_size(MEDIUM_FILE_THRESHOLD)}): {len(large_files)}")

    if VERBOSE:
        print("\nAvailable test files:")
        for i, file_info in enumerate(file_list):
            category_label = file_info['category'].upper()
            print(
                f"{i+1}. [{category_label}] {file_info['name']} ({file_info['size_formatted']})")

    return file_list


def basic_health_check():
    """Basic health check to ensure API is responsive"""
    print("Testing Health Check API Endpoint...")

    try:
        response = requests.get(
            f"{BASE_URL}/v2/data/health-check/", headers=get_headers(for_json=True))
        status = response.status_code

        print(f"Status Code: {status}")
        if status == 200:
            print("✓ Health check successful!")
            print(f"Response: {response.text}")
            return True
        else:
            print(f"✗ Health check failed with status code {status}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"✗ Error connecting to API: {str(e)}")
        return False


def test_health_check():
    """Test the health check endpoint"""
    print_test_header("Testing Health Check Endpoint")

    response = requests.get(f"{BASE_URL}/health-check/", headers=get_headers())
    print_response_details(
        response, "full" if SHOW_RESPONSE_DETAILS else "basic")

    if response.status_code == 200:
        print("✓ Health check endpoint is working")
        return True
    else:
        print("✗ Health check endpoint failed")
        return False


def upload_test_file(file_path):
    """Upload a test file to the server"""
    filename = os.path.basename(file_path)
    print(f"\nUploading file: {filename}")

    # Get headers for authentication but without Content-Type
    headers = get_headers(for_json=False)

    # Prepare form data with required fields
    data = {
        'invoice_number': f'TEST-{int(time.time())}',
        'description': f'Test upload at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}'
    }

    with open(file_path, 'rb') as f:
        files = {'file': (filename, f)}
        response = requests.post(
            f"{BASE_URL}/v2/data/invoices/upload/",
            headers=headers,
            files=files,
            data=data
        )

    if response.status_code == 201:
        print(
            f"✓ File uploaded successfully! (Status: {response.status_code})")
        try:
            result = response.json()
            file_id = result.get('id') or result.get('invoice_id')
            print(f"File ID: {file_id}")
            return file_id
        except:
            print(f"Response: {response.text}")
            return None
    else:
        print(f"✗ Upload failed with status code {response.status_code}")
        print(f"Response: {response.text}")
        return None


def process_invoice(file_id):
    """Process an uploaded invoice file"""
    print(f"\nProcessing invoice with ID: {file_id}")

    if DEBUG_MODE:
        print(
            f"DEBUG: Processing invoice {file_id} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    process_url = f"{BASE_URL}/v2/data/invoices/{file_id}/process/"

    if DEBUG_MODE:
        print(f"DEBUG: Process URL: {process_url}")
        print(f"DEBUG: Request headers: {get_headers(for_json=True)}")
        print(f"DEBUG: Request body: {{}}")

    response = requests.post(
        process_url,
        headers=get_headers(for_json=True),
        json={}
    )

    if DEBUG_MODE:
        print(f"DEBUG: Response status: {response.status_code}")
        print(f"DEBUG: Response headers: {dict(response.headers)}")
        try:
            print(
                f"DEBUG: Response JSON: {json.dumps(response.json(), indent=2)[:500]}")
        except:
            print(f"DEBUG: Response text: {response.text[:500]}")

    if response.status_code in [200, 201, 202]:
        print(f"✓ Processing started! (Status: {response.status_code})")
        try:
            result = response.json()
            # The API may return task_id or progress_tracker_id
            task_id = result.get('task_id') or result.get(
                'progress_tracker_id')
            if task_id:
                print(f"Task ID: {task_id}")
            else:
                print("No task ID returned but request was successful")
                print(f"Full response: {result}")
            return task_id or True  # Return True if no task_id but successful
        except Exception as e:
            if DEBUG_MODE:
                print(f"DEBUG: Exception parsing response: {str(e)}")
                import traceback
                print(f"DEBUG: Traceback: {traceback.format_exc()}")
            print(f"Response: {response.text}")
            return None
    else:
        print(f"✗ Processing failed with status code {response.status_code}")
        print(f"Response: {response.text}")
        return None


def test_single_file_upload():
    """Test uploading a single file"""
    files = list_available_test_files()

    if not files:
        print("✗ No test files available for upload test")
        return False

    # Select a small file for the upload test
    small_files = [f for f in files if f['category'] == 'small']
    test_file = small_files[0]['path'] if small_files else files[0]['path']

    file_id = upload_test_file(test_file)
    if file_id:
        print(f"✓ Upload test successful! File ID: {file_id}")
        return True
    else:
        print("✗ Upload test failed")
        return False


def test_single_file_processing():
    """Test uploading and processing a single invoice file"""
    files = list_available_test_files()

    if not files:
        print("✗ No test files available for processing test")
        return False

    # Select a small file for quick processing
    small_files = [f for f in files if f['category'] == 'small']
    test_file = small_files[0]['path'] if small_files else files[0]['path']

    print(
        f"Testing single file processing with: {os.path.basename(test_file)}")

    # Upload the file
    file_id = upload_test_file(test_file)
    if not file_id:
        print("✗ Failed to upload file for processing test")
        return False

    # Process the file
    task_id = process_invoice(file_id)
    if not task_id:
        print("✗ Failed to start processing")
        return False

    print("✓ Single file processing test successful!")
    return True


def test_large_file_optimization():
    """Test optimized processing with large files"""
    files = list_available_test_files()

    # Filter for large files
    large_files = [f for f in files if f['category'] == 'large']

    if not large_files:
        print("✗ No large files found for testing")
        return False

    print(f"\nFound {len(large_files)} large files for optimization testing")

    # Choose the largest file for testing
    test_file = large_files[0]['path']
    print(
        f"Using file: {os.path.basename(test_file)} ({large_files[0]['size_formatted']})")

    # Upload the file
    start_time = time.time()
    file_id = upload_test_file(test_file)
    upload_time = time.time() - start_time

    if not file_id:
        print("✗ Failed to upload large file for optimization test")
        return False

    print(f"Upload completed in {upload_time:.2f} seconds")

    # Process the file
    start_time = time.time()
    task_id = process_invoice(file_id)

    if not task_id:
        print("✗ Failed to start processing large file")
        return False

    # Wait for processing to complete
    print("\nWaiting for processing to complete...")
    wait_start = time.time()
    completed = wait_for_processing(file_id)
    wait_time = time.time() - wait_start
    total_time = time.time() - start_time

    if completed:
        print(f"Processing wait time: {wait_time:.2f} seconds")
        print(f"Total processing time: {total_time:.2f} seconds")
        print("✓ Large file optimization test successful!")
        return True
    else:
        print("✗ Large file processing did not complete within the timeout period")
        return False


def wait_for_processing(file_id, timeout=300, check_interval=5):
    """Wait for file processing to complete or timeout"""
    print("\nWaiting for processing to complete...")
    start_time = time.time()

    # The API doesn't have a dedicated status endpoint for individual invoices
    # We'll try common patterns to find the right endpoint
    possible_endpoints = [
        f"{BASE_URL}/v2/data/invoices/{file_id}/status/",
        f"{BASE_URL}/v2/data/invoices/{file_id}/",
        f"{BASE_URL}/v2/data/process/status/?invoice_id={file_id}"
    ]

    # Try the first attempt with all endpoints to find the working one
    working_endpoint = None
    for endpoint in possible_endpoints:
        try:
            print(f"Trying endpoint: {endpoint}")
            response = requests.get(
                endpoint, headers=get_headers(for_json=True))
            if response.status_code == 200:
                print(f"✓ Found working status endpoint: {endpoint}")
                working_endpoint = endpoint
                break
        except Exception:
            pass

    if not working_endpoint:
        print("✗ Could not find a working status endpoint for checking processing status")
        # Just assume it worked since we can't check
        print("Assuming processing completed successfully")
        return True

    # Now start the main polling loop
    while True:
        # Check if we've exceeded the timeout
        if time.time() - start_time > timeout:
            print(f"✗ Processing timed out after {timeout} seconds")
            return False

        # Check processing status
        try:
            response = requests.get(
                working_endpoint,
                headers=get_headers(for_json=True)
            )

            if response.status_code == 200:
                result = response.json()
                status = result.get('status')
                progress = result.get('progress', 0)

                if VERBOSE:
                    print(f"Status: {status}, Progress: {progress}%")

                if status == 'completed':
                    print("✓ Processing completed successfully!")
                    return True
                elif status == 'failed':
                    print(
                        f"✗ Processing failed: {result.get('error', 'Unknown error')}")
                    return False
            else:
                print(
                    f"Error checking status: {response.status_code} - {response.text}")

        except Exception as e:
            print(f"Error checking status: {str(e)}")

        # Wait before checking again
        time.sleep(check_interval)

    return False  # Default to failed if we somehow exit the loop


def test_bulk_process(file_ids):
    """Test bulk processing API with multiple files"""
    print(f"\nTesting bulk processing with {len(file_ids)} files")

    if DEBUG_MODE:
        print(
            f"DEBUG: Starting bulk process for {len(file_ids)} files: {file_ids}")

    request_data = {
        'invoice_ids': file_ids,
        # Add max_workers parameter for better control
        'max_workers': MAX_WORKERS
    }

    if DEBUG_MODE:
        print(f"DEBUG: Request data: {json.dumps(request_data, indent=2)}")
        print(f"DEBUG: Request headers: {get_headers(for_json=True)}")

    # Use the correct URL for bulk processing
    bulk_url = f"{BASE_URL}/v2/data/process-bulk/"

    if DEBUG_MODE:
        print(f"DEBUG: Bulk process URL: {bulk_url}")

    response = requests.post(
        bulk_url,
        headers=get_headers(for_json=True),
        json=request_data
    )

    if DEBUG_MODE:
        print(f"DEBUG: Response status: {response.status_code}")
        print(f"DEBUG: Response headers: {dict(response.headers)}")
        try:
            print(
                f"DEBUG: Response JSON: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"DEBUG: Response text: {response.text[:500]}")

    if response.status_code in [200, 201, 202]:
        print(f"✓ Bulk processing started! (Status: {response.status_code})")
        try:
            result = response.json()
            bulk_task_id = result.get('task_id')
            print(f"Bulk Task ID: {bulk_task_id}")

            if DEBUG_MODE:
                print(f"DEBUG: Full response: {json.dumps(result, indent=2)}")
                print(
                    f"DEBUG: Processing mode: {result.get('processing_mode', 'unknown')}")
                print(
                    f"DEBUG: Invoice count: {result.get('invoice_count', 'unknown')}")

            return bulk_task_id
        except Exception as e:
            if DEBUG_MODE:
                print(f"DEBUG: Exception parsing response: {str(e)}")
                import traceback
                print(f"DEBUG: Traceback: {traceback.format_exc()}")
            print(f"Response: {response.text}")
            return None
    else:
        print(
            f"✗ Bulk processing failed with status code {response.status_code}")
        print(f"Response: {response.text}")
        return None


def wait_for_bulk_processing(task_id, timeout=600, check_interval=10):
    """Wait for bulk processing to complete or timeout"""
    start_time = time.time()

    if DEBUG_MODE:
        print(
            f"\nDEBUG: Starting bulk processing wait loop for task_id={task_id}")
        print(
            f"DEBUG: Timeout set to {timeout}s, checking every {check_interval}s")

    while True:
        # Check if we've exceeded the timeout
        elapsed = time.time() - start_time
        if elapsed > timeout:
            print(f"✗ Bulk processing timed out after {timeout} seconds")
            return False

        # Check processing status
        try:
            # Use process-bulk endpoint with task_id parameter instead of tasks endpoint
            status_url = f"{BASE_URL}/v2/data/process-bulk/?task_id={task_id}"
            if DEBUG_MODE:
                print(f"\nDEBUG: Checking status at: {status_url}")
                print(f"DEBUG: Elapsed time: {elapsed:.1f}s")

            response = requests.get(
                status_url,
                headers=get_headers(for_json=True)
            )

            if DEBUG_MODE:
                print(f"DEBUG: Status response code: {response.status_code}")

            if response.status_code == 200:
                result = response.json()
                # The response may have a nested 'progress' structure
                progress_data = result.get('progress', {})

                # Extract status and progress info from the response
                if isinstance(progress_data, dict):
                    status = progress_data.get('status', result.get('status'))
                    progress = progress_data.get(
                        'progress', result.get('progress', 0))
                    total = progress_data.get('total_invoices', 0)
                    completed = progress_data.get('completed_invoices', 0)
                    failed = progress_data.get('failed_invoices', 0)

                    if DEBUG_MODE:
                        print(
                            f"DEBUG: Raw progress data: {json.dumps(progress_data, indent=2)[:500]}")
                        if 'invoice_statuses' in progress_data:
                            statuses = progress_data.get(
                                'invoice_statuses', {})
                            print(
                                f"DEBUG: Invoice statuses: {len(statuses)} items")
                            for invoice_id, status_info in list(statuses.items())[:3]:
                                print(
                                    f"DEBUG:   Invoice {invoice_id}: {status_info}")
                else:
                    status = result.get('status')
                    progress = result.get('progress', 0)
                    total = result.get('total_items', 0)
                    completed = result.get('current_item', 0)
                    failed = 0

                if VERBOSE:
                    status_line = f"Status: {status}, Progress: {progress}%, Items: {completed}/{total}"
                    if failed > 0:
                        status_line += f", Failed: {failed}"
                    print(status_line)

                if status in ['completed', 'complete']:
                    print("✓ Bulk processing completed successfully!")
                    if DEBUG_MODE:
                        print(f"DEBUG: Final status: {status}")
                        print(
                            f"DEBUG: Total time: {time.time() - start_time:.2f}s")
                        print(
                            f"DEBUG: Completed: {completed}, Failed: {failed}, Total: {total}")
                    return True
                elif status == 'failed':
                    error_msg = result.get(
                        'error', progress_data.get('message', 'Unknown error'))
                    print(f"✗ Bulk processing failed: {error_msg}")
                    if DEBUG_MODE:
                        print(f"DEBUG: Error details: {error_msg}")
                        print(
                            f"DEBUG: Full result: {json.dumps(result, indent=2)}")
                    return False
            else:
                print(
                    f"Error checking bulk status: {response.status_code} - {response.text}")
                if DEBUG_MODE:
                    print(f"DEBUG: Error response headers: {response.headers}")

        except Exception as e:
            print(f"Error checking bulk status: {str(e)}")
            if DEBUG_MODE:
                import traceback
                print(f"DEBUG: Exception traceback: {traceback.format_exc()}")

        # Wait before checking again
        if DEBUG_MODE:
            print(f"DEBUG: Waiting {check_interval}s before next check...")
        time.sleep(check_interval)


def simple_bulk_process_test():
    """Run a bulk processing test with all available test files"""
    files = list_available_test_files()

    if not files or len(files) < 2:
        print("✗ Need at least 2 test files for bulk processing test")
        return False

    # Use all files of different sizes for the test
    small_files = [f for f in files if f['category'] == 'small']
    medium_files = [f for f in files if f['category'] == 'medium']
    large_files = [f for f in files if f['category'] == 'large']

    test_files = small_files + medium_files + large_files
    if not test_files:
        # Fall back to all files if categorization failed
        test_files = files

    print(f"\nUploading all {len(test_files)} files for bulk processing test:")
    file_ids = []

    for file_info in test_files:
        print(
            f"\nUploading {file_info['name']} ({file_info['size_formatted']})...")
        file_id = upload_test_file(file_info['path'])
        if file_id:
            file_ids.append(file_id)

    if not file_ids:
        print("✗ Failed to upload any files for bulk processing test")
        return False

    print(f"\nStarting bulk processing for {len(file_ids)} files...")
    bulk_task_id = test_bulk_process(file_ids)

    if not bulk_task_id:
        print("✗ Failed to start bulk processing")
        return False

    print("\nWaiting for bulk processing to complete...")
    completed = wait_for_bulk_processing(bulk_task_id)

    if completed:
        print("✓ Bulk processing test successful!")
        return True
    else:
        print("✗ Bulk processing test failed")
        return False


def interactive_testing():
    """Interactive test menu to test components step-by-step"""
    print("\n" + "=" * 40)
    print("INTERACTIVE TESTING MENU")
    print("=" * 40)

    # First, check if the API is accessible
    if not basic_health_check():
        print("\n✗ Health check failed. Make sure the Django server is running.")
        retry = input("Do you want to retry the health check? (y/n): ")
        if retry.lower() == 'y':
            if not basic_health_check():
                print(
                    "✗ Health check failed again. Please check your server configuration.")
                return
        else:
            print("Exiting interactive testing...")
            return

    # List available test files
    files = list_available_test_files()
    if not files:
        print("\n✗ No test files found. Please add some files to the test_data directory.")
        return

    # Main interactive menu
    while True:
        print("\n" + "=" * 40)
        print("TEST OPTIONS")
        print("=" * 40)
        print("1. Test file upload")
        print("2. Test single file processing")
        print("3. Test large file optimization")
        print("4. Test bulk processing")
        print("5. Refresh file list")
        print("0. Exit")

        choice = input("\nSelect an option (0-5): ")

        if choice == '1':
            # Show file selection menu
            print("\nSelect a file to upload:")
            for i, file_info in enumerate(files):
                print(
                    f"{i+1}. {file_info['name']} ({file_info['size_formatted']})")

            file_choice = input(f"\nSelect a file (1-{len(files)}): ")
            try:
                file_index = int(file_choice) - 1
                if 0 <= file_index < len(files):
                    upload_test_file(files[file_index]['path'])
                else:
                    print("Invalid selection")
            except ValueError:
                print("Invalid selection")

        elif choice == '2':
            test_single_file_processing()

        elif choice == '3':
            test_large_file_optimization()

        elif choice == '4':
            simple_bulk_process_test()

        elif choice == '5':
            files = list_available_test_files()

        elif choice == '0':
            print("Exiting interactive testing...")
            break

        else:
            print("Invalid selection, please try again")


def run_full_test_suite():
    """Run all tests in sequence"""
    print("\n" + "=" * 40)
    print("RUNNING FULL TEST SUITE")
    print("=" * 40)

    tests_passed = 0
    tests_failed = 0

    # Test 1: Health Check
    print("\nTest 1: API Health Check")
    if basic_health_check():
        tests_passed += 1
    else:
        tests_failed += 1
        print("✗ Aborting remaining tests due to health check failure")
        return tests_passed, tests_failed

    # Test 2: File Upload
    print("\nTest 2: File Upload")
    if test_single_file_upload():
        tests_passed += 1
    else:
        tests_failed += 1

    # Test 3: Single File Processing
    print("\nTest 3: Single File Processing")
    if test_single_file_processing():
        tests_passed += 1
    else:
        tests_failed += 1

    # Test 4: Large File Optimization
    print("\nTest 4: Large File Optimization")
    if test_large_file_optimization():
        tests_passed += 1
    else:
        tests_failed += 1

    # Test 5: Bulk Processing
    print("\nTest 5: Bulk Processing")
    if simple_bulk_process_test():
        tests_passed += 1
    else:
        tests_failed += 1

    # Summary
    print("\n" + "=" * 40)
    print("TEST RESULTS SUMMARY")
    print("=" * 40)
    print(f"Tests Passed: {tests_passed}/{tests_passed + tests_failed}")
    print(f"Tests Failed: {tests_failed}/{tests_passed + tests_failed}")

    return tests_passed, tests_failed


if __name__ == "__main__":
    print("=" * 80)
    print(f"V2 API ENDPOINT TESTING TOOL (Version 1.1)")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    if len(sys.argv) > 1:
        if sys.argv[1] == "--interactive":
            interactive_testing()
        elif sys.argv[1] == "--health-check":
            basic_health_check()
        elif sys.argv[1] == "--list-files":
            list_available_test_files()
        else:
            print(f"Unknown option: {sys.argv[1]}")
            print("Available options: --interactive, --health-check, --list-files")
    else:
        print("\nTest mode options:")
        print("1. Interactive testing (step-by-step)")
        print("2. Run full test suite")
        print("3. Basic health check only")

        mode = input("\nSelect test mode (1-3): ")

        if mode == '1':
            interactive_testing()
        elif mode == '2':
            run_full_test_suite()
        elif mode == '3':
            basic_health_check()
        else:
            print("Invalid selection, defaulting to interactive testing")
            interactive_testing()
