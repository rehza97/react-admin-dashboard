import { createContext, useState, useContext, useCallback } from "react";
import PropTypes from "prop-types";

// Create notification context with default value
const NotificationContext = createContext({
  notifications: [],
  addNotification: () => {},
  removeNotification: () => {},
  clearNotifications: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
});

// Custom hook to use the notification context
export const useNotification = () => useContext(NotificationContext);

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  // Add a new notification
  const addNotification = useCallback((notification) => {
    const id = Date.now();
    const newNotification = {
      id,
      ...notification,
      timestamp: new Date(),
    };

    setNotifications((prev) => [...prev, newNotification]);

    // Auto-dismiss notifications if they have a duration
    if (notification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    return id;
  }, []);

  // Remove a notification by id
  const removeNotification = useCallback((id) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(() => {
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
