import api from "./api";

// Check if we're in development mode
const isDevelopment = () => {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
};

// Mock data for anomaly statistics
const mockAnomalyStats = {
  total_anomalies: 42,
  by_status: {
    open: 15,
    in_progress: 8,
    resolved: 16,
    ignored: 3,
  },
  by_type: [
    { type: "missing_data", count: 12 },
    { type: "duplicate_data", count: 8 },
    { type: "invalid_data", count: 10 },
    { type: "outlier", count: 5 },
    { type: "inconsistent_data", count: 7 },
  ],
  top_invoices: [
    { invoice_id: 1, invoice_number: "INV-2023-001", anomaly_count: 5 },
    { invoice_id: 2, invoice_number: "INV-2023-002", anomaly_count: 4 },
    { invoice_id: 3, invoice_number: "INV-2023-003", anomaly_count: 3 },
  ],
  recent_anomalies: [
    {
      id: 1,
      type: "missing_data",
      type_display: "Missing Data",
      description:
        "Empty important fields in JournalVentes: invoice_date, client",
      status: "open",
      status_display: "Open",
      invoice_number: "INV-2023-001",
    },
    {
      id: 2,
      type: "duplicate_data",
      type_display: "Duplicate Data",
      description: "Duplicate invoice number INV-2023-002 in Journal Ventes",
      status: "in_progress",
      status_display: "In Progress",
      invoice_number: "INV-2023-002",
    },
    {
      id: 3,
      type: "outlier",
      type_display: "Outlier",
      description: "Unusually high revenue amount for invoice INV-2023-003",
      status: "resolved",
      status_display: "Resolved",
      invoice_number: "INV-2023-003",
    },
  ],
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

  // Safely check for error response properties - handle both axios errors and regular errors
  const errorResponse =
    error && typeof error === "object" && "response" in error
      ? error.response || {}
      : {};
  const errorData =
    errorResponse &&
    typeof errorResponse === "object" &&
    "data" in errorResponse
      ? errorResponse.data || {}
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
            ? String(errorData.error)
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
        errorMessage =
          errorData && typeof errorData === "object" && "error" in errorData
            ? String(errorData.error)
            : `Error (${statusCode}) in ${serviceName}`;
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
const mockAnomalies = {
  results: [
    {
      id: 1,
      type: "high_value_transaction",
      severity: "high",
      description: "Transaction amount exceeds threshold by 200%",
      status: "open",
      created_at: "2023-01-15T10:30:00Z",
      data_source: "journal_ventes",
      record_id: 123,
      details: {
        amount: 500000,
        threshold: 150000,
        percentage: 233.33,
      },
    },
    {
      id: 2,
      type: "missing_data",
      severity: "medium",
      description: "Multiple required fields are empty",
      status: "open",
      created_at: "2023-01-16T14:20:00Z",
      data_source: "etat_facture",
      record_id: 456,
      details: {
        missing_fields: ["client", "invoice_date", "department"],
      },
    },
    {
      id: 3,
      type: "duplicate_invoice",
      severity: "low",
      description: "Potential duplicate invoice detected",
      status: "resolved",
      created_at: "2023-01-17T09:15:00Z",
      data_source: "facturation_manuelle",
      record_id: 789,
      details: {
        duplicate_of: 788,
        similarity_score: 0.95,
      },
      resolution: {
        resolved_at: "2023-01-17T11:30:00Z",
        resolved_by: "admin@example.com",
        resolution_note: "Confirmed as legitimate separate invoice",
      },
    },
  ],
  count: 3,
};

// Anomaly service functions
const anomalyService = {
  /**
   * Get a list of anomalies with optional filtering
   * @param {Object} filters - Filter parameters
   * @returns {Promise} - Promise with anomaly data
   */
  getAnomalies: async (filters = {}) => {
    try {
      const params = new URLSearchParams();

      // Add filters to params
      if (filters.invoice) params.append("invoice", filters.invoice);
      if (filters.type) params.append("type", filters.type);
      if (filters.status) params.append("status", filters.status);
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);

      const response = await api.get(`/data/anomalies/?${params.toString()}`);
      return response.data;
    } catch (error) {
      return handleApiError(error, "anomalies", mockAnomalies);
    }
  },

  /**
   * Get details for a specific anomaly
   * @param {number} id - Anomaly ID
   * @returns {Promise} - Promise with anomaly details
   */
  getAnomalyDetails: async (id) => {
    try {
      const response = await api.get(`/data/anomalies/${id}/`);
      return response.data;
    } catch (error) {
      return handleApiError(error, `anomaly ${id}`, null);
    }
  },

  /**
   * Update an anomaly (e.g., change status)
   * @param {number} id - Anomaly ID
   * @param {Object} data - Data to update
   * @returns {Promise} - Promise with updated anomaly
   */
  updateAnomaly: async (id, data) => {
    try {
      const response = await api.patch(`/data/anomalies/${id}/`, data);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to update anomaly: ${error.message}`);
    }
  },

  /**
   * Resolve an anomaly
   * @param {number} id - Anomaly ID
   * @param {string} notes - Resolution notes
   * @returns {Promise} - Promise with resolved anomaly
   */
  resolveAnomaly: async (id, notes) => {
    try {
      const response = await api.post(`/data/anomalies/${id}/resolve/`, {
        resolution_notes: notes,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to resolve anomaly: ${error.message}`);
    }
  },

  /**
   * Get anomaly statistics
   * @returns {Promise} - Promise with anomaly statistics
   */
  getAnomalyStats: async () => {
    try {
      const response = await api.get("/data/anomalies/stats/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "anomaly statistics", mockAnomalyStats);
    }
  },

  /**
   * Trigger an anomaly scan
   * @param {Object} [options] - Scan options
   * @param {number} [options.invoice_id] - Optional invoice ID to scan
   * @param {Array} [options.scan_types] - Optional specific scan types to run
   * @param {string} [options.data_source] - Optional data source to scan
   * @param {number} [options.threshold_multiplier] - Optional threshold multiplier for outlier detection
   * @returns {Promise} - Promise with scan results
   */
  triggerAnomalyScan: async (options = {}) => {
    try {
      const payload = {};

      if (options.invoice_id) {
        payload.invoice_id = options.invoice_id;
      }

      if (options.scan_types && options.scan_types.length > 0) {
        payload.scan_types = options.scan_types;
      }

      if (options.data_source) {
        payload.data_source = options.data_source;
      }

      if (options.threshold_multiplier) {
        payload.threshold_multiplier = options.threshold_multiplier;
      }

      const response = await api.post("/data/anomalies/scan/", payload);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to trigger anomaly scan: ${error.message}`);
    }
  },

  /**
   * Get anomaly types
   * @returns {Promise} - Promise with anomaly types
   */
  getAnomalyTypes: async () => {
    try {
      const response = await api.get("/data/anomalies/types/");
      return response.data;
    } catch (error) {
      console.error("Error in anomaly types:", error);
      // Provide fallback types if the API call fails
      return {
        types: [
          { id: "missing_data", name: "Missing Data" },
          { id: "duplicate_data", name: "Duplicate Data" },
          { id: "invalid_data", name: "Invalid Data" },
          { id: "outlier", name: "Outlier" },
          { id: "inconsistent_data", name: "Inconsistent Data" },
          { id: "other", name: "Other" },
        ],
      };
    }
  },
};

export default anomalyService;
