import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import TimelineIcon from "@mui/icons-material/Timeline";
import AssessmentIcon from "@mui/icons-material/Assessment";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import anomalyService from "../services/anomalyService";

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
];

const MODEL_DISPLAY_NAMES = {
  journal_ventes: "Journal des Ventes",
  etat_facture: "État de Facture",
  parc_corporate: "Parc Corporate",
  creances_ngbss: "Créances NGBSS",
  ca_periodique: "CA Périodique",
  ca_non_periodique: "CA Non Périodique",
  ca_dnt: "CA DNT",
  ca_rfd: "CA RFD",
  ca_cnt: "CA CNT",
};

const ModelDetailView = ({ modelId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modelStats, setModelStats] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [showAllAnomalies, setShowAllAnomalies] = useState(false);

  useEffect(() => {
    const fetchModelData = async () => {
      if (!modelId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch model-specific statistics
        const stats = await anomalyService.getAnomalyStats({
          dataSource: modelId,
        });
        setModelStats(stats);

        // Fetch anomalies for this model
        const anomalyData = await anomalyService.getAnomalies({
          dataSource: modelId,
        });
        setAnomalies(anomalyData.results || []);
      } catch (err) {
        console.error(`Error fetching data for model ${modelId}:`, err);
        setError(
          `Failed to load data for ${
            MODEL_DISPLAY_NAMES[modelId] || modelId
          }: ${err.message}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchModelData();
  }, [modelId]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!modelStats) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        No data available for {MODEL_DISPLAY_NAMES[modelId] || modelId}
      </Alert>
    );
  }

  // Create a time series of anomalies by date if available
  const timeSeriesData = modelStats.time_series
    ? modelStats.time_series.map((point) => ({
        date: new Date(point.date).toLocaleDateString(),
        count: point.count,
      }))
    : [];

  // Status distribution chart data
  const statusData = [
    { name: "Open", value: modelStats.by_status?.open || 0 },
    { name: "In Progress", value: modelStats.by_status?.in_progress || 0 },
    { name: "Resolved", value: modelStats.by_status?.resolved || 0 },
    { name: "Ignored", value: modelStats.by_status?.ignored || 0 },
  ];

  // Type distribution chart data
  const typeData = modelStats.by_type
    ? modelStats.by_type.map((item) => ({
        name:
          item.type_display ||
          item.type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        count: item.count,
      }))
    : [];

  // Field distribution chart data (if available)
  const fieldData = modelStats.by_field
    ? modelStats.by_field.map((item) => ({
        name: item.field
          .replace("_", " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        count: item.count,
      }))
    : [];

  return (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <AssessmentIcon sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h5">
            {MODEL_DISPLAY_NAMES[modelId] || modelId} Details
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Summary Cards */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: "center", bgcolor: "#f5f5f5" }}>
                    <Typography variant="h4">
                      {modelStats.total_anomalies || 0}
                    </Typography>
                    <Typography variant="body2">Total Anomalies</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: "center", bgcolor: "#ffebee" }}>
                    <Typography variant="h4">
                      {modelStats.by_status?.open || 0}
                    </Typography>
                    <Typography variant="body2">Open</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: "center", bgcolor: "#fff8e1" }}>
                    <Typography variant="h4">
                      {modelStats.by_status?.in_progress || 0}
                    </Typography>
                    <Typography variant="body2">In Progress</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Paper sx={{ p: 2, textAlign: "center", bgcolor: "#e8f5e9" }}>
                    <Typography variant="h4">
                      {modelStats.by_status?.resolved || 0}
                    </Typography>
                    <Typography variant="body2">Resolved</Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          {/* Time Series Chart (if available) */}
          {timeSeriesData.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <TimelineIcon sx={{ mr: 1, color: "primary.main" }} />
                  <Typography variant="h6">Anomaly Trend</Typography>
                </Box>
                <Box sx={{ height: 300, width: "100%" }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={timeSeriesData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                    >
                      <XAxis
                        dataKey="date"
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#8884d8"
                        name="Anomalies"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Status Distribution & Type Distribution */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: "100%" }}>
              <Typography variant="h6" align="center" gutterBottom>
                Anomalies by Status
              </Typography>
              <Box sx={{ height: 300, width: "100%" }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={statusData.filter((item) => item.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        percent > 0
                          ? `${name}: ${(percent * 100).toFixed(0)}%`
                          : ""
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value} anomalies`, "Count"]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, height: "100%" }}>
              <Typography variant="h6" align="center" gutterBottom>
                Anomalies by Type
              </Typography>
              <Box sx={{ height: 300, width: "100%" }}>
                <ResponsiveContainer>
                  <BarChart
                    data={typeData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 90, bottom: 5 }}
                  >
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#82ca9d" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>

          {/* Field Distribution (if available) */}
          {fieldData.length > 0 && (
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" align="center" gutterBottom>
                  Anomalies by Field
                </Typography>
                <Box sx={{ height: 300, width: "100%" }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={fieldData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
                    >
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" name="Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Recent Anomalies Table */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <WarningAmberIcon sx={{ mr: 1, color: "warning.main" }} />
                  <Typography variant="h6">
                    Recent Anomalies ({anomalies.length})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {anomalies.length > 0 ? (
                  <>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Type</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell>Severity</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {anomalies
                            .slice(0, showAllAnomalies ? undefined : 5)
                            .map((anomaly) => (
                              <TableRow key={anomaly.id}>
                                <TableCell>
                                  {anomaly.type_display ||
                                    anomaly.type
                                      .replace("_", " ")
                                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                                </TableCell>
                                <TableCell>{anomaly.description}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={
                                      anomaly.status_display || anomaly.status
                                    }
                                    color={
                                      anomaly.status === "open"
                                        ? "error"
                                        : anomaly.status === "in_progress"
                                        ? "warning"
                                        : anomaly.status === "resolved"
                                        ? "success"
                                        : "default"
                                    }
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  {new Date(
                                    anomaly.created_at
                                  ).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={anomaly.severity}
                                    color={
                                      anomaly.severity === "high"
                                        ? "error"
                                        : anomaly.severity === "medium"
                                        ? "warning"
                                        : "info"
                                    }
                                    size="small"
                                  />
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {anomalies.length > 5 && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          mt: 2,
                        }}
                      >
                        <Button
                          startIcon={<MoreHorizIcon />}
                          onClick={() => setShowAllAnomalies(!showAllAnomalies)}
                        >
                          {showAllAnomalies
                            ? "Show Less"
                            : `Show All (${anomalies.length})`}
                        </Button>
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    No anomalies found for this model.
                  </Alert>
                )}
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default ModelDetailView;
