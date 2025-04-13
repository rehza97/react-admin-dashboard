import api from "./api";

/**
 * Helper function to get filter parameters in the format expected by the API
 * @param {Object} filters - All filters to apply
 * @returns {Object} - Parameters object for the API
 */
const getFilterParams = (filters = {}) => {
  const params = {};

  // Add simple filters
  if (filters.year) params.year = filters.year;
  if (filters.month) params.month = filters.month;

  // Debug logging for Actel code
  console.log("[EXPORT DEBUG] Processing Actel code filter:", {
    hasActelCode: "actelCode" in filters,
    actelCodeValue: filters.actelCode,
    isArray: Array.isArray(filters.actelCode),
    length: filters.actelCode ? filters.actelCode.length : 0,
  });

  // Handle Actel code filter
  const actelCodes = filters.actelCode || filters.actel_code;
  if (actelCodes && Array.isArray(actelCodes)) {
    console.log(
      "[EXPORT DEBUG] Adding Actel codes to export params:",
      actelCodes
    );
    actelCodes.forEach((code) => {
      params.actel_code = code;
    });
  }

  // Add array filters
  if (filters.dots && filters.dots.length) {
    params.dot = filters.dots;
  }

  if (filters.telecomType && filters.telecomType.length) {
    params.telecom_type = filters.telecomType;
  }

  if (filters.offerName && filters.offerName.length) {
    params.offer_name = filters.offerName;
  }

  if (filters.customerL2 && filters.customerL2.length) {
    params.customer_l2 = filters.customerL2;
  }

  if (filters.customerL3 && filters.customerL3.length) {
    params.customer_l3 = filters.customerL3;
  }

  if (filters.subscriberStatus && filters.subscriberStatus.length) {
    params.subscriber_status = filters.subscriberStatus;
  }

  // Debug log final params
  console.log("[EXPORT DEBUG] Final export parameters:", {
    rawString: new URLSearchParams(params).toString(),
    paramsList: Object.entries(params),
  });

  return params;
};

/**
 * Start an asynchronous export and return the task ID
 * @param {string} format - Export format (excel, pdf, csv)
 * @param {Object} filters - All filters to apply (dots, telecomType, offerName, etc.)
 * @returns {Promise<string>} - Task ID for monitoring the export progress
 */
