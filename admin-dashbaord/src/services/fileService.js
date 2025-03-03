import api from "./api";

const fileService = {
  uploadFile: async (file, invoiceNumber) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("invoice_number", invoiceNumber);
    formData.append("file_name", file.name);

    const response = await api.post("/data/upload-facturation/", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
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
};

export default fileService;
