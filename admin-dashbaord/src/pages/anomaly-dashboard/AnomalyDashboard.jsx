import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  Grid,
  Paper,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Button,
  Tooltip,
  IconButton,
  useTheme,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Stack,
  Chip,
  Badge,
  LinearProgress,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import StorageIcon from "@mui/icons-material/Storage";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TimelineIcon from "@mui/icons-material/Timeline";
import WarningIcon from "@mui/icons-material/Warning";
import anomalyService from "../../services/anomalyService";
import PageLayout from "../../components/PageLayout";
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts";

// Constants for local storage keys
const STORAGE_KEYS = {
  CACHE: "anomaly_dashboard_cache",
  SCAN_STATUSES: "anomaly_scan_statuses",
  SCAN_HISTORY: "anomaly_scan_history",
  ACTIVE_TAB: "anomaly_dashboard_active_tab",
};

// Model Scan Card Component
const ModelScanCard = ({ model, onScan, scanStatus }) => {
  const theme = useTheme();
  const [scanHistory, setScanHistory] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCAN_HISTORY);
    return saved ? JSON.parse(saved)[model.id] || {} : {};
  });

  const getScanStatusColor = (status) => {
    switch (status?.state) {
      case "scanning":
        return "primary";
      case "success":
        return "success";
      case "error":
        return "error";
      default:
        return "default";
    }
  };

  const getScanStatusIcon = (status) => {
    switch (status?.state) {
      case "scanning":
        return <CircularProgress size={20} />;
      case "success":
        return <CheckCircleIcon />;
      case "error":
        return <ErrorIcon />;
      default:
        return <SearchIcon />;
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleString();
  };

  // Calculate time elapsed since last scan
  const getTimeElapsed = () => {
    if (!scanHistory.lastScan) return null;

    const elapsed = Date.now() - scanHistory.lastScan;
    const minutes = Math.floor(elapsed / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  };

  const timeElapsed = getTimeElapsed();

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: 4,
        },
        position: "relative",
      }}
      elevation={2}
    >
      {scanStatus?.state === "scanning" && (
        <LinearProgress
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
          }}
        />
      )}
      <CardContent sx={{ pb: 1, flexGrow: 1 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {model.name}
          </Typography>
          {scanStatus && (
            <Chip
              size="small"
              color={getScanStatusColor(scanStatus)}
              label={scanStatus.state}
            />
          )}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            minHeight: "2.5rem",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {model.description}
        </Typography>

        <Divider sx={{ my: 1 }} />

        <List dense disablePadding>
          <ListItem disableGutters sx={{ px: 0 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <StorageIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  color="text.primary"
                >{`Model ID: ${model.id}`}</Typography>
              }
            />
          </ListItem>

          <ListItem disableGutters sx={{ px: 0 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <TimelineIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={
                <span>
                  <Typography
                    variant="body2"
                    color="text.primary"
                    component="span"
                  >
                    Last Scan: {timeElapsed || "Never"}
                  </Typography>
                </span>
              }
            />
          </ListItem>

          {scanHistory.anomaliesFound !== undefined && (
            <ListItem disableGutters sx={{ px: 0 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                {scanHistory.anomaliesFound > 0 ? (
                  <Badge
                    badgeContent={scanHistory.anomaliesFound}
                    color="error"
                    max={999}
                  >
                    <WarningIcon fontSize="small" color="warning" />
                  </Badge>
                ) : (
                  <CheckCircleIcon fontSize="small" color="success" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" color="text.primary">
                    {scanHistory.anomaliesFound > 0
                      ? `${scanHistory.anomaliesFound} anomalies found`
                      : "No anomalies detected"}
                  </Typography>
              }
            />
          </ListItem>
          )}
        </List>
      </CardContent>

      <CardActions sx={{ pt: 0, px: 2, pb: 2 }}>
        <Button
          startIcon={getScanStatusIcon(scanStatus)}
          variant="contained"
          onClick={() => onScan(model.id)}
          disabled={scanStatus?.state === "scanning"}
          fullWidth
          size="small"
          color={scanStatus?.state === "error" ? "error" : "primary"}
        >
          {scanStatus?.state === "scanning"
            ? "Scanning..."
            : "Scan for Anomalies"}
        </Button>
      </CardActions>
    </Card>
  );
};

// Main Dashboard Component
const AnomalyDashboard = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
    return savedTab ? parseInt(savedTab, 10) : 0;
  });
  const [refreshing, setRefreshing] = useState(false);
  const [scanStatuses, setScanStatuses] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCAN_STATUSES);
    return saved ? JSON.parse(saved) : {};
  });
  const [notifications, setNotifications] = useState([]);
  const [scanHistory, setScanHistory] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCAN_HISTORY);
    return saved ? JSON.parse(saved) : {};
  });

  // Auto-refresh functionality
  const REFRESH_INTERVAL = 60000; // 60 seconds
  const refreshIntervalRef = useRef(null);

  // Define fetchDashboardData before using it
  const fetchDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      const statistics = await anomalyService.getAnomalyStats();
      setStats(statistics);
      saveToCache(statistics);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(
        "Failed to load anomaly dashboard data. Please try again later."
      );

      if (!loadFromCache()) {
        setError(
          "No cached data available. Please check your connection and try again."
        );
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  const hasActiveScan = useCallback(() => {
    return Object.values(scanStatuses).some(
      (status) => status.state === "scanning"
    );
  }, [scanStatuses]);

  // Start or stop refresh interval based on scan status
  useEffect(() => {
    const startRefreshInterval = () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      refreshIntervalRef.current = setInterval(() => {
        if (hasActiveScan()) {
          fetchDashboardData();
        } else {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      }, REFRESH_INTERVAL);
    };

    if (hasActiveScan()) {
      startRefreshInterval();
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [hasActiveScan, fetchDashboardData]);

  // Initial data load
  useEffect(() => {
    if (!loadFromCache()) {
      fetchDashboardData();
    } else {
      setLoading(false);
      fetchDashboardData();
    }
  }, [fetchDashboardData]);

  // Save scan statuses whenever they change
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SCAN_STATUSES,
      JSON.stringify(scanStatuses)
    );
  }, [scanStatuses]);

  // Save active tab whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTab.toString());
  }, [activeTab]);

  // Save scan history whenever it changes
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.SCAN_HISTORY,
      JSON.stringify(scanHistory)
    );
  }, [scanHistory]);

  // Cache management
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  const loadFromCache = () => {
    const cached = localStorage.getItem(STORAGE_KEYS.CACHE);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        setStats(data);
        return true;
      }
    }
    return false;
  };

  const saveToCache = (data) => {
    localStorage.setItem(
      STORAGE_KEYS.CACHE,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  };

  const addNotification = (message, severity = "info") => {
    const id = Date.now();
    setNotifications((prev) => {
      const newNotifications = [...prev, { id, message, severity }];
      // Keep only last 5 notifications
      return newNotifications.slice(-5);
    });

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  };

  const handleModelScan = async (modelId) => {
    // Update scan status
    setScanStatuses((prev) => ({
      ...prev,
      [modelId]: {
        state: "scanning",
        message: "Scan in progress...",
        startTime: Date.now(),
      },
    }));

    try {
      const result = await anomalyService.scanModelAnomalies(modelId);

      // Update scan history
      setScanHistory((prev) => ({
        ...prev,
        [modelId]: {
          lastScan: Date.now(),
          totalScans: (prev[modelId]?.totalScans || 0) + 1,
          totalAnomalies:
            (prev[modelId]?.totalAnomalies || 0) + result.anomalies_found,
          anomaliesFound: result.anomalies_found,
        },
      }));

      setScanStatuses((prev) => ({
        ...prev,
        [modelId]: {
          state: "success",
          message: `Found ${result.anomalies_found} anomalies`,
          completedAt: Date.now(),
          anomaliesFound: result.anomalies_found,
        },
      }));

      addNotification(
        `Successfully scanned ${modelId}: Found ${result.anomalies_found} anomalies`,
        "success"
      );

      // Immediate refresh after scan completes
      fetchDashboardData();
    } catch (err) {
      setScanStatuses((prev) => ({
        ...prev,
        [modelId]: {
          state: "error",
          message: err.message,
          error: err.message,
          completedAt: Date.now(),
        },
      }));

      addNotification(`Failed to scan ${modelId}: ${err.message}`, "error");
    }
  };

  const formatStatusData = () => {
    if (!stats?.anomalies_by_status) return [];

    return Object.entries(stats.anomalies_by_status).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
    }));
  };

  const formatTypeData = () => {
    if (!stats?.anomalies_by_type) return [];

    const typeDisplayNames = {
      duplicate_data: "Duplicate Data",
      empty_field: "Empty Fields",
      invalid_dot: "Invalid DOT",
      missing_record: "Missing Records",
      outlier: "Outliers",
      zero_value: "Zero Values",
      invalid_amount: "Invalid Amounts",
      amount_mismatch: "Amount Mismatch",
      dot_mismatch: "DOT Mismatch",
    };

    return Object.entries(stats.anomalies_by_type)
      .map(([type, count]) => ({
        name:
          typeDisplayNames[type] ||
          type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      count: count,
      }))
      .sort((a, b) => b.count - a.count);
  };

  const formatSourceData = () => {
    if (!stats?.anomalies_by_source) return [];

    const sourceDisplayNames = {
      creances_ngbss: "Créances NGBSS",
      etat_facture: "État de Facture",
      journal_ventes: "Journal des Ventes",
      parc_corporate: "Parc Corporate",
      ca_periodique: "CA Périodique",
      ca_non_periodique: "CA Non Périodique",
      ca_dnt: "CA DNT",
      ca_rfd: "CA RFD",
      ca_cnt: "CA CNT",
    };

    return Object.entries(stats.anomalies_by_source)
      .map(([source, count]) => ({
        name:
          sourceDisplayNames[source] ||
          source.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      count: count,
      }))
      .sort((a, b) => b.count - a.count);
  };

  const formatSeverityData = () => {
    if (!stats?.severity_distribution) return [];

    return Object.entries(stats.severity_distribution).map(
      ([severity, count]) => ({
        name: severity.charAt(0).toUpperCase() + severity.slice(1),
        value: count,
      })
    );
  };

  const formatTrendData = () => {
    if (!stats?.detection_rate || !Array.isArray(stats.detection_rate))
      return [];

    return stats.detection_rate.map((item) => ({
      date: new Date(item.date).toLocaleDateString(),
      count: item.count,
    }));
  };

  const formatOrganizationData = () => {
    if (!stats?.top_affected_organizations) return [];

    return stats.top_affected_organizations
      .filter((org) => org.data__organization)
      .map((org) => ({
        name: org.data__organization,
        count: org.count,
      }));
  };

  const renderPieChart = (data, title) => {
    if (!data || data.length === 0) return null;

    const COLORS = [
      theme.palette.primary.main,
      theme.palette.secondary.main,
      theme.palette.success.main,
      theme.palette.warning.main,
      theme.palette.error.main,
      theme.palette.info.main,
      ...Array(10)
        .fill()
        .map((_, i) => theme.palette.primary[i * 100 + 100]),
    ];

    return (
      <Box sx={{ height: 300, width: "100%" }}>
        <Typography variant="h6" align="center" gutterBottom>
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={true}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Legend />
            <RechartsTooltip formatter={(value) => [`${value}`, "Count"]} />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  const renderBarChart = (data, xKey, yKey, title) => {
    if (!data || data.length === 0) return null;

    return (
      <Box sx={{ height: 300, width: "100%" }}>
        <Typography variant="h6" align="center" gutterBottom>
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey}
              tick={{ angle: -45, textAnchor: "end", fontSize: 11 }}
              height={60}
            />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Bar
              dataKey={yKey}
              fill={theme.palette.primary.main}
              name="Count"
              radius={[4, 4, 0, 0]}
              barSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  const renderLineChart = (data, title) => {
    if (!data || data.length === 0) return null;

    return (
      <Box sx={{ height: 300, width: "100%" }}>
        <Typography variant="h6" align="center" gutterBottom>
          {title}
        </Typography>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="count"
              stroke={theme.palette.primary.main}
              activeDot={{ r: 8 }}
              name="Anomalies"
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  const renderKPICard = (title, value, subtitle, color) => {
    return (
      <Paper
        elevation={2}
        sx={{
          p: 2,
          textAlign: "center",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          bgcolor: color || "background.paper",
          borderRadius: 2,
          transition: "transform 0.3s",
          "&:hover": {
            transform: "translateY(-5px)",
            boxShadow: 4,
          },
        }}
      >
        <Typography variant="h6" gutterBottom fontWeight="medium">
          {title}
        </Typography>
        <Typography variant="h3" color="text.primary" fontWeight="bold">
          {value !== undefined && value !== null ? value.toLocaleString() : "0"}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" mt={1}>
            {subtitle}
          </Typography>
        )}
      </Paper>
    );
  };

  if (loading && !refreshing) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "80vh",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6">Loading Dashboard Data...</Typography>
      </Box>
    );
  }

  if (error && !stats) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="contained"
          onClick={fetchDashboardData}
          sx={{ mt: 2 }}
          startIcon={<RefreshIcon />}
        >
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <PageLayout
      title="Anomaly Analytics Dashboard"
      subtitle="Comprehensive view of anomaly data and trends"
      headerAction={
        <Tooltip title={refreshing ? "Refreshing data..." : "Refresh data"}>
          <span>
            <IconButton
              onClick={fetchDashboardData}
              disabled={refreshing}
              color="primary"
            >
              {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </span>
          </Tooltip>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Enhanced notifications with persistence */}
      <Stack
        spacing={1}
        sx={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 2000,
        }}
      >
        {notifications.map(({ id, message, severity }) => (
          <Alert
            key={id}
            severity={severity}
            sx={{
              boxShadow: 4,
              minWidth: 300,
              borderRadius: 1,
            }}
          >
            {message}
          </Alert>
        ))}
      </Stack>

      {stats && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              {renderKPICard(
                "Total Anomalies",
                stats.total_anomalies || 0,
                "Across all systems",
                `${theme.palette.primary.light}20`
              )}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {renderKPICard(
                "Critical Issues",
                stats.severity_distribution?.critical || 0,
                "High priority anomalies",
                `${theme.palette.error.light}20`
              )}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {renderKPICard(
                "Pending Resolution",
                stats.resolution_metrics?.pending_count || 0,
                "Awaiting action",
                `${theme.palette.warning.light}20`
              )}
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              {renderKPICard(
                "Resolution Rate",
                `${(
                  (stats.resolution_metrics?.resolution_rate || 0) * 100
                ).toFixed(1)}%`,
                "Of total anomalies",
                `${theme.palette.success.light}20`
              )}
            </Grid>
          </Grid>

          <Paper sx={{ mb: 3, borderRadius: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: 1,
                borderColor: "divider",
                "& .MuiTab-root": {
                  fontWeight: "medium",
                  fontSize: "0.95rem",
                  textTransform: "none",
                },
              }}
          >
            <Tab label="Overview" />
            <Tab label="Anomaly Types" />
            <Tab label="Trends & Patterns" />
            <Tab label="Model Scanning" />
          </Tabs>

            <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                    {renderPieChart(
                      formatSeverityData(),
                      "Anomalies by Severity"
                    )}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderBarChart(
                  formatSourceData(),
                  "name",
                  "count",
                  "Anomalies by Source"
                )}
              </Grid>
              <Grid item xs={12}>
                {renderBarChart(
                  formatOrganizationData(),
                  "name",
                  "count",
                  "Top Affected Organizations"
                )}
              </Grid>
            </Grid>
          )}

          {activeTab === 1 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                {renderBarChart(
                  formatTypeData(),
                  "name",
                  "count",
                  "Anomalies by Type"
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                {renderPieChart(formatStatusData(), "Anomalies by Status")}
              </Grid>
              {stats.recent_trends && (
                <Grid item xs={12} md={6}>
                  {renderBarChart(
                        Object.entries(
                          stats.recent_trends.last_24h.by_type
                        ).map(([type, count]) => ({
                        name: type,
                        count: count,
                        })),
                    "name",
                    "count",
                    "Anomalies in Last 24 Hours"
                  )}
                </Grid>
              )}
            </Grid>
          )}

          {activeTab === 2 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                    {renderLineChart(
                      formatTrendData(),
                      "Anomaly Detection Trend"
                    )}
              </Grid>
              {stats.monthly_distribution && (
                <Grid item xs={12} md={6}>
                  {renderBarChart(
                    Object.entries(stats.monthly_distribution).map(
                      ([month, count]) => ({
                        name: month,
                        count: count,
                      })
                    ),
                    "name",
                    "count",
                    "Monthly Distribution"
                  )}
                </Grid>
              )}
              {stats.daily_distribution && (
                <Grid item xs={12} md={6}>
                  {renderBarChart(
                    Object.entries(stats.daily_distribution).map(
                      ([day, count]) => ({
                        name: day,
                        count: count,
                      })
                    ),
                    "name",
                    "count",
                    "Daily Distribution"
                  )}
                </Grid>
              )}
            </Grid>
          )}

          {activeTab === 3 && (
            <Grid container spacing={3}>
              {anomalyService.getAvailableModels().map((model) => (
                <Grid item xs={12} sm={6} md={4} key={model.id}>
                  <ModelScanCard
                    model={model}
                    onScan={handleModelScan}
                    scanStatus={scanStatuses[model.id]}
                  />
                </Grid>
              ))}
            </Grid>
          )}
            </Box>
          </Paper>
        </>
      )}
    </PageLayout>
  );
};

export default AnomalyDashboard;
