import { useState, useEffect } from "react";
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
} from "recharts";
import PageLayout from "../../components/PageLayout";
import kpiService from "../../services/kpiService";
import { exportPeriodicRevenue } from "../../services/exportService";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
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
  const { t, i18n } = useTranslation();
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

      // Fetch DOTs directly from the service
      const dotsData = await kpiService.getDots();
      if (dotsData && dotsData.length > 0) {
        // Set the dots array with the formatted data
        setDots(dotsData);
        console.log("Fetched DOTs:", dotsData);
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
        name: t("revenuePeriodic.components.main"),
        value: data?.main_periodic || 0,
        color: COMPONENT_COLORS.main,
      },
      {
        name: t("revenuePeriodic.components.dnt"),
        value: data?.dnt || 0,
        color: COMPONENT_COLORS.dnt,
      },
      {
        name: t("revenuePeriodic.components.rfd"),
        value: data?.rfd || 0,
        color: COMPONENT_COLORS.rfd,
      },
      {
        name: t("revenuePeriodic.components.cnt"),
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

      // Log applied filters for debugging
      console.log("Applied filters:", {
        dots: selectedDots.map((dotId) => {
          const dot = dots.find((d) => d.id === dotId);
          return dot ? `${dot.name} (${dotId})` : dotId;
        }),
        products: selectedProducts,
        operations: selectedOperations,
      });
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
        dot: Array.from(selectedDots), // These are already DOT IDs
        product: Array.from(selectedProducts),
        operation: Array.from(selectedOperations),
      };

      console.log("Exporting with filters:", filters);

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

  // Format currency according to the current language
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return "-";

    // Get locale based on current language
    const locale = i18n.language === "fr" ? "fr-DZ" : "en-US";

    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "DZD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage according to the current language
  const formatPercentage = (value) => {
    if (value === undefined || value === null) return "-";
    const locale = i18n.language === "fr" ? "fr-FR" : "en-US";
    return `${new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    }).format(value)}%`;
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
            {t("revenuePeriodic.charts.componentBreakdown")}
          </Typography>
          <Tooltip title={t("revenuePeriodic.charts.componentBreakdownInfo")}>
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
                {t("revenuePeriodic.cards.totalRevenue")}
              </Typography>
              <Typography variant="h6" component="div" fontWeight="bold">
                {formatCurrency(totalRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("revenuePeriodic.cards.totalRevenueDescription")}
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
                {t("revenuePeriodic.cards.periodicRevenue")}
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold">
                {formatCurrency(periodicRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPercentage(periodicPercentage)}{" "}
                {t("revenuePeriodic.cards.ofTotal")}
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
                {t("revenuePeriodic.cards.dntRevenue")}
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold">
                {formatCurrency(dntRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPercentage(dntPercentage)}{" "}
                {t("revenuePeriodic.cards.ofTotal")}
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
                {t("revenuePeriodic.cards.rfdRevenue")}
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold">
                {formatCurrency(rfdRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPercentage(rfdPercentage)}{" "}
                {t("revenuePeriodic.cards.ofTotal")}
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
                {t("revenuePeriodic.cards.cntRevenue")}
              </Typography>
              <Typography variant="h5" component="div" fontWeight="bold">
                {formatCurrency(cntRevenue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatPercentage(cntPercentage)}{" "}
                {t("revenuePeriodic.cards.ofTotal")}
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
              <TableCell>{t("revenuePeriodic.tables.product")}</TableCell>
              <TableCell align="right">
                {t("revenuePeriodic.tables.preTax")}
              </TableCell>
              <TableCell align="right">
                {t("revenuePeriodic.tables.tax")}
              </TableCell>
              <TableCell align="right">
                {t("revenuePeriodic.tables.totalRevenue")}
              </TableCell>
              <TableCell align="right">
                {t("revenuePeriodic.tables.percentageOfTotal")}
              </TableCell>
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
              <TableCell>{t("revenuePeriodic.tables.operation")}</TableCell>
              <TableCell align="right">
                {t("revenuePeriodic.tables.preTax")}
              </TableCell>
              <TableCell align="right">
                {t("revenuePeriodic.tables.tax")}
              </TableCell>
              <TableCell align="right">
                {t("revenuePeriodic.tables.totalRevenue")}
              </TableCell>
              <TableCell align="right">
                {t("revenuePeriodic.tables.percentageOfTotal")}
              </TableCell>
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
          {t("revenuePeriodic.processing.title")}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {t("revenuePeriodic.processing.composition")}
          </Typography>
          <Typography variant="body1">
            {t("revenuePeriodic.processing.compositionDescription")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("revenuePeriodic.processing.componentDescription")}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {t("revenuePeriodic.processing.dataFilter")}
          </Typography>
          <Typography variant="body1">
            {t("revenuePeriodic.processing.dataFilterDescription")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("revenuePeriodic.processing.filesDescription")}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {t("common.export")}
          </Typography>
          <Typography variant="body1">
            {t("revenuePeriodic.processing.exportation")}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {t("revenuePeriodic.processing.periodicFilesProcessing")}
          </Typography>
          <Typography variant="body1">
            {t("revenuePeriodic.processing.periodicFilesDescription")}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {t("revenuePeriodic.processing.rfdCntDntProcessing")}
          </Typography>
          <Typography variant="body1">
            {t("revenuePeriodic.processing.rfdCntDntDescription")}
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight="bold">
            {t("revenuePeriodic.processing.productIdentifiers")}
          </Typography>
          <Typography variant="body1">
            {t("revenuePeriodic.processing.productIdentifiersDescription")}
          </Typography>
        </Box>
      </Paper>
    );
  };

  // Create header actions with export buttons
  const headerAction = (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Button
        variant="outlined"
        startIcon={<FileDownloadIcon />}
        onClick={() => handleExport("excel")}
        disabled={exportLoading || loading}
        size="small"
      >
        {t("revenuePeriodic.export.excel")}
      </Button>
      <Button
        variant="outlined"
        startIcon={<FileDownloadIcon />}
        onClick={() => handleExport("csv")}
        disabled={exportLoading || loading}
        size="small"
      >
        {t("revenuePeriodic.export.csv")}
      </Button>
    </Box>
  );

  if (loading) {
    return (
      <PageLayout
        title={t("revenuePeriodic.title")}
        subtitle={t("revenuePeriodic.subtitle")}
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
        title={t("revenuePeriodic.title")}
        subtitle={t("revenuePeriodic.subtitle")}
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
      title={t("revenuePeriodic.title")}
      subtitle={t("revenuePeriodic.subtitle")}
      headerAction={headerAction}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
        {/* DOT filter */}
        <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
          <InputLabel id="dot-filter-label">
            {t("revenuePeriodic.filters.dot")}
          </InputLabel>
          <Select
            labelId="dot-filter-label"
            id="dot-filter"
            multiple
            value={selectedDots}
            onChange={handleDotChange}
            input={<OutlinedInput label={t("revenuePeriodic.filters.dot")} />}
            renderValue={(selected) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selected.map((value) => {
                  // Find the DOT object to get its name for display
                  const dotObj = dots.find((d) => d.id === value);
                  return (
                    <Chip
                      key={value}
                      label={dotObj ? dotObj.name : value}
                      size="small"
                    />
                  );
                })}
              </Box>
            )}
            MenuProps={MenuProps}
          >
            {dots.map((dot) => (
              <MenuItem key={dot.id} value={dot.id}>
                <Checkbox checked={selectedDots.indexOf(dot.id) > -1} />
                <ListItemText primary={dot.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Product filter */}
        <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
          <InputLabel id="product-filter-label">
            {t("revenuePeriodic.filters.product")}
          </InputLabel>
          <Select
            labelId="product-filter-label"
            id="product-filter"
            multiple
            value={selectedProducts}
            onChange={handleProductChange}
            input={
              <OutlinedInput label={t("revenuePeriodic.filters.product")} />
            }
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
          <InputLabel id="operation-filter-label">
            {t("revenuePeriodic.filters.operation")}
          </InputLabel>
          <Select
            labelId="operation-filter-label"
            id="operation-filter"
            multiple
            value={selectedOperations}
            onChange={handleOperationChange}
            input={
              <OutlinedInput label={t("revenuePeriodic.filters.operation")} />
            }
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
            {t("revenuePeriodic.filters.apply")}
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
            {t("revenuePeriodic.filters.reset")}
          </Button>
        </Box>
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
          <Tab value="overview" label={t("revenuePeriodic.tabs.overview")} />
          <Tab value="products" label={t("revenuePeriodic.tabs.products")} />
          <Tab
            value="operations"
            label={t("revenuePeriodic.tabs.operations")}
          />
          <Tab
            value="processing"
            label={t("revenuePeriodic.tabs.processing")}
          />
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
                  {t("revenuePeriodic.charts.revenueByDOT")}
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={Object.entries(data?.by_dot || {}).map(
                        ([key, value]) => {
                          // Find the DOT object to get the name
                          const dotObj = dots.find((d) => d.id === key);
                          return {
                            id: key,
                            name: dotObj ? dotObj.name : `DOT ${key}`,
                            value: value,
                          };
                        }
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
              {t("revenuePeriodic.charts.revenueByProduct")}
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
              {t("revenuePeriodic.charts.revenueByOperation")}
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
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default RevenuePeriodicPage;
