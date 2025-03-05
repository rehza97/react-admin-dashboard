import React, { useState, useEffect } from "react";
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
  Tooltip,
  CircularProgress,
  useTheme,
  alpha,
  Checkbox,
  DialogActions,
  useMediaQuery,
  LinearProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import SettingsIcon from "@mui/icons-material/Settings";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SaveIcon from "@mui/icons-material/Save";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PropTypes from "prop-types";
import { Resizable } from "re-resizable";
import "../styles/dataPreview.css";
import fileService from "../services/fileService";

const DataPreviewDialog = ({
  open,
  onClose,
  previewData,
  summaryData,
  onProcess,
  onSave,
  isProcessing = false,
  isSaving = false,
  fileName = "",
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [expanded, setExpanded] = useState(!isMobile);
  const [processingMode, setProcessingMode] = useState("automatic");
  const [selectedTreatment, setSelectedTreatment] = useState("");
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [dialogSize, setDialogSize] = useState({
    width: isMobile ? "100%" : "90%",
    height: isMobile ? "100vh" : "90%",
  });

  // New state variables for file type handling
  const [availableFileTypes, setAvailableFileTypes] = useState([]);
  const [selectedFileType, setSelectedFileType] = useState("");
  const [fileTypeConfidence, setFileTypeConfidence] = useState(0);

  // Fetch available file types when component mounts
  useEffect(() => {
    const fetchFileTypes = async () => {
      if (open) {
        try {
          const types = await fileService.getFileTypes();
          setAvailableFileTypes(types);
        } catch (error) {
          console.error("Error fetching file types:", error);
        }
      }
    };

    fetchFileTypes();
  }, [open]);

  // Set selected file type based on summary data
  useEffect(() => {
    if (summaryData && summaryData.detected_file_type) {
      setSelectedFileType(summaryData.detected_file_type);
      setFileTypeConfidence(summaryData.detection_confidence || 0);
    }
  }, [summaryData]);

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

  // Update expanded state when screen size changes
  React.useEffect(() => {
    setExpanded(!isMobile);
  }, [isMobile]);

  const handleAccordionChange = () => {
    setExpanded(!expanded);
  };

  const handleProcessingModeChange = (event) => {
    setProcessingMode(event.target.value);
  };

  const handleTreatmentChange = (event) => {
    setSelectedTreatment(event.target.value);
  };

  const handleFileTypeChange = (event) => {
    setSelectedFileType(event.target.value);
    // When manually selecting a file type, set confidence to 1.0
    setFileTypeConfidence(1.0);
  };

  const handleProcess = () => {
    console.log("Process button clicked in DataPreviewDialog");
    if (onProcess) {
      // Pass processing options including file type
      const options = {
        processingMode,
        treatment: selectedTreatment,
        fileType: selectedFileType,
        remove_duplicates: true,
        handle_missing: "fill_zeros",
      };
      onProcess(options);
    }
  };

  const handleSave = () => {
    console.log("Save button clicked in DataPreviewDialog");
    if (onSave) {
      // Pass save options including file type
      const saveOptions = {
        file_type: selectedFileType,
        processed_data: true,
        options: {
          remove_duplicates: true,
          handle_missing: "fill_zeros",
        },
      };
      onSave(saveOptions);
    }
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
      ca_cnt: "CA CNT",
      facturation_manuelle: "Facturation Manuelle",
      parc_corporate: "Parc Corporate",
      creances_ngbss: "Créances NGBSS",
      etat_facture: "État de Facture",
      journal_ventes: "Journal des Ventes",
      invoice: "Invoice Data",
      general: "General Data",
      unknown: "Unknown Data Type",
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          width: isMobile ? "100%" : "auto",
          height: isMobile ? "100%" : "auto",
          m: 0,
          overflow: "hidden",
        },
      }}
      className="data-preview-dialog"
    >
      <Resizable
        size={dialogSize}
        onResizeStart={() => {
          document.body.classList.add("resizing");
        }}
        onResize={(e, direction, ref) => {
          setDialogSize({
            width: `${ref.offsetWidth}px`,
            height: `${ref.offsetHeight}px`,
          });
        }}
        onResizeStop={(e, direction, ref) => {
          document.body.classList.remove("resizing");

          setDialogSize({
            width: `${ref.offsetWidth}px`,
            height: `${ref.offsetHeight}px`,
          });
        }}
        minWidth={isMobile ? "100%" : "600px"}
        minHeight={isMobile ? "100%" : "400px"}
        maxWidth="95vw"
        maxHeight="95vh"
        defaultSize={{
          width: isMobile ? "100%" : "90vw",
          height: isMobile ? "100vh" : "90vh",
        }}
        enable={{
          top: !isMobile,
          right: !isMobile,
          bottom: !isMobile,
          left: !isMobile,
          topRight: !isMobile,
          bottomRight: !isMobile,
          bottomLeft: !isMobile,
          topLeft: !isMobile,
        }}
        handleClasses={{
          bottom: "resize-handle-visible resize-handle-bottom",
          bottomRight: "resize-handle-visible resize-handle-bottom-right",
          bottomLeft: "resize-handle-visible resize-handle-bottom-left",
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: isMobile ? 0 : "8px",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            bgcolor: "primary.main",
            color: "white",
            py: 1.5,
            px: isMobile ? 1.5 : 3,
            flexShrink: 0,
          }}
        >
          <Box
            sx={{ display: "flex", alignItems: "center", overflow: "hidden" }}
          >
            <TableChartIcon sx={{ mr: 1, flexShrink: 0 }} />
            <Typography
              variant={isMobile ? "h6" : "h5"}
              component="div"
              fontWeight="500"
              noWrap
              sx={{ flexShrink: 1 }}
            >
              File Processing Overview
            </Typography>
            <Chip
              label={getFileTypeDisplayName(detectedType)}
              color="secondary"
              size="small"
              sx={{
                ml: 1.5,
                fontWeight: "bold",
                flexShrink: 0,
                display: { xs: "none", sm: "flex" },
              }}
            />
            {fileTypeConfidence > 0 && (
              <Tooltip
                title={`Detection confidence: ${Math.round(
                  fileTypeConfidence * 100
                )}%`}
              >
                <Chip
                  label={`${Math.round(fileTypeConfidence * 100)}%`}
                  color={
                    fileTypeConfidence > 0.7
                      ? "success"
                      : fileTypeConfidence > 0.4
                      ? "warning"
                      : "error"
                  }
                  size="small"
                  variant="outlined"
                  sx={{
                    ml: 1,
                    fontWeight: "bold",
                    flexShrink: 0,
                    display: { xs: "none", md: "flex" },
                  }}
                />
              </Tooltip>
            )}
          </Box>
          <IconButton
            edge="end"
            color="inherit"
            onClick={onClose}
            aria-label="close"
            sx={{ flexShrink: 0 }}
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
                minHeight: isMobile ? 48 : 56,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <InfoOutlinedIcon
                  sx={{
                    mr: 1,
                    color: "primary.main",
                    fontSize: isMobile ? "1.2rem" : "1.5rem",
                  }}
                />
                <Typography variant={isMobile ? "subtitle1" : "h6"}>
                  Data Summary
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ ml: 1, display: { xs: "none", md: "block" } }}
                >
                  ({summaryData?.row_count || 0} rows,{" "}
                  {summaryData?.column_count || 0} columns)
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails
              sx={{
                p: { xs: 1.5, sm: 2, md: 3 },
                maxHeight: isMobile ? "35vh" : "40vh",
                overflow: "auto",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  gap: { xs: 1, sm: 2, md: 3 },
                  mb: 3,
                  flexWrap: "wrap",
                  justifyContent: { xs: "center", sm: "flex-start" },
                }}
              >
                <Box
                  sx={{
                    bgcolor: "primary.light",
                    color: "primary.contrastText",
                    p: 2,
                    borderRadius: 1,
                    minWidth: { xs: "100%", sm: "180px" },
                    flex: { xs: "1 1 100%", sm: "0 1 auto" },
                    textAlign: "center",
                  }}
                >
                  <Typography variant="h4" fontWeight="bold">
                    {summaryData?.row_count || 0}
                  </Typography>
                  <Typography variant="body2">Total Rows</Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: "secondary.light",
                    color: "secondary.contrastText",
                    p: 2,
                    borderRadius: 1,
                    minWidth: { xs: "45%", sm: "180px" },
                    flex: { xs: "1 1 45%", sm: "0 1 auto" },
                    textAlign: "center",
                  }}
                >
                  <Typography variant="h4" fontWeight="bold">
                    {summaryData?.column_count || 0}
                  </Typography>
                  <Typography variant="body2">Columns</Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: "success.light",
                    color: "success.contrastText",
                    p: 2,
                    borderRadius: 1,
                    minWidth: { xs: "45%", sm: "180px" },
                    flex: { xs: "1 1 45%", sm: "0 1 auto" },
                    textAlign: "center",
                  }}
                >
                  <Typography variant="h4" fontWeight="bold">
                    {summaryData?.valid_rows || summaryData?.row_count || 0}
                  </Typography>
                  <Typography variant="body2">Valid Rows</Typography>
                </Box>
              </Box>

              {/* File Type Selection */}
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.info.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight="bold"
                  sx={{ mb: 1 }}
                >
                  File Type
                </Typography>

                <FormControl fullWidth sx={{ mb: 1 }}>
                  <InputLabel id="file-type-select-label">File Type</InputLabel>
                  <Select
                    labelId="file-type-select-label"
                    id="file-type-select"
                    value={selectedFileType}
                    label="File Type"
                    onChange={handleFileTypeChange}
                    disabled={isProcessing || isSaving}
                  >
                    <MenuItem value="">
                      <em>Auto-detect</em>
                    </MenuItem>
                    {availableFileTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.name}
                      </MenuItem>
                    ))}
                    {!availableFileTypes.some(
                      (t) => t.id === selectedFileType
                    ) &&
                      selectedFileType && (
                        <MenuItem value={selectedFileType}>
                          {getFileTypeDisplayName(selectedFileType)}
                        </MenuItem>
                      )}
                  </Select>
                </FormControl>

                <Typography variant="body2">
                  {getFileTypeDescription(selectedFileType || detectedType)}
                </Typography>

                {fileTypeConfidence > 0 && selectedFileType && (
                  <Box sx={{ mt: 1, display: "flex", alignItems: "center" }}>
                    <Typography variant="body2" sx={{ mr: 1 }}>
                      Detection confidence:
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={fileTypeConfidence * 100}
                      sx={{
                        flexGrow: 1,
                        height: 8,
                        borderRadius: 4,
                        bgcolor: alpha(theme.palette.grey[500], 0.2),
                        "& .MuiLinearProgress-bar": {
                          bgcolor:
                            fileTypeConfidence > 0.7
                              ? "success.main"
                              : fileTypeConfidence > 0.4
                              ? "warning.main"
                              : "error.main",
                          borderRadius: 4,
                        },
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{ ml: 1, fontWeight: "bold" }}
                    >
                      {Math.round(fileTypeConfidence * 100)}%
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Column Summary */}
              {summaryData?.columns && (
                <Box>
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    sx={{ mb: 2 }}
                  >
                    Column Summary
                  </Typography>
                  <TableContainer
                    component={Paper}
                    variant="outlined"
                    sx={{ maxHeight: "300px" }}
                  >
                    <Table size={isMobile ? "small" : "medium"} stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Column Name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Sample Values</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(summaryData.columns).map(
                          ([name, info]) => (
                            <TableRow key={name}>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  fontWeight="medium"
                                  sx={{
                                    maxWidth: {
                                      xs: "120px",
                                      sm: "150px",
                                      md: "200px",
                                    },
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {name}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={formatColumnType(info.type)}
                                  size="small"
                                  color={
                                    info.type?.includes("object")
                                      ? "primary"
                                      : info.type?.includes("int") ||
                                        info.type?.includes("float")
                                      ? "secondary"
                                      : info.type?.includes("date")
                                      ? "success"
                                      : "default"
                                  }
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    maxWidth: {
                                      xs: "120px",
                                      sm: "200px",
                                      md: "300px",
                                    },
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {info.sample_values?.join(", ")}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Data Preview Section */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              p: 0,
            }}
          >
            <Box
              sx={{
                bgcolor: "grey.100",
                p: { xs: 1, sm: 1.5 },
                borderBottom: "1px solid",
                borderColor: "divider",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography variant={isMobile ? "subtitle1" : "h6"}>
                Data Preview
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip
                  label={`${previewData?.length || 0} rows`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Tooltip title="This is a preview of the first rows of data">
                  <IconButton size="small">
                    <HelpOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <TableContainer
              sx={{
                flex: 1,
                overflow: "auto",
                maxHeight: isMobile ? "40vh" : "50vh",
              }}
            >
              {previewData && previewData.length > 0 ? (
                <Table size={isMobile ? "small" : "medium"} stickyHeader>
                  <TableHead>
                    <TableRow>
                      {Object.keys(previewData[0]).map((header) => (
                        <TableCell key={header}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              maxWidth: {
                                xs: "100px",
                                sm: "150px",
                                md: "200px",
                              },
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {header}
                          </Typography>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.map((row, rowIndex) => (
                      <TableRow key={rowIndex} hover>
                        {Object.entries(row).map(([key, cell], cellIndex) => (
                          <TableCell key={cellIndex}>
                            <Typography
                              variant="body2"
                              sx={{
                                maxWidth: {
                                  xs: "100px",
                                  sm: "150px",
                                  md: "200px",
                                },
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: cell < 0 ? "error.main" : "inherit", // Highlight negative values
                              }}
                            >
                              {/* Format numbers and dates appropriately */}
                              {cell !== null && cell !== undefined
                                ? typeof cell === "number"
                                  ? key.includes("amount") ||
                                    key.includes("revenue")
                                    ? new Intl.NumberFormat("fr-FR", {
                                        style: "currency",
                                        currency: "EUR",
                                        minimumFractionDigits: 2,
                                      }).format(cell)
                                    : new Intl.NumberFormat("fr-FR").format(
                                        cell
                                      )
                                  : String(cell)
                                : ""}
                            </Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                    p: 3,
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No preview data available
                  </Typography>
                </Box>
              )}
            </TableContainer>
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            p: { xs: 1.5, sm: 2 },
            borderTop: "1px solid",
            borderColor: "divider",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Button onClick={onClose} color="inherit" variant="outlined">
            Close
          </Button>

          {/* Processing Options */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Tooltip title="Show processing options">
              <IconButton
                color="primary"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                sx={{
                  bgcolor: showAdvancedOptions
                    ? alpha(theme.palette.primary.main, 0.1)
                    : "transparent",
                  "&:hover": {
                    bgcolor: showAdvancedOptions
                      ? alpha(theme.palette.primary.main, 0.2)
                      : alpha(theme.palette.primary.main, 0.1),
                  },
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>

            <Button
              onClick={handleProcess}
              color="primary"
              variant="outlined"
              disabled={
                isProcessing || !previewData || previewData.length === 0
              }
              startIcon={
                isProcessing ? (
                  <CircularProgress size={20} />
                ) : (
                  <PlayArrowIcon />
                )
              }
            >
              {isProcessing ? "Processing..." : "Process Data"}
            </Button>

            <Button
              onClick={handleSave}
              color="primary"
              variant="contained"
              disabled={isSaving || !previewData || previewData.length === 0}
              startIcon={
                isSaving ? <CircularProgress size={20} /> : <SaveIcon />
              }
            >
              {isSaving ? "Saving..." : "Save to Database"}
            </Button>
          </Box>
        </DialogActions>

        {/* Advanced Processing Options Panel */}
        {showAdvancedOptions && (
          <Box
            sx={{
              p: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              bgcolor: alpha(theme.palette.primary.main, 0.05),
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Processing Options
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Processing Mode</FormLabel>
                  <RadioGroup
                    value={processingMode}
                    onChange={handleProcessingModeChange}
                    row
                  >
                    <FormControlLabel
                      value="automatic"
                      control={<Radio />}
                      label="Automatic"
                    />
                    <FormControlLabel
                      value="manual"
                      control={<Radio />}
                      label="Manual"
                    />
                  </RadioGroup>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth disabled={processingMode !== "manual"}>
                  <InputLabel id="treatment-select-label">Treatment</InputLabel>
                  <Select
                    labelId="treatment-select-label"
                    id="treatment-select"
                    value={selectedTreatment}
                    label="Treatment"
                    onChange={handleTreatmentChange}
                    disabled={processingMode !== "manual"}
                  >
                    <MenuItem value="">
                      <em>Select a treatment</em>
                    </MenuItem>
                    <MenuItem value="standard_facturation_manuelle">
                      Standard Facturation Manuelle
                    </MenuItem>
                    <MenuItem value="standard_ca_periodique">
                      Standard CA Periodique
                    </MenuItem>
                    <MenuItem value="standard_ca_non_periodique">
                      Standard CA Non Periodique
                    </MenuItem>
                    <MenuItem value="standard_ca_dnt">Standard CA DNT</MenuItem>
                    <MenuItem value="standard_ca_rfd">Standard CA RFD</MenuItem>
                    <MenuItem value="standard_ca_cnt">Standard CA CNT</MenuItem>
                    <MenuItem value="standard_parc_corporate">
                      Standard Parc Corporate
                    </MenuItem>
                    <MenuItem value="standard_creances_ngbss">
                      Standard Creances NGBSS
                    </MenuItem>
                    <MenuItem value="standard_etat_facture">
                      Standard Etat Facture
                    </MenuItem>
                    <MenuItem value="standard_journal_ventes">
                      Standard Journal Ventes
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={true}
                      onChange={() => {}}
                      name="removeDuplicates"
                    />
                  }
                  label="Remove duplicates"
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={true}
                      onChange={() => {}}
                      name="fillMissingValues"
                    />
                  }
                  label="Fill missing values with zeros"
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </Resizable>
    </Dialog>
  );
};

DataPreviewDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  previewData: PropTypes.array,
  summaryData: PropTypes.shape({
    detected_file_type: PropTypes.string,
    detection_confidence: PropTypes.number,
    row_count: PropTypes.number,
    column_count: PropTypes.number,
    valid_rows: PropTypes.number,
    columns: PropTypes.object,
  }),
  onProcess: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  isProcessing: PropTypes.bool,
  isSaving: PropTypes.bool,
  fileName: PropTypes.string,
};
