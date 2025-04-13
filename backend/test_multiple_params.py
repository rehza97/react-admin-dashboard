#!/usr/bin/env python
import requests
import json
import time

# Base URL and auth token
url = 'http://localhost:8000/data/export/corporate-park/'
headers = {
    'Authorization': 'Token f3c764779498cfebcb0342a627d573de4cea376bc60aa2e943800e897146dc78'}

# Test with multiple parameters
print('Test with multiple parameters')
params = {
    'export_format': 'excel',
    'dot': 'Adrar',
    'state': 'Active',
    'telecom_type': 'Mobile',
    'subscriber_status': 'Active',
    'year': '2023',
    'month': '12'
}

r1 = requests.get(url, headers=headers, params=params)
print(f'Status: {r1.status_code}')
print(f'Response: {r1.text}\n')

# Test with array-style parameters
print('Test with array-style parameters')
params_array = {
    'export_format': 'csv',
    'dot[]': ['Adrar', 'Alger'],
    'state[]': ['Active', 'Suspended'],
    'telecom_type[]': ['Mobile', 'Fixed'],
    'offer_name[]': ['Business', 'Enterprise'],
    'customer_l2[]': ['01', '02'],
    'customer_l3[]': ['001', '002'],
    'subscriber_status[]': ['Active', 'Suspended']
}

r2 = requests.get(url, headers=headers, params=params_array)
print(f'Status: {r2.status_code}')
print(f'Response: {r2.text}\n')

# Test with mix of single and array parameters
print('Test with mix of parameters')
params_mixed = {
    'export_format': 'pdf',
    'dot': 'Adrar',
    'state[]': ['Active', 'Suspended'],
    'telecom_type': 'Mobile',
    'year': '2023',
    'month': '12'
}

r3 = requests.get(url, headers=headers, params=params_mixed)
print(f'Status: {r3.status_code}')
print(f'Response: {r3.text}\n')

# Wait for task completion
if r1.status_code == 200:
    try:
        task_id = json.loads(r1.text).get('task_id')
        if task_id:
            print(f'Checking status of task: {task_id}')
            status_url = f'{url}status/?task_id={task_id}'

            # Poll status a few times
            for i in range(3):
                time.sleep(2)  # Wait 2 seconds between polls

                status_response = requests.get(status_url, headers=headers)
                print(f'Status check {i+1}: {status_response.status_code}')
                print(f'Response: {status_response.text}')
    except Exception as e:
        print(f'Error checking task status: {str(e)}')
