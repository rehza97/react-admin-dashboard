import { useState, useEffect, useCallback } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";
import {
  Chip,
  useTheme,
  Button,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
  Switch,
  FormControlLabel,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Alert,
} from "@mui/material";
import AdminIcon from "@mui/icons-material/VerifiedUser";
import UserIcon from "@mui/icons-material/Person";
import EditIcon from "@mui/icons-material/Edit";
import BlockIcon from "@mui/icons-material/Block";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { userService } from "../../services/api";
import PageLayout from "../../components/PageLayout";
import { useTranslation } from "react-i18next";
import { useDebounce } from "../../hooks/useDebounce";

const ManageUsers = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [userPermissions, setUserPermissions] = useState({
    canDelete: false,
    canEdit: false,
    canAdd: false,
  });
  const debouncedShowInactive = useDebounce(showInactive, 300);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    action: null,
    userId: null,
    actionType: "",
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const permissions = await userService.getCurrentUserPermissions();
        setUserPermissions({
          canDelete: permissions?.canDeleteUsers || false,
          canEdit: permissions?.canEditUsers || false,
          canAdd: permissions?.canAddUsers || false,
        });
      } catch (err) {
        console.error("Failed to fetch user permissions:", err);
        setUserPermissions({
          canDelete: false,
          canEdit: false,
          canAdd: false,
        });
      }
    };

    checkPermissions();
  }, []);

  const fetchUsers = useCallback(
    async (retry = false) => {
      if (retry) {
        setRetryCount((prev) => prev + 1);
      } else if (!retry && retryCount > 0) {
        setRetryCount(0);
      }

      setLoading(true);
      setError(null);

      try {
        const data = await userService.getUsers(debouncedShowInactive);
        console.log("Users data:", data);

        // Map the API response to the format expected by the DataGrid
        const formattedUsers = (data.results || data).map((user) => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`.trim(),
          email: user.email,
          role: user.role,
          status: user.is_active ? "active" : "inactive",
          lastLogin: new Date(user.last_login).toLocaleString(),
          // Keep the original fields as well for reference
          ...user,
        }));

        console.log("Formatted users:", formattedUsers);

        // Filter users based on showInactive toggle
        const filteredUsers = showInactive
          ? formattedUsers
          : formattedUsers.filter((user) => user.status === "active");

        setUsers(filteredUsers);
      } catch (err) {
        console.error("Failed to fetch users:", err);

        if (err.response) {
          switch (err.response.status) {
            case 401:
              setError("Authentication error. Please log in again.");
              break;
            case 403:
              setError("You don't have permission to view users.");
              break;
            case 404:
              setError("User data not found.");
              break;
            case 500:
              setError("Server error. Please try again later.");
              break;
            default:
              setError(
                `Failed to load users: ${err.message || "Unknown error"}`
              );
          }
        } else if (err.request) {
          setError("Network error. Please check your connection.");
        } else {
          setError(`Failed to load users: ${err.message || "Unknown error"}`);
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedShowInactive, retryCount, showInactive]
  );

  useEffect(() => {
    fetchUsers();
  }, [debouncedShowInactive, fetchUsers]);

  // Debug logging for users data
  useEffect(() => {
    console.log("Current users state:", users);
    console.log("Users length:", users.length);
    console.log("Loading state:", loading);
    console.log("Error state:", error);
    console.log("Show inactive:", showInactive);
  }, [users, loading, error, showInactive]);

  const handleUserAction = async (actionFn, successMsg, errorMsg, userId) => {
    try {
      await actionFn(userId);
      setSnackbar({
        open: true,
        message: successMsg,
        severity: "success",
      });
      fetchUsers();
    } catch (err) {
      console.error(`${errorMsg}:`, err);

      let errorMessage = errorMsg;
      if (err.response) {
        switch (err.response.status) {
          case 401:
            errorMessage = "Authentication error. Please log in again.";
            break;
          case 403:
            errorMessage = "You don't have permission to perform this action.";
            break;
          case 404:
            errorMessage = "User not found.";
            break;
          case 500:
            errorMessage = "Server error. Please try again later.";
            break;
          default:
            errorMessage = `${errorMsg}: ${err.message || "Unknown error"}`;
        }
      } else if (err.request) {
        errorMessage = "Network error. Please check your connection.";
      }

      setSnackbar({
        open: true,
        message: errorMessage,
        severity: "error",
      });
    }
  };

  const handleDisableOrDeleteUser = (id, isHardDelete = false) => {
    if (!userPermissions.canDelete) {
      setSnackbar({
        open: true,
        message: isHardDelete
          ? "You don't have permission to permanently delete users"
          : "You don't have permission to disable users",
        severity: "error",
      });
      return;
    }

    setConfirmDialog({
      open: true,
      title: isHardDelete ? "Permanently Delete User" : "Disable User Account",
      message: isHardDelete
        ? "This action will permanently delete the user account and cannot be undone. Are you sure you want to continue?"
        : "This will disable the user account. The user will no longer be able to log in. Continue?",
      action: isHardDelete ? handleHardDelete : handleDisableUser,
      userId: id,
      actionType: isHardDelete ? "hard-delete" : "disable",
    });
  };

  const handleDisableUser = async (id) => {
    await handleUserAction(
      userService.disableUser,
      "User account has been disabled",
      "Failed to disable user account",
      id
    );
  };

  const handleEnableUser = async (id) => {
    if (!userPermissions.canEdit) {
      setSnackbar({
        open: true,
        message: "You don't have permission to enable users",
        severity: "error",
      });
      return;
    }

    setConfirmDialog({
      open: true,
      title: "Enable User Account",
      message:
        "This will re-enable the user account. The user will be able to log in again. Continue?",
      action: async (userId) => {
        await handleUserAction(
          userService.enableUser,
          "User account has been enabled",
          "Failed to enable user account",
          userId
        );
      },
      userId: id,
      actionType: "enable",
    });
  };

  const handleHardDelete = async (id) => {
    await handleUserAction(
      userService.hardDeleteUser,
      "User has been permanently deleted",
      "Failed to delete user",
      id
    );
  };

  const handleEditUser = (id) => {
    if (!userPermissions.canEdit) {
      setSnackbar({
        open: true,
        message: "You don't have permission to edit users",
        severity: "error",
      });
      return;
    }

    navigate(`/manage-users/edit/${id}`);
  };

  const handleAddUser = () => {
    if (!userPermissions.canAdd) {
      setSnackbar({
        open: true,
        message: "You don't have permission to add users",
        severity: "error",
      });
      return;
    }

    navigate("/manage-users/add");
  };

  const handleConfirmDialogClose = () => {
    setConfirmDialog({
      ...confirmDialog,
      open: false,
    });
  };

  const handleConfirmAction = () => {
    if (confirmDialog.action && confirmDialog.userId) {
      confirmDialog.action(confirmDialog.userId);
    }
    handleConfirmDialogClose();
  };

  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  const handleRetry = () => {
    fetchUsers(true);
  };

  const columns = [
    {
      field: "name",
      headerName: t("users.name"),
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {params.row.role === "admin" ? (
            <AdminIcon
              sx={{ color: theme.palette.primary.main, mr: 1 }}
              fontSize="small"
              aria-label="Admin user"
            />
          ) : (
            <UserIcon
              sx={{ color: theme.palette.text.secondary, mr: 1 }}
              aria-label="Regular user"
            />
          )}
          {params.value}
        </Box>
      ),
    },
    {
      field: "email",
      headerName: t("users.email"),
      flex: 1,
    },
    {
      field: "role",
      headerName: t("users.role"),
      width: 120,
      renderCell: (params) => (
        <Chip
          label={t(`users.${params.value}`)}
          color={params.value === "admin" ? "primary" : "default"}
          size="small"
          aria-label={`Role: ${t(`users.${params.value}`)}`}
        />
      ),
    },
    {
      field: "status",
      headerName: t("users.status"),
      width: 120,
      renderCell: (params) => (
        <Chip
          icon={
            params.value === "active" ? (
              <CheckCircleIcon fontSize="small" aria-hidden="true" />
            ) : (
              <BlockIcon fontSize="small" aria-hidden="true" />
            )
          }
          label={t(`users.${params.value}`)}
          color={params.value === "active" ? "success" : "error"}
          size="small"
          aria-label={`Status: ${t(`users.${params.value}`)}`}
        />
      ),
    },
    {
      field: "lastLogin",
      headerName: t("users.lastLogin"),
      width: 180,
    },
    {
      field: "actions",
      headerName: t("common.actions"),
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title={t("common.edit")}>
            <span>
              <IconButton
                onClick={() => handleEditUser(params.row.id)}
                size="small"
                sx={{ color: theme.palette.primary.main }}
                aria-label={`Edit ${params.row.name}`}
                disabled={!userPermissions.canEdit}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {params.row.status === "active" ? (
            <Tooltip title={t("common.disable") || "Disable Account"}>
              <span>
                <IconButton
                  onClick={() => handleDisableOrDeleteUser(params.row.id)}
                  size="small"
                  sx={{ color: theme.palette.error.main }}
                  aria-label={`Disable ${params.row.name}`}
                  disabled={!userPermissions.canDelete}
                >
                  <BlockIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <>
              <Tooltip title={t("common.restore")}>
                <span>
                  <IconButton
                    onClick={() => handleEnableUser(params.row.id)}
                    size="small"
                    sx={{ color: theme.palette.success.main }}
                    aria-label={`Enable ${params.row.name}`}
                    disabled={!userPermissions.canEdit}
                  >
                    <CheckCircleIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip
                title={
                  t("common.permanentlyDelete") || "Permanently Delete User"
                }
              >
                <span>
                  <IconButton
                    onClick={() =>
                      handleDisableOrDeleteUser(params.row.id, true)
                    }
                    size="small"
                    sx={{ color: theme.palette.error.dark }}
                    aria-label={`Permanently delete ${params.row.name}`}
                    disabled={!userPermissions.canDelete}
                  >
                    <DeleteForeverIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
        </Box>
      ),
    },
  ];

  const headerAction = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            color="primary"
            inputProps={{ "aria-label": "Show inactive users toggle" }}
          />
        }
        label={t("users.showInactive")}
      />
      <Button
        variant="contained"
        color="primary"
        startIcon={<AddIcon />}
        onClick={handleAddUser}
        disabled={!userPermissions.canAdd}
        aria-label="Add new user"
      >
        {t("users.addUser")}
      </Button>
    </Box>
  );

  if (loading && !users.length) {
    return (
      <PageLayout
        title={t("users.manageUsers")}
        subtitle={t("users.loadingUsers")}
        headerAction={null}
      >
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress aria-label="Loading users" />
        </Box>
      </PageLayout>
    );
  }

  if (error && !users.length) {
    return (
      <PageLayout
        title={t("users.manageUsers")}
        subtitle={t("users.errorLoadingUsers")}
        headerAction={null}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "calc(100vh - 200px)",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Typography color="error" variant="h6" gutterBottom>
            {error}
          </Typography>
          <Button
            variant="contained"
            onClick={handleRetry}
            aria-label="Retry loading users"
          >
            {t("common.retry")}
          </Button>
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t("users.manageUsers")}
      subtitle={t("users.manageUsersSubtitle")}
      headerAction={headerAction}
    >
      <Box
        sx={{ height: "calc(100vh - 200px)", width: "100%" }}
        role="region"
        aria-label="Users table"
      >
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress aria-label="Refreshing users data" />
          </Box>
        ) : error && users.length > 0 ? (
          <Box sx={{ mb: 2 }}>
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={handleRetry}>
                  {t("common.retry")}
                </Button>
              }
            >
              {error}
            </Alert>
          </Box>
        ) : null}

        {users.length === 0 && !loading && !error ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body1">
              {showInactive
                ? t("users.noUsersFound") || "No users found."
                : t("users.noActiveUsersFound") ||
                  "No active users found. Try enabling 'Show inactive users' to see all users."}
            </Typography>
          </Box>
        ) : (
          <DataGrid
            rows={users}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            checkboxSelection
            disableRowSelectionOnClick
            autoHeight
            loading={loading && users.length > 0}
            aria-label="Users data grid"
            getRowId={(row) => row.id}
          />
        )}
      </Box>

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
          <Button
            onClick={handleConfirmDialogClose}
            color="primary"
            aria-label="Cancel action"
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirmAction}
            color="primary"
            autoFocus
            variant="contained"
            aria-label="Confirm action"
          >
            {t("common.confirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
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
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Outlet />
    </PageLayout>
  );
};

export default ManageUsers;
