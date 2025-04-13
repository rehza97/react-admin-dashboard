import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  IconButton,
  Tooltip,
  Collapse,
} from "@mui/material";
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import dataService from "../services/dataService";

const STORAGE_KEYS = {
  ACTIVE_TASKS: "backgroundTasks_activeTasks",
};

const BackgroundTaskManager = () => {
  const [activeTasks, setActiveTasks] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_TASKS);
    return saved ? JSON.parse(saved) : [];
  });
  const [expandedTasks, setExpandedTasks] = useState({});
  const [showManager, setShowManager] = useState(true);

  // Save active tasks to localStorage
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.ACTIVE_TASKS,
      JSON.stringify(activeTasks)
    );
  }, [activeTasks]);

  // Poll task progress
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const updatedTasks = await Promise.all(
        activeTasks.map(async (task) => {
          try {
            const progress = await dataService.getCleanupProgress(task.id);
            return {
              ...task,
              progress: progress.progress || 0,
              status: progress.status,
              result: progress.result,
              error: progress.error,
            };
          } catch (error) {
            console.error(`Error polling task ${task.id}:`, error);
            return task;
          }
        })
      );

      // Remove completed or failed tasks
      const remainingTasks = updatedTasks.filter(
        (task) => task.status !== "complete" && task.status !== "failed"
      );

      setActiveTasks(remainingTasks);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [activeTasks]);

  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const removeTask = (taskId) => {
    setActiveTasks((prev) => prev.filter((task) => task.id !== taskId));
  };

  if (!showManager || activeTasks.length === 0) return null;

  return (
    <Paper
      sx={{
        position: "fixed",
        bottom: 16,
        right: 16,
        width: 300,
        zIndex: 1000,
      }}
    >
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="subtitle1">Background Tasks</Typography>
        <IconButton size="small" onClick={() => setShowManager(false)}>
          <CloseIcon />
        </IconButton>
      </Box>

      {activeTasks.map((task) => (
        <Box
          key={task.id}
          sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" noWrap>
              {task.type === "cleanup" ? "Data Cleanup" : "Data Analysis"}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" color="textSecondary">
                {task.progress}%
              </Typography>
              <IconButton
                size="small"
                onClick={() => toggleTaskExpansion(task.id)}
              >
                {expandedTasks[task.id] ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => removeTask(task.id)}
                disabled={task.status === "processing"}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          <LinearProgress
            variant="determinate"
            value={task.progress}
            sx={{ mt: 1 }}
          />

          <Collapse in={expandedTasks[task.id]}>
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="textSecondary">
                Started: {new Date(task.startTime).toLocaleString()}
              </Typography>
              {task.error && (
                <Typography variant="caption" color="error" display="block">
                  Error: {task.error}
                </Typography>
              )}
              {task.result && (
                <Typography
                  variant="caption"
                  color="success.main"
                  display="block"
                >
                  Completed successfully
                </Typography>
              )}
            </Box>
          </Collapse>
        </Box>
      ))}
    </Paper>
  );
};

export default BackgroundTaskManager;