export const startExport = async (format, filters = {}) => {
  try {
    // Make API call to start the export
    const response = await api.get("/data/export/corporate-park/", {
      params: {
        ...getFilterParams(filters),
        export_format: format,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error starting export:", error);
    throw error;
  }
};

/**
 * Check the status of an export task
 * @param {string} taskId - The task ID returned by startExport
 * @returns {Promise<Object>} - Task status information
 */
export const checkExportStatus = async (taskId) => {
  try {
    const response = await api.get("/data/export/corporate-park/status/", {
      params: { task_id: taskId },
    });

    // If export is complete and has a file URL, verify the file exists
    if (response.data.status === "completed" && response.data.file_url) {
      // Don't modify the actual file_url here, just add a cache-busting parameter for the fetch
      // But keep the original URL for the filename extraction later
      response.data.originalFileUrl = response.data.file_url;
      response.data.file_url = `${response.data.file_url}?t=${Date.now()}`;
    }

    return response.data;
  } catch (error) {
    console.error("Error checking export status:", error);
    throw error;
  }
};

/**
 * Get thread pool status information
 * @returns {Promise<Object>} - Thread pool status information
 */
export const getPoolStatus = async () => {
  try {
    const response = await api.get("/data/export/corporate-park/", {
      params: { pool_status: true },
    });
    return response.data;
  } catch (error) {
    console.error("Error getting thread pool status:", error);
    throw error;
  }
};

/**
 * Calculate estimated completion time based on progress and elapsed time
 * @param {number} progress - Current progress percentage (0-100)
 * @param {number} startTime - Export start time in milliseconds
 * @returns {number} - Estimated remaining time in seconds
 */
export const estimateRemainingTime = (progress, startTime) => {
  if (progress <= 0) return null;

  const elapsed = (Date.now() - startTime) / 1000; // elapsed time in seconds
  const totalEstimated = (elapsed * 100) / progress;
  const remaining = totalEstimated - elapsed;

  return Math.max(1, Math.round(remaining));
};

/**
 * Format remaining time as human-readable string
 * @param {number} seconds - Remaining time in seconds
 * @returns {string} - Formatted time string
 */
export const formatRemainingTime = (seconds) => {
  if (!seconds) return "Calculating...";

  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes} minute${
      minutes !== 1 ? "s" : ""
    } ${remainingSeconds} second${remainingSeconds !== 1 ? "s" : ""}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours} hour${hours !== 1 ? "s" : ""} ${remainingMinutes} minute${
    remainingMinutes !== 1 ? "s" : ""
  }`;
};

/**
 * Export Corporate Park data with all filters
 * @param {string} format - Export format (excel, pdf, csv)
 * @param {Object} filters - All filters to apply (dots, telecomType, offerName, etc.)
 * @returns {Promise} - Promise that resolves when export is complete
 */
export const exportCorporatePark = async (format, filters) => {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.append("format", format);

    // Add all filters to the params
    if (filters.year) params.append("year", filters.year);
    if (filters.month) params.append("month", filters.month);

    // Handle array filters
    if (filters.dots && filters.dots.length) {
      filters.dots.forEach((dot) => {
        params.append("dot", dot);
      });
    }

    if (filters.telecomType && filters.telecomType.length) {
      filters.telecomType.forEach((type) => {
        params.append("telecom_type", type);
      });
    }

    if (filters.offerName && filters.offerName.length) {
      filters.offerName.forEach((name) => {
        params.append("offer_name", name);
      });
    }

    if (filters.customerL2 && filters.customerL2.length) {
      filters.customerL2.forEach((code) => {
        params.append("customer_l2", code);
      });
    }

    if (filters.customerL3 && filters.customerL3.length) {
      filters.customerL3.forEach((code) => {
        params.append("customer_l3", code);
      });
    }

    if (filters.subscriberStatus && filters.subscriberStatus.length) {
      filters.subscriberStatus.forEach((status) => {
        params.append("subscriber_status", status);
      });
    }

    // Use the preview endpoint with export functionality
    const response = await api.get(
      `/data/preview/corporate-park/export/?format=${format}`,
      {
        params: {
          ...getFilterParams(filters),
          format: format,
        },
        responseType: "blob",
      }
    );

    // Create a download link and trigger it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    // Set filename based on response headers or fallback
    const contentDisposition = response.headers["content-disposition"];
    let filename = `corporate_park_export.${format}`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    return true;
  } catch (error) {
    console.error("Error exporting Corporate Park data:", error);
    throw error;
  }
};

/**
 * Export a comprehensive report
 * @param {string} reportType - Type of report (revenue_collection, corporate_park, receivables)
 * @param {string} format - Export format (excel, pdf, csv)
 * @param {Object} filters - Filters to apply
 * @returns {Promise} - Promise that resolves when export is complete
 */
export const exportReport = async (reportType, format, filters) => {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.append("type", reportType);
    params.append("format", format);

    // Add filters if provided
    if (filters.year) params.append("year", filters.year);
    if (filters.month) params.append("month", filters.month);
    if (filters.dot) params.append("dot", filters.dot);

    // Make request with responseType blob for file download
    const response = await api.get(
      `/data/reports/export/?${params.toString()}`,
      {
        responseType: "blob",
      }
    );

    // Create a download link and trigger it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    // Set filename based on response headers or fallback
    const contentDisposition = response.headers["content-disposition"];
    let filename = `${reportType}_report.${format}`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];
      }
    }

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    return true;
  } catch (error) {
    console.error("Error exporting report:", error);
    throw error;
  }
};

/**
 * Cancel an export in progress
 * @param {string} taskId - The task ID to cancel
 * @returns {Promise<Object>} - Response with cancellation status
 */
export const cancelExport = async (taskId) => {
  try {
    const response = await api.get("/data/export/corporate-park/", {
      params: {
        task_id: taskId,
        cancel: true,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error cancelling export:", error);
    throw error;
  }
};

/**
 * Download a file from a URL
 * @param {string} fileUrl - URL of the file to download
 * @param {string} filename - Suggested filename for download
 * @returns {Promise<boolean>} - Promise that resolves when download is complete
 */
export const downloadExportFile = async (fileUrl, filename) => {
  try {
    console.log(`Downloading file from ${fileUrl} as ${filename}`);

    // Get the file as a blob
    const response = await api.get(fileUrl, {
      responseType: "blob",
    });

    // Create a download link and trigger it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    // Use provided filename or try to get it from content-disposition
    let downloadFilename = filename;
    const contentDisposition = response.headers["content-disposition"];

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch[1]) {
        downloadFilename = filenameMatch[1];
      }
    }

    console.log(`Using filename for download: ${downloadFilename}`);

    link.setAttribute("download", downloadFilename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Clean up
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Error downloading export file:", error);
    throw error;
  }
};

/**
 * Export Non-Periodic Revenue data with filters
 * @param {string} format - Export format (excel, csv, pdf)
 * @param {Object} filters - All filters to apply (dot, product, sale_type, channel)
 * @returns {Promise<boolean>} - Promise that resolves when export is complete
 */
export const exportNonPeriodicRevenue = async (format, filters = {}) => {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.append("export_format", format);

    // Add date parameter for uniqueness
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    params.append("date", dateStr);

    // Add filter parameters if selected
    if (filters.dot && filters.dot.length > 0) {
      filters.dot.forEach((dot) => params.append("dot", dot));
    }

    if (filters.product && filters.product.length > 0) {
      filters.product.forEach((product) => params.append("product", product));
    }

    if (filters.sale_type && filters.sale_type.length > 0) {
      filters.sale_type.forEach((saleType) =>
        params.append("sale_type", saleType)
      );
    }

    if (filters.channel && filters.channel.length > 0) {
      filters.channel.forEach((channel) => params.append("channel", channel));
    }

    // Create the export URL
    const exportUrl = `/data/export/ca-non-periodique/?${params.toString()}`;
    console.log(`Non-Periodic Revenue export URL: ${exportUrl}`);

    // First make a regular request to check the response type
    const initialResponse = await api.get(exportUrl);

    // Check if it's a task tracking response
    if (initialResponse.data && initialResponse.data.task_id) {
      console.log("Received task tracking response:", initialResponse.data);

      // Wait for the export to complete
      return await pollExportCompletion(
        initialResponse.data.task_id,
        format,
        dateStr
      );
    }

    // If we get here, it's a direct response, make the blob request
    const response = await api.get(exportUrl, {
      responseType: "blob",
    });

    // Create a download link and trigger it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    // Set filename based on response headers or fallback
    const contentDisposition = response.headers["content-disposition"];
    let filename = `non_periodic_revenue_export_${dateStr.replace(/-/g, "")}.${
      format === "excel" ? "xlsx" : format === "pdf" ? "pdf" : format
    }`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];

        // Fix extension for Excel files if needed
        if (format === "excel" && !filename.endsWith(".xlsx")) {
          if (filename.endsWith(".excel")) {
            filename = filename.replace(".excel", ".xlsx");
          } else if (!filename.includes(".")) {
            filename = `${filename}.xlsx`;
          }
        }

        // Fix extension for PDF files if needed
        if (format === "pdf" && !filename.endsWith(".pdf")) {
          if (!filename.includes(".")) {
            filename = `${filename}.pdf`;
          }
        }
      }
    }

    console.log(`Using filename for download: ${filename}`);

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Clean up
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Error exporting Non-Periodic Revenue data:", error);
    throw error;
  }
};

/**
 * Poll for export completion and download the file when ready
 * @param {string} taskId - The task ID to check
 * @param {string} format - Export format
 * @param {string} dateStr - Date string for filename
 * @returns {Promise<boolean>} - Promise that resolves when download is complete
 */
const pollExportCompletion = async (taskId, format, dateStr) => {
  let attempts = 0;
  const maxAttempts = 30; // 30 attempts * 2 seconds = max 1 minute wait

  while (attempts < maxAttempts) {
    attempts++;

    try {
      console.log(`Checking export status (attempt ${attempts})`);

      // Check task status
      const statusResponse = await api.get(
        "/data/export/ca-non-periodique/status/",
        {
          params: { task_id: taskId },
        }
      );

      console.log(`Task status response:`, statusResponse.data);

      if (statusResponse.data.status === "completed") {
        console.log("Export completed successfully!");

        if (statusResponse.data.file_url) {
          // Download the file
          return await downloadExportFile(
            statusResponse.data.file_url,
            `non_periodic_revenue_export_${dateStr}_${format}.${
              format === "excel" ? "xlsx" : format === "pdf" ? "pdf" : format
            }`
          );
        } else {
          throw new Error("Export completed but no file URL was provided");
        }
      } else if (statusResponse.data.status === "failed") {
        throw new Error(statusResponse.data.error || "Export failed");
      } else if (statusResponse.data.status === "cancelled") {
        throw new Error("Export was cancelled");
      }

      // If still processing, wait before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error checking export status:`, error);

      // If we've reached max attempts, throw the error
      if (attempts >= maxAttempts) {
        throw new Error(`Export timed out after ${maxAttempts} attempts`);
      }

      // Otherwise wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Export timed out");
};

