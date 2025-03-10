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
 * @param {Object} mockData - Mock data to return in development mode (optional)
 * @returns {Object|Error} - Mock data in development mode or throws the error
 */
export const handleApiError = (error, serviceName, mockData = null) => {
  console.error(`Error in ${serviceName}:`, error);

  // Extract error details
  let errorMessage = `Error in ${serviceName}`;
  let statusCode;
  let errorData;

  if (error && typeof error === "object" && "response" in error) {
    // Access properties safely
    const response = error.response;
    statusCode =
      response && typeof response === "object" ? response.status : undefined;
    errorData =
      response && typeof response === "object" ? response.data : undefined;

    // Construct a more descriptive error message based on status code
    switch (statusCode) {
      case 400:
        errorMessage = `${serviceName} request was invalid`;
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
        errorMessage = `Server error occurred in ${serviceName}`;
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

  // Check if we should use mock data
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

  if (isDevelopment() && mockData && (isServerError || isNetworkError)) {
    console.warn(`Using mock ${serviceName} data due to server unavailability`);
    return mockData;
  }

  // Otherwise throw the error
  throw new Error(errorMessage);
};
