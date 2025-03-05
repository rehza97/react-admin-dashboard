import React from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  LinearProgress,
  useTheme,
  alpha,
} from "@mui/material";
import PropTypes from "prop-types";

const FileInspection = ({
  isLoading,
  error,
  fileInspection,
  targetColumns,
  onClose,
}) => {
  const theme = useTheme();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: 4,
        }}
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Inspecting file...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!fileInspection) {
    return (
      <Typography variant="body1" color="text.secondary">
        No file inspection data available
      </Typography>
    );
  }

  const {
    row_count,
    column_count,
    columns,
    header_row,
    file_type,
    detection_confidence,
  } = fileInspection;

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
    return typeMap[type] || type || "Unknown";
  };

  // Filter columns based on target columns if provided
  const displayColumns = targetColumns
    ? columns.filter((col) => targetColumns.includes(col.name))
    : columns;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          File Inspection Results
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Paper
            sx={{
              p: 2,
              bgcolor: "primary.light",
              color: "primary.contrastText",
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">Total Rows</Typography>
            <Typography variant="h5">{row_count}</Typography>
          </Paper>
          <Paper
            sx={{
              p: 2,
              bgcolor: "secondary.light",
              color: "secondary.contrastText",
              borderRadius: 1,
            }}
          >
            <Typography variant="body2">Total Columns</Typography>
            <Typography variant="h5">{column_count}</Typography>
          </Paper>
          {header_row && (
            <Paper
              sx={{
                p: 2,
                bgcolor: "info.light",
                color: "info.contrastText",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2">Header Row</Typography>
              <Typography variant="h5">{header_row}</Typography>
            </Paper>
          )}
          {file_type && (
            <Paper
              sx={{
                p: 2,
                bgcolor: "success.light",
                color: "success.contrastText",
                borderRadius: 1,
                minWidth: 200,
              }}
            >
              <Typography variant="body2">Detected File Type</Typography>
              <Typography variant="h5">
                {getFileTypeDisplayName(file_type)}
              </Typography>
              {detection_confidence > 0 && (
                <Box sx={{ mt: 1, display: "flex", alignItems: "center" }}>
                  <Typography variant="caption" sx={{ mr: 1 }}>
                    Confidence:
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={detection_confidence * 100}
                    sx={{
                      flexGrow: 1,
                      height: 4,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.grey[300], 0.5),
                      "& .MuiLinearProgress-bar": {
                        bgcolor:
                          detection_confidence > 0.7
                            ? "success.dark"
                            : detection_confidence > 0.4
                            ? "warning.dark"
                            : "error.dark",
                        borderRadius: 2,
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ ml: 1, fontWeight: "bold" }}
                  >
                    {Math.round(detection_confidence * 100)}%
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      </Box>

      <Typography variant="h6" gutterBottom>
        Column Details
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "grey.100" }}>
              <TableCell>Column Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Missing Values</TableCell>
              <TableCell>Unique Values</TableCell>
              <TableCell>Statistics</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {displayColumns.map((column, index) => (
              <TableRow key={index} hover>
                <TableCell>
                  <Typography fontWeight="medium">{column.name}</Typography>
                  {targetColumns && targetColumns.includes(column.name) && (
                    <Chip
                      size="small"
                      label="Target Column"
                      color="primary"
                      variant="outlined"
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={formatColumnType(column.type)}
                    color={getTypeColor(column.type)}
                  />
                </TableCell>
                <TableCell>
                  {column.missing > 0 ? (
                    <Chip
                      size="small"
                      label={`${column.missing} (${Math.round(
                        (column.missing / row_count) * 100
                      )}%)`}
                      color="warning"
                    />
                  ) : (
                    <Chip
                      size="small"
                      label="None"
                      color="success"
                      variant="outlined"
                    />
                  )}
                </TableCell>
                <TableCell>{column.unique_values || "N/A"}</TableCell>
                <TableCell>
                  {column.min !== undefined && (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      <Chip
                        size="small"
                        label={`Min: ${formatValue(column.min)}`}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={`Max: ${formatValue(column.max)}`}
                        variant="outlined"
                      />
                      {column.mean !== undefined && (
                        <Chip
                          size="small"
                          label={`Avg: ${formatValue(column.mean)}`}
                          variant="outlined"
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

      <Dialog open={isLoading} onClose={onClose}>
        {/* Dialog content here */}
      </Dialog>
    </Box>
  );
};

// Helper function to format column type
const formatColumnType = (type) => {
  if (!type) return "Unknown";
  if (type.includes("object")) return "Text";
  if (type.includes("int")) return "Integer";
  if (type.includes("float")) return "Decimal";
  if (type.includes("date")) return "Date";
  return type;
};

// Helper function to get color based on column type
const getTypeColor = (type) => {
  if (!type) return "default";
  if (type.includes("object")) return "default";
  if (type.includes("int") || type.includes("float")) return "primary";
  if (type.includes("date")) return "secondary";
  return "default";
};

// Helper function to format values
const formatValue = (value) => {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : value.toFixed(2);
  }
  return String(value);
};

FileInspection.propTypes = {
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  fileInspection: PropTypes.object,
  targetColumns: PropTypes.arrayOf(PropTypes.string),
  onClose: PropTypes.func,
};

export default FileInspection;