/**
 * Export Periodic Revenue data with filters
 * @param {string} format - Export format (excel, csv, pdf)
 * @param {Object} filters - All filters to apply (dot, product, operation)
 * @returns {Promise<boolean>} - Promise that resolves when export is complete
 */
export const exportPeriodicRevenue = async (format, filters = {}) => {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.append("export_format", format);

    // Add date parameter for uniqueness
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    params.append("date", dateStr);

    // Add filter parameters if selected
    if (filters.dot && filters.dot.length > 0) {
      filters.dot.forEach((dot) => params.append("dot", dot));
    }

    if (filters.product && filters.product.length > 0) {
      filters.product.forEach((product) => params.append("product", product));
    }

    if (filters.operation && filters.operation.length > 0) {
      filters.operation.forEach((operation) =>
        params.append("operation", operation)
      );
    }

    // Create the export URL
    const exportUrl = `/data/export/ca-periodique/?${params.toString()}`;
    console.log(`Periodic Revenue export URL: ${exportUrl}`);

    // First make a regular request to check the response type
    const initialResponse = await api.get(exportUrl);

    // Check if it's a task tracking response
    if (initialResponse.data && initialResponse.data.task_id) {
      console.log("Received task tracking response:", initialResponse.data);

      // Wait for the export to complete
      return await pollPeriodicExportCompletion(
        initialResponse.data.task_id,
        format,
        dateStr
      );
    }

    // If we get here, it's a direct response, make the blob request
    const response = await api.get(exportUrl, {
      responseType: "blob",
    });

    // Create a download link and trigger it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    // Set filename based on response headers or fallback
    const contentDisposition = response.headers["content-disposition"];
    let filename = `periodic_revenue_export_${dateStr.replace(/-/g, "")}.${
      format === "excel" ? "xlsx" : format === "pdf" ? "pdf" : format
    }`;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1];

        // Fix extension for Excel files if needed
        if (format === "excel" && !filename.endsWith(".xlsx")) {
          if (filename.endsWith(".excel")) {
            filename = filename.replace(".excel", ".xlsx");
          } else if (!filename.includes(".")) {
            filename = `${filename}.xlsx`;
          }
        }

        // Fix extension for PDF files if needed
        if (format === "pdf" && !filename.endsWith(".pdf")) {
          if (!filename.includes(".")) {
            filename = `${filename}.pdf`;
          }
        }
      }
    }

    console.log(`Using filename for download: ${filename}`);

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Clean up
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Error exporting Periodic Revenue data:", error);
    throw error;
  }
};

