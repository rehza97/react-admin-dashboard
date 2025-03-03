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
import fileService from "../../services/fileService";
import PageLayout from "../../components/PageLayout";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterListIcon from "@mui/icons-material/FilterList";
import SaveIcon from "@mui/icons-material/Save";
import FileUploadDropzone from "../../components/FileUploadDropzone";
import FileListTable from "../../components/FileListTable";
import ProcessingLogs from "../../components/ProcessingLogs";
import { useNavigate } from "react-router-dom";

const FileUpload = () => {
  const { currentUser } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [remainingTime, setRemainingTime] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editedInvoiceNumber, setEditedInvoiceNumber] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorMessages, setErrorMessages] = useState({
    fileType: "",
    fileSize: "",
    general: "",
  });

  // Processing options for file processing
  const [processingOptions, setProcessingOptions] = useState({
    remove_duplicates: true,
    handle_missing: "fill_zeros",
    filters: [],
    transforms: [],
  });

  const [downloadingFiles, setDownloadingFiles] = useState({});
  const [processingFiles, setProcessingFiles] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  const theme = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to access this feature");
      return;
    }
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    try {
      setIsLoading(true);
      const data = await fileService.getUploadedFiles();
      setUploadedFiles(data);
      console.log("Fetched files:", data);
    } catch (error) {
      console.error("Error fetching files:", error);
      setError("Failed to fetch files. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const validateFile = (file) => {
    setError("");
    console.log("Validating file:", file.name, file.type, file.size);

    // Check file type
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
      "application/csv",
      "text/plain", // Some CSV files might be detected as text/plain
    ];

    const validExtensions = [".csv", ".xlsx", ".xls"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    if (
      !validTypes.includes(file.type) &&
      !validExtensions.includes(fileExtension)
    ) {
      const errorMsg = `Invalid file type: ${
        file.type || fileExtension
      }. Please upload a CSV or Excel file.`;
      console.error(errorMsg);
      setError(errorMsg);
      return false;
    }

    // Remove file size limit
    // if (file.size > 5 * 1024 * 1024) { // 5MB
    //   const errorMsg = `File size too large: ${formatBytes(file.size)}. Maximum size is 5MB.`;
    //   console.error(errorMsg);
    //   setError(errorMsg);
    //   return false;
    // }

    console.log("File validated successfully:", file.name);
    return true;
  };

  const onDrop = (acceptedFiles) => {
    console.log("onDrop called with files:", acceptedFiles);

    if (!acceptedFiles || acceptedFiles.length === 0) {
      console.error("No files received in onDrop");
      setError("No files were received. Please try again.");
      return;
    }

    // Reset error messages
    setError("");
    setErrorMessages({
      fileType: "",
      fileSize: "",
      general: "",
    });

    // Validate each file and add valid ones to the state
    const validFiles = [];

    for (const file of acceptedFiles) {
      if (validateFile(file)) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      console.error("No valid files found");
      setError("No valid files found. Please check the file types and sizes.");
      return;
    }

    console.log("Valid files:", validFiles);
    setFiles((prevFiles) => [...prevFiles, ...validFiles]);
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
        });

        // Refresh the file list
        await fetchUploadedFiles();
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
    setProcessingOptions({
      remove_duplicates: true,
      handle_missing: "fill_zeros",
      filters: [],
      transforms: [],
    });

    // Automatically inspect the file when opening the dialog
    setTimeout(() => {
      inspectFile();
    }, 500);
  };

  const inspectFile = async (fileId) => {
    console.log("Inspecting file with ID:", fileId);

    if (!fileId) {
      console.error("No file ID provided for inspection");
      setError("No file ID provided for inspection");
      return;
    }

    try {
      // Call the API to inspect the file
      const response = await fileService.inspectFile(fileId);
      console.log("Inspection response:", response);

      if (response && response.data) {
        if (response.data.preview_data) {
          setPreviewData(response.data.preview_data);
        } else {
          setPreviewData([]);
          console.warn("No preview data received");
        }

        if (response.data.summary_data) {
          setSummaryData(response.data.summary_data);
        } else {
          setSummaryData({});
          console.warn("No summary data received");
        }

        // Set the file inspection data
        setFileInspection(response.data);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Error inspecting file:", error);
      setError("Failed to inspect file. Please try again.");
    }
  };

  const processFile = async () => {
    console.log(
      "Processing file with selectedFileForProcessing:",
      selectedFileForProcessing
    );

    if (!selectedFileForProcessing || !selectedFileForProcessing.id) {
      console.error("No file selected for processing");
      setError("No file selected for processing");
      return;
    }

    const fileId = selectedFileForProcessing.id;
    console.log("Processing file with ID:", fileId);

    // Set processing state for this file
    setProcessingFiles((prev) => ({
      ...prev,
      [fileId]: true,
    }));

    // Clear any previous errors
    setError(null);

    try {
      // Add a log to track the processing
      addProcessingLog(
        "info",
        `Starting processing for file: ${
          selectedFileForProcessing.invoice_number || fileId
        }`
      );

      // Get processing options
      const options = {
        processingMode: "automatic", // or 'manual'
        treatment: "", // e.g., 'standard_facturation_manuelle'
        fileType: summaryData?.detected_file_type || "",
        remove_duplicates: processingOptions.remove_duplicates,
        handle_missing: processingOptions.handle_missing,
        filters: processingOptions.filters,
        transforms: processingOptions.transforms,
      };

      // Call the API to process the file
      const response = await fileService.processFile(fileId, options);
      console.log("Process API response:", response);

      if (response && response.data) {
        // Update the preview data with the processed data
        if (response.data.preview_data) {
          setPreviewData(response.data.preview_data);
        }

        // Update the summary data
        if (response.data.summary_data) {
          setSummaryData(response.data.summary_data);
        }

        // Update the file status in the list
        setUploadedFiles((prevFiles) =>
          prevFiles.map((file) =>
            file.id === fileId ? { ...file, status: "preview" } : file
          )
        );

        // Add a success log
        addProcessingLog("success", "Processing completed successfully");
        if (response.data.summary && response.data.summary.row_count) {
          addProcessingLog(
            "info",
            `Processed ${response.data.summary.row_count} rows`
          );
        }

        // Show success message
        showSuccessMessage("File processed successfully");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      handleProcessError(error);
    } finally {
      // Reset processing state for this file
      setProcessingFiles((prev) => ({
        ...prev,
        [fileId]: false,
      }));
    }
  };

  const saveToDatabase = async () => {
    console.log(
      "Saving to database with selectedFileForProcessing:",
      selectedFileForProcessing
    );

    if (!selectedFileForProcessing || !selectedFileForProcessing.id) {
      console.error("No file selected for saving to database");
      setError("No file selected for saving to database");
      return;
    }

    const fileId = selectedFileForProcessing.id;
    console.log("Saving file to database with ID:", fileId);

    setIsSaving(true);
    setError(null);

    try {
      // Add a log to track the saving process
      addProcessingLog(
        "info",
        `Starting database save for file: ${
          selectedFileForProcessing.invoice_number || fileId
        }`
      );

      // Prepare the data to send to the backend
      const dataToSave = {
        processed_data: true, // Indicate we want to save the processed data
        file_type: summaryData?.detected_file_type || "", // Pass the detected file type
        options: {
          // Include any processing options that might be needed
          remove_duplicates: processingOptions.remove_duplicates,
          handle_missing: processingOptions.handle_missing,
        },
      };

      console.log("Data being sent to saveToDatabase:", dataToSave);

      // Call the API to save the data
      const response = await fileService.saveToDatabase(fileId, dataToSave);
      console.log("Save to database response:", response);

      if (response && response.data) {
        // Update the file status in the list
        setUploadedFiles((prevFiles) =>
          prevFiles.map((file) =>
            file.id === fileId ? { ...file, status: "saved" } : file
          )
        );

        // Show success message
        showSuccessMessage("File data successfully saved to database");

        // Add a success log
        addProcessingLog("success", "Data saved to database successfully");
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Error saving to database:", error);
      handleSaveError(error);
    } finally {
      setIsSaving(false);
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
    if (!file || !file.id) {
      console.error("Invalid file object:", file);
      setError("Cannot preview file: Invalid file data");
      return;
    }

    console.log("Navigating to file processing view for file:", file);
    navigate(`/file-upload/process/${file.id}`);
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

  // Add this function to FileUpload.jsx
  const handleDeleteError = (error) => {
    console.error("Error deleting file:", error);

    if (error.response) {
      const status = error.response.status;

      if (status === 404) {
        setError("File not found. It may have already been deleted.");
      } else if (status === 403) {
        setError("You don't have permission to delete this file.");
      } else {
        setError(
          `Failed to delete file: ${
            error.response.data.error || "Unknown error"
          }`
        );
      }
    } else if (error.request) {
      setError(
        "No response received from server. Please check your connection."
      );
    } else {
      setError(`Error: ${error.message}`);
    }

    // Show error in snackbar
    setSnackbarOpen(true);
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
