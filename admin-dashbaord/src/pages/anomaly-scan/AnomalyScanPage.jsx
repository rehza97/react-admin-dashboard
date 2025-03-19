import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import AnomalyScanTool from "../../components/AnomalyScanTool";
import ModelDetailView from "../../components/ModelDetailView";
import PageLayout from "../../components/PageLayout";
import { useTranslation } from "react-i18next";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import StorageIcon from "@mui/icons-material/Storage";
import anomalyService from "../../services/anomalyService";

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
  const [statsLoading, setStatsLoading] = useState(true);
  const [anomalyStats, setAnomalyStats] = useState(null);
  const [modelStats, setModelStats] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [selectedModel, setSelectedModel] = useState("");
  const [expanded, setExpanded] = useState({}); // Track expanded state for each model
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Handle model selection for detailed view
  const handleModelSelect = (modelId) => {
    setSelectedModel(modelId === selectedModel ? "" : modelId);
  };

  // Toggle expansion for a model card
  const toggleExpanded = (modelId) => {
    setExpanded((prev) => ({
      ...prev,
      [modelId]: !prev[modelId],
    }));
  };

  // Calculate anomaly counts for each model from statistics
  const getModelAnomalyCounts = () => {
    const counts = {};

    if (anomalyStats && anomalyStats.by_data_source) {
      anomalyStats.by_data_source.forEach((item) => {
        counts[item.data_source] = item.count;
      });
    }

    return counts;
  };

  // Get model-specific statistics
  const fetchModelStats = async (modelId) => {
    try {
      const stats = await anomalyService.getAnomalyStats({
        dataSource: modelId,
      });
      setModelStats((prev) => ({
        ...prev,
        [modelId]: stats,
      }));
    } catch (error) {
      console.error(`Error fetching stats for model ${modelId}:`, error);
    }
  };

  // Refresh data
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    const fetchAnomalyStats = async () => {
      try {
        setStatsLoading(true);
        const stats = await anomalyService.getAnomalyStats();
        setAnomalyStats(stats);

        // Expand models with anomalies by default
        if (stats && stats.by_data_source) {
          const initialExpanded = {};
          stats.by_data_source.forEach((item) => {
            if (item.count > 0) {
              initialExpanded[item.data_source] = true;
            }
          });
          setExpanded(initialExpanded);
        }
      } catch (error) {
        console.error("Error fetching anomaly stats:", error);
        setSnackbar({
          open: true,
          message: t("anomalyScan.errorFetchingStats"),
          severity: "error",
        });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchAnomalyStats();
  }, [t, refreshTrigger]);

  // Update model statistics when needed
  useEffect(() => {
    if (selectedModel) {
      fetchModelStats(selectedModel);
    }
  }, [selectedModel]);

  const headerAction = (
    <Button
      variant="contained"
      color="primary"
      startIcon={<RefreshIcon />}
      onClick={handleRefresh}
      disabled={statsLoading}
    >
      {statsLoading ? "Refreshing..." : t("common.refresh")}
    </Button>
  );

  // Calculate model anomaly counts
  const modelAnomalyCounts = getModelAnomalyCounts();

  return (
    <PageLayout
      title={t("common.anomalyScan")}
      subtitle={t("anomalyScan.detectAndAnalyzeAnomalies")}
      headerAction={headerAction}
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
            label="Anomaly Overview"
          />
          <Tab
            icon={<StorageIcon />}
            iconPosition="start"
            label="Data Models"
          />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      {activeTab === 0 && (
        <Box sx={{ my: 3 }}>
          <AnomalyScanTool onScanComplete={handleRefresh} />
        </Box>
      )}

      {/* Models Tab */}
      {activeTab === 1 && (
        <Box sx={{ my: 3 }}>
          {statsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
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
                              label={`${
                                modelAnomalyCounts[model.id]
                              } anomalies`}
                              color="error"
                              size="small"
                            />
                          )}
                          <Tooltip
                            title={
                              expanded[model.id] ? "Show less" : "Show more"
                            }
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpanded(model.id);
                              }}
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
                                  <Typography variant="caption">
                                    Open
                                  </Typography>
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

                            {modelStats[model.id].by_type &&
                              modelStats[model.id].by_type.length > 0 && (
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
          )}

          {/* Show detailed model view when a model is selected */}
          {selectedModel && (
            <Box sx={{ mt: 4 }}>
              <ModelDetailView modelId={selectedModel} />
            </Box>
          )}
        </Box>
      )}
    </PageLayout>
  );
};

export default AnomalyScanPage;
