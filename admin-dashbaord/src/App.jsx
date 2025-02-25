import { useState, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import {
  styled,
  useTheme,
  ThemeProvider,
  createTheme,
} from "@mui/material/styles";
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

// Drawer header component
const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

// Define drawer width for consistency
const drawerWidth = 240;

function App() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
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

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const newTheme = !prev;
      localStorage.setItem("theme", newTheme ? "dark" : "light"); // Save to local storage
      return newTheme;
    });
  };

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
    <ThemeProvider theme={appliedTheme}>
      <Box sx={{ display: "flex" }}>
        <CssBaseline />
        <TopBar
          open={open}
          setOpen={setOpen}
          toggleTheme={toggleTheme}
          isDarkMode={isDarkMode}
        />
        <Drawer
          open={open}
          handleDrawerClose={handleDrawerClose}
          theme={theme}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            pt: { xs: 8, sm: 9 }, // Responsive top padding
            width: {
              xs: "100%",
              sm: `calc(100% - ${open ? drawerWidth : 0}px)`,
            },
            transition: theme.transitions.create(["width", "margin"], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            minHeight: "100vh", // Use min-height instead of fixed height
            display: "flex",
            flexDirection: "column",
          }}
        >
          <DrawerHeader /> {/* Spacer for fixed header */}
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/manage-users" element={<ManageUsers />}>
              <Route path="details" element={<UserDetails />} />
              <Route path="add" element={<AddUser />} />
            </Route>
            <Route
              path="/contacts-information"
              element={<ContactsInformation />}
            />
            <Route path="/invoices" element={<InvoiceBalance />} />
            <Route path="/form" element={<ProfileForm />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/bar" element={<BarChart />} />
            <Route path="/pie" element={<PieChart />} />
            <Route path="/line" element={<LineChart />} />
            <Route path="/pivot-table" element={<PivotTable />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
