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
  Grid,
  IconButton,
  LinearProgress,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import PropTypes from "prop-types";
import fileService from "../services/fileService";
import ProgressTracker from "./ProgressTracker";

const FileUploadDropzone = ({
  onUploadSuccess,
  onUploadError,
  onUploadStatusChange,
  onUploadStart,
}) => {
  const [files, setFiles] = useState([]);
  const [invoiceNumbers, setInvoiceNumbers] = useState({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [fileTypes, setFileTypes] = useState([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState({});
  const [uploadProgress, setUploadProgress] = useState({
    total: 0,
    filesCompleted: 0,
    currentFile: "",
    timeRemaining: null,
    startTime: null,
    retryCount: {},
    filesProgress: {},
  });
  const [showProgress, setShowProgress] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  const MAX_RETRIES = 3;

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

  // Notify parent about upload status changes
  useEffect(() => {
    if (onUploadStatusChange) {
      onUploadStatusChange(uploading);
    }
  }, [uploading, onUploadStatusChange]);

  const validateFile = (file) => {
    const errors = [];

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File ${file.name} is too large. Maximum size is 500MB`);
    }

    // Check file type
    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf("."));

    if (
      !validTypes.includes(file.type) &&
      !validExtensions.includes(fileExtension)
    ) {
      errors.push(
        `File ${file.name} has invalid type. Supported formats: CSV, XLS, XLSX`
      );
    }

    return errors;
  };

  const onDrop = useCallback((acceptedFiles) => {
    const errors = [];
    const validFiles = [];

    acceptedFiles.forEach((file) => {
      const fileErrors = validateFile(file);
      if (fileErrors.length > 0) {
        errors.push(...fileErrors);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setError(errors.join("\n"));
      return;
    }

    if (validFiles.length > 0) {
      setFiles((prevFiles) => {
        const newFiles = [...prevFiles];
        validFiles.forEach((file) => {
          if (!newFiles.find((f) => f.name === file.name)) {
            newFiles.push(file);
          }
        });
        return newFiles;
      });
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
    multiple: true, // Enable multiple file selection
  });

  const handleInvoiceNumberChange = (fileName, value) => {
    setInvoiceNumbers((prev) => ({
      ...prev,
      [fileName]: value,
    }));
  };

  const handleFileTypeChange = (fileName, value) => {
    setSelectedFileTypes((prev) => ({
      ...prev,
      [fileName]: value,
    }));
  };

  const removeFile = (fileName) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.name !== fileName));
    setInvoiceNumbers((prev) => {
      const newInvoiceNumbers = { ...prev };
      delete newInvoiceNumbers[fileName];
      return newInvoiceNumbers;
    });
    setSelectedFileTypes((prev) => {
      const newFileTypes = { ...prev };
      delete newFileTypes[fileName];
      return newFileTypes;
    });
  };

  const updateTimeRemaining = (progress, startTime) => {
    if (progress > 0) {
      const elapsedTime = Date.now() - startTime;
      const estimatedTotalTime = (elapsedTime * 100) / progress;
      const remainingTime = estimatedTotalTime - elapsedTime;
      return Math.round(remainingTime / 1000); // Convert to seconds
    }
    return null;
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one file to upload");
      return;
    }

    // Validate invoice numbers
    const missingInvoiceNumbers = files.filter(
      (file) => !invoiceNumbers[file.name]?.trim()
    );

    if (missingInvoiceNumbers.length > 0) {
      setError(
        `Please enter invoice numbers for all files: ${missingInvoiceNumbers
          .map((f) => f.name)
          .join(", ")}`
      );
      return;
    }

    setUploading(true);
    setError(null);
    setShowProgress(true);
    setUploadResults([]);
    const startTime = Date.now();
    setUploadProgress((prev) => ({
      ...prev,
      total: 0,
      filesCompleted: 0,
      startTime,
      timeRemaining: null,
      filesProgress: {},
    }));

    try {
      if (onUploadStatusChange) {
        onUploadStatusChange(true);
      }

      if (onUploadStart) {
        onUploadStart(files);
      }

      const response = await fileService.uploadMultipleFiles(files, {
        invoiceNumbers: files.map((file) => invoiceNumbers[file.name]),
        fileTypes: files.map((file) => selectedFileTypes[file.name] || ""),
        onProgress: (progress, details) => {
          setUploadProgress((prev) => {
            // Update the progress for individual files if available
            const filesProgress = { ...prev.filesProgress };

            if (details) {
              if (details.fileName) {
                filesProgress[details.fileName] = details.fileProgress || 0;
              }

              // Update all files progress from the map if available
              if (details.filesProgressMap) {
                Object.keys(details.filesProgressMap).forEach((fileName) => {
                  filesProgress[fileName] = details.filesProgressMap[fileName];
                });
              }
            }

            const timeRemaining = updateTimeRemaining(progress, startTime);

            return {
              ...prev,
              total: progress,
              filesCompleted: details?.completedFiles || prev.filesCompleted,
              timeRemaining,
              filesProgress,
            };
          });
        },
      });

      // Store upload results
      setUploadResults(response);

      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(response);
      }

      // Reset form after short delay to show completion
      setTimeout(() => {
        setFiles([]);
        setInvoiceNumbers({});
        setSelectedFileTypes({});
        setUploadProgress({
          total: 0,
          filesCompleted: 0,
          currentFile: "",
          timeRemaining: null,
          startTime: null,
          retryCount: {},
          filesProgress: {},
        });
        setShowProgress(false);

        if (onUploadStatusChange) {
          onUploadStatusChange(false);
        }
      }, 2000);
    } catch (error) {
      console.error("Upload error:", error);
      setError(error.message || "Failed to upload files");

      if (onUploadError) {
        onUploadError(
          error,
          files.map((f) => f.name)
        );
      }

      if (onUploadStatusChange) {
        onUploadStatusChange(false);
      }
    } finally {
      setUploading(false);
    }
  };

  // Format time remaining
  const formatTimeRemaining = (seconds) => {
    if (!seconds) return "";
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s remaining`;
  };

  return (
    <Paper
      elevation={3}
      sx={{ p: 3, mb: 3, borderRadius: 2, backgroundColor: "background.paper" }}
    >
      <Typography variant="h6" gutterBottom>
        Upload Files
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
            <Typography>Drop the files here...</Typography>
          ) : (
            <Typography>
              Drag and drop files here, or click to select files
            </Typography>
          )}
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Supported formats: CSV, XLS, XLSX
          </Typography>
        </Box>

        {files.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {files.map((file) => (
              <Box
                key={file.name}
                sx={{
                  p: 2,
                  mb: 2,
                  backgroundColor: "rgba(0, 0, 0, 0.03)",
                  borderRadius: 1,
                }}
              >
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={3}>
                    <Typography variant="subtitle2">File:</Typography>
                    <Typography variant="body2">{file.name}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {(file.size / 1024).toFixed(2)} KB
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="Invoice Number"
                      variant="outlined"
                      size="small"
                      value={invoiceNumbers[file.name] || ""}
                      onChange={(e) =>
                        handleInvoiceNumberChange(file.name, e.target.value)
                      }
                      disabled={uploading}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>File Type (Optional)</InputLabel>
                      <Select
                        value={selectedFileTypes[file.name] || ""}
                        label="File Type (Optional)"
                        onChange={(e) =>
                          handleFileTypeChange(file.name, e.target.value)
                        }
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
                  </Grid>
                  <Grid item xs={12} sm={1}>
                    <IconButton
                      onClick={() => removeFile(file.name)}
                      disabled={uploading}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Box>
        )}

        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          startIcon={uploading ? <CircularProgress size={20} /> : null}
          fullWidth
        >
          {uploading
            ? `Uploading (${uploadProgress.total || 0}%)...`
            : `Upload ${files.length} File${files.length !== 1 ? "s" : ""}`}
        </Button>
      </Collapse>

      {/* Show progress tracker after upload */}
      <Collapse in={showProgress}>
        <Box sx={{ width: "100%", mb: 2 }}>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Overall Progress ({uploadProgress.filesCompleted} of {files.length}{" "}
            files)
          </Typography>
          <LinearProgress
            variant="determinate"
            value={uploadProgress.total}
            sx={{ height: 10, borderRadius: 5 }}
          />
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
            <Typography variant="body2" color="textSecondary">
              {uploadProgress.currentFile &&
                `Currently uploading: ${uploadProgress.currentFile}`}
              {uploadProgress.retryCount[uploadProgress.currentFile] > 0 &&
                ` (Retry ${
                  uploadProgress.retryCount[uploadProgress.currentFile]
                }/${MAX_RETRIES})`}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {uploadProgress.total}% -{" "}
              {formatTimeRemaining(uploadProgress.timeRemaining)}
            </Typography>
          </Box>

          {/* Show upload results */}
          {uploadResults.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Upload Results:
              </Typography>
              {uploadResults.map((result, index) => (
                <Alert
                  key={index}
                  severity="success"
                  sx={{ mb: 1 }}
                  onClose={() => {
                    setUploadResults((prev) =>
                      prev.filter((_, i) => i !== index)
                    );
                  }}
                >
                  Successfully uploaded: {result.file_name || files[index].name}
                </Alert>
              ))}
            </Box>
          )}
        </Box>

        {!uploading && (
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setShowProgress(false);
              setUploadResults([]);
            }}
            fullWidth
            sx={{ mt: 2 }}
          >
            Upload More Files
          </Button>
        )}
      </Collapse>
    </Paper>
  );
};

FileUploadDropzone.propTypes = {
  onUploadSuccess: PropTypes.func,
  onUploadError: PropTypes.func,
  onUploadStatusChange: PropTypes.func,
  onUploadStart: PropTypes.func,
};

export default FileUploadDropzone;
