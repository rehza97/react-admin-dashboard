import api from "./api";

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

  // Other data endpoints as needed
};

export default dataService;
