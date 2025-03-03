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

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop: handleOnDrop,
      accept: {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
          ".xlsx",
        ],
        "application/vnd.ms-excel": [".xls"],
        "text/csv": [".csv"],
        "application/csv": [".csv"],
        "text/plain": [".csv"], // Some CSV files might be detected as text/plain
      },
      multiple: true,
    });

  return (
    <Box
      sx={{
        p: 3,
        mb: 3,
        border: `2px dashed ${
          isDragActive ? theme.palette.primary.main : theme.palette.divider
        }`,
        borderRadius: 2,
        bgcolor: isDragActive
          ? alpha(theme.palette.primary.main, 0.05)
          : "background.paper",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
        "&:hover": {
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          borderColor: theme.palette.primary.main,
        },
      }}
      {...getRootProps()}
    >
      <input {...getInputProps()} />
      <UploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        {isDragActive ? "Drop the files here..." : "Drag & drop files here"}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        or
      </Typography>
      <Button variant="outlined" color="primary" sx={{ mt: 1 }}>
        Browse Files
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        Supported formats: .xlsx, .xls, .csv
      </Typography>

      {files.length > 0 && (
        <Typography variant="body2" sx={{ mt: 2 }}>
          {files.length} file{files.length !== 1 ? "s" : ""} selected
        </Typography>
      )}

      {/* Display file rejection errors */}
      {fileRejections.length > 0 && (
        <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
          {fileRejections.map(({ file, errors }) => (
            <div key={file.path}>
              <strong>{file.path}</strong> -{" "}
              {errors.map((e) => e.message).join(", ")}
            </div>
          ))}
        </Alert>
      )}

      {/* Display upload errors */}
      {errorMessages && Object.values(errorMessages).some((msg) => msg) && (
        <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
          {Object.values(errorMessages)
            .filter((msg) => msg)
            .map((msg, index) => (
              <div key={index}>{msg}</div>
            ))}
        </Alert>
      )}
    </Box>
  );
};

FileUploadDropzone.propTypes = {
  onDrop: PropTypes.func.isRequired,
  files: PropTypes.array.isRequired,
  isUploading: PropTypes.bool,
  errorMessages: PropTypes.object,
  validateFile: PropTypes.func,
};

export default FileUploadDropzone;
