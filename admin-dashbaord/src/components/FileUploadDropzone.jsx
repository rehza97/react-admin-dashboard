import React from "react";
import { Box, Typography, Button, Alert } from "@mui/material";
import { useDropzone } from "react-dropzone";
import { alpha, useTheme } from "@mui/material/styles";
import { Upload as UploadIcon } from "@mui/icons-material";
import PropTypes from "prop-types";

const FileUploadDropzone = ({
  onDrop,
  files,
  isUploading,
  errorMessages,
  validateFile,
}) => {
  const theme = useTheme();
  
  // Define a wrapper for onDrop to ensure proper handling
  const handleOnDrop = (acceptedFiles) => {
    console.log("FileUploadDropzone received files:", acceptedFiles);
    // Call the parent onDrop function
    onDrop(acceptedFiles);
  };
  
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop: handleOnDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: true,
    // Don't use the validator prop as it's causing issues
    // Instead, we'll validate in the onDrop function
  });

  // Styles for the dropzone
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
    <Box sx={{ mb: 3 }}>
      {/* Error messages */}
      {errorMessages.uploadError && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
        >
          {errorMessages.uploadError}
        </Alert>
      )}
      
      {/* File rejection errors */}
      {fileRejections.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {fileRejections.map(({ file, errors }) => (
            <div key={file.path}>
              {file.path} - {errors.map(e => e.message).join(', ')}
            </div>
          ))}
        </Alert>
      )}
      
      {/* Dropzone */}
      <Box {...getRootProps()} sx={dropzoneStyles}>
        <input {...getInputProps()} />
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <UploadIcon
            sx={{ fontSize: 48, color: "primary.main", mb: 2, opacity: 0.8 }}
          />
          <Typography variant="h6" gutterBottom>
            {isDragActive 
              ? "Drop files here..." 
              : "Drag & Drop Files Here"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            or click to browse your files
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Supported formats: CSV, Excel (.xlsx, .xls)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Maximum file size: 5MB
          </Typography>
          
          {/* Show selected files count */}
          {files.length > 0 && (
            <Typography 
              variant="body2" 
              color="primary" 
              sx={{ mt: 2, fontWeight: 'bold' }}
            >
              {files.length} file(s) selected
            </Typography>
          )}
        </Box>
      </Box>
      
      {/* Show selected files */}
      {files.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Files:
          </Typography>
          {files.map((file, index) => (
            <Typography key={index} variant="body2">
              {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

FileUploadDropzone.propTypes = {
  onDrop: PropTypes.func.isRequired,
  files: PropTypes.array.isRequired,
  isUploading: PropTypes.bool.isRequired,
  errorMessages: PropTypes.object.isRequired,
  validateFile: PropTypes.func.isRequired,
};

export default FileUploadDropzone;
