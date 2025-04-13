#!/usr/bin/env python
import requests
import json

# Base URL and auth token
url = 'http://localhost:8000/data/export/corporate-park/'
headers = {
    'Authorization': 'Token f3c764779498cfebcb0342a627d573de4cea376bc60aa2e943800e897146dc78'}

# Test 1: Direct access without parameters
print('Test 1: Direct access without parameters')
r1 = requests.get(url, headers=headers)
print(f'Status: {r1.status_code}')
print(f'Response: {r1.text}\n')

# Test 2: With dot parameter
print('Test 2: With dot parameter')
r2 = requests.get(url, headers=headers, params={'dot': 'Adrar'})
print(f'Status: {r2.status_code}')
print(f'Response: {r2.text}\n')

# Test 3: With export_format parameter only
print('Test 3: With export_format parameter only')
r3 = requests.get(url, headers=headers, params={'export_format': 'excel'})
print(f'Status: {r3.status_code}')
print(f'Response: {r3.text}\n')

# Test 4: With both parameters
print('Test 4: With both parameters')
r4 = requests.get(url, headers=headers, params={
                  'export_format': 'excel', 'dot': 'Adrar'})
print(f'Status: {r4.status_code}')
print(f'Response: {r4.text}\n')

# Test 5: With array notation for dot
print('Test 5: With array notation for dot')
r5 = requests.get(url, headers=headers, params={
                  'format': 'excel', 'dot[]': 'Adrar'})
print(f'Status: {r5.status_code}')
print(f'Response: {r5.text}\n')

# Test 6: Test trailing slash sensitivity
print('Test 6: Test without trailing slash')
r6 = requests.get(url.rstrip('/'), headers=headers)
print(f'Status: {r6.status_code}')
print(f'Response: {r6.text}\n')
