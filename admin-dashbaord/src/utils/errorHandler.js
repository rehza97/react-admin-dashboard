/**
 * Utility functions for standardized error handling across the application
 */

/**
 * Check if we're in development mode
 * @returns {boolean} - True if in development mode
 */
export const isDevelopment = () => {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
};

/**
 * Generic error handler for API requests
 * @param {Error} error - The error object
 * @param {string} serviceName - The name of the service for logging
 * @param {Object} mockData - Mock data to return in development mode
 * @returns {Object} - Mock data or throws the error
 */
export const handleApiError = (error, serviceName, mockData) => {
  console.error(`Error in ${serviceName}:`, error);

  // Check if we have a specific error message from the backend
  let errorMessage = `Failed to fetch ${serviceName} data`;

  // Safely check for error response properties - handle both axios errors and regular errors
  const errorResponse =
    error && typeof error === "object" && "response" in error
      ? error.response || {}
      : {};
  const errorData =
    errorResponse &&
    typeof errorResponse === "object" &&
    "data" in errorResponse
      ? errorResponse.data || {}
      : {};
  const statusCode =
    errorResponse &&
    typeof errorResponse === "object" &&
    "status" in errorResponse
      ? errorResponse.status
      : null;

  // Handle specific HTTP status codes
  if (statusCode) {
    switch (statusCode) {
      case 400:
        errorMessage = `Invalid request for ${serviceName}: ${
          errorData && typeof errorData === "object" && "error" in errorData
            ? String(errorData.error)
            : "Bad request"
        }`;
        break;
      case 401:
        errorMessage = `Authentication required for ${serviceName}`;
        break;
      case 403:
        errorMessage = `You don't have permission to access ${serviceName}`;
        break;
      case 404:
        errorMessage = `${serviceName} resource not found`;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorMessage = `Server error while fetching ${serviceName} data`;
        break;
      default:
        errorMessage =
          errorData && typeof errorData === "object" && "error" in errorData
            ? String(errorData.error)
            : `Error (${statusCode}) in ${serviceName}`;
    }
  }

  if (errorData && typeof errorData === "object" && "error" in errorData) {
    console.error("Backend error:", errorData.error);

    if (errorData && typeof errorData === "object" && "details" in errorData) {
      console.error("Error details:", errorData.details);
    }
  }

  // Only use mock data in development mode AND when the server is unreachable
  // (network error) or returns a server error (500+)
  const isServerError = typeof statusCode === "number" && statusCode >= 500;
  const isNetworkError =
    !statusCode &&
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    (error.message.includes("Network Error") ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("connect ECONNREFUSED"));

  if (isDevelopment() && (isServerError || isNetworkError)) {
    console.warn(`Using mock ${serviceName} data due to server unavailability`);
    return mockData;
  }

  // In all other cases, throw the error with a descriptive message
  throw new Error(errorMessage);
};

/**
 * Handle API errors in components with snackbar feedback
 * @param {Error} error - The error object
 * @param {string} action - The action being performed (e.g., "fetching data")
 * @param {Function} setSnackbar - Function to set snackbar state
 * @param {Function|null} setError - Optional function to set error state
 * @param {string} defaultMessage - Default error message
 */
export const handleComponentError = (
  error,
  action,
  setSnackbar,
  setError = null,
  defaultMessage = "An error occurred"
) => {
  console.error(`Error ${action}:`, error);

  // Get error message
  const errorMessage = error.message || defaultMessage;

  // Set snackbar
  if (setSnackbar) {
    setSnackbar({
      open: true,
      message: errorMessage,
      severity: "error",
    });
  }

  // Set error state if provided
  if (setError) {
    setError(errorMessage);
  }
};

/**
 * Format error message for display
 * @param {Error|string} error - The error object or message
 * @param {string} defaultMessage - Default message if error is empty
 * @returns {string} - Formatted error message
 */
export const formatErrorMessage = (
  error,
  defaultMessage = "An error occurred"
) => {
  if (!error) {
    return defaultMessage;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || defaultMessage;
  }

  if (typeof error === "object") {
    // Try to extract message from error object
    if ("message" in error) {
      return String(error.message);
    }

    // Try to extract error from response data
    if ("response" in error && error.response && "data" in error.response) {
      const data = error.response.data;

      if (typeof data === "object" && "error" in data) {
        return String(data.error);
      }

      if (typeof data === "string") {
        return data;
      }
    }
  }

  return defaultMessage;
};

export default {
  isDevelopment,
  handleApiError,
  handleComponentError,
  formatErrorMessage,
};
