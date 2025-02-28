import React, { useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  TablePagination,
  TableSortLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Download as DownloadIcon,
  PlayArrow as PlayArrowIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
} from "@mui/icons-material";
import PropTypes from "prop-types";

const FileListTable = ({
  uploadedFiles,
  isUploading,
  handleFileProcess,
  handleFilePreview,
  handleEdit,
  handleDelete,
  handleDownload,
  getStatusColor,
  formatDate,
  formatFileSize,
  downloadingFiles,
  processingFiles,
}) => {
  // State for pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // State for sorting
  const [orderBy, setOrderBy] = useState("upload_date");
  const [order, setOrder] = useState("desc");

  // State for filtering
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle sort request
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  // Handle status filter change
  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  // Handle search query change
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  // Filter files based on status and search query
  const filteredFiles = uploadedFiles.filter((file) => {
    // Filter by status
    if (statusFilter !== "all" && file.status !== statusFilter) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        file.invoice_number.toLowerCase().includes(query) ||
        file.file.toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Sort files
  const sortedFiles = filteredFiles.sort((a, b) => {
    const isAsc = order === "asc";

    switch (orderBy) {
      case "invoice_number":
        return isAsc
          ? a.invoice_number.localeCompare(b.invoice_number)
          : b.invoice_number.localeCompare(a.invoice_number);
      case "status":
        return isAsc
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      case "upload_date":
        return isAsc
          ? new Date(a.upload_date) - new Date(b.upload_date)
          : new Date(b.upload_date) - new Date(a.upload_date);
      default:
        return 0;
    }
  });

  // Paginate files
  const paginatedFiles = sortedFiles.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  // Render file status
  const renderFileStatus = (status) => {
    return (
      <Chip
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        color={getStatusColor(status)}
        size="small"
        sx={{
          minWidth: 90,
          "& .MuiChip-label": {
            fontWeight: 500,
          },
        }}
      />
    );
  };

  // Render file actions
  const renderFileActions = (file) => {
    const isDownloading = downloadingFiles[file.id];
    const isProcessing = processingFiles[file.id];

    return (
      <Box sx={{ display: "flex" }}>
        <Tooltip title="Download">
          <IconButton
            color="primary"
            size="small"
            onClick={() => handleDownload(file.id, file.invoice_number)}
            disabled={isUploading || isDownloading}
          >
            {isDownloading ? (
              <CircularProgress size={20} />
            ) : (
              <DownloadIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>

        {["preview", "saved"].includes(file.status) && (
          <Tooltip title="Preview Data">
            <IconButton
              color="info"
              size="small"
              onClick={() => handleFilePreview(file)}
              disabled={isUploading}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Edit">
          <IconButton
            color="secondary"
            size="small"
            onClick={() => handleEdit(file)}
            disabled={isUploading}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {["pending", "failed"].includes(file.status) && (
          <Tooltip title="Process">
            <IconButton
              color="success"
              size="small"
              onClick={() => handleFileProcess(file)}
              disabled={
                isUploading || isProcessing || file.status === "processing"
              }
            >
              {isProcessing ? (
                <CircularProgress size={20} color="success" />
              ) : (
                <PlayArrowIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Delete">
          <IconButton
            color="error"
            size="small"
            onClick={() => handleDelete(file)}
            disabled={isUploading}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%" }}>
      {/* Filters and Search */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth size="small">
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter"
              value={statusFilter}
              label="Status"
              onChange={handleStatusFilterChange}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="processing">Processing</MenuItem>
              <MenuItem value="preview">Preview</MenuItem>
              <MenuItem value="saved">Saved</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={8}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by invoice number or filename"
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      </Grid>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table sx={{ minWidth: 650 }} size="medium">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={orderBy === "invoice_number"}
                  direction={orderBy === "invoice_number" ? order : "asc"}
                  onClick={() => handleRequestSort("invoice_number")}
                >
                  Invoice Number
                </TableSortLabel>
              </TableCell>
              <TableCell>File Name</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === "upload_date"}
                  direction={orderBy === "upload_date" ? order : "asc"}
                  onClick={() => handleRequestSort("upload_date")}
                >
                  Upload Date
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === "status"}
                  direction={orderBy === "status" ? order : "asc"}
                  onClick={() => handleRequestSort("status")}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedFiles.length > 0 ? (
              paginatedFiles.map((file) => (
                <TableRow
                  key={file.id}
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell component="th" scope="row">
                    {file.invoice_number}
                  </TableCell>
                  <TableCell>{file.file.split("/").pop()}</TableCell>
                  <TableCell>{formatFileSize(file.size)}</TableCell>
                  <TableCell>{formatDate(file.upload_date)}</TableCell>
                  <TableCell>{renderFileStatus(file.status)}</TableCell>
                  <TableCell align="right">{renderFileActions(file)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No files found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[5, 10, 25]}
        component="div"
        count={filteredFiles.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Box>
  );
};

FileListTable.propTypes = {
  uploadedFiles: PropTypes.array.isRequired,
  isUploading: PropTypes.bool.isRequired,
  handleFileProcess: PropTypes.func.isRequired,
  handleFilePreview: PropTypes.func.isRequired,
  handleEdit: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
  handleDownload: PropTypes.func.isRequired,
  getStatusColor: PropTypes.func.isRequired,
  formatDate: PropTypes.func.isRequired,
  formatFileSize: PropTypes.func.isRequired,
  downloadingFiles: PropTypes.object.isRequired,
  processingFiles: PropTypes.object.isRequired,
};

export default FileListTable;
