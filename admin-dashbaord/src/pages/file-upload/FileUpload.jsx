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

    if (!validTypes.includes(file.type)) {
      setErrorMessages((prev) => ({
        ...prev,
        fileType: "Invalid file type. Please upload Excel or CSV files only.",
      }));
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessages((prev) => ({
        ...prev,
        fileSize: "File size must be less than 5MB",
      }));
      return false;
    }

    return true;
  };

  const onDrop = (acceptedFiles) => {
    const validFiles = acceptedFiles.filter(validateFile);
    setFiles((prev) => [...prev, ...validFiles]);
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
  });

  const handleUpload = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to access this feature");
      return;
    }

    setIsUploading(true);
    setUploadError({});

    for (const file of files) {
      try {
        const invoiceNumber = `INV-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        await fileService.uploadFile(file, invoiceNumber);

        // Update progress
        setUploadProgress((prev) => ({
          ...prev,
          [file.name]: 100,
        }));

        // Clear file from queue after successful upload
        setFiles((prev) => prev.filter((f) => f.name !== file.name));
      } catch (error) {
        setUploadError((prev) => ({
          ...prev,
          [file.name]: {
            type: "error",
            message: error.response?.data?.detail || "Upload failed",
          },
        }));
      }
    }

    setIsUploading(false);
    await fetchUploadedFiles(); // Refresh the list
  };

  const handleConfirmDelete = (id) => {
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
      const response = await fileService.downloadFile(id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError("Failed to download file");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this file?")) {
      return;
    }

    try {
      setIsLoading(true);
      await fileService.deleteFile(id);

      // Refresh the file list
      await fetchUploadedFiles();

      setOpenDialog(false);
    } catch (error) {
      setError("Failed to delete file. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDialog = async () => {
    if (selectedFile?.action === "delete") {
      await handleDelete(selectedFile.id);
    } else if (selectedFile?.action === "edit") {
      try {
        await fileService.updateFile(selectedFile.id, {
          invoice_number: editedInvoiceNumber,
          status: status,
        });

        // Refresh the file list
        await fetchUploadedFiles();

        setEditDialogOpen(false);
      } catch (error) {
        console.error("Error updating file:", error);
        setError("Failed to update file. Please try again.");
      }
    }
    setOpenDialog(false);
    setSelectedFile(null);
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
    setPreviewDialogOpen(true);

    // Automatically inspect the file when opening the dialog
    setTimeout(() => {
      inspectFile();
    }, 500);
  };

  const inspectFile = async () => {
    if (!selectedFileForProcessing) return;

    addProcessingLog(
      "info",
      `Inspecting file: ${selectedFileForProcessing.invoice_number}`
    );

    try {
      const result = await fileService.inspectFile(
        selectedFileForProcessing.id
      );
      setFileInspection(result);
      addProcessingLog(
        "success",
        `File inspection complete. Found ${result.column_count} columns.`
      );

      // Check if expected columns are present
      const expectedColumns = [
        "Mois",
        "Date de Facture",
        "Dépts",
        "N° Factures",
      ];
      const missingColumns = expectedColumns.filter(
        (col) => !result.columns.some((c) => c.name === col)
      );

      if (missingColumns.length > 0) {
        addProcessingLog(
          "warning",
          `Missing expected columns: ${missingColumns.join(", ")}`
        );
      } else {
        addProcessingLog("info", "All expected columns are present");
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Error inspecting file";
      addProcessingLog("error", `Inspection failed: ${errorMsg}`);
      console.error("Error inspecting file:", error);
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

      // Refresh the file list to update statuses
      await fetchUploadedFiles();
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Error processing file";
      setProcessingError(errorMsg);
      addProcessingLog("error", `Processing failed: ${errorMsg}`);
      console.error("Error processing file:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToDatabase = async () => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      await fileService.saveToDatabase(selectedFileForProcessing.id);
      setProcessingStep(2); // Move to completed step

      // Refresh the file list to update statuses
      await fetchUploadedFiles();
    } catch (error) {
      setProcessingError(
        error.response?.data?.error || "Error saving to database"
      );
      console.error("Error saving to database:", error);
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
    try {
      setIsLoading(true);
      setError(null);

      console.log(`Processing file for preview: ${file.id}`);

      // First, process the file to get preview data
      const result = await fileService.processFile(file.id, {
        processing_options: {
          remove_duplicates: true,
          handle_missing: true,
          filters: [],
          transforms: [],
        },
      });

      // Set the preview data and open the dialog
      setPreviewData(result.preview || []);
      setSummaryData(result.summary || {});
      setProcessingLogs(result.logs || []);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error("Error processing file for preview:", error);
      setError(
        error.response?.data?.error || "Failed to process file for preview"
      );
    } finally {
      setIsLoading(false);
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

  // Add this component to your dialog
  const ProcessingLogs = () => (
    <Accordion sx={{ mt: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>Processing Logs</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          sx={{
            bgcolor: "background.paper",
            p: 1,
            borderRadius: 1,
            height: 200,
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: "0.85rem",
          }}
        >
          {processingLogs.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: "italic" }}
            >
              No logs available
            </Typography>
          ) : (
            processingLogs.map((log, index) => (
              <Box
                key={index}
                sx={{
                  py: 0.5,
                  color:
                    log.level === "error"
                      ? "error.main"
                      : log.level === "success"
                      ? "success.main"
                      : "text.primary",
                }}
              >
                <span style={{ color: "text.secondary" }}>
                  [{log.timestamp}]
                </span>{" "}
                {log.message}
              </Box>
            ))
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <PageLayout
      title="File Upload"
      subtitle="Upload and manage your invoice files"
      maxWidth={1200}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {errorMessages.fileType && (
        <Alert severity="error">{errorMessages.fileType}</Alert>
      )}
      {errorMessages.fileSize && (
        <Alert severity="error">{errorMessages.fileSize}</Alert>
      )}

      <Box {...getRootProps()} sx={dropzoneStyles}>
        <input {...getInputProps()} />
        <Box sx={{ textAlign: "center" }}>
          <UploadIcon
            sx={{
              fontSize: 48,
              color: "primary.main",
              mb: 2,
            }}
          />
          <Typography variant="h6" gutterBottom>
            {isDragActive
              ? "Drop the files here..."
              : "Drag & drop files here, or click to select files"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Supported formats: .xlsx, .xls, .csv (Max size: 5MB)
          </Typography>
        </Box>
      </Box>

      {files.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Files to Upload
          </Typography>
          {files.map((file) => (
            <Box key={file.name} sx={{ mb: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="body2">{file.name}</Typography>
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleCancelUpload(file.name)}
                >
                  Cancel
                </Button>
              </Box>
              {renderFileUploadStatus(file)}
            </Box>
          ))}
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={isUploading}
            sx={{ mt: 2 }}
          >
            {isUploading ? "Uploading..." : "Upload All Files"}
          </Button>
        </Box>
      )}

      <Typography variant="h6" gutterBottom>
        Uploaded Files
      </Typography>
      <TableContainer component={Paper}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: "bold" }}>Invoice Number</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Upload Date</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Size</TableCell>
              <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
              <TableCell sx={{ fontWeight: "bold" }} align="center">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{renderFileList()}</TableBody>
        </Table>
      </TableContainer>

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

      {/* Edit Dialog */}
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
      />
    </PageLayout>
  );
};

FileUpload.propTypes = {
  // Add any props if needed
};

export default FileUpload;
