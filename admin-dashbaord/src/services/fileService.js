import axios from "axios";

const API_URL = "/data";

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_URL,
});

// Add request interceptor to add auth token
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export const fileService = {
  uploadFile: async (file, invoiceNumber) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("invoice_number", invoiceNumber);
    formData.append("file_name", file.name);

    const response = await axiosInstance.post(
      "/upload-facturation/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  },

  getFiles: async () => {
    const response = await axiosInstance.get("/api/facturation/");
    return response.data;
  },

  updateFile: async (id, data) => {
    const response = await axiosInstance.put(`/api/facturation/${id}/`, data);
    return response.data;
  },

  deleteFile: async (id) => {
    await axiosInstance.delete(`/api/facturation/${id}/`);
  },

  downloadFile: async (id) => {
    const response = await axiosInstance.get(
      `/api/facturation/${id}/download/`,
      { responseType: "blob" }
    );
    return response;
  },

  processFile: async (id, options = {}) => {
    console.log(`Processing file ${id} with options:`, options);
    try {
      const response = await axiosInstance.post(
        `/api/facturation/${id}/process/`,
        options
      );
      console.log(`File ${id} processed successfully:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`Error processing file ${id}:`, error);
      console.error("Response:", error.response?.data);
      throw error;
    }
  },

  saveToDatabase: async (id) => {
    console.log(`Saving file ${id} to database`);
    try {
      const response = await axiosInstance.post(`/api/facturation/${id}/save/`);
      console.log(`File ${id} saved successfully:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`Error saving file ${id} to database:`, error);
      console.error("Response:", error.response?.data);
      throw error;
    }
  },

  inspectFile: async (id) => {
    try {
      const response = await axiosInstance.get(
        `/api/facturation/${id}/inspect/`
      );
      return response.data;
    } catch (error) {
      console.error("Error inspecting file:", error);
      if (error.response) {
        throw new Error(error.response.data.error || "Failed to inspect file");
      }
      throw error;
    }
  },
};
