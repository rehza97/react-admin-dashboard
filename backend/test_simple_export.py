#!/usr/bin/env python
"""
Simple test script to verify the export endpoint
"""
import requests
import json
import time

# Configuration
BASE_URL = "http://localhost:8000"
AUTH_TOKEN = 'f3c764779498cfebcb0342a627d573de4cea376bc60aa2e943800e897146dc78'


def get_headers():
    return {
        'Authorization': f'Token {AUTH_TOKEN}'
    }


def test_export():
    url = f"{BASE_URL}/data/export/corporate-park/"
    headers = get_headers()

    # Test with DOT filter
    params = {
        'format': 'excel',
        'dot': 'Adrar'
    }

    try:
        print(f"\nTesting URL: {url}")
        print(f"Parameters: {params}")
        print(f"Headers: {headers}")

        response = requests.get(url, headers=headers, params=params)

        print(f"Status code: {response.status_code}")

        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response (JSON): {data}")

                # If the response includes a task_id, poll for status
                if 'task_id' in data:
                    task_id = data['task_id']
                    print(f"Task ID: {task_id}")

                    # Now poll for status
                    status_url = f"{BASE_URL}/data/export/corporate-park/?task_id={task_id}"

                    # Poll up to 10 times (waiting 5 seconds each time)
                    for i in range(10):
                        print(f"\nChecking status ({i+1}/10)...")
                        status_response = requests.get(
                            status_url, headers=headers)

                        if status_response.status_code == 200:
                            status_data = status_response.json()
                            print(f"Status: {status_data.get('status')}")
                            print(f"Progress: {status_data.get('progress')}%")

                            # If complete, try to download the file
                            if status_data.get('status') == 'completed' and 'file_url' in status_data:
                                file_url = status_data['file_url']
                                print(f"File URL: {file_url}")

                                # Try to download the file
                                file_response = requests.get(
                                    f"{BASE_URL}{file_url}",
                                    headers=headers,
                                    stream=True
                                )

                                if file_response.status_code == 200:
                                    print(f"File downloaded successfully!")
                                    print(
                                        f"Content type: {file_response.headers.get('Content-Type')}")
                                    print(
                                        f"Content length: {file_response.headers.get('Content-Length')} bytes")
                                else:
                                    print(
                                        f"Failed to download file: {file_response.status_code}")
                                    print(file_response.text)

                                break

                            # If failed, show error
                            if status_data.get('status') == 'failed':
                                print(
                                    f"Export failed: {status_data.get('error')}")
                                break

                            # If still processing, wait and try again
                            if status_data.get('status') == 'processing':
                                time.sleep(5)
                                continue

                        else:
                            print(
                                f"Error checking status: {status_response.status_code}")
                            print(status_response.text)
                            break

            except Exception as e:
                print(f"Error parsing response: {str(e)}")
                print(f"Response content: {response.text[:200]}...")
        else:
            print(f"Error response: {response.text}")

    except Exception as e:
        print(f"Error: {str(e)}")


if __name__ == "__main__":
    test_export()
