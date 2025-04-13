import api from "./api";
import { handleApiError } from "./utils/errorHandling";
import mockData from "./mockData";

// Helper functions for components that need them
export const getCurrentYear = () => new Date().getFullYear();
export const getCurrentMonth = () => new Date().getMonth() + 1;

// Simple utility to check if we're in development
const isDevelopment = () => {
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
};

// Handle API errors with mock data fallback
const handleKpiApiError = (error, serviceName) => {
  // Log error details
  console.error(`Error fetching ${serviceName}:`, error);

  // Check for network errors or server errors
  const isNetworkError = !error.response || error.code === "ECONNABORTED";
  const isServerError = error.response && error.response.status >= 500;

  // Use mock data in development when API is unavailable
  if (isDevelopment() && (isNetworkError || isServerError)) {
    console.warn(`Using mock data for ${serviceName}`);

    // Return appropriate mock data based on service name
    switch (serviceName) {
      case "dashboard summary":
        return mockData.kpiData.dashboard_summary;
      case "revenue":
        return mockData.kpiData.revenue;
      case "collection":
        return mockData.kpiData.collection;
      case "receivables":
        return mockData.kpiData.receivables;
      case "corporate park":
        return mockData.kpiData.corporate_park;
      default:
        // If no specific mock data, throw the error
        throw new Error(
          `Failed to fetch ${serviceName} data: ${error.message}`
        );
    }
  }

  // If not in development or not a connection issue, use the error handler from utils
  return handleApiError(error, serviceName);
};

