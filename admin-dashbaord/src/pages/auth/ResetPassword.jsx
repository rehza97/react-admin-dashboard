import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  Link,
  useTheme,
  Alert,
  Container,
} from "@mui/material";
import { Email } from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const ResetPassword = () => {
  const theme = useTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setEmail(e.target.value);
    setError("");
  };

  const validate = () => {
    if (!email) {
      setError("Email is required");
      return false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Email is invalid");
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validate()) {
      // Submit form - replace with your password reset logic
      console.log("Reset password for:", email);
      setSubmitted(true);
      // In a real app, you would send a request to your backend here
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            width: "100%",
            borderRadius: 2,
          }}
        >
          <Link
            component={RouterLink}
            to="/login"
            sx={{
              display: "flex",
              alignItems: "center",
              textDecoration: "none",
              mb: 3,
              color: "text.primary",
              fontSize: "0.875rem",
            }}
          >
            <ArrowBackIcon fontSize="small" sx={{ mr: 0.5 }} />
            Back to login
          </Link>

          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography 
              variant="h4" 
              component="h1" 
              gutterBottom 
              fontWeight="bold"
              sx={{ fontSize: { xs: "1.75rem", sm: "2.125rem" } }}
            >
              Reset Password
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Enter your email address and we'll send you a link to reset your password
            </Typography>
          </Box>

          {submitted ? (
            <Box sx={{ mt: 2, mb: 2 }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                Password reset link has been sent to your email address.
              </Alert>
              <Typography variant="body2" paragraph sx={{ mb: 3 }}>
                Please check your inbox and follow the instructions to reset your password.
                If you don't receive an email within a few minutes, check your spam folder.
              </Typography>
              <Button
                component={RouterLink}
                to="/login"
                fullWidth
                variant="contained"
                sx={{ mt: 2, py: 1.2 }}
              >
                Return to Login
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={handleChange}
                error={!!error}
                helperText={error}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email color="action" />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2, py: 1.2 }}
              >
                Send Reset Link
              </Button>
            </Box>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default ResetPassword;