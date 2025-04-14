import api from "./api";

/**
 * Generic error handler for API requests
 * @param {Error} error - The error object
 * @param {string} serviceName - The name of the service for logging
 * @returns {never} - Always throws an error
 */
const handleApiError = (error, serviceName) => {
  console.error(`Error in ${serviceName}:`, error);

  // Check if we have a specific error message from the backend
  let errorMessage = `Failed to fetch ${serviceName} data`;

  // Safely check for error response properties
  const errorResponse = error.response || {};
  const errorData = errorResponse.data || {};
  const statusCode = errorResponse.status;

  // Handle specific HTTP status codes
  if (statusCode) {
    switch (statusCode) {
      case 400:
        errorMessage = `Invalid request for ${serviceName}: ${
          errorData.error || "Bad request"
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
          errorData.error || `Error (${statusCode}) in ${serviceName}`;
    }
  }

  if (errorData.error) {
    console.error("Backend error:", errorData.error);

    if (errorData.details) {
      console.error("Error details:", errorData.details);
    }
  }

  // Throw the error with a descriptive message
  throw new Error(errorMessage);
};

const dataService = {
  // User data
  getUserProfile: async () => {
    const response = await api.get("/auth/user/");
    return response.data;
  },

  // Invoice data
  getInvoices: async () => {
    const response = await api.get("/data/invoices/");
    return response.data;
  },

  getInvoiceDetails: async (id) => {
    const response = await api.get(`/data/invoices/${id}/`);
    return response.data;
  },

  getProcessedData: async () => {
    const response = await api.get("/data/processed-data/");
    return response.data;
  },

  // Dashboard overview data
  getDashboardOverview: async () => {
    try {
      const response = await api.get("/data/dashboard/overview/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "dashboard overview");
    }
  },

  // Map data for all wilayas
  getMapData: async (params = {}) => {
    try {
      const response = await api.get("/data/dashboard/map/", { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, "map data");
    }
  },

  // Get anomalies
  getAnomalies: async (params = {}) => {
    try {
      const response = await api.get("/data/anomalies/", { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, "anomalies");
    }
  },

  // Get anomaly stats
  getAnomalyStats: async () => {
    try {
      const response = await api.get("/data/anomalies/stats/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "anomaly stats");
    }
  },

  // Resolve anomaly
  resolveAnomaly: async (anomalyId, resolution) => {
    try {
      const response = await api.post(`/data/anomalies/${anomalyId}/resolve/`, {
        resolution,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to resolve anomaly: ${error.message}`);
    }
  },

  // Trigger anomaly scan
  triggerAnomalyScan: async (params = {}) => {
    try {
      const response = await api.post("/data/anomalies/scan/", params);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to trigger anomaly scan: ${error.message}`);
    }
  },

  // Get DOT list
  getDOTs: async () => {
    try {
      const response = await api.get("/data/dots/");
      console.log("DOTs API response:", response.data);

      // Handle the response format provided by the backend
      let dotsArray = [];
      if (response.data && response.data.dots) {
        dotsArray = response.data.dots;
      } else if (Array.isArray(response.data)) {
        dotsArray = response.data;
      } else {
        console.warn("DOTs response is not in expected format:", response.data);
        return [];
      }

      // Transform the DOT data to ensure proper display
      return dotsArray.map((dot) => {
        if (typeof dot === "object" && dot !== null) {
          // Format the name properly
          const name =
            dot.name || (dot.code && `DOT ${dot.code}`) || `DOT ${dot.id}`;

          return {
            id: dot.id || dot.code || "",
            name: name,
            code: dot.code || dot.id || "",
          };
        }

        // Handle string DOTs
        if (typeof dot === "string") {
          return {
            id: dot,
            name: `DOT ${dot}`,
            code: dot,
          };
        }

        // Fallback
        const stringValue = String(dot);
        return {
          id: stringValue,
          name: `DOT ${stringValue}`,
          code: stringValue,
        };
      });
    } catch (error) {
      console.error("Error fetching DOTs:", error);
      return handleApiError(error, "fetching DOTs");
    }
  },

  // Get recent uploads
  getRecentUploads: async (limit = 5) => {
    try {
      const response = await api.get("/data/invoices/", {
        params: { limit, ordering: "-upload_date" },
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, "recent uploads");
    }
  },

  // Get data counts
  getDataCounts: async () => {
    try {
      const response = await api.get("/data/counts/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "data counts");
    }
  },

  // Get user stats
  getUserStats: async () => {
    try {
      const response = await api.get("/users/api/stats/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "user stats");
    }
  },

  // Get file stats
  getFileStats: async () => {
    try {
      const response = await api.get("/data/files/stats/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "file stats");
    }
  },

  // Data validation and cleaning
  validateData: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();

      if (params.dot) queryParams.append("dot", params.dot);
      if (params.startDate) queryParams.append("start_date", params.startDate);
      if (params.endDate) queryParams.append("end_date", params.endDate);

      const url = `/data/validation/?${queryParams.toString()}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      return handleApiError(error, "data validation");
    }
  },

  cleanData: async (params = {}) => {
    try {
      const url = "/data/cleaning/";
      const response = await api.post(url, {
        validate_first: params.validateFirst !== false,
        models_to_clean: params.modelsToClean || [],
        dot: params.dot || null,
        start_date: params.startDate || null,
        end_date: params.endDate || null,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, "data cleaning");
    }
  },

  // Data cleanup tool methods
  analyzeDataForCleanup: async (params = {}) => {
    try {
      const response = await api.get("/data/data-cleanup/", { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, "data cleanup analysis");
    }
  },

  cleanupData: async (params = {}) => {
    try {
      const response = await api.post("/data/data-cleanup/", params);
      return response.data;
    } catch (error) {
      return handleApiError(error, "data cleanup");
    }
  },

  getCleanupProgress: async (taskId) => {
    try {
      const response = await api.get(`/data/cleanup-progress/${taskId}/`);
      return response.data;
    } catch (error) {
      return handleApiError(error, "cleanup progress");
    }
  },
};

export default dataService;
