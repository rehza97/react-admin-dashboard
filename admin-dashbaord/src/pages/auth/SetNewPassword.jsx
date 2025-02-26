import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  InputAdornment,
  IconButton,
  useTheme,
  Alert,
  LinearProgress,
  Container,
} from "@mui/material";
import { Visibility, VisibilityOff, Lock } from "@mui/icons-material";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { authService } from "../../services/api";

const SetNewPassword = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useParams(); // Get token from URL params
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handleClickShowPassword = (field) => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    
    return strength;
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 50) return theme.palette.error.main;
    if (passwordStrength < 75) return theme.palette.warning.main;
    return theme.palette.success.main;
  };

  const getPasswordStrengthLabel = () => {
    if (passwordStrength < 50) return "Weak";
    if (passwordStrength < 75) return "Medium";
    return "Strong";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
    
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
    
    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (validate()) {
      setIsLoading(true);
      try {
        // Call the password reset confirmation API
        await authService.confirmPasswordReset({
          token: token,
          password: formData.password
        });
        
        setSubmitted(true);
        
        // After successful reset, redirect to login page after a delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (error) {
        console.error("Password reset error:", error);
        setErrors({
          ...errors,
          general: error.response?.data?.detail || 
            "Failed to reset password. The token may be invalid or expired."
        });
      } finally {
        setIsLoading(false);
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
              Set New Password
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Create a new password for your account
            </Typography>
          </Box>

          {submitted ? (
            <Box sx={{ mt: 2, mb: 2 }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                Your password has been successfully reset!
              </Alert>
              <Typography variant="body2" paragraph sx={{ mb: 3 }}>
                You will be redirected to the login page in a few seconds...
              </Typography>
              <LinearProgress 
                sx={{ 
                  mt: 2, 
                  height: 6,
                  borderRadius: 3
                }} 
              />
            </Box>
          ) : (
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="New Password"
                type={showPassword ? "text" : "password"}
                id="password"
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
                        onClick={() => handleClickShowPassword('password')}
                        edge="end"
                        size="medium"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 1 }}
              />
              
              {formData.password && (
                <Box sx={{ mt: 1, mb: 2 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    mb: 0.5 
                  }}>
                    <Typography variant="caption">Password Strength:</Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        color: getPasswordStrengthColor(),
                        fontWeight: 'medium'
                      }}
                    >
                      {getPasswordStrengthLabel()}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={passwordStrength}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.palette.grey[200],
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getPasswordStrengthColor(),
                        borderRadius: 3,
                        transition: 'transform 0.4s ease'
                      },
                    }}
                  />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      display: 'block', 
                      mt: 1, 
                      color: 'text.secondary',
                      fontSize: '0.75rem'
                    }}
                  >
                    Use 8+ characters with a mix of letters, numbers & symbols
                  </Typography>
                </Box>
              )}
              
              <TextField
                margin="normal"
                required
                fullWidth
                name="confirmPassword"
                label="Confirm Password"
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={() => handleClickShowPassword('confirmPassword')}
                        edge="end"
                        size="medium"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
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
                Reset Password
              </Button>
            </Box>
          )}
          {errors.general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.general}
            </Alert>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default SetNewPassword;