import api from "./api";

export const exportData = async (dataType, format, filters) => {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.append("data_type", dataType);
    params.append("format", format);

    // Add filters if provided
    if (filters.year) params.append("year", filters.year);
    if (filters.month) params.append("month", filters.month);
    if (filters.dot) params.append("dot", filters.dot);

    // Make request with responseType blob for file download
    const response = await api.get(`/data/export/?${params.toString()}`, {
      responseType: "blob",
    });

    // Create a download link and trigger it
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;

    // Set filename based on response headers or fallback
    const contentDisposition = response.headers["content-disposition"];
    let filename = `${dataType}_export.${format}`;

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
    console.error("Error exporting data:", error);
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
