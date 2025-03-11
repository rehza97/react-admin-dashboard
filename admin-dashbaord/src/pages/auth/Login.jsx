import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Divider,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
  Link,
  useTheme,
  Container,
} from "@mui/material";
import { Visibility, VisibilityOff, Email, Lock } from "@mui/icons-material";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import GoogleIcon from "@mui/icons-material/Google";
import FacebookIcon from "@mui/icons-material/Facebook";
import TwitterIcon from "@mui/icons-material/Twitter";
import { authService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [generalError, setGeneralError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentUser } = useAuth();

  const handleClickShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData({
      ...formData,
      [name]: name === "rememberMe" ? checked : value,
    });

    // Clear error when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: "",
      });
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError("");

    if (validate()) {
      try {
        const response = await authService.login({
          email: formData.email,
          password: formData.password,
        });

        // Get token and user from the response
        const token = response.token || response.data?.token;
        const userData = response.user || response.data?.user;

        if (!token) {
          throw new Error("No token received from the server");
        }

        // Store token and authentication status
        localStorage.setItem("token", token);
        localStorage.setItem("isAuthenticated", "true");

        // Also cache the user data for offline use
        localStorage.setItem("cachedUser", JSON.stringify(userData));

        // Update currentUser in AuthContext
        setCurrentUser(userData);

        // Add console logs to debug
        console.log("Login successful, redirecting...");
        console.log("Redirect path:", location.state?.from?.pathname || "/");

        // Force navigation to dashboard with a slight delay to ensure state is updated
        setTimeout(() => {
          // Redirect to the intended page or dashboard
          const from = location.state?.from?.pathname || "/";
          navigate(from, { replace: true });

          // As a fallback, also try direct window location change if navigate doesn't work
          if (from === "/") {
            window.location.href = "/";
          }
        }, 100);
      } catch (error) {
        console.error("Login error:", error);
        setGeneralError(
          error.response?.data?.error ||
            error.message ||
            "Invalid credentials. Please try again."
        );
      }
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
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              fontWeight="bold"
              sx={{ fontSize: { xs: "1.75rem", sm: "2.125rem" } }}
            >
              Welcome Back
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Enter your credentials to access your account
            </Typography>
          </Box>

          {generalError && (
            <Typography color="error" variant="body2" align="center">
              {generalError}
            </Typography>
          )}

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
              value={formData.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? "text" : "password"}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              error={!!errors.password}
              helperText={errors.password}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleClickShowPassword}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: { xs: "wrap", sm: "nowrap" },
                mt: 1,
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    color="primary"
                    size="small"
                  />
                }
                label={<Typography variant="body2">Remember me</Typography>}
              />
              <Link
                component={RouterLink}
                to="/reset-password"
                variant="body2"
                sx={{ textDecoration: "none", ml: { xs: 0, sm: 1 } }}
              >
                Forgot password?
              </Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.2 }}
            >
              Sign In
            </Button>

          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
