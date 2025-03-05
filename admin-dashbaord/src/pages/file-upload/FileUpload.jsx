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

  // Handle successful upload from FileUploadDropzone
  const handleUploadSuccess = async (data) => {
    console.log("Upload successful:", data);
    showSuccessMessage("File uploaded successfully");

    // Refresh the file list
    await fetchUploadedFiles();
  };

  // Handle upload error from FileUploadDropzone
  const handleUploadError = (error) => {
    console.error("Upload error:", error);
    setError(`Upload failed: ${error.message || "Unknown error"}`);
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

  const handlePreviewClick = async (file) => {
    if (!file || !file.id) {
      console.error("Invalid file object:", file);
      setError("Cannot preview file: Invalid file data");
      return;
    }

    console.log("Navigating to file processing view for file:", file);
    navigate(`/file-upload/process/${file.id}`);
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

  return (
    <PageLayout
      title="File Upload"
      subtitle="Upload and manage your invoice files"
      maxWidth="1200"
      headerAction={
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={() => {}}
          disabled={true}
        >
          Upload
        </Button>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Use the FileUploadDropzone component */}
      <FileUploadDropzone
        onUploadSuccess={handleUploadSuccess}
        onUploadError={handleUploadError}
      />

      <FileListTable
        uploadedFiles={uploadedFiles}
        isUploading={isUploading}
        handleFileProcess={handlePreviewClick}
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
