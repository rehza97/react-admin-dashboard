import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Chip,
  Button,
  Tooltip,
  CircularProgress,
  useTheme,
  alpha,
  IconButton,
  Paper,
  Tabs,
  Tab,
  Divider,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  AppBar,
  Toolbar,
  Alert,
  LinearProgress,
} from "@mui/material";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SaveIcon from "@mui/icons-material/Save";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PropTypes from "prop-types";
import fileService from "../../services/fileService";
import "../../../src/styles/dataPreview.css";

const FileProcessingView = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { fileId } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [summaryData, setSummaryData] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [successMessage, setSuccessMessage] = useState(null);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [saveProgress, setSaveProgress] = useState(0);

  useEffect(() => {
    if (fileId) {
      inspectFile(fileId);
    } else {
      setIsLoading(false);
      setError("No file ID provided");
    }
  }, [fileId]);

  const simulateFetchProgress = () => {
    setFetchProgress(0);
    const interval = setInterval(() => {
      setFetchProgress((prevProgress) => {
        const newProgress = prevProgress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        return newProgress;
      });
    }, 300);
    return interval;
  };

  const simulateSaveProgress = () => {
    setSaveProgress(0);
    const interval = setInterval(() => {
      setSaveProgress((prevProgress) => {
        const newProgress = prevProgress + 5;
        if (newProgress >= 100) {
          clearInterval(interval);
          return 100;
        }
        return newProgress;
      });
    }, 200);
    return interval;
  };

  const inspectFile = async (id) => {
    if (!id) {
      setError("No file ID provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const progressInterval = simulateFetchProgress();

    try {
      console.log(`Inspecting file with ID: ${id}`);
      const response = await fileService.inspectFile(id);

      setFetchProgress(100);

      console.log("Inspection response:", response);

      if (response) {
        // Get file details
        const fileDetails = await fileService.getFileById(id);
        setFileName(fileDetails.file.split("/").pop() || "Unknown file");

        // Set preview data and summary
        setPreviewData(response.preview_data || []);
        setSummaryData(response.summary_data || {});

        // Set file type information
        setFileType(response.file_type || "");
        setDetectionConfidence(response.detection_confidence || 0);
      }
    } catch (error) {
      console.error("Error inspecting file:", error);
      setError(error.response?.data?.error || "Failed to inspect file");
    } finally {
      clearInterval(progressInterval);
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    if (!fileId) {
      setError("No file ID provided");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const progressInterval = simulateFetchProgress();

    try {
      console.log(`Processing file with ID: ${fileId}`);

      const processingOptions = {
        processingMode: "automatic",
        fileType:
          fileType ||
          (summaryData && "detected_file_type" in summaryData
            ? summaryData.detected_file_type
            : ""),
        remove_duplicates: true,
        handle_missing: "fill_zeros",
        filters: [],
      };

      const response = await fileService.processFile(fileId, processingOptions);

      setFetchProgress(100);

      if (response) {
        setPreviewData(response.preview_data || []);
        setSummaryData(response.summary_data || {});
        setFileType(response.file_type || "");
        setDetectionConfidence(response.detection_confidence || 0);
        setSuccessMessage("File processed successfully");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      setError(error.response?.data?.error || "Failed to process file");
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    if (!fileId) {
      setError("No file ID provided");
      return;
    }

    setIsSaving(true);
    setError(null);

    const progressInterval = simulateSaveProgress();

    try {
      console.log(`Saving file with ID: ${fileId}`);

      const dataToSave = {
        processed_data: true,
        file_type:
          fileType ||
          (summaryData && "detected_file_type" in summaryData
            ? summaryData.detected_file_type
            : ""),
        options: {
          remove_duplicates: true,
          handle_missing: "fill_zeros",
        },
      };

      const response = await fileService.saveToDatabase(fileId, dataToSave);

      setSaveProgress(100);

      if (response) {
        setSuccessMessage(`Successfully saved data to database`);

        setTimeout(() => {
          navigate("/file-upload");
        }, 2000);
      }
    } catch (error) {
      console.error("Error saving to database:", error);
      setError(error.response?.data?.error || "Failed to save to database");
    } finally {
      clearInterval(progressInterval);
      setIsSaving(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const getFileTypeDisplayName = (type) => {
    const displayNames = {
      ca_periodique: "CA Périodique",
      ca_non_periodique: "CA Non Périodique",
      ca_dnt: "CA DNT",
      ca_rfd: "CA RFD",
      ca_cnt: "CA CNT",
      facturation_manuelle: "Facturation Manuelle",
      parc_corporate: "Parc Corporate",
      creances_ngbss: "Créances NGBSS",
      etat_facture: "État Facture",
      journal_ventes: "Journal Ventes",
      invoice: "Invoice",
      general: "General Format",
      unknown: "Unknown Format",
    };
    return displayNames[type] || type;
  };

  const getFileTypeDescription = (type) => {
    const descriptionMap = {
      ca_periodique: "Periodic revenue data with product and region breakdown",
      ca_non_periodique: "Non-periodic revenue data",
      ca_dnt: "DNT revenue data",
      ca_rfd: "RFD revenue data",
      ca_cnt: "CNT revenue data",
      facturation_manuelle: "Manual billing data",
      parc_corporate: "Corporate park data",
      creances_ngbss: "NGBSS receivables data",
      etat_facture: "Invoice status data",
      journal_ventes: "Sales journal data",
      invoice: "Invoice and billing data",
      general: "General data format",
      unknown: "Unknown data format",
    };
    return descriptionMap[type] || "";
  };

  const formatColumnType = (type) => {
    const typeMap = {
      string: "Text",
      number: "Number",
      date: "Date",
      boolean: "Boolean",
      object: "Object",
      array: "Array",
      null: "Empty",
      undefined: "Undefined",
    };
    return typeMap[type] || type;
  };

  const renderDataSummary = () => {
    const currentFileType =
      fileType ||
      (summaryData && "detected_file_type" in summaryData
        ? summaryData.detected_file_type
        : "unknown");

    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Data Summary
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
          <Paper className="summary-card">
            <Typography className="summary-card-title">File Type</Typography>
            <Typography className="summary-card-value">
              {getFileTypeDisplayName(currentFileType)}
            </Typography>
            {detectionConfidence > 0 && (
              <Box sx={{ mt: 1, display: "flex", alignItems: "center" }}>
                <Typography variant="caption" sx={{ mr: 1 }}>
                  Confidence:
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={detectionConfidence * 100}
                  sx={{
                    flexGrow: 1,
                    height: 4,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.grey[500], 0.2),
                    "& .MuiLinearProgress-bar": {
                      bgcolor:
                        detectionConfidence > 0.7
                          ? "success.main"
                          : detectionConfidence > 0.4
                          ? "warning.main"
                          : "error.main",
                      borderRadius: 2,
                    },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ ml: 1, fontWeight: "bold" }}
                >
                  {Math.round(detectionConfidence * 100)}%
                </Typography>
              </Box>
            )}
          </Paper>

          <Paper className="summary-card">
            <Typography className="summary-card-title">Rows</Typography>
            <Typography className="summary-card-value">
              {summaryData && "row_count" in summaryData
                ? String(summaryData.row_count)
                : "0"}
            </Typography>
          </Paper>

          <Paper className="summary-card">
            <Typography className="summary-card-title">Columns</Typography>
            <Typography className="summary-card-value">
              {summaryData && "column_count" in summaryData
                ? String(summaryData.column_count)
                : "0"}
            </Typography>
          </Paper>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {getFileTypeDescription(currentFileType)}
        </Typography>

        {summaryData && "columns" in summaryData && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Column Information
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Column Name</TableCell>
                    <TableCell>Data Type</TableCell>
                    <TableCell>Sample Values</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(summaryData.columns).map(([col, info]) => (
                    <TableRow key={col}>
                      <TableCell>{col}</TableCell>
                      <TableCell>
                        <Chip
                          label={formatColumnType(info.type)}
                          size="small"
                          className={`column-type-${info.type}`}
                        />
                      </TableCell>
                      <TableCell>
                        {Array.isArray(info.sample_values) &&
                          info.sample_values
                            .slice(0, 3)
                            .map((val) => String(val))
                            .join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>
    );
  };

  const renderDataPreview = () => {
    if (!previewData) {
      return (
        <Typography variant="body1" sx={{ p: 2 }}>
          No preview data available
        </Typography>
      );
    }

    if (
      previewData &&
      typeof previewData === "object" &&
      "error" in previewData
    ) {
      return (
        <Typography variant="body1" color="error" sx={{ p: 2 }}>
          Error: {String(previewData.error)}
        </Typography>
      );
    }

    const dataArray = Array.isArray(previewData) ? previewData : [];

    if (dataArray.length === 0) {
      return (
        <Typography variant="body1" sx={{ p: 2 }}>
          No data to display
        </Typography>
      );
    }

    // Get columns based on file type
    let columns = Object.keys(dataArray[0]);

    // For facturation_manuelle, prioritize specific columns
    if (fileType === "facturation_manuelle") {
      const priorityColumns = [
        "department",
        "fiscal_year",
        "amount_pre_tax",
        "total_amount",
        "description",
      ];

      // Filter columns to prioritize important ones
      const availablePriorityColumns = priorityColumns.filter((col) =>
        columns.includes(col)
      );

      if (availablePriorityColumns.length > 0) {
        columns = availablePriorityColumns;
      }
    }

    const columnDisplayNames = {
      department: "Department",
      fiscal_year: "Fiscal Year",
      amount_pre_tax: "Amount Pre-Tax",
      total_amount: "Total Amount",
      description: "Description",
      organization: "Organization",
      origin: "Origin",
      invoice_number: "Invoice Number",
      revenue_amount: "Revenue Amount",
    };

    return (
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader aria-label="preview table">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column} sx={{ fontWeight: "bold" }}>
                  {columnDisplayNames[column] || column}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {dataArray.map((row, rowIndex) => (
              <TableRow key={rowIndex} hover>
                {columns.map((column) => (
                  <TableCell key={`${rowIndex}-${column}`}>
                    {column.includes("amount") || column.includes("revenue")
                      ? new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(row[column] || 0)
                      : row[column]?.toString() || ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading file data...
        </Typography>
        <Box sx={{ width: "50%", mt: 2 }}>
          <LinearProgress variant="determinate" value={fetchProgress} />
          <Typography
            variant="caption"
            align="center"
            display="block"
            sx={{ mt: 1 }}
          >
            {fetchProgress}% complete
          </Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <Typography variant="h6" color="error">
          Error: {error}
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/file-upload")}
          sx={{ mt: 2 }}
        >
          Back to File Upload
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate("/file-upload")}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            File Processing: {fileName}
          </Typography>

          {fileType && (
            <Chip
              label={getFileTypeDisplayName(fileType)}
              color="primary"
              sx={{ mr: 2 }}
            />
          )}

          <Tooltip title="Process File">
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlayArrowIcon />}
              onClick={handleProcess}
              disabled={isProcessing}
              sx={{ mr: 1 }}
            >
              {isProcessing ? (
                <>
                  Processing...
                  <CircularProgress size={24} sx={{ ml: 1, color: "white" }} />
                </>
              ) : (
                "Process"
              )}
            </Button>
          </Tooltip>
          <Tooltip title="Save to Database">
            <Button
              variant="contained"
              color="success"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  Saving...
                  <CircularProgress size={24} sx={{ ml: 1, color: "white" }} />
                </>
              ) : (
                "Save"
              )}
            </Button>
          </Tooltip>
        </Toolbar>
        <Tabs value={activeTab} onChange={handleTabChange} centered>
          <Tab
            label="Data Summary"
            icon={<InfoOutlinedIcon />}
            iconPosition="start"
          />
          <Tab
            label="Data Preview"
            icon={<TableChartIcon />}
            iconPosition="start"
          />
        </Tabs>
      </AppBar>

      {successMessage && (
        <Alert
          severity="success"
          sx={{ m: 2 }}
          onClose={() => setSuccessMessage(null)}
        >
          {successMessage}
        </Alert>
      )}

      {isSaving && (
        <Box sx={{ width: "100%", px: 2 }}>
          <LinearProgress variant="determinate" value={saveProgress} />
          <Typography
            variant="caption"
            align="center"
            display="block"
            sx={{ mt: 0.5 }}
          >
            Saving data: {saveProgress}% complete
          </Typography>
        </Box>
      )}

      <Box sx={{ flexGrow: 1, overflow: "auto" }}>
        {activeTab === 0 && renderDataSummary()}
        {activeTab === 1 && renderDataPreview()}
      </Box>
    </Box>
  );
};

FileProcessingView.propTypes = {
  fileId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default FileProcessingView;
