import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Typography,
  LinearProgress,
  Paper,
  Divider,
  Stack,
  Card,
  CardContent,
} from "@mui/material";
import {
  AccessTime,
  CheckCircle,
  Error as ErrorIcon,
} from "@mui/icons-material";
import { formatDistanceToNow, parseISO } from "date-fns";
import api from "../services/api";

/**
 * Component to track and display progress for validation and cleaning operations
 * Shows real-time progress, time estimation, and results when complete
 */
const ValidationProgressTracker = ({
  taskId,
  taskType,
  onComplete,
  pollingInterval = 2000,
}) => {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let intervalId = null;

    const fetchProgress = async () => {
      try {
        const response = await api.get(`/data/validation-progress/`, {
          params: {
            task_id: taskId,
            type: taskType,
          },
        });

        if (mounted) {
          setProgress(response.data);
          setLoading(false);

          // If task is complete, stop polling and call the onComplete callback
          if (
            response.data.status === "complete" ||
            response.data.status === "error"
          ) {
            clearInterval(intervalId);
            if (onComplete && typeof onComplete === "function") {
              onComplete(response.data);
            }
          }
        }
      } catch (error) {
        if (mounted) {
          setError(error.message || "Error fetching progress");
          setLoading(false);
          clearInterval(intervalId);
        }
      }
    };

    // Initial fetch
    fetchProgress();

    // Set up polling interval
    intervalId = setInterval(fetchProgress, pollingInterval);

    // Cleanup
    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [taskId, taskType, onComplete, pollingInterval]);

  // Format time remaining in a human-readable way
  const formatTimeRemaining = (seconds) => {
    if (!seconds) return "Calculating...";

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (minutes < 1) {
      return `${remainingSeconds} seconds`;
    } else if (minutes === 1) {
      return `1 minute ${remainingSeconds} seconds`;
    } else {
      return `${minutes} minutes ${remainingSeconds} seconds`;
    }
  };

  // Format the completion time as a relative time
  const formatCompletionTime = (isoTimeString) => {
    if (!isoTimeString) return "Calculating...";
    try {
      return formatDistanceToNow(parseISO(isoTimeString), { addSuffix: true });
    } catch {
      return "Invalid time";
    }
  };

  if (loading) {
    return (
      <Box sx={{ width: "100%", mt: 2 }}>
        <Typography variant="body2" color="textSecondary">
          Loading progress information...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 2, bgcolor: "error.light", color: "error.contrastText" }}>
        <Typography variant="subtitle1">Error tracking progress</Typography>
        <Typography variant="body2">{error}</Typography>
      </Paper>
    );
  }

  if (!progress) {
    return (
      <Paper
        sx={{ p: 2, bgcolor: "warning.light", color: "warning.contrastText" }}
      >
        <Typography variant="subtitle1">
          No progress information available
        </Typography>
        <Typography variant="body2">
          The task may have been completed or not started properly.
        </Typography>
      </Paper>
    );
  }

  return (
    <Card variant="outlined" sx={{ mb: 3, width: "100%" }}>
      <CardContent>
        <Stack spacing={2}>
          {/* Progress header */}
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">
              {taskType === "validation"
                ? "Data Validation Progress"
                : "Data Cleaning Progress"}
            </Typography>
            <Typography
              variant="subtitle1"
              color={
                progress.status === "complete"
                  ? "success.main"
                  : progress.status === "error"
                  ? "error.main"
                  : "primary.main"
              }
              display="flex"
              alignItems="center"
              gap={0.5}
            >
              {progress.status === "complete" ? (
                <>
                  <CheckCircle fontSize="small" /> Complete
                </>
              ) : progress.status === "error" ? (
                <>
                  <ErrorIcon fontSize="small" /> Error
                </>
              ) : (
                <>{progress.progress}% Complete</>
              )}
            </Typography>
          </Box>

          {/* Progress bar */}
          <Box sx={{ width: "100%" }}>
            <LinearProgress
              variant="determinate"
              value={progress.progress || 0}
              color={
                progress.status === "complete"
                  ? "success"
                  : progress.status === "error"
                  ? "error"
                  : "primary"
              }
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>

          {/* Current operation */}
          <Box>
            <Typography variant="subtitle2">Current operation:</Typography>
            <Typography variant="body1">
              {progress.step_name || "Not started"}
            </Typography>
          </Box>

          {progress.total_steps && progress.current_step && (
            <Box>
              <Typography variant="subtitle2">Progress:</Typography>
              <Typography variant="body1">
                Step {progress.current_step} of {progress.total_steps}
              </Typography>
            </Box>
          )}

          <Divider />

          {/* Time information */}
          <Box display="flex" flexDirection="column" gap={1}>
            <Typography
              variant="subtitle2"
              display="flex"
              alignItems="center"
              gap={1}
            >
              <AccessTime fontSize="small" /> Time Information
            </Typography>

            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Box flex={1} minWidth={200}>
                <Typography variant="body2" color="textSecondary">
                  Time elapsed:
                </Typography>
                <Typography variant="body1">
                  {formatTimeRemaining(progress.time_elapsed)}
                </Typography>
              </Box>

              {progress.status !== "complete" &&
                progress.status !== "error" && (
                  <>
                    <Box flex={1} minWidth={200}>
                      <Typography variant="body2" color="textSecondary">
                        Estimated time remaining:
                      </Typography>
                      <Typography variant="body1">
                        {formatTimeRemaining(progress.time_remaining)}
                      </Typography>
                    </Box>

                    <Box flex={1} minWidth={200}>
                      <Typography variant="body2" color="textSecondary">
                        Expected completion:
                      </Typography>
                      <Typography variant="body1">
                        {formatCompletionTime(progress.estimated_completion)}
                      </Typography>
                    </Box>
                  </>
                )}
            </Stack>
          </Box>

          {/* Error message if any */}
          {progress.status === "error" && (
            <Paper
              sx={{ p: 2, bgcolor: "error.light", color: "error.contrastText" }}
            >
              <Typography variant="subtitle1">Error occurred</Typography>
              <Typography variant="body2">
                {progress.error_message || "Unknown error"}
              </Typography>
            </Paper>
          )}

          {/* Results summary if complete */}
          {progress.status === "complete" && progress.result && (
            <Paper
              sx={{
                p: 2,
                bgcolor: "success.light",
                color: "success.contrastText",
              }}
            >
              <Typography variant="subtitle1">Operation Complete</Typography>
              <Typography variant="body2">
                {progress.result.message || "Process completed successfully"}
              </Typography>
            </Paper>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

ValidationProgressTracker.propTypes = {
  taskId: PropTypes.string.isRequired,
  taskType: PropTypes.oneOf(["validation", "cleaning"]).isRequired,
  onComplete: PropTypes.func,
  pollingInterval: PropTypes.number,
};

export default ValidationProgressTracker;
