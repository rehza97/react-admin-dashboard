import api from "./api";

const performanceService = {
  getPerformanceRankings: async (metric = "revenue", filters = {}) => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("metric", metric);
      if (filters.year) params.append("year", filters.year);
      if (filters.month) params.append("month", filters.month);
      if (filters.limit) params.append("limit", filters.limit);

      const response = await api.get(
        `/data/kpi/performance-ranking/?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching performance rankings:", error);
      throw error;
    }
  },
};

export default performanceService;
