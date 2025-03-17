import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  CircularProgress,
  Chip,
  AlertTitle,
  TablePagination,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import BlockIcon from "@mui/icons-material/Block";
import SearchIcon from "@mui/icons-material/Search";
import { userService } from "../../services/api";
import PageLayout from "../../components/PageLayout";
import { useTranslation } from "react-i18next";

const DOTManagement = () => {
  const { t } = useTranslation();
  const [dots, setDots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState("add"); // "add" or "edit"
  const [selectedDot, setSelectedDot] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    is_active: true,
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    action: null,
  });

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filtered and paginated data
  const filteredDots = dots.filter((dot) => {
    const matchesSearch = 
      dot.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dot.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (dot.description && dot.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "active" && dot.is_active !== false) ||
      (statusFilter === "inactive" && dot.is_active === false);

    return matchesSearch && matchesStatus;
  });

  const paginatedDots = filteredDots.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const fetchDOTs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userService.getAllDOTs();
      setDots(response);
      setTotalCount(response.length);
    } catch (err) {
      console.error("Failed to fetch DOTs:", err);
      setError(t("dots.errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDOTs();
  }, [fetchDOTs]);

  // Handle pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle search
  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setPage(0); // Reset to first page when searching
  };

  // Handle status filter
  const handleStatusFilterChange = (event) => {
    setStatusFilter(event.target.value);
    setPage(0); // Reset to first page when filtering
  };

  const handleOpenAddDialog = () => {
    setDialogMode("add");
    setFormData({
      code: "",
      name: "",
      description: "",
      is_active: true,
    });
    setOpenDialog(true);
  };

  const handleOpenEditDialog = (dot) => {
    setDialogMode("edit");
    setSelectedDot(dot);
    setFormData({
      code: dot.code,
      name: dot.name,
      description: dot.description || "",
      is_active: dot.is_active !== false, // Default to true if not specified
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDot(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSwitchChange = (e) => {
    setFormData({
      ...formData,
      is_active: e.target.checked,
    });
  };

  const handleSubmit = async () => {
    // Validate form data
    if (!formData.code || !formData.name) {
      setSnackbar({
        open: true,
        message: "Code and Name are required fields",
        severity: "error",
      });
      return;
    }

    try {
      if (dialogMode === "add") {
        // Add new DOT
        await userService.createDOT(formData);
        setSnackbar({
          open: true,
          message: "DOT created successfully",
          severity: "success",
        });
      } else {
        // Edit existing DOT
        await userService.updateDOT(selectedDot.id, formData);
        setSnackbar({
          open: true,
          message: "DOT updated successfully",
          severity: "success",
        });
      }
      handleCloseDialog();
      fetchDOTs(); // Refresh the DOT list
    } catch (err) {
      console.error("Failed to save DOT:", err);
      setSnackbar({
        open: true,
        message: `Failed to ${dialogMode === "add" ? "create" : "update"} DOT`,
        severity: "error",
      });
    }
  };

  const handleToggleActive = async (dot) => {
    const newStatus = !dot.is_active;
    const action = newStatus ? "activate" : "deactivate";

    setConfirmDialog({
      open: true,
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} DOT`,
      message: `Are you sure you want to ${action} the DOT "${dot.name}" (${dot.code})?`,
      action: async () => {
        try {
          await userService.updateDOT(dot.id, { ...dot, is_active: newStatus });
          setSnackbar({
            open: true,
            message: `DOT ${action}d successfully`,
            severity: "success",
          });
          fetchDOTs(); // Refresh the DOT list
        } catch (err) {
          console.error(`Failed to ${action} DOT:`, err);
          setSnackbar({
            open: true,
            message: `Failed to ${action} DOT`,
            severity: "error",
          });
        }
      },
    });
  };

  const handleDelete = (dot) => {
    setConfirmDialog({
      open: true,
      title: "Delete DOT",
      message: `Are you sure you want to delete the DOT "${dot.name}" (${dot.code})? This action cannot be undone.`,
      action: async () => {
        try {
          await userService.deleteDOT(dot.id);
          setSnackbar({
            open: true,
            message: "DOT deleted successfully",
            severity: "success",
          });
          fetchDOTs(); // Refresh the DOT list
        } catch (err) {
          console.error("Failed to delete DOT:", err);
          setSnackbar({
            open: true,
            message: "Failed to delete DOT",
            severity: "error",
          });
        }
      },
    });
  };

  const handleConfirmDialogClose = () => {
    setConfirmDialog({
      ...confirmDialog,
      open: false,
    });
  };

  const handleConfirmAction = () => {
    if (confirmDialog.action) {
      confirmDialog.action();
    }
    handleConfirmDialogClose();
  };

  const showSuccessSnackbar = (message) => {
    setSnackbar({
      open: true,
      message,
      severity: "success",
    });
  };

  const showErrorSnackbar = (message) => {
    setSnackbar({
      open: true,
      message,
      severity: "error",
    });
  };

  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  return (
    <PageLayout
      title={t("dots.manageDOTs")}
      subtitle={t("dots.manageDOTsSubtitle")}
      headerAction={
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenAddDialog}
        >
          {t("dots.addDOT")}
        </Button>
      }
    >
      {/* Search and Filter Controls */}
      <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center" }}>
        <TextField
          placeholder={t("common.search")}
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ width: 300 }}
        />
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>{t("dots.status")}</InputLabel>
          <Select
            value={statusFilter}
            onChange={handleStatusFilterChange}
            label={t("dots.status")}
          >
            <MenuItem value="all">{t("common.all")}</MenuItem>
            <MenuItem value="active">{t("dots.active")}</MenuItem>
            <MenuItem value="inactive">{t("dots.inactive")}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading && !dots.length ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("dots.code")}</TableCell>
                <TableCell>{t("dots.name")}</TableCell>
                <TableCell>{t("dots.description")}</TableCell>
                <TableCell>{t("dots.status")}</TableCell>
                <TableCell>{t("common.actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedDots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    {t("dots.noDOTsFound")}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDots.map((dot) => (
                  <TableRow key={dot.id || dot.code}>
                    <TableCell>{dot.code}</TableCell>
                    <TableCell>{dot.name}</TableCell>
                    <TableCell>{dot.description}</TableCell>
                    <TableCell>
                      {dot.is_active !== false ? (
                        <Chip
                          icon={<CheckCircleIcon fontSize="small" />}
                          label={t("dots.active")}
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<BlockIcon fontSize="small" />}
                          label={t("dots.inactive")}
                          color="error"
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip title={t("common.edit")}>
                        <IconButton
                          onClick={() => handleOpenEditDialog(dot)}
                          size="small"
                          color="primary"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip
                        title={
                          dot.is_active !== false
                            ? t("dots.deactivate")
                            : t("dots.activate")
                        }
                      >
                        <IconButton
                          onClick={() => handleToggleActive(dot)}
                          size="small"
                          color={dot.is_active !== false ? "error" : "success"}
                        >
                          {dot.is_active !== false ? (
                            <BlockIcon fontSize="small" />
                          ) : (
                            <CheckCircleIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t("common.delete")}>
                        <IconButton
                          onClick={() => handleDelete(dot)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filteredDots.length}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
            labelRowsPerPage={t("common.rowsPerPage")}
          />
        </TableContainer>
      )}

      {/* Add/Edit DOT Dialog */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === "add" ? t("dots.addDOT") : t("dots.editDOT")}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label={t("dots.code")}
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              fullWidth
              required
              disabled={dialogMode === "edit"} // Code cannot be changed once created
            />
            <TextField
              label={t("dots.name")}
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              fullWidth
              required
            />
            <TextField
              label={t("dots.description")}
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              fullWidth
              multiline
              rows={3}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_active}
                  onChange={handleSwitchChange}
                  color="primary"
                />
              }
              label={t("dots.isActive")}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {dialogMode === "add" ? t("common.add") : t("common.save")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleConfirmDialogClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            {confirmDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDialogClose} color="primary">
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirmAction}
            color="primary"
            autoFocus
            variant="contained"
          >
            {t("common.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default DOTManagement;
