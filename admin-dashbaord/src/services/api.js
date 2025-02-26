import axios from 'axios';

// Create axios instance with base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth services
export const authService = {
  login: async (credentials) => {
    const response = await api.post('/users/api/login/', credentials);
    return response.data;
  },
  
  register: async (userData) => {
    const response = await api.post('/users/api/register/', userData);
    return response.data;
  },
  
  logout: async () => {
    const response = await api.post('/users/api/logout/');
    return response.data;
  },
  
  getCurrentUser: async () => {
    const response = await api.get('/users/api/current-user/');
    return response.data;
  },
  
  updateProfile: async (userData) => {
    const response = await api.put('/users/api/profile/', userData);
    return response.data;
  },
  
  requestPasswordReset: async (data) => {
    const response = await api.post('/users/api/password_reset/', data);
    return response.data;
  },
  
  confirmPasswordReset: async (data) => {
    const response = await api.post('/users/api/password_reset/confirm/', data);
    return response.data;
  },
};

// Data services
export const dataService = {
  getFacturations: async () => {
    const response = await api.get('/data/api/facturation/');
    return response.data;
  },
  
  getFacturationDetail: async (id) => {
    const response = await api.get(`/data/api/facturation/${id}/`);
    return response.data;
  },
  
  uploadFacturationFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/data/upload-facturation/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

// User management services
export const userService = {
  getUsers: async () => {
    const response = await api.get('/users/api/users/');
    return response.data;
  },
  
  getUserById: async (id) => {
    const response = await api.get(`/users/api/users/${id}/`);
    return response.data;
  },
  
  createUser: async (userData) => {
    const response = await api.post('/users/api/users/', userData);
    return response.data;
  },
  
  updateUser: async (id, userData) => {
    const response = await api.put(`/users/api/users/${id}/`, userData);
    return response.data;
  },
  
  deleteUser: async (id) => {
    const response = await api.delete(`/users/api/users/${id}/`);
    return response.data;
  },
};

export default api; 