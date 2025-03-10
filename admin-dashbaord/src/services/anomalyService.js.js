import api from "./api";

const anomalyService = {
  getAnomalies: async (filters = {}) => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.invoice) params.append("invoice", filters.invoice);
      if (filters.type) params.append("type", filters.type);
      if (filters.status) params.append("status", filters.status);
      if (filters.startDate) params.append("start_date", filters.startDate);
      if (filters.endDate) params.append("end_date", filters.endDate);

      const response = await api.get(`/data/anomalies/?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching anomalies:", error);
      throw error;
    }
  },

  getAnomaly: async (id) => {
    try {
      const response = await api.get(`/data/anomalies/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching anomaly ${id}:`, error);
      throw error;
    }
  },

  updateAnomaly: async (id, data) => {
    try {
      const response = await api.patch(`/data/anomalies/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating anomaly ${id}:`, error);
      throw error;
    }
  },

  resolveAnomaly: async (id, resolutionNotes) => {
    try {
      const response = await api.post(`/data/anomalies/${id}/resolve/`, {
        resolution_notes: resolutionNotes,
      });
      return response.data;
    } catch (error) {
      console.error(`Error resolving anomaly ${id}:`, error);
      throw error;
    }
  },
};

export default anomalyService;
