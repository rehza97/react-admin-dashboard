# Export System Documentation

This document provides an overview of the export system and how to test it.

## Features

- Asynchronous export processing using thread pools
- Support for Excel, CSV and PDF formats
- Progress tracking for long-running exports
- Automatic file cleanup after a retention period
- Capacity management to prevent server overload
- Real-time thread pool monitoring

## API Endpoints

### Export Endpoint

```
GET /data/export/corporate-park/
```

Parameters:

- `export_format`: The format of the export (excel, csv, pdf)
- `dot`: The DOT code to filter by
- `limit`: Maximum number of records to export
- `pool_status`: Set to "true" to get thread pool status information

### Status Endpoint

```
GET /data/export/corporate-park/status/
```

Parameters:

- `task_id`: The ID of the export task to check

## Thread Pool Management

The export system uses two types of thread pools:

1. **Export Thread Pool**: Manages overall export processes
2. **Data Processing Pool**: Handles parallel batch processing

See the detailed documentation in `docs/export_threading.md`.

## Testing Scripts

### Basic Test Script

Run a basic test of the export system:

```bash
python test_threading.py
```

This script:

- Tests multiple concurrent exports
- Monitors thread pool utilization
- Reports on export success/failure rates

### Load Test Script

Simulate high concurrency to test the system's capacity:

```bash
python test_load_export.py --workers 5 --exports 3 --duration 300
```

Parameters:

- `--workers`: Number of concurrent worker threads
- `--exports`: Number of exports per worker
- `--duration`: Maximum test duration in seconds

This script:

- Creates multiple concurrent export requests
- Randomly varies export formats and sizes
- Monitors thread pool status in real-time
- Provides detailed statistics on performance

## Configuration

The thread pool behavior can be configured by modifying the following constants:

```python
# Maximum number of concurrent export processes
MAX_EXPORT_THREADS = 5

# Maximum number of worker threads for batch processing
MAX_WORKER_THREADS = 10

# Number of records to process in each batch
BATCH_SIZE = 500

# Days to keep export files before cleanup
FILE_RETENTION_DAYS = 7
```

Adjust these values based on your server capabilities.

## Troubleshooting

If exports are failing or performance is poor:

1. Check server logs for errors
2. Monitor thread pool status with `/?pool_status=true` parameter
3. Adjust thread pool configuration based on server capabilities
4. Run load tests to identify bottlenecks

## Additional Resources

- For details on the threading model, see `docs/export_threading.md`
- For code examples, check the test scripts in the `backend` directory
