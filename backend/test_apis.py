import requests
import json
import sys
from datetime import datetime
import random
import string

# Configuration
BASE_URL = "http://localhost:8000"  # Change if your server is hosted elsewhere
YEAR = 2024
MONTH = 1
DOT = ""  # Leave empty for 'All DOTs'
TESTING_MODE = True
# New flag to control whether to show all responses or just failures
SHOW_ALL_RESPONSES = True

# Optional: Authentication credentials
# Add your token here if needed
AUTH_TOKEN = '954c69d18bde8010d7ea8bfe9faf4d7e4ea5d8e7bf3c11280ff3f9a19fec6b97'

# Track non-successful responses
failed_endpoints = []


def get_headers():
    headers = {'Content-Type': 'application/json'}
    if AUTH_TOKEN:
        headers['Authorization'] = f'Token {AUTH_TOKEN}'
    return headers


def test_endpoint(endpoint, method="GET", body=None, params=None, expected_status=200):
    """Test a specific API endpoint and print results"""
    url = f"{BASE_URL}{endpoint}"

    # Add testing parameter for bypass if needed
    if TESTING_MODE and params is None:
        params = {'testing': 'true'}
    elif TESTING_MODE:
        params['testing'] = 'true'

    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=get_headers(), params=params)
        elif method.upper() == "POST":
            response = requests.post(
                url, headers=get_headers(), json=body, params=params)
        elif method.upper() == "PUT":
            response = requests.put(
                url, headers=get_headers(), json=body, params=params)
        elif method.upper() == "DELETE":
            response = requests.delete(
                url, headers=get_headers(), params=params)
        elif method.upper() == "OPTIONS":
            response = requests.options(
                url, headers=get_headers(), params=params)
        elif method.upper() == "PATCH":
            response = requests.patch(
                url, headers=get_headers(), json=body, params=params)
        else:
            failed_endpoints.append({
                "method": method,
                "endpoint": endpoint,
                "status": "ERROR",
                "error": "Unsupported method"
            })
            return False

        # Track non-200 responses unless they match expected status
        if response.status_code != 200 and (expected_status is None or response.status_code != expected_status):
            error_info = {
                "method": method,
                "endpoint": endpoint,
                "status": response.status_code,
                "response_time": f"{response.elapsed.total_seconds():.2f}s",
                "expected": expected_status
            }

            # Add response text if available
            try:
                error_info["response"] = response.json(
                ) if response.text else "Empty response"
            except json.JSONDecodeError:
                error_info["response"] = response.text[:200] + \
                    ("..." if len(response.text) > 200 else "")

            failed_endpoints.append(error_info)

            # Print failure immediately
            print(f"\n{'='*40} FAILED TEST {'='*40}")
            print(f"Method: {method}")
            print(f"Endpoint: {endpoint}")
            print(f"Status Code: {response.status_code}")
            print(f"Response Time: {response.elapsed.total_seconds():.2f}s")
            if expected_status:
                print(f"Expected Status: {expected_status}")
            print(f"Response: {error_info['response']}")
            print('='*90)

        # Always print response info if SHOW_ALL_RESPONSES is True
        elif SHOW_ALL_RESPONSES:
            response_info = {}
            try:
                response_info = response.json() if response.text else "Empty response"
            except json.JSONDecodeError:
                response_info = response.text[:200] + \
                    ("..." if len(response.text) > 200 else "")

            print(f"\n{'='*40} TEST RESULT {'='*40}")
            print(f"Method: {method}")
            print(f"Endpoint: {endpoint}")
            print(f"Status Code: {response.status_code}")
            print(f"Response Time: {response.elapsed.total_seconds():.2f}s")
            print(f"Response: {response_info}")
            print('='*90)

        return response.status_code == (expected_status or 200)

    except requests.RequestException as e:
        error_info = {
            "method": method,
            "endpoint": endpoint,
            "status": "ERROR",
            "error": str(e)
        }
        failed_endpoints.append(error_info)

        # Print failure immediately
        print(f"\n{'='*40} FAILED TEST {'='*40}")
        print(f"Method: {method}")
        print(f"Endpoint: {endpoint}")
        print(f"Error: {str(e)}")
        print('='*90)
        return False


