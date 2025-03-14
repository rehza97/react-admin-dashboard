import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from "@mui/material";
import {
  CleaningServices,
  Check,
  Error as ErrorIcon,
} from "@mui/icons-material";
import dataService from "../services/dataService";
import { useTranslation } from "react-i18next";

const DataCleanupTool = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [selectedDataType, setSelectedDataType] = useState("all");
  const [analysisResults, setAnalysisResults] = useState(null);
  const [cleanupProgress, setCleanupProgress] = useState(null);
  const [cleanupResults, setCleanupResults] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Data types with labels for selection
  const dataTypes = [
    { value: "all", label: "All Data Types" },
    { value: "parc_corporate", label: "Parc Corporate NGBSS" },
    { value: "creances_ngbss", label: "Créances NGBSS" },
    { value: "ca_non_periodique", label: "CA Non Périodique" },
    { value: "ca_periodique", label: "CA Périodique" },
    { value: "ca_dnt", label: "CA DNT (Ajustement)" },
    { value: "ca_rfd", label: "CA RFD (Remboursement)" },
    { value: "ca_cnt", label: "CA CNT (Annulation)" },
    { value: "journal_ventes", label: "Journal des Ventes" },
    { value: "etat_facture", label: "État de Facture" },
  ];

  // Poll cleanup progress if taskId exists
  useEffect(() => {
    let intervalId;

    if (taskId && cleaning) {
      intervalId = setInterval(async () => {
        try {
          const progress = await dataService.getCleanupProgress(taskId);
          setCleanupProgress(progress);

          if (progress.status === "complete") {
            setCleaning(false);
            setCleanupResults(progress.result);
            setSuccess("Data cleanup completed successfully");
            clearInterval(intervalId);
          } else if (progress.status === "failed") {
            setCleaning(false);
            setError(`Cleanup failed: ${progress.error || "Unknown error"}`);
            clearInterval(intervalId);
          }
        } catch (err) {
          console.error("Error fetching cleanup progress:", err);
          // Don't stop polling on temporary errors
        }
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [taskId, cleaning]);

  const handleAnalyzeData = async () => {
    setAnalyzing(true);
    setError(null);
    setSuccess(null);
    setAnalysisResults(null);

    try {
      const results = await dataService.analyzeDataForCleanup({
        data_type: selectedDataType,
      });
      setAnalysisResults(results);
    } catch (err) {
      console.error("Error analyzing data:", err);
      setError("Failed to analyze data. Please try again later.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCleanData = async () => {
    setCleaning(true);
    setError(null);
    setSuccess(null);
    setCleanupResults(null);
    setCleanupProgress(null);

    try {
      const response = await dataService.cleanupData({
        data_type: selectedDataType,
      });
      if (response && response.task_id) {
        setTaskId(response.task_id);
      } else {
        throw new Error("No task ID returned from cleanup start");
      }
    } catch (err) {
      console.error("Error starting cleanup:", err);
      setError("Failed to start data cleanup. Please try again later.");
      setCleaning(false);
    }
  };

  // Render records to clean table
  const renderRecordsToCleanTable = () => {
    if (!analysisResults || !analysisResults.records_to_clean) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Records That Need Cleaning
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data Type</TableCell>
                <TableCell>Total Records to Clean</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(analysisResults.records_to_clean).map(
                ([type, data]) => (
                  <TableRow key={type}>
                    <TableCell>
                      {dataTypes.find((dt) => dt.value === type)?.label || type}
                    </TableCell>
                    <TableCell>{data.total || 0}</TableCell>
                    <TableCell>
                      {Object.entries(data)
                        .filter(([key]) => key !== "total")
                        .map(([key, value]) => (
                          <Typography key={key} variant="body2">
                            {key.replace("_", " ")}: {value}
                          </Typography>
                        ))}
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Render cleaning rules
  const renderCleaningRules = () => {
    if (!analysisResults || !analysisResults.cleaning_rules) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Cleaning Rules
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data Type</TableCell>
                <TableCell>Field</TableCell>
                <TableCell>Rule</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(analysisResults.cleaning_rules).flatMap(
                ([type, rules]) =>
                  Object.entries(rules).map(([field, rule]) => (
                    <TableRow key={`${type}-${field}`}>
                      <TableCell>
                        {dataTypes.find((dt) => dt.value === type)?.label ||
                          type}
                      </TableCell>
                      <TableCell>{field}</TableCell>
                      <TableCell>{rule}</TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Render cleanup results
  const renderCleanupResults = () => {
    if (!cleanupResults) return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Cleanup Results
        </Typography>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data Type</TableCell>
                <TableCell>Records Before</TableCell>
                <TableCell>Records After</TableCell>
                <TableCell>Records Deleted</TableCell>
                <TableCell>Anomalies Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(cleanupResults).map(([type, result]) => (
                <TableRow key={type}>
                  <TableCell>
                    {dataTypes.find((dt) => dt.value === type)?.label || type}
                  </TableCell>
                  <TableCell>{result.total_before || 0}</TableCell>
                  <TableCell>{result.total_after || 0}</TableCell>
                  <TableCell>{result.total_deleted || 0}</TableCell>
                  <TableCell>{result.anomalies_created || 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Data Cleanup Tool
      </Typography>
      <Typography variant="body1" paragraph>
        This tool helps you clean data according to the client requirements.
        First analyze the data to see what needs cleaning, then run the cleanup
        process.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Data Selection
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Data Type</InputLabel>
            <Select
              value={selectedDataType}
              onChange={(e) => setSelectedDataType(e.target.value)}
              label="Data Type"
              disabled={analyzing || cleaning}
            >
              {dataTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  {type.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={handleAnalyzeData}
            disabled={analyzing || cleaning}
            startIcon={
              analyzing ? <CircularProgress size={20} /> : <CleaningServices />
            }
          >
            {analyzing ? "Analyzing..." : "Analyze Data"}
          </Button>

          <Button
            variant="contained"
            color="primary"
            onClick={handleCleanData}
            disabled={!analysisResults || analyzing || cleaning}
            startIcon={cleaning ? <CircularProgress size={20} /> : <Check />}
          >
            {cleaning ? "Cleaning..." : "Clean Data"}
          </Button>
        </Box>
      </Paper>

      {cleaning && cleanupProgress && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Cleanup Progress
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {cleanupProgress.step}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={cleanupProgress.progress}
              sx={{ mt: 1, mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              {Math.round(cleanupProgress.progress)}% Complete
            </Typography>
          </Box>
          <Typography variant="body2">
            Elapsed time: {Math.round(cleanupProgress.elapsed_time)} seconds
          </Typography>
        </Paper>
      )}

      {renderRecordsToCleanTable()}
      {renderCleaningRules()}
      {renderCleanupResults()}
    </Box>
  );
};

export default DataCleanupTool;
