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
} from "@mui/material";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/api";
import PageLayout from "../../components/PageLayout";
import { PhotoCamera } from "@mui/icons-material";

const ProfileForm = () => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm();

  useEffect(() => {
    loadUserProfile();
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

  if (isLoadingProfile) {
    return (
      <PageLayout title="Profile">
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Profile Settings"
      subtitle="Manage your account information"
    >
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
              label="First Name"
              {...register("first_name", {
                required: "First name is required",
              })}
              error={!!errors.first_name}
              helperText={errors.first_name?.message}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Last Name"
              {...register("last_name", { required: "Last name is required" })}
              error={!!errors.last_name}
              helperText={errors.last_name?.message}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: "Invalid email address",
                },
              })}
              error={!!errors.email}
              helperText={errors.email?.message}
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
                "Save Changes"
              )}
            </Button>
          </Grid>
        </Grid>
      </form>

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
