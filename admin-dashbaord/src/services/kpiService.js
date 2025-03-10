import api from "./api";
import { handleApiError } from "./utils/errorHandling";

// Helper functions for components that need them
export const getCurrentYear = () => new Date().getFullYear();
export const getCurrentMonth = () => new Date().getMonth() + 1;

const kpiService = {
  // Dashboard summary
  getDashboardSummary: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      const response = await api.get(
        `/data/kpi/dashboard-summary/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error, "dashboard summary");
    }
  },

  // Revenue KPIs
  getRevenueKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      const response = await api.get(
        `/data/kpi/revenue/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error, "revenue");
    }
  },

  // Collection KPIs
  getCollectionKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      const response = await api.get(
        `/data/kpi/collection/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error, "collection");
    }
  },

  // Receivables KPIs
  getReceivablesKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      const response = await api.get(
        `/data/kpi/receivables/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error, "receivables");
    }
  },

  // Corporate Park KPIs
  getCorporateParkKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      const response = await api.get(
        `/data/kpi/corporate-park/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error, "corporate park");
    }
  },

  // Periodic Revenue KPIs
  getPeriodicRevenueKPIs: async (params = {}) => {
    try {
      const response = await api.get("/data/kpi/periodic-revenue/", { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, "periodic revenue KPIs");
    }
  },

  // Non-Periodic Revenue KPIs
  getNonPeriodicRevenueKPIs: async (params = {}) => {
    try {
      const response = await api.get("/data/kpi/non-periodic-revenue/", {
        params,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, "non-periodic revenue KPIs");
    }
  },

  // Special Revenue KPIs (DNT, RFD, CNT)
  getSpecialRevenueKPIs: async (type = "dnt", params = {}) => {
    try {
      const queryParams = { ...params, type };
      const response = await api.get("/data/kpi/special-revenue/", {
        params: queryParams,
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, `${type.toUpperCase()} revenue`);
    }
  },

  // Helper method to get all revenue-related KPIs
  getAllRevenueKPIs: async (params = {}) => {
    try {
      const [
        revenue,
        periodicRevenue,
        nonPeriodicRevenue,
        dntRevenue,
        rfdRevenue,
        cntRevenue,
      ] = await Promise.all([
        kpiService.getRevenueKPIs(params),
        kpiService.getPeriodicRevenueKPIs(params),
        kpiService.getNonPeriodicRevenueKPIs(params),
        kpiService.getSpecialRevenueKPIs("dnt", params),
        kpiService.getSpecialRevenueKPIs("rfd", params),
        kpiService.getSpecialRevenueKPIs("cnt", params),
      ]);

      return {
        revenue,
        periodicRevenue,
        nonPeriodicRevenue,
        specialRevenue: {
          dnt: dntRevenue,
          rfd: rfdRevenue,
          cnt: cntRevenue,
        },
      };
    } catch (error) {
      console.error("Error fetching all revenue KPIs:", error);
      throw error;
    }
  },

  // NGBSS Collection KPIs
  getNGBSSCollectionKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      const response = await api.get(
        `/data/kpi/ngbss-collection/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error, "ngbss collection");
    }
  },

  // Unfinished Invoice KPIs
  getUnfinishedInvoiceKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }
      if (filters.status) {
        queryParams.append("status", filters.status);
      }
      if (filters.min_days) {
        queryParams.append("min_days", filters.min_days);
      }
      if (filters.max_days) {
        queryParams.append("max_days", filters.max_days);
      }

      const response = await api.get(
        `/data/kpi/unfinished-invoice/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleApiError(error, "unfinished invoice");
    }
  },
};

export default kpiService;
