import api from "./api";

// Mock data for dashboard overview
const mockDashboardOverview = {
  users: {
    total: 25,
    active: 20,
    disabled: 5,
  },
  files: {
    total: 150,
    size: "2.5 GB",
  },
  anomalies: {
    total: 12,
    open: 5,
  },
  dots: {
    count: 8,
    list: ["DOT1", "DOT2", "DOT3", "DOT4", "DOT5", "DOT6", "DOT7", "DOT8"],
  },
  data: {
    journal_ventes: 1250,
    etat_facture: 980,
    parc_corporate: 750,
    creances_ngbss: 420,
    total_records: 3400,
  },
  recent_uploads: [
    {
      invoice_number: "INV-001",
      upload_date: new Date().toISOString(),
      status: "completed",
      uploaded_by__email: "admin@example.com",
    },
    {
      invoice_number: "INV-002",
      upload_date: new Date(Date.now() - 86400000).toISOString(),
      status: "processing",
      uploaded_by__email: "user@example.com",
    },
    {
      invoice_number: "INV-003",
      upload_date: new Date(Date.now() - 172800000).toISOString(),
      status: "failed",
      uploaded_by__email: "admin@example.com",
    },
  ],
};

// Mock data for map visualization
const mockMapData = {
  Adrar: {
    population: 450000,
    revenue: 1200000,
    users: 120,
    files: 45,
    anomalies: 12,
  },
  Chlef: {
    population: 1200000,
    revenue: 3500000,
    users: 230,
    files: 78,
    anomalies: 23,
  },
  Laghouat: {
    population: 520000,
    revenue: 1800000,
    users: 150,
    files: 52,
    anomalies: 18,
  },
  "Oum El Bouaghi": {
    population: 650000,
    revenue: 1900000,
    users: 140,
    files: 48,
    anomalies: 15,
  },
  Batna: {
    population: 1350000,
    revenue: 4200000,
    users: 310,
    files: 115,
    anomalies: 42,
  },
  Bejaia: {
    population: 950000,
    revenue: 3100000,
    users: 280,
    files: 95,
    anomalies: 32,
  },
  Biskra: {
    population: 780000,
    revenue: 2500000,
    users: 180,
    files: 65,
    anomalies: 24,
  },
  Bechar: {
    population: 270000,
    revenue: 950000,
    users: 85,
    files: 32,
    anomalies: 11,
  },
  Blida: {
    population: 1100000,
    revenue: 3800000,
    users: 320,
    files: 110,
    anomalies: 38,
  },
  Bouira: {
    population: 695000,
    revenue: 2100000,
    users: 160,
    files: 58,
    anomalies: 19,
  },
  Tamanrasset: {
    population: 225000,
    revenue: 780000,
    users: 65,
    files: 28,
    anomalies: 9,
  },
  Tebessa: {
    population: 650000,
    revenue: 1850000,
    users: 145,
    files: 52,
    anomalies: 17,
  },
  Tlemcen: {
    population: 950000,
    revenue: 2900000,
    users: 210,
    files: 75,
    anomalies: 28,
  },
  Tiaret: {
    population: 850000,
    revenue: 2400000,
    users: 175,
    files: 62,
    anomalies: 21,
  },
  "Tizi Ouzou": {
    population: 1100000,
    revenue: 3600000,
    users: 290,
    files: 98,
    anomalies: 35,
  },
  Alger: {
    population: 3500000,
    revenue: 12000000,
    users: 850,
    files: 320,
    anomalies: 95,
  },
  Djelfa: {
    population: 1200000,
    revenue: 3200000,
    users: 220,
    files: 78,
    anomalies: 29,
  },
  Jijel: {
    population: 650000,
    revenue: 1950000,
    users: 155,
    files: 56,
    anomalies: 18,
  },
  Setif: {
    population: 1500000,
    revenue: 4500000,
    users: 340,
    files: 125,
    anomalies: 45,
  },
  Saida: {
    population: 330000,
    revenue: 1100000,
    users: 95,
    files: 35,
    anomalies: 12,
  },
  Skikda: {
    population: 900000,
    revenue: 2800000,
    users: 200,
    files: 72,
    anomalies: 26,
  },
  "Sidi Bel Abbès": {
    population: 600000,
    revenue: 1950000,
    users: 160,
    files: 58,
    anomalies: 19,
  },
  Annaba: {
    population: 640000,
    revenue: 2200000,
    users: 190,
    files: 68,
    anomalies: 23,
  },
  Guelma: {
    population: 480000,
    revenue: 1500000,
    users: 125,
    files: 45,
    anomalies: 16,
  },
  Constantine: {
    population: 950000,
    revenue: 3100000,
    users: 260,
    files: 92,
    anomalies: 31,
  },
  Medea: {
    population: 830000,
    revenue: 2350000,
    users: 170,
    files: 61,
    anomalies: 22,
  },
  Mostaganem: {
    population: 750000,
    revenue: 2250000,
    users: 165,
    files: 59,
    anomalies: 20,
  },
  Msila: {
    population: 990000,
    revenue: 2700000,
    users: 195,
    files: 70,
    anomalies: 25,
  },
  Mascara: {
    population: 780000,
    revenue: 2300000,
    users: 170,
    files: 61,
    anomalies: 21,
  },
  Ouargla: {
    population: 550000,
    revenue: 1900000,
    users: 155,
    files: 56,
    anomalies: 18,
  },
  Oran: {
    population: 1450000,
    revenue: 4800000,
    users: 380,
    files: 135,
    anomalies: 48,
  },
  "El Bayadh": {
    population: 240000,
    revenue: 850000,
    users: 75,
    files: 28,
    anomalies: 10,
  },
  Illizi: {
    population: 52000,
    revenue: 450000,
    users: 45,
    files: 18,
    anomalies: 6,
  },
  "Bordj Bou Arreridj": {
    population: 620000,
    revenue: 1850000,
    users: 150,
    files: 54,
    anomalies: 18,
  },
  Boumerdès: {
    population: 795000,
    revenue: 2400000,
    users: 180,
    files: 65,
    anomalies: 22,
  },
  "El Tarf": {
    population: 410000,
    revenue: 1300000,
    users: 110,
    files: 40,
    anomalies: 14,
  },
  Tindouf: {
    population: 58000,
    revenue: 480000,
    users: 48,
    files: 19,
    anomalies: 7,
  },
  Tissemsilt: {
    population: 295000,
    revenue: 950000,
    users: 85,
    files: 32,
    anomalies: 11,
  },
  "El Oued": {
    population: 650000,
    revenue: 1950000,
    users: 155,
    files: 56,
    anomalies: 19,
  },
  Khenchela: {
    population: 380000,
    revenue: 1250000,
    users: 105,
    files: 38,
    anomalies: 13,
  },
  "Souk Ahras": {
    population: 430000,
    revenue: 1350000,
    users: 115,
    files: 42,
    anomalies: 15,
  },
  Tipaza: {
    population: 590000,
    revenue: 1850000,
    users: 150,
    files: 54,
    anomalies: 18,
  },
  Mila: {
    population: 760000,
    revenue: 2200000,
    users: 165,
    files: 59,
    anomalies: 20,
  },
  "Ain Defla": {
    population: 770000,
    revenue: 2250000,
    users: 170,
    files: 61,
    anomalies: 21,
  },
  Naama: {
    population: 190000,
    revenue: 750000,
    users: 70,
    files: 26,
    anomalies: 9,
  },
  "Ain Temouchent": {
    population: 370000,
    revenue: 1200000,
    users: 100,
    files: 36,
    anomalies: 13,
  },
  Ghardaia: {
    population: 360000,
    revenue: 1250000,
    users: 105,
    files: 38,
    anomalies: 13,
  },
  Relizane: {
    population: 720000,
    revenue: 2100000,
    users: 160,
    files: 58,
    anomalies: 19,
  },
  Timimoun: {
    population: 140000,
    revenue: 650000,
    users: 65,
    files: 24,
    anomalies: 8,
  },
  "Bordj Badji Mokhtar": {
    population: 35000,
    revenue: 380000,
    users: 40,
    files: 16,
    anomalies: 5,
  },
  "Ouled Djellal": {
    population: 160000,
    revenue: 700000,
    users: 70,
    files: 26,
    anomalies: 9,
  },
  "Beni Abbes": {
    population: 45000,
    revenue: 420000,
    users: 45,
    files: 18,
    anomalies: 6,
  },
  "In Salah": {
    population: 55000,
    revenue: 450000,
    users: 48,
    files: 19,
    anomalies: 7,
  },
  "In Guezzam": {
    population: 25000,
    revenue: 320000,
    users: 35,
    files: 14,
    anomalies: 5,
  },
  Touggourt: {
    population: 165000,
    revenue: 720000,
    users: 72,
    files: 27,
    anomalies: 9,
  },
  Djanet: {
    population: 15000,
    revenue: 280000,
    users: 30,
    files: 12,
    anomalies: 4,
  },
  "El Mghair": {
    population: 150000,
    revenue: 680000,
    users: 68,
    files: 25,
    anomalies: 8,
  },
  "El Menia": {
    population: 65000,
    revenue: 480000,
    users: 50,
    files: 20,
    anomalies: 7,
  },
};

