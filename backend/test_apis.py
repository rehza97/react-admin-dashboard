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
AUTH_TOKEN = 'f3c764779498cfebcb0342a627d573de4cea376bc60aa2e943800e897146dc78'

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


def fetch_real_test_data():
    """Fetch real data from corporate park and DOT APIs for testing"""
    print("\n" + "="*30 + " FETCHING REAL DATA FOR TESTS " + "="*30)

    # Initialize with default values
    real_data = {
        'dots': ["ALG", "ORA"],
        'telecom_types': ["FTTx", "VOIP"],
        'offer_names': ["Business", "Premium"],
        'customer_l2_codes': ["1", "2"],
        'customer_l3_codes': ["11", "22"],
        'subscriber_statuses': ["Active", "Suspended"],
        'years': [2023, 2024],
        'months': [1, 6, 12]
    }

    # 1. Fetch DOTs
    try:
        print("Fetching DOTs...")
        # Try different possible endpoints for DOT data
        dot_endpoints = [
            "/api/auth/dots/",
            "/data/dots/"
        ]

        for endpoint in dot_endpoints:
            try:
                response = requests.get(
                    f"{BASE_URL}{endpoint}", headers=get_headers())
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
                        real_data['dots'] = dots
                        print(
                            f"Found {len(dots)} DOTs: {dots[:5]}{' ...' if len(dots) > 5 else ''}")
                        break
            except requests.RequestException as e:
                print(f"Error fetching DOTs from {endpoint}: {str(e)}")

    except Exception as e:
        print(f"Error fetching DOTs: {str(e)}")

    # 2. Fetch Corporate Park data
    try:
        print("Fetching corporate park data...")
        response = requests.get(
            f"{BASE_URL}/data/kpi/corporate-park/", headers=get_headers())

        if response.status_code == 200:
            data = response.json()

            # Extract telecom types
            if 'subscribers_by_telecom' in data and isinstance(data['subscribers_by_telecom'], list):
                telecom_types = list(set(
                    item['telecom_type'] for item in data['subscribers_by_telecom']
                    if 'telecom_type' in item and item['telecom_type']
                ))
                if telecom_types:
                    real_data['telecom_types'] = telecom_types
                    print(
                        f"Found {len(telecom_types)} telecom types: {telecom_types}")

            # Extract offer names
            if 'subscribers_by_offer' in data and isinstance(data['subscribers_by_offer'], list):
                offer_names = list(set(
                    item['offer_name'] for item in data['subscribers_by_offer']
                    if 'offer_name' in item and item['offer_name']
                ))
                if offer_names:
                    real_data['offer_names'] = offer_names
                    print(
                        f"Found {len(offer_names)} offer names: {offer_names[:5]}{' ...' if len(offer_names) > 5 else ''}")

            # Extract customer codes
            if 'subscribers_by_customer' in data and isinstance(data['subscribers_by_customer'], list):
                customer_l2_codes = list(set(
                    item['customer_l2_code'] for item in data['subscribers_by_customer']
                    if 'customer_l2_code' in item and item['customer_l2_code']
                ))
                if customer_l2_codes:
                    real_data['customer_l2_codes'] = customer_l2_codes
                    print(
                        f"Found {len(customer_l2_codes)} customer L2 codes: {customer_l2_codes[:5]}{' ...' if len(customer_l2_codes) > 5 else ''}")

                customer_l3_codes = list(set(
                    item['customer_l3_code'] for item in data['subscribers_by_customer']
                    if 'customer_l3_code' in item and item['customer_l3_code']
                ))
                if customer_l3_codes:
                    real_data['customer_l3_codes'] = customer_l3_codes
                    print(
                        f"Found {len(customer_l3_codes)} customer L3 codes: {customer_l3_codes[:5]}{' ...' if len(customer_l3_codes) > 5 else ''}")

            # Extract subscriber statuses
            if 'subscribers_by_status' in data and isinstance(data['subscribers_by_status'], list):
                subscriber_statuses = list(set(
                    item['subscriber_status'] for item in data['subscribers_by_status']
                    if 'subscriber_status' in item and item['subscriber_status']
                ))
                if subscriber_statuses:
                    real_data['subscriber_statuses'] = subscriber_statuses
                    print(
                        f"Found {len(subscriber_statuses)} subscriber statuses: {subscriber_statuses}")
        else:
            print(
                f"Could not fetch corporate park data. Status code: {response.status_code}")

    except Exception as e:
        print(f"Error fetching corporate park data: {str(e)}")

    # 3. Try fetching data directly from parc-corporate if needed
    if not any([len(real_data['telecom_types']) > 1, len(real_data['offer_names']) > 1,
               len(real_data['customer_l2_codes']) > 1, len(real_data['subscriber_statuses']) > 1]):
        try:
            print("Fetching parc-corporate data directly...")
            response = requests.get(
                f"{BASE_URL}/data/parc-corporate/", headers=get_headers())

            if response.status_code == 200:
                data = response.json()

                # Check if we have results
                if 'results' in data and isinstance(data['results'], list) and data['results']:
                    sample_data = data['results']

                    # Extract telecom types
                    if len(real_data['telecom_types']) <= 1:
                        telecom_types = list(set(
                            item['telecom_type'] for item in sample_data
                            if 'telecom_type' in item and item['telecom_type']
                        ))
                        if telecom_types:
                            real_data['telecom_types'] = telecom_types
                            print(
                                f"Found {len(telecom_types)} telecom types from parc-corporate: {telecom_types}")

                    # Extract offer names
                    if len(real_data['offer_names']) <= 1:
                        offer_names = list(set(
                            item['offer_name'] for item in sample_data
                            if 'offer_name' in item and item['offer_name']
                        ))
                        if offer_names:
                            real_data['offer_names'] = offer_names
                            print(
                                f"Found {len(offer_names)} offer names from parc-corporate: {offer_names[:5]}{' ...' if len(offer_names) > 5 else ''}")

                    # Extract customer codes
                    if len(real_data['customer_l2_codes']) <= 1:
                        customer_l2_codes = list(set(
                            item['customer_l2_code'] for item in sample_data
                            if 'customer_l2_code' in item and item['customer_l2_code']
                        ))
                        if customer_l2_codes:
                            real_data['customer_l2_codes'] = customer_l2_codes
                            print(
                                f"Found {len(customer_l2_codes)} customer L2 codes from parc-corporate: {customer_l2_codes[:5]}{' ...' if len(customer_l2_codes) > 5 else ''}")

                    if len(real_data['customer_l3_codes']) <= 1:
                        customer_l3_codes = list(set(
                            item['customer_l3_code'] for item in sample_data
                            if 'customer_l3_code' in item and item['customer_l3_code']
                        ))
                        if customer_l3_codes:
                            real_data['customer_l3_codes'] = customer_l3_codes
                            print(
                                f"Found {len(customer_l3_codes)} customer L3 codes from parc-corporate: {customer_l3_codes[:5]}{' ...' if len(customer_l3_codes) > 5 else ''}")

                    # Extract subscriber statuses
                    if len(real_data['subscriber_statuses']) <= 1:
                        subscriber_statuses = list(set(
                            item['subscriber_status'] for item in sample_data
                            if 'subscriber_status' in item and item['subscriber_status']
                        ))
                        if subscriber_statuses:
                            real_data['subscriber_statuses'] = subscriber_statuses
                            print(
                                f"Found {len(subscriber_statuses)} subscriber statuses from parc-corporate: {subscriber_statuses}")
        except Exception as e:
            print(f"Error fetching parc-corporate data: {str(e)}")

    print("\nSummary of real data for testing:")
    for key, values in real_data.items():
        print(
            f"- {key}: {values[:5]}{' ...' if len(values) > 5 else ''} ({len(values)} items)")

    return real_data