/**
 * Poll for periodic export completion and download the file when ready
 * @param {string} taskId - The task ID to check
 * @param {string} format - Export format
 * @param {string} dateStr - Date string for filename
 * @returns {Promise<boolean>} - Promise that resolves when download is complete
 */
const pollPeriodicExportCompletion = async (taskId, format, dateStr) => {
  let attempts = 0;
  const maxAttempts = 30; // 30 attempts * 2 seconds = max 1 minute wait

  while (attempts < maxAttempts) {
    attempts++;

    try {
      console.log(`Checking export status (attempt ${attempts})`);

      // Check task status
      const statusResponse = await api.get(
        "/data/export/ca-periodique/status/",
        {
          params: { task_id: taskId },
        }
      );

      console.log(`Task status response:`, statusResponse.data);

      if (statusResponse.data.status === "completed") {
        console.log("Export completed successfully!");

        if (statusResponse.data.file_url) {
          // Download the file
          return await downloadExportFile(
            statusResponse.data.file_url,
            `periodic_revenue_export_${dateStr}_${format}.${
              format === "excel" ? "xlsx" : format === "pdf" ? "pdf" : format
            }`
          );
        } else {
          throw new Error("Export completed but no file URL was provided");
        }
      } else if (statusResponse.data.status === "failed") {
        throw new Error(statusResponse.data.error || "Export failed");
      } else if (statusResponse.data.status === "cancelled") {
        throw new Error("Export was cancelled");
      }

      // If still processing, wait before checking again
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error checking export status:`, error);

      // If we've reached max attempts, throw the error
      if (attempts >= maxAttempts) {
        throw new Error(`Export timed out after ${maxAttempts} attempts`);
      }

      // Otherwise wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error("Export timed out");
};
