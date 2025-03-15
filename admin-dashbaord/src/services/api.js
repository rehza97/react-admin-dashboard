import axios from "axios";

// Create axios instance with base URL
const API_URL = "https://react-admin-dashboard-nz1d.onrender.com";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 Unauthorized and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Prevent infinite loop

      try {
        // Try to refresh the token
        // Note: This assumes your backend has a token refresh endpoint
        // You may need to adjust this based on your actual backend implementation
        const refreshToken = localStorage.getItem("refreshToken");

        if (refreshToken) {
          const response = await axios.post(
            `${API_URL}/users/api/token/refresh/`,
            {
              refresh: refreshToken,
            }
          );

          // Update the token in localStorage
          localStorage.setItem("token", response.data.access);

          // Update the Authorization header
          originalRequest.headers.Authorization = `Token ${response.data.access}`;

          // Retry the original request
          return api(originalRequest);
        } else {
          // No refresh token, redirect to login
          localStorage.removeItem("token");
          localStorage.removeItem("isAuthenticated");
          window.location.href = "/login";
        }
      } catch (refreshError) {
        // Handle refresh token failure
        console.error("Token refresh failed:", refreshError);

        // Clear auth data
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("isAuthenticated");

        // Redirect to login
        window.location.href = "/login";

        return Promise.reject(refreshError);
      }
    }

    // For other errors, just reject the promise
    return Promise.reject(error);
  }
);

// Auth services
export const authService = {
  login: async (credentials) => {
    try {
      const response = await api.post("/users/api/login/", credentials);
      // Ensure we're returning data in a consistent format
      return {
        token: response.data.token,
        user: response.data.user,
        ...response.data,
      };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  register: async (userData) => {
    try {
      const response = await api.post("/users/api/register/", userData);
      return response.data;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  },

  logout: async () => {
    try {
      const response = await api.post("/users/api/logout/");
      return response.data;
    } catch (error) {
      console.error("Logout error:", error);
      // Still clear local storage even if API call fails
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("isAuthenticated");
      throw error;
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get("/users/api/current-user/");
      return response.data;
    } catch (error) {
      console.error("Get current user error:", error);
      throw error;
    }
  },

  updateProfile: async (userData) => {
    try {
      const response = await api.put("/users/api/profile/", userData);
      return response.data;
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    }
  },

  requestPasswordReset: async (data) => {
    try {
      const response = await api.post("/users/api/password_reset/", data);
      return response.data;
    } catch (error) {
      console.error("Password reset request error:", error);
      throw error;
    }
  },

  confirmPasswordReset: async (data) => {
    try {
      const response = await api.post(
        "/users/api/password_reset/confirm/",
        data
      );
      return response.data;
    } catch (error) {
      console.error("Password reset confirmation error:", error);
      throw error;
    }
  },

  // DOT permissions management
  getDOTPermissions: async (userId) => {
    try {
      const response = await api.get(
        `/users/api/users/${userId}/dot-permissions/`
      );
      return response.data;
    } catch (error) {
      console.error("Get DOT permissions error:", error);
      throw error;
    }
  },

  assignDOTPermission: async (userId, dotData, userData) => {
    try {
      console.log("Assigning DOT permission with data:", dotData);
      console.log("User data:", userData);

      // Try with just the DOT data - this is what the endpoint should accept
      const payload = {
        dot_code: dotData.dot_code,
        dot_name: dotData.dot_name,
      };

      console.log("Sending payload to backend:", payload);

      try {
        const response = await api.post(
          `/users/api/users/${userId}/assign-dot/`,
          payload
        );
        return response.data;
      } catch (error) {
        // If we get a 400 error with email validation errors,
        // it means the backend is trying to validate the user data
        // This is likely a backend issue, but we'll try to work around it
        if (error.response && error.response.status === 400) {
          console.log("Got validation errors:", error.response.data);

          // Since we're getting an email validation error, the backend might be
          // trying to create/update the user instead of just assigning a permission.
          // Let's try a different approach - use a PUT request to update the DOT permissions directly

          console.log("Trying alternative approach...");

          try {
            // Get the current user data
            const userResponse = await api.get(`/users/api/users/${userId}/`);
            const currentUser = userResponse.data;

            // Check if the user already has this DOT permission
            const hasDot =
              currentUser.dot_permissions &&
              currentUser.dot_permissions.some(
                (p) => p.dot_code === dotData.dot_code
              );

            if (hasDot) {
              console.log("User already has this DOT permission");
              return { message: "DOT permission already exists" };
            }

            // Try a direct approach - use the DOT endpoints if available
            const directResponse = await api.post(
              `/users/api/users/${userId}/dot-permissions/`,
              payload
            );
            return directResponse.data;
          } catch (directError) {
            console.error("Alternative approach failed:", directError);

            // If all else fails, throw the original error
            throw error;
          }
        }

        // If it's not a validation error or the retry failed, rethrow
        throw error;
      }
    } catch (error) {
      console.error("Assign DOT permission error:", error);
      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);
      }
      throw error;
    }
  },

  removeDOTPermission: async (userId, dotCode) => {
    try {
      // First try with query parameters
      try {
        console.log(
          `Removing DOT permission with query params: user=${userId}, dot=${dotCode}`
        );
        const response = await api.delete(
          `/users/api/users/${userId}/remove-dot/`,
          {
            params: { dot_code: dotCode },
          }
        );
        return response.data;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          // If 404, try with path parameter approach
          console.log(
            `Retrying with path parameter: user=${userId}, dot=${dotCode}`
          );
          const response = await api.delete(
            `/users/api/users/${userId}/remove-dot/${dotCode}/`
          );
          return response.data;
        }
        throw error;
      }
    } catch (error) {
      console.error("Error removing DOT permission:", error);
      throw error;
    }
  },

  getAvailableDOTs: async () => {
    try {
      const response = await api.get("/users/api/dots/");
      return response.data;
    } catch (error) {
      console.error("Get available DOTs error:", error);
      throw error;
    }
  },
};

