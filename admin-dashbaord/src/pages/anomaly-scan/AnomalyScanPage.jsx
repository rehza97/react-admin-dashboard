import { useEffect, useState } from "react";
import {
  Typography,
  Box,
  Button,
  Grid,
  CircularProgress,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  Alert,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  Snackbar,
} from "@mui/material";
import PageLayout from "../../components/PageLayout";
import { useTranslation } from "react-i18next";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import StorageIcon from "@mui/icons-material/Storage";
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import anomalyService from "../../services/anomalyService";

const AlertSeverity = {
  SUCCESS: "success",
  ERROR: "error",
  INFO: "info",
  WARNING: "warning",
};

// Data source information for better UI display
const DATA_SOURCES = [
  {
    id: "journal_ventes",
    name: "Journal des Ventes",
    icon: <StorageIcon />,
    description: "Invoice journal data with revenue information",
  },
  {
    id: "etat_facture",
    name: "État de Facture",
    icon: <StorageIcon />,
    description: "Invoice status tracking information",
  },
  {
    id: "parc_corporate",
    name: "Parc Corporate",
    icon: <StorageIcon />,
    description: "Corporate park subscriber data",
  },
  {
    id: "creances_ngbss",
    name: "Créances NGBSS",
    icon: <StorageIcon />,
    description: "NGBSS receivables information",
  },
  {
    id: "ca_periodique",
    name: "CA Périodique",
    icon: <StorageIcon />,
    description: "Periodic revenue data",
  },
  {
    id: "ca_non_periodique",
    name: "CA Non Périodique",
    icon: <StorageIcon />,
    description: "Non-periodic revenue data",
  },
  {
    id: "ca_dnt",
    name: "CA DNT",
    icon: <StorageIcon />,
    description: "DNT revenue data",
  },
  {
    id: "ca_rfd",
    name: "CA RFD",
    icon: <StorageIcon />,
    description: "RFD revenue data",
  },
  {
    id: "ca_cnt",
    name: "CA CNT",
    icon: <StorageIcon />,
    description: "CNT revenue data",
  },
];

const AnomalyScanPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [modelStats, setModelStats] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [selectedModel, setSelectedModel] = useState("");
  const [expanded, setExpanded] = useState({});
  const [scanResults, setScanResults] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: AlertSeverity.SUCCESS,
  });

  const fetchStats = async () => {
    try {
      const response = await anomalyService.getDetailedStatistics();
      setStats(response.statistics);
    } catch (error) {
      console.error("Error fetching stats:", error);
      setSnackbar({
        open: true,
        message: t("anomalyScan.errorFetchingStats"),
        severity: AlertSeverity.ERROR,
      });
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleFullScan = async () => {
    setLoading(true);
    try {
      const results = await anomalyService.runFullScan();
      setScanResults(results);

      const successfulScans = results.filter((r) => r.status === "fulfilled");
      const totalAnomalies = successfulScans.reduce(
        (total, scan) => total + (scan.data?.anomalies?.length || 0),
        0
      );

      setSnackbar({
        open: true,
        message: t("anomalyScan.scanComplete", { count: totalAnomalies }),
        severity: AlertSeverity.SUCCESS,
      });

      await fetchStats();
    } catch (error) {
      console.error("Error during full scan:", error);
      setSnackbar({
        open: true,
        message: t("anomalyScan.errorDuringScan"),
        severity: AlertSeverity.ERROR,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm(t("anomalyScan.confirmBulkDelete"))) {
      try {
        await anomalyService.bulkDeleteAnomalies();
        setSnackbar({
          open: true,
          message: t("anomalyScan.bulkDeleteSuccess"),
          severity: AlertSeverity.SUCCESS,
        });
        await fetchStats();
      } catch (error) {
        console.error("Error during bulk delete:", error);
        setSnackbar({
          open: true,
          message: t("anomalyScan.errorDuringBulkDelete"),
          severity: AlertSeverity.ERROR,
        });
      }
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId === selectedModel ? "" : modelId);
  };

  const toggleExpanded = (modelId, event) => {
    event.stopPropagation();
    setExpanded((prev) => ({
      ...prev,
      [modelId]: !prev[modelId],
    }));
  };

  const getModelAnomalyCounts = () => {
    const counts = {};
    if (stats?.by_data_source) {
      stats.by_data_source.forEach((item) => {
        counts[item.data_source] = item.count;
      });
    }
    return counts;
  };

  const fetchModelStats = async (modelId) => {
    try {
      const response = await anomalyService.getDetailedStatistics();
      const modelData = response.statistics?.by_data_source?.find(
        (item) => item.data_source === modelId
      );

      if (modelData) {
        setModelStats((prev) => ({
          ...prev,
          [modelId]: {
            by_status: {
              open: modelData.open_count || 0,
              resolved: modelData.resolved_count || 0,
            },
            by_type: modelData.anomaly_types || [],
          },
        }));
      }
    } catch (error) {
      console.error(`Error fetching stats for model ${modelId}:`, error);
      setSnackbar({
        open: true,
        message: t("anomalyScan.errorFetchingModelStats"),
        severity: AlertSeverity.ERROR,
      });
    }
  };

  const headerActions = (
    <Box sx={{ display: "flex", gap: 2 }}>
      <Tooltip title={t("anomalyScan.startScan")}>
        <IconButton color="primary" onClick={handleFullScan} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : <SearchIcon />}
        </IconButton>
      </Tooltip>
      <Tooltip title={t("anomalyScan.bulkDelete")}>
        <IconButton
          color="error"
          onClick={handleBulkDelete}
          disabled={loading || !stats?.total_anomalies}
        >
          <DeleteIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );

  const modelAnomalyCounts = getModelAnomalyCounts();

  return (
    <PageLayout
      title={t("common.anomalyScan")}
      subtitle={t("anomalyScan.detectAndAnalyzeAnomalies")}
      headerAction={headerActions}
    >
      <Box sx={{ width: "100%", mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          centered
          variant="fullWidth"
        >
          <Tab
            icon={<WarningAmberIcon />}
            iconPosition="start"
            label={t("anomalyScan.tabs.overview")}
          />
          <Tab
            icon={<StorageIcon />}
            iconPosition="start"
            label={t("anomalyScan.tabs.dataModels")}
          />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      {activeTab === 0 && (
        <Box sx={{ my: 3 }}>
          <Grid container spacing={3}>
            {/* Statistics Cards */}
            <Grid item xs={12} md={6} lg={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t("anomalyScan.totalAnomalies")}
                  </Typography>
                  <Typography variant="h4">
                    {stats?.total_anomalies || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6} lg={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {t("anomalyScan.openAnomalies")}
                  </Typography>
                  <Typography variant="h4">
                    {stats?.by_status?.open || 0}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Recent Scan Results */}
            {scanResults.length > 0 && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {t("anomalyScan.recentScanResults")}
                    </Typography>
                    <Grid container spacing={2}>
                      {scanResults.map((result, index) => (
                        <Grid item xs={12} md={6} lg={4} key={index}>
                          <Alert
                            severity={
                              result.status === "fulfilled"
                                ? "success"
                                : "error"
                            }
                            sx={{ mb: 1 }}
                          >
                            <Typography variant="subtitle2">
                              {t(`anomalyScan.scanTypes.${result.scanType}`)}
                            </Typography>
                            {result.status === "fulfilled" ? (
                              <Typography>
                                {t("anomalyScan.foundAnomalies", {
                                  count: result.data?.anomalies?.length || 0,
                                })}
                              </Typography>
                            ) : (
                              <Typography color="error">
                                {result.error?.message || t("common.error")}
                              </Typography>
                            )}
                          </Alert>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* Models Tab */}
      {activeTab === 1 && (
        <Box sx={{ my: 3 }}>
          <Grid container spacing={3}>
            {DATA_SOURCES.map((model) => (
              <Grid item xs={12} md={6} lg={4} key={model.id}>
                <Card
                  elevation={3}
                  sx={{
                    position: "relative",
                    height: "100%",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      boxShadow: 6,
                    },
                    border: selectedModel === model.id ? "2px solid" : "none",
                    borderColor: "primary.main",
                  }}
                  onClick={() => handleModelSelect(model.id)}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Box sx={{ mr: 1, color: "primary.main" }}>
                          {model.icon}
                        </Box>
                        <Typography variant="h6" component="div">
                          {model.name}
                        </Typography>
                      </Box>

                      <Stack direction="row" spacing={1} alignItems="center">
                        {modelAnomalyCounts[model.id] > 0 && (
                          <Chip
                            label={`${modelAnomalyCounts[model.id]} anomalies`}
                            color="error"
                            size="small"
                          />
                        )}
                        <Tooltip
                          title={expanded[model.id] ? "Show less" : "Show more"}
                        >
                          <IconButton
                            size="small"
                            onClick={(e) => toggleExpanded(model.id, e)}
                          >
                            {expanded[model.id] ? (
                              <ExpandLessIcon />
                            ) : (
                              <ExpandMoreIcon />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      {model.description}
                    </Typography>

                    <Collapse
                      in={expanded[model.id]}
                      timeout="auto"
                      unmountOnExit
                    >
                      <Divider sx={{ my: 2 }} />

                      {modelStats[model.id] ? (
                        <Box sx={{ mt: 2 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Paper
                                sx={{
                                  p: 1.5,
                                  textAlign: "center",
                                  bgcolor: "error.light",
                                  color: "error.contrastText",
                                }}
                              >
                                <Typography variant="h6">
                                  {modelStats[model.id].by_status?.open || 0}
                                </Typography>
                                <Typography variant="caption">Open</Typography>
                              </Paper>
                            </Grid>
                            <Grid item xs={6}>
                              <Paper
                                sx={{
                                  p: 1.5,
                                  textAlign: "center",
                                  bgcolor: "success.light",
                                  color: "success.contrastText",
                                }}
                              >
                                <Typography variant="h6">
                                  {modelStats[model.id].by_status?.resolved ||
                                    0}
                                </Typography>
                                <Typography variant="caption">
                                  Resolved
                                </Typography>
                              </Paper>
                            </Grid>
                          </Grid>

                          {modelStats[model.id].by_type?.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Top Anomaly Types:
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={1}
                                flexWrap="wrap"
                                useFlexGap
                              >
                                {modelStats[model.id].by_type
                                  .slice(0, 3)
                                  .map((type) => (
                                    <Chip
                                      key={type.type}
                                      label={`${
                                        type.type_display || type.type
                                      }: ${type.count}`}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                      sx={{ mb: 1 }}
                                    />
                                  ))}
                              </Stack>
                            </Box>
                          )}
                        </Box>
                      ) : modelAnomalyCounts[model.id] > 0 ? (
                        <Box
                          sx={{
                            mt: 2,
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchModelStats(model.id);
                            }}
                          >
                            Load Details
                          </Button>
                        </Box>
                      ) : (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          No anomalies detected
                        </Alert>
                      )}
                    </Collapse>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default AnomalyScanPage;
