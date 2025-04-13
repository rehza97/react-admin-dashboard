# Optimized File Processor Troubleshooting Guide

This document provides solutions for common issues that may be encountered when using the `OptimizedFileProcessor` and related components.

## Import Issues

### Issue: ImportError for ProgressTracker

**Error Message:**

```
ImportError: cannot import name 'ProgressTracker' from 'data.v2.models'
```

**Solution:**

1. Check the import statement in `optimized_processor_integration.py`:

```python
# Incorrect:
from .models import ProgressTracker

# Correct:
from ..models import ProgressTracker
```

2. Verify that `ProgressTracker` is defined in `backend/data/models.py`
3. If using a custom path structure, adjust imports accordingly

### Issue: Module Not Found Errors

**Error Message:**

```
ModuleNotFoundError: No module named 'backend.data.v2.optimized_file_processor'
```

**Solution:**

1. Ensure Python path includes the project root directory
2. Try relative imports if absolute imports fail
3. Check for circular import dependencies

## Performance Issues

### Issue: High Memory Usage

**Symptoms:**

- System becomes slow or unresponsive
- MemoryError exceptions
- Processing fails for large files

**Solution:**

1. Reduce `chunk_size` parameter:

```python
processor = OptimizedFileProcessor(chunk_size=1000)  # Default is 5000
```

2. Set a lower memory threshold:

```python
processor = OptimizedFileProcessor(memory_threshold=512)  # MB, default is 1024
```

3. Add environment variable configuration:

```bash
export OPTIMIZE_CHUNK_SIZE=1000
export OPTIMIZE_MEMORY_THRESHOLD=512
```

### Issue: Slow Processing Speed

**Symptoms:**

- Processing takes longer than expected
- No significant improvement over standard processor

**Solution:**

1. Increase worker count for CPU-bound tasks:

```python
processor = OptimizedFileProcessor(max_workers=8)  # Adjust based on CPU cores
```

2. Increase chunk size for I/O bound tasks:

```python
processor = OptimizedFileProcessor(chunk_size=10000)
```

3. Check system resource usage during processing:

```bash
# Linux
htop
# Windows
Task Manager > Performance tab
```

### Issue: Processing Fails with Large Files

**Symptoms:**

- Timeouts or crashes with very large files
- Out of memory errors

**Solution:**

1. Implement incremental processing with smaller batches
2. Use a stronger optimization level:

```python
processor = OptimizedFileProcessor(optimization_level=3)
```

3. Ensure adequate disk space for temporary files

## API Integration Issues

### Issue: API Returns 500 Error

**Symptoms:**

- HTTP 500 Internal Server Error responses
- Unexpected failures in API calls

**Solution:**

1. Check Django error logs for detailed error messages
2. Verify that the cache backend is properly configured
3. Ensure all required dependencies are installed:

```bash
pip install -r requirements.txt
```

### Issue: Bulk Processing Status Not Updating

**Symptoms:**

- Progress stays at 0% or doesn't update
- Task appears stuck

**Solution:**

1. Verify cache configuration in settings:

```python
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}
```

2. For production, use Redis or Memcached for reliable caching
3. Check if the cache keys are correctly formatted:

```python
cache_key = f"bulk_processing_progress_{task_id}"
```

### Issue: Inconsistent Results Between Processors

**Symptoms:**

- Different data output between standard and optimized processors
- Missing or incorrect fields in processed data

**Solution:**

1. Verify field mappings and transformations in both processors
2. Check for race conditions in parallel processing
3. Ensure data type conversions are consistent
4. Add validation checks for processed data

## Installation and Dependencies

### Issue: Missing Dependencies

**Error Message:**

```
ImportError: No module named 'pandas'
```

**Solution:**

1. Install required dependencies:

```bash
pip install pandas numpy openpyxl xlrd psutil
```

2. For all dependencies:

```bash
pip install -r requirements.txt
```

### Issue: Incompatible Versions

**Symptoms:**

- Unexpected errors during processing
- API compatibility issues

**Solution:**

1. Verify dependency versions match requirements:

```bash
pip list | grep pandas
```

2. Install specific versions if needed:

```bash
pip install pandas==1.5.3 numpy==1.24.3
```

## Django and Framework Issues

### Issue: Django ORM Errors

**Error Message:**

```
django.db.utils.OperationalError: database is locked
```

**Solution:**

1. Use atomic transactions when saving data
2. Implement connection pooling for heavy database operations
3. Consider database-specific optimizations

### Issue: Thread Safety Problems

**Symptoms:**

- Random crashes during parallel processing
- Inconsistent or corrupted data

**Solution:**

1. Use thread-local storage for non-thread-safe operations
2. Implement proper locks when accessing shared resources
3. Consider using processes instead of threads for CPU-bound tasks:

```python
processor = OptimizedFileProcessor(use_processes=True)
```

## Advanced Troubleshooting

### Issue: Deadlocks or Hanging Processes

**Symptoms:**

- Processing appears stuck
- System resources consumed but no progress

**Solution:**

1. Implement timeouts for operations:

```python
processor = OptimizedFileProcessor(operation_timeout=300)  # seconds
```

2. Add debug logging for tracking progress:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

3. Monitor thread/process activity:

```python
# Add to processor
self.log_activity = True
```

### Issue: Production Deployment Problems

**Symptoms:**

- Works in development but fails in production
- Performance degradation in production

**Solution:**

1. Verify environment variables are properly set in production
2. Check for resource constraints in the production environment
3. Implement proper error handling and fallback mechanisms:

```python
try:
    # Use optimized processor
    result = optimized_processor.process_file(file_path)
except Exception as e:
    # Fallback to standard processor
    logger.warning(f"Optimized processing failed: {e}, falling back to standard")
    result = standard_processor.process_file(file_path)
```

## Getting Additional Help

If you encounter issues not covered in this guide:

1. Check Django logs for detailed error messages
2. Review the implementation documentation in `IMPLEMENTATION_SUMMARY.md`
3. Run the verification script to identify specific issues:

```bash
python verify_optimized_processor.py
```

4. Collect diagnostic information when reporting issues:
   - Python version
   - Django version
   - Error messages and stack traces
   - File sizes and types being processed
   - System specifications (CPU, RAM, OS)
