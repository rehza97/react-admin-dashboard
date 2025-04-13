import { useState } from "react";
import {
  Menu,
  MenuItem,
  Typography,
  Box,
  Chip,
  Button,
  ListItemIcon,
  IconButton,
  LinearProgress,
  Badge,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import DeleteIcon from "@mui/icons-material/Delete";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CloudDownload from "@mui/icons-material/CloudDownload";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CancelIcon from "@mui/icons-material/Cancel";
import { formatRemainingTime } from "../services/exportService";
import { useNotification } from "../context/NotificationContext";

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
const formatTimestamp = (timestamp, t) => {
  if (!timestamp) return t("common.justNow");

  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffMs = now.getTime() - notificationTime.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMin < 1) return t("common.justNow");
  if (diffMin < 60) return `${diffMin}${t("common.minutesAgo")}`;
  if (diffHours < 24) return `${diffHours}${t("common.hoursAgo")}`;
  if (diffDays === 1) return t("common.yesterday");
  return `${diffDays}${t("common.daysAgo")}`;
};

const NotificationItem = ({ notification, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

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

  const handleClick = () => {
    setExpanded((prev) => !prev);

    if (notification.action) {
      notification.action();
    }
  };

  const handleSecondaryAction = (e) => {
    e.stopPropagation();
    if (
      notification.secondaryAction &&
      typeof notification.secondaryAction === "function"
    ) {
      notification.secondaryAction();
    }
  };

  // Check if this is an in-progress export notification
  const isExportInProgress =
    notification.progress !== undefined && notification.status === "processing";

  return (
    <MenuItem
      onClick={handleClick}
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
        flexDirection: "column",
        alignItems: "stretch",
        width: "100%",
      }}
    >
      <Box sx={{ display: "flex", width: "100%" }}>
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
            {formatTimestamp(
              notification.timestamp || notification.createdAt,
              t
            )}
          </Typography>

          {/* Progress bar for in-progress exports */}
          {isExportInProgress && (
            <>
              <Box sx={{ mt: 1, mb: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={notification.progress || 0}
                  sx={{ height: 5, borderRadius: 1 }}
                />
              </Box>
              {notification.remainingTime && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {formatRemainingTime(notification.remainingTime)}{" "}
                  {t("common.remaining")}
                </Typography>
              )}
            </>
          )}

          <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
            {notification.actionLabel && notification.action && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={notification.actionIcon || <CloudDownload />}
                onClick={(e) => {
                  e.stopPropagation();
                  if (notification.action) notification.action();
                }}
                sx={{ py: 0.5 }}
              >
                {notification.actionLabel}
              </Button>
            )}

            {notification.secondaryActionLabel &&
              notification.secondaryAction && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={notification.secondaryActionIcon || <CancelIcon />}
                  onClick={handleSecondaryAction}
                  sx={{ py: 0.5 }}
                >
                  {notification.secondaryActionLabel}
                </Button>
              )}
          </Box>

          {/* For in-progress exports, show download placeholder */}
          {isExportInProgress && notification.downloadAction && (
            <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
              <HourglassEmptyIcon
                fontSize="small"
                sx={{ mr: 1, color: "primary.main" }}
              />
              <Typography variant="caption" color="primary">
                {t("notifications.downloadWhenComplete")}
              </Typography>
            </Box>
          )}

          {expanded && notification.format && (
            <Box
              sx={{ mt: 1, p: 1, bgcolor: "rgba(0,0,0,0.03)", borderRadius: 1 }}
            >
              <Typography variant="body2" sx={{ mb: 0.5 }}>
                <strong>{t("common.format")}:</strong>{" "}
                {notification.format.toUpperCase()}
              </Typography>
              {notification.exportTitle && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t("common.export")}:</strong>{" "}
                  {notification.exportTitle}
                </Typography>
              )}
              {notification.filters && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t("common.filters")}:</strong>{" "}
                  {JSON.stringify(notification.filters)
                    .replace(/[{}"]/g, "")
                    .replace(/,/g, ", ")}
                </Typography>
              )}
              {notification.rowCount && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t("common.rows")}:</strong>{" "}
                  {notification.rowCount.toLocaleString()}
                </Typography>
              )}
              {notification.createdAt && (
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  <strong>{t("common.time")}:</strong>{" "}
                  {new Date(notification.createdAt).toLocaleString()}
                </Typography>
              )}
              {notification.status === "processing" &&
                notification.progress !== undefined && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>{t("common.progress")}:</strong>{" "}
                    {notification.progress}%
                    {notification.remainingTime &&
                      ` (${formatRemainingTime(notification.remainingTime)} ${t(
                        "common.remaining"
                      )})`}
                  </Typography>
                )}
            </Box>
          )}
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
      </Box>
    </MenuItem>
  );
};

const NotificationMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const { notifications, removeNotification, clearNotifications } =
    useNotification();
  const { t } = useTranslation();

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Sort notifications to show newest first
  const sortedNotifications = [...notifications].sort((a, b) => {
    // Get timestamps and convert to numbers for comparison
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA; // Newest first
  });

  return (
    <>
      <Tooltip title={t("common.notifications")}>
        <IconButton
          color="inherit"
          onClick={handleClick}
          size="large"
          aria-label="notifications"
        >
          <Badge badgeContent={notifications.length} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 450,
            maxHeight: "85vh",
            pb: 0,
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6">
            {t("common.notifications")}
            {notifications.length > 0 && (
              <Chip
                label={notifications.length}
                size="small"
                color="primary"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
          {notifications.length > 0 && (
            <Button
              startIcon={<DoneAllIcon />}
              onClick={() => {
                clearNotifications();
                handleClose();
              }}
              size="small"
            >
              {t("common.clearAll")}
            </Button>
          )}
        </Box>

        <Box
          sx={{
            overflowY: "auto",
            maxHeight: "70vh",
            minHeight: notifications.length ? undefined : 100,
            pt: 1,
            pb: 1,
            px: 1,
          }}
        >
          {notifications.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                py: 3,
                opacity: 0.7,
              }}
            >
              <NotificationsOffIcon fontSize="large" color="disabled" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t("common.noNotifications")}
              </Typography>
            </Box>
          ) : (
            sortedNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRemove={removeNotification}
              />
            ))
          )}
        </Box>
      </Menu>
    </>
  );
};

NotificationItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
    timestamp: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.instanceOf(Date),
    ]),
    action: PropTypes.func,
    actionLabel: PropTypes.string,
    actionIcon: PropTypes.node,
    secondaryAction: PropTypes.func,
    secondaryActionLabel: PropTypes.string,
    secondaryActionIcon: PropTypes.node,
    progress: PropTypes.number,
    status: PropTypes.string,
    remainingTime: PropTypes.number,
    downloadAction: PropTypes.func,
    format: PropTypes.string,
    exportTitle: PropTypes.string,
    filters: PropTypes.object,
    rowCount: PropTypes.number,
    taskId: PropTypes.string,
    createdAt: PropTypes.string,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
};

export default NotificationMenu;
