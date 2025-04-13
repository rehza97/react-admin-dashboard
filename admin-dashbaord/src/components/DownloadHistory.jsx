import React, { useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import HistoryIcon from "@mui/icons-material/History";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ArticleIcon from "@mui/icons-material/Article";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionIcon from "@mui/icons-material/Description";
import { useNotification } from "../context/NotificationContext";
import { downloadExportFile } from "../services/exportService";
import { useTranslation } from "react-i18next";

// Get icon based on file type
const getFileIcon = (format) => {
  switch (format?.toLowerCase()) {
    case "xlsx":
    case "excel":
      return <InsertDriveFileIcon color="success" />;
    case "csv":
      return <ArticleIcon color="primary" />;
    case "pdf":
      return <DescriptionIcon color="error" />;
    default:
      return <InsertDriveFileIcon />;
  }
};

// Format file size
const formatFileSize = (size) => {
  if (!size || size === "Unknown") return "Unknown size";
  if (typeof size === "number") {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return size;
};

// Format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleDateString() + " " + date.toLocaleTimeString();
};

// Status chip component
const StatusChip = ({ status }) => {
  let color = "default";
  let label = status;

  switch (status) {
    case "completed":
      color = "success";
      break;
    case "failed":
      color = "error";
      break;
    case "cancelled":
      color = "warning";
      break;
    case "processing":
      color = "info";
      break;
    default:
      break;
  }

  return <Chip size="small" label={label} color={color} sx={{ ml: 1 }} />;
};

// Add a new helper function to clean filenames
const cleanFileName = (filename) => {
  if (!filename) return "Unknown file";

  // Remove query parameters
  let clean = filename.split("?")[0];

  // Remove any timestamp parameters
  if (clean.includes("_t=")) {
    clean = clean.replace(/_t=[0-9]+/, "");
  }

  // Fix double extensions
  if (clean.match(/\.(xlsx|csv|pdf)\.(xlsx|csv|pdf)$/i)) {
    clean = clean.replace(/\.(xlsx|csv|pdf)\.(xlsx|csv|pdf)$/i, ".$1");
  }

  return clean;
};

const DownloadHistory = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const { downloadHistory, removeDownloadHistory, clearDownloadHistory } =
    useNotification();
  const { t } = useTranslation();
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDownload = async (item) => {
    try {
      if (item.fileUrl) {
        // Pass the clean filename to the download function
        await downloadExportFile(item.fileUrl, cleanFileName(item.filename));
      }
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  const handleDeleteClick = (item) => {
    setSelectedItem(item);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedItem) {
      removeDownloadHistory(selectedItem.id);
    }
    setDeleteConfirmOpen(false);
    setSelectedItem(null);
  };

  const handleClearAll = () => {
    clearDownloadHistory();
    handleClose();
  };

  return (
    <>
      <Tooltip title={t("common.recentDownloads")}>
        <IconButton
          color="inherit"
          onClick={handleClick}
          size="large"
          aria-label="download history"
        >
          <HistoryIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 350,
            maxHeight: "75vh",
          },
        }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 1,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" sx={{ pl: 1 }}>
            {t("common.recentDownloads")}
          </Typography>
          {downloadHistory.length > 0 && (
            <Button size="small" onClick={handleClearAll} color="primary">
              {t("common.clearAll")}
            </Button>
          )}
        </Box>

        {downloadHistory.length === 0 ? (
          <Box
            sx={{
              p: 3,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              color: "text.secondary",
            }}
          >
            <HistoryIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body2">
              {t("common.noDownloadHistory")}
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0 }}>
            {downloadHistory.map((item) => (
              <ListItem
                key={item.id}
                secondaryAction={
                  <Box sx={{ display: "flex" }}>
                    {item.fileUrl && (
                      <Tooltip title={t("Download")}>
                        <IconButton
                          edge="end"
                          aria-label="download"
                          onClick={() => handleDownload(item)}
                          size="small"
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={t("Remove")}>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDeleteClick(item)}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
                sx={{
                  py: 0.5,
                  borderBottom: "1px solid",
                  borderBottomColor: "divider",
                  "&:last-child": {
                    borderBottom: "none",
                  },
                }}
              >
                <ListItemIcon>{getFileIcon(item.format)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                        {cleanFileName(item.filename)}
                      </Typography>
                      <StatusChip status={item.status} />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography
                        variant="caption"
                        display="block"
                        color="text.secondary"
                      >
                        {formatTimestamp(item.timestamp)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(item.fileSize)}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Menu>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {t("common.removeFromDownloadHistory")}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">{selectedItem?.filename}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            {t("common.remove")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DownloadHistory;
