import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { userService } from "../../services/api";

// Update roles to match backend expectations
const ROLES = {
  ADMIN: "admin",
  VIEWER: "viewer",
};

const AddUser = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    role: ROLES.VIEWER, // Default to viewer
  });
  const [errors, setErrors] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const validate = () => {
    const newErrors = {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
    };

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else {
      // Match backend password requirements
      if (!/[A-Z]/.test(formData.password)) {
        newErrors.password = "Password must contain uppercase letters";
      } else if (!/[a-z]/.test(formData.password)) {
        newErrors.password = "Password must contain lowercase letters";
      } else if (!/[0-9]/.test(formData.password)) {
        newErrors.password = "Password must contain numbers";
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
        newErrors.password = "Password must contain special characters";
      }
    }

    if (!formData.first_name) {
      newErrors.first_name = "First name is required";
    }

    if (!formData.last_name) {
      newErrors.last_name = "Last name is required";
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some((error) => error !== "");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validate()) {
      setIsLoading(true);
      try {
        // Log the data being sent to help with debugging
        console.log("Sending user data:", formData);

        await userService.createUser(formData);
        setSnackbar({
          open: true,
          message: "User created successfully!",
          severity: "success",
        });

        // Redirect after a short delay
        setTimeout(() => {
          navigate("/manage-users");
        }, 1500);
      } catch (error) {
        console.error("Error creating user:", error);
        // Improve error message display
        let errorMessage = "Failed to create user";
        if (error.response?.data) {
          // Handle different error formats
          if (typeof error.response.data === "string") {
            errorMessage = error.response.data;
          } else if (error.response.data.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.response.data.email) {
            errorMessage = `Email: ${error.response.data.email}`;
          } else if (error.response.data.password) {
            errorMessage = `Password: ${error.response.data.password}`;
          } else if (typeof error.response.data === "object") {
            // Try to extract error messages from the response
            const messages = [];
            Object.entries(error.response.data).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                messages.push(`${key}: ${value.join(", ")}`);
              } else {
                messages.push(`${key}: ${value}`);
              }
            });
            if (messages.length > 0) {
              errorMessage = messages.join("; ");
            }
          }
        }

        setSnackbar({
          open: true,
          message: errorMessage,
          severity: "error",
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          Add New User
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Email"
                name="email"
                value={formData.email}
                onChange={handleChange}
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
                value={formData.password}
                onChange={handleChange}
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
                value={formData.first_name}
                onChange={handleChange}
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
                value={formData.last_name}
                onChange={handleChange}
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
                  value={formData.role}
                  onChange={handleChange}
                  label="Role"
                >
                  <MenuItem value={ROLES.VIEWER}>Viewer</MenuItem>
                  <MenuItem value={ROLES.ADMIN}>Administrator</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid
              item
              xs={12}
              sx={{ display: "flex", justifyContent: "space-between" }}
            >
              <Button
                variant="outlined"
                onClick={() => navigate("/manage-users")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : "Create User"}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>

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
    </Box>
  );
};

export default AddUser;
