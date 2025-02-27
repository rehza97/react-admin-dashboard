import axios from "axios";

const BASE_URL = "data/api";

// Create axios instance with default config
const api = axios.create({
  baseURL: BASE_URL,
});

// Add request interceptor to handle token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const dataService = {
  // File upload endpoints
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    return api.post("/facturation/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  getFiles: async () => {
    return api.get("/facturation/");
  },

  deleteFile: async (id) => {
    return api.delete(`/facturation/${id}/`);
  },

  downloadFile: async (id) => {
    return api.get(`/facturation/${id}/download/`, {
      responseType: "blob",
    });
  },
};

export default dataService;
