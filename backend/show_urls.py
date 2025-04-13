#!/usr/bin/env python
"""
Script to show all available URLs in the Django project
"""
from django.conf import settings
from django.urls import get_resolver
import django
import os
import sys

# Set the Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth.settings')

# Add the current directory to the Python path
sys.path.append('.')

# Import Django and set it up
django.setup()

# Now import Django-specific modules


def list_urls():
    """List all URLs defined in the project"""
    resolver = get_resolver()

    # Sort URLs by pattern for easier reading
    urls = []
    for url_pattern in resolver.url_patterns:
        if hasattr(url_pattern, 'pattern'):
            # Regular URL patterns from path()
            pattern = str(url_pattern.pattern)
            name = url_pattern.name if hasattr(url_pattern, 'name') else ""
            urls.append((pattern, name))
        elif hasattr(url_pattern, 'url_patterns'):
            # URL patterns from include()
            prefix = url_pattern.pattern.regex.pattern
            prefix = prefix.replace('^', '').replace('$', '')
            for sub_pattern in url_pattern.url_patterns:
                if hasattr(sub_pattern, 'pattern'):
                    pattern = prefix + str(sub_pattern.pattern)
                    name = sub_pattern.name if hasattr(
                        sub_pattern, 'name') else ""
                    urls.append((pattern, name))

    # Sort and print URLs
    for pattern, name in sorted(urls):
        if name:
            print(f"{pattern} [name='{name}']")
        else:
            print(pattern)


if __name__ == "__main__":
    list_urls()
