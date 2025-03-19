import { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
  Link,
  Container,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  useMediaQuery,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Email,
  Lock,
  LightMode,
  DarkMode,
} from "@mui/icons-material";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import { authService } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";

const Login = () => {
  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language);
  const [showPassword, setShowPassword] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem("theme") === "dark" ||
      (localStorage.getItem("theme") === null && prefersDarkMode)
  );
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

  // Color palette based on Algérie Télécom branding
  const colors = {
    primary: "#1976d2", // Primary blue color
    primaryDark: "#115293", // Darker blue for hover states
    primaryLight: "#4791db", // Lighter blue for background
    inputBg: "#1976d2", // Blue background for inputs
    inputText: "white", // Text color for inputs
    labelLight: "rgba(255, 255, 255, 0.9)", // Label color for inputs in light mode
    labelDark: "rgba(255, 255, 255, 0.9)", // Label color for inputs in dark mode
    darkBg: "#121212", // Dark mode background
    lightBg: "#f5f5f5", // Light mode background
  };

  useEffect(() => {
    // Apply theme to body
    document.body.style.backgroundColor = isDarkMode
      ? colors.darkBg
      : colors.lightBg;
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode, colors.darkBg, colors.lightBg]);

  const handleThemeChange = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleLanguageChange = (event, newLanguage) => {
    if (newLanguage !== null) {
      setLanguage(newLanguage);
      i18n.changeLanguage(newLanguage);
    }
  };

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
      newErrors.email = t("login.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t("login.emailInvalid");
    }
    if (!formData.password) {
      newErrors.password = t("login.passwordRequired");
    } else if (formData.password.length < 6) {
      newErrors.password = t("login.passwordLength");
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
        localStorage.setItem("language", language);
        localStorage.setItem("theme", isDarkMode ? "dark" : "light");

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
            t("login.invalidCredentials")
        );
      }
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          py: 4,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 1000,
            display: "flex",
            gap: 1,
          }}
        >
          <IconButton
            onClick={handleThemeChange}
            sx={{
              color: isDarkMode
                ? "rgba(255, 255, 255, 0.8)"
                : "rgba(0, 0, 0, 0.8)",
              bgcolor: isDarkMode
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
              "&:hover": {
                bgcolor: isDarkMode
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(0, 0, 0, 0.15)",
              },
            }}
          >
            {isDarkMode ? <LightMode /> : <DarkMode />}
          </IconButton>

          <ToggleButtonGroup
            value={language}
            exclusive
            onChange={handleLanguageChange}
            aria-label="language selection"
            size="small"
            sx={{
              backgroundColor: isDarkMode
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
              "& .MuiToggleButton-root": {
                color: isDarkMode
                  ? "rgba(255, 255, 255, 0.8)"
                  : "rgba(0, 0, 0, 0.8)",
                "&.Mui-selected": {
                  color: isDarkMode ? "#fff" : "#000",
                  backgroundColor: isDarkMode
                    ? "rgba(255, 255, 255, 0.15)"
                    : "rgba(0, 0, 0, 0.15)",
                },
              },
            }}
          >
            <ToggleButton value="en" aria-label="English">
              EN
            </ToggleButton>
            <ToggleButton value="fr" aria-label="French">
              FR
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Paper
          elevation={3}
          sx={{
            p: { xs: 3, sm: 4 },
            width: "100%",
            maxWidth: 500,
            mx: "auto",
            borderRadius: 2,
            boxShadow: isDarkMode
              ? "0 8px 24px rgba(0, 0, 0, 0.4)"
              : "0 8px 24px rgba(0, 0, 0, 0.15)",
            background: isDarkMode
              ? "linear-gradient(to bottom, #1e1e1e, #121212)"
              : "#fff",
            color: isDarkMode ? "#fff" : "inherit",
          }}
        >
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
              <img
                src="/LOGO.png"
                alt="ALGERIE TELECOM"
                style={{ height: "90px", maxWidth: "100%" }}
              />
            </Box>

            <Typography
              variant="h5"
              component="h1"
              fontWeight="bold"
              gutterBottom
              sx={{
                fontSize: { xs: "1.5rem", sm: "1.75rem" },
                color: isDarkMode ? "#90caf9" : colors.primary,
              }}
            >
              Algérie Télécom
            </Typography>

            <Typography
              variant="subtitle1"
              fontWeight="medium"
              color={
                isDarkMode ? "rgba(144, 202, 249, 0.9)" : colors.primaryLight
              }
              gutterBottom
              sx={{ fontSize: { xs: "1rem", sm: "1.1rem" }, mb: 1 }}
            >
              {t("app.subtitle")}
            </Typography>

            <Divider
              sx={{
                my: 2,
                borderColor: isDarkMode
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(0, 0, 0, 0.15)",
              }}
            />
          </Box>

          {generalError && (
            <Typography
              color="error"
              variant="body2"
              align="center"
              sx={{ mb: 2, fontWeight: 500 }}
            >
              {generalError}
            </Typography>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{ mt: 2 }}
          >
            <Box sx={{ mb: 3, position: "relative" }}>
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: -8,
                  left: 16,
                  color: colors.primary,
                  fontWeight: "500",
                  fontSize: "0.75rem",
                  zIndex: 1,
                  backgroundColor: isDarkMode ? colors.darkBg : "#fff",
                  px: 0.5,
                }}
              >
                {t("login.emailAddress")}
              </Typography>
              <TextField
                fullWidth
                id="email"
                name="email"
                placeholder={t("login.emailAddress")}
                autoComplete="email"
                autoFocus
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email sx={{ color: colors.inputText }} />
                    </InputAdornment>
                  ),
                  sx: {
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    borderRadius: 1,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "transparent",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "transparent",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "transparent",
                    },
                  },
                }}
                InputLabelProps={{
                  sx: {
                    color: colors.labelLight,
                    "&.Mui-focused": {
                      color: colors.labelLight,
                    },
                  },
                }}
                sx={{
                  "& .MuiFormHelperText-root": {
                    color: (theme) => theme.palette.error.main,
                    mt: 1,
                    ml: 0,
                  },
                }}
              />
            </Box>

            <Box sx={{ mb: 1, position: "relative" }}>
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: -8,
                  left: 16,
                  color: colors.primary,
                  fontWeight: "500",
                  fontSize: "0.75rem",
                  zIndex: 1,
                  backgroundColor: isDarkMode ? colors.darkBg : "#fff",
                  px: 0.5,
                }}
              >
                {t("login.password")}
              </Typography>
              <TextField
                fullWidth
                name="password"
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder={t("login.password")}
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: colors.inputText }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={handleClickShowPassword}
                        edge="end"
                        sx={{ color: colors.inputText }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  sx: {
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                    borderRadius: 1,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "transparent",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "transparent",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "transparent",
                    },
                  },
                }}
                InputLabelProps={{
                  sx: {
                    color: colors.labelLight,
                    "&.Mui-focused": {
                      color: colors.labelLight,
                    },
                  },
                }}
                sx={{
                  "& .MuiFormHelperText-root": {
                    color: (theme) => theme.palette.error.main,
                    mt: 1,
                    ml: 0,
                  },
                }}
              />
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                mt: 2,
                mb: 3,
              }}
            >
              <Link
                component={RouterLink}
                to="/reset-password"
                variant="body2"
                sx={{
                  textDecoration: "none",
                  color: isDarkMode ? "#90caf9" : colors.primary,
                  fontWeight: 500,
                  "&:hover": {
                    textDecoration: "underline",
                  },
                }}
              >
                {t("login.forgotPassword")}
              </Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                py: 1.5,
                backgroundColor: colors.primary,
                color: "#fff",
                boxShadow: "0 4px 12px rgba(25, 118, 210, 0.25)",
                "&:hover": {
                  backgroundColor: colors.primaryDark,
                  boxShadow: "0 6px 14px rgba(25, 118, 210, 0.35)",
                },
                transition: "all 0.3s ease",
                borderRadius: 1,
                fontSize: "1rem",
                fontWeight: "500",
                textTransform: "uppercase",
              }}
            >
              {language === "fr" ? "SE CONNECTER" : t("login.signIn")}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login;
