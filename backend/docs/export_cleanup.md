# Export File Cleanup

## Overview

The export system includes an automatic file cleanup mechanism that deletes exported files after a specified period (default: 1 minute). This is implemented for the following reasons:

1. **Security**: Exported files may contain sensitive data that should not be stored on the server indefinitely
2. **Disk space management**: Prevents the server from filling up with unused export files
3. **Resource management**: Ensures clean management of temporary resources

## How It Works

When a user requests an export:

1. The export file is generated and stored in the `media/exports` directory
2. A cleanup thread is scheduled to delete the file after 1 minute
3. If the user attempts to access the file after it has been deleted, they receive a clear message explaining that the file has expired
4. The user is prompted to generate a new export if needed

## Implementation Details

The cleanup mechanism consists of:

- `FileCleanupThread`: A background thread that deletes the file after the retention period
- `cleaned_files` dictionary: Tracks which files have been cleaned up
- Status endpoint enhancements: Provides appropriate responses when a file has been deleted

### File Retention Settings

The current file retention period is defined in `export_views.py`:

```python
# File cleanup settings
FILE_RETENTION_SECONDS = 60  # 1 minute
```

This value can be adjusted based on organizational requirements.

## User Experience

Users will experience the following flow:

1. Request an export (which may take some time to generate)
2. Receive a download link when the export is ready
3. Download the file (valid for 1 minute after generation)
4. If attempting to access the file after expiration, receive a message:
   "The export file has expired and been deleted for security reasons. Please generate a new export."

## Testing the Cleanup Functionality

A test script (`test_file_cleanup.py`) is provided to verify the file cleanup functionality. This script:

1. Starts an export with specific filters
2. Verifies that the file can be downloaded immediately after generation
3. Waits for the cleanup period
4. Confirms that the file is no longer accessible
5. Verifies that the status endpoint correctly reports the file as expired

To run the test:

```
python test_file_cleanup.py
```

## Customization

The file retention period can be adjusted in `export_views.py` by changing the `FILE_RETENTION_SECONDS` value.
