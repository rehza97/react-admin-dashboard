# Export System Thread Pool Management

## Overview

The export system uses a sophisticated thread pool architecture to efficiently manage the resources used during data exports. This document explains the threading model, configuration options, and best practices.

## Architecture

The export system uses two types of thread pools:

1. **Export Thread Pool**: Manages the main export threads that handle the entire export process for each request.
2. **Data Processing Pool**: A shared thread pool that handles parallel batch processing for all exports.

### Key Components

- `ThreadPoolExecutor`: Used to limit and manage concurrent execution of tasks
- `ExportThread`: The main thread for an export request, inherits from `threading.Thread`
- `FileCleanupThread`: Background thread that manages file cleanup after retention period

## Configuration

The following constants control the thread pool behavior:

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

## How It Works

1. When a user requests an export, a new `ExportThread` is created and started.
2. If the export thread pool is at maximum capacity, the request is queued.
3. Each export thread processes data in batches using the shared data processing pool.
4. The data processing pool parallelizes the work of transforming and formatting records.
5. When an export completes, a `FileCleanupThread` is scheduled to run after the retention period.

## Thread Pool Status API

The export endpoint provides a status API that shows the current state of the thread pools:

```
GET /data/export/corporate-park/?pool_status=true
```

The response includes:

```json
{
  "export_pool": {
    "active_threads": 2,
    "max_workers": 5,
    "pending_tasks": 0,
    "total_tasks": 15,
    "completed_tasks": 10,
    "failed_tasks": 3
  },
  "processing_pool": {
    "active_threads": 8,
    "max_workers": 10,
    "pending_tasks": 3
  },
  "batch_size": 500,
  "cleaned_files": 42
}
```

## Best Practices

1. **Tuning Thread Pools**: Adjust `MAX_EXPORT_THREADS` and `MAX_WORKER_THREADS` based on server capabilities.
2. **Batch Size**: Larger batch sizes may improve performance but increase memory usage.
3. **Monitoring**: Use the pool status API to monitor thread utilization and adjust settings.
4. **Rate Limiting**: Consider adding rate limiting if users generate too many export requests.

## Testing

Use the provided `test_threading.py` script to test the thread pool implementation:

```bash
python backend/test_threading.py
```

This script runs multiple concurrent export requests and monitors the thread pool status.

## Performance Considerations

- Each export format (Excel, CSV, PDF) has different performance characteristics
- PDF generation is typically more resource-intensive than CSV or Excel
- The system automatically limits the number of rows in PDF exports to 10,000
- For extremely large datasets, consider using CSV format which has the best performance

## Troubleshooting

If exports are slow or failing:

1. Check the thread pool status to see if all threads are being utilized
2. Consider increasing the number of worker threads if the server has available resources
3. Reduce the batch size if memory usage is too high
4. Check server logs for any errors in the export threads
