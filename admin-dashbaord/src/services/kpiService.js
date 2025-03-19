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

  // Corporate Park KPIs
  getCorporateParkKPIs: async (filters = {}) => {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams();

      // Add parameters that match what the component sends
      if (filters.state && filters.state !== "") {
        queryParams.append("state", filters.state);
      }
      if (filters.telecom_type && filters.telecom_type !== "") {
        queryParams.append("telecom_type", filters.telecom_type);
      }
      if (filters.offer_name && filters.offer_name !== "") {
        queryParams.append("offer_name", filters.offer_name);
      }
      // For backward compatibility, still support year/month/dot
      if (filters.year) {
        queryParams.append("year", filters.year);
      }
      if (filters.month && filters.month !== "") {
        queryParams.append("month", filters.month);
      }
      if (filters.dot && filters.dot !== "") {
        queryParams.append("dot", filters.dot);
      }

      console.log("Fetching corporate park data with filters:", filters);
      console.log("Query parameters:", queryParams.toString());

      const response = await api.get(
        `/data/kpi/corporate-park/?${queryParams.toString()}`
      );

      console.log("Corporate park data response:", response.data);
      return response.data;
    } catch (error) {
      return handleKpiApiError(error, "corporate park");
    }
  },

  // Periodic Revenue KPIs
  getPeriodicRevenueKPIs: async (params = {}) => {
    try {
      const response = await api.get("/data/kpi/periodic-revenue/", { params });
      return response.data;
    } catch (error) {
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
  getNonPeriodicRevenueKPIs: async (params = {}) => {
    try {
      const response = await api.get("/data/kpi/non-periodic-revenue/", {
        params,
      });
      return response.data;
    } catch (error) {
      // For specific revenue types, use the special structure from mock data
      if (
        isDevelopment() &&
        (!error.response || error.response.status >= 500)
      ) {
        console.warn("Using mock data for non-periodic revenue");
        return {
          total: mockData.kpiData.revenue.non_periodic,
          by_dot: Object.entries(mockData.kpiData.revenue.by_dot || {}).reduce(
            (acc, [key, value]) => {
              acc[key] = value * 0.4; // Simulate that non-periodic is ~40% of revenue
              return acc;
            },
            {}
          ),
          growth: mockData.kpiData.revenue.growth * 1.2,
        };
      }
      return handleKpiApiError(error, "non-periodic revenue KPIs");
    }
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
};

// Helper function to generate month data for mock data
const generatePastMonths = (count) => {
  const result = [];
  const currentDate = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const pastDate = new Date(currentDate);
    pastDate.setMonth(currentDate.getMonth() - i);

    result.push({
      month: pastDate.toLocaleString("default", { month: "long" }),
      year: pastDate.getFullYear(),
    });
  }

  return result;
};

export default kpiService;