// Check if we're in development mode
const isDevelopment = () => {
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
const handleApiError = (error, serviceName, mockData) => {
  console.error(`Error in ${serviceName}:`, error);

  // Check if we have a specific error message from the backend
  let errorMessage = `Failed to fetch ${serviceName} data`;

  // Safely check for error response properties
  const errorResponse = error.response || {};
  const errorData = errorResponse.data || {};
  const statusCode = errorResponse.status;

  // Handle specific HTTP status codes
  if (statusCode) {
    switch (statusCode) {
      case 400:
        errorMessage = `Invalid request for ${serviceName}: ${
          errorData.error || "Bad request"
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
          errorData.error || `Error (${statusCode}) in ${serviceName}`;
    }
  }

  if (errorData.error) {
    console.error("Backend error:", errorData.error);

    if (errorData.details) {
      console.error("Error details:", errorData.details);
    }
  }

  // Only use mock data in development mode AND when the server is unreachable
  // (network error) or returns a server error (500+)
  const isServerError = statusCode && statusCode >= 500;
  const isNetworkError =
    !statusCode &&
    error.message &&
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

  // Dashboard overview data
  getDashboardOverview: async () => {
    try {
      const response = await api.get("/data/dashboard/overview/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "dashboard overview", mockDashboardOverview);
    }
  },

  // Map data for all wilayas
  getMapData: async (params = {}) => {
    try {
      const response = await api.get("/data/dashboard/map/", { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, "map data", mockMapData);
    }
  },

  // Get anomalies
  getAnomalies: async (params = {}) => {
    try {
      const response = await api.get("/data/anomalies/", { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, "anomalies", { results: [], count: 0 });
    }
  },

  // Get anomaly stats
  getAnomalyStats: async () => {
    try {
      const response = await api.get("/data/anomalies/stats/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "anomaly stats", {
        total: 0,
        open: 0,
        resolved: 0,
        by_type: [],
        by_severity: [],
      });
    }
  },

  // Resolve anomaly
  resolveAnomaly: async (anomalyId, resolution) => {
    try {
      const response = await api.post(`/data/anomalies/${anomalyId}/resolve/`, {
        resolution,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to resolve anomaly: ${error.message}`);
    }
  },

  // Trigger anomaly scan
  triggerAnomalyScan: async (params = {}) => {
    try {
      const response = await api.post("/data/anomalies/scan/", params);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to trigger anomaly scan: ${error.message}`);
    }
  },

  // Get DOT list
  getDOTs: async () => {
    try {
      const response = await api.get("/data/dots/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "DOT list", { results: [] });
    }
  },

  // Get recent uploads
  getRecentUploads: async (limit = 5) => {
    try {
      const response = await api.get("/data/invoices/", {
        params: { limit, ordering: "-upload_date" },
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, "recent uploads", { results: [] });
    }
  },

  // Get data counts
  getDataCounts: async () => {
    try {
      const response = await api.get("/data/counts/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "data counts", {
        journal_ventes: 0,
        etat_facture: 0,
        parc_corporate: 0,
        creances_ngbss: 0,
        total_records: 0,
      });
    }
  },

  // Get user stats
  getUserStats: async () => {
    try {
      const response = await api.get("/users/api/stats/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "user stats", {
        total: 0,
        active: 0,
        disabled: 0,
      });
    }
  },

  // Get file stats
  getFileStats: async () => {
    try {
      const response = await api.get("/data/files/stats/");
      return response.data;
    } catch (error) {
      return handleApiError(error, "file stats", {
        total: 0,
        size: "0 bytes",
      });
    }
  },

  // Other data endpoints as needed
};

export default dataService;