const kpiService = {
  // Dashboard summary
  getDashboardSummary: async (filters = {}) => {
    const controller = new AbortController();
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      console.log(`Fetching dashboard summary with filters:`, filters);
      console.log(
        `Query URL: /data/kpi/dashboard-summary/?${queryParams.toString()}`
      );

      const response = await api.get(
        `/data/kpi/dashboard-summary/?${queryParams.toString()}`,
        { signal: controller.signal }
      );

      console.log("Dashboard summary response:", response.data);
      return response.data;
    } catch (error) {
      // Don't throw error if request was cancelled
      if (error.name === "AbortError") {
        console.log("Request cancelled");
        return null;
      }
      return handleKpiApiError(error, "dashboard summary");
    }
  },

  // Revenue KPIs
  getRevenueKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      const response = await api.get(
        `/data/kpi/revenue/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleKpiApiError(error, "revenue");
    }
  },

  // Collection KPIs
  getCollectionKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      const response = await api.get(
        `/data/kpi/collection/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      return handleKpiApiError(error, "collection");
    }
  },

  // Receivables KPIs
  getReceivablesKPIs: async (filters = {}) => {
    try {
      // Build query parameters properly
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.dot) {
        queryParams.append("dot", filters.dot);
      }
      if (filters.product) {
        queryParams.append("product", filters.product);
      }
      if (filters.customer_lev1) {
        queryParams.append("customer_lev1", filters.customer_lev1);
      }

      // Make the API call with the formatted query string
      const response = await api.get(
        `/data/kpi/receivables/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      // In development mode with connection issues, provide comprehensive mock data
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using enhanced mock data for receivables");
        // Use our enhanced receivables mock data directly
        return mockData.kpiData.receivables;
      }

      return handleKpiApiError(error, "receivables");
    }
  },

  // DCISIT Revenue KPIs
  getDCISITRevenueKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year && filters.year !== "") {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.department && filters.department !== "") {
        queryParams.append("department", filters.department);
      }
      if (filters.product && filters.product !== "") {
        queryParams.append("product", filters.product);
      }

      console.log("[DEBUG] Fetching DCISIT Revenue with params:", filters);
      const apiUrl = `/data/kpi/revenue/dcisit/?${queryParams.toString()}`;
      console.log("[DEBUG] API URL:", apiUrl);

      const response = await api.get(apiUrl);
      console.log("[DEBUG] DCISIT Revenue Response:", response.data);

      return response.data;
    } catch (error) {
      console.error("[DEBUG] Error in getDCISITRevenueKPIs:", error);

      // In development mode with connection issues, provide mock data
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using mock data for DCISIT revenue");
        // Generate simple mock data structure
        return {
          summary: {
            total_revenue: 7580000,
            total_collection: 5680000,
            collection_rate: 74.9,
            journal_count: 120,
            etat_count: 85,
          },
          departments: [
            { name: "Direction Commercial IT", count: 45, total: 3250000 },
            { name: "Direction Technical Support", count: 35, total: 2150000 },
            { name: "Direction Infrastructure", count: 25, total: 1500000 },
            { name: "Direction Development", count: 15, total: 680000 },
          ],
          products: [
            { name: "LTE", count: 40, total: 3000000 },
            { name: "Specialized Line", count: 35, total: 2600000 },
            { name: "VOIP", count: 25, total: 1200000 },
            { name: "FTTx", count: 20, total: 780000 },
          ],
          monthly_trends: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            revenue: Math.floor(Math.random() * 1000000) + 500000,
            collection: Math.floor(Math.random() * 800000) + 400000,
          })),
          anomalies: {
            empty_invoice_number: 3,
            empty_client: 5,
            empty_revenue: 7,
            duplicates: 2,
          },
          applied_filters: filters,
        };
      }

      return handleKpiApiError(error, "DCISIT revenue");
    }
  },

  // Siège Revenue KPIs
  getSiegeRevenueKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year && filters.year !== "") {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.department && filters.department !== "") {
        queryParams.append("department", filters.department);
      }
      if (filters.product && filters.product !== "") {
        queryParams.append("product", filters.product);
      }

      console.log("[DEBUG] Fetching Siège Revenue with params:", filters);
      const apiUrl = `/data/kpi/revenue/siege/?${queryParams.toString()}`;
      console.log("[DEBUG] API URL:", apiUrl);

      const response = await api.get(apiUrl);
      console.log("[DEBUG] Siège Revenue Response:", response.data);

      return response.data;
    } catch (error) {
      console.error("[DEBUG] Error in getSiegeRevenueKPIs:", error);

      // In development mode with connection issues, provide mock data
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using mock data for Siège revenue");
        // Generate simple mock data structure
        return {
          summary: {
            total_revenue: 12450000,
            total_collection: 9850000,
            collection_rate: 79.1,
            journal_count: 185,
            etat_count: 140,
          },
          departments: [
            {
              name: "Direction Commerciale Corporate",
              count: 60,
              total: 4800000,
            },
            { name: "Direction Grands Comptes", count: 45, total: 3600000 },
            { name: "Direction Marketing", count: 35, total: 2100000 },
            { name: "Direction Stratégie", count: 25, total: 1200000 },
            { name: "Direction Financière", count: 20, total: 750000 },
          ],
          products: [
            { name: "Specialized Line", count: 55, total: 5500000 },
            { name: "LTE", count: 45, total: 3800000 },
            { name: "VOIP Corporate", count: 35, total: 1800000 },
            { name: "FTTx Corporate", count: 30, total: 1350000 },
          ],
          monthly_trends: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            revenue: Math.floor(Math.random() * 1200000) + 900000,
            collection: Math.floor(Math.random() * 1000000) + 700000,
          })),
          anomalies: {
            empty_invoice_number: 4,
            empty_client: 7,
            empty_revenue: 5,
            duplicates: 3,
          },
          applied_filters: filters,
        };
      }

      return handleKpiApiError(error, "Siège revenue");
    }
  },

  // DOT Corporate Revenue KPIs
  getDOTCorporateRevenueKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year && filters.year !== "") {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.department && filters.department !== "") {
        queryParams.append("department", filters.department);
      }
      if (filters.product && filters.product !== "") {
        queryParams.append("product", filters.product);
      }

      console.log(
        "[DEBUG] Fetching DOT Corporate Revenue with params:",
        filters
      );
      const apiUrl = `/data/kpi/revenue/dot-corporate/?${queryParams.toString()}`;
      console.log("[DEBUG] API URL:", apiUrl);

      const response = await api.get(apiUrl);
      console.log("[DEBUG] DOT Corporate Revenue Response:", response.data);

      return response.data;
    } catch (error) {
      console.error("[DEBUG] Error in getDOTCorporateRevenueKPIs:", error);

      // In development mode with connection issues, provide mock data
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using mock data for DOT Corporate revenue");
        // Generate simple mock data structure
        return {
          summary: {
            total_revenue: 9320000,
            total_collection: 7250000,
            collection_rate: 77.8,
            journal_count: 180,
            etat_count: 135,
          },
          departments: [
            { name: "DOT Service Corporate", count: 65, total: 4250000 },
            { name: "DOT Direction Technique", count: 55, total: 3150000 },
            { name: "DOT Commercial", count: 60, total: 1920000 },
          ],
          products: [
            { name: "VOIP DOT", count: 50, total: 3500000 },
            { name: "FTTx DOT", count: 45, total: 2600000 },
            { name: "L2VPN", count: 40, total: 1800000 },
            { name: "Internet Corporate", count: 45, total: 1420000 },
          ],
          monthly_trends: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            revenue: Math.floor(Math.random() * 1200000) + 700000,
            collection: Math.floor(Math.random() * 1000000) + 600000,
          })),
          anomalies: {
            empty_invoice_number: 15,
            empty_client: 12,
            empty_revenue: 8,
            duplicates: 5,
          },
          applied_filters: {
            year: filters.year || "",
            month: filters.month || "",
            department: filters.department || "",
            product: filters.product || "",
          },
        };
      }

      throw error;
    }
  },

  // DOT Corporate Collection KPIs
  getDOTCorporateCollectionKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year && filters.year !== "") {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.department && filters.department !== "") {
        queryParams.append("department", filters.department);
      }
      if (filters.product && filters.product !== "") {
        queryParams.append("product", filters.product);
      }

      console.log(
        "[DEBUG] Fetching DOT Corporate Collection with params:",
        filters
      );
      const apiUrl = `/data/kpi/collections/dot-corporate/?${queryParams.toString()}`;
      console.log("[DEBUG] API URL:", apiUrl);

      const response = await api.get(apiUrl);
      console.log("[DEBUG] DOT Corporate Collection Response:", response.data);

      return response.data;
    } catch (error) {
      console.error("[DEBUG] Error in getDOTCorporateCollectionKPIs:", error);

      // In development mode with connection issues, provide mock data
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using mock data for DOT Corporate collection");
        // Generate simple mock data structure
        return {
          summary: {
            total_collection: 8250000,
            total_invoiced: 10320000,
            collection_rate: 79.9,
            etat_count: 165,
            journal_count: 195,
          },
          departments: [
            { name: "DOT Service Corporate", count: 70, total: 3850000 },
            { name: "DOT Direction Technique", count: 60, total: 2950000 },
            { name: "DOT Commercial", count: 55, total: 1450000 },
          ],
          products: [
            { name: "VOIP DOT", count: 55, total: 3200000 },
            { name: "FTTx DOT", count: 50, total: 2400000 },
            { name: "L2VPN", count: 45, total: 1500000 },
            { name: "Internet Corporate", count: 40, total: 1150000 },
          ],
          monthly_trends: Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            collection: Math.floor(Math.random() * 800000) + 600000,
            invoiced: Math.floor(Math.random() * 1000000) + 700000,
          })),
          aging: [
            { period: "Current", amount: 2100000 },
            { period: "1-30 days", amount: 1450000 },
            { period: "31-60 days", amount: 920000 },
            { period: "61-90 days", amount: 670000 },
            { period: "91-180 days", amount: 530000 },
            { period: "181-365 days", amount: 340000 },
            { period: "> 365 days", amount: 260000 },
          ],
          anomalies: {
            empty_invoice_number: 12,
            empty_client: 9,
            zero_amounts: 6,
            duplicates: 4,
          },
          applied_filters: {
            year: filters.year || "",
            month: filters.month || "",
            department: filters.department || "",
            product: filters.product || "",
          },
        };
      }

      throw error;
    }
  },

  // Corporate Park KPIs
  getCorporateParkKPIs: async (filters = {}) => {
    try {
      console.log("[DEBUG] Initial filters received:", filters);
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Handle basic parameters
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }
      if (filters.exclude_dot && filters.exclude_dot.length > 0) {
        queryParams.append("exclude_dot", filters.exclude_dot.join(","));
      }
      if (filters.include_creation_date) {
        queryParams.append(
          "include_creation_date",
          filters.include_creation_date
        );
      }

      // Debug Actel code handling
      console.log("[DEBUG] Checking actelCode:", {
        hasActelCode: "actelCode" in filters,
        actelCodeValue: filters.actelCode,
        isArray: Array.isArray(filters.actelCode),
        length: filters.actelCode ? filters.actelCode.length : 0,
      });

      // Handle Actel codes - process both actelCode and actel_code
      const actelCodes = filters.actelCode || filters.actel_code;
      if (actelCodes && Array.isArray(actelCodes)) {
        console.log("[DEBUG] Processing Actel codes:", actelCodes);
        actelCodes.forEach((code) => {
          queryParams.append("actel_code", code);
        });
      }

      // Handle array parameters
      const arrayParams = {
        telecom_type: "telecom_type",
        offer_name: "offer_name",
        customer_l2: "customer_l2",
        customer_l3: "customer_l3",
        subscriber_status: "subscriber_status",
      };

      Object.entries(arrayParams).forEach(([filterKey, paramKey]) => {
        if (filters[filterKey] && Array.isArray(filters[filterKey])) {
          filters[filterKey].forEach((value) => {
            if (value) queryParams.append(paramKey, value);
          });
        }
      });

      // Debug final query parameters
      console.log("[DEBUG] Final query parameters:", {
        rawString: queryParams.toString(),
        paramsList: Array.from(queryParams.entries()),
      });

      const response = await api.get(
        `/data/kpi/corporate-park/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("[DEBUG] Error in getCorporateParkKPIs:", error);
      return handleKpiApiError(error, "corporate park");
    }
  },

  // Periodic Revenue KPIs
  getPeriodicRevenueKPIs: async (params = {}) => {
    try {
      console.log("[DEBUG] Fetching Periodic Revenue with params:", params);

      // Convert array parameters to the format expected by the backend
      const queryParams = new URLSearchParams();

      // Handle dot parameter
      if (params.dot) {
        if (Array.isArray(params.dot)) {
          params.dot.forEach((dot) => queryParams.append("dot", dot));
        } else {
          queryParams.append("dot", params.dot);
        }
      }

      // Handle product parameter
      if (params.product) {
        if (Array.isArray(params.product)) {
          params.product.forEach((product) =>
            queryParams.append("product", product)
          );
        } else {
          queryParams.append("product", params.product);
        }
      }

      // Handle operation parameter
      if (params.operation) {
        if (Array.isArray(params.operation)) {
          params.operation.forEach((operation) =>
            queryParams.append("operation", operation)
          );
        } else {
          queryParams.append("operation", params.operation);
        }
      }

      const apiUrl = `/data/kpi/ca-periodique/?${queryParams.toString()}`;
      console.log("[DEBUG] API URL:", apiUrl);

      const response = await api.get(apiUrl);
      console.log("[DEBUG] Periodic Revenue Response:", response.data);

      // Transform the backend response to match the frontend expectations
      const responseData = response.data;

      // Format the data for the UI
      const formattedData = {
        // Total revenue values
        total: responseData.total_revenue?.total_amount || 0,
        pre_tax: responseData.total_revenue?.total_pre_tax || 0,
        tax: responseData.total_revenue?.total_tax || 0,
        discount: responseData.total_revenue?.total_discount || 0,

        // Components breakdown
        main_periodic:
          responseData.breakdown_by_component?.periodique?.total_amount || 0,
        dnt: responseData.breakdown_by_component?.dnt?.total_amount || 0,
        rfd: responseData.breakdown_by_component?.rfd?.total_amount || 0,
        cnt: responseData.breakdown_by_component?.cnt?.total_amount || 0,

        // Breakdowns for charts
        by_dot: responseData.revenue_by_dot?.reduce((acc, item) => {
          if (item.dot && item.total) {
            acc[item.dot] = item.total;
          }
          return acc;
        }, {}),

        // Convert to array format expected by charts
        by_product:
          responseData.revenue_by_product?.map((item) => ({
            product: item.product || "Unknown",
            total: item.total || 0,
            pre_tax: item.pre_tax || item.total || 0,
            tax: item.tax || 0,
          })) || [],

        // Add operations data for the Operations tab
        by_operation:
          responseData.revenue_by_operation?.map((item) => ({
            operation: item.operation || "Unknown",
            total: item.total || 0,
            pre_tax: item.pre_tax || 0,
            tax: item.tax || 0,
          })) || [],

        // Include counts for debugging
        counts: responseData.counts,

        // Include anomalies
        anomalies: responseData.anomalies,
      };

      console.log("[DEBUG] Formatted Periodic Revenue Data:", formattedData);
      return formattedData;
    } catch (error) {
      console.error("[DEBUG] Error in getPeriodicRevenueKPIs:", error);

      // For specific revenue types, use the special structure from mock data
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using mock data for periodic revenue");
        return {
          total: mockData.kpiData.revenue.periodic,
          by_dot: Object.entries(mockData.kpiData.revenue.by_dot || {}).reduce(
            (acc, [key, value]) => {
              acc[key] = value * 0.6; // Simulate that periodic is ~60% of revenue
              return acc;
            },
            {}
          ),
          growth: mockData.kpiData.revenue.growth * 0.8,
        };
      }
      return handleKpiApiError(error, "periodic revenue KPIs");
    }
  },

  // Non-Periodic Revenue KPIs
  getNonPeriodicRevenueKPIs: async (filters = {}) => {
    // Set a maximum number of retries
    const MAX_RETRIES = 2;
    let retryCount = 0;
    let lastError = null;

    // Retry loop
    while (retryCount <= MAX_RETRIES) {
      try {
        // Build query parameters
        const queryParams = new URLSearchParams();

        // Only add parameters that have values
        if (filters.year) {
          queryParams.append("year", filters.year);
        }
        if (filters.dot) {
          if (Array.isArray(filters.dot)) {
            filters.dot.forEach((dot) => queryParams.append("dot", dot));
          } else {
            queryParams.append("dot", filters.dot);
          }
        }
        if (filters.product) {
          if (Array.isArray(filters.product)) {
            filters.product.forEach((product) =>
              queryParams.append("product", product)
            );
          } else {
            queryParams.append("product", filters.product);
          }
        }
        if (filters.sale_type) {
          if (Array.isArray(filters.sale_type)) {
            filters.sale_type.forEach((saleType) =>
              queryParams.append("sale_type", saleType)
            );
          } else {
            queryParams.append("sale_type", filters.sale_type);
          }
        }
        if (filters.channel) {
          if (Array.isArray(filters.channel)) {
            filters.channel.forEach((channel) =>
              queryParams.append("channel", channel)
            );
          } else {
            queryParams.append("channel", filters.channel);
          }
        }

        // Include entity details for detailed KPIs
        queryParams.append("include_entity_details", "true");

        console.log(
          "[DEBUG] KPI Service - Non-Periodic filter params:",
          queryParams.toString()
        );

        // Log the API URL being called
        const apiUrl = `/data/kpi/ca-non-periodique/?${queryParams.toString()}`;
        console.log("[DEBUG] API Request URL:", apiUrl);

        // Set a timeout for the request (10 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          // Make the API request with timeout
          const response = await api.get(apiUrl, {
            signal: controller.signal,
          });

          // Clear the timeout since request completed
          clearTimeout(timeoutId);

          // Log the raw API response for debugging
          console.log("[DEBUG] Raw API Response:", response);
          console.log(
            "[DEBUG] KPI Service - Non-Periodic response data:",
            response.data
          );

          // Format the response to match what the frontend expects
          // Check if we have the new response format or not
          if (response.data && response.data.summary) {
            // Transform to expected format
            const formattedData = {
              total_revenue: response.data.summary.total_revenue.total || 0,
              pre_tax: response.data.summary.total_revenue.pre_tax || 0,
              tax: response.data.summary.total_revenue.tax || 0,
              total_records: response.data.summary.total_records || 0,
              anomalies: response.data.summary.anomaly_stats || {},
              by_product: response.data.by_product || [],
              by_channel: response.data.by_channel || [],
              by_sale_type: response.data.by_sale_type || [],
              monthly_trends: response.data.monthly_trends || [],
              applied_filters: response.data.summary.applied_filters || {},
            };

            console.log("[DEBUG] Formatted response data:", formattedData);
            return formattedData;
          }

          // Return the original response if it doesn't match the expected structure
          return response.data;
        } catch (timeoutError) {
          // Clear the timeout to prevent memory leaks
          clearTimeout(timeoutId);

          // Handle timeout separately
          if (timeoutError.name === "AbortError") {
            console.error("[DEBUG] API Request timed out");
            throw new Error("Request timed out. Please try again.");
          }

          // Re-throw other errors
          throw timeoutError;
        }
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (retryCount < MAX_RETRIES) {
          console.warn(
            `[DEBUG] API Request failed, retrying (${
              retryCount + 1
            }/${MAX_RETRIES})...`
          );
          retryCount++;

          // Wait before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount)
          );
        } else {
          // Log error after all retries failed
          console.error("[DEBUG] API Error Details after all retries:", {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data,
          });

          // We've exhausted all retries
          break;
        }
      }
    }

    // If we get here, all retries failed
    return handleKpiApiError(lastError, "non-periodic revenue");
  },

  // Helper method to generate mock entity data for development
  generateEntityMockData: (filters = {}) => {
    const products = [
      "VOIP",
      "Modem",
      "LTE",
      "FTTx",
      "ADSL",
      "Specialized Line",
    ];
    const channels = ["9", "eSpace Client", "ATPOST", "Agence"];

    // Filter products and channels if filters are provided
    const filteredProducts =
      filters.product && filters.product.length > 0
        ? products.filter((p) => filters.product.includes(p))
        : products;

    const filteredChannels =
      filters.channel && filters.channel.length > 0
        ? channels.filter((c) => filters.channel.includes(c))
        : channels;

    const entityData = [];

    // Generate product entity data
    filteredProducts.forEach((product) => {
      entityData.push({
        name: product,
        type: "product",
        total_revenue: Math.floor(Math.random() * 5000000) + 500000,
        growth: Math.random() * 20 - 10, // -10% to +10%
        avg_transaction: Math.floor(Math.random() * 10000) + 1000,
        transaction_count: Math.floor(Math.random() * 1000) + 100,
        tax_percentage: Math.random() * 0.2 + 0.1, // 10% to 30%
      });
    });

    // Generate channel entity data
    filteredChannels.forEach((channel) => {
      entityData.push({
        name: channel,
        type: "channel",
        total_revenue: Math.floor(Math.random() * 3000000) + 300000,
        growth: Math.random() * 20 - 10, // -10% to +10%
        avg_transaction: Math.floor(Math.random() * 8000) + 800,
        transaction_count: Math.floor(Math.random() * 800) + 80,
        conversion_rate: Math.random() * 0.4 + 0.3, // 30% to 70%
      });
    });

    return entityData;
  },

  // Special Revenue KPIs (DNT, RFD, CNT)
  getSpecialRevenueKPIs: async (type = "dnt", params = {}) => {
    try {
      const queryParams = { ...params, type };
      const response = await api.get("/data/kpi/special-revenue/", {
        params: queryParams,
      });
      return response.data;
    } catch (error) {
      // For special revenue types, use the specific mock data
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn(`Using mock data for ${type.toUpperCase()} revenue`);
        const specialRevenue =
          (mockData.kpiData.revenue.special &&
            mockData.kpiData.revenue.special[type.toLowerCase()]) ||
          0;
        return {
          total: specialRevenue,
          by_dot: Object.entries(mockData.kpiData.revenue.by_dot || {}).reduce(
            (acc, [key, value]) => {
              acc[key] = value * 0.1; // Simulate that each special type is ~10% of revenue
              return acc;
            },
            {}
          ),
          growth: mockData.kpiData.revenue.growth * 0.5,
        };
      }
      return handleKpiApiError(error, `${type.toUpperCase()} revenue`);
    }
  },

  // Helper method to get all revenue-related KPIs
  getAllRevenueKPIs: async (params = {}) => {
    try {
      const [
        revenue,
        periodicRevenue,
        nonPeriodicRevenue,
        dntRevenue,
        rfdRevenue,
        cntRevenue,
      ] = await Promise.all([
        kpiService.getRevenueKPIs(params),
        kpiService.getPeriodicRevenueKPIs(params),
        kpiService.getNonPeriodicRevenueKPIs(params),
        kpiService.getSpecialRevenueKPIs("dnt", params),
        kpiService.getSpecialRevenueKPIs("rfd", params),
        kpiService.getSpecialRevenueKPIs("cnt", params),
      ]);

      return {
        revenue,
        periodicRevenue,
        nonPeriodicRevenue,
        specialRevenue: {
          dnt: dntRevenue,
          rfd: rfdRevenue,
          cnt: cntRevenue,
        },
      };
    } catch (error) {
      console.error("Error fetching all revenue KPIs:", error);

      // In development, return a complete mock structure if any API fails
      if (isDevelopment()) {
        console.warn("Using complete mock data for all revenue KPIs");
        return {
          revenue: mockData.kpiData.revenue,
          periodicRevenue: {
            total: mockData.kpiData.revenue.periodic,
            by_dot: Object.entries(
              mockData.kpiData.revenue.by_dot || {}
            ).reduce((acc, [key, value]) => {
              acc[key] = value * 0.6;
              return acc;
            }, {}),
            growth: mockData.kpiData.revenue.growth * 0.8,
          },
          nonPeriodicRevenue: {
            total: mockData.kpiData.revenue.non_periodic,
            by_dot: Object.entries(
              mockData.kpiData.revenue.by_dot || {}
            ).reduce((acc, [key, value]) => {
              acc[key] = value * 0.4;
              return acc;
            }, {}),
            growth: mockData.kpiData.revenue.growth * 1.2,
          },
          specialRevenue: {
            dnt: {
              total:
                (mockData.kpiData.revenue.special &&
                  mockData.kpiData.revenue.special.dnt) ||
                0,
              by_dot: Object.entries(
                mockData.kpiData.revenue.by_dot || {}
              ).reduce((acc, [key, value]) => {
                acc[key] = value * 0.1;
                return acc;
              }, {}),
            },
            rfd: {
              total:
                (mockData.kpiData.revenue.special &&
                  mockData.kpiData.revenue.special.rfd) ||
                0,
              by_dot: Object.entries(
                mockData.kpiData.revenue.by_dot || {}
              ).reduce((acc, [key, value]) => {
                acc[key] = value * 0.1;
                return acc;
              }, {}),
            },
            cnt: {
              total:
                (mockData.kpiData.revenue.special &&
                  mockData.kpiData.revenue.special.cnt) ||
                0,
              by_dot: Object.entries(
                mockData.kpiData.revenue.by_dot || {}
              ).reduce((acc, [key, value]) => {
                acc[key] = value * 0.1;
                return acc;
              }, {}),
            },
          },
        };
      }

      throw error;
    }
  },

  // NGBSS Collection KPIs
  getNGBSSCollectionKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }

      // Only add dot parameter if it has a value
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      // Add additional parameters if provided
      if (filters.compare_with_previous) {
        queryParams.append(
          "compare_with_previous",
          filters.compare_with_previous
        );
      }
      if (filters.compare_with_objectives) {
        queryParams.append(
          "compare_with_objectives",
          filters.compare_with_objectives
        );
      }
      if (filters.include_aging_data) {
        queryParams.append("include_aging_data", filters.include_aging_data);
      }
      if (filters.include_payment_behavior) {
        queryParams.append(
          "include_payment_behavior",
          filters.include_payment_behavior
        );
      }
      if (filters.include_collection_rate_details) {
        queryParams.append(
          "include_collection_rate_details",
          filters.include_collection_rate_details
        );
      }
      if (filters.include_monthly_comparison) {
        queryParams.append(
          "include_monthly_comparison",
          filters.include_monthly_comparison
        );
      }

      // Access the signal for cancellation if provided
      const options = {};
      if (filters.signal) {
        options.signal = filters.signal;
      }

      console.log(
        `Fetching NGBSS collection data with URL: /data/kpi/ngbss-collection/?${queryParams.toString()}`
      );

      const response = await api.get(
        `/data/kpi/ngbss-collection/?${queryParams.toString()}`,
        options
      );

      console.log("NGBSS collection API response:", response);
      return response;
    } catch (error) {
      console.error("Error in getNGBSSCollectionKPIs:", error);

      // If in development mode and API is unavailable, generate mock data from collection
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using mock data for NGBSS collection");
        return {
          data: {
            // Basic collection data
            total_collected: mockData.kpiData.collection.total_collected,
            total_invoiced: mockData.kpiData.collection.total_invoiced,
            total_objective: mockData.kpiData.collection.total_objective,
            total_current_year: mockData.kpiData.collection.total_current_year,
            total_previous_year:
              mockData.kpiData.collection.total_previous_year,
            collection_rate: mockData.kpiData.collection.collection_rate,
            achievement_percentage:
              mockData.kpiData.collection.achievement_percentage,
            change_percentage: mockData.kpiData.collection.change_percentage,

            // Collections by organization
            collection_by_dot: mockData.kpiData.collection.collection_by_dot,

            // Collections by product
            collection_by_product:
              mockData.kpiData.collection.collection_by_product,

            // Time series data
            monthly_trends: mockData.kpiData.collection.monthly_trends,

            // Aging of receivables
            aging_data: mockData.kpiData.collection.aging_data,

            // Payment behavior
            payment_behavior: mockData.kpiData.collection.payment_behavior,

            // Collection by segment/method
            collection_by_segment:
              mockData.kpiData.collection.collection_by_segment,
            collection_by_method:
              mockData.kpiData.collection.collection_by_method,

            // Performance rankings
            top_performers: mockData.kpiData.collection.top_performers,
            underperformers: mockData.kpiData.collection.underperformers,

            // Efficiency metrics
            efficiency_metrics: mockData.kpiData.collection.efficiency_metrics,
          },
        };
      }

      return handleKpiApiError(error, "ngbss collection");
    }
  },

  // Unfinished Invoice KPIs
  getUnfinishedInvoiceKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Only add parameters that have values
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }
      if (filters.status) {
        queryParams.append("status", filters.status);
      }
      if (filters.min_days) {
        queryParams.append("min_days", filters.min_days);
      }
      if (filters.max_days) {
        queryParams.append("max_days", filters.max_days);
      }

      const response = await api.get(
        `/data/kpi/unfinished-invoice/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      // Generate mock data for unfinished invoices in development mode
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using mock data for unfinished invoices");

        // Generate sample data for unfinished invoices
        const mockUnfinishedInvoices = {
          total_count: 42,
          by_status: {
            pending: 18,
            processing: 12,
            failed: 7,
            partial: 5,
          },
          by_age: {
            "1-7 days": 15,
            "8-30 days": 20,
            "31+ days": 7,
          },
          by_dot: Object.fromEntries(
            mockData.kpiData.revenue.by_dot
              ? Object.keys(mockData.kpiData.revenue.by_dot).map((dot) => [
                  dot,
                  Math.floor(Math.random() * 10),
                ])
              : []
          ),
          recent_invoices: Array(5)
            .fill(null)
            .map((_, i) => ({
              id: i + 1,
              invoice_number: `INV-${2023}-${String(i + 100).padStart(3, "0")}`,
              status: ["pending", "processing", "failed", "partial"][
                Math.floor(Math.random() * 4)
              ],
              days_open: Math.floor(Math.random() * 60) + 1,
              dot:
                Object.keys(mockData.kpiData.revenue.by_dot || {}).length > 0
                  ? Object.keys(mockData.kpiData.revenue.by_dot)[
                      Math.floor(
                        Math.random() *
                          Object.keys(mockData.kpiData.revenue.by_dot).length
                      )
                    ]
                  : "DOT1",
              upload_date: new Date(Date.now() - Math.random() * 5000000000)
                .toISOString()
                .split("T")[0],
            })),
        };

        return mockUnfinishedInvoices;
      }

      return handleKpiApiError(error, "unfinished invoice");
    }
  },

  // Get list of DOTs
  getDots: async () => {
    try {
      console.log("[DEBUG] Fetching DOTs");
      const response = await api.get("/data/dots/");
      console.log("[DEBUG] DOTs response:", response.data);

      // Extract the dots array from the response
      let dotsArray = [];

      if (Array.isArray(response.data)) {
        dotsArray = response.data;
      } else if (response.data?.dots && Array.isArray(response.data.dots)) {
        dotsArray = response.data.dots;
      } else {
        console.warn(
          "[DEBUG] DOTs response is not in expected format:",
          response.data
        );
        return [];
      }

      // Normalize the dots array to ensure each item is an object with id, name, and code properties
      return dotsArray.map((dot) => {
        // If dot is already an object with id property, use it
        if (typeof dot === "object" && dot !== null) {
          // Ensure the object has all required properties
          return {
            id: dot.id || dot.code || JSON.stringify(dot),
            name: dot.name || dot.code || dot.id || JSON.stringify(dot),
            code: dot.code || dot.id || "",
          };
        }

        // If dot is a string, convert it to object format
        if (typeof dot === "string") {
          return {
            id: dot,
            name: dot,
            code: dot,
          };
        }

        // Fallback for unexpected format
        const stringValue = String(dot);
        return {
          id: stringValue,
          name: stringValue,
          code: stringValue,
        };
      });
    } catch (error) {
      console.error("[DEBUG] Error fetching DOTs:", error);
      // Return empty array in case of error
      return [];
    }
  },

  // Fetch detailed corporate park data for table view
  getParcCorporateDetails: async (params) => {
    try {
      // Use the /data/parc-corporate/ endpoint to get detailed records
      const response = await api.get("/data/parc-corporate/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching corporate park details:", error);
      throw error;
    }
  },

  // Fetch corporate park preview data with filters applied
  getCorporateParkPreview: async (params = {}, page = 1, pageSize = 50) => {
    try {
      const queryParams = new URLSearchParams();

      // Add pagination parameters
      queryParams.append("page", params.page || page);
      queryParams.append("page_size", params.page_size || pageSize);

      // Add filters
      if (params.year) {
        queryParams.append("year", params.year);
      }

      if (params.month) {
        queryParams.append("month", params.month);
      }

      // Handle DOT filters
      if (params.dot && Array.isArray(params.dot)) {
        params.dot.forEach((dot) => queryParams.append("dot", dot));
      }

      // Handle telecom type filter
      if (params.telecom_type && Array.isArray(params.telecom_type)) {
        params.telecom_type.forEach((type) =>
          queryParams.append("telecom_type", type)
        );
      }

      // Handle offer name filter
      if (params.offer_name && Array.isArray(params.offer_name)) {
        params.offer_name.forEach((name) =>
          queryParams.append("offer_name", name)
        );
      }

      // Handle customer L2 filter
      if (params.customer_l2 && Array.isArray(params.customer_l2)) {
        params.customer_l2.forEach((code) =>
          queryParams.append("customer_l2", code)
        );
      }

      // Handle customer L3 filter
      if (params.customer_l3 && Array.isArray(params.customer_l3)) {
        params.customer_l3.forEach((code) =>
          queryParams.append("customer_l3", code)
        );
      }

      // Handle subscriber status filter
      if (params.subscriber_status && Array.isArray(params.subscriber_status)) {
        params.subscriber_status.forEach((status) =>
          queryParams.append("subscriber_status", status)
        );
      }

      // Handle Actel code filter
      if (params.actelCode && Array.isArray(params.actelCode)) {
        params.actelCode.forEach((code) => {
          console.log("Appending actel_code:", code);
          queryParams.append("actel_code", code);
        });
      }

      console.log("Fetching preview data with params:", queryParams.toString());
      const response = await api.get(
        `/data/preview/corporate-park/?${queryParams.toString()}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching corporate park preview data:", error);
      throw error;
    }
  },

  async getCorporateParkYears() {
    try {
      console.log("[KPI DEBUG] Fetching corporate park years");
      const response = await api.get("/data/kpi/corporate-park/years/");
      console.log("[KPI DEBUG] Years response:", response.data);
      return response.data.years;
    } catch (error) {
      console.error("[KPI DEBUG] Error fetching years:", error);
      handleKpiApiError(error);
      return [];
    }
  },
};

export default kpiService;
