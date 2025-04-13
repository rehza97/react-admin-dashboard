import React, { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListItemText,
  Checkbox,
  OutlinedInput,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Card,
  CardContent,
  Tooltip,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import PageLayout from "../../components/PageLayout";
import kpiService from "../../services/kpiService";
import { exportPeriodicRevenue } from "../../services/exportService";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import CancelIcon from "@mui/icons-material/Cancel";
import InfoIcon from "@mui/icons-material/Info";
import { useTranslation } from "react-i18next";

// Constants
const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];
const COMPONENT_COLORS = {
  dnt: "#FF8042", // Adjustments - Orange
  rfd: "#FFBB28", // Reimbursements - Yellow
  cnt: "#00C49F", // Cancellations - Green
  main: "#0088FE", // Main Periodic - Blue
};

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const RevenuePeriodicPage = () => {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Tab navigation
  const [activeTab, setActiveTab] = useState("overview");

  // Filter states
  const [dots, setDots] = useState([]);
  const [products, setProducts] = useState([]);
  const [operations, setOperations] = useState([]);

  // Selected filter values
  const [selectedDots, setSelectedDots] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedOperations, setSelectedOperations] = useState([]);

  // Detailed entity data
  const [entityData, setEntityData] = useState({
    components: [],
    products: [],
    operations: [],
  });

  // Fetch filter options
  const fetchFilterOptions = async () => {
    try {
      // Fetch data to get DOT, product, and operation options
      const initialData = await kpiService.getPeriodicRevenueKPIs();

      // Extract unique DOTs if available
      if (initialData?.by_dot) {
        const uniqueDots = Object.keys(initialData.by_dot);
        setDots(uniqueDots.filter(Boolean));
      }

      // Extract unique products from by_product
      if (initialData?.by_product) {
        const uniqueProducts = Array.from(
          new Set(initialData.by_product.map((item) => item.product))
        );
        setProducts(uniqueProducts.filter(Boolean));
      }

      // Extract unique operations
      if (initialData?.by_operation) {
        const uniqueOperations = Array.from(
          new Set(initialData.by_operation.map((item) => item.operation))
        );
        setOperations(uniqueOperations.filter(Boolean));
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  // Generate detailed entity data
  const generateDetailedEntityData = (data) => {
    // Generate component breakdown (Main, DNT, RFD, CNT)
    const componentsData = [
      {
        name: "C.A Périodique (Main)",
        value: data?.main_periodic || 0,
        color: COMPONENT_COLORS.main,
      },
      {
        name: "C.A DNT (Ajustement)",
        value: data?.dnt || 0,
        color: COMPONENT_COLORS.dnt,
      },
      {
        name: "C.A RFD (Remboursement)",
        value: data?.rfd || 0,
        color: COMPONENT_COLORS.rfd,
      },
      {
        name: "C.A CNT (Annulation)",
        value: data?.cnt || 0,
        color: COMPONENT_COLORS.cnt,
      },
    ].filter((item) => item.value !== 0);

    // Generate product performance data
    const productData =
      data?.by_product?.map((product) => ({
        product: product.product,
        totalRevenue: product.total, // C.A TTC
        preTax: product.pre_tax, // C.A HT
        tax: product.tax, // TVA
        percentageOfTotal: (product.pre_tax / (data.pre_tax || 1)) * 100, // Calculate percentage of total C.A HT
      })) || [];

    // Generate operation performance data
    const operationData =
      data?.by_operation?.map((operation) => ({
        operation: operation.operation,
        totalRevenue: operation.total, // C.A TTC
        preTax: operation.pre_tax, // C.A HT
        tax: operation.tax, // TVA
        percentageOfTotal: (operation.pre_tax / (data.pre_tax || 1)) * 100, // Calculate percentage of total C.A HT
      })) || [];

    return {
      components: componentsData,
      products: productData,
      operations: operationData,
    };
  };

  // Fetch data with filters
  const fetchData = async () => {
    setLoading(true);
    try {
      // Prepare filters
      const filters = {
        dot: selectedDots.length > 0 ? selectedDots : undefined,
        product: selectedProducts.length > 0 ? selectedProducts : undefined,
        operation:
          selectedOperations.length > 0 ? selectedOperations : undefined,
      };

      console.log("Fetching with filters:", filters);
      const response = await kpiService.getPeriodicRevenueKPIs(filters);
      setData(response);

      // Generate detailed entity data
      setEntityData(generateDetailedEntityData(response));
    } catch (err) {
      setError("Failed to fetch KPI data");
      console.error("Error fetching KPI data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Handle export button click
  const handleExport = async (format) => {
    setExportLoading(true);
    setSnackbar({
      open: true,
      message: t("revenuePeriodic.export.startingExport"),
      severity: "info",
    });

    try {
      // Create filters object from all selected filters
      const filters = {
        dot: Array.from(selectedDots),
        product: Array.from(selectedProducts),
        operation: Array.from(selectedOperations),
      };

      // Call the exportService function
      await exportPeriodicRevenue(format, filters);

      setSnackbar({
        open: true,
        message: t("revenuePeriodic.export.exportSuccess"),
        severity: "success",
      });
    } catch (error) {
      console.error("Export error:", error);
      setSnackbar({
        open: true,
        message:
          t("revenuePeriodic.export.exportFailed") +
          (error.message || t("common.error")),
        severity: "error",
      });
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    // Fetch filter options when component mounts
    fetchFilterOptions();

    // Initial data fetch without filters
    fetchData();
  }, []);

  // Handle filter changes
  const handleDotChange = (event) => {
    const value = event.target.value;
    setSelectedDots(typeof value === "string" ? value.split(",") : value);
  };

  const handleProductChange = (event) => {
    const value = event.target.value;
    setSelectedProducts(typeof value === "string" ? value.split(",") : value);
  };

  const handleOperationChange = (event) => {
    const value = event.target.value;
    setSelectedOperations(typeof value === "string" ? value.split(",") : value);
  };

  // Handle closing the snackbar
  const handleCloseSnackbar = () => {
    setSnackbar({
      ...snackbar,
      open: false,
    });
  };

  // Ensure snackbar severity is a valid value
  const getValidSeverity = (severity) => {
    const validSeverities = ["success", "error", "warning", "info"];
    return validSeverities.includes(severity) ? severity : "info";
  };

  // Format currency with 2 decimal places
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return "N/A";
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Format percentage with 2 decimal places
  const formatPercentage = (value) => {
    if (value === undefined || value === null) return "N/A";
    return `${value.toFixed(2)}%`;
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  // Periodic revenue component breakdown
  const renderComponentBreakdown = () => {
    if (!entityData?.components?.length) return null;

    return (
      <Paper elevation={3} sx={{ p: 3, mb: 3, height: "100%" }}>
        <Box
          sx={{
            mb: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6">
            Répartition des Composantes C.A Périodique
          </Typography>
          <Tooltip title="C.A Périodique = C.A Périodique (Main) + C.A DNT (Ajustement) + C.A RFD (Remboursement) + C.A CNT (Annulation)">
            <IconButton size="small">
              <InfoIcon />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={entityData.components}
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
                {entityData.components.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Legend />
              <RechartsTooltip
                formatter={(value) => [formatCurrency(value), "Montant"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      </Paper>
    );
  };

  // Render KPI cards for the overview
  const renderKPICards = () => {
    if (!data) return null;

    const totalRevenue = data?.total || 0;
    const periodicRevenue = data?.main_periodic || 0;
    const dntRevenue = data?.dnt || 0;
    const rfdRevenue = data?.rfd || 0;
    const cntRevenue = data?.cnt || 0;

    // Ensure we don't divide by zero
    const periodicPercentage = totalRevenue
      ? (periodicRevenue / totalRevenue) * 100
      : 0;
    const dntPercentage = totalRevenue ? (dntRevenue / totalRevenue) * 100 : 0;
    const rfdPercentage = totalRevenue ? (rfdRevenue / totalRevenue) * 100 : 0;
    const cntPercentage = totalRevenue ? (cntRevenue / totalRevenue) * 100 : 0;

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6} lg={3}>
          <Card
            elevation={3}
            sx={{ borderTop: 5, borderColor: COMPONENT_COLORS.main }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                C.A Périodique Total
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {formatCurrency(totalRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total de tous les composants (Main + DNT + RFD + CNT)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} lg={3}>
          <Card
            elevation={3}
            sx={{ borderTop: 5, borderColor: COMPONENT_COLORS.main }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                C.A Périodique (Main)
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {formatCurrency(periodicRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPercentage(periodicPercentage)} du total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} lg={2}>
          <Card
            elevation={3}
            sx={{ borderTop: 5, borderColor: COMPONENT_COLORS.dnt }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                C.A DNT (Ajustement)
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {formatCurrency(dntRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPercentage(dntPercentage)} du total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} lg={2}>
          <Card
            elevation={3}
            sx={{ borderTop: 5, borderColor: COMPONENT_COLORS.rfd }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                C.A RFD (Remboursement)
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {formatCurrency(rfdRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPercentage(rfdPercentage)} du total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6} lg={2}>
          <Card
            elevation={3}
            sx={{ borderTop: 5, borderColor: COMPONENT_COLORS.cnt }}
          >
            <CardContent>
              <Typography variant="h6" gutterBottom>
                C.A CNT (Annulation)
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {formatCurrency(cntRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPercentage(cntPercentage)} du total
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render product table for the Product tab
  const renderProductTable = () => {
    if (!entityData?.products?.length) return null;

    return (
      <TableContainer component={Paper} elevation={3} sx={{ mb: 3 }}>
        <Table aria-label="product data table">
          <TableHead>
            <TableRow>
              <TableCell>Produit</TableCell>
              <TableCell align="right">C.A HT</TableCell>
              <TableCell align="right">TVA</TableCell>
              <TableCell align="right">C.A TTC</TableCell>
              <TableCell align="right">% du Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entityData.products.map((product, index) => (
              <TableRow key={index} hover>
                <TableCell component="th" scope="row">
                  {product.product}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(product.preTax)}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(product.tax)}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(product.totalRevenue)}
                </TableCell>
                <TableCell align="right">
                  {formatPercentage(product.percentageOfTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Render operation table
  const renderOperationTable = () => {
    if (!entityData?.operations?.length) return null;

    return (
      <TableContainer component={Paper} elevation={3} sx={{ mb: 3 }}>
        <Table aria-label="operation data table">
          <TableHead>
            <TableRow>
              <TableCell>Opération</TableCell>
              <TableCell align="right">C.A HT</TableCell>
              <TableCell align="right">TVA</TableCell>
              <TableCell align="right">C.A TTC</TableCell>
              <TableCell align="right">% du Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entityData.operations.map((operation, index) => (
              <TableRow key={index} hover>
                <TableCell component="th" scope="row">
                  {operation.operation}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(operation.preTax)}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(operation.tax)}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(operation.totalRevenue)}
                </TableCell>
                <TableCell align="right">
                  {formatPercentage(operation.percentageOfTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  // Processing explanation card
  const renderProcessingExplanation = () => {
    return (
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Traitement des Données C.A Périodique
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Composition
          </Typography>
          <Typography variant="body1">
            C.A Périodique = C.A Périodique + C.A DNT + C.A RFD + C.A CNT
          </Typography>
          <Typography variant="body2" color="text.secondary">
            (DNT = Ajustement, RFD = Remboursement, CNT = Annulation)
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Filtre de Données
          </Typography>
          <Typography variant="body1">
            Filtre par DOT, Produit, Opération
          </Typography>
          <Typography variant="body2" color="text.secondary">
            (18 fichiers Périodique, CNT, RFD, DNT)
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Exportation
          </Typography>
          <Typography variant="body1">
            Exportation de 4 fichiers: 18 Fichiers Périodique en 1 seul fichier
            + fichier RFD + fichier CNT + fichier DNT
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Traitement des 18 fichiers Périodique
          </Typography>
          <Typography variant="body1">
            Colonne DO on prend siège + le reste Colonne Produit on prend LTE,
            Specialized Line et X25
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Traitement fichier RFD, CNT et DNT
          </Typography>
          <Typography variant="body1">
            Colonne DOT: Siège, Colonne DEPARTEMENT: Direction Commerciale
            Corporate, Colonne CUST_LEV2: tout sauf 302
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight="bold">
            Identifiants de Produit
          </Typography>
          <Typography variant="body1">
            Une fois les fichiers RFD, CNT et DNT traités, Colonne PRI_IDENTITY:
            A = ADSL, F = FTTX, LS = Specialized Line, PART = Specialized Line
          </Typography>
        </Box>
      </Paper>
    );
  };

  if (loading) {
    return (
      <PageLayout
        title="C.A Périodique"
        subtitle="Analyse des revenus périodiques"
        headerAction={null}
      >
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout
        title="C.A Périodique"
        subtitle="Analyse des revenus périodiques"
        headerAction={null}
      >
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <Typography color="error">{error}</Typography>
        </Box>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="C.A Périodique"
      subtitle="Analyse des revenus périodiques"
      headerAction={null}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
        {/* DOT filter */}
        <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
          <InputLabel id="dot-filter-label">DOT</InputLabel>
          <Select
            labelId="dot-filter-label"
            id="dot-filter"
            multiple
            value={selectedDots}
            onChange={handleDotChange}
            input={<OutlinedInput label="DOT" />}
            renderValue={(selected) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {dots.map((dot) => (
              <MenuItem key={dot} value={dot}>
                <Checkbox checked={selectedDots.indexOf(dot) > -1} />
                <ListItemText primary={dot} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Product filter */}
        <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
          <InputLabel id="product-filter-label">Produit</InputLabel>
          <Select
            labelId="product-filter-label"
            id="product-filter"
            multiple
            value={selectedProducts}
            onChange={handleProductChange}
            input={<OutlinedInput label="Produit" />}
            renderValue={(selected) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {products.map((product) => (
              <MenuItem key={product} value={product}>
                <Checkbox checked={selectedProducts.indexOf(product) > -1} />
                <ListItemText primary={product} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Operation filter */}
        <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
          <InputLabel id="operation-filter-label">Opération</InputLabel>
          <Select
            labelId="operation-filter-label"
            id="operation-filter"
            multiple
            value={selectedOperations}
            onChange={handleOperationChange}
            input={<OutlinedInput label="Opération" />}
            renderValue={(selected) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} size="small" />
                ))}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {operations.map((operation) => (
              <MenuItem key={operation} value={operation}>
                <Checkbox
                  checked={selectedOperations.indexOf(operation) > -1}
                />
                <ListItemText primary={operation} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Actions */}
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchData()}
            disabled={loading}
            size="medium"
          >
            Appliquer Filtres
          </Button>

          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => {
              setSelectedDots([]);
              setSelectedProducts([]);
              setSelectedOperations([]);
              fetchData();
            }}
            disabled={loading}
            size="medium"
          >
            Réinitialiser Filtres
          </Button>
        </Box>
      </Box>

      {/* Export buttons */}
      <Box sx={{ mb: 3, display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<FileDownloadIcon />}
          onClick={() => handleExport("csv")}
          disabled={exportLoading}
        >
          Exporter CSV
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<FileDownloadIcon />}
          onClick={() => handleExport("excel")}
          disabled={exportLoading}
        >
          Exporter Excel
        </Button>
      </Box>

      {/* Tab navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          textColor="primary"
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="overview" label="Aperçu" />
          <Tab value="products" label="Produits" />
          <Tab value="operations" label="Opérations" />
          <Tab value="processing" label="Traitement" />
        </Tabs>
      </Paper>

      {/* Tab content */}
      {activeTab === "overview" && (
        <>
          {renderKPICards()}

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              {renderComponentBreakdown()}
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper elevation={3} sx={{ p: 3, mb: 3, height: "100%" }}>
                <Typography variant="h6" gutterBottom>
                  Revenus par DOT
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(data?.by_dot || {}).map(
                        ([key, value]) => ({
                          name: key,
                          value: value,
                        })
                      )}
                      margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis />
                      <RechartsTooltip
                        formatter={(value) => [
                          formatCurrency(value),
                          "Montant",
                        ]}
                      />
                      <Bar
                        dataKey="value"
                        fill={COMPONENT_COLORS.main}
                        name="Montant"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}

      {activeTab === "products" && (
        <>
          {renderProductTable()}

          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Répartition par Produit
            </Typography>
            <Box sx={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={entityData.products}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="product"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis />
                  <RechartsTooltip
                    formatter={(value) => [formatCurrency(value), "Montant"]}
                  />
                  <Legend />
                  <Bar
                    dataKey="preTax"
                    fill={COMPONENT_COLORS.main}
                    name="C.A HT"
                  />
                  <Bar dataKey="tax" fill={COMPONENT_COLORS.dnt} name="TVA" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </>
      )}

      {activeTab === "operations" && (
        <>
          {renderOperationTable()}

          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Répartition par Opération
            </Typography>
            <Box sx={{ height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={entityData.operations}
                  margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="operation"
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis />
                  <RechartsTooltip
                    formatter={(value) => [formatCurrency(value), "Montant"]}
                  />
                  <Legend />
                  <Bar
                    dataKey="preTax"
                    fill={COMPONENT_COLORS.main}
                    name="C.A HT"
                  />
                  <Bar dataKey="tax" fill={COMPONENT_COLORS.dnt} name="TVA" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </>
      )}

      {activeTab === "processing" && renderProcessingExplanation()}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={getValidSeverity(snackbar.severity)}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default RevenuePeriodicPage;
