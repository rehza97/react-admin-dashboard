import api from "./api";

const fileService = {
  uploadFile: async (file, invoiceNumber, fileType = "") => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("invoice_number", invoiceNumber);
    formData.append("file_name", file.name);

    // Add file type if provided
    if (fileType) {
      formData.append("file_type", fileType);
    }

    try {
      const response = await api.post("/data/upload-facturation/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  },

  getUploadedFiles: async () => {
    const response = await api.get("/data/invoices/");
    return response.data;
  },

  getFileById: async (id) => {
    if (!id) {
      console.error("No file ID provided to getFileById");
      throw new Error("File ID is required");
    }

    try {
      const response = await api.get(`/data/invoices/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching file with ID ${id}:`, error);
      throw error;
    }
  },

  deleteFile: async (id) => {
    if (!id) {
      console.error("No file ID provided to deleteFile");
      throw new Error("File ID is required");
    }

    try {
      const response = await api.delete(`/data/invoices/${id}/`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting file with ID ${id}:`, error);
      throw error;
    }
  },

  updateFile: async (id, data) => {
    if (!id) {
      console.error("No file ID provided to updateFile");
      throw new Error("File ID is required");
    }

    try {
      const response = await api.patch(`/data/invoices/${id}/`, data);
      return response.data;
    } catch (error) {
      console.error(`Error updating file with ID ${id}:`, error);
      throw error;
    }
  },

  downloadFile: async (id) => {
    if (!id) {
      console.error("No file ID provided to downloadFile");
      throw new Error("File ID is required");
    }

    try {
      const response = await api.get(`/data/invoices/${id}/download/`, {
        responseType: "blob",
      });
      return response;
    } catch (error) {
      console.error(`Error downloading file with ID ${id}:`, error);
      throw error;
    }
  },

  inspectFile: async (id) => {
    if (!id) {
      console.error("No file ID provided to inspectFile");
      throw new Error("File ID is required");
    }

    try {
      console.log(`Inspecting file with ID: ${id}`);
      const response = await api.get(`/data/invoices/${id}/inspect/`);
      console.log("Inspection response:", response.data);
      return response.data;
    } catch (error) {
      console.error(`Error inspecting file with ID ${id}:`, error);
      throw error;
    }
  },

  processFile: async (id, options) => {
    if (!id) {
      console.error("No file ID provided for processing");
      throw new Error("File ID is required");
    }

    console.log(`Processing file with ID: ${id}`, options);

    try {
      const response = await api.post(`/data/invoices/${id}/process/`, {
        processingMode: options.processingMode || "automatic",
        treatment: options.treatment || "",
        fileType: options.fileType || "",
        remove_duplicates: options.remove_duplicates || false,
        handle_missing: options.handle_missing || "fill_zeros",
        filters: options.filters || [],
      });

      console.log("Process response:", response.data);
      return response.data;
    } catch (error) {
      console.error(`Error processing file with ID ${id}:`, error);
      throw error;
    }
  },

  saveToDatabase: async (id, data) => {
    if (!id) {
      console.error("No file ID provided for saving to database");
      throw new Error("File ID is required");
    }

    console.log(`Saving file ID: ${id} to database`, data);

    if (!data.file_type) {
      console.warn(
        "No file_type provided for saving to database, defaulting to empty string"
      );
      data.file_type = "";
    }

    try {
      const response = await api.post(`/data/invoices/${id}/save/`, data);
      console.log("Save response:", response.data);
      return response.data;
    } catch (error) {
      console.error(`Error saving file with ID ${id} to database:`, error);
      throw error;
    }
  },

  // New methods for file type listing and specific model data retrieval
  getFileTypes: async () => {
    try {
      const response = await api.get("/data/file-types/");
      return response.data;
    } catch (error) {
      console.error("Error fetching file types:", error);
      throw error;
    }
  },

  // Methods for retrieving specific model data
  getFacturationManuelle: async (params = {}) => {
    try {
      const response = await api.get("/data/facturation-manuelle/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching Facturation Manuelle data:", error);
      throw error;
    }
  },

  getJournalVentes: async (params = {}) => {
    try {
      const response = await api.get("/data/journal-ventes/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching Journal Ventes data:", error);
      throw error;
    }
  },

  getEtatFacture: async (params = {}) => {
    try {
      const response = await api.get("/data/etat-facture/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching Etat Facture data:", error);
      throw error;
    }
  },

  getParcCorporate: async (params = {}) => {
    try {
      const response = await api.get("/data/parc-corporate/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching Parc Corporate data:", error);
      throw error;
    }
  },

  getCreancesNGBSS: async (params = {}) => {
    try {
      const response = await api.get("/data/creances-ngbss/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching Creances NGBSS data:", error);
      throw error;
    }
  },

  getCAPeriodique: async (params = {}) => {
    try {
      const response = await api.get("/data/ca-periodique/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching CA Periodique data:", error);
      throw error;
    }
  },

  getCANonPeriodique: async (params = {}) => {
    try {
      const response = await api.get("/data/ca-non-periodique/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching CA Non Periodique data:", error);
      throw error;
    }
  },

  getCADNT: async (params = {}) => {
    try {
      const response = await api.get("/data/ca-dnt/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching CA DNT data:", error);
      throw error;
    }
  },

  getCARFD: async (params = {}) => {
    try {
      const response = await api.get("/data/ca-rfd/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching CA RFD data:", error);
      throw error;
    }
  },

  getCACNT: async (params = {}) => {
    try {
      const response = await api.get("/data/ca-cnt/", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching CA CNT data:", error);
      throw error;
    }
  },

  // Method to get data based on file type
  getDataByFileType: async (fileType, params = {}) => {
    const fileTypeEndpoints = {
      facturation_manuelle: "/data/facturation-manuelle/",
      journal_ventes: "/data/journal-ventes/",
      etat_facture: "/data/etat-facture/",
      parc_corporate: "/data/parc-corporate/",
      creances_ngbss: "/data/creances-ngbss/",
      ca_periodique: "/data/ca-periodique/",
      ca_non_periodique: "/data/ca-non-periodique/",
      ca_dnt: "/data/ca-dnt/",
      ca_rfd: "/data/ca-rfd/",
      ca_cnt: "/data/ca-cnt/",
    };

    const endpoint = fileTypeEndpoints[fileType] || "/data/processed-data/";

    try {
      const response = await api.get(endpoint, { params });
      return response.data;
    } catch (error) {
      console.error(`Error fetching data for file type ${fileType}:`, error);
      throw error;
    }
  },
};

export default fileService;
