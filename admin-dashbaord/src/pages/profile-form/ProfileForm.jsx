import React, { useState } from "react";
import { useForm } from "react-hook-form";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import { Stack } from "@mui/material";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

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
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  const onSubmit = (data) => {
    console.log(data);
    // Handle form submission, e.g., send data to an API
    setSnackbarMessage("Profile submitted successfully!");
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <div style={{ marginTop: "16px", width: "100%", height: "100vh" }}>
      <h1>Profile Form Page</h1>

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
            {...register("firstName", { required: VALIDATION_MESSAGES.REQUIRED })}
            error={!!errors.firstName}
            helperText={errors.firstName ? errors.firstName.message : ""}
          />
          <TextField
            sx={{ flex: 1 }}
            label="Last Name"
            variant="outlined"
            {...register("lastName", { required: VALIDATION_MESSAGES.REQUIRED })}
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
          <Button variant="contained" color="primary" type="submit">
            Submit
          </Button>
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
