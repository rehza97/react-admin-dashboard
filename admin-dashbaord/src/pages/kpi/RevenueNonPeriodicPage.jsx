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
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { LineChart, Line } from "recharts";
import { PieChart, Pie, Cell } from "recharts";
import PageLayout from "../../components/PageLayout";
import kpiService from "../../services/kpiService";
import { exportNonPeriodicRevenue } from "../../services/exportService";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import CancelIcon from "@mui/icons-material/Cancel";
import { useTranslation } from "react-i18next";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

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

const RevenueNonPeriodicPage = () => {
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
  const [saleTypes, setSaleTypes] = useState([]);
  const [channels, setChannels] = useState([]);

  // Selected filter values
  const [selectedDots, setSelectedDots] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [selectedSaleTypes, setSelectedSaleTypes] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);

  // Detailed entity data
  const [entityData, setEntityData] = useState({
    products: [],
    channels: [],
  });

  // Fetch filter options
  const fetchFilterOptions = async () => {
    try {
      // Fetch data to get product, sale type, and channel options
      const initialData = await kpiService.getNonPeriodicRevenueKPIs();

      // Extract unique products from by_product
      if (initialData?.by_product) {
        const uniqueProducts = Array.from(
          new Set(initialData.by_product.map((item) => item.product))
        );
        setProducts(uniqueProducts.filter(Boolean));
      }

      // Extract unique sale types from by_sale_type
      if (initialData?.by_sale_type) {
        const uniqueSaleTypes = Array.from(
          new Set(initialData.by_sale_type.map((item) => item.sale_type))
        );
        setSaleTypes(uniqueSaleTypes.filter(Boolean));
      }

      // Extract unique channels from by_channel
      if (initialData?.by_channel) {
        const uniqueChannels = Array.from(
          new Set(initialData.by_channel.map((item) => item.channel))
        );
        setChannels(uniqueChannels.filter(Boolean));
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  // Generate detailed entity data
  const generateDetailedEntityData = (data) => {
    // Generate product performance data - keep only Product, C.A HT, TVA, C.A TTC, and Percentage/C.A HT
    const productData =
      data?.by_product?.map((product) => ({
        product: product.product,
        totalRevenue: product.total, // C.A TTC
        preTax: product.pre_tax, // C.A HT
        tax: product.tax, // TVA
        percentageOfTotal: (product.pre_tax / (data.pre_tax || 1)) * 100, // Calculate percentage of total C.A HT
        // Removed: growth, transactions, avgTransaction
      })) || [];

    // Generate channel performance data - keep only Channel, C.A HT, TVA, C.A TTC, and Percentage/C.A HT
    const channelData =
      data?.by_channel?.map((channel) => ({
        channel: channel.channel,
        totalRevenue: channel.total, // C.A TTC
        preTax: channel.pre_tax, // C.A HT
        tax: channel.tax, // TVA
        percentageOfTotal: (channel.pre_tax / (data.pre_tax || 1)) * 100, // Calculate percentage of total C.A HT
        // Removed: transactions, avgTransaction, growth, conversionRate
      })) || [];

    return {
      products: productData,
      channels: channelData,
    };
  };

  // Fetch data with filters (remove DOT filters)
  const fetchData = async () => {
    setLoading(true);
    try {
      // Prepare filters - remove DOT
      const filters = {
        // Removed: dot
        product: selectedProducts.length > 0 ? selectedProducts : undefined,
        sale_type: selectedSaleTypes.length > 0 ? selectedSaleTypes : undefined,
        channel: selectedChannels.length > 0 ? selectedChannels : undefined,
      };

      console.log("Fetching with filters:", filters);
      const response = await kpiService.getNonPeriodicRevenueKPIs(filters);
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

  // Handle export button click - remove DOT from filters
  const handleExport = async (format) => {
    setLoading(true);
    setSnackbar({
      open: true,
      message: t("revenueNonPeriodic.export.startingExport"),
      severity: "info",
    });

    try {
      // Create filters object from all selected filters (without DOT)
      const filters = {
        // Removed: dot
        product: Array.from(selectedProducts),
        sale_type: Array.from(selectedSaleTypes),
        channel: Array.from(selectedChannels),
      };

      // Call the exportService function
      await exportNonPeriodicRevenue(format, filters);

      setSnackbar({
        open: true,
        message: t("revenueNonPeriodic.export.exportSuccess"),
        severity: "success",
      });
    } catch (error) {
      console.error("Export error:", error);
      setSnackbar({
        open: true,
        message:
          t("revenueNonPeriodic.export.exportFailed") +
          (error.message || t("common.error")),
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch filter options when component mounts
    fetchFilterOptions();

    // Initial data fetch without filters
    fetchData();
  }, []);

  // Re-fetch data when filters change
  useEffect(() => {
    // Only fetch on initial load, not when filters change
    // fetchData will be called when user clicks "Apply Filters"
  }, []);

  // Handle filter changes
  const handleDotChange = (event) => {
    const value = event.target.value;
    setSelectedDots(value);
  };

  const handleProductChange = (event) => {
    const value = event.target.value;
    setSelectedProducts(typeof value === "string" ? value.split(",") : value);
  };

  const handleSaleTypeChange = (event) => {
    const value = event.target.value;
    setSelectedSaleTypes(typeof value === "string" ? value.split(",") : value);
  };

  const handleChannelChange = (event) => {
    const value = event.target.value;
    setSelectedChannels(typeof value === "string" ? value.split(",") : value);
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

  if (loading) {
    return (
      <PageLayout
        title={t("revenueNonPeriodic.title")}
        subtitle={t("revenueNonPeriodic.subtitle")}
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
        title={t("revenueNonPeriodic.title")}
        subtitle={t("revenueNonPeriodic.subtitle")}
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

  // Get total values
  const totalRevenue =
    data?.total_revenue || data?.summary?.total_revenue?.total || 0;
  const totalRecords = data?.total_records || data?.summary?.total_records || 0;
  const emptyFields =
    data?.anomalies?.empty_fields ||
    data?.summary?.anomaly_stats?.empty_fields ||
    0;

  // Get available products, sale types, and channels
  const allProducts =
    data?.by_product?.map((p) => p.product).filter(Boolean) || [];
  const allSaleTypes =
    data?.by_sale_type?.map((s) => s.sale_type).filter(Boolean) || [];
  const allChannels =
    data?.by_channel?.map((c) => c.channel).filter(Boolean) || [];

  return (
    <PageLayout
      title={t("revenueNonPeriodic.title")}
      subtitle={t("revenueNonPeriodic.subtitle")}
      headerAction={null}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
        {/* Remove DOT filter */}

        {/* Product filter */}
        <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
          <InputLabel id="product-filter-label">
            {t("revenueNonPeriodic.filters.product")}
          </InputLabel>
          <Select
            labelId="product-filter-label"
            id="product-filter"
            multiple
            value={selectedProducts}
            onChange={handleProductChange}
            input={
              <OutlinedInput label={t("revenueNonPeriodic.filters.product")} />
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

        {/* Sale Type filter */}
        <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
          <InputLabel id="sale-type-filter-label">
            {t("revenueNonPeriodic.filters.saleType")}
          </InputLabel>
          <Select
            labelId="sale-type-filter-label"
            id="sale-type-filter"
            multiple
            value={selectedSaleTypes}
            onChange={handleSaleTypeChange}
            input={
              <OutlinedInput label={t("revenueNonPeriodic.filters.saleType")} />
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
            {saleTypes.map((saleType) => (
              <MenuItem key={saleType} value={saleType}>
                <Checkbox checked={selectedSaleTypes.indexOf(saleType) > -1} />
                <ListItemText primary={saleType} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Channel filter */}
        <FormControl size="small" sx={{ minWidth: 150, flexGrow: 1 }}>
          <InputLabel id="channel-filter-label">
            {t("revenueNonPeriodic.filters.channel")}
          </InputLabel>
          <Select
            labelId="channel-filter-label"
            id="channel-filter"
            multiple
            value={selectedChannels}
            onChange={handleChannelChange}
            input={
              <OutlinedInput label={t("revenueNonPeriodic.filters.channel")} />
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
            {channels.map((channel) => (
              <MenuItem key={channel} value={channel}>
                <Checkbox checked={selectedChannels.indexOf(channel) > -1} />
                <ListItemText primary={channel} />
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
            {t("revenueNonPeriodic.filters.applyFilters")}
          </Button>

          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={() => {
              setSelectedProducts([]);
              setSelectedSaleTypes([]);
              setSelectedChannels([]);
              // Clear DOT selection too even though we've removed the filter
              setSelectedDots([]);
              fetchData();
            }}
            disabled={loading}
            size="medium"
          >
            {t("revenueNonPeriodic.filters.resetFilters")}
          </Button>
        </Box>
      </Box>

      {/* Export buttons */}
      <Box sx={{ mb: 3, display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<FileDownloadIcon />}
          onClick={() => handleExport("excel")}
          disabled={loading}
        >
          {t("revenueNonPeriodic.export.exportExcel")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<FileDownloadIcon />}
          onClick={() => handleExport("csv")}
          disabled={loading}
          sx={{ ml: 1 }}
        >
          {t("revenueNonPeriodic.export.exportCSV")}
        </Button>

      </Box>

      {/* Tabs navigation */}
      <Box sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            label={t("revenueNonPeriodic.tabs.overview")}
            value="overview"
            sx={{ fontWeight: "bold" }}
          />
          <Tab
            label={t("revenueNonPeriodic.tabs.productPerformance")}
            value="product"
            sx={{ fontWeight: "bold" }}
          />
          <Tab
            label={t("revenueNonPeriodic.tabs.channelPerformance")}
            value="channel"
            sx={{ fontWeight: "bold" }}
          />
          <Tab
            label={t("revenueNonPeriodic.tabs.detailedEntityKPIs")}
            value="detailed"
            sx={{ fontWeight: "bold" }}
          />
        </Tabs>
      </Box>

      {/* Main content */}
      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "300px",
          }}
        >
          <CircularProgress />
        </Box>
      ) : data ? (
        <>
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <Grid container spacing={3}>
              {/* Summary Cards */}
              <Grid item xs={12} sm={6} md={4}>
                <Paper
                  sx={{
                    p: 3,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    position: "relative",
                  }}
                >
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {t("revenueNonPeriodic.overview.caHT")}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: "bold", color: "#0088FE" }} // Changed to blue color
                  >
                    {formatCurrency(data.pre_tax)}
                  </Typography>
                  {/* Add evolution rate if available */}
                  {data.evolution_rate && (
                    <Typography
                      variant="body2"
                      color={
                        data.evolution_rate >= 0 ? "success.main" : "error.main"
                      }
                      sx={{ mt: 1 }}
                    >
                      {data.evolution_rate >= 0 ? "+" : ""}
                      {formatPercentage(data.evolution_rate)}
                    </Typography>
                  )}
                  {/* Add objective if available */}
                  {data.objective && (
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      sx={{ mt: 1 }}
                    >
                      {t("revenueNonPeriodic.overview.objective")}:{" "}
                      {formatCurrency(data.objective)}
                    </Typography>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper
                  sx={{
                    p: 3,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {t("revenueNonPeriodic.overview.tva")}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                    {formatCurrency(data.tax)}
                  </Typography>
                </Paper>
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <Paper
                  sx={{
                    p: 3,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {t("revenueNonPeriodic.overview.caTTC")}
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                    {formatCurrency(data.total_revenue)}
                  </Typography>
                </Paper>
              </Grid>

              {/* Pie Charts */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: "100%" }}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {t("revenueNonPeriodic.overview.distributionByProduct")}
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={
                            data.by_product && data.by_product.length > 0
                              ? data.by_product.map((item, index) => ({
                                  name: item.product,
                                  value: item.pre_tax, // Changed to C.A HT instead of TTC
                                  color: COLORS[index % COLORS.length],
                                }))
                              : [{ name: "No Data", value: 1, color: "#ccc" }]
                          }
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(2)}%`
                          }
                        >
                          {(data.by_product &&
                            data.by_product.length > 0 &&
                            data.by_product.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))) || <Cell fill="#ccc" />}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            formatCurrency(value),
                            t("revenueNonPeriodic.overview.caHT"),
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, height: "100%" }}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {t("revenueNonPeriodic.overview.distributionByChannel")}
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={
                            data.by_channel && data.by_channel.length > 0
                              ? data.by_channel.map((item, index) => ({
                                  name: item.channel,
                                  value: item.pre_tax, // Changed to C.A HT instead of TTC
                                  color: COLORS[index % COLORS.length],
                                }))
                              : [{ name: "No Data", value: 1, color: "#ccc" }]
                          }
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(2)}%`
                          }
                        >
                          {(data.by_channel &&
                            data.by_channel.length > 0 &&
                            data.by_channel.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))) || <Cell fill="#ccc" />}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [
                            formatCurrency(value),
                            t("revenueNonPeriodic.overview.caHT"),
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Product Performance Tab */}
          {activeTab === "product" && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {t("revenueNonPeriodic.tabs.productPerformance")}
                  </Typography>
                  <TableContainer>
                    <Table sx={{ minWidth: 650 }} size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            {t("revenueNonPeriodic.tables.product")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.caHT")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.tva")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.caTTC")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.percentageOfCaHT")}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {entityData.products.length > 0 ? (
                          entityData.products.map((row) => (
                            <TableRow
                              key={row.product}
                              sx={{
                                "&:last-child td, &:last-child th": {
                                  border: 0,
                                },
                              }}
                            >
                              <TableCell component="th" scope="row">
                                {row.product}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.preTax)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.tax)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.totalRevenue)}
                              </TableCell>
                              <TableCell align="right">
                                {formatPercentage(row.percentageOfTotal)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              {t("revenueNonPeriodic.tables.noProductData")}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Channel Performance Tab */}
          {activeTab === "channel" && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {t("revenueNonPeriodic.tabs.channelPerformance")}
                  </Typography>
                  <TableContainer>
                    <Table sx={{ minWidth: 650 }} size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            {t("revenueNonPeriodic.tables.channel")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.caHT")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.tva")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.caTTC")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.percentageOfCaHT")}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {entityData.channels.length > 0 ? (
                          entityData.channels.map((row) => (
                            <TableRow
                              key={row.channel}
                              sx={{
                                "&:last-child td, &:last-child th": {
                                  border: 0,
                                },
                              }}
                            >
                              <TableCell component="th" scope="row">
                                {row.channel}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.preTax)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.tax)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.totalRevenue)}
                              </TableCell>
                              <TableCell align="right">
                                {formatPercentage(row.percentageOfTotal)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} align="center">
                              {t("revenueNonPeriodic.tables.noChannelData")}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}

          {/* Detailed Entity KPIs Tab - add two decimal places */}
          {activeTab === "detailed" && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" color="textSecondary" gutterBottom>
                    {t("revenueNonPeriodic.tabs.detailedEntityKPIs")}
                  </Typography>
                  <TableContainer>
                    <Table sx={{ minWidth: 650 }} size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            {t("revenueNonPeriodic.tables.entity")}
                          </TableCell>
                          <TableCell>
                            {t("revenueNonPeriodic.tables.type")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.caHT")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.tva")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.caTTC")}
                          </TableCell>
                          <TableCell align="right">
                            {t("revenueNonPeriodic.tables.percentageOfCaHT")}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[
                          ...entityData.products.map((item) => ({
                            ...item,
                            type: "Product",
                            name: item.product,
                          })),
                          ...entityData.channels.map((item) => ({
                            ...item,
                            type: "Channel",
                            name: item.channel,
                          })),
                        ].length > 0 ? (
                          [
                            ...entityData.products.map((item) => ({
                              ...item,
                              type: "Product",
                              name: item.product,
                            })),
                            ...entityData.channels.map((item) => ({
                              ...item,
                              type: "Channel",
                              name: item.channel,
                            })),
                          ].map((row, index) => (
                            <TableRow
                              key={`${row.type}-${row.name}-${index}`}
                              sx={{
                                "&:last-child td, &:last-child th": {
                                  border: 0,
                                },
                              }}
                            >
                              <TableCell>{row.name}</TableCell>
                              <TableCell>
                                {t(
                                  row.type === "Product"
                                    ? "revenueNonPeriodic.tables.product"
                                    : "revenueNonPeriodic.tables.channel"
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.preTax)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.tax)}
                              </TableCell>
                              <TableCell align="right">
                                {formatCurrency(row.totalRevenue)}
                              </TableCell>
                              <TableCell align="right">
                                {formatPercentage(row.percentageOfTotal)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              {t("revenueNonPeriodic.tables.noDetailedData")}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>
            </Grid>
          )}
        </>
      ) : (
        <Typography variant="body1" color="textSecondary" align="center">
          {t("revenueNonPeriodic.noData")}
        </Typography>
      )}

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

export default RevenueNonPeriodicPage;
