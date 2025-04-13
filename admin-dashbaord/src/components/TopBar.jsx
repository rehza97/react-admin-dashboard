import { IconButton, Toolbar, Stack, AppBar } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import PropTypes from "prop-types";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationMenu from "./NotificationMenu";
import DownloadHistory from "./DownloadHistory";

const drawerWidth = 240;

export default function TopBar({
  open,
  handleDrawerOpen,
  toggleTheme,
  isDarkMode,
}) {
  const { t } = useTranslation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const handleKeyDown = (event, action) => {
    if (event.key === "Enter" || event.key === " ") {
      action();
    }
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

          {/* Download History */}
          <DownloadHistory />

          {/* Notification Menu */}
          <NotificationMenu />

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
