import api from "./api";

/**
 * Generic error handler for API requests
 * @param {Error & { response?: { data?: any, status?: number } }} error - The error object
 * @param {string} serviceName - The name of the service for logging
 * @returns {never} - Always throws an error with a descriptive message
 */
const handleApiError = (error, serviceName) => {
  console.error(`Error in ${serviceName}:`, error);

  // Check if we have a specific error message from the backend
  let errorMessage = `Failed to fetch ${serviceName} data`;

  // Safely check for error response properties
  const errorResponse = error?.response || {};
  const errorData = errorResponse?.data || {};
  const statusCode = errorResponse?.status;

  // Handle specific HTTP status codes
  if (statusCode) {
    switch (statusCode) {
      case 400:
        errorMessage = `Invalid request for ${serviceName}: ${
          errorData?.error || "Bad request"
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
        errorMessage = errorData?.error
          ? String(errorData.error)
          : `Error (${statusCode}) in ${serviceName}`;
    }
  }

  throw new Error(errorMessage);
};

const anomalyService = {
  /**
   * Get a list of anomalies with optional filtering
   */
  getAnomalies: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await api.get(`/data/anomalies/?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, "anomalies");
    }
  },

  /**
   * Get details for a specific anomaly
   */
  getAnomalyDetails: async (id) => {
    try {
      const response = await api.get(`/data/anomalies/${id}/`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `anomaly ${id}`);
    }
  },

  /**
   * Update an anomaly (e.g., change status)
   */
  updateAnomaly: async (id, data) => {
    try {
      const response = await api.patch(`/data/anomalies/${id}/`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error, `update anomaly ${id}`);
    }
  },

  /**
   * Resolve an anomaly
   */
  resolveAnomaly: async (id, notes) => {
    try {
      const response = await api.post(`/data/anomalies/${id}/resolve/`, {
        resolution_notes: notes,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, `resolve anomaly ${id}`);
    }
  },

  /**
   * Get anomaly statistics
   */
  getAnomalyStats: async () => {
    try {
      const response = await api.get("/data/anomalies/statistics/");

      // Check if the data matches the expected format
      if (response.data?.statistics) {
        return response.data.statistics;
      } else if (response.data?.data?.statistics) {
        return response.data.data.statistics;
      } else if (response.data?.data) {
        return response.data.data;
      } else {
        // If none of the expected formats are found, return the raw data
        return response.data;
      }
    } catch (error) {
      throw handleApiError(error, "anomaly statistics");
    }
  },

  /**
   * Get anomaly types
   */
  getAnomalyTypes: async () => {
    try {
      const response = await api.get("/data/anomalies/types/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "anomaly types");
    }
  },

  // Scanning methods
  scanRevenueOutliers: async () => {
    try {
      const response = await api.post("/data/anomalies/scan/revenue-outliers/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "revenue outliers scan");
    }
  },

  scanCollectionOutliers: async () => {
    try {
      const response = await api.post(
        "/data/anomalies/scan/collection-outliers/"
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, "collection outliers scan");
    }
  },

  scanTemporalPatterns: async () => {
    try {
      const response = await api.post(
        "/data/anomalies/scan/temporal-patterns/"
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, "temporal patterns scan");
    }
  },

  scanZeroValues: async () => {
    try {
      const response = await api.post("/data/anomalies/scan/zero-values/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "zero values scan");
    }
  },

  scanDuplicates: async () => {
    try {
      const response = await api.post("/data/anomalies/scan/duplicates/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "duplicates scan");
    }
  },

  scanEmptyCells: async () => {
    try {
      const response = await api.post("/data/anomalies/scan/empty-cells/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "empty cells scan");
    }
  },

  scanDOTValidity: async () => {
    try {
      const response = await api.post("/data/anomalies/scan/dot-validity/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "DOT validity scan");
    }
  },

  // NGBSS specialized scan methods
  scanCreancesNGBSSEmptyCells: async () => {
    try {
      const response = await api.post(
        "/data/anomalies/scan/creances-ngbss-empty-cells/"
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, "Créances NGBSS empty cells scan");
    }
  },

  scanCAPeriodiqueEmptyCells: async () => {
    try {
      const response = await api.post(
        "/data/anomalies/scan/ca-periodique-empty-cells/"
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, "CA Périodique empty cells scan");
    }
  },

  scanCANonPeriodiqueEmptyCells: async () => {
    try {
      const response = await api.post(
        "/data/anomalies/scan/ca-non-periodique-empty-cells/"
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, "CA Non Périodique empty cells scan");
    }
  },

  scanCACNTEmptyCells: async () => {
    try {
      const response = await api.post(
        "/data/anomalies/scan/ca-cnt-empty-cells/"
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, "CA CNT empty cells scan");
    }
  },

  scanCADNTEmptyCells: async () => {
    try {
      const response = await api.post(
        "/data/anomalies/scan/ca-dnt-empty-cells/"
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, "CA DNT empty cells scan");
    }
  },

  scanCARFDEmptyCells: async () => {
    try {
      const response = await api.post(
        "/data/anomalies/scan/ca-rfd-empty-cells/"
      );
      return response.data;
    } catch (error) {
      throw handleApiError(error, "CA RFD empty cells scan");
    }
  },

  // Deletion methods
  bulkDeleteAnomalies: async () => {
    try {
      const response = await api.post("/data/anomalies/bulk-delete/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "bulk delete anomalies");
    }
  },

  deleteAnomaliesBySource: async (sources) => {
    try {
      const response = await api.post("/data/anomalies/delete-by-source/", {
        sources,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, "delete anomalies by source");
    }
  },

  deleteAnomaliesByType: async (types) => {
    try {
      const response = await api.post("/data/anomalies/delete-by-type/", {
        types,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, "delete anomalies by type");
    }
  },

  // Enhanced statistics method
  getDetailedStatistics: async () => {
    try {
      const response = await api.get("/data/anomalies/statistics/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "detailed statistics");
    }
  },

  // Get anomaly KPIs
  getAnomalyKPIs: async () => {
    try {
      const response = await api.get("/data/anomalies/kpis/");
      return response.data.kpis;
    } catch (error) {
      throw handleApiError(error, "anomaly KPIs");
    }
  },

  // Get combined dashboard data
  getAnomalyDashboard: async () => {
    try {
      const response = await api.get("/data/anomalies/dashboard/");
      return response.data.dashboard_data;
    } catch (error) {
      throw handleApiError(error, "anomaly dashboard");
    }
  },

  // Get paginated anomaly table data
  getAnomalyTable: async (
    page = 1,
    pageSize = 10,
    filters = {},
    sortBy = null
  ) => {
    try {
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("page_size", pageSize);

      if (sortBy) params.append("sort_by", sortBy);

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(
        `/data/anomalies/table/?${params.toString()}`
      );
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, "anomaly table data");
    }
  },

  // Get available filter options
  getAnomalyFilters: async () => {
    try {
      const response = await api.get("/data/anomalies/filters/");
      return response.data.filters;
    } catch (error) {
      throw handleApiError(error, "anomaly filters");
    }
  },

  // Utility method to run all scans
  runFullScan: async () => {
    try {
      const response = await api.post("/data/anomalies/scan/");
      return response.data;
    } catch (error) {
      throw handleApiError(error, "full scan");
    }
  },

  // Model-specific anomaly scanning
  scanModelAnomalies: async (modelName) => {
    try {
      const response = await api.post("/data/anomalies/scan-model/", {
        model_name: modelName,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, `${modelName} anomaly scan`);
    }
  },

  // Get available models for scanning
  getAvailableModels: () => {
    return [
      {
        id: "journal_ventes",
        name: "Journal des Ventes",
        description: "Invoice journal data with revenue information",
      },
      {
        id: "etat_facture",
        name: "État de Facture",
        description: "Invoice status tracking information",
      },
      {
        id: "parc_corporate",
        name: "Parc Corporate",
        description: "Corporate park subscriber data",
      },
      {
        id: "ngbss",
        name: "NGBSS Models",
        description: "All NGBSS-related models (Créances, CA Périodique, etc.)",
      },
    ];
  },
};

export default anomalyService;
