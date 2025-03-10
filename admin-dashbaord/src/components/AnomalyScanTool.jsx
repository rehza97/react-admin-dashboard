import { useState, useEffect } from "react";
import {
  Button,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  TextField,
  Alert,
  Box,
  Grid,
  Paper,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  ListItemText,
} from "@mui/material";
import anomalyService from "../services/anomalyService";
import { useTranslation } from "react-i18next";
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
} from "recharts";

const AnomalyScanTool = ({ onScanComplete }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [selectedScanTypes, setSelectedScanTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [anomalyTypes, setAnomalyTypes] = useState([]);
  const [selectedDataSource, setSelectedDataSource] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [thresholdMultiplier, setThresholdMultiplier] = useState(1.5);
  const [dateRange, setDateRange] = useState(null);
  const [success, setSuccess] = useState(null);
  const [anomalyStats, setAnomalyStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
  ];

  const dataSources = [
    { value: "journal_ventes", label: "Journal des Ventes" },
    { value: "etat_facture", label: "État de Facture" },
    { value: "parc_corporate", label: "Parc Corporate" },
    { value: "creances_ngbss", label: "Créances NGBSS" },
    { value: "ca_periodique", label: "CA Périodique" },
    { value: "ca_non_periodique", label: "CA Non Périodique" },
    { value: "ca_dnt", label: "CA DNT" },
    { value: "ca_rfd", label: "CA RFD" },
    { value: "ca_cnt", label: "CA CNT" },
    { value: "all", label: "All Data Sources" },
  ];

  const scanTypes = [
    { value: "empty_cells", label: "Missing Data" },
    { value: "journal_ventes_duplicates", label: "Duplicate Invoices" },
    { value: "revenue_outliers", label: "Revenue Outliers" },
    { value: "journal_etat_mismatches", label: "Invoice/Payment Mismatches" },
    { value: "zero_values", label: "Zero Values" },
    { value: "temporal_patterns", label: "Temporal Patterns" },
  ];

  const handleScanTypeChange = (event) => {
    setSelectedScanTypes(event.target.value);
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  useEffect(() => {
    const fetchAnomalyTypes = async () => {
      try {
        setTypesLoading(true);
        const response = await anomalyService.getAnomalyTypes();
        setAnomalyTypes(response.types || []);
      } catch (error) {
        console.error("Error fetching anomaly types:", error);
        setError(t("anomalyScan.errorFetchingTypes"));
      } finally {
        setTypesLoading(false);
      }
    };

    fetchAnomalyTypes();
    fetchAnomalyStats();
  }, [t]);

  const fetchAnomalyStats = async () => {
    try {
      setStatsLoading(true);
      const stats = await anomalyService.getAnomalyStats();
      setAnomalyStats(stats);
    } catch (error) {
      console.error("Error fetching anomaly statistics:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleScanTrigger = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedDataSource) {
        setError(t("anomalyScan.selectDataSource"));
        setLoading(false);
        return;
      }

      const scanParams = {
        data_source: selectedDataSource,
        scan_types:
          selectedScanTypes.length > 0 ? selectedScanTypes : undefined,
        threshold_multiplier: thresholdMultiplier,
        invoice_id: invoiceId || undefined,
      };

      const result = await anomalyService.triggerAnomalyScan(scanParams);
      setResult(result);

      // Refresh stats after scan
      fetchAnomalyStats();

      setSuccess(t("anomalyScan.scanCompleteSuccess"));

      if (onScanComplete) {
        onScanComplete();
      }
    } catch (error) {
      console.error("Error triggering anomaly scan:", error);
      setError(t("anomalyScan.errorTriggering"));
    } finally {
      setLoading(false);
    }
  };

  const renderStatusChart = () => {
    if (!anomalyStats || !anomalyStats.by_status) return null;

    const data = [
      { name: "Open", value: anomalyStats.by_status.open },
      { name: "In Progress", value: anomalyStats.by_status.in_progress },
      { name: "Resolved", value: anomalyStats.by_status.resolved },
      { name: "Ignored", value: anomalyStats.by_status.ignored },
    ];

    return (
      <Box sx={{ height: 300, width: "100%" }}>
        <Typography variant="h6" align="center" gutterBottom>
          Anomalies by Status
        </Typography>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) =>
                `${name}: ${(percent * 100).toFixed(0)}%`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [`${value} anomalies`, "Count"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  const renderTypeChart = () => {
    if (!anomalyStats || !anomalyStats.by_type) return null;

    const data = anomalyStats.by_type.map((type) => ({
      name: type.type
        .replace("_", " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      count: type.count,
    }));

    return (
      <Box sx={{ height: 300, width: "100%" }}>
        <Typography variant="h6" align="center" gutterBottom>
          Anomalies by Type
        </Typography>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#8884d8" name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  const renderTopInvoices = () => {
    if (
      !anomalyStats ||
      !anomalyStats.top_invoices ||
      anomalyStats.top_invoices.length === 0
    )
      return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Top Invoices with Anomalies
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice Number</TableCell>
                <TableCell align="right">Anomaly Count</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {anomalyStats.top_invoices.map((invoice) => (
                <TableRow key={invoice.invoice_id}>
                  <TableCell component="th" scope="row">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell align="right">{invoice.anomaly_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderRecentAnomalies = () => {
    if (
      !anomalyStats ||
      !anomalyStats.recent_anomalies ||
      anomalyStats.recent_anomalies.length === 0
    )
      return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Anomalies
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Invoice</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {anomalyStats.recent_anomalies.map((anomaly) => (
                <TableRow key={anomaly.id}>
                  <TableCell>{anomaly.type_display}</TableCell>
                  <TableCell>{anomaly.description}</TableCell>
                  <TableCell>
                    <Chip
                      label={anomaly.status_display}
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
                  <TableCell>{anomaly.invoice_number}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          Analyse d'anomalies
        </Typography>

        <Typography variant="body2" color="textSecondary" paragraph>
          Détecter et analyser les anomalies dans vos données pour améliorer la
          qualité et l'intégrité des informations financières.
        </Typography>

        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="Scanner" />
          <Tab label="Statistiques" />
        </Tabs>

        {activeTab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Configuration du scan
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Source de données</InputLabel>
                  <Select
                    value={selectedDataSource}
                    onChange={(e) => setSelectedDataSource(e.target.value)}
                    label="Source de données"
                  >
                    {dataSources.map((source) => (
                      <MenuItem key={source.value} value={source.value}>
                        {source.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Types d'anomalies</InputLabel>
                  <Select
                    multiple
                    value={selectedScanTypes}
                    onChange={handleScanTypeChange}
                    renderValue={(selected) =>
                      selected
                        .map(
                          (value) =>
                            scanTypes.find((type) => type.value === value)
                              ?.label
                        )
                        .join(", ")
                    }
                    label="Types d'anomalies"
                  >
                    {scanTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        <Checkbox
                          checked={selectedScanTypes.indexOf(type.value) > -1}
                        />
                        <ListItemText primary={type.label} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="ID de facture (optionnel)"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  type="number"
                  fullWidth
                  margin="normal"
                  helperText="Laisser vide pour scanner toutes les factures"
                />

                <TextField
                  label="Multiplicateur de seuil"
                  value={thresholdMultiplier}
                  onChange={(e) => setThresholdMultiplier(e.target.value)}
                  type="number"
                  fullWidth
                  margin="normal"
                  inputProps={{ min: 1, step: 0.1 }}
                  helperText="Utilisé pour détecter les valeurs aberrantes (1.5 = modéré, 3.0 = extrême)"
                />

                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleScanTrigger}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  {loading ? "Scan en cours..." : "Démarrer le scan"}
                </Button>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: "100%" }}>
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}

                {success && (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    {success}
                  </Alert>
                )}

                {result ? (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Résultats du scan
                    </Typography>

                    <Box
                      sx={{
                        mb: 2,
                        p: 2,
                        bgcolor: "background.paper",
                        borderRadius: 1,
                      }}
                    >
                      <Typography variant="body1">
                        <strong>Anomalies détectées:</strong>{" "}
                        {result.anomaly_count}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Temps d'exécution:</strong>{" "}
                        {result.execution_time_seconds?.toFixed(2)} secondes
                      </Typography>
                      <Typography variant="body1">
                        <strong>Date du scan:</strong>{" "}
                        {result.scan_date &&
                          new Date(result.scan_date).toLocaleString()}
                      </Typography>
                    </Box>

                    {result.anomalies && result.anomalies.length > 0 && (
                      <Box>
                        <Typography variant="subtitle1" gutterBottom>
                          Anomalies récemment détectées:
                        </Typography>

                        <TableContainer
                          component={Paper}
                          sx={{ maxHeight: 300 }}
                        >
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>Type</TableCell>
                                <TableCell>Description</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {result.anomalies.map((anomaly, index) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    {anomaly.type_display || anomaly.type}
                                  </TableCell>
                                  <TableCell>{anomaly.description}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                    }}
                  >
                    <Typography
                      variant="body1"
                      color="textSecondary"
                      align="center"
                    >
                      Configurez et lancez un scan pour détecter les anomalies
                      dans vos données.
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        )}

        {activeTab === 1 && (
          <Box>
            {statsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                <CircularProgress />
              </Box>
            ) : anomalyStats ? (
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Vue d'ensemble
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={3}>
                        <Paper
                          sx={{ p: 2, textAlign: "center", bgcolor: "#f5f5f5" }}
                        >
                          <Typography variant="h4">
                            {anomalyStats.total_anomalies}
                          </Typography>
                          <Typography variant="body2">
                            Anomalies totales
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Paper
                          sx={{ p: 2, textAlign: "center", bgcolor: "#ffebee" }}
                        >
                          <Typography variant="h4">
                            {anomalyStats.by_status?.open || 0}
                          </Typography>
                          <Typography variant="body2">
                            Anomalies ouvertes
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Paper
                          sx={{ p: 2, textAlign: "center", bgcolor: "#fff8e1" }}
                        >
                          <Typography variant="h4">
                            {anomalyStats.by_status?.in_progress || 0}
                          </Typography>
                          <Typography variant="body2">En cours</Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <Paper
                          sx={{ p: 2, textAlign: "center", bgcolor: "#e8f5e9" }}
                        >
                          <Typography variant="h4">
                            {anomalyStats.by_status?.resolved || 0}
                          </Typography>
                          <Typography variant="body2">Résolues</Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>{renderStatusChart()}</Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>{renderTypeChart()}</Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>{renderTopInvoices()}</Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>{renderRecentAnomalies()}</Paper>
                </Grid>
              </Grid>
            ) : (
              <Alert severity="info">
                Aucune statistique d'anomalie disponible. Lancez un scan pour
                générer des données.
              </Alert>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AnomalyScanTool;
