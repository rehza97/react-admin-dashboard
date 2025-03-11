import api from "./api";

// Check if we're in development mode
const isDevelopment = () => {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
};

/**
 * Generic error handler for API requests
 * @param {Error} error - The error object
 * @param {string} serviceName - The name of the service for logging
 * @param {Object} mockData - Mock data to return in development mode
 * @returns {Object} - Mock data or throws the error
 */
const handleApiError = (error, serviceName, mockData) => {
  console.error(`Error in ${serviceName}:`, error);

  // Check if we have a specific error message from the backend
  let errorMessage = `Failed to fetch ${serviceName} data`;

  // Safely check for error response properties
  // Use type assertion to handle TypeScript error
  const errorResponse =
    error && typeof error === "object" && "response" in error
      ? error.response
      : {};

  const errorData =
    errorResponse &&
    typeof errorResponse === "object" &&
    "data" in errorResponse
      ? errorResponse.data
      : {};

  const statusCode =
    errorResponse &&
    typeof errorResponse === "object" &&
    "status" in errorResponse
      ? errorResponse.status
      : null;

  // Handle specific HTTP status codes
  if (statusCode) {
    switch (statusCode) {
      case 400:
        errorMessage = `Invalid request for ${serviceName}: ${
          errorData && typeof errorData === "object" && "error" in errorData
            ? errorData.error
            : "Bad request"
        }`;
        break;
      case 401:
        errorMessage = `Authentication required for ${serviceName}`;
        break;
      case 403:
        errorMessage = `You don't have permission to access ${serviceName}`;
        break;
      case 404:
        errorMessage = `${serviceName} resource not found`;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorMessage = `Server error while fetching ${serviceName} data`;
        break;
      default:
        if (
          errorData &&
          typeof errorData === "object" &&
          "error" in errorData &&
          typeof errorData.error === "string"
        ) {
          errorMessage = errorData.error;
        } else {
          errorMessage = `Error ${
            statusCode ? `(${statusCode})` : ""
          } in ${serviceName}`;
        }
    }
  }

  if (errorData && typeof errorData === "object" && "error" in errorData) {
    console.error("Backend error:", errorData.error);

    if (errorData && typeof errorData === "object" && "details" in errorData) {
      console.error("Error details:", errorData.details);
    }
  }

  // Only use mock data in development mode AND when the server is unreachable
  // (network error) or returns a server error (500+)
  const isServerError = typeof statusCode === "number" && statusCode >= 500;
  const isNetworkError =
    !statusCode &&
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    (error.message.includes("Network Error") ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("connect ECONNREFUSED"));

  if (isDevelopment() && (isServerError || isNetworkError)) {
    console.warn(`Using mock ${serviceName} data due to server unavailability`);
    return mockData;
  }

  // In all other cases, throw the error with a descriptive message
  throw new Error(errorMessage);
};

// Mock data for development and testing
const mockRevenueCollectionReport = {};

const mockCorporateParkReport = {};

const mockReceivablesReport = {};

/**
 * Service for fetching comprehensive reports from the backend
 */
