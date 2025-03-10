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
} from "@mui/material";
import { Add, Refresh } from "@mui/icons-material";
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

      await userService.removeDOTPermission(userId, dotCode);

      // Refresh the user list to show updated permissions
      const updatedUsers = await userService.getUsers(true);
      setUsers(updatedUsers.results || []);

      setSnackbar({
        open: true,
        message: "DOT permission removed successfully",
        severity: "success",
      });
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
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={loadData}
            sx={{ mb: 2 }}
          >
            {t("common.refresh")}
          </Button>

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
                {users.map((user) => (
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
                ))}
              </TableBody>
            </Table>
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