def test_export_endpoints():
    """Test the Corporate Park export endpoints with various parameter combinations"""
    print("\n" + "="*30 + " TESTING EXPORT ENDPOINTS " + "="*30)
    success_count = 0
    total_count = 0

    # Fetch real data from the APIs
    real_data = fetch_real_test_data()

    # Define base parameters for testing with real data
    formats = ["excel", "pdf", "csv"]
    sample_size = 2  # Number of items to sample from each category

    # Sample data to limit test combinations
    dots = random.sample(real_data['dots'], min(
        sample_size, len(real_data['dots'])))
    telecom_types = random.sample(real_data['telecom_types'], min(
        sample_size, len(real_data['telecom_types'])))
    offer_names = random.sample(real_data['offer_names'], min(
        sample_size, len(real_data['offer_names'])))
    customer_l2_codes = random.sample(real_data['customer_l2_codes'], min(
        sample_size, len(real_data['customer_l2_codes'])))
    customer_l3_codes = random.sample(real_data['customer_l3_codes'], min(
        sample_size, len(real_data['customer_l3_codes'])))
    subscriber_statuses = random.sample(real_data['subscriber_statuses'], min(
        sample_size, len(real_data['subscriber_statuses'])))
    years = real_data['years']
    months = random.sample(
        real_data['months'], min(3, len(real_data['months'])))

    # Define list of endpoints to test
    endpoints = [
        "/data/export/corporate-park/",
        "/data/reports/export/corporate_park/"
    ]

    # Test 1: Basic endpoints with different formats
    print("\n" + "-"*20 + " Testing basic export formats " + "-"*20)
    for endpoint in endpoints:
        for format in formats:
            total_count += 1
            params = {"format": format}
            success = test_endpoint(endpoint, "GET", None, params)
            if success:
                success_count += 1

    # Test 2: Year and month filters with real data
    print("\n" + "-"*20 + " Testing year and month filters " + "-"*20)
    for endpoint in endpoints:
        for year in years[:1]:  # Limit to one year for brevity
            for month in months[:1]:  # Limit to one month for brevity
                total_count += 1
                params = {
                    "format": "excel",
                    "year": year,
                    "month": month
                }
                success = test_endpoint(endpoint, "GET", None, params)
                if success:
                    success_count += 1

    # Test 3: DOT and telecom type filters with real data
    print("\n" + "-"*20 + " Testing DOT and telecom type filters " + "-"*20)
    for endpoint in endpoints:
        # Test with individual values
        total_count += 1
        params = {
            "format": "excel",
            "dot": dots[0] if dots else "ALG"
        }
        success = test_endpoint(endpoint, "GET", None, params)
        if success:
            success_count += 1

        # Test with individual telecom type
        total_count += 1
        params = {
            "format": "excel",
            "telecom_type": telecom_types[0] if telecom_types else "FTTx"
        }
        success = test_endpoint(endpoint, "GET", None, params)
        if success:
            success_count += 1

        # Test with multiple dots
        if len(dots) > 1:
            total_count += 1
            params = {
                "format": "excel",
                "dot": dots
            }
            success = test_endpoint(endpoint, "GET", None, params)
            if success:
                success_count += 1

        # Test with multiple telecom types
        if len(telecom_types) > 1:
            total_count += 1
            params = {
                "format": "excel",
                "telecom_type": telecom_types
            }
            success = test_endpoint(endpoint, "GET", None, params)
            if success:
                success_count += 1

    # Test 4: Customer code filters with real data
    print("\n" + "-"*20 + " Testing customer code filters " + "-"*20)
    for endpoint in endpoints:
        if customer_l2_codes and customer_l3_codes:
            total_count += 1
            params = {
                "format": "excel",
                "customer_l2": customer_l2_codes[0],
                "customer_l3": customer_l3_codes[0]
            }
            success = test_endpoint(endpoint, "GET", None, params)
            if success:
                success_count += 1

    # Test 5: Offer name filters with real data
    if offer_names:
        print("\n" + "-"*20 + " Testing offer name filters " + "-"*20)
        for endpoint in endpoints:
            total_count += 1
            params = {
                "format": "excel",
                "offer_name": offer_names[0]
            }
            success = test_endpoint(endpoint, "GET", None, params)
            if success:
                success_count += 1

    # Test 6: Subscriber status filters with real data
    if subscriber_statuses:
        print("\n" + "-"*20 + " Testing subscriber status filters " + "-"*20)
        for endpoint in endpoints:
            total_count += 1
            params = {
                "format": "excel",
                "subscriber_status": subscriber_statuses[0]
            }
            success = test_endpoint(endpoint, "GET", None, params)
            if success:
                success_count += 1

    # Test 7: Complex combined filters with real data
    print("\n" + "-"*20 + " Testing complex combined filters " + "-"*20)
    for endpoint in endpoints:
        # Test with multiple filter combinations
        complex_params = [
            {
                "format": "excel",
                "year": years[0] if years else 2024,
                "month": months[0] if months else 1,
                "dot": dots[0] if dots else "ALG",
                "telecom_type": telecom_types[0] if telecom_types else "FTTx"
            },
            {
                "format": "pdf",
                "year": years[-1] if len(years) > 1 else 2023,
                "customer_l2": customer_l2_codes[0] if customer_l2_codes else "1",
                "subscriber_status": subscriber_statuses[0] if subscriber_statuses else "Active"
            },
            {
                "format": "csv",
                "dot": dots,  # Test with multiple values
                "telecom_type": telecom_types,
                "include_creation_date": "true"
            }
        ]

        for params in complex_params:
            total_count += 1
            success = test_endpoint(endpoint, "GET", None, params)
            if success:
                success_count += 1

    # Print summary for export tests
    print("\n" + "="*30 + " EXPORT ENDPOINT TEST SUMMARY " + "="*30)
    print(f"Total export endpoints tested: {total_count}")
    print(f"Successful: {success_count}")
    print(f"Failed: {total_count - success_count}")
    print("="*90)

    return success_count, total_count


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
        # Test export endpoints with various parameters
        test_export_endpoints()

        # Uncomment to test all endpoints
        # test_all_apis()

    print(f"\nFinished API tests at {datetime.now()}")
