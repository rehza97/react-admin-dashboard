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
  Divider,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import "../styles/dataPreview.css";

const DataPreviewDialog = ({
  open,
  onClose,
  previewData,
  summaryData,
  processingLogs = [],
  onProcess,
}) => {
  const [expanded, setExpanded] = useState(true);

  const handleAccordionChange = () => {
    setExpanded(!expanded);
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
          position: "absolute", // Centering
          top: "120%", // Center vertically
          left: "50%", // Center horizontally
          transform: "translate(-50%, -50%)", // Adjust position
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
        <Typography variant="h5" component="div" fontWeight="500">
          Data Preview
        </Typography>
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
        <Box sx={{ p: 2, textAlign: "right" }}>
          <Button variant="contained" color="primary" onClick={onProcess}>
            Start Processing
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default DataPreviewDialog;
