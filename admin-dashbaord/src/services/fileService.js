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
      const response = await api.post("/data/invoices/upload/", formData, {
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

  uploadMultipleFiles: async (files, options = {}) => {
    try {
      const totalFiles = files.length;
      let completedFiles = 0;
      const MAX_CONCURRENT_UPLOADS = 5;
      const results = [];
      const fileProgress = {};

      // Process files in chunks of MAX_CONCURRENT_UPLOADS
      for (let i = 0; i < totalFiles; i += MAX_CONCURRENT_UPLOADS) {
        const chunk = files.slice(i, i + MAX_CONCURRENT_UPLOADS);

        console.log(
          `Processing chunk of ${chunk.length} files (${i + 1} to ${Math.min(
            i + MAX_CONCURRENT_UPLOADS,
            totalFiles
          )} of ${totalFiles})`
        );

        // Create upload promises for this chunk
        const chunkPromises = chunk.map(async (file, chunkIndex) => {
          const fileIndex = i + chunkIndex;
          fileProgress[file.name] = 0;

          try {
            const response = await fileService.uploadFile(
              file,
              options.invoiceNumbers[fileIndex],
              options.fileTypes[fileIndex] || ""
            );

            // Update progress for this file
            fileProgress[file.name] = 100;
            completedFiles++;

            // Calculate and report overall progress
            if (options.onProgress) {
              const overallProgress = Math.round(
                (completedFiles * 100) / totalFiles
              );
              options.onProgress(overallProgress, {
                fileName: file.name,
                fileProgress: 100,
                completedFiles,
                totalFiles,
                filesProgressMap: fileProgress,
              });
            }

            return response;
          } catch (error) {
            console.error(`Error uploading file ${file.name}:`, error);
            completedFiles++;

            // Even on error, update progress
            if (options.onProgress) {
              const overallProgress = Math.round(
                (completedFiles * 100) / totalFiles
              );
              options.onProgress(overallProgress, {
                fileName: file.name,
                fileProgress: 0,
                completedFiles,
                totalFiles,
                filesProgressMap: fileProgress,
                error: error,
              });
            }

            throw error;
          }
        });

        // Wait for all files in this chunk to complete
        const chunkResults = await Promise.allSettled(chunkPromises);

        // Process results, keeping successful uploads and marking failed ones
        chunkResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            results.push(result.value);
          } else {
            // For rejected promises, add an error result
            results.push({
              success: false,
              file_name: chunk[index].name,
              error: result.reason.message || "Upload failed",
            });
          }
        });
      }

      return results;
    } catch (error) {
      console.error("Error uploading multiple files:", error);
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

  saveToDatabase: async (fileId, options = {}) => {
    try {
      console.log(`Saving file ${fileId} to database with options:`, options);

      // Ensure we have the required options
      const saveOptions = {
        file_type: options.file_type || "",
        map_fields: options.map_fields || true,
        options: {
          remove_duplicates: options.remove_duplicates || true,
          handle_missing: options.handle_missing || "fill_zeros",
          ...options.options,
        },
        ...options,
      };

      console.log("Final save options:", saveOptions);

      const response = await api.post(
        `/data/invoices/${fileId}/save/`,
        saveOptions
      );

      console.log("Save response from server:", response.data);

      return response.data;
    } catch (error) {
      console.error("Error in saveToDatabase:", error);
      console.error("Error details:", error.response?.data || error.message);
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
  getFacturationManuelle: async (fileId) => {
    try {
      console.log(
        `Fetching Facturation Manuelle data for invoice ID: ${fileId}`
      );
      const response = await api.get(
        `/data/facturation-manuelle/?invoice=${fileId}`
      );
      console.log(
        `Retrieved ${response.data.length || 0} Facturation Manuelle records`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching Facturation Manuelle data:", error);
      throw error;
    }
  },

  getJournalVentes: async (fileId) => {
    try {
      console.log(`Fetching Journal Ventes data for invoice ID: ${fileId}`);
      const response = await api.get(`/data/journal-ventes/?invoice=${fileId}`);
      console.log(
        `Retrieved ${response.data.length || 0} Journal Ventes records`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching Journal Ventes data:", error);
      throw error;
    }
  },

  getEtatFacture: async (fileId) => {
    try {
      console.log(`Fetching Etat Facture data for invoice ID: ${fileId}`);
      const response = await api.get(`/data/etat-facture/?invoice=${fileId}`);
      console.log(
        `Retrieved ${response.data.length || 0} Etat Facture records`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching Etat Facture data:", error);

      // Check if it's a server error (500)
      if (error.response && error.response.status === 500) {
        console.error("Server error details:", error.response.data);
        const customError = new Error(
          "The Etat Facture API endpoint has a server-side issue. This is likely due to a missing queryset or get_queryset() method in the EtatFactureListView class. Please contact the backend developer to fix this issue."
        );
        customError.isServerError = true;
        throw customError;
      }

      throw error;
    }
  },

  getParcCorporate: async (fileId) => {
    try {
      console.log(`Fetching Parc Corporate data for invoice ID: ${fileId}`);
      const response = await api.get(`/data/parc-corporate/?invoice=${fileId}`);
      console.log(
        `Retrieved ${response.data.length || 0} Parc Corporate records`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching Parc Corporate data:", error);
      throw error;
    }
  },

  getCreancesNGBSS: async (fileId) => {
    try {
      console.log(`Fetching Creances NGBSS data for invoice ID: ${fileId}`);
      const response = await api.get(`/data/creances-ngbss/?invoice=${fileId}`);
      console.log(
        `Retrieved ${response.data.length || 0} Creances NGBSS records`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching Creances NGBSS data:", error);
      throw error;
    }
  },

  getCAPeriodique: async (fileId) => {
    try {
      console.log(`Fetching CA Periodique data for invoice ID: ${fileId}`);
      const response = await api.get(`/data/ca-periodique/?invoice=${fileId}`);
      console.log(
        `Retrieved ${response.data.length || 0} CA Periodique records`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching CA Periodique data:", error);
      throw error;
    }
  },

  getCANonPeriodique: async (fileId) => {
    try {
      console.log(`Fetching CA Non Periodique data for invoice ID: ${fileId}`);
      const response = await api.get(
        `/data/ca-non-periodique/?invoice=${fileId}`
      );
      console.log(
        `Retrieved ${response.data.length || 0} CA Non Periodique records`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching CA Non Periodique data:", error);
      throw error;
    }
  },

  getCADNT: async (fileId) => {
    try {
      console.log(`Fetching CA DNT data for invoice ID: ${fileId}`);
      const response = await api.get(`/data/ca-dnt/?invoice=${fileId}`);
      console.log(`Retrieved ${response.data.length || 0} CA DNT records`);
      return response.data;
    } catch (error) {
      console.error("Error fetching CA DNT data:", error);
      throw error;
    }
  },

  getCARFD: async (fileId) => {
    try {
      console.log(`Fetching CA RFD data for invoice ID: ${fileId}`);
      const response = await api.get(`/data/ca-rfd/?invoice=${fileId}`);
      console.log(`Retrieved ${response.data.length || 0} CA RFD records`);
      return response.data;
    } catch (error) {
      console.error("Error fetching CA RFD data:", error);
      throw error;
    }
  },

  getCACNT: async (fileId) => {
    try {
      console.log(`Fetching CA CNT data for invoice ID: ${fileId}`);
      const response = await api.get(`/data/ca-cnt/?invoice=${fileId}`);
      console.log(`Retrieved ${response.data.length || 0} CA CNT records`);
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

  exportData: async (dataType, format, filters) => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("data_type", dataType);
      params.append("format", format);

      // Add filters if provided
      if (filters.year) params.append("year", filters.year);
      if (filters.month) params.append("month", filters.month);
      if (filters.dot) params.append("dot", filters.dot);

      // Make request with responseType blob for file download
      const response = await api.get(`/data/export/?${params.toString()}`, {
        responseType: "blob",
      });

      // Create a download link and trigger it
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Set filename based on response headers or fallback
      const contentDisposition = response.headers["content-disposition"];
      let filename = `${dataType}_export.${format}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();

      return true;
    } catch (error) {
      console.error("Error exporting data:", error);
      throw error;
    }
  },

  // Progress tracking methods
  getProgress: async (invoiceId) => {
    try {
      if (invoiceId) {
        const response = await api.get(`/data/progress/${invoiceId}/`);
        return response.data;
      } else {
        const response = await api.get("/data/progress/");
        return response.data;
      }
    } catch (error) {
      console.error("Error fetching progress:", error);
      throw error;
    }
  },

  pollProgress: (invoiceId, callback, interval = 2000, maxAttempts = 100) => {
    let attempts = 0;
    let timerId = null;

    const checkProgress = async () => {
      try {
        attempts++;
        const progressData = await fileService.getProgress(invoiceId);

        // Call the callback with the progress data
        callback(progressData, null);

        // If progress is complete or we've reached max attempts, stop polling
        if (
          progressData.status === "completed" ||
          progressData.progress_percent === 100 ||
          attempts >= maxAttempts
        ) {
          clearInterval(timerId);
          return;
        }
      } catch (error) {
        console.error("Error polling progress:", error);
        callback(null, error);

        // Stop polling on error
        clearInterval(timerId);
      }
    };

    // Start polling
    timerId = setInterval(checkProgress, interval);

    // Return a function to stop polling
    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  },

  // Method to get data for pivot table based on data source
  getPivotData: async (dataSource) => {
    try {
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

      const endpoint = fileTypeEndpoints[dataSource];
      if (!endpoint) {
        throw new Error(`Invalid data source: ${dataSource}`);
      }

      const response = await api.get(endpoint);
      return { data: response.data }; // Wrap the data to match the expected format
    } catch (error) {
      console.error(`Error fetching pivot data for ${dataSource}:`, error);
      throw error;
    }
  },

  // Track multiple upload progress
  getMultipleUploadProgress: async (uploadIds) => {
    try {
      const response = await api.post("/data/invoices/upload-progress/", {
        upload_ids: uploadIds,
      });
      return response.data;
    } catch (error) {
      console.error("Error getting upload progress:", error);
      throw error;
    }
  },
};

export default fileService;