const reportService = {
  /**
   * Get a comprehensive report
   * @param {Object} params - Query parameters
   * @param {string} params.type - Report type (revenue_collection, corporate_park, receivables)
   * @param {number} params.year - Year to fetch data for
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @returns {Promise} - Promise with comprehensive report data
   */
  getComprehensiveReport: async (params) => {
    try {
      const queryParams = new URLSearchParams();

      // Add required parameters
      queryParams.append("type", params.type);
      queryParams.append("year", String(params.year));

      // Add optional parameters if provided
      if (params.month) queryParams.append("month", String(params.month));
      if (params.dot) queryParams.append("dot", params.dot);

      const response = await api.get(
        `/data/reports/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching comprehensive report:", error);
      throw error;
    }
  },

  /**
   * Get revenue and collection report
   * @param {Object} params - Query parameters
   * @param {number} params.year - Year to fetch data for
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @returns {Promise} - Promise with revenue and collection report data
   */
  getRevenueCollectionReport: async (
    params = { year: new Date().getFullYear() }
  ) => {
    try {
      // Create query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("type", "revenue_collection");

      // Add year, month, and dot if provided
      queryParams.append("year", String(params.year));

      if (params.month) {
        queryParams.append("month", String(params.month));
      }

      if (params.dot) {
        queryParams.append("dot", params.dot);
      }

      // Make API request
      const response = await api.get(
        `/data/reports/?${queryParams.toString()}`
      );

      // Transform data to expected format
      return reportService.transformReportData(
        response.data,
        "revenue_collection"
      );
    } catch (error) {
      // Handle error and log it
      console.error("Error fetching revenue collection report:", error);

      if (error.response) {
        console.error(
          "Error response:",
          error.response.status,
          error.response.data
        );
      }

      // Return mock data for testing/development
      const mockData = {
        year: params.year,
        month: params.month,
        dot: params.dot,
        total_revenue: 0,
        total_collection: 0,
        revenue_by_dot: {},
        collection_by_dot: {},
        revenue_by_invoice_type: {},
        collection_by_invoice_type: {},
        anomalies: [],
      };

      // Transform mock data
      return reportService.transformReportData(mockData, "revenue_collection");
    }
  },

  /**
   * Get corporate park report
   * @param {Object} params - Query parameters
   * @param {number} params.year - Year to fetch data for
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @returns {Promise} - Promise with corporate park report data
   */
  getCorporateParkReport: async (
    params = { year: new Date().getFullYear() }
  ) => {
    try {
      // Create query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("type", "corporate_park");

      // Add year, month, and dot if provided
      queryParams.append("year", String(params.year));

      if (params.month) {
        queryParams.append("month", String(params.month));
      }

      if (params.dot) {
        queryParams.append("dot", params.dot);
      }

      // Make API request
      const response = await api.get(
        `/data/reports/?${queryParams.toString()}`
      );

      // Transform data to expected format
      return reportService.transformReportData(response.data, "corporate_park");
    } catch (error) {
      // Handle error and log it
      console.error("Error fetching corporate park report:", error);

      if (error.response) {
        console.error(
          "Error response:",
          error.response.status,
          error.response.data
        );
      }

      // Return mock data for testing/development
      const mockData = {
        year: params.year,
        month: params.month,
        dot: params.dot,
        total_vehicles: 0,
        vehicles_by_dot: {},
        vehicles_by_state: {},
        vehicles_by_type: {},
        anomalies: [],
      };

      // Transform mock data
      return reportService.transformReportData(mockData, "corporate_park");
    }
  },

  /**
   * Get receivables report
   * @param {Object} params - Query parameters
   * @param {number} params.year - Year to fetch data for
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @returns {Promise} - Promise with receivables report data
   */
  getReceivablesReport: async (params = { year: new Date().getFullYear() }) => {
    try {
      // Create query parameters
      const queryParams = new URLSearchParams();
      queryParams.append("type", "receivables");

      // Add year, month, and dot if provided
      queryParams.append("year", String(params.year));

      if (params.month) {
        queryParams.append("month", String(params.month));
      }

      if (params.dot) {
        queryParams.append("dot", params.dot);
      }

      // Make API request
      const response = await api.get(
        `/data/reports/?${queryParams.toString()}`
      );

      // Transform data to expected format
      return reportService.transformReportData(response.data, "receivables");
    } catch (error) {
      // Handle error and log it
      console.error("Error fetching receivables report:", error);

      if (error.response) {
        console.error(
          "Error response:",
          error.response.status,
          error.response.data
        );
      }

      // Return mock data for testing/development
      const mockData = {
        year: params.year,
        month: params.month,
        dot: params.dot,
        total_receivables: 0,
        receivables_by_dot: {},
        receivables_by_age: {
          "0-30": 0,
          "31-60": 0,
          "61-90": 0,
          "91+": 0,
        },
        anomalies: [],
      };

      // Transform mock data
      return reportService.transformReportData(mockData, "receivables");
    }
  },

  // Export report data
  exportReport: async (reportType, format, params = {}) => {
    try {
      const response = await api.get(`/data/reports/export/${reportType}/`, {
        params: { ...params, format },
        responseType: "blob",
      });

      // Create a download link for the file
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Set filename based on Content-Disposition header if available
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

      return { success: true, message: `Report exported as ${filename}` };
    } catch (error) {
      console.error(`Error exporting ${reportType} report:`, error);
      throw new Error(
        `Failed to export ${reportType} report: ${error.message}`
      );
    }
  },

  /**
   * Transform raw report data into the structure expected by the frontend
   * @param {Object} data - Raw report data from the backend
   * @param {string} reportType - Type of report (revenue_collection, corporate_park, receivables)
   * @returns {Object} - Transformed data
   */
  transformReportData: (data, reportType) => {
    if (!data) return null;

    try {
      // Common structure for all reports
      const result = {
        year: data.year,
        month: data.month,
        dot: data.dot,
        kpis: {},
        breakdowns: {},
        anomalies: data.anomalies || [],
      };

      // Transform based on report type
      if (reportType === "revenue_collection") {
        // KPIs
        result.kpis = {
          total_revenue: data.total_revenue || 0,
          total_collection: data.total_collection || 0,
          collection_rate: data.total_revenue
            ? (data.total_collection / data.total_revenue) * 100
            : 0,
          total_invoiced: data.total_revenue || 0, // Assuming total_revenue is the invoiced amount
        };

        // Breakdowns
        result.breakdowns = {
          revenue_by_dot: data.revenue_by_dot || {},
          collection_by_dot: data.collection_by_dot || {},
          revenue_by_invoice_type: data.revenue_by_invoice_type || {},
          collection_by_invoice_type: data.collection_by_invoice_type || {},
        };
      } else if (reportType === "corporate_park") {
        // KPIs
        result.kpis = {
          total_vehicles: data.total_vehicles || 0,
        };

        // Breakdowns
        result.breakdowns = {
          vehicles_by_dot: data.vehicles_by_dot || {},
          vehicles_by_state: data.vehicles_by_state || {},
          vehicles_by_type: data.vehicles_by_type || {},
        };
      } else if (reportType === "receivables") {
        // KPIs
        result.kpis = {
          total_receivables: data.total_receivables || 0,
        };

        // Breakdowns
        result.breakdowns = {
          receivables_by_dot: data.receivables_by_dot || {},
          receivables_by_age: data.receivables_by_age || {
            "0-30": 0,
            "31-60": 0,
            "61-90": 0,
            "91+": 0,
          },
        };
      }

      return result;
    } catch (error) {
      console.error(`Error transforming ${reportType} report data:`, error);
      return data; // Return original data if transformation fails
    }
  },
};

export default reportService;
