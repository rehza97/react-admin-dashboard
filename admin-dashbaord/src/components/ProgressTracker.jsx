import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  CircularProgress,
  Chip,
  Stack,
  Alert,
} from "@mui/material";
import fileService from "../services/fileService";

const ProgressTracker = ({ invoiceId, onComplete }) => {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Return null if invoiceId is not provided
  if (!invoiceId) {
    return null;
  }

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Start polling for progress
    const stopPolling = fileService.pollProgress(
      invoiceId,
      (progressData, err) => {
        setLoading(false);

        if (err) {
          setError(err.message || "Failed to fetch progress");
          return;
        }

        setProgress(progressData);

        // If progress is complete, call the onComplete callback
        if (
          progressData.status === "completed" ||
          progressData.status === "saved" ||
          progressData.progress_percent === 100
        ) {
          if (onComplete) {
            onComplete(progressData);
          }
        }
      },
      2000 // Poll every 2 seconds
    );

    // Clean up the polling when the component unmounts
    return () => {
      stopPolling();
    };
  }, [invoiceId, onComplete]);

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "warning";
      case "in_progress":
      case "processing":
        return "info";
      case "completed":
      case "saved":
        return "success";
      case "failed":
        return "error";
      default:
        return "default";
    }
  };

  // Helper function to format time
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${Math.round(seconds)} seconds`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes ${Math.round(
        seconds % 60
      )} seconds`;
    } else {
      return `${Math.floor(seconds / 3600)} hours ${Math.floor(
        (seconds % 3600) / 60
      )} minutes`;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!progress) {
    return null;
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        Processing Status
      </Typography>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Chip
          label={progress.status}
          color={getStatusColor(progress.status)}
          variant="outlined"
        />
        {progress.operation_type && (
          <Chip
            label={progress.operation_type}
            color="primary"
            variant="outlined"
          />
        )}
      </Stack>

      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {progress.message || "Processing in progress..."}
        </Typography>

        <LinearProgress
          variant="determinate"
          value={progress.progress_percent || 0}
          sx={{ height: 10, borderRadius: 5, mb: 1 }}
        />

        <Typography variant="body2" align="right">
          {Math.round(progress.progress_percent || 0)}%
        </Typography>
      </Box>

      {progress.current_item && progress.total_items && (
        <Typography variant="body2" color="text.secondary">
          Processing item {progress.current_item} of {progress.total_items}
        </Typography>
      )}

      {progress.estimated_completion_time && (
        <Typography variant="body2" color="text.secondary">
          Estimated completion:{" "}
          {new Date(progress.estimated_completion_time).toLocaleTimeString()}
        </Typography>
      )}
    </Paper>
  );
};

ProgressTracker.propTypes = {
  invoiceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onComplete: PropTypes.func,
};

export default ProgressTracker;
