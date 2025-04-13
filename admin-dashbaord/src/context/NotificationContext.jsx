import {
  useState,
  useCallback,
  createContext,
  useContext,
  useEffect,
} from "react";
import PropTypes from "prop-types";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CancelIcon from "@mui/icons-material/Cancel";
import {
  cancelExport,
  checkExportStatus,
  formatRemainingTime,
  downloadExportFile,
} from "../services/exportService";
import { v4 as uuidv4 } from "uuid";

// Store for export intervals
const exportIntervals = {};

// Create notification context with default value
export const NotificationContext = createContext({
  notifications: [],
  addNotification: () => {},
  removeNotification: () => {},
  clearNotifications: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
  addExportNotification: () => {},
});

// Use notification hook
export const useNotification = () => {
  return useContext(NotificationContext);
};

/**
 * NotificationContext.jsx
 * Manages the application's notification system
 * Updated to support detailed export notifications that persist and show expanded metadata
 */

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [nextId, setNextId] = useState(1);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(exportIntervals).forEach((intervalId) => {
        clearInterval(intervalId);
      });
    };
  }, []);

  // Simple function to play notification sound
  const playSound = () => {
    try {
      const audio = new Audio("/sounds/notification.mp3");
      audio
        .play()
        .catch(() => console.log("Could not play notification sound"));
    } catch {
      console.log("Sound playback not supported");
    }
  };

  // Add notification
  const addNotification = useCallback(
    (notification) => {
      // Generate unique id if not provided
      const id = notification.id || `notification-${nextId}`;
      setNextId((prev) => prev + 1);

      const newNotification = {
        ...notification,
        id,
        createdAt: new Date(),
      };

      setNotifications((prev) => [...prev, newNotification]);

      // Set timer for auto-dismiss if duration is provided
      if (notification.duration) {
        setTimeout(() => {
          removeNotification(id);
        }, notification.duration);
      }

      // Play sound if enabled
      if (notification.playSound) {
        playSound();
      }

      return id;
    },
    [nextId]
  );

  // Update an existing notification by ID
  const updateNotification = useCallback((id, updates) => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) =>
        notification.id === id ? { ...notification, ...updates } : notification
      )
    );
  }, []);

  // Remove a notification by id
  const removeNotification = useCallback((id) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );

    // Clear any interval associated with this notification
    if (exportIntervals[id]) {
      clearInterval(exportIntervals[id]);
      delete exportIntervals[id];
    }
  }, []);

  // Track download history - add a new download to history
  const addDownloadHistory = useCallback((fileInfo) => {
    const historyItem = {
      id: uuidv4(),
      filename: fileInfo.filename,
      fileUrl: fileInfo.fileUrl,
      fileSize: fileInfo.fileSize || "Unknown",
      timestamp: new Date().toISOString(),
      format: fileInfo.format,
      status: fileInfo.status || "completed",
    };

    setDownloadHistory((prev) => {
      // Keep only the most recent items (limit to MAX_DOWNLOAD_HISTORY)
      const newHistory = [historyItem, ...prev].slice(0, MAX_DOWNLOAD_HISTORY);
      return newHistory;
    });

    return historyItem.id;
  }, []);

  // Remove download history item
  const removeDownloadHistory = useCallback((id) => {
    setDownloadHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Clear all download history
  const clearDownloadHistory = useCallback(() => {
    setDownloadHistory([]);
  }, []);

  // Use the downloadExportFile function from the exportService
  const createDownloadAction = (fileUrl, filename) => {
    return async () => {
      try {
        // Pass the filename to downloadExportFile if provided, otherwise it will extract from URL
        await downloadExportFile(fileUrl, filename);
      } catch (err) {
        console.error("Error downloading file:", err);
        // Show error notification
        addNotification({
          type: "error",
          message: `Failed to download file: ${err.message}`,
          title: "Download Error",
          duration: 8000,
          playSound: true,
        });
      }
    };
  };

  // Update the addExportNotification function
  const addExportNotification = useCallback(
    (title, format, fileUrl, downloadAction, statusInfo) => {
      const isInProgress = statusInfo && statusInfo.inProgress;

      // Create base notification object
      const notification = {
        type: isInProgress ? "info" : "success",
        title: title || "Export",
        message: isInProgress
          ? `${format.toUpperCase()} export in progress - ${
              statusInfo.progress || 0
            }% complete`
          : `Your ${format.toUpperCase()} export is ready for download`,
        playSound: !isInProgress, // Only play sound for completed exports
        // Keep export notifications until manually dismissed
        duration: null,
        // Add format information for all exports
        format: format,
        exportTitle: title,
        // Store creation timestamp
        createdAt: new Date().toISOString(),
        // Include filters if provided
        filters: statusInfo?.filters,
        // Include row count if provided
        rowCount: statusInfo?.rowCount,
      };

      // Add action button for downloads or updates
      if (isInProgress) {
        // For in-progress exports, track the progress and task
        notification.progress = statusInfo.progress || 0;
        notification.status = statusInfo.status || "processing";
        notification.remainingTime = statusInfo.remainingTime;
        notification.downloadAction = downloadAction;

        // Add estimated completion time if available
        if (statusInfo.remainingTime) {
          notification.message += ` (${formatRemainingTime(
            statusInfo.remainingTime
          )} remaining)`;
        }

        // Add task ID if available for cancellation
        if (statusInfo.taskId) {
          notification.taskId = statusInfo.taskId;

          // Add cancel action
          notification.secondaryAction = async () => {
            try {
              const response = await cancelExport(statusInfo.taskId);
              if (response.status === "cancelled") {
                // Update notification to show cancelled status
                addNotification({
                  type: "error",
                  message: `${title} - ${format.toUpperCase()} export was cancelled`,
                  title: "Export Cancelled",
                  duration: 8000,
                  playSound: true,
                  format,
                  exportTitle: title,
                  filters: statusInfo?.filters,
                  status: "cancelled",
                });
              }
            } catch (err) {
              console.error("Error cancelling export:", err);
            }
          };
          notification.secondaryActionLabel = "Cancel";
          notification.secondaryActionIcon = <CancelIcon />;
        }

        // Start an interval to auto-refresh the notification
        const notificationId = addNotification(notification);

        // Set up polling for this export notification
        if (statusInfo.taskId) {
          console.log(
            `Setting up progress polling for task ${statusInfo.taskId}`
          );

          // Store the interval ID so we can clear it later
          const intervalId = setInterval(async () => {
            try {
              const status = await checkExportStatus(statusInfo.taskId);
              console.log(`Task ${statusInfo.taskId} status:`, status);

              if (status.status === "completed" && status.file_url) {
                // Export is complete, update to completion notification
                clearInterval(intervalId);
                delete exportIntervals[notificationId];

                // Get the filename from the URL without query parameters
                // Use originalFileUrl which doesn't have the cache-busting parameter
                const cleanUrl =
                  status.originalFileUrl || status.file_url.split("?")[0];
                const filename = cleanUrl.split("/").pop();

                // Create a download action function that forces download
                const directDownloadAction = createDownloadAction(
                  status.file_url, // Keep using the versioned URL for the actual download
                  filename // But use the clean filename for display
                );

                // Keep the row count from the last status update
                const rowCount = status.row_count || statusInfo.rowCount;

                // Update the notification instead of removing and adding a new one
                updateNotification(notificationId, {
                  type: "success",
                  message: `Your ${format.toUpperCase()} export is ready for download`,
                  progress: 100,
                  status: "completed",
                  actionLabel: "Download",
                  actionIcon: <CloudDownloadIcon />,
                  action: directDownloadAction,
                  fileUrl: status.file_url,
                  completedAt: new Date().toISOString(),
                  rowCount: rowCount,
                });

                // Add to download history
                addDownloadHistory({
                  filename: filename,
                  fileUrl: status.file_url,
                  fileSize: status.file_size || "Unknown",
                  format: format,
                  status: "completed",
                });

                // Play sound when export completes
                playSound();
              } else if (
                status.status === "failed" ||
                status.status === "cancelled"
              ) {
                // Export failed, update notification
                clearInterval(intervalId);
                delete exportIntervals[notificationId];

                // Update the notification instead of removing it
                updateNotification(notificationId, {
                  type: "error",
                  message:
                    status.error ||
                    `${format.toUpperCase()} export ${status.status}`,
                  title: `Export ${
                    status.status === "failed" ? "Failed" : "Cancelled"
                  }`,
                  status: status.status,
                  actionLabel: "Retry",
                  action: () => {
                    // Re-trigger the export
                    window.dispatchEvent(
                      new CustomEvent("retryExport", {
                        detail: { format, title, filters: statusInfo?.filters },
                      })
                    );
                  },
                });

                // Add to download history
                addDownloadHistory({
                  filename: `${title}.${format}`,
                  fileUrl: null,
                  format: format,
                  status: status.status,
                });

                // Play sound for failed exports
                playSound();
              } else if (
                status.status === "processing" &&
                status.progress !== undefined
              ) {
                // Update the progress
                let message = `${format.toUpperCase()} export in progress - ${
                  status.progress
                }% complete`;

                // Add remaining time if available
                if (status.remaining_time) {
                  message += ` (${formatRemainingTime(
                    status.remaining_time
                  )} remaining)`;
                }

                // Update row count if available
                const rowCount = status.row_count || statusInfo.rowCount;

                updateNotification(notificationId, {
                  message: message,
                  progress: status.progress,
                  remainingTime: status.remaining_time,
                  rowCount: rowCount,
                });
              }
            } catch (error) {
              console.error("Error checking export status:", error);
            }
          }, 2000); // Poll every 2 seconds

          // Store the interval ID in our dedicated object
          exportIntervals[notificationId] = intervalId;
        }

        // Return the ID so we can update this notification later
        return notificationId;
      } else {
        // For completed exports, add download action
        notification.actionLabel = "Download";
        notification.actionIcon = <CloudDownloadIcon />;
        notification.status = "completed";
        notification.completedAt = new Date().toISOString();

        // Get the filename from the URL if available
        const filename = fileUrl ? fileUrl.split("/").pop() : null;

        // Create a direct download action that doesn't open a new tab
        notification.action =
          downloadAction || createDownloadAction(fileUrl, filename);
        notification.fileUrl = fileUrl;

        // Add to download history
        if (fileUrl) {
          addDownloadHistory({
            filename: filename || `${title}.${format}`,
            fileUrl: fileUrl,
            format: format,
            status: "completed",
          });
        }

        return addNotification(notification);
      }
    },
    [
      addNotification,
      removeNotification,
      updateNotification,
      addDownloadHistory,
    ]
  );

  // Clear all notifications
  const clearNotifications = useCallback(() => {
    // Clear all intervals first
    Object.keys(exportIntervals).forEach((id) => {
      clearInterval(exportIntervals[id]);
      delete exportIntervals[id];
    });

    setNotifications([]);
  }, []);

  // Success notification shorthand
  const success = useCallback(
    (message, options = {}) => {
      return addNotification({
        type: "success",
        message,
        duration: 5000,
        ...options,
      });
    },
    [addNotification]
  );

  // Error notification shorthand
  const error = useCallback(
    (message, options = {}) => {
      return addNotification({
        type: "error",
        message,
        duration: 8000,
        playSound: true, // Always play sound for errors
        ...options,
      });
    },
    [addNotification]
  );

  // Warning notification shorthand
  const warning = useCallback(
    (message, options = {}) => {
      return addNotification({
        type: "warning",
        message,
        duration: 6000,
        ...options,
      });
    },
    [addNotification]
  );

  // Info notification shorthand
  const info = useCallback(
    (message, options = {}) => {
      return addNotification({
        type: "info",
        message,
        duration: 5000,
        ...options,
      });
    },
    [addNotification]
  );

  // Value to be provided by the context
  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    success,
    error,
    warning,
    info,
    addExportNotification,
    updateNotification,
    keepNotificationsOnClick: true, // Flag to indicate we want to keep notifications when clicked
    // Download history features
    downloadHistory,
    addDownloadHistory,
    removeDownloadHistory,
    clearDownloadHistory,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Add MAX_DOWNLOAD_HISTORY constant
// Maximum number of download history items to keep
const MAX_DOWNLOAD_HISTORY = 10;
