#!/usr/bin/env python
"""
Script to show URLs in the data app
"""
from data.urls import urlpatterns
import django
import os
import sys

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')

# Add the current directory to the Python path
sys.path.append('.')

# Import Django and set it up
django.setup()

# Direct import of the data URLs


def list_data_urls():
    """List all URLs defined in the data app"""
    print("Data app URLs:")
    print("==============")

    for url_pattern in urlpatterns:
        if hasattr(url_pattern, 'pattern'):
            pattern = str(url_pattern.pattern)
            name = url_pattern.name if hasattr(url_pattern, 'name') else ""
            callback = url_pattern.callback.__name__ if hasattr(
                url_pattern.callback, '__name__') else str(url_pattern.callback)

            if name:
                print(f"{pattern} -> {callback} [name='{name}']")
            else:
                print(f"{pattern} -> {callback}")


if __name__ == "__main__":
    list_data_urls()
