import api from "./api";

/**
 * Service for fetching enhanced KPI data with performance metrics
 */
const enhancedKpiService = {
  /**
   * Get revenue performance metrics
   * @param {Object} params - Query parameters
   * @param {number} params.year - Year to fetch data for
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @returns {Promise} - Promise with revenue performance data
   */
  getRevenuePerformance: async (params) => {
    try {
      const queryParams = new URLSearchParams();

      // Add required parameters
      queryParams.append("year", params.year);

      // Add optional parameters if provided
      if (params.month) queryParams.append("month", params.month);
      if (params.dot) queryParams.append("dot", params.dot);

      const response = await api.get(
        `/data/kpi/revenue-performance/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching revenue performance:", error);
      throw error;
    }
  },

  /**
   * Get collection performance metrics
   * @param {Object} params - Query parameters
   * @param {number} params.year - Year to fetch data for
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @returns {Promise} - Promise with collection performance data
   */
  getCollectionPerformance: async (params) => {
    try {
      const queryParams = new URLSearchParams();

      // Add required parameters
      queryParams.append("year", params.year);

      // Add optional parameters if provided
      if (params.month) queryParams.append("month", params.month);
      if (params.dot) queryParams.append("dot", params.dot);

      const response = await api.get(
        `/data/kpi/collection-performance/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching collection performance:", error);
      throw error;
    }
  },

  /**
   * Get corporate park metrics
   * @param {Object} params - Query parameters
   * @param {number} [params.year] - Year to fetch data for (optional)
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @param {string} [params.telecomType] - Telecom type to filter by (optional)
   * @param {string} [params.offerName] - Offer name to filter by (optional)
   * @returns {Promise} - Promise with corporate park data
   */
  getCorporateParkMetrics: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();

      // Add optional parameters if provided
      if (params.year) queryParams.append("year", params.year);
      if (params.month) queryParams.append("month", params.month);
      if (params.dot) queryParams.append("dot", params.dot);
      if (params.telecomType)
        queryParams.append("telecom_type", params.telecomType);
      if (params.offerName) queryParams.append("offer_name", params.offerName);

      const response = await api.get(
        `/data/kpi/corporate-park-metrics/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching corporate park metrics:", error);
      throw error;
    }
  },

  /**
   * Get receivables metrics
   * @param {Object} params - Query parameters
   * @param {number} [params.year] - Year to fetch data for (optional)
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @param {string} [params.product] - Product to filter by (optional)
   * @param {string} [params.customerLevel] - Customer level to filter by (optional)
   * @returns {Promise} - Promise with receivables data
   */
  getReceivablesMetrics: async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();

      // Add optional parameters if provided
      if (params.year) queryParams.append("year", params.year);
      if (params.month) queryParams.append("month", params.month);
      if (params.dot) queryParams.append("dot", params.dot);
      if (params.product) queryParams.append("product", params.product);
      if (params.customerLevel)
        queryParams.append("customer_level", params.customerLevel);

      const response = await api.get(
        `/data/kpi/receivables-metrics/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching receivables metrics:", error);
      throw error;
    }
  },

  /**
   * Get comprehensive dashboard data
   * @param {Object} params - Query parameters
   * @param {number} params.year - Year to fetch data for
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {string} [params.dot] - DOT to filter by (optional)
   * @returns {Promise} - Promise with comprehensive dashboard data
   */
  getDashboardData: async (params) => {
    try {
      const queryParams = new URLSearchParams();

      // Add required parameters
      queryParams.append("year", params.year);

      // Add optional parameters if provided
      if (params.month) queryParams.append("month", params.month);
      if (params.dot) queryParams.append("dot", params.dot);

      const response = await api.get(
        `/data/kpi/dashboard/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      throw error;
    }
  },

  /**
   * Get performance rankings (top/flop)
   * @param {Object} params - Query parameters
   * @param {string} params.metric - Metric to rank by (revenue, collection, etc.)
   * @param {number} params.year - Year to fetch data for
   * @param {number} [params.month] - Month to fetch data for (optional)
   * @param {number} [params.limit] - Number of results to return (optional)
   * @returns {Promise} - Promise with performance ranking data
   */
  getPerformanceRankings: async (params) => {
    try {
      const queryParams = new URLSearchParams();

      // Add required parameters
      queryParams.append("metric", params.metric);
      queryParams.append("year", params.year);

      // Add optional parameters if provided
      if (params.month) queryParams.append("month", params.month);
      if (params.limit) queryParams.append("limit", params.limit);

      const response = await api.get(
        `/data/kpi/performance-ranking/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching performance rankings:", error);
      throw error;
    }
  },
};

export default enhancedKpiService;
