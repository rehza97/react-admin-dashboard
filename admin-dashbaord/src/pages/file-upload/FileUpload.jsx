import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  LinearProgress,
  Typography,
  Paper,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  useTheme,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Tooltip,
  Divider,
  FormControl,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  InputLabel,
  Snackbar,
} from "@mui/material";
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
} from "@mui/icons-material";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import PropTypes from "prop-types";
import dataService from "../../services/dataService";
import { useAuth } from "../../context/AuthContext";
import { fileService } from "../../services/fileService";
import PageLayout from "../../components/PageLayout";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import SaveIcon from "@mui/icons-material/Save";
import DataPreviewDialog from "../../components/DataPreviewDialog";
import FileUploadDropzone from "../../components/FileUploadDropzone";
import FileListTable from "../../components/FileListTable";
import ProcessingLogs from "../../components/ProcessingLogs";

const FileUpload = () => {
  const { currentUser } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [remainingTime, setRemainingTime] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editedFileName, setEditedFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorMessages, setErrorMessages] = useState({
    fileType: "",
    fileSize: "",
    uploadError: "",
  });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedInvoiceNumber, setEditedInvoiceNumber] = useState("");
  const [status, setStatus] = useState("pending");
  const [selectedFileForProcessing, setSelectedFileForProcessing] =
    useState(null);
  const [processingOptions, setProcessingOptions] = useState({
    remove_duplicates: true,
    handle_missing: true,
    filters: [],
    transforms: [],
  });
  const [processedPreview, setProcessedPreview] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingError, setProcessingError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [processingLogs, setProcessingLogs] = useState([]);
  const [fileInspection, setFileInspection] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [summaryData, setSummaryData] = useState({});
  const [downloadingFiles, setDownloadingFiles] = useState({});
  const [processingFiles, setProcessingFiles] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const theme = useTheme();

  // API URLs - centralized to make changes easier
  const API_URLS = {
    UPLOAD: "/data/upload-facturation/",
    LIST: "/data/api/facturation/",
    DETAIL: (id) => `/data/api/facturation/${id}/`,
    DOWNLOAD: (id) => `/data/api/facturation/${id}/download/`,
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to access this feature");
      return;
    }
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fileService.getFiles();
      setUploadedFiles(response);
    } catch (error) {
      if (error.response?.status === 401) {
        setError("Please log in to access this feature");
      } else {
        setError(error.response?.data?.error || "Failed to fetch files");
      }
      setUploadedFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const validateFile = (file) => {
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];

    // Reset error messages first
    setErrorMessages({
      fileType: "",
      fileSize: "",
      uploadError: "",
    });

    // Check file type
    if (
      !validTypes.includes(file.type) &&
      !file.name.endsWith(".csv") &&
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls")
    ) {
      setErrorMessages((prev) => ({
        ...prev,
        fileType: "Invalid file type. Please upload Excel or CSV files only.",
      }));
      console.log(`Invalid file type: ${file.type} for file ${file.name}`);
      return false;
    }

    // Check file size
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessages((prev) => ({
        ...prev,
        fileSize: "File size must be less than 5MB",
      }));
      console.log(`File too large: ${file.size} bytes for file ${file.name}`);
      return false;
    }

    console.log(`File validated successfully: ${file.name}`);
    return true;
  };

  const onDrop = (acceptedFiles) => {
    console.log("Files dropped in FileUpload:", acceptedFiles);
    
    if (!acceptedFiles || acceptedFiles.length === 0) {
      console.log("No files received in onDrop");
      setErrorMessages((prev) => ({
        ...prev,
        uploadError: "No files were received. Please try again.",
      }));
      return;
    }
    
    // Manually validate each file
    const validFiles = [];
    for (const file of acceptedFiles) {
      if (validateFile(file)) {
        validFiles.push(file);
      }
    }
    
    console.log("Valid files after validation:", validFiles);
    
    if (validFiles.length === 0) {
      console.log("No valid files found");
      setErrorMessages((prev) => ({
        ...prev,
        uploadError: "No valid files found. Please check file types and sizes.",
      }));
      return;
    }
    
    // Add valid files to state
    setFiles((prev) => [...prev, ...validFiles]);
    console.log("Files added to state:", validFiles);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    // Remove the validator prop as it's causing issues
    // multiple: true is the default
    multiple: true,
  });

  const handleUpload = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to access this feature");
      return;
    }

    if (files.length === 0) {
      setError("No files to upload. Please add files first.");
      return;
    }

    setIsUploading(true);
    setUploadError({});
    let uploadedCount = 0;

    for (const file of files) {
      try {
        console.log(`Starting upload for file: ${file.name}`);

        // Generate a unique invoice number
        const invoiceNumber = `INV-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Set initial progress
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 0,
        }));

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            const currentProgress = prev[file.name] || 0;
            if (currentProgress < 90) {
              return {
                ...prev,
                [file.name]: currentProgress + 10,
              };
            }
            return prev;
          });
        }, 300);

        // Upload the file
        await fileService.uploadFile(file, invoiceNumber);

        // Clear interval and set progress to 100%
        clearInterval(progressInterval);
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 100,
        }));

        // Show success message
        setUploadError((prev) => ({
          ...prev,
          [file.name]: {
            type: "success",
            message: "Upload successful",
          },
        }));

        uploadedCount++;
        console.log(`File uploaded successfully: ${file.name}`);
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);

        // Set error message based on the error
        let errorMessage = "Upload failed";

        if (error.response) {
          if (error.response.status === 400) {
            errorMessage =
              error.response.data.detail || "Invalid file format or data";
          } else if (error.response.status === 401) {
            errorMessage = "Authentication required. Please log in again.";
          } else if (error.response.status === 413) {
            errorMessage = "File too large for server";
          } else {
            errorMessage =
              error.response.data.detail ||
              `Server error (${error.response.status})`;
          }
        } else if (error.request) {
          errorMessage = "No response from server. Check your connection.";
        } else {
          errorMessage = error.message || "Unknown error occurred";
        }

        setUploadError((prev) => ({
          ...prev,
          [file.name]: {
            type: "error",
            message: errorMessage,
          },
        }));

        // Set progress to indicate error
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 0,
        }));
      }
    }

    // Show overall success message if any files were uploaded
    if (uploadedCount > 0) {
      showSuccessMessage(`${uploadedCount} file(s) uploaded successfully`);

      // Clear successfully uploaded files from the queue
      setFiles((prev) =>
        prev.filter(
          (file) =>
            !uploadProgress[file.name] || uploadProgress[file.name] < 100
        )
      );

      // Refresh the file list
      await fetchUploadedFiles();
    }

    setIsUploading(false);
  };

  const handleConfirmDelete = (id) => {
    // Make sure id is a number, not an object
    if (typeof id === "object" && id !== null) {
      id = id.id; // Extract the ID if an object was passed
    }

    setSelectedFile({ id: id, action: "delete" });
    setOpenDialog(true);
  };

  const handleEdit = (file) => {
    setSelectedFile(file);
    setEditedInvoiceNumber(file.invoice_number);
    setEditDialogOpen(true);
  };

  const handleDownload = async (id, fileName) => {
    try {
      // Set downloading state for this file
      setDownloadingFiles((prev) => ({
        ...prev,
        [id]: true,
      }));

      const response = await fileService.downloadFile(id);

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Show success message
      showSuccessMessage(`File "${fileName}" downloaded successfully`);
    } catch (error) {
      handleDownloadError(error, fileName);
    } finally {
      // Clear downloading state for this file
      setDownloadingFiles((prev) => ({
        ...prev,
        [id]: false,
      }));
    }
  };

  const handleDelete = async (file) => {
    try {
      setIsLoading(true);
      // Extract the ID from the file object
      const fileId = file.id;

      if (!fileId) {
        throw new Error("Invalid file ID");
      }

      await fileService.deleteFile(fileId);

      // Remove the file from the list
      setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId));

      // Show success message
      showSuccessMessage(`File ${file.invoice_number} deleted successfully`);
    } catch (error) {
      handleDeleteError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDialog = async () => {
    if (!selectedFile) return;

    try {
      setIsLoading(true);

      if (selectedFile.action === "delete") {
        const fileId = selectedFile.id;

        // Ensure we have a valid ID
        if (!fileId || typeof fileId === "object") {
          throw new Error("Invalid file ID");
        }

        await fileService.deleteFile(fileId);
        setUploadedFiles(uploadedFiles.filter((f) => f.id !== fileId));
        showSuccessMessage("File deleted successfully");
      } else if (selectedFile.action === "edit") {
        // Handle edit action
        await fileService.updateFile(selectedFile.id, {
          invoice_number: editedInvoiceNumber,
          status: status,
        });

        // Refresh the file list
        await fetchUploadedFiles();

        setEditDialogOpen(false);
      }

      setOpenDialog(false);
    } catch (error) {
      setError("Failed to delete file. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelUpload = (fileName) => {
    setFiles(files.filter((file) => file.name !== fileName));
    setUploadProgress((prev) => {
      const newProgress = { ...prev };
      delete newProgress[fileName];
      return newProgress;
    });
    setRemainingTime((prev) => {
      const newTimes = { ...prev };
      delete newTimes[fileName];
      return newTimes;
    });
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const formatFileSize = (size) => {
    return formatBytes(size);
  };

  const renderFileList = () => {
    if (!Array.isArray(uploadedFiles) || uploadedFiles.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={5} align="center">
            No files uploaded yet
          </TableCell>
        </TableRow>
      );
    }

    return uploadedFiles.map((file) => (
      <TableRow key={file.id || file.invoice_number}>
        <TableCell>{file.invoice_number}</TableCell>
        <TableCell>{formatDate(file.upload_date)}</TableCell>
        <TableCell>{formatFileSize(file.file_size || 0)}</TableCell>
        <TableCell>{renderStatus(file.status)}</TableCell>
        <TableCell>{renderActions(file)}</TableCell>
      </TableRow>
    ));
  };

  const renderFileUploadStatus = (file) => {
    const error = uploadError[file.name];
    const progress = uploadProgress[file.name] || 0;
    const remaining = remainingTime[file.name];

    return (
      <Box
        key={file.name}
        sx={{ mb: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 1 }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography>{file.name}</Typography>
          <Typography>{formatBytes(file.size)}</Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mt: 1,
            mb: 1,
            "& .MuiLinearProgress-bar": {
              backgroundColor:
                error?.type === "error"
                  ? "error.main"
                  : error?.type === "success"
                  ? "success.main"
                  : "primary.main",
            },
          }}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
          <Typography variant="body2" color="textSecondary">
            {progress}% uploaded
            {remaining > 0 && ` - ${remaining} seconds remaining`}
          </Typography>
          {error && (
            <Typography
              variant="body2"
              color={error.type === "error" ? "error" : "success.main"}
            >
              {error.message}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const dropzoneStyles = {
    border: `2px dashed ${
      isDragActive ? theme.palette.primary.main : theme.palette.divider
    }`,
    borderRadius: 2,
    p: 4,
    mb: 3,
    backgroundColor: isDragActive
      ? alpha(theme.palette.primary.main, 0.05)
      : theme.palette.background.default,
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      borderColor: theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.primary.main, 0.05),
    },
  };

  const handleProcess = (file) => {
    // Set both selectedFile and selectedFileForProcessing to ensure consistency
    setSelectedFile(file);
    setSelectedFileForProcessing(file);
    setProcessingStep(0);
    setProcessedPreview(null);
    setProcessingError(null);
    setProcessingOptions({
      remove_duplicates: true,
      handle_missing: true,
      filters: [],
      transforms: [],
    });

    // Automatically inspect the file when opening the dialog
    setTimeout(() => {
      inspectFile();
    }, 500);
  };

  const inspectFile = async () => {
    try {
      // Check for either selectedFile or selectedFileForProcessing
      const fileToInspect = selectedFile || selectedFileForProcessing;

      if (!fileToInspect) {
        setError("No file selected for inspection");
        addProcessingLog("error", "No file selected for inspection");
        return;
      }

      setProcessingLogs([]);
      addProcessingLog(
        "info",
        `Inspecting file: ${fileToInspect.invoice_number}`
      );

      // Call the inspect API endpoint
      const response = await fileService.inspectFile(fileToInspect.id);

      if (response.error) {
        addProcessingLog("error", `Inspection failed: ${response.error}`);
        setError(`File inspection failed: ${response.error}`);
        return;
      }

      // Successfully inspected the file
      setFileInspection(response);

      // Set preview data from the sample data in the response
      setPreviewData(response.sample_data || []);

      // Set summary data from the response
      setSummaryData({
        row_count: response.row_count,
        column_count: response.column_count,
        columns: response.columns,
        header_row: response.header_row,
      });

      addProcessingLog("success", "File inspection completed successfully");
      addProcessingLog(
        "info",
        `Found ${response.row_count} rows and ${response.column_count} columns`
      );

      if (response.header_row && response.header_row > 1) {
        addProcessingLog(
          "info",
          `Header detected in row ${response.header_row}`
        );
      }

      // Show columns of interest
      const targetColumns = [
        "Dépts",
        "Exercices",
        "Montant HT",
        "Montant TTC",
        "Désignations",
      ];
      const foundColumns = response.columns.filter((col) =>
        targetColumns.includes(col.name)
      );

      if (foundColumns.length > 0) {
        addProcessingLog(
          "success",
          `Found ${foundColumns.length} of ${targetColumns.length} target columns`
        );
        foundColumns.forEach((col) => {
          addProcessingLog(
            "info",
            `Column "${col.name}" of type ${col.type} found`
          );
        });
      } else {
        addProcessingLog(
          "warning",
          "None of the target columns were found in the file"
        );
      }

      // Open the preview dialog if not already open
      if (!previewDialogOpen) {
        setPreviewDialogOpen(true);
      }
    } catch (error) {
      console.error("File inspection error:", error);
      setError(`Error inspecting file: ${error.message || "Unknown error"}`);
      addProcessingLog(
        "error",
        `Inspection failed: ${error.message || "Unknown error"}`
      );
    }
  };

  const processFile = async () => {
    setIsProcessing(true);
    setProcessingError(null);
    setProcessingLogs([]);

    // Add log entry
    addProcessingLog("info", "Starting file processing...");

    try {
      addProcessingLog(
        "info",
        `Processing file: ${selectedFileForProcessing.invoice_number}`
      );
      addProcessingLog(
        "info",
        `Processing options: ${JSON.stringify(processingOptions)}`
      );

      const result = await fileService.processFile(
        selectedFileForProcessing.id,
        { processing_options: processingOptions }
      );

      setProcessedPreview(result);
      setProcessingStep(1); // Move to preview step

      addProcessingLog("success", "Processing completed successfully");
      addProcessingLog("info", `Processed ${result.summary.row_count} rows`);

      // Show success message
      showSuccessMessage("File processed successfully");

      // Refresh the file list to update statuses
      await fetchUploadedFiles();
    } catch (error) {
      handleProcessError(error);
    } finally {
      setIsProcessing(false);

      // Clear processing state for this file
      if (selectedFileForProcessing) {
        setProcessingFiles((prev) => ({
          ...prev,
          [selectedFileForProcessing.id]: false,
        }));
      }
    }
  };

  const saveToDatabase = async () => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      await fileService.saveToDatabase(selectedFileForProcessing.id);
      setProcessingStep(2); // Move to completed step

      // Show success message
      showSuccessMessage("Data saved to database successfully");

      // Refresh the file list to update statuses
      await fetchUploadedFiles();
    } catch (error) {
      handleSaveError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add this utility function to get color for status chips
  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
      case "saved":
        return "success";
      case "processing":
      case "preview":
        return "primary";
      case "failed":
        return "error";
      default:
        return "default";
    }
  };

  // Add this inside the component body
  const renderStatus = (status) => {
    return (
      <Chip
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        color={getStatusColor(status)}
        size="small"
        sx={{
          minWidth: 90,
          "& .MuiChip-label": {
            fontWeight: 500,
          },
        }}
      />
    );
  };

  const handlePreviewClick = async (file) => {
    // Set both variables for consistency
    setSelectedFile(file);
    setSelectedFileForProcessing(file);

    // Reset processing state
    setProcessingLogs([]);
    setPreviewData([]);
    setSummaryData({});

    try {
      // Inspect the file
      await inspectFile();
    } catch (error) {
      console.error("Error previewing file:", error);
      setError(`Error previewing file: ${error.message || "Unknown error"}`);
    }
  };

  const renderActions = (file) => {
    return (
      <Box sx={{ display: "flex" }}>
        <Tooltip title="Download">
          <IconButton
            color="primary"
            size="small"
            onClick={() => handleDownload(file.id, file.invoice_number)}
            disabled={isUploading}
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {["preview", "saved"].includes(file.status) && (
          <Tooltip title="Preview Data">
            <IconButton
              color="info"
              size="small"
              onClick={() => handlePreviewClick(file)}
              disabled={isUploading}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Edit">
          <IconButton
            color="secondary"
            size="small"
            onClick={() => handleEdit(file)}
            disabled={isUploading}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {["pending", "failed"].includes(file.status) && (
          <Tooltip title="Process">
            <IconButton
              color="success"
              size="small"
              onClick={() => handleProcess(file)}
              disabled={isUploading || file.status === "processing"}
            >
              <PlayArrowIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Delete">
          <IconButton
            color="error"
            size="small"
            onClick={() => {
              setSelectedFile({ ...file, action: "delete" });
              setOpenDialog(true);
            }}
            disabled={isUploading}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  // Helper function to add log entries
  const addProcessingLog = (level, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setProcessingLogs((prev) => [...prev, { level, message, timestamp }]);
  };

  // Handle process error
  const handleProcessError = (error) => {
    const errorMsg = error.response?.data?.error || "Error processing file";
    setProcessingError(errorMsg);
    addProcessingLog("error", `Processing failed: ${errorMsg}`);
    console.error("Error processing file:", error);
    setError(`Failed to process file: ${errorMsg}`);
  };

  // Handle save error
  const handleSaveError = (error) => {
    const errorMsg = error.response?.data?.error || "Error saving to database";
    setProcessingError(errorMsg);
    console.error("Error saving to database:", error);
    setError(`Failed to save to database: ${errorMsg}`);
  };

  // Handle download error
  const handleDownloadError = (error, fileName) => {
    console.error("Download error:", error);

    if (error.response?.status === 404) {
      setError(`File "${fileName}" not found on the server`);
    } else if (error.response?.status === 403) {
      setError(`You don't have permission to download this file`);
    } else {
      setError(
        `Failed to download file "${fileName}". Please try again later.`
      );
    }
  };

  // Show success message
  const showSuccessMessage = (message) => {
    setSuccessMessage(message);
    setSnackbarOpen(true);
  };

  // Close snackbar
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  return (
    <PageLayout
      title="File Upload"
      subtitle="Upload and manage your invoice files"
      maxWidth="1200"
      headerAction={
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading}
        >
          {isUploading ? (
            <>
              <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
              Uploading...
            </>
          ) : (
            "Upload"
          )}
        </Button>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {errorMessages.fileType && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() =>
            setErrorMessages((prev) => ({ ...prev, fileType: "" }))
          }
        >
          {errorMessages.fileType}
        </Alert>
      )}

      {errorMessages.fileSize && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() =>
            setErrorMessages((prev) => ({ ...prev, fileSize: "" }))
          }
        >
          {errorMessages.fileSize}
        </Alert>
      )}

      <FileUploadDropzone
        onDrop={onDrop}
        files={files}
        isUploading={isUploading}
        errorMessages={errorMessages}
        validateFile={validateFile}
      />

      <FileListTable
        uploadedFiles={uploadedFiles}
        isUploading={isUploading}
        handleFileProcess={handleProcess}
        handleFilePreview={handlePreviewClick}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        handleDownload={handleDownload}
        getStatusColor={getStatusColor}
        formatDate={formatDate}
        formatFileSize={formatFileSize}
        downloadingFiles={downloadingFiles}
        processingFiles={processingFiles}
      />

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          {selectedFile?.action === "delete"
            ? "Confirm Delete"
            : "Edit Invoice Number"}
        </DialogTitle>
        <DialogContent>
          {selectedFile?.action === "delete" ? (
            <Typography>
              Are you sure you want to delete this invoice?
            </Typography>
          ) : (
            <TextField
              autoFocus
              margin="dense"
              label="Invoice Number"
              fullWidth
              variant="outlined"
              value={editedInvoiceNumber}
              onChange={(e) => setEditedInvoiceNumber(e.target.value)}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleConfirmDialog}
            color={selectedFile?.action === "delete" ? "error" : "primary"}
          >
            {selectedFile?.action === "delete" ? "Delete" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit Invoice Number</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Invoice Number"
            fullWidth
            value={editedInvoiceNumber}
            onChange={(e) => setEditedInvoiceNumber(e.target.value)}
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            fullWidth
            margin="dense"
          >
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="preview">Preview</MenuItem>
            <MenuItem value="saved">Saved to Database</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDialog} color="primary">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      <DataPreviewDialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        previewData={previewData}
        summaryData={summaryData}
        processingLogs={processingLogs}
        onProcess={() => {
          if (selectedFileForProcessing) {
            processFile();
          } else if (selectedFile) {
            setSelectedFileForProcessing(selectedFile);
            processFile();
          } else {
            setError("No file selected for processing");
          }
          setPreviewDialogOpen(false);
        }}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={successMessage}
      />
    </PageLayout>
  );
};

FileUpload.propTypes = {
  // Add any props if needed
};

export default FileUpload;