def generate_random_string(length=10):
    """Generate a random string for test data"""
    return ''.join(random.choice(string.ascii_letters) for _ in range(length))


def test_all_apis():
    """Test all API endpoints"""
    success_count = 0
    total_count = 0

    # Store task IDs returned from validation/cleaning endpoints
    validation_task_id = None
    cleaning_task_id = None

    # Sample data for POST requests
    user_data = {
        "email": f"test_{generate_random_string(8)}@example.com",
        "password": "TestPassword123!",
        "firstName": "Test",
        "lastName": "User",
        "role": "viewer"
    }

    login_data = {
        "email": "admin@admin.admin",  # Change this to an existing user
        "password": "admin123"        # Change this to correct password
    }

    dot_permission_data = {
        "dot_code": "ALG",
        "dot_name": "Alger"
    }

    dot_data = {
        "code": f"T{generate_random_string(3)}",
        "name": f"Test DOT {generate_random_string(5)}",
        "description": "Created for testing purposes",
        "is_active": True
    }

    invoice_data = {
        "invoice_number": f"TEST-{generate_random_string(8)}",
        "file_type": "journal_ventes",
        "status": "new"
    }

    anomaly_resolution_data = {
        "resolution_type": "manual_fix",
        "comments": "Fixed during testing"
    }

    # =======================================================================
    # DATA APP ENDPOINTS
    # =======================================================================

    # Core Dashboard and KPI APIs
    #     path('validation/', views.DataValidationView.as_view()),
    # path('validation/clean/', views.DataValidationView.as_view()),
    api_tests = [
        # Data validation endpoints
        # ("/data/validation/", "GET"),
        # ("/data/validation/", "POST", {
        #     "validate_first": True,
        #     "models_to_clean": ["journal_ventes", "etat_facture"],
        #     "dot": None,
        #     "start_date": None,
        #     "end_date": None
        # }),

        # # Data cleaning endpoint - separate from validation
        # ("/data/cleaning/", "POST", {
        #     "validate_first": True,
        #     "models_to_clean": ["journal_ventes", "etat_facture"],
        #     "dot": None,
        #     "start_date": None,
        #     "end_date": None
        # }),

        # Validation progress tracking endpoint
        ("/data/validation-progress/", "GET", None,
         {"task_id": "test_task_id", "type": "validation"}),
        ("/data/validation-progress/", "GET", None,
         {"task_id": "test_task_id", "type": "cleaning"}),

        # Dashboard & Summary APIs
        ("/data/kpi/dashboard-summary/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/dashboard/overview/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/dashboard/enhanced/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/dashboard/overview/", "OPTIONS"),
        ("/data/dashboard/enhanced/", "OPTIONS"),

        # KPI Endpoints
        ("/data/kpi/revenue/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/kpi/collection/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/kpi/receivables/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/kpi/corporate-park/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/kpi/ngbss-collection/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/kpi/unfinished-invoice/", "GET", None,
         {"year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/kpi/performance-ranking/", "GET", None,
         {"year": YEAR, "month": MONTH, "metric": "revenue", "limit": 5}),
        ("/data/kpi/performance-ranking/", "GET", None,
         {"year": YEAR, "month": MONTH, "metric": "collection", "limit": 5}),
        ("/data/kpi/performance-ranking/", "GET", None,
         {"year": YEAR, "month": MONTH, "metric": "receivables", "limit": 5}),
        ("/data/kpi/performance-ranking/", "GET", None,
         {"year": YEAR, "month": MONTH, "metric": "corporate_park", "limit": 5}),

        # OPTIONS for KPI endpoints
        ("/data/kpi/dashboard-summary/", "OPTIONS"),
        ("/data/kpi/revenue/", "OPTIONS"),
        ("/data/kpi/collection/", "OPTIONS"),
        ("/data/kpi/receivables/", "OPTIONS"),
        ("/data/kpi/corporate-park/", "OPTIONS"),
        ("/data/kpi/ngbss-collection/", "OPTIONS"),
        ("/data/kpi/unfinished-invoice/", "OPTIONS"),
        ("/data/kpi/performance-ranking/", "OPTIONS"),

        # Report Exports
        ("/data/reports/export/revenue_collection/", "GET", None,
         {"format": "excel", "year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/reports/export/corporate_park/", "GET", None,
         {"format": "excel", "year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/reports/export/receivables/", "GET", None,
         {"format": "excel", "year": YEAR, "month": MONTH, "dot": DOT}),
        ("/data/reports/export/revenue_collection/", "OPTIONS"),
        ("/data/reports/export/corporate_park/", "OPTIONS"),
        ("/data/reports/export/receivables/", "OPTIONS"),

        # # Reports
        # ("/data/reports/", "GET", None,
        #  {"type": "revenue_collection", "year": YEAR, "month": MONTH, "dot": DOT}),
        # ("/data/reports/", "GET", None,
        #  {"type": "corporate_park", "year": YEAR, "month": MONTH, "dot": DOT}),
        # ("/data/reports/", "GET", None,
        #  {"type": "receivables", "year": YEAR, "month": MONTH, "dot": DOT}),
        # ("/data/reports/", "OPTIONS"),

        # # Utility APIs
        # ("/data/health-check/", "GET"),
        # ("/data/file-types/", "GET"),
        # ("/data/file-types/", "OPTIONS"),

        # # Export Data
        # ("/data/export/", "GET", None,
        #  {"type": "revenue", "format": "excel", "year": YEAR, "month": MONTH, "dot": DOT}),
        # ("/data/export/", "OPTIONS"),

        # # Progress tracking
        # ("/data/progress/", "GET"),
        # ("/data/progress/", "OPTIONS"),

        # # Anomaly APIs
        # ("/data/anomalies/", "GET"),
        # ("/data/anomalies/", "OPTIONS"),
        # ("/data/anomalies/stats/", "GET"),
        # ("/data/anomalies/stats/", "OPTIONS"),
        # ("/data/anomalies/types/", "GET"),
        # ("/data/anomalies/types/", "OPTIONS"),
        # ("/data/anomalies/scan/", "POST", {}, None, 403),  # Should be admin-only

        # # Invoice APIs
        # ("/data/invoices/", "GET"),
        # ("/data/invoices/", "OPTIONS"),
        # ("/data/invoices/upload/", "OPTIONS"),

        # # Data List APIs - GET and OPTIONS for all models
        # ("/data/journal-ventes/", "GET"),
        # ("/data/journal-ventes/", "OPTIONS"),
        # ("/data/etat-facture/", "GET"),
        # ("/data/etat-facture/", "OPTIONS"),
        # ("/data/parc-corporate/", "GET"),
        # ("/data/parc-corporate/", "OPTIONS"),
        # ("/data/creances-ngbss/", "GET"),
        # ("/data/creances-ngbss/", "OPTIONS"),
        # ("/data/ca-periodique/", "GET"),
        # ("/data/ca-periodique/", "OPTIONS"),
        # ("/data/ca-non-periodique/", "GET"),
        # ("/data/ca-non-periodique/", "OPTIONS"),
        # ("/data/ca-dnt/", "GET"),
        # ("/data/ca-dnt/", "OPTIONS"),
        # ("/data/ca-rfd/", "GET"),
        # ("/data/ca-rfd/", "OPTIONS"),
        # ("/data/ca-cnt/", "GET"),
        # ("/data/ca-cnt/", "OPTIONS"),
        # ("/data/facturation-manuelle/", "GET"),
        # ("/data/facturation-manuelle/", "OPTIONS"),
    ]

    # =======================================================================
    # USERS APP ENDPOINTS
    # =======================================================================

    # Fix: Changed to use /api/auth/ prefix since that's the working pattern
    auth_base = "/api/auth"

    user_tests = [
        # Authentication
        # (f"{auth_base}/login/", "POST", login_data),
        # (f"{auth_base}/login/", "OPTIONS"),
        # (f"{auth_base}/register/", "POST", user_data),
        # (f"{auth_base}/register/", "OPTIONS"),
        # (f"{auth_base}/current/", "GET"),
        # (f"{auth_base}/current/", "OPTIONS"),
        # (f"{auth_base}/token/", "POST", login_data),
        # (f"{auth_base}/token/refresh/", "POST",
        #  {"refresh": "your-refresh-token-here"}),

        # # User Management
        # (f"{auth_base}/users/", "GET"),
        # (f"{auth_base}/users/", "OPTIONS"),
        # (f"{auth_base}/users/stats/", "GET"),
        # (f"{auth_base}/users/stats/", "OPTIONS"),
        # (f"{auth_base}/users/inactive/", "GET"),
        # (f"{auth_base}/users/inactive/", "OPTIONS"),

        # # DOT Management
        # (f"{auth_base}/dots/", "GET"),
        # (f"{auth_base}/dots/", "OPTIONS"),
        # (f"{auth_base}/dots/", "POST", dot_data, None, 201),
    ]

    # Combine all test lists
    all_tests = api_tests + user_tests

    # Run all tests
    print("\nRunning API tests... Showing all API responses.")
    print("="*90)

    for test in all_tests:
        if len(test) == 2:
            endpoint, method = test
            body, params, expected_status = None, None, None
        elif len(test) == 3:
            endpoint, method, body = test
            params, expected_status = None, None
        elif len(test) == 4:
            endpoint, method, body, params = test
            expected_status = None
        else:
            endpoint, method, body, params, expected_status = test

        # Skip validation progress tests initially since we need task IDs
        if endpoint == "/data/validation-progress/" and not validation_task_id and not cleaning_task_id:
            continue

        # Update validation-progress parameters with actual task IDs
        if endpoint == "/data/validation-progress/" and params and "type" in params:
            if params["type"] == "validation" and validation_task_id:
                params["task_id"] = validation_task_id
            elif params["type"] == "cleaning" and cleaning_task_id:
                params["task_id"] = cleaning_task_id

        total_count += 1
        result = test_endpoint(endpoint, method, body, params, expected_status)

        # Store task IDs from response if available
        if result and endpoint == "/data/validation/" and method == "GET":
            # Make another request to get the response data (a bit hacky, but works)
            response = requests.get(
                f"{BASE_URL}{endpoint}", headers=get_headers(), params=params or {})
            try:
                data = response.json()
                if "task_id" in data:
                    validation_task_id = data["task_id"]
                    print(f"Captured validation task ID: {validation_task_id}")
            except:
                pass

        elif result and ((endpoint == "/data/validation/" and method == "POST") or
                         (endpoint == "/data/cleaning/" and method == "POST")):
            # Make another request to get the response data
            response = requests.post(f"{BASE_URL}{endpoint}", headers=get_headers(),
                                     json=body, params=params or {})
            try:
                data = response.json()
                if "task_id" in data:
                    cleaning_task_id = data["task_id"]
                    print(f"Captured cleaning task ID: {cleaning_task_id}")
            except:
                pass

        if result:
            success_count += 1

    # Now run the validation progress tests with the real task IDs
    if validation_task_id or cleaning_task_id:
        if validation_task_id:
            total_count += 1
            if test_endpoint("/data/validation-progress/", "GET", None,
                             {"task_id": validation_task_id, "type": "validation"}):
                success_count += 1

        if cleaning_task_id:
            total_count += 1
            if test_endpoint("/data/validation-progress/", "GET", None,
                             {"task_id": cleaning_task_id, "type": "cleaning"}):
                success_count += 1

    # Print summary
    print(f"\n{'='*40} SUMMARY {'='*40}")
    print(f"Total endpoints tested: {total_count}")
    print(f"Successful: {success_count}")
    print(f"Failed: {total_count - success_count}")
    if failed_endpoints:
        print(f"\nTotal number of failed endpoints: {len(failed_endpoints)}")
    print('='*90)

    return success_count, total_count


def test_single_endpoint(endpoint, method="GET", body=None, params=None):
    """Test a single endpoint specified by the user"""
    print(f"\nTesting single endpoint: {method} {endpoint}")
    print("="*90)
    test_endpoint(endpoint, method, body, params)


if __name__ == "__main__":
    print(f"Starting API tests at {datetime.now()}")
    print("Showing results for all API responses")
    print("="*90)

    # If command line arguments are provided, test a single endpoint
    if len(sys.argv) > 1:
        endpoint = sys.argv[1]
        method = sys.argv[2] if len(sys.argv) > 2 else "GET"
        test_single_endpoint(endpoint, method)
    else:
        # Otherwise test all endpoints
        test_all_apis()

    print(f"\nFinished API tests at {datetime.now()}")
