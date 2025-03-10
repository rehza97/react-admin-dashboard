import { createContext, useState, useContext, useCallback } from "react";
import PropTypes from "prop-types";

// Create upload queue context with default value
const UploadQueueContext = createContext({
  queue: [],
  addToQueue: () => {},
  removeFromQueue: () => {},
  updateFileStatus: () => {},
  clearQueue: () => {},
  retryUpload: () => {},
  processQueue: () => {},
});

// Custom hook to use the upload queue context
export const useUploadQueue = () => useContext(UploadQueueContext);

// Upload queue provider component
export const UploadQueueProvider = ({ children }) => {
  const [queue, setQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Process the upload queue
  const processQueue = useCallback(() => {
    // This is a simplified version - in a real app, this would handle the actual file uploads
    console.log("Processing queue:", queue);
    setIsProcessing(true);

    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
    }, 2000);
  }, [queue]);

  // Add a file to the upload queue
  const addToQueue = useCallback((file) => {
    const id = Date.now();
    const newQueueItem = {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: "pending",
      progress: 0,
      uploadDate: new Date(),
      error: null,
    };

    setQueue((prev) => [...prev, newQueueItem]);
    return id;
  }, []);

  // Remove a file from the queue
  const removeFromQueue = useCallback((id) => {
    setQueue((prev) => prev.filter((file) => file.id !== id));
  }, []);

  // Update a file's status, progress, or error
  const updateFileStatus = useCallback((id, updates) => {
    setQueue((prev) =>
      prev.map((file) => (file.id === id ? { ...file, ...updates } : file))
    );
  }, []);

  // Clear the entire queue
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Retry a failed upload
  const retryUpload = useCallback((id) => {
    setQueue((prev) =>
      prev.map((file) =>
        file.id === id
          ? { ...file, status: "pending", progress: 0, error: null }
          : file
      )
    );
  }, []);

  // Value to be provided by the context
  const value = {
    queue,
    isProcessing,
    addToQueue,
    removeFromQueue,
    updateFileStatus,
    clearQueue,
    retryUpload,
    processQueue,
  };

  return (
    <UploadQueueContext.Provider value={value}>
      {children}
    </UploadQueueContext.Provider>
  );
};

UploadQueueProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
