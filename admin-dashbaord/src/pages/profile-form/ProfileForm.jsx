import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  CircularProgress,
  Alert,
  Box,
  Avatar,
  Typography,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Tabs,
  Tab,
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { authService, userService } from "../../services/api";
import PageLayout from "../../components/PageLayout";
import { PhotoCamera, Delete, Add } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

// Tab Panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ProfileForm = () => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success", // One of: "error", "warning", "info", "success"
  });
  const [tabValue, setTabValue] = useState(0);
  const [dotPermissions, setDotPermissions] = useState([]);
  const [availableDots, setAvailableDots] = useState([]);
  const [openDotDialog, setOpenDotDialog] = useState(false);
  const [selectedDot, setSelectedDot] = useState("");
  const [loadingDots, setLoadingDots] = useState(false);
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm();

  useEffect(() => {
    loadUserProfile();
    loadDOTData();
  }, [currentUser]);

  const loadUserProfile = async () => {
    if (currentUser) {
      try {
        const userData = await authService.getCurrentUser();
        reset(userData);
      } catch (error) {
        setSnackbar({
          open: true,
          message: "Failed to load profile data",
          severity: "error",
        });
      } finally {
        setIsLoadingProfile(false);
      }
    }
  };

  const loadDOTData = async () => {
    if (currentUser) {
      setLoadingDots(true);
      try {
        // Load user's DOT permissions
        if (currentUser.id) {
          const permissions = await userService.getUserDOTPermissions(
            currentUser.id
          );
          setDotPermissions(permissions);
        }

        // Load all available DOTs
        const dots = await userService.getAllDOTs();
        setAvailableDots(dots);
      } catch (error) {
        console.error("Failed to load DOT data:", error);
      } finally {
        setLoadingDots(false);
      }
    }
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await authService.updateProfile(data);
      setSnackbar({
        open: true,
        message: "Profile updated successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: error.response?.data?.message || "Failed to update profile",
        severity: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleOpenDotDialog = () => {
    setOpenDotDialog(true);
  };

  const handleCloseDotDialog = () => {
    setOpenDotDialog(false);
    setSelectedDot("");
  };

  const handleDotChange = (event) => {
    setSelectedDot(event.target.value);
  };

  const handleAddDot = async () => {
    if (!selectedDot) return;

    try {
      const dotObj = availableDots.find((dot) => dot.code === selectedDot);
      if (!dotObj) return;

      await userService.assignDOTPermission(currentUser.id, {
        dot_code: dotObj.code,
        dot_name: dotObj.name,
      });

      // Refresh DOT permissions
      const permissions = await userService.getUserDOTPermissions(
        currentUser.id
      );
      setDotPermissions(permissions);

      setSnackbar({
        open: true,
        message: `DOT permission for ${dotObj.name} added successfully`,
        severity: "success",
      });

      handleCloseDotDialog();
    } catch (error) {
      setSnackbar({
        open: true,
        message:
          error.response?.data?.message || "Failed to add DOT permission",
        severity: "error",
      });
    }
  };

  const handleRemoveDot = async (dotCode) => {
    try {
      await userService.removeDOTPermission(currentUser.id, dotCode);

      // Refresh DOT permissions
      const permissions = await userService.getUserDOTPermissions(
        currentUser.id
      );
      setDotPermissions(permissions);

      setSnackbar({
        open: true,
        message: "DOT permission removed successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message:
          error.response?.data?.message || "Failed to remove DOT permission",
        severity: "error",
      });
    }
  };

  if (isLoadingProfile) {
    return (
      <PageLayout
        title="Profile"
        subtitle="Loading your profile information"
        headerAction={null}
      >
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t("profile.profileSettings")}
      subtitle="Manage your account information"
      headerAction={null}
    >
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          centered
        >
          <Tab label={t("profile.personalInfo")} />
          <Tab label="DOT Permissions" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            {/* Profile Picture Section */}
            <Grid item xs={12} sx={{ textAlign: "center", mb: 2 }}>
              <Avatar
                src={currentUser?.profile_picture}
                sx={{
                  width: 120,
                  height: 120,
                  margin: "0 auto",
                  mb: 2,
                  border: "4px solid",
                  borderColor: "primary.main",
                }}
              />
              <Button
                variant="outlined"
                component="label"
                startIcon={<PhotoCamera />}
              >
                Upload Photo
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    // Handle photo upload
                  }}
                />
              </Button>
            </Grid>

            {/* Personal Information */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t("profile.firstName")}
                {...register("first_name", {
                  required: "First name is required",
                })}
                error={!!errors.first_name}
                helperText={
                  errors.first_name ? String(errors.first_name.message) : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label={t("profile.lastName")}
                {...register("last_name", {
                  required: "Last name is required",
                })}
                error={!!errors.last_name}
                helperText={
                  errors.last_name ? String(errors.last_name.message) : ""
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t("profile.email")}
                type="email"
                {...register("email", {
                  required: "Email is required",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address",
                  },
                })}
                error={!!errors.email}
                helperText={errors.email ? String(errors.email.message) : ""}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Password"
                type="password"
                {...register("password")}
                helperText="Leave blank to keep current password"
              />
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading}
                sx={{ mt: 2 }}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  t("profile.updateProfile")
                )}
              </Button>
            </Grid>
          </Grid>
        </form>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            DOT Permissions
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Manage your access to different DOTs (Directions Opérationnelles
            Territoriales). These permissions determine which data you can view
            and manage.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={handleOpenDotDialog}
            sx={{ mb: 2 }}
          >
            Add DOT Permission
          </Button>

          {loadingDots ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress />
            </Box>
          ) : dotPermissions.length > 0 ? (
            <List>
              {dotPermissions.map((permission) => (
                <ListItem key={permission.id} divider>
                  <ListItemText
                    primary={permission.dot_name}
                    secondary={`Code: ${permission.dot_code}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleRemoveDot(permission.dot_code)}
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info">
              You don't have any DOT permissions assigned yet.
              {currentUser?.role === "admin"
                ? " As an admin, you have access to all DOTs by default."
                : " Please add permissions to access specific DOTs."}
            </Alert>
          )}
        </Box>
      </TabPanel>

      {/* DOT Dialog */}
      <Dialog open={openDotDialog} onClose={handleCloseDotDialog}>
        <DialogTitle>Add DOT Permission</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="dot-select-label">Select DOT</InputLabel>
            <Select
              labelId="dot-select-label"
              value={selectedDot}
              onChange={handleDotChange}
              label="Select DOT"
            >
              {availableDots.map((dot) => (
                <MenuItem key={dot.code} value={dot.code}>
                  {dot.name} ({dot.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDotDialog}>Cancel</Button>
          <Button
            onClick={handleAddDot}
            color="primary"
            disabled={!selectedDot}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {snackbar.open && (
        <Alert
          severity={snackbar.severity}
          sx={{ mt: 2 }}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      )}
    </PageLayout>
  );
};

export default ProfileForm;
