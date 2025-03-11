import {
  IconButton,
  Toolbar,
  Stack,
  Badge,
  AppBar,
  Tooltip,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import PropTypes from "prop-types";
import InputBase from "@mui/material/InputBase";
import SearchIcon from "@mui/icons-material/Search";
import { alpha, styled } from "@mui/material/styles";
import { useState } from "react";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountCircle from "@mui/icons-material/AccountCircle";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useNavigate } from "react-router-dom";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import { useNotification } from "../context/NotificationContext";
import NotificationMenu from "./NotificationMenu";

const drawerWidth = 240;

const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  "&:hover": {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(3),
    width: "auto",
  },
}));

const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("md")]: {
      width: "20ch",
    },
  },
}));

const NotificationBadge = styled(Badge)(({ theme }) => ({
  "& .MuiBadge-badge": {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    fontWeight: "bold",
    boxShadow: `0 0 0 2px ${theme.palette.background.paper}`,
    "&::after": {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      border: "1px solid currentColor",
      content: '""',
    },
  },
}));

export default function TopBar({
  open,
  handleDrawerOpen,
  toggleTheme,
  isDarkMode,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [searchValue, setSearchValue] = useState("");
  const { notifications, removeNotification, clearNotifications } =
    useNotification();

  // State for notification menu
  const [anchorEl, setAnchorEl] = useState(null);
  const openNotifications = Boolean(anchorEl);

  const handleNotificationsOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleNotificationsClose = () => {
    setAnchorEl(null);
  };

  const handleSearchChange = (event) => {
    setSearchValue(event.target.value);
    // Handle search functionality
    console.log("Search:", event.target.value);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleKeyDown = (event, action) => {
    if (event.key === "Enter" || event.key === " ") {
      action();
    }
  };

  const handleNotificationClick = (notification) => {
    // Handle notification click based on type or action
    console.log("Clicked notification:", notification);

    // Additional custom handling can be done here
    // This will be passed to the NotificationMenu component
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        backgroundColor: (theme) =>
          theme.palette.mode === "dark"
            ? theme.palette.background.paper
            : theme.palette.primary.main,
        color: (theme) =>
          theme.palette.mode === "dark"
            ? theme.palette.text.primary
            : theme.palette.primary.contrastText,
        zIndex: (theme) => theme.zIndex.drawer + 1,
        transition: (theme) =>
          theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        ...(open && {
          marginLeft: drawerWidth,
          width: `calc(100% - ${drawerWidth}px)`,
          transition: (theme) =>
            theme.transitions.create(["width", "margin"], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        }),
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={handleDrawerOpen}
          edge="start"
          sx={{
            marginRight: 5,
            ...(open && { display: "none" }),
          }}
        >
          <MenuIcon />
        </IconButton>
        <Search>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder={t("common.search")}
            inputProps={{
              "aria-label": "search",
              role: "search",
            }}
            value={searchValue}
            onChange={handleSearchChange}
          />
        </Search>
        <Stack
          direction="row"
          spacing={1}
          sx={{ marginLeft: "auto" }}
          aria-label="User actions"
        >
          <LanguageSwitcher />
          <IconButton
            color="inherit"
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            onKeyDown={(e) => handleKeyDown(e, toggleTheme)}
          >
            {isDarkMode ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>

          {/* Notification Button with Badge */}
          <Tooltip title={t("common.notifications")}>
            <IconButton
              color="inherit"
              aria-label={t("common.notifications")}
              aria-controls={
                openNotifications ? "notification-menu" : undefined
              }
              aria-haspopup="true"
              aria-expanded={openNotifications ? "true" : undefined}
              onClick={handleNotificationsOpen}
            >
              <NotificationBadge
                badgeContent={notifications.length}
                color="error"
              >
                {notifications.length > 0 ? (
                  <NotificationsActiveIcon />
                ) : (
                  <NotificationsIcon />
                )}
              </NotificationBadge>
            </IconButton>
          </Tooltip>

          {/* Notification Menu Component */}
          <NotificationMenu
            anchorEl={anchorEl}
            open={openNotifications}
            onClose={handleNotificationsClose}
            notifications={notifications}
            onRemoveNotification={removeNotification}
            onClearAll={clearNotifications}
            onItemClick={handleNotificationClick}
          />

          <IconButton
            color="inherit"
            aria-label={t("common.settings")}
            aria-haspopup="true"
          >
            <SettingsIcon />
          </IconButton>
          <IconButton
            color="inherit"
            aria-label={t("common.profile")}
            aria-haspopup="true"
            onClick={() => navigate("/profile")}
            onKeyDown={(e) => handleKeyDown(e, () => navigate("/profile"))}
          >
            <AccountCircle />
          </IconButton>
          <IconButton
            color="inherit"
            aria-label={t("common.logout")}
            onClick={handleLogout}
            onKeyDown={(e) => handleKeyDown(e, handleLogout)}
          >
            <LogoutIcon />
          </IconButton>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}

TopBar.propTypes = {
  open: PropTypes.bool.isRequired,
  handleDrawerOpen: PropTypes.func.isRequired,
  toggleTheme: PropTypes.func.isRequired,
  isDarkMode: PropTypes.bool.isRequired,
};
