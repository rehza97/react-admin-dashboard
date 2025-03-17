import { useState, useEffect } from "react";
import {
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
  InputAdornment,
  TablePagination,
  Box,
} from "@mui/material";
import { Add, Refresh, Search } from "@mui/icons-material";
import { userService, authService } from "../../services/api";
import { handleApiError } from "../../utils/errorHandler";
import PageLayout from "../../components/PageLayout";
import { useTranslation } from "react-i18next";

const UserDOTPermissions = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [dots, setDots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dotsLoading, setDotsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDot, setSelectedDot] = useState("");
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [hasPermission, setHasPermission] = useState(false);
  const [addingDot, setAddingDot] = useState(false);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Filtered and paginated data
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const paginatedUsers = filteredUsers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  useEffect(() => {
    checkPermissions();
    loadData();
    loadAvailableDOTs();
  }, []);

  const checkPermissions = async () => {
    try {
      const userData = await authService.getCurrentUser();
      // Only admins can manage DOT permissions
      console.log("User data:", userData); // Add logging to debug
      setHasPermission(
        userData.is_staff || userData.is_superuser || userData.role === "admin"
      );
    } catch (error) {
      handleApiError(error, "checking permissions", setSnackbar);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await userService.getUsers(true);
      // Extract the results array from the response
      setUsers(response.results || []);
    } catch (error) {
      handleApiError(error, "loading users", setSnackbar);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDOTs = async () => {
    try {
      setDotsLoading(true);
      const response = await authService.getAvailableDOTs();
      console.log("Available DOTs:", response);

      // Use the standardized DOT format from userService
      const formattedDots = userService.standardizeDOTFormat(response);

      console.log("Formatted DOTs:", formattedDots);
      setDots(formattedDots);
    } catch (error) {
      handleApiError(error, "loading DOTs", setSnackbar);
    } finally {
      setDotsLoading(false);
    }
  };

  const handleOpenDialog = (user) => {
    setSelectedUser(user);
    setSelectedDot("");
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
    setSelectedDot("");
  };

  const handleDotChange = (event) => {
    setSelectedDot(event.target.value);
  };

  const handleAddDot = async () => {
    if (!selectedDot) {
      setSnackbar({
        open: true,
        message: "Please select a DOT to add",
        severity: "error",
      });
      return;
    }

    try {
      setAddingDot(true);

      // Find the selected DOT object
      const dotObject = dots.find((dot) => dot.code === selectedDot);

      if (!dotObject) {
        throw new Error("Selected DOT not found");
      }

      // Ensure we're using the correct field names for the backend
      const dotData = {
        dot_code: dotObject.code,
        dot_name: dotObject.name,
      };

      console.log("Adding DOT permission with data:", dotData);

      try {
        const response = await userService.assignDOTPermission(
          selectedUser.id,
          dotData
        );

        console.log("DOT permission added:", response);

        // Refresh the user list to show updated permissions
        const updatedUsers = await userService.getUsers(true);
        setUsers(updatedUsers.results || []);

        setSnackbar({
          open: true,
          message: `DOT permission added successfully for ${selectedUser.email}`,
          severity: "success",
        });

        handleCloseDialog();
      } catch (apiError) {
        // Enhanced error handling to show more details
        console.error("API error details:", apiError);

        let errorMessage = "Failed to add DOT permission";

        // Extract error message from response if available
        if (apiError.response && apiError.response.data) {
          if (typeof apiError.response.data === "string") {
            errorMessage = apiError.response.data;
          } else if (apiError.response.data.error) {
            errorMessage = apiError.response.data.error;
          } else if (apiError.response.data.detail) {
            errorMessage = apiError.response.data.detail;
          } else if (typeof apiError.response.data === "object") {
            // Try to extract field errors
            const fieldErrors = Object.entries(apiError.response.data)
              .map(([field, errors]) => {
                if (Array.isArray(errors)) {
                  return `${field}: ${errors.join(", ")}`;
                }
                return `${field}: ${errors}`;
              })
              .join("; ");

            if (fieldErrors) {
              errorMessage = `Validation errors: ${fieldErrors}`;
            }
          }
        }

        setSnackbar({
          open: true,
          message: errorMessage,
          severity: "error",
        });
      }
    } catch (error) {
      handleApiError(error, "adding DOT permission", setSnackbar);
    } finally {
      setAddingDot(false);
    }
  };

  const handleRemoveDot = async (userId, dotCode) => {
    try {
      console.log(`Removing DOT ${dotCode} from user ${userId}`);

      // Confirm with the user before removing
      if (
        !window.confirm(`Are you sure you want to remove this DOT permission?`)
      ) {
        return;
      }

      // Special handling for "all" DOT code
      if (dotCode === "all") {
        setSnackbar({
          open: true,
          message:
            "Cannot remove admin access to all DOTs directly. Please change the user's role instead.",
          severity: "warning",
        });
        return;
      }

      try {
        await userService.removeDOTPermission(userId, dotCode);

        // Refresh the user list to show updated permissions
        const updatedUsers = await userService.getUsers(true);
        setUsers(updatedUsers.results || []);

        setSnackbar({
          open: true,
          message: "DOT permission removed successfully",
          severity: "success",
        });
      } catch (apiError) {
        // Enhanced error handling
        console.error("API error details:", apiError);

        let errorMessage = "Failed to remove DOT permission";

        // Extract error message from response if available
        if (apiError.response && apiError.response.data) {
          if (typeof apiError.response.data === "string") {
            errorMessage = apiError.response.data;
          } else if (apiError.response.data.error) {
            errorMessage = apiError.response.data.error;
          } else if (apiError.response.data.detail) {
            errorMessage = apiError.response.data.detail;
          }
        }

        setSnackbar({
          open: true,
          message: errorMessage,
          severity: "error",
        });
      }
    } catch (error) {
      handleApiError(error, "removing DOT permission", setSnackbar);
    }
  };

  const getUserDOTPermissions = (user) => {
    if (!user) return [];

    // Check if user has 'all' DOTs access (admin)
    if (user.authorized_dots && user.authorized_dots.includes("all")) {
      return [{ dot_code: "all", dot_name: "All DOTs (Admin Access)" }];
    }

    // Return the user's DOT permissions
    return user.dot_permissions || [];
  };

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

  // Handle role filter
  const handleRoleFilterChange = (event) => {
    setRoleFilter(event.target.value);
    setPage(0); // Reset to first page when filtering
  };

  if (!hasPermission) {
    return (
      <PageLayout
        title={t("permissions.dotPermissions")}
        subtitle="Access Denied"
        headerAction={null}
      >
        <Alert severity="error" sx={{ mt: 2 }}>
          {t("permissions.noAccessPermission")}
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t("permissions.dotPermissions")}
      subtitle="Manage user access to different DOTs"
      headerAction={null}
    >
      {!hasPermission ? (
        <CircularProgress sx={{ display: "block", mx: "auto", my: 4 }} />
      ) : loading || dotsLoading ? (
        <CircularProgress sx={{ display: "block", mx: "auto", my: 4 }} />
      ) : (
        <>
          <Box sx={{ mb: 3, display: "flex", gap: 2, alignItems: "center" }}>
            <TextField
              placeholder={t("common.search")}
              value={searchTerm}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>{t("users.role")}</InputLabel>
              <Select
                value={roleFilter}
                onChange={handleRoleFilterChange}
                label={t("users.role")}
              >
                <MenuItem value="all">{t("common.all")}</MenuItem>
                <MenuItem value="admin">{t("users.admin")}</MenuItem>
                <MenuItem value="viewer">{t("users.viewer")}</MenuItem>
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadData}
            >
              {t("common.refresh")}
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t("users.name")}</TableCell>
                  <TableCell>{t("users.email")}</TableCell>
                  <TableCell>{t("users.role")}</TableCell>
                  <TableCell>{t("permissions.dotPermissions")}</TableCell>
                  <TableCell>{t("common.actions")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {t("users.noUsersFound")}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        {user.first_name} {user.last_name}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={t(`users.${user.role}`)}
                          color={
                            user.role === "admin"
                              ? "primary"
                              : user.role === "analyst"
                              ? "secondary"
                              : "default"
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {getUserDOTPermissions(user).length > 0 ? (
                          getUserDOTPermissions(user).map((dot) => (
                            <Chip
                              key={dot.dot_code}
                              label={dot.dot_name || dot.dot_code}
                              onDelete={() =>
                                handleRemoveDot(user.id, dot.dot_code)
                              }
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t("permissions.noDOTsAssigned")}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={() => handleOpenDialog(user)}
                        >
                          {t("permissions.assignDOT")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredUsers.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
              labelRowsPerPage={t("common.rowsPerPage")}
            />
          </TableContainer>

          <Dialog open={openDialog} onClose={handleCloseDialog}>
            <DialogTitle>
              {t("permissions.assignDOTTo", {
                user: selectedUser
                  ? `${selectedUser.first_name} ${selectedUser.last_name}`
                  : "",
              })}
            </DialogTitle>
            <DialogContent>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel id="dot-select-label">
                  {t("permissions.selectDOT")}
                </InputLabel>
                <Select
                  labelId="dot-select-label"
                  value={selectedDot}
                  onChange={handleDotChange}
                  label={t("permissions.selectDOT")}
                >
                  {dots.map((dot) => (
                    <MenuItem key={dot.code} value={dot.code}>
                      {dot.name || dot.code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>{t("common.cancel")}</Button>
              <Button
                onClick={handleAddDot}
                variant="contained"
                disabled={!selectedDot}
              >
                {t("common.add")}
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          >
            <Alert
              onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
              severity={
                snackbar.severity === "success"
                  ? "success"
                  : snackbar.severity === "error"
                  ? "error"
                  : snackbar.severity === "warning"
                  ? "warning"
                  : "info"
              }
              sx={{ width: "100%" }}
            >
              {snackbar.message}
            </Alert>
          </Snackbar>
        </>
      )}
    </PageLayout>
  );
};

export default UserDOTPermissions;
