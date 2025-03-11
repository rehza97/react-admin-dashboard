import { createContext, useState, useEffect, useContext } from "react";
import { authService } from "../services/api";
import PropTypes from "prop-types";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Add a separate isAuthenticated state to prevent flickering during refresh
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("isAuthenticated") === "true"
  );

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        setIsAuthenticated(false);
        return;
      }

      // If we have a token, assume the user is authenticated until proven otherwise
      setIsAuthenticated(true);

      try {
        const userData = await authService.getCurrentUser();
        setCurrentUser(userData);

        // If we got user data, we're definitely authenticated
        setIsAuthenticated(true);
        localStorage.setItem("isAuthenticated", "true");

        // Update the cached user data
        localStorage.setItem("cachedUser", JSON.stringify(userData));
      } catch (err) {
        console.error("Failed to fetch user data:", err);

        // Only log out the user if it's a clear authentication error (401/403)
        // For other errors like network issues (5xx, timeout), keep the user logged in
        if (
          err.response &&
          (err.response.status === 401 || err.response.status === 403)
        ) {
          setError("Your session has expired. Please log in again.");
          // Clear invalid tokens
          localStorage.removeItem("token");
          localStorage.removeItem("isAuthenticated");
          setIsAuthenticated(false);
        } else {
          // For other errors, keep the user logged in but set an error
          setError(
            "Unable to connect to the server. You may have limited functionality."
          );
          // Try to use cached user data if available
          const cachedUser = localStorage.getItem("cachedUser");
          if (cachedUser) {
            try {
              setCurrentUser(JSON.parse(cachedUser));
              // Keep the user authenticated with cached data
              setIsAuthenticated(true);
            } catch (e) {
              console.error("Error parsing cached user:", e);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUser();
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      const response = await authService.login({
        email: credentials.email,
        password: credentials.password,
      });

      // Make sure we're using the right response format
      const token = response.token || response.data?.token;
      const userData = response.user || response.data?.user;

      if (!token) {
        throw new Error("No token received from the server");
      }

      localStorage.setItem("token", token);
      localStorage.setItem("isAuthenticated", "true");

      // Cache the user data for offline use
      localStorage.setItem("cachedUser", JSON.stringify(userData));

      // Set user data and authentication state
      setCurrentUser(userData);
      setIsAuthenticated(true);

      console.log("Auth context login completed, user data set");

      return response;
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Always clear local storage even if API call fails
      localStorage.removeItem("token");
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("cachedUser");
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    logout,
    setCurrentUser,
    isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
