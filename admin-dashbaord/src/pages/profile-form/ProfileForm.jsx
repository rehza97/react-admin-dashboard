import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import { Stack, CircularProgress } from "@mui/material";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import { useAuth } from "../../context/AuthContext";
import { authService, userService } from "../../services/api";

// Constants for roles
const ROLES = {
  ADMIN: "admin",
  USER: "user",
  EDITOR: "editor",
};

// Constants for validation messages
const VALIDATION_MESSAGES = {
  REQUIRED: "This field is required",
  EMAIL_INVALID: "Invalid email address",
  PASSWORD_LENGTH: "Password must be at least 8 characters long",
};

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const ProfileForm = () => {
  const { currentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  // State for new user creation
  const [newUserData, setNewUserData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    role: ROLES.USER,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm();

  // Load user profile data when component mounts
  useEffect(() => {
    const loadUserProfile = async () => {
      if (currentUser) {
        try {
          const userData = await authService.getCurrentUser();
          setValue("firstName", userData.first_name || "");
          setValue("lastName", userData.last_name || "");
          setValue("email", userData.email || "");
          setValue("phone", userData.phone || "");
          setValue("address", userData.address || "");
          setValue("city", userData.city || "");
          setValue("zipcode", userData.zipcode || "");
          setValue("country", userData.country || "");
          setValue(
            "dateOfBirth",
            userData.birthday
              ? new Date(userData.birthday).toISOString().split("T")[0]
              : ""
          );
          setValue("role", userData.role || ROLES.USER);
        } catch (error) {
          console.error("Error loading profile:", error);
          setSnackbarMessage("Failed to load profile data");
          setSnackbarSeverity("error");
          setSnackbarOpen(true);
        } finally {
          setIsLoadingProfile(false);
        }
      } else {
        setIsLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [currentUser, setValue]);

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      // Update user profile
      await authService.updateProfile({
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        zipcode: data.zipcode,
        country: data.country,
        birthday: data.dateOfBirth,
        role: data.role,
        ...(data.password ? { password: data.password } : {}),
      });

      setSnackbarMessage("Profile updated successfully!");
      setSnackbarSeverity("success");
    } catch (error) {
      console.error("Profile update error:", error);
      setSnackbarMessage(
        error.response?.data?.detail ||
          "Failed to update profile. Please try again."
      );
      setSnackbarSeverity("error");
    } finally {
      setIsLoading(false);
      setSnackbarOpen(true);
    }
  };

  const handleNewUserChange = (e) => {
    const { name, value } = e.target;
    setNewUserData({
      ...newUserData,
      [name]: value,
    });
  };

  const validateNewUser = () => {
    const newErrors = {};
    if (!newUserData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(newUserData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!newUserData.password) {
      newErrors.password = "Password is required";
    } else if (newUserData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long";
    }
    if (!newUserData.first_name) {
      newErrors.first_name = "First name is required";
    }
    if (!newUserData.last_name) {
      newErrors.last_name = "Last name is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNewUserSubmit = async (e) => {
    e.preventDefault();
    if (validateNewUser()) {
      setIsLoading(true);
      try {
        await userService.createUser(newUserData);
        setSnackbarMessage("User created successfully!");
        setSnackbarSeverity("success");
        // Reset new user data
        setNewUserData({
          email: "",
          first_name: "",
          last_name: "",
          password: "",
          role: ROLES.USER,
        });
      } catch (error) {
        console.error("Error creating user:", error);
        setSnackbarMessage(
          error.response?.data?.detail ||
            "Failed to create user. Please try again."
        );
        setSnackbarSeverity("error");
      } finally {
        setIsLoading(false);
        setSnackbarOpen(true);
      }
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  if (isLoadingProfile) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div style={{ marginTop: "16px", width: "100%", height: "100vh" }}>
      <h1>Profile Form</h1>

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        noValidate
        autoComplete="off"
      >
        <Stack direction="row" spacing={2}>
          <TextField
            sx={{ flex: 1 }}
            label="First Name"
            variant="outlined"
            {...register("firstName", {
              required: VALIDATION_MESSAGES.REQUIRED,
            })}
            error={!!errors.firstName}
            helperText={errors.firstName ? errors.firstName.message : ""}
          />
          <TextField
            sx={{ flex: 1 }}
            label="Last Name"
            variant="outlined"
            {...register("lastName", {
              required: VALIDATION_MESSAGES.REQUIRED,
            })}
            error={!!errors.lastName}
            helperText={errors.lastName ? errors.lastName.message : ""}
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            sx={{ flex: 1 }}
            label="Email"
            variant="outlined"
            {...register("email", {
              required: VALIDATION_MESSAGES.REQUIRED,
              pattern: {
                value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                message: VALIDATION_MESSAGES.EMAIL_INVALID,
              },
            })}
            error={!!errors.email}
            helperText={errors.email ? errors.email.message : ""}
          />
          <TextField
            sx={{ flex: 1 }}
            label="Phone Number"
            variant="outlined"
            {...register("phone", { required: VALIDATION_MESSAGES.REQUIRED })}
            error={!!errors.phone}
            helperText={errors.phone ? errors.phone.message : ""}
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            sx={{ flex: 1 }}
            label="Address"
            variant="outlined"
            {...register("address", { required: VALIDATION_MESSAGES.REQUIRED })}
            error={!!errors.address}
            helperText={errors.address ? errors.address.message : ""}
          />
          <TextField
            sx={{ flex: 1 }}
            label="City"
            variant="outlined"
            {...register("city", { required: VALIDATION_MESSAGES.REQUIRED })}
            error={!!errors.city}
            helperText={errors.city ? errors.city.message : ""}
          />
          <TextField
            sx={{ flex: 1 }}
            label="Zip Code"
            variant="outlined"
            {...register("zipcode", { required: VALIDATION_MESSAGES.REQUIRED })}
            error={!!errors.zipcode}
            helperText={errors.zipcode ? errors.zipcode.message : ""}
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField
            sx={{ flex: 1 }}
            label="Country"
            variant="outlined"
            {...register("country", { required: VALIDATION_MESSAGES.REQUIRED })}
            error={!!errors.country}
            helperText={errors.country ? errors.country.message : ""}
          />
          <TextField
            sx={{ flex: 1 }}
            label="Date of Birth"
            variant="outlined"
            type="date"
            InputLabelProps={{ shrink: true }}
            {...register("dateOfBirth", {
              required: VALIDATION_MESSAGES.REQUIRED,
            })}
            error={!!errors.dateOfBirth}
            helperText={errors.dateOfBirth ? errors.dateOfBirth.message : ""}
          />
        </Stack>

        <FormControl variant="outlined" sx={{ m: 1, minWidth: 25 }}>
          <InputLabel id="role-label">Role</InputLabel>
          <Select
            labelId="role-label"
            id="role"
            label="Role"
            defaultValue={ROLES.USER}
            {...register("role", { required: VALIDATION_MESSAGES.REQUIRED })}
            error={!!errors.role}
          >
            <MenuItem value={ROLES.ADMIN}>Admin</MenuItem>
            <MenuItem value={ROLES.USER}>User</MenuItem>
            <MenuItem value={ROLES.EDITOR}>Editor</MenuItem>
          </Select>
          {errors.role && <p style={{ color: "red" }}>{errors.role.message}</p>}
        </FormControl>

        <TextField
          sx={{ flex: 1 }}
          label="Password"
          variant="outlined"
          type="password"
          {...register("password", {
            required: VALIDATION_MESSAGES.REQUIRED,
            minLength: {
              value: 8,
              message: VALIDATION_MESSAGES.PASSWORD_LENGTH,
            },
          })}
          error={!!errors.password}
          helperText={errors.password ? errors.password.message : ""}
        />

        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Updating..." : "Update Profile"}
          </Button>
        </Box>

        <Box component="form" onSubmit={handleNewUserSubmit} noValidate>
          <Typography variant="h5" component="h2" gutterBottom>
            Add New User
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Email"
                name="email"
                value={newUserData.email}
                onChange={handleNewUserChange}
                error={!!errors.email}
                helperText={errors.email}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={newUserData.password}
                onChange={handleNewUserChange}
                error={!!errors.password}
                helperText={errors.password}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="First Name"
                name="first_name"
                value={newUserData.first_name}
                onChange={handleNewUserChange}
                error={!!errors.first_name}
                helperText={errors.first_name}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Last Name"
                name="last_name"
                value={newUserData.last_name}
                onChange={handleNewUserChange}
                error={!!errors.last_name}
                helperText={errors.last_name}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="role-label">Role</InputLabel>
                <Select
                  labelId="role-label"
                  id="role"
                  name="role"
                  value={newUserData.role}
                  onChange={handleNewUserChange}
                  label="Role"
                >
                  <MenuItem value={ROLES.USER}>User</MenuItem>
                  <MenuItem value={ROLES.EDITOR}>Editor</MenuItem>
                  <MenuItem value={ROLES.ADMIN}>Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid
              item
              xs={12}
              sx={{ display: "flex", justifyContent: "flex-end" }}
            >
              <Button
                variant="contained"
                color="primary"
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Box>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default ProfileForm;
