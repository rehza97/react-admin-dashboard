import { useState, useEffect } from "react";
import { Route, Routes, Navigate, useLocation, Outlet } from "react-router-dom";
import { styled, ThemeProvider, createTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import CssBaseline from "@mui/material/CssBaseline";
import TopBar from "./components/TopBar";
import Drawer from "./components/Drawer";
import Dashboard from "./pages/dashboard/Dashboard";
import ManageUsers from "./pages/users/ManageUsers";
import ContactsInformation from "./pages/contacts-information/ContactsInformation";
import InvoiceBalance from "./pages/invoice-balance/InvoiceBalance";
import ProfileForm from "./pages/profile-form/ProfileForm";
import Calendar from "./pages/calendar/Calendar";
import FAQ from "./pages/faq/FAQ";
import BarChart from "./pages/bar-chart/BarChart";
import PieChart from "./pages/pie-chart/PieChart";
import LineChart from "./pages/line-chart/LineChart";
import UserDetails from "./pages/users/UserDetails";
import AddUser from "./pages/users/AddUser";
import NotFound from "./pages/NotFound";
import PivotTable from "./pages/pivot-table/PivotTable";
import Login from "./pages/auth/Login";
import ResetPassword from "./pages/auth/ResetPassword";
import SetNewPassword from "./pages/auth/SetNewPassword";
import { AuthProvider, useAuth } from "./context/AuthContext";
import FileUpload from "./pages/file-upload/FileUpload";
import FileProcessingView from "./pages/file-upload/FileProcessingView";
import UserDOTPermissions from "./pages/user-management/UserDOTPermissions";
import AnomalyScanPage from "./pages/anomaly-scan/AnomalyScanPage";
import ReportPage from "./pages/reports/ReportPage";
import DOTManagement from "./pages/dot-management/DOTManagement";
// Import KPI pages
import {
  RevenuePage,
  CollectionPage,
  ReceivablesPage,
  CorporateParkPage,
  UnfinishedInvoicePage,
} from "./pages/kpi";
import PropTypes from "prop-types";
import CircularProgress from "@mui/material/CircularProgress";
import DataManagementPage from "./pages/DataManagementPage";
import DataValidationPage from "./pages/DataValidationPage";
import DataCleanupTool from "./components/DataCleanupTool";

// Define drawer width for consistency
const drawerWidth = 40;

// Drawer header component
const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

// Protected Route component to handle authentication
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Show nothing while checking authentication
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

// Layout component for authenticated pages
const DashboardLayout = ({ isDarkMode, toggleTheme }) => {
  const [open, setOpen] = useState(true);

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  return (
    <>
      <TopBar
        open={open}
        handleDrawerOpen={handleDrawerOpen}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
      />
      <Drawer open={open} handleDrawerClose={handleDrawerClose} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 0,
          width: "100%",
          minHeight: "100vh",
          marginLeft: open ? `${drawerWidth}px` : 0,
          transition: (theme) =>
            theme.transitions.create("margin", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
        }}
      >
        <DrawerHeader />
        <Outlet />
      </Box>
    </>
  );
};

DashboardLayout.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
  toggleTheme: PropTypes.func.isRequired,
};

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check local storage for theme preference
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme === "dark";
    }
    // Check system preference
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  // Update theme when system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      // Only update if no user preference is saved
      if (!localStorage.getItem("theme")) {
        setIsDarkMode(e.matches);
      }
    };

    // Add event listener
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const newTheme = !prev;
      localStorage.setItem("theme", newTheme ? "dark" : "light"); // Save to local storage
      return newTheme;
    });
  };

  // Create theme based on dark mode state
  const appliedTheme = createTheme({
    palette: {
      mode: isDarkMode ? "dark" : "light",
    },
    // Pass drawer width to theme to make it available throughout the app
    components: {
      MuiDrawer: {
        styleOverrides: {
          paper: {
            width: drawerWidth,
          },
        },
      },
    },
  });

  return (
    <AuthProvider>
      <ThemeProvider theme={appliedTheme}>
        <CssBaseline />
        <Box sx={{ display: "flex" }}>
          <Routes>
            {/* Auth routes - outside the dashboard layout */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/set-new-password/:token"
              element={<SetNewPassword />}
            />

            {/* Protected routes - inside the dashboard layout */}
            <Route
              element={
                <DashboardLayout
                  isDarkMode={isDarkMode}
                  toggleTheme={toggleTheme}
                />
              }
            >
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-users"
                element={
                  <ProtectedRoute>
                    <ManageUsers />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-users/details"
                element={
                  <ProtectedRoute>
                    <UserDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-users/add"
                element={
                  <ProtectedRoute>
                    <AddUser />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contacts-information"
                element={
                  <ProtectedRoute>
                    <ContactsInformation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invoices"
                element={
                  <ProtectedRoute>
                    <InvoiceBalance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/form"
                element={
                  <ProtectedRoute>
                    <ProfileForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <Calendar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/faq"
                element={
                  <ProtectedRoute>
                    <FAQ />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bar"
                element={
                  <ProtectedRoute>
                    <BarChart />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pie"
                element={
                  <ProtectedRoute>
                    <PieChart />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/line"
                element={
                  <ProtectedRoute>
                    <LineChart />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pivot-table"
                element={
                  <ProtectedRoute>
                    <PivotTable />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-users/edit/:id"
                element={
                  <ProtectedRoute>
                    <UserDetails />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/file-upload"
                element={
                  <ProtectedRoute>
                    <FileUpload />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/file-upload/process/:fileId"
                element={
                  <ProtectedRoute>
                    <FileProcessingView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user-management/dot-permissions"
                element={
                  <ProtectedRoute>
                    <UserDOTPermissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/anomaly-scan"
                element={
                  <ProtectedRoute>
                    <AnomalyScanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <ReportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user-dot-permissions"
                element={
                  <ProtectedRoute>
                    <UserDOTPermissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dot-management"
                element={
                  <ProtectedRoute>
                    <DOTManagement />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kpi/revenue"
                element={
                  <ProtectedRoute>
                    <RevenuePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kpi/collections"
                element={
                  <ProtectedRoute>
                    <CollectionPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kpi/receivables"
                element={
                  <ProtectedRoute>
                    <ReceivablesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kpi/corporate-park"
                element={
                  <ProtectedRoute>
                    <CorporateParkPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kpi/unfinished-invoices"
                element={
                  <ProtectedRoute>
                    <UnfinishedInvoicePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/data-management"
                element={
                  <ProtectedRoute>
                    <DataManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/data-validation"
                element={
                  <ProtectedRoute>
                    <DataValidationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/data-cleanup"
                element={
                  <ProtectedRoute>
                    <DataCleanupTool />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Box>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
