import React, { useState } from "react";
import { Button, Menu, MenuItem, Snackbar, Alert } from "@mui/material";
import { Download as DownloadIcon } from "@mui/icons-material";
import {
  exportToExcel,
  exportToCSV,
  formatDataForExport,
} from "../utils/exportUtils";
import PropTypes from "prop-types";

const ExportButton = ({
  data,
  columns,
  fileName = "export",
  disabled = false,
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleExport = (type) => {
    // Format data if columns are provided
    const exportData = columns ? formatDataForExport(data, columns) : data;

    let success = false;

    if (type === "excel") {
      success = exportToExcel(exportData, fileName);
    } else if (type === "csv") {
      success = exportToCSV(exportData, fileName);
    }

    setSnackbar({
      open: true,
      message: success
        ? "Export successful!"
        : "Export failed. Please try again.",
      severity: success ? "success" : "error",
    });

    handleClose();
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={<DownloadIcon />}
        onClick={handleClick}
        disabled={disabled || !data || data.length === 0}
        aria-controls="export-menu"
        aria-haspopup="true"
      >
        Export
      </Button>

      <Menu
        id="export-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
      >
        <MenuItem onClick={() => handleExport("excel")}>
          Export to Excel
        </MenuItem>
        <MenuItem onClick={() => handleExport("csv")}>Export to CSV</MenuItem>
      </Menu>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={
            snackbar.severity === "success"
              ? "success"
              : snackbar.severity === "error"
              ? "error"
              : snackbar.severity === "warning"
              ? "warning"
              : "info"
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

ExportButton.propTypes = {
  data: PropTypes.array.isRequired,
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string.isRequired,
      header: PropTypes.string,
    })
  ),
  fileName: PropTypes.string,
  disabled: PropTypes.bool,
};

export default ExportButton;
