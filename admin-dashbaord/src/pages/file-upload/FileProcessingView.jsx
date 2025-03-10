import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Chip,
  Button,
  Tooltip,
  CircularProgress,
  useTheme,
  alpha,
  IconButton,
  Paper,
  Tabs,
  Tab,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  AppBar,
  Toolbar,
  Alert,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import DatabaseIcon from "@mui/icons-material/Storage";
import SaveIcon from "@mui/icons-material/Save";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import PropTypes from "prop-types";
import fileService from "../../services/fileService";
import "../../../src/styles/dataPreview.css";

// Add a utility function at the top of the component to safely convert any value to a string
const safeToString = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error("Error stringifying object:", error);
      return "[Complex Object]";
    }
  }

  return String(value);
};

const FileProcessingView = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { fileId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [summaryData, setSummaryData] = useState({
    file_type: "",
    summary_data: {
      row_count: 0,
      column_count: 0,
      columns: [],
    },
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [successMessage, setSuccessMessage] = useState(null);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [databaseData, setDatabaseData] = useState([]);
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [dbPage, setDbPage] = useState(0);
  const [dbRowsPerPage, setDbRowsPerPage] = useState(10);

  useEffect(() => {
    if (fileId) {
      inspectFile(fileId);
    }
  }, [fileId]);

  // Update loading indicators based on various states
  useEffect(() => {
    // Set overall loading state based on component states
    setIsLoading(isInspecting || isProcessing || isSaving || isDatabaseLoading);
  }, [isInspecting, isProcessing, isSaving, isDatabaseLoading]);

  // Load database data when the database tab is selected
  useEffect(() => {
    if (activeTab === 2 && fileType && fileId) {
      fetchDatabaseData();
    }
  }, [activeTab, fileType, fileId]);

  const fetchDatabaseData = async () => {
    if (!fileType || !fileId) {
      console.warn("Cannot fetch database data: missing fileType or fileId");
      return;
    }

    setIsDatabaseLoading(true);
    setError(null);

    try {
      console.log(
        `Fetching database data for file type: ${fileType}, fileId: ${fileId}`
      );

      // Determine which API endpoint to use based on file type
      let response;
      const apiEndpoint = fileType.replace(/-/g, "_");
      console.log("API endpoint used:", apiEndpoint);

      // Special handling for etat_facture which might have a backend issue
      if (fileType === "etat_facture") {
        try {
          response = await fileService.getEtatFacture(fileId);
        } catch (error) {
          console.error("Error fetching etat_facture data:", error);

          // Check if it's the specific server error we identified
          if (error.isServerError) {
            setError(
              "The Etat Facture data cannot be displayed due to a backend configuration issue. Please contact the administrator to fix the EtatFactureListView class in the backend."
            );
          } else {
            setError(
              `Error fetching Etat Facture data: ${
                error.message || "Unknown error"
              }`
            );
          }

          setIsDatabaseLoading(false);
          return;
        }
      } else {
        switch (fileType) {
          case "facturation_manuelle":
            response = await fileService.getFacturationManuelle(fileId);
            break;
          case "journal_ventes":
            response = await fileService.getJournalVentes(fileId);
            break;
          case "parc_corporate":
            response = await fileService.getParcCorporate(fileId);
            break;
          case "creances_ngbss":
            response = await fileService.getCreancesNGBSS(fileId);
            break;
          case "ca_periodique":
            response = await fileService.getCAPeriodique(fileId);
            break;
          case "ca_non_periodique":
            response = await fileService.getCANonPeriodique(fileId);
            break;
          case "ca_dnt":
            response = await fileService.getCADNT(fileId);
            break;
          case "ca_rfd":
            response = await fileService.getCARFD(fileId);
            break;
          case "ca_cnt":
            response = await fileService.getCACNT(fileId);
            break;
          default:
            console.warn(`Unknown file type: ${fileType}`);
            setError(`Unknown file type: ${fileType}`);
            setIsDatabaseLoading(false);
            return;
        }
      }

      console.log("API response:", response);
      console.log("API response structure:", {
        isArray: Array.isArray(response),
        hasResults:
          response && Array.isArray(response) ? response.length > 0 : false,
        responseType: typeof response,
        keys:
          response && typeof response === "object" ? Object.keys(response) : [],
      });

      let resultsArray = [];

      // Handle different response formats
      if (Array.isArray(response)) {
        console.log(
          `Found ${response.length} results in direct array response`
        );
        resultsArray = response;
      } else if (response && typeof response === "object") {
        if (response.results && Array.isArray(response.results)) {
          console.log(
            `Found ${response.results.length} results in response.results`
          );
          resultsArray = response.results;
        } else if (response.data && Array.isArray(response.data)) {
          console.log(`Found ${response.data.length} results in response.data`);
          resultsArray = response.data;
        } else {
          // Try to find any array property that might contain the data
          const arrayProps = Object.entries(response).filter(
            ([, value]) => Array.isArray(value) && value.length > 0
          );

          if (arrayProps.length > 0) {
            const [propName, propValue] = arrayProps[0];
            console.log(
              `Found array data in property: ${propName} with ${propValue.length} items`
            );
            resultsArray = propValue;
          } else {
            // Check if the object itself is a single result
            if (response.id) {
              console.log(
                "Response appears to be a single result object, wrapping in array"
              );
              resultsArray = [response];
            } else {
              console.warn("Could not find array data in response", response);
              setError("Could not find data in API response");
              setIsDatabaseLoading(false);
              return;
            }
          }
        }
      } else {
        console.warn("Unexpected response format", response);
        setError("Unexpected API response format");
        setIsDatabaseLoading(false);
        return;
      }

      // Log the structure of the first result item
      if (resultsArray.length > 0) {
        console.log("First result item structure:", resultsArray[0]);
      }

      // Process the data for the DataGrid
      const processedData = resultsArray.map((item, index) => {
        // Ensure each item has an ID for the DataGrid
        const id = item.id
          ? `db-${item.id}`
          : `db-${index}-${Math.random().toString(36).substr(2, 9)}`;

        // Convert null values to empty strings for display
        const processedItem = { ...item, id };
        Object.keys(processedItem).forEach((key) => {
          if (processedItem[key] === null || processedItem[key] === undefined) {
            processedItem[key] = "";
          }
        });

        return processedItem;
      });

      console.log(`Processed ${processedData.length} rows for DataGrid`);
      if (processedData.length > 0) {
        console.log("Sample processed row:", processedData[0]);
      }

      setDatabaseData(processedData);
    } catch (error) {
      console.error("Error fetching database data:", error);
      setError(
        `Error fetching database data: ${error.message || "Unknown error"}`
      );
    } finally {
      setIsDatabaseLoading(false);
    }
  };

  const simulateFetchProgress = () => {
    setFetchProgress(0);
    const interval = setInterval(() => {
      setFetchProgress((prevProgress) => {
        const newProgress = prevProgress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        return newProgress;
      });
    }, 300);
    return interval;
  };

  const simulateSaveProgress = () => {
    setSaveProgress(0);
    const interval = setInterval(() => {
      setSaveProgress((prevProgress) => {
        const newProgress = prevProgress + 5;
        if (newProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        return newProgress;
      });
    }, 200);
    return interval;
  };

  const inspectFile = async (id) => {
    if (!id) {
      setError("No file ID provided");
      return;
    }

    setIsInspecting(true);
    setError(null);
    setPreviewData(null);
    setSummaryData(null);

    try {
      console.log(`Inspecting file with ID: ${id}`);
      const response = await fileService.inspectFile(id);
      console.log("Inspection response:", response);

      if (response) {
        // Store the file type for later use
        if (response.file_type) {
          setFileType(response.file_type);
        }

        // Set the file name if available
        if (response.file_name) {
          setFileName(response.file_name);
        }

        // Handle preview data
        if (response.preview_data && Array.isArray(response.preview_data)) {
          console.log(
            `Received ${response.preview_data.length} preview records`
          );

          // Get the field mapping for the current file type
          const fileTypeToUse = response.file_type || fileType;
          const fieldMapping = getFieldMappingForType(fileTypeToUse);

          console.log("File type detected:", fileTypeToUse);
          console.log("First preview record:", response.preview_data[0]);
          console.log("Field mapping for this file type:", fieldMapping);

          // For ca_periodique, ensure we have the correct field mappings
          if (fileTypeToUse === "ca_periodique") {
            console.log("Processing ca_periodique file type");
            console.log("Expected field mappings for ca_periodique:");
            console.log({
              DO: "dot",
              PRODUIT: "product",
              HT: "amount_pre_tax",
              TAX: "tax_amount",
              TTC: "total_amount",
              DISCOUNT: "discount",
            });
          }

          const previewWithIds = response.preview_data.map((item, index) => {
            // Create a new object with mapped field names
            const mappedItem = { id: item.id || `preview-${index + 1}` };

            // Map each field using the field mapping
            Object.keys(item).forEach((key) => {
              // Keep the original field
              mappedItem[key] = item[key];

              // If there's a mapping for this field, add the mapped field as well
              if (fieldMapping[key]) {
                mappedItem[fieldMapping[key]] = item[key];

                // Log the mapping for debugging
                if (index === 0) {
                  console.log(
                    `Mapped ${key} to ${fieldMapping[key]}: ${item[key]}`
                  );
                }
              }
            });

            // For ca_periodique, ensure all expected fields are present
            if (fileTypeToUse === "ca_periodique") {
              // Check for DO -> dot mapping
              if (item.DO !== undefined && !mappedItem.dot) {
                mappedItem.dot = item.DO;
              }

              // Check for PRODUIT -> product mapping
              if (item.PRODUIT !== undefined && !mappedItem.product) {
                mappedItem.product = item.PRODUIT;
              }

              // Check for HT -> amount_pre_tax mapping
              if (item.HT !== undefined && !mappedItem.amount_pre_tax) {
                mappedItem.amount_pre_tax = item.HT;
              }

              // Check for TAX -> tax_amount mapping
              if (item.TAX !== undefined && !mappedItem.tax_amount) {
                mappedItem.tax_amount = item.TAX;
              }

              // Check for TTC -> total_amount mapping
              if (item.TTC !== undefined && !mappedItem.total_amount) {
                mappedItem.total_amount = item.TTC;
              }

              // Check for DISCOUNT -> discount mapping
              if (item.DISCOUNT !== undefined && !mappedItem.discount) {
                mappedItem.discount = item.DISCOUNT;
              }
            }

            // Log a few sample items to verify mapping
            if (index < 5) {
              console.log(`Mapped item ${index}:`, mappedItem);
            }

            return mappedItem;
          });

          // Log field mapping for debugging
          if (previewWithIds.length > 0) {
            const firstItem = previewWithIds[0];
            console.log(
              "Preview data fields after mapping:",
              Object.keys(firstItem)
            );

            // For ca_periodique, verify that all expected fields are present
            if (fileTypeToUse === "ca_periodique") {
              const expectedFields = [
                "dot",
                "product",
                "amount_pre_tax",
                "tax_amount",
                "total_amount",
                "discount",
              ];
              const missingFields = expectedFields.filter(
                (field) => !(field in firstItem)
              );

              if (missingFields.length > 0) {
                console.warn(
                  "Missing expected fields in mapped data:",
                  missingFields
                );
              } else {
                console.log("All expected fields are present in mapped data");
              }
            }
          }

          setPreviewData(previewWithIds);
        } else {
          console.warn("No preview data available or data is not an array");
          setPreviewData([]);
        }

        // Set the entire response as summaryData
        setSummaryData(response);

        // Set detection confidence if available
        if (response.detection_confidence) {
          setDetectionConfidence(response.detection_confidence);
        }
      }
    } catch (error) {
      console.error("Error inspecting file:", error);
      setError(error.message || "An error occurred while inspecting the file");
    } finally {
      setIsInspecting(false);
    }
  };

  // Helper function to map preview fields to database fields
  const mapPreviewFieldToDbField = (previewField, fileType) => {
    // Define mapping based on file type
    const mappings = {
      ca_rfd: {
        TRANS_ID: "transaction_id",
        FULL_NAME: "full_name",
        ACTEL: "actel",
        DO: "dot",
        TTC: "total_amount",
        DROIT_TIMBRE: "droit_timbre",
        TVA: "tax_amount",
        HT: "amount_pre_tax",
        ENTRY_DATE: "entry_date",
        CUST_CODE: "customer_code",
        PRI_IDENTITY: "pri_identity",
        CUST_LEV1: "customer_lev1",
        CUST_LEV2: "customer_lev2",
        CUST_LEV3: "customer_lev3",
        DEPARTEMENT: "department",
      },
      // Add mappings for other file types as needed
    };

    // Return the mapped field name or the original if no mapping exists
    return (
      mappings[fileType]?.[previewField] ||
      previewField.toLowerCase().replace(/\s+/g, "_")
    );
  };

  const handleProcess = async () => {
    if (!fileId) {
      setError("No file ID provided");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const progressInterval = simulateFetchProgress();

    try {
      console.log(`Processing file with ID: ${fileId}`);

      const processingOptions = {
        processingMode: "automatic",
        fileType:
          fileType ||
          (summaryData && "detected_file_type" in summaryData
            ? summaryData.detected_file_type
            : ""),
        remove_duplicates: true,
        handle_missing: "fill_zeros",
        filters: [],
      };

      const response = await fileService.processFile(fileId, processingOptions);

      setFetchProgress(100);

      if (response) {
        setPreviewData(response.preview_data || []);
        setSummaryData(response.summary_data || {});
        setFileType(response.file_type || "");
        setDetectionConfidence(response.detection_confidence || 0);
        setSuccessMessage("File processed successfully");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setError(error.response?.data?.error || "Failed to process file");
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!fileId || !fileType) {
      setError("File ID or type is missing");
      return;
    }

    try {
      setIsSaving(true);
      setSaveProgress(0);
      setError(null);

      console.log(
        "Starting save operation for file:",
        fileId,
        "type:",
        fileType
      );
      console.log(
        "Preview data available:",
        previewData ? previewData.length : 0,
        "records"
      );

      // Log the first few records to help with debugging
      if (previewData && previewData.length > 0) {
        console.log(
          "Sample preview data (first 3 records):",
          previewData.slice(0, 3).map((item) => ({ ...item }))
        );

        // Log field mapping for debugging
        const firstItem = previewData[0];
        const fieldMapping = getFieldMappingForType(fileType);
        console.log("Field mapping for save operation:", fieldMapping);

        // Check if we have mappings for this file type
        if (Object.keys(fieldMapping).length === 0) {
          console.warn(`No field mappings defined for file type: ${fileType}`);
          // Generate a basic mapping based on field names
          const basicMapping = {};
          Object.keys(firstItem).forEach((key) => {
            basicMapping[key] = mapPreviewFieldToDbField(key, fileType);
          });
          console.log("Generated basic field mapping:", basicMapping);
        }
      }

      // Start the save operation with explicit field mapping
      const response = await fileService.saveToDatabase(fileId, {
        file_type: fileType,
        map_fields: true,
        field_mapping: getFieldMappingForType(fileType),
        options: {
          remove_duplicates: true,
          handle_missing: "fill_zeros",
        },
      });

      console.log("Save response:", response);

      // Simulate progress
      simulateSaveProgress();

      // After successful save, fetch the database data to show the results
      setTimeout(() => {
        fetchDatabaseData();
        setIsSaving(false);
        setSaveProgress(100);
        setActiveTab(2); // Switch to database tab
        setSuccessMessage("Data saved successfully to the database");
      }, 2000);
    } catch (error) {
      console.error("Error saving data:", error);
      setIsSaving(false);
      setError(`Error saving data: ${error.message || "Unknown error"}`);
    }
  };

  // Helper function to get field mapping based on file type
  const getFieldMappingForType = (fileType) => {
    // Define mapping based on file type
    const mappings = {
      facturation_manuelle: {
        Mois: "month",
        "Date de Facture": "invoice_date",
        Dépts: "department",
        "N° Facture": "invoice_number",
        Exercices: "fiscal_year",
        Client: "client",
        "Montant HT": "amount_pre_tax",
        "% TVA": "vat_percentage",
        "Montant TVA": "vat_amount",
        "Montant TTC": "total_amount",
        Désignations: "description",
        Période: "period",
      },
      journal_ventes: {
        "Org Name": "organization",
        Origine: "origin",
        "N Fact": "invoice_number",
        "Typ Fact": "invoice_type",
        "Date Fact": "invoice_date",
        Client: "client",
        Devise: "currency",
        "Obj Fact": "invoice_object",
        "Cpt Comptable": "account_code",
        "Date GL": "gl_date",
        "Periode de facturation": "billing_period",
        Reference: "reference",
        "Termine Flag": "terminated_flag",
        "Description (ligne de produit)": "description",
        "Chiffre Aff Exe Dzd": "revenue_amount",
      },
      etat_facture: {
        Organisation: "organization",
        Source: "source",
        "N Fact": "invoice_number",
        "Typ Fact": "invoice_type",
        "Date Fact": "invoice_date",
        Client: "client",
        "Obj Fact": "invoice_object",
        Periode: "period",
        "Termine Flag": "terminated_flag",
        "Montant Ht": "amount_pre_tax",
        "Montant Taxe": "tax_amount",
        "Montant Ttc": "total_amount",
        "Chiffre Aff Exe": "revenue_amount",
        Encaissement: "collection_amount",
        "Date Rglt": "payment_date",
        "Facture Avoir / Annulation": "invoice_credit_amount",
      },
      parc_corporate: {
        ACTEL_CODE: "actel_code",
        CODE_CUSTOMER_L1: "customer_l1_code",
        DESCRIPTION_CUSTOMER_L1: "customer_l1_desc",
        CODE_CUSTOMER_L2: "customer_l2_code",
        DESCRIPTION_CUSTOMER_L2: "customer_l2_desc",
        CODE_CUSTOMER_L3: "customer_l3_code",
        DESCRIPTION_CUSTOMER_L3: "customer_l3_desc",
        TELECOM_TYPE: "telecom_type",
        OFFER_TYPE: "offer_type",
        OFFER_NAME: "offer_name",
        SUBSCRIBER_STATUS: "subscriber_status",
        CREATION_DATE: "creation_date",
        STATE: "state",
        CUSTOMER_FULL_NAME: "customer_full_name",
      },
      creances_ngbss: {
        DOT: "dot",
        ACTEL: "actel",
        MOIS: "month",
        ANNEE: "year",
        SUBS_STATUS: "subscriber_status",
        PRODUIT: "product",
        CUST_LEV1: "customer_lev1",
        CUST_LEV2: "customer_lev2",
        CUST_LEV3: "customer_lev3",
        INVOICE_AMT: "invoice_amount",
        OPEN_AMT: "open_amount",
        TAX_AMT: "tax_amount",
        INVOICE_AMT_HT: "invoice_amount_ht",
        DISPUTE_AMT: "dispute_amount",
        DISPUTE_TAX_AMT: "dispute_tax_amount",
        DISPUTE_NET_AMT: "dispute_net_amount",
        CREANCE_BRUT: "creance_brut",
        CREANCE_NET: "creance_net",
        CREANCE_HT: "creance_ht",
      },
      ca_periodique: {
        DO: "dot",
        PRODUIT: "product",
        HT: "amount_pre_tax",
        TAX: "tax_amount",
        TTC: "total_amount",
        DISCOUNT: "discount",
        CREATED_AT: "created_at",
        UPDATED_AT: "updated_at",
      },
      ca_non_periodique: {
        DO: "dot",
        PRODUIT: "product",
        HT: "amount_pre_tax",
        TAX: "tax_amount",
        TTC: "total_amount",
        TYPE_VENTE: "sale_type",
        CHANNEL: "channel",
      },
      ca_dnt: {
        PRI_IDENTITY: "pri_identity",
        CUST_CODE: "customer_code",
        FULL_NAME: "full_name",
        TRANS_ID: "transaction_id",
        TRANS_TYPE: "transaction_type",
        CHANNEL_ID: "channel_id",
        EXT_TRANS_TYPE: "ext_trans_type",
        TTC: "total_amount",
        TVA: "tax_amount",
        HT: "amount_pre_tax",
        ENTRY_DATE: "entry_date",
        ACTEL: "actel",
        DO: "dot",
        CUST_LEV1: "customer_lev1",
        CUST_LEV2: "customer_lev2",
        CUST_LEV3: "customer_lev3",
        DEPARTEMENT: "department",
      },
      ca_rfd: {
        TRANS_ID: "transaction_id",
        FULL_NAME: "full_name",
        ACTEL: "actel",
        DO: "dot",
        TTC: "total_amount",
        DROIT_TIMBRE: "droit_timbre",
        TVA: "tax_amount",
        HT: "amount_pre_tax",
        ENTRY_DATE: "entry_date",
        CUST_CODE: "customer_code",
        PRI_IDENTITY: "pri_identity",
        CUST_LEV1: "customer_lev1",
        CUST_LEV2: "customer_lev2",
        CUST_LEV3: "customer_lev3",
        DEPARTEMENT: "department",
      },
      ca_cnt: {
        INVOICE_ADJUSTED: "invoice_adjusted",
        PRI_IDENTITY: "pri_identity",
        CUST_CODE: "customer_code",
        FULL_NAME: "full_name",
        TRANS_ID: "transaction_id",
        TRANS_TYPE: "transaction_type",
        CHANNEL_ID: "channel_id",
        TTC: "total_amount",
        TVA: "tax_amount",
        HT: "amount_pre_tax",
        ENTRY_DATE: "entry_date",
        ACTEL: "actel",
        DO: "dot",
        CUST_LEV1: "customer_lev1",
        CUST_LEV2: "customer_lev2",
        CUST_LEV3: "customer_lev3",
        DEPARTEMENT: "department",
      },
    };

    return mappings[fileType] || {};
  };

  const handleDelete = async () => {
    if (!fileId) {
      setError("No file ID provided");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await fileService.deleteFile(fileId);
      setSuccessMessage("File deleted successfully");

      // Navigate back to file upload page after successful deletion
      setTimeout(() => {
        navigate("/file-upload");
      }, 1500);
    } catch (error) {
      console.error("Error deleting file:", error);
      setError(error.response?.data?.error || "Failed to delete file");
    } finally {
      setIsDeleting(false);
      setOpenDeleteDialog(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getFileTypeDisplayName = (type) => {
    const displayNames = {
      ca_periodique: "CA Périodique",
      ca_non_periodique: "CA Non Périodique",
      ca_dnt: "CA DNT",
      ca_rfd: "CA RFD",
      ca_cnt: "CA CNT",
      facturation_manuelle: "Facturation Manuelle",
      parc_corporate: "Parc Corporate",
      creances_ngbss: "Créances NGBSS",
      etat_facture: "État Facture",
      journal_ventes: "Journal Ventes",
      invoice: "Invoice",
      general: "General Format",
      unknown: "Unknown Format",
    };
    return displayNames[type] || type;
  };

  const getFileTypeDescription = (type) => {
    const descriptionMap = {
      ca_periodique: "Periodic revenue data with product and region breakdown",
      ca_non_periodique: "Non-periodic revenue data",
      ca_dnt: "DNT revenue data",
      ca_rfd: "RFD revenue data",
      ca_cnt: "CNT revenue data",
      facturation_manuelle: "Manual billing data",
      parc_corporate: "Corporate park data",
      creances_ngbss: "NGBSS receivables data",
      etat_facture: "Invoice status data",
      journal_ventes: "Sales journal data",
      invoice: "Invoice and billing data",
      general: "General data format",
      unknown: "Unknown data format",
    };
    return descriptionMap[type] || "";
  };

  const formatColumnType = (type) => {
    if (!type) return "Unknown";

    // If type is an object, return a string representation
    if (typeof type === "object") {
      return "Complex Type";
    }

    // Original logic for string types
    switch (type.toLowerCase()) {
      case "string":
        return "Text";
      case "number":
      case "float":
      case "integer":
        return "Number";
      case "date":
      case "datetime":
        return "Date";
      case "boolean":
        return "Boolean";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const renderDataSummary = () => {
    if (!summaryData) {
      return (
        <Box sx={{ p: 3 }}>
          <Typography variant="body1">No data available</Typography>
        </Box>
      );
    }

    const currentFileType = fileType || summaryData.file_type || "unknown";

    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Data Summary
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
          <Paper className="summary-card">
            <Typography className="summary-card-title">File Type</Typography>
            <Typography className="summary-card-value">
              {getFileTypeDisplayName(currentFileType)}
            </Typography>
            {detectionConfidence > 0 && (
              <Box sx={{ mt: 1, display: "flex", alignItems: "center" }}>
                <Typography variant="caption" sx={{ mr: 1 }}>
                  Confidence:
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={detectionConfidence * 100}
                  sx={{
                    flexGrow: 1,
                    height: 4,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.grey[500], 0.2),
                    "& .MuiLinearProgress-bar": {
                      bgcolor:
                        detectionConfidence > 0.7
                          ? "success.main"
                          : detectionConfidence > 0.4
                          ? "warning.main"
                          : "error.main",
                      borderRadius: 2,
                    },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ ml: 1, fontWeight: "bold" }}
                >
                  {Math.round(detectionConfidence * 100)}%
                </Typography>
              </Box>
            )}
          </Paper>

          <Paper className="summary-card">
            <Typography className="summary-card-title">Rows</Typography>
            <Typography className="summary-card-value">
              {summaryData.summary_data && summaryData.summary_data.row_count
                ? String(summaryData.summary_data.row_count)
                : "0"}
            </Typography>
          </Paper>

          <Paper className="summary-card">
            <Typography className="summary-card-title">Columns</Typography>
            <Typography className="summary-card-value">
              {summaryData.summary_data && summaryData.summary_data.column_count
                ? String(summaryData.summary_data.column_count)
                : "0"}
            </Typography>
          </Paper>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {getFileTypeDescription(currentFileType)}
        </Typography>

        {summaryData.summary_data &&
          summaryData.summary_data.columns &&
          Array.isArray(summaryData.summary_data.columns) && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Column Information
              </Typography>
              <TableContainer
                component={Paper}
                sx={{ maxHeight: "400px", overflow: "auto" }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Column Name</TableCell>
                      <TableCell>Data Type</TableCell>
                      <TableCell>Sample Values</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summaryData.summary_data.columns.map((colInfo, index) => (
                      <TableRow key={index}>
                        <TableCell>{colInfo.name}</TableCell>
                        <TableCell>
                          <Chip
                            label={formatColumnType(colInfo.type)}
                            size="small"
                            className={`column-type-${colInfo.type}`}
                          />
                        </TableCell>
                        <TableCell>
                          {typeof colInfo.unique_values === "object"
                            ? "Complex data"
                            : colInfo.unique_values
                            ? `${safeToString(
                                colInfo.unique_values
                              )} unique values`
                            : ""}
                          {colInfo.min !== undefined &&
                          colInfo.max !== undefined
                            ? ` (Min: ${safeToString(
                                colInfo.min
                              )}, Max: ${safeToString(colInfo.max)})`
                            : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
      </Box>
    );
  };

  const renderDataPreview = () => {
    console.log("Rendering preview data, current state:", {
      hasPreviewData: Boolean(previewData),
      previewDataType: typeof previewData,
      isArray: Array.isArray(previewData),
      length: Array.isArray(previewData) ? previewData.length : "N/A",
      fileType: fileType,
    });

    if (!previewData) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            No preview data available
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try processing the file again or check the console for errors.
          </Typography>
        </Box>
      );
    }

    if (
      previewData &&
      typeof previewData === "object" &&
      "error" in previewData
    ) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1" color="error" gutterBottom>
            Error: {String(previewData.error)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please try processing the file again or contact support if the issue
            persists.
          </Typography>
        </Box>
      );
    }

    const dataArray = Array.isArray(previewData) ? previewData : [];

    if (dataArray.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            No data to display
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The file may be empty or the data format may not be recognized.
          </Typography>
        </Box>
      );
    }

    // Log the first few items for debugging
    console.log("Preview data array:", {
      length: dataArray.length,
      firstItem: dataArray[0],
      keys: Object.keys(dataArray[0] || {}),
    });

    // Log a few sample items
    console.log("Sample preview data items:");
    for (let i = 0; i < Math.min(5, dataArray.length); i++) {
      console.log(`Item ${i}:`, dataArray[i]);
    }

    // Check if data has the required structure for DataGrid
    const hasValidStructure = dataArray.every(
      (item) => item && typeof item === "object" && "id" in item
    );

    console.log("Data has valid structure for DataGrid:", hasValidStructure);

    // Process the data for the DataGrid - ensure each item has an ID and convert null values to empty strings
    const processedDataArray = dataArray.map((item, index) => {
      // Ensure each item has an ID for the DataGrid
      const id = item.id || `preview-${index + 1}`;

      // Convert null values to empty strings for display
      const processedItem = { ...item, id };
      Object.keys(processedItem).forEach((key) => {
        if (processedItem[key] === null || processedItem[key] === undefined) {
          processedItem[key] = "";
        }
      });

      return processedItem;
    });

    // Verify data after processing
    console.log("Data after processing:", {
      length: processedDataArray.length,
      firstItem: processedDataArray[0],
      hasAllIds: processedDataArray.every((item) => "id" in item),
    });

    // Initialize columns array
    const columns = [];

    // Add ID column first
    columns.push({
      field: "id",
      headerName: "ID",
      width: 100,
      headerAlign: "center",
      type: "string",
    });

    // Get the field mapping for the current file type
    const fieldMapping = getFieldMappingForType(fileType);
    console.log("Field mapping for file type:", fileType);
    console.log(fieldMapping);

    // For ca_periodique, prioritize the mapped field names
    if (fileType === "ca_periodique") {
      // These are the fields we expect in the database
      const expectedFields = [
        "dot",
        "product",
        "amount_pre_tax",
        "tax_amount",
        "total_amount",
        "discount",
      ];

      // Check if these fields exist in our data
      console.log("Checking for expected fields in ca_periodique data:");
      expectedFields.forEach((field) => {
        const exists = dataArray.some((item) => field in item);
        console.log(`Field ${field} exists: ${exists}`);
      });

      // Define the columns we want to show in order based on the CAPeriodique model
      const priorityFields = [
        "dot", // DO in the file, dot in the database
        "product", // PRODUIT in the file, product in the database
        "amount_pre_tax", // HT in the file, amount_pre_tax in the database
        "tax_amount", // TAX in the file, tax_amount in the database
        "total_amount", // TTC in the file, total_amount in the database
        "discount", // DISCOUNT in the file, discount in the database
      ];

      // Use more descriptive names for specific fields
      const headerNameMap = {
        dot: "DOT",
        product: "Product",
        amount_pre_tax: "Amount (Pre-tax)",
        tax_amount: "Tax Amount",
        total_amount: "Total Amount",
        discount: "Discount",
      };

      // Add columns for the priority fields
      priorityFields.forEach((field) => {
        // Skip if the field doesn't exist in any item
        if (!dataArray.some((item) => field in item)) {
          console.log(`Field ${field} not found in data, skipping column`);
          return;
        }

        // Determine the field type based on the first non-null value
        let sampleValue = null;
        for (const item of dataArray) {
          if (item[field] !== null && item[field] !== undefined) {
            sampleValue = item[field];
            break;
          }
        }

        const isNumeric =
          typeof sampleValue === "number" ||
          (typeof sampleValue === "string" &&
            !isNaN(parseFloat(sampleValue)) &&
            isFinite(parseFloat(sampleValue)));
        const isDate =
          typeof sampleValue === "string" &&
          /^\d{4}-\d{2}-\d{2}/.test(sampleValue);

        console.log(
          `Column ${field}: type=${
            isDate ? "date" : isNumeric ? "number" : "string"
          }, sample value=${sampleValue}`
        );

        // Create column definition with human-readable header names
        let headerName =
          field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, " ");

        if (headerNameMap[field]) {
          headerName = headerNameMap[field];
        }

        columns.push({
          field,
          headerName,
          flex: 1,
          minWidth: 150,
          align: isNumeric ? "right" : "left",
          headerAlign: "center",
          type: isDate ? "dateTime" : isNumeric ? "number" : "string",
          valueFormatter: (params) => {
            // Handle null/undefined values
            if (params?.value == null || params?.value === "") {
              return "";
            }

            // Handle object values
            if (typeof params.value === "object") {
              try {
                return JSON.stringify(params.value);
              } catch (error) {
                console.error(`Error stringifying object for ${field}:`, error);
                return "[Complex Object]";
              }
            }

            // Format date fields
            if (isDate) {
              try {
                return new Date(params.value).toLocaleDateString("fr-FR");
              } catch (error) {
                console.error(`Error formatting date for ${field}:`, error);
                return String(params.value || "");
              }
            }

            // Format currency fields
            if (
              field.includes("amount") ||
              field.includes("tax") ||
              field.includes("total") ||
              field.includes("discount")
            ) {
              try {
                return new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "DZD",
                  minimumFractionDigits: 2,
                }).format(Number(params.value));
              } catch (error) {
                console.error(`Error formatting value for ${field}:`, error);
                return String(params.value || "");
              }
            }

            // Return the value as is for other fields
            return String(params.value || "");
          },
        });
      });

      // Add any original fields that aren't already mapped
      // This ensures we show all data even if it doesn't match our expected schema
      Object.keys(dataArray[0] || {})
        .filter(
          (field) =>
            field !== "id" && // Exclude the id field
            !priorityFields.includes(field) && // Exclude fields we've already added
            !Object.values(fieldMapping).includes(field) // Exclude fields that are mapped values
        )
        .forEach((field) => {
          // Skip if the field is a mapped field (e.g., DO is mapped to dot)
          if (fieldMapping[field]) {
            return;
          }

          // Determine the field type
          const sampleValue = dataArray[0][field];
          const isNumeric =
            typeof sampleValue === "number" ||
            (typeof sampleValue === "string" &&
              !isNaN(parseFloat(sampleValue)) &&
              isFinite(parseFloat(sampleValue)));
          const isDate =
            typeof sampleValue === "string" &&
            /^\d{4}-\d{2}-\d{2}/.test(sampleValue);

          // Create column definition
          columns.push({
            field,
            headerName: field,
            flex: 1,
            minWidth: 150,
            align: isNumeric ? "right" : "left",
            headerAlign: "center",
            type: isDate ? "dateTime" : isNumeric ? "number" : "string",
            valueFormatter: (params) => {
              // Handle null/undefined values
              if (params?.value == null || params?.value === "") {
                return "";
              }

              // Handle object values
              if (typeof params.value === "object") {
                try {
                  return JSON.stringify(params.value);
                } catch (error) {
                  console.error(
                    `Error stringifying object for ${field}:`,
                    error
                  );
                  return "[Complex Object]";
                }
              }

              // Format currency fields
              if (
                isNumeric &&
                (field.includes("amount") ||
                  field.includes("revenue") ||
                  field.includes("cost") ||
                  field.includes("tax") ||
                  field.includes("ttc") ||
                  field.includes("ht") ||
                  field.includes("price") ||
                  field.includes("total"))
              ) {
                try {
                  return new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "DZD",
                    minimumFractionDigits: 2,
                  }).format(Number(params.value));
                } catch (error) {
                  console.error(`Error formatting value for ${field}:`, error);
                  return String(params.value || "");
                }
              }

              // Return the value as is for other fields
              return String(params.value || "");
            },
          });
        });
    } else {
      // For other file types, use the existing column generation logic
      Object.keys(dataArray[0] || {})
        .filter((field) => field !== "id") // Exclude the id field as we've already added it
        .forEach((field) => {
          // Determine the field type based on the data
          const sampleValue = dataArray[0][field];
          const isNumeric =
            typeof sampleValue === "number" ||
            (typeof sampleValue === "string" &&
              !isNaN(parseFloat(sampleValue)) &&
              isFinite(parseFloat(sampleValue)));
          const isDate =
            typeof sampleValue === "string" &&
            /^\d{4}-\d{2}-\d{2}/.test(sampleValue);

          console.log(
            `Column ${field}: type=${
              isDate ? "date" : isNumeric ? "number" : "string"
            }, sample value=${sampleValue}`
          );

          // Create column definition
          columns.push({
            field,
            headerName:
              field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, " "),
            flex: 1,
            minWidth: 150,
            align: isNumeric ? "right" : "left",
            headerAlign: "center",
            type: isDate ? "dateTime" : isNumeric ? "number" : "string",
            valueFormatter: (params) => {
              // Handle null/undefined values
              if (params?.value == null || params?.value === "") {
                return "";
              }

              // Handle object values
              if (typeof params.value === "object") {
                try {
                  return JSON.stringify(params.value);
                } catch (error) {
                  console.error(
                    `Error stringifying object for ${field}:`,
                    error
                  );
                  return "[Complex Object]";
                }
              }

              // Format currency fields
              if (
                field.includes("amount") ||
                field.includes("revenue") ||
                field.includes("cost") ||
                field.includes("tax") ||
                field.includes("ttc") ||
                field.includes("ht") ||
                field.includes("price") ||
                field.includes("total")
              ) {
                try {
                  return new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "DZD",
                    minimumFractionDigits: 2,
                  }).format(Number(params.value));
                } catch (error) {
                  console.error(`Error formatting value for ${field}:`, error);
                  return String(params.value || "");
                }
              }

              // Return the value as is for other fields
              return String(params.value || "");
            },
          });
        });
    }

    return (
      <Box sx={{ height: "calc(100vh - 200px)", width: "100%", p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">
            Showing {dataArray.length} records from preview data
          </Typography>
        </Box>
        <div style={{ height: "100%", width: "100%" }}>
          {(() => {
            try {
              console.log(
                "______________preview____________________________________________________________"
              );
              console.log("Final columns array:", columns);
              console.log("Data being passed to DataGrid:", {
                rowCount: processedDataArray.length,
                sampleRows: processedDataArray.slice(0, 3),
                columnCount: columns.length,
                columnFields: columns.map((col) => col.field),
              });

              // Check if the data has the fields that match the column definitions
              const firstRow = processedDataArray[0] || {};
              const missingFields = columns
                .map((col) => col.field)
                .filter((field) => !(field in firstRow));

              console.log("Fields missing in data:", missingFields);

              if (missingFields.length > 0) {
                console.warn(
                  "Some column fields are missing in the data. This may cause rendering issues."
                );
              }

              console.log(
                "______________preview____________________________________________________________"
              );
              return (
                <Box sx={{ width: "100%", overflow: "auto" }}>
                  <Paper sx={{ width: "100%", mb: 2 }}>
                    <Toolbar
                      sx={{
                        pl: { sm: 2 },
                        pr: { xs: 1, sm: 1 },
                      }}
                    >
                      <Typography
                        sx={{ flex: "1 1 100%" }}
                        variant="h6"
                        id="tableTitle"
                        component="div"
                      >
                        Preview Data
                      </Typography>
                      <Tooltip title="Filter list">
                        <IconButton>
                          <InfoOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </Toolbar>
                    <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
                      <Table stickyHeader aria-label="preview data table">
                        <TableHead>
                          <TableRow>
                            {columns.map((column) => {
                              // Safe access to properties with type checking
                              let align = "left";
                              if ("align" in column) {
                                align = String(column.align);
                              } else if ("headerAlign" in column) {
                                align = String(column.headerAlign);
                              }

                              let width = 100;
                              if ("minWidth" in column) {
                                width = Number(column.minWidth);
                              } else if ("width" in column) {
                                width = Number(column.width);
                              }

                              return (
                                <TableCell
                                  key={column.field}
                                  align={
                                    align === "right"
                                      ? "right"
                                      : align === "center"
                                      ? "center"
                                      : "left"
                                  }
                                  style={{
                                    minWidth: width,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {column.headerName}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {processedDataArray
                            .slice(
                              page * rowsPerPage,
                              page * rowsPerPage + rowsPerPage
                            )
                            .map((row) => (
                              <TableRow
                                hover
                                role="checkbox"
                                tabIndex={-1}
                                key={row.id}
                              >
                                {columns.map((column) => {
                                  const value = row[column.field];

                                  // Safe access to properties with type checking
                                  let align = "left";
                                  if ("align" in column) {
                                    align = String(column.align);
                                  } else if ("headerAlign" in column) {
                                    align = String(column.headerAlign);
                                  }

                                  let width = 100;
                                  if ("minWidth" in column) {
                                    width = Number(column.minWidth);
                                  } else if ("width" in column) {
                                    width = Number(column.width);
                                  }

                                  return (
                                    <TableCell
                                      key={column.field}
                                      align={
                                        align === "right"
                                          ? "right"
                                          : align === "center"
                                          ? "center"
                                          : "left"
                                      }
                                      style={{ minWidth: width }}
                                    >
                                      {column.valueFormatter
                                        ? column.valueFormatter({ value })
                                        : safeToString(value)}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Box
                      sx={{ display: "flex", justifyContent: "flex-end", p: 2 }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ mr: 2, alignSelf: "center" }}
                      >
                        Rows per page:
                      </Typography>
                      <select
                        value={rowsPerPage}
                        onChange={(e) => setRowsPerPage(Number(e.target.value))}
                        style={{ marginRight: "20px", padding: "5px" }}
                      >
                        {[10, 25, 50, 100].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <Typography
                        variant="caption"
                        sx={{ mr: 2, alignSelf: "center" }}
                      >
                        {page * rowsPerPage + 1}-
                        {Math.min(
                          (page + 1) * rowsPerPage,
                          processedDataArray.length
                        )}{" "}
                        of {processedDataArray.length}
                      </Typography>
                      <IconButton
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        <ArrowBackIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        disabled={
                          (page + 1) * rowsPerPage >= processedDataArray.length
                        }
                        onClick={() => setPage(page + 1)}
                      >
                        <ArrowBackIcon
                          fontSize="small"
                          style={{ transform: "rotate(180deg)" }}
                        />
                      </IconButton>
                    </Box>
                  </Paper>
                </Box>
              );
            } catch (error) {
              console.error("Error rendering DataGrid:", error);
              return (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Error displaying data: {error.message}
                </Alert>
              );
            }
          })()}
        </div>
      </Box>
    );
  };

  const renderDatabasePreview = () => {
    console.log("Rendering database preview, current state:", {
      isDatabaseLoading,
      fileType,
      dataLength: databaseData.length,
      hasError: !!error,
    });

    if (isDatabaseLoading) {
      return (
        <Box
          sx={{
            p: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1">Loading database data...</Typography>
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ p: 2 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            There was an error loading the database data. Please try again or
            check the console for more details.
          </Typography>
        </Box>
      );
    }

    if (!fileType) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            File type detection is required to display database data.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Click the Process button to analyze the file and determine its type.
          </Typography>
        </Box>
      );
    }

    if (databaseData.length === 0) {
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1" gutterBottom>
            No data has been saved to the database yet. Click the Save button to
            save the processed data.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            If you have already saved the data and are seeing this message,
            there might be an issue with the data retrieval. Try refreshing the
            page or check the console for errors.
          </Typography>
        </Box>
      );
    }

    // Log database data for debugging
    console.log("Database data for rendering:", {
      count: databaseData.length,
      firstItem: databaseData[0],
      keys: databaseData[0] ? Object.keys(databaseData[0]) : [],
    });

    // Ensure all rows have unique IDs
    const rowsWithIds = databaseData.map((row, index) => {
      if (!row.id) {
        return { ...row, id: `db-row-${index}` };
      }
      return row;
    });

    // Process the data for the DataGrid - ensure each item has an ID and convert null values to empty strings
    const processedDatabaseData = rowsWithIds.map((item) => {
      // Convert null values to empty strings for display
      const processedItem = { ...item };
      Object.keys(processedItem).forEach((key) => {
        if (processedItem[key] === null || processedItem[key] === undefined) {
          processedItem[key] = "";
        }
      });

      return processedItem;
    });

    // Verify data after processing
    console.log("Database data after processing:", {
      length: processedDatabaseData.length,
      firstItem: processedDatabaseData[0],
      hasAllIds: processedDatabaseData.every((item) => "id" in item),
    });

    // Generate columns for DataGrid
    const columns = [];

    // Add ID column first
    columns.push({
      field: "id",
      headerName: "ID",
      width: 100,
      headerAlign: "center",
      type: "string",
    });

    // For ca_periodique, prioritize the mapped field names
    if (fileType === "ca_periodique") {
      // Define the columns we want to show in order based on the CAPeriodique model
      const priorityFields = [
        "dot", // DO in the file, dot in the database
        "product", // PRODUIT in the file, product in the database
        "amount_pre_tax", // HT in the file, amount_pre_tax in the database
        "tax_amount", // TAX in the file, tax_amount in the database
        "total_amount", // TTC in the file, total_amount in the database
        "discount", // DISCOUNT in the file, discount in the database
        "created_at", // Metadata field from the database
        "updated_at", // Metadata field from the database
      ];

      // Log the fields we're looking for
      console.log("Looking for these fields in database data:", priorityFields);
      console.log(
        "Available fields in database data:",
        databaseData[0] ? Object.keys(databaseData[0]) : "No data available"
      );

      priorityFields.forEach((field) => {
        // Skip if the field doesn't exist in any item
        if (!databaseData.some((item) => field in item)) {
          console.log(
            `Field ${field} not found in database data, skipping column`
          );
          return;
        }

        // Determine the field type based on the first non-null value
        let sampleValue = null;
        for (const item of databaseData) {
          if (item[field] !== null && item[field] !== undefined) {
            sampleValue = item[field];
            break;
          }
        }

        const isNumeric =
          typeof sampleValue === "number" ||
          (typeof sampleValue === "string" &&
            !isNaN(parseFloat(sampleValue)) &&
            isFinite(parseFloat(sampleValue)));
        const isDate =
          typeof sampleValue === "string" &&
          /^\d{4}-\d{2}-\d{2}/.test(sampleValue);

        console.log(
          `Column ${field}: type=${
            isDate ? "date" : isNumeric ? "number" : "string"
          }, sample value=${sampleValue}`
        );

        // Create column definition with human-readable header names
        let headerName =
          field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, " ");

        // Use more descriptive names for specific fields
        const headerNameMap = {
          dot: "DOT",
          product: "Product",
          amount_pre_tax: "Amount (Pre-tax)",
          tax_amount: "Tax Amount",
          total_amount: "Total Amount",
          discount: "Discount",
          created_at: "Created At",
          updated_at: "Updated At",
        };

        if (headerNameMap[field]) {
          headerName = headerNameMap[field];
        }

        columns.push({
          field,
          headerName,
          flex: 1,
          minWidth: 150,
          align: isNumeric ? "right" : "left",
          headerAlign: "center",
          type: isDate ? "dateTime" : isNumeric ? "number" : "string",
          valueFormatter: (params) => {
            // Handle null/undefined values
            if (params?.value == null || params?.value === "") {
              return "";
            }

            // Handle object values
            if (typeof params.value === "object") {
              try {
                return JSON.stringify(params.value);
              } catch (error) {
                console.error(`Error stringifying object for ${field}:`, error);
                return "[Complex Object]";
              }
            }

            // Format date fields
            if (isDate) {
              try {
                return new Date(params.value).toLocaleDateString("fr-FR");
              } catch (error) {
                console.error(`Error formatting date for ${field}:`, error);
                return String(params.value || "");
              }
            }

            // Format currency fields
            if (
              field.includes("amount") ||
              field.includes("tax") ||
              field.includes("total") ||
              field.includes("discount")
            ) {
              try {
                return new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "DZD",
                  minimumFractionDigits: 2,
                }).format(Number(params.value));
              } catch (error) {
                console.error(`Error formatting value for ${field}:`, error);
                return String(params.value || "");
              }
            }

            // Return the value as is for other fields
            return String(params.value || "");
          },
        });
      });
    } else {
      // For other file types, use the existing column generation logic
      Object.keys(databaseData[0] || {})
        .filter((field) => field !== "id") // Exclude the id field as we've already added it
        .forEach((field) => {
          // Determine the field type based on the data
          const sampleValue = databaseData[0][field];
          const isNumeric =
            typeof sampleValue === "number" ||
            (typeof sampleValue === "string" &&
              !isNaN(parseFloat(sampleValue)) &&
              isFinite(parseFloat(sampleValue)));
          const isDate =
            typeof sampleValue === "string" &&
            /^\d{4}-\d{2}-\d{2}/.test(sampleValue);

          console.log(
            `Column ${field}: type=${
              isDate ? "date" : isNumeric ? "number" : "string"
            }, sample value=${sampleValue}`
          );

          // Create column definition
          columns.push({
            field,
            headerName:
              field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, " "),
            flex: 1,
            minWidth: 150,
            align: isNumeric ? "right" : "left",
            headerAlign: "center",
            type: isDate ? "dateTime" : isNumeric ? "number" : "string",
            valueFormatter: (params) => {
              // Handle null/undefined values
              if (params?.value == null || params?.value === "") {
                return "";
              }

              // Handle object values
              if (typeof params.value === "object") {
                try {
                  return JSON.stringify(params.value);
                } catch (error) {
                  console.error(
                    `Error stringifying object for ${field}:`,
                    error
                  );
                  return "[Complex Object]";
                }
              }

              // Format currency fields
              if (
                isNumeric &&
                (field.includes("amount") ||
                  field.includes("tax") ||
                  field.includes("total") ||
                  field.includes("price"))
              ) {
                return new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "DZD",
                }).format(parseFloat(params.value));
              }

              return params.value;
            },
          });
        });
    }

    return (
      <Box sx={{ height: "calc(100vh - 200px)", width: "100%", p: 2 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">
            Showing {databaseData.length} records from the database
          </Typography>
        </Box>
        <div style={{ height: "100%", width: "100%" }}>
          {(() => {
            try {
              console.log(
                "______________database____________________________________________________________"
              );
              console.log("Final columns array:", columns);
              console.log("Data being passed to DataGrid:", {
                rowCount: processedDatabaseData.length,
                sampleRows: processedDatabaseData.slice(0, 3),
                columnCount: columns.length,
                columnFields: columns.map((col) => col.field),
              });

              // Check if the data has the fields that match the column definitions
              const firstRow = processedDatabaseData[0] || {};
              const missingFields = columns
                .map((col) => col.field)
                .filter((field) => !(field in firstRow));

              console.log("Fields missing in database data:", missingFields);

              if (missingFields.length > 0) {
                console.warn(
                  "Some column fields are missing in the database data. This may cause rendering issues."
                );
              }

              console.log(
                "______________database____________________________________________________________"
              );
              return (
                <Box sx={{ width: "100%", overflow: "auto" }}>
                  <Paper sx={{ width: "100%", mb: 2 }}>
                    <Toolbar
                      sx={{
                        pl: { sm: 2 },
                        pr: { xs: 1, sm: 1 },
                      }}
                    >
                      <Typography
                        sx={{ flex: "1 1 100%" }}
                        variant="h6"
                        id="tableTitle"
                        component="div"
                      >
                        Database Data
                      </Typography>
                      <Tooltip title="Filter list">
                        <IconButton>
                          <InfoOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </Toolbar>
                    <TableContainer sx={{ maxHeight: "calc(100vh - 300px)" }}>
                      <Table stickyHeader aria-label="database data table">
                        <TableHead>
                          <TableRow>
                            {columns.map((column) => {
                              // Safe access to properties with type checking
                              let align = "left";
                              if ("align" in column) {
                                align = String(column.align);
                              } else if ("headerAlign" in column) {
                                align = String(column.headerAlign);
                              }

                              let width = 100;
                              if ("minWidth" in column) {
                                width = Number(column.minWidth);
                              } else if ("width" in column) {
                                width = Number(column.width);
                              }

                              return (
                                <TableCell
                                  key={column.field}
                                  align={
                                    align === "right"
                                      ? "right"
                                      : align === "center"
                                      ? "center"
                                      : "left"
                                  }
                                  style={{
                                    minWidth: width,
                                    fontWeight: "bold",
                                  }}
                                >
                                  {column.headerName}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {processedDatabaseData
                            .slice(
                              dbPage * dbRowsPerPage,
                              dbPage * dbRowsPerPage + dbRowsPerPage
                            )
                            .map((row) => (
                              <TableRow
                                hover
                                role="checkbox"
                                tabIndex={-1}
                                key={row.id}
                              >
                                {columns.map((column) => {
                                  const value = row[column.field];

                                  // Safe access to properties with type checking
                                  let align = "left";
                                  if ("align" in column) {
                                    align = String(column.align);
                                  } else if ("headerAlign" in column) {
                                    align = String(column.headerAlign);
                                  }

                                  let width = 100;
                                  if ("minWidth" in column) {
                                    width = Number(column.minWidth);
                                  } else if ("width" in column) {
                                    width = Number(column.width);
                                  }

                                  return (
                                    <TableCell
                                      key={column.field}
                                      align={
                                        align === "right"
                                          ? "right"
                                          : align === "center"
                                          ? "center"
                                          : "left"
                                      }
                                      style={{ minWidth: width }}
                                    >
                                      {column.valueFormatter
                                        ? column.valueFormatter({ value })
                                        : safeToString(value)}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Box
                      sx={{ display: "flex", justifyContent: "flex-end", p: 2 }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ mr: 2, alignSelf: "center" }}
                      >
                        Rows per page:
                      </Typography>
                      <select
                        value={dbRowsPerPage}
                        onChange={(e) =>
                          setDbRowsPerPage(Number(e.target.value))
                        }
                        style={{ marginRight: "20px", padding: "5px" }}
                      >
                        {[10, 25, 50, 100].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <Typography
                        variant="caption"
                        sx={{ mr: 2, alignSelf: "center" }}
                      >
                        {dbPage * dbRowsPerPage + 1}-
                        {Math.min(
                          (dbPage + 1) * dbRowsPerPage,
                          processedDatabaseData.length
                        )}{" "}
                        of {processedDatabaseData.length}
                      </Typography>
                      <IconButton
                        disabled={dbPage === 0}
                        onClick={() => setDbPage(dbPage - 1)}
                      >
                        <ArrowBackIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        disabled={
                          (dbPage + 1) * dbRowsPerPage >=
                          processedDatabaseData.length
                        }
                        onClick={() => setDbPage(dbPage + 1)}
                      >
                        <ArrowBackIcon
                          fontSize="small"
                          style={{ transform: "rotate(180deg)" }}
                        />
                      </IconButton>
                    </Box>
                  </Paper>
                </Box>
              );
            } catch (error) {
              console.error("Error rendering DataGrid:", error);
              return (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Error displaying data: {error.message}
                </Alert>
              );
            }
          })()}
        </div>
      </Box>
    );
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading file data...
        </Typography>
        <Box sx={{ width: "50%", mt: 2 }}>
          <LinearProgress variant="determinate" value={fetchProgress} />
          <Typography
            variant="caption"
            align="center"
            display="block"
            sx={{ mt: 1 }}
          >
            {fetchProgress}% complete
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <Typography variant="h6" color="error">
          Error: {error}
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/file-upload")}
          sx={{ mt: 2 }}
        >
          Back to File Upload
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate("/file-upload")}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            File Processing: {fileName}
          </Typography>

          {fileType && (
            <Chip
              label={getFileTypeDisplayName(fileType)}
              color="primary"
              sx={{ mr: 2 }}
            />
          )}

          <Tooltip title="Delete File">
            <IconButton
              color="error"
              onClick={() => setOpenDeleteDialog(true)}
              sx={{ mr: 1 }}
              disabled={isDeleting}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Process File">
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              onClick={handleProcess}
              disabled={isProcessing}
              sx={{ mr: 1 }}
            >
              {isProcessing ? (
                <>
                  Processing...
                  <CircularProgress size={24} sx={{ ml: 1, color: "white" }} />
                </>
              ) : (
                "Process"
              )}
            </Button>
          </Tooltip>
          <Tooltip title="Save to Database">
            <Button
              variant="contained"
              color="success"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  Saving...
                  <CircularProgress size={24} sx={{ ml: 1, color: "white" }} />
                </>
              ) : (
                "Save"
              )}
            </Button>
          </Tooltip>
        </Toolbar>
        <Tabs value={activeTab} onChange={handleTabChange} centered>
          <Tab
            label="Data Summary"
            icon={<InfoOutlinedIcon />}
            iconPosition="start"
          />
          <Tab
            label="Data Preview"
            icon={<TableChartIcon />}
            iconPosition="start"
          />
          <Tab
            label="Database Preview"
            icon={<DatabaseIcon />}
            iconPosition="start"
          />
        </Tabs>
      </AppBar>

      {successMessage && (
        <Alert
          severity="success"
          sx={{ m: 2 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {isSaving && (
        <Box sx={{ width: "100%", px: 2 }}>
          <LinearProgress variant="determinate" value={saveProgress} />
          <Typography
            variant="caption"
            align="center"
            display="block"
            sx={{ mt: 0.5 }}
          >
            Saving data: {saveProgress}% complete
          </Typography>
        </Box>
      )}

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        {activeTab === 0 && renderDataSummary()}
        {activeTab === 1 && renderDataPreview()}
        {activeTab === 2 && renderDatabasePreview()}
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Confirm File Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete this file and all associated data?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)} color="primary">
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={isDeleting}
            startIcon={
              isDeleting ? <CircularProgress size={20} /> : <DeleteIcon />
            }
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

FileProcessingView.propTypes = {
  fileId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default FileProcessingView;
