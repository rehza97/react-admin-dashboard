import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormLabel,
  Grid,
  Alert,
  Tooltip,
  CircularProgress,
  Stack,
  useTheme,
  alpha,
  Checkbox,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import SettingsIcon from "@mui/icons-material/Settings";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import PropTypes from "prop-types";
import "../styles/dataPreview.css";

const DataPreviewDialog = ({
  open,
  onClose,
  previewData,
  summaryData,
  processingLogs = [],
  onProcess,
  isProcessing = false,
  fileName = "", // Added fileName prop to help with detection
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  const [processingMode, setProcessingMode] = useState("automatic");
  const [selectedTreatment, setSelectedTreatment] = useState("");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Define available treatments based on file type
  const availableTreatments = {
    ca_periodique: [
      {
        id: "standard",
        name: "Standard CA Periodique Processing",
        description: "Process periodic revenue data with standard fields",
      },
      {
        id: "detailed",
        name: "Detailed Revenue Analysis",
        description: "In-depth analysis with regional and product breakdowns",
      },
      {
        id: "summary",
        name: "Summary Report",
        description: "Generate summary totals by product and region",
      },
    ],
    ca_non_periodique: [
      {
        id: "standard",
        name: "Standard Non-Periodic Processing",
        description: "Process non-periodic revenue data with standard fields",
      },
      {
        id: "reconciliation",
        name: "Reconciliation Analysis",
        description: "Compare with periodic data and identify discrepancies",
      },
    ],
    ca_dnt: [
      {
        id: "standard",
        name: "DNT Data Processing",
        description: "Process DNT revenue data with standard fields",
      },
      {
        id: "technical",
        name: "Technical Analysis",
        description: "Detailed technical breakdown of DNT revenue sources",
      },
    ],
    ca_rfd: [
      {
        id: "standard",
        name: "RFD Data Processing",
        description: "Process RFD revenue data with standard fields",
      },
      {
        id: "financial",
        name: "Financial Analysis",
        description: "Detailed financial analysis of RFD data",
      },
    ],
    invoice: [
      {
        id: "standard",
        name: "Standard Invoice Processing",
        description:
          "Process invoices with standard fields (date, amount, tax, etc.)",
      },
      {
        id: "detailed",
        name: "Detailed Invoice Analysis",
        description:
          "In-depth analysis with line item extraction and categorization",
      },
    ],
    general: [
      {
        id: "basic",
        name: "Basic Data Processing",
        description: "Simple data cleaning and formatting",
      },
      {
        id: "advanced",
        name: "Advanced Data Analysis",
        description: "In-depth analysis with statistical calculations",
      },
    ],
  };

  // Detect file type from filename and data
  const detectFileType = () => {
    // If backend already detected the file type, use that
    if (summaryData?.detected_file_type) {
      return summaryData.detected_file_type;
    }

    // Otherwise use the existing logic with the fileName
    const lowerFileName = fileName.toLowerCase();

    if (
      lowerFileName.includes("ca periodique") ||
      lowerFileName.includes("ca_periodique")
    ) {
      return "ca_periodique";
    } else if (
      lowerFileName.includes("ca non periodique") ||
      lowerFileName.includes("ca_non_periodique")
    ) {
      return "ca_non_periodique";
    } else if (
      lowerFileName.includes("ca dnt") ||
      lowerFileName.includes("ca_dnt")
    ) {
      return "ca_dnt";
    } else if (
      lowerFileName.includes("ca rfd") ||
      lowerFileName.includes("ca_rfd")
    ) {
      return "ca_rfd";
    } else if (
      lowerFileName.includes("ca cnt") ||
      lowerFileName.includes("ca_cnt")
    ) {
      return "ca_cnt";
    } else if (lowerFileName.includes("facturation manuelle")) {
      return "facturation_manuelle";
    } else if (lowerFileName.includes("parc corporate")) {
      return "parc_corporate";
    } else if (
      lowerFileName.includes("créances ngbss") ||
      lowerFileName.includes("creances ngbss")
    ) {
      return "creances_ngbss";
    } else if (lowerFileName.includes("etat de facture")) {
      return "etat_facture";
    } else if (lowerFileName.includes("journal des ventes")) {
      return "journal_ventes";
    }

    // If filename doesn't match, check data structure
    if (!previewData || previewData.length === 0) return "general";

    const headers = Object.keys(previewData[0]).map((h) => h.toLowerCase());

    // Check for CA Periodique indicators
    if (
      headers.some((h) => h.includes("produit")) &&
      headers.some((h) => h.includes("ht") || h.includes("ttc"))
    ) {
      return "ca_periodique";
    }

    // Check for invoice indicators
    if (headers.some((h) => h.includes("invoice") || h.includes("facture"))) {
      return "invoice";
    }

    // Default to general
    return "general";
  };

  const detectedType = detectFileType();
  const treatments =
    availableTreatments[detectedType] || availableTreatments.general;

  // Set default treatment when treatments change
  React.useEffect(() => {
    if (treatments.length > 0 && !selectedTreatment) {
      setSelectedTreatment(treatments[0].id);
    }
  }, [treatments, selectedTreatment]);

  const handleAccordionChange = () => {
    setExpanded(!expanded);
  };

  const handleProcessingModeChange = (event) => {
    setProcessingMode(event.target.value);
  };

  const handleTreatmentChange = (event) => {
    setSelectedTreatment(event.target.value);
  };

  const handleProcess = () => {
    const options = {
      processingMode,
      treatment: selectedTreatment,
      fileType: detectedType,
      advancedOptions: showAdvancedOptions
        ? {
            // Add any advanced options here
            skipHeaderRow: true,
            trimWhitespace: true,
            detectDataTypes: true,
          }
        : {},
    };

    onProcess(options);
  };

  // Format column type for better display
  const formatColumnType = (type) => {
    if (!type) return "Unknown";
    if (type.includes("object")) return "Text";
    if (type.includes("int")) return "Number";
    if (type.includes("float")) return "Decimal";
    if (type.includes("date")) return "Date";
    return type;
  };

  // Get file type display name
  const getFileTypeDisplayName = (type) => {
    const typeMap = {
      ca_periodique: "CA Periodique",
      ca_non_periodique: "CA Non Periodique",
      ca_dnt: "CA DNT",
      ca_rfd: "CA RFD",
      invoice: "Invoice Data",
      general: "General Data",
    };
    return typeMap[type] || "Unknown Data Type";
  };

  // Get file type description
  const getFileTypeDescription = (type) => {
    const descriptionMap = {
      ca_periodique: "Periodic revenue data with product and region breakdown",
      ca_non_periodique: "Non-periodic revenue data",
      ca_dnt: "DNT revenue data",
      ca_rfd: "RFD revenue data",
      invoice: "Invoice and billing data",
      general: "General data format",
    };
    return descriptionMap[type] || "";
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      className="data-preview-dialog"
      PaperProps={{
        sx: {
          borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
          height: "90vh",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          bgcolor: "primary.main",
          color: "white",
          py: 2,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <TableChartIcon sx={{ mr: 1.5 }} />
          <Typography variant="h5" component="div" fontWeight="500">
            File Processing Overview
          </Typography>
          <Chip
            label={getFileTypeDisplayName(detectedType)}
            color="secondary"
            size="small"
            sx={{ ml: 2, fontWeight: "bold" }}
          />
        </Box>
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          aria-label="close"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flex: 1,
        }}
      >
        {/* Summary Section */}
        <Accordion
          expanded={expanded}
          onChange={handleAccordionChange}
          sx={{
            boxShadow: "none",
            "&:before": { display: "none" },
            flexShrink: 0,
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: "grey.100",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <InfoOutlinedIcon sx={{ mr: 1, color: "primary.main" }} />
              <Typography variant="h6">Data Summary</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails
            sx={{
              p: 3,
              maxHeight: "40vh",
              overflow: "auto",
            }}
          >
            <Box sx={{ display: "flex", gap: 4, mb: 3, flexWrap: "wrap" }}>
              <Box
                sx={{
                  bgcolor: "primary.light",
                  color: "primary.contrastText",
                  p: 2,
                  borderRadius: 2,
                  minWidth: 180,
                }}
              >
                <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                  Total Rows
                </Typography>
                <Typography variant="h4">
                  {summaryData?.row_count || 0}
                </Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: "secondary.light",
                  color: "secondary.contrastText",
                  p: 2,
                  borderRadius: 2,
                  minWidth: 180,
                }}
              >
                <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                  Columns
                </Typography>
                <Typography variant="h4">
                  {summaryData?.column_count || 0}
                </Typography>
              </Box>

              <Box
                sx={{
                  bgcolor: alpha(theme.palette.info.main, 0.2),
                  color: theme.palette.info.dark,
                  p: 2,
                  borderRadius: 2,
                  minWidth: 180,
                }}
              >
                <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                  Detected File Type
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                  {getFileTypeDisplayName(detectedType)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  {getFileTypeDescription(detectedType)}
                </Typography>
              </Box>
            </Box>

            <Typography variant="h6" sx={{ mb: 2, mt: 3 }}>
              Column Details
            </Typography>

            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{ maxHeight: "25vh" }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: "grey.100" }}>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Column Name
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      Unique Values
                    </TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Missing</TableCell>
                    <TableCell sx={{ fontWeight: "bold" }}>Stats</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summaryData?.columns?.map((column, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography fontWeight="500">
                          {column.name || `Unnamed: ${index}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatColumnType(column.type)}
                          size="small"
                          color={
                            column.type?.includes("object")
                              ? "default"
                              : column.type?.includes("int") ||
                                column.type?.includes("float")
                              ? "primary"
                              : column.type?.includes("date")
                              ? "secondary"
                              : "default"
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{column.unique_values || "N/A"}</TableCell>
                      <TableCell>
                        {column.missing > 0 ? (
                          <Chip
                            label={column.missing}
                            size="small"
                            color="warning"
                          />
                        ) : (
                          <Chip
                            label="0"
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {column.min !== undefined && (
                          <Box
                            sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}
                          >
                            <Chip size="small" label={`Min: ${column.min}`} />
                            <Chip size="small" label={`Max: ${column.max}`} />
                            {column.mean !== undefined && (
                              <Chip
                                size="small"
                                label={`Avg: ${Number(column.mean).toFixed(2)}`}
                              />
                            )}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>

        {/* Data Preview Section */}
        <Box
          sx={{
            p: 3,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, flexShrink: 0 }}>
            Data Preview{" "}
            {previewData?.length > 0
              ? `(${Math.min(previewData.length, 10)} of ${
                  previewData.length
                } rows)`
              : ""}
          </Typography>

          {previewData && previewData.length > 0 ? (
            <TableContainer
              component={Paper}
              variant="outlined"
              sx={{
                flex: 1,
                overflow: "auto",
                maxHeight: expanded ? "35vh" : "65vh",
              }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "primary.light" }}>
                    {Object.keys(previewData[0]).map((key) => (
                      <TableCell
                        key={key}
                        sx={{
                          fontWeight: "bold",
                          whiteSpace: "nowrap",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        {key}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewData.slice(0, 10).map((row, rowIndex) => (
                    <TableRow key={rowIndex} hover>
                      {Object.values(row).map((value, cellIndex) => (
                        <TableCell key={cellIndex}>
                          {value !== null && value !== undefined
                            ? String(value)
                            : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">
              No preview data available
            </Typography>
          )}
        </Box>

        {/* Processing Options Section */}
        <Box sx={{ px: 3, pb: 3, pt: 1 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Processing Options
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Processing Mode</FormLabel>
                  <RadioGroup
                    row
                    name="processing-mode"
                    value={processingMode}
                    onChange={handleProcessingModeChange}
                  >
                    <FormControlLabel
                      value="automatic"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <AutorenewIcon fontSize="small" sx={{ mr: 0.5 }} />
                          <Typography>Automatic</Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="manual"
                      control={<Radio />}
                      label={
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <SettingsIcon fontSize="small" sx={{ mr: 0.5 }} />
                          <Typography>Manual</Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>

                {processingMode === "automatic" && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Automatic mode will apply the most appropriate processing
                    for {getFileTypeDisplayName(detectedType)}.
                  </Alert>
                )}
              </Grid>

              {processingMode === "manual" && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="treatment-select-label">
                      Processing Treatment
                    </InputLabel>
                    <Select
                      labelId="treatment-select-label"
                      id="treatment-select"
                      value={selectedTreatment}
                      label="Processing Treatment"
                      onChange={handleTreatmentChange}
                    >
                      {treatments.map((treatment) => (
                        <MenuItem key={treatment.id} value={treatment.id}>
                          {treatment.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedTreatment && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      {
                        treatments.find((t) => t.id === selectedTreatment)
                          ?.description
                      }
                    </Typography>
                  )}
                </Grid>
              )}

              <Grid item xs={12}>
                <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                  <Button
                    size="small"
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                    endIcon={<ExpandMoreIcon />}
                  >
                    {showAdvancedOptions ? "Hide" : "Show"} Advanced Options
                  </Button>
                  <Tooltip title="Configure detailed processing parameters">
                    <HelpOutlineIcon
                      fontSize="small"
                      sx={{ ml: 1, color: "text.secondary" }}
                    />
                  </Tooltip>
                </Box>

                {showAdvancedOptions && (
                  <Box
                    sx={{
                      mt: 2,
                      p: 2,
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      Advanced Processing Options
                    </Typography>
                    <Stack spacing={2}>
                      <FormControlLabel
                        control={<Checkbox defaultChecked />}
                        label="Skip header row"
                      />
                      <FormControlLabel
                        control={<Checkbox defaultChecked />}
                        label="Trim whitespace"
                      />
                      <FormControlLabel
                        control={<Checkbox defaultChecked />}
                        label="Auto-detect data types"
                      />
                      <FormControlLabel
                        control={<Checkbox />}
                        label="Normalize date formats"
                      />
                      <FormControlLabel
                        control={<Checkbox />}
                        label="Convert currency values"
                      />
                      {detectedType.startsWith("ca_") && (
                        <>
                          <FormControlLabel
                            control={<Checkbox />}
                            label="Aggregate by region"
                          />
                          <FormControlLabel
                            control={<Checkbox />}
                            label="Aggregate by product"
                          />
                        </>
                      )}
                    </Stack>
                  </Box>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Box>

        {/* Processing Logs Section */}
        {processingLogs && processingLogs.length > 0 && (
          <Box sx={{ px: 3, pb: 3 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Processing Logs</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box
                  sx={{
                    bgcolor: "background.paper",
                    p: 1,
                    borderRadius: 1,
                    maxHeight: 200,
                    overflow: "auto",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                  }}
                >
                  {processingLogs.map((log, index) => (
                    <Box
                      key={index}
                      sx={{
                        py: 0.5,
                        color:
                          log.level === "error"
                            ? "error.main"
                            : log.level === "success"
                            ? "success.main"
                            : "text.primary",
                      }}
                    >
                      <Typography
                        variant="body2"
                        component="span"
                        sx={{ mr: 1, opacity: 0.7 }}
                      >
                        [{log.timestamp}]
                      </Typography>
                      <Typography variant="body2" component="span">
                        {log.message}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* Process Button */}
        <Box
          sx={{
            p: 2,
            textAlign: "right",
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            sx={{ mr: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleProcess}
            disabled={isProcessing}
            startIcon={isProcessing ? <CircularProgress size={20} /> : null}
          >
            {isProcessing ? "Processing..." : "Start Processing"}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

DataPreviewDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  previewData: PropTypes.array,
  summaryData: PropTypes.shape({
    row_count: PropTypes.number,
    column_count: PropTypes.number,
    columns: PropTypes.array,
  }),
  processingLogs: PropTypes.array,
  onProcess: PropTypes.func.isRequired,
  isProcessing: PropTypes.bool,
  fileName: PropTypes.string,
};

export default DataPreviewDialog;