// Data services
export const dataService = {
  getFacturations: async () => {
    const response = await api.get("/data/api/facturation/");
    return response.data;
  },

  getFacturationDetail: async (id) => {
    const response = await api.get(`/data/api/facturation/${id}/`);
    return response.data;
  },

  uploadFacturationFile: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/data/upload-facturation/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};

// User management services
export const userService = {
  getUsers: async (includeInactive = false) => {
    const url = includeInactive
      ? "/users/api/users/?show_inactive=true"
      : "/users/api/users/";
    const response = await api.get(url);
    return response.data;
  },

  getInactiveUsers: async () => {
    const response = await api.get("/users/api/users/inactive/");
    return response.data;
  },

  getUserStats: async () => {
    const response = await api.get("/users/api/users/stats/");
    return response.data;
  },

  getUserById: async (id) => {
    const response = await api.get(`/users/api/users/${id}/`);
    return response.data;
  },

  createUser: async (userData) => {
    try {
      // Ensure required fields are present
      if (!userData.email || !userData.password) {
        throw new Error("Email and password are required");
      }

      // Make sure role is set
      if (!userData.role) {
        userData.role = "viewer"; // Default role
      }

      const response = await api.post("/users/api/users/", userData);
      return response.data;
    } catch (error) {
      console.error(
        "Error creating user:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  updateUser: async (id, userData) => {
    try {
      const response = await api.put(`/users/api/users/${id}/`, userData);
      return response.data;
    } catch (error) {
      console.error(
        "Error updating user:",
        error.response?.data || error.message
      );
      throw error;
    }
  },

  deleteUser: async (id) => {
    // This performs a soft delete (disables the account)
    const response = await api.delete(`/users/api/users/${id}/`);
    return response.data;
  },

  disableUser: async (id) => {
    // Explicitly disable a user account
    const response = await api.post(`/users/api/users/${id}/disable/`);
    return response.data;
  },

  enableUser: async (id) => {
    // Re-enable a disabled user account
    const response = await api.post(`/users/api/users/${id}/enable/`);
    return response.data;
  },

  hardDeleteUser: async (id) => {
    // Permanently delete a user account
    const response = await api.delete(`/users/api/users/${id}/hard-delete/`);
    return response.data;
  },

  getCurrentUserPermissions: async () => {
    try {
      // Get the current user's permissions from the server
      // If your API doesn't have this endpoint, you can use the current user's role
      // to determine permissions
      const currentUser = await authService.getCurrentUser();

      // Default permissions based on role
      const permissions = {
        canDeleteUsers: currentUser.role === "admin",
        canEditUsers: ["admin", "manager"].includes(currentUser.role),
        canAddUsers: ["admin", "manager"].includes(currentUser.role),
      };

      return permissions;
    } catch (error) {
      console.error("Error getting user permissions:", error);
      // Return safe defaults (no permissions) in case of error
      return {
        canDeleteUsers: false,
        canEditUsers: false,
        canAddUsers: false,
      };
    }
  },

  // Add a helper method to standardize DOT format
  standardizeDOTFormat: (dots) => {
    if (!Array.isArray(dots)) return [];

    return dots.map((dot) => ({
      // Ensure consistent field naming
      dot_code: dot.dot_code || dot.code || "",
      dot_name: dot.dot_name || dot.name || "",
      // Keep original fields for compatibility
      code: dot.dot_code || dot.code || "",
      name: dot.dot_name || dot.name || "",
    }));
  },

  // DOT management methods
  getAllDOTs: async () => {
    try {
      const response = await api.get("/users/api/dots/");
      return response.data;
    } catch (error) {
      console.error("Error fetching DOTs:", error);
      throw error;
    }
  },

  getDOTById: async (id) => {
    try {
      const response = await api.get(`/users/api/dots/${id}/`);
      return response.data;
    } catch (error) {
      console.error("Error fetching DOT:", error);
      throw error;
    }
  },

  createDOT: async (dotData) => {
    try {
      const response = await api.post("/users/api/dots/", dotData);
      return response.data;
    } catch (error) {
      console.error("Error creating DOT:", error);
      throw error;
    }
  },

  updateDOT: async (id, dotData) => {
    try {
      const response = await api.put(`/users/api/dots/${id}/`, dotData);
      return response.data;
    } catch (error) {
      console.error("Error updating DOT:", error);
      throw error;
    }
  },

  deleteDOT: async (id) => {
    try {
      const response = await api.delete(`/users/api/dots/${id}/`);
      return response.data;
    } catch (error) {
      console.error("Error deleting DOT:", error);
      throw error;
    }
  },

  // DOT permissions management
  getUserDOTPermissions: async (userId) => {
    try {
      const response = await api.get(
        `/users/api/users/${userId}/dot-permissions/`
      );
      return response.data;
    } catch (error) {
      console.error("Error getting user DOT permissions:", error);
      throw error;
    }
  },

  assignDOTPermission: async (userId, dotData) => {
    try {
      // Log the request for debugging
      console.log("Sending DOT permission data:", {
        userId,
        dotData,
        url: `/users/api/users/${userId}/assign-dot/`,
      });

      // Ensure we're sending data in the exact format expected by the backend
      const payload = {
        dot_code: dotData.dot_code,
        dot_name: dotData.dot_name,
      };

      try {
        const response = await api.post(
          `/users/api/users/${userId}/assign-dot/`,
          payload
        );
        return response.data;
      } catch (error) {
        // If the first attempt fails with 400 and mentions email/role validation
        if (
          error.response &&
          error.response.status === 400 &&
          (error.response.data.email || error.response.data.role)
        ) {
          console.log(
            "Received user validation error, trying alternative approach"
          );

          // Try a different endpoint structure if available
          try {
            // Try adding a /permissions/ segment
            const altResponse = await api.post(
              `/users/api/users/${userId}/permissions/dot/`,
              payload
            );
            return altResponse.data;
          } catch (altError) {
            // If both approaches fail, throw the original error
            console.error("All approaches failed:", altError);
            throw error;
          }
        }

        // For other errors, just pass them along
        throw error;
      }
    } catch (error) {
      console.error("Error assigning DOT permission:", error);
      // Log the error response for debugging
      if (error.response) {
        console.error("Error response:", error.response.data);
      }
      throw error;
    }
  },

  removeDOTPermission: async (userId, dotCode) => {
    try {
      // Change the URL format to match what the backend expects
      // If the backend uses a different format for the "all" DOT code, handle it specially
      const url =
        dotCode === "all"
          ? `/users/api/users/${userId}/remove-all-dots/`
          : `/users/api/users/${userId}/remove-dot/${dotCode}/`;

      const response = await api.delete(url);
      return response.data;
    } catch (error) {
      console.error("Error removing DOT permission:", error);
      throw error;
    }
  },
};

export default api;
