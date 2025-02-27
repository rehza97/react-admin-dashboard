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
} from "@mui/material";
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import dataService from "../../services/dataService";
import { useAuth } from "../../context/AuthContext";
import { fileService } from "../../services/fileService";
import PageLayout from "../../components/PageLayout";
import { alpha } from "@mui/material/styles";
import { styled } from "@mui/material/styles";

// Styled components
const DropzoneArea = styled("div")(({ theme }) => ({
  border: `2px dashed ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(4),
  textAlign: "center",
  cursor: "pointer",
  transition: "all 0.3s ease",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const FileUpload = () => {
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
    setSelectedFile({ ...file, action: "edit" });
    setEditedFileName(file.invoice_number);
    setOpenDialog(true);
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
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to access this feature");
      return;
    }
    try {
      await dataService.deleteFile(id, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchUploadedFiles();
      setOpenDialog(false);
    } catch (error) {
      setError("Failed to delete file. Please try again.");
    }
  };

  const handleConfirmDialog = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please log in to access this feature");
      return;
    }
    if (selectedFile.action === "delete") {
      await handleDelete(selectedFile.id);
    } else if (selectedFile.action === "edit") {
      try {
        await axios.put(
          API_URLS.DETAIL(selectedFile.id),
          { invoice_number: editedFileName },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        await fetchUploadedFiles();
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
        <TableCell>{formatBytes(file.file_size || 0)}</TableCell>
        <TableCell>
          {new Date(file.created_at || file.invoice_date).toLocaleDateString()}
        </TableCell>
        <TableCell>{file.status || "N/A"}</TableCell>
        <TableCell>
          <IconButton onClick={() => handleEdit(file)}>
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => handleConfirmDelete(file.id)}>
            <DeleteIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDownload(file.id, file.invoice_number)}
          >
            <DownloadIcon />
          </IconButton>
        </TableCell>
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

  return (
    <PageLayout
      title="File Upload"
      subtitle="Upload and manage your invoice files"
      maxWidth="1200px"
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
      <TableContainer component={Paper} sx={{ mt: 3 }}>
        {isLoading ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Invoice Number</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Upload Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>{renderFileList()}</TableBody>
          </Table>
        )}
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
              value={editedFileName}
              onChange={(e) => setEditedFileName(e.target.value)}
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
    </PageLayout>
  );
};

export default FileUpload;
