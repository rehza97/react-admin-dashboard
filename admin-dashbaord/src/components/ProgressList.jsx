import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  LinearProgress,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Link } from "react-router-dom";
import RefreshIcon from "@mui/icons-material/Refresh";
import fileService from "../services/fileService";

const ProgressList = () => {
  const [progressList, setProgressList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProgressList = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fileService.getProgress();
      setProgressList(data);
    } catch (err) {
      setError(err.message || "Failed to fetch progress data");
      console.error("Error fetching progress data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgressList();

    // Set up polling for active processes
    const intervalId = setInterval(() => {
      // Only refresh if there are active processes
      if (
        progressList.some(
          (p) => p.status === "processing" || p.status === "in_progress"
        )
      ) {
        fetchProgressList();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProgressList();
    setRefreshing(false);
  };

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

  if (loading && !refreshing) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6">Recent Processes</Typography>
        <Button
          startIcon={
            refreshing ? <CircularProgress size={20} /> : <RefreshIcon />
          }
          onClick={handleRefresh}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {progressList.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ p: 2, textAlign: "center" }}
        >
          No recent processes found
        </Typography>
      ) : (
        <List>
          {progressList.map((item, index) => (
            <React.Fragment key={item.invoice_id}>
              {index > 0 && <Divider component="li" />}
              <ListItem
                component={Link}
                to={`/invoices/${item.invoice_id}`}
                sx={{
                  textDecoration: "none",
                  color: "inherit",
                  "&:hover": {
                    backgroundColor: "rgba(0, 0, 0, 0.04)",
                  },
                }}
              >
                <ListItemText
                  primary={
                    <Typography variant="subtitle1">
                      {item.invoice_number || `Invoice #${item.invoice_id}`}
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        {item.message || "Processing..."}
                      </Typography>
                      {(item.status === "processing" ||
                        item.status === "in_progress") && (
                        <LinearProgress
                          variant="determinate"
                          value={item.progress_percent || 0}
                          sx={{ height: 5, borderRadius: 5, mt: 1 }}
                        />
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={item.status}
                    color={getStatusColor(item.status)}
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default ProgressList;
