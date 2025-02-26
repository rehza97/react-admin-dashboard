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
} from "@mui/material";
import {
  Upload as UploadIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import PropTypes from "prop-types";

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

  // API URLs - centralized to make changes easier
  const API_URLS = {
    UPLOAD: "/data/upload-facturation/",
    LIST: "/data/api/facturation/",
    DETAIL: (id) => `/data/api/facturation/${id}/`,
    DOWNLOAD: (id) => `/data/api/facturation/${id}/download/`,
  };

  useEffect(() => {
    // Fetch existing files when component mounts
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await axios.get(API_URLS.LIST, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("API Response:", response.data);
      setUploadedFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
      setError(error.response?.data?.error || "Failed to fetch files");
      setUploadedFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = (acceptedFiles) => {
    // Add file validation
    const validFiles = acceptedFiles.filter((file) => {
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB limit
      if (!isValidSize) {
        setUploadError((prev) => ({
          ...prev,
          [file.name]: "File size must be less than 5MB",
        }));
        return false;
      }
      return true;
    });
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
    setIsUploading(true);
    setUploadError({});

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Authentication token not found");
        }

        const response = await axios.post(API_URLS.UPLOAD, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            "Authorization": `Bearer ${token}`,
          },
        });

        // Handle success response
        console.log(response.data);
        await fetchUploadedFiles();
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        setUploadError((prev) => ({
          ...prev,
          [file.name]: {
            type: "error",
            message: error.response?.data?.error || "Upload failed",
          },
        }));
      }
    }
    setIsUploading(false);
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

  const handleDownload = async (invoiceNumber) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await axios.get(
        API_URLS.DOWNLOAD(invoiceNumber),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob",
        }
      );

      // Create a URL for the blob
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${invoiceNumber}.xlsx`);
      document.body.appendChild(link);
      link.click();

      // Clean up
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      setError("Failed to download file. Please try again.");
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      await axios.delete(API_URLS.DETAIL(id), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await fetchUploadedFiles();
      setOpenDialog(false);
    } catch (error) {
      console.error("Error deleting file:", error);
      setError("Failed to delete file. Please try again.");
    }
  };

  const handleConfirmDialog = async () => {
    if (selectedFile.action === "delete") {
      await handleDelete(selectedFile.id);
    } else if (selectedFile.action === "edit") {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Authentication token not found");
        }

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
        <TableCell>{new Date(file.created_at || file.invoice_date).toLocaleDateString()}</TableCell>
        <TableCell>{file.status || "N/A"}</TableCell>
        <TableCell>
          <IconButton onClick={() => handleEdit(file)}>
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => handleConfirmDelete(file.id)}>
            <DeleteIcon />
          </IconButton>
          <IconButton onClick={() => handleDownload(file.invoice_number)}>
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

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Typography variant="h4" gutterBottom>
        File Upload
      </Typography>

      <Paper
        {...getRootProps()}
        sx={{
          p: 3,
          mb: 3,
          border: "2px dashed",
          borderColor: isDragActive ? "primary.main" : "grey.300",
          backgroundColor: isDragActive ? "action.hover" : "background.paper",
          cursor: "pointer",
        }}
      >
        <input {...getInputProps()} />
        <Box sx={{ textAlign: "center" }}>
          <UploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
          <Typography>
            {isDragActive
              ? "Drop the files here..."
              : "Drag and drop files here, or click to select files"}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Supported formats: .xlsx, .xls, .csv
          </Typography>
        </Box>
      </Paper>

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
    </Box>
  );
};

FileUpload.propTypes = {
  // Add any props if needed
};

export default FileUpload;