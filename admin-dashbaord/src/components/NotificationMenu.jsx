import React from "react";
import {
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Chip,
  Button,
  ListItemIcon,
  IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneAllIcon from "@mui/icons-material/DoneAll";

// Get notification icon based on type
const getNotificationIcon = (type) => {
  switch (type) {
    case "success":
      return <CheckCircleIcon color="success" />;
    case "error":
      return <ErrorIcon color="error" />;
    case "warning":
      return <WarningIcon color="warning" />;
    case "info":
    default:
      return <InfoIcon color="info" />;
  }
};

// Format timestamp to relative time
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "Just now";

  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffMs = now.getTime() - notificationTime.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
};

const NotificationItem = ({ notification, onRemove, onClick }) => {
  // Get border color for notification type
  const getBorderColor = (type) => {
    switch (type) {
      case "success":
        return "success.main";
      case "error":
        return "error.main";
      case "warning":
        return "warning.main";
      case "info":
      default:
        return "info.main";
    }
  };

  return (
    <MenuItem
      onClick={() => onClick(notification)}
      sx={{
        display: "flex",
        padding: 1.5,
        borderLeft: 4,
        borderLeftColor: getBorderColor(notification.type),
        borderStyle: "solid none solid solid",
        transition: "background-color 0.2s",
        "&:hover": {
          backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
        },
        marginBottom: 0.5,
        borderRadius: 1,
      }}
    >
      <ListItemIcon>{getNotificationIcon(notification.type)}</ListItemIcon>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {notification.title ||
            (notification.type &&
              `${
                notification.type.charAt(0).toUpperCase() +
                notification.type.slice(1)
              } Notification`) ||
            "Notification"}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {notification.message}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatTimestamp(notification.timestamp)}
        </Typography>
      </Box>
      <IconButton
        edge="end"
        aria-label="delete"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(notification.id);
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </MenuItem>
  );
};

const NotificationMenu = ({
  anchorEl,
  open,
  onClose,
  notifications,
  onRemoveNotification,
  onClearAll,
  onItemClick,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleNotificationClick = (notification) => {
    if (typeof onItemClick === "function") {
      onItemClick(notification);
    }

    // Default navigation behavior if a link is provided
    if (notification.link) {
      navigate(notification.link);
    }

    // Remove notification after clicking
    onRemoveNotification(notification.id);
  };

  return (
    <Menu
      id="notification-menu"
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{
        elevation: 3,
        sx: {
          overflow: "visible",
          filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.1))",
          mt: 1.5,
          maxWidth: 360,
          maxHeight: 480,
          "& .MuiAvatar-root": {
            width: 32,
            height: 32,
            ml: -0.5,
            mr: 1,
          },
          "&::before": {
            content: '""',
            display: "block",
            position: "absolute",
            top: 0,
            right: 20,
            width: 10,
            height: 10,
            bgcolor: "background.paper",
            transform: "translateY(-50%) rotate(45deg)",
            zIndex: 0,
          },
        },
      }}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
    >
      <Box
        sx={{
          p: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h6" color="text.primary" fontWeight="bold">
          {t("common.notifications")}
        </Typography>
        {notifications.length > 0 && (
          <Chip
            size="small"
            label={notifications.length}
            color="primary"
            sx={{ fontWeight: "bold" }}
          />
        )}
      </Box>

      <Divider />

      {notifications.length > 0 ? (
        <>
          <Box sx={{ maxHeight: 320, overflow: "auto" }}>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onClick={handleNotificationClick}
                onRemove={onRemoveNotification}
              />
            ))}
          </Box>
          <Divider />
          <Box sx={{ p: 1.5, display: "flex", justifyContent: "center" }}>
            <Button
              size="small"
              startIcon={<DoneAllIcon />}
              onClick={() => {
                onClearAll();
                onClose();
              }}
            >
              {t("common.clearAll")}
            </Button>
          </Box>
        </>
      ) : (
        <Box
          sx={{
            py: 4,
            px: 2,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <NotificationsOffIcon
            sx={{ fontSize: 48, color: "text.disabled", mb: 2 }}
          />
          <Typography color="text.secondary" align="center">
            {t("notifications.noNotifications")}
          </Typography>
        </Box>
      )}
    </Menu>
  );
};

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
    timestamp: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    link: PropTypes.string,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
  onClick: PropTypes.func.isRequired,
};

NotificationMenu.propTypes = {
  anchorEl: PropTypes.object,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  notifications: PropTypes.array.isRequired,
  onRemoveNotification: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
  onItemClick: PropTypes.func,
};

export default NotificationMenu;
