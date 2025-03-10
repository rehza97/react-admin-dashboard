import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import PropTypes from "prop-types";
import fileService from "../services/fileService";
import ProgressTracker from "./ProgressTracker";

const FileUploadDropzone = ({ onUploadSuccess, onUploadError }) => {
  const [file, setFile] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [fileTypes, setFileTypes] = useState([]);
  const [selectedFileType, setSelectedFileType] = useState("");
  const [uploadedInvoiceId, setUploadedInvoiceId] = useState(null);
  const [showProgress, setShowProgress] = useState(false);

  // Fetch available file types when component mounts
  useEffect(() => {
    const fetchFileTypes = async () => {
      try {
        const types = await fileService.getFileTypes();
        setFileTypes(types);
      } catch (error) {
        console.error("Error fetching file types:", error);
      }
    };

    fetchFileTypes();
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload");
      return;
    }

    if (!invoiceNumber.trim()) {
      setError("Please enter an invoice number");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Use fileService to upload the file
      const response = await fileService.uploadFile(
        file,
        invoiceNumber,
        selectedFileType
      );

      // Set the uploaded invoice ID for progress tracking
      setUploadedInvoiceId(response.id);
      setShowProgress(true);

      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(response);
      }
    } catch (error) {
      console.error("Upload error:", error);

      // Reset progress tracking state on error
      setUploadedInvoiceId(null);
      setShowProgress(false);

      // Check if it's a duplicate invoice number error
      if (
        error.response &&
        error.response.data &&
        error.response.data.error &&
        error.response.data.error.includes("UNIQUE constraint failed")
      ) {
        setError(
          "An invoice with this number already exists. The existing invoice will be updated with this new file."
        );

        // Try again after a short delay - the backend should handle the update now
        setTimeout(async () => {
          try {
            const response = await fileService.uploadFile(
              file,
              invoiceNumber,
              selectedFileType
            );

            // Set the uploaded invoice ID for progress tracking
            setUploadedInvoiceId(response.id);
            setShowProgress(true);

            // Notify parent component
            if (onUploadSuccess) {
              onUploadSuccess(response);
            }

            setError(null);
          } catch (retryError) {
            console.error("Retry upload error:", retryError);
            setError(retryError.message || "Failed to upload file after retry");

            if (onUploadError) {
              onUploadError(retryError);
            }
          }
        }, 1000);
      } else {
        setError(error.message || "Failed to upload file");

        if (onUploadError) {
          onUploadError(error);
        }
      }
    } finally {
      setUploading(false);
    }
  };

  const handleProgressComplete = () => {
    // Reset the form after processing is complete
    setFile(null);
    setInvoiceNumber("");
    setSelectedFileType("");
    setUploadedInvoiceId(null);
    setShowProgress(false);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mb: 3,
        borderRadius: 2,
        backgroundColor: "background.paper",
      }}
    >
      <Typography variant="h6" gutterBottom>
        Upload File
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Collapse in={!showProgress}>
        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed",
            borderColor: isDragActive ? "primary.main" : "grey.400",
            borderRadius: 2,
            p: 3,
            mb: 2,
            textAlign: "center",
            cursor: "pointer",
            backgroundColor: isDragActive
              ? "rgba(0, 0, 0, 0.05)"
              : "transparent",
            transition: "all 0.2s ease",
            "&:hover": {
              borderColor: "primary.main",
              backgroundColor: "rgba(0, 0, 0, 0.05)",
            },
          }}
        >
          <input {...getInputProps()} />
          <CloudUploadIcon
            sx={{ fontSize: 48, color: "primary.main", mb: 1 }}
          />
          {isDragActive ? (
            <Typography>Drop the file here...</Typography>
          ) : (
            <Typography>
              Drag and drop a file here, or click to select a file
            </Typography>
          )}
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Supported formats: CSV, XLS, XLSX
          </Typography>
        </Box>

        {file && (
          <Box
            sx={{
              p: 2,
              mb: 2,
              backgroundColor: "rgba(0, 0, 0, 0.03)",
              borderRadius: 1,
            }}
          >
            <Typography variant="subtitle2">Selected File:</Typography>
            <Typography variant="body2">{file.name}</Typography>
            <Typography variant="body2" color="textSecondary">
              {(file.size / 1024).toFixed(2)} KB
            </Typography>
          </Box>
        )}

        <TextField
          fullWidth
          label="Invoice Number"
          variant="outlined"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
          sx={{ mb: 2 }}
          disabled={uploading}
        />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="file-type-select-label">
            File Type (Optional)
          </InputLabel>
          <Select
            labelId="file-type-select-label"
            id="file-type-select"
            value={selectedFileType}
            label="File Type (Optional)"
            onChange={(e) => setSelectedFileType(e.target.value)}
            disabled={uploading}
          >
            <MenuItem value="">
              <em>Auto-detect</em>
            </MenuItem>
            {fileTypes.map((type) => (
              <MenuItem key={type.id} value={type.id}>
                {type.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          disabled={!file || uploading}
          startIcon={uploading ? <CircularProgress size={20} /> : null}
          fullWidth
        >
          {uploading ? "Uploading..." : "Upload"}
        </Button>
      </Collapse>

      {/* Show progress tracker after upload */}
      <Collapse in={showProgress}>
        {uploadedInvoiceId && (
          <ProgressTracker
            invoiceId={uploadedInvoiceId}
            onComplete={handleProgressComplete}
          />
        )}
        <Button
          variant="outlined"
          color="primary"
          onClick={() => setShowProgress(false)}
          fullWidth
          sx={{ mt: 2 }}
        >
          Upload Another File
        </Button>
      </Collapse>
    </Paper>
  );
};

FileUploadDropzone.propTypes = {
  onUploadSuccess: PropTypes.func,
  onUploadError: PropTypes.func,
};

export default FileUploadDropzone;
