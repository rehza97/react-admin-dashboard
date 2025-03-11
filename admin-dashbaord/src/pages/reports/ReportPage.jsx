import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
// Fix imports to match how the services are exported
import kpiService from "../../services/kpiService";
import reportService from "../../services/reportService";
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
  Divider,
  Button,
  Snackbar,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DownloadOutlined } from "@mui/icons-material";
import PageLayout from "../../components/PageLayout";
import useDOTPermissions from "../../hooks/useDOTPermissions";
import { handleApiError } from "../../services/utils/errorHandling";
import PerformanceMetricsCard from "../../components/PerformanceMetricsCard";
import { exportReport } from "../../services/exportService";

// Tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Helper function for tab props
function a11yProps(index) {
  return {
    id: `report-tab-${index}`,
    "aria-controls": `report-tabpanel-${index}`,
  };
}

// Helper function to get current year
const getCurrentYear = () => new Date().getFullYear();

// Helper function to get current month
const getCurrentMonth = () => new Date().getMonth() + 1;

// Helper function to format currency
const formatCurrency = (value) => {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  }).format(value);
};

// Helper function to format percentage
const formatPercentage = (value) => {
  if (value === null || value === undefined) return "N/A";
  return `${(value * 100).toFixed(2)}%`;
};

// Add this after the imports
const ErrorFallback = ({ message }) => (
  <Box sx={{ p: 3, textAlign: "center" }}>
    <Alert severity="error" sx={{ mb: 2 }}>
      {message || "An error occurred while rendering the report."}
    </Alert>
    <Typography variant="body1">
      Please try refreshing the page or contact support if the problem persists.
    </Typography>
  </Box>
);

const ReportPage = () => {
  const { t } = useTranslation();
  // State for tab value
  const [tabValue, setTabValue] = useState(0);

  // State for filters
  const [year, setYear] = useState(getCurrentYear());
  const [month, setMonth] = useState("");
  const [selectedDot, setSelectedDot] = useState("");

  // State for report data
  const [revenueCollectionReport, setRevenueCollectionReport] = useState(null);
  const [corporateParkReport, setCorporateParkReport] = useState(null);
  const [receivablesReport, setReceivablesReport] = useState(null);

  // State for loading and error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Add state for snackbar
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Replace availableDots state with useDOTPermissions hook
  const {
    availableDots,
    userDots,
    loading: dotsLoading,
    error: dotsError,
    hasDOTPermission,
  } = useDOTPermissions();

  // Add setExporting state variable
  const [exporting, setExporting] = useState(false);

  // Add state for dashboard summary
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Effect to fetch report data based on selected tab and filters
  useEffect(() => {
    const fetchReportData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Prepare params
        const params = {
          year,
          ...(month ? { month } : {}),
          ...(selectedDot ? { dot: selectedDot } : {}),
        };

        // Fetch data based on selected tab
        if (tabValue === 0) {
          const data = await reportService.getRevenueCollectionReport(params);
          console.log("Revenue Collection Report Data:", data);
          setRevenueCollectionReport(data);
        } else if (tabValue === 1) {
          const data = await reportService.getCorporateParkReport(params);
          console.log("Corporate Park Report Data:", data);
          setCorporateParkReport(data);
        } else if (tabValue === 2) {
          const data = await reportService.getReceivablesReport(params);
          console.log("Receivables Report Data:", data);
          setReceivablesReport(data);
        }
      } catch (err) {
        handleApiError(
          err,
          "fetching report data",
          setSnackbar,
          setError,
          t("reports.errorLoadingData")
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
    // Add a call to fetch dashboard summary
    fetchDashboardSummary();
  }, [tabValue, year, month, selectedDot, t]);

  // Add function to fetch dashboard summary
  const fetchDashboardSummary = async () => {
    setSummaryLoading(true);

    const filters = {
      year,
      month: month || undefined,
      dot: selectedDot || undefined,
    };

    try {
      const summaryData = await kpiService.getDashboardSummary(filters);
      setDashboardSummary(summaryData);
      console.log("Dashboard summary data:", summaryData);
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      // Don't show an error message for this, as it's supplementary information
    } finally {
      setSummaryLoading(false);
    }
  };

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle filter changes
  const handleYearChange = (event) => {
    setYear(event.target.value);
  };

  const handleMonthChange = (event) => {
    setMonth(event.target.value);
  };

  // Update handleDotChange to check permissions
  const handleDotChange = (event) => {
    const selectedDot = event.target.value;

    // If empty (All DOTs) or user has permission, set the DOT
    if (!selectedDot || hasDOTPermission(selectedDot)) {
      setSelectedDot(selectedDot);
    } else {
      // Show error if user doesn't have permission
      setSnackbar({
        open: true,
        message: `You don't have permission to access data for DOT: ${selectedDot}`,
        severity: "error",
      });
    }
  };

  // Update the handleExport function to use error handler
  const handleExport = async (format) => {
    try {
      setExporting(true);

      // Determine report type based on active tab
      let reportType;
      if (tabValue === 0) {
        reportType = "revenue-collection";
      } else if (tabValue === 1) {
        reportType = "corporate-park";
      } else if (tabValue === 2) {
        reportType = "receivables";
      }

      // Prepare params
      const params = {
        year,
        ...(month ? { month } : {}),
        ...(selectedDot ? { dot: selectedDot } : {}),
      };

      // Call the export function
      await reportService.exportReport(reportType, format, params);

      setSnackbar({
        open: true,
        message: t("reports.exportSuccess"),
        severity: "success",
      });
    } catch (err) {
      console.error("Export error:", err);
      setSnackbar({
        open: true,
        message: t("reports.exportError"),
        severity: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  // Add handler for closing snackbar
  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  // Render revenue and collection report
  const renderRevenueCollectionReport = () => {
    if (!revenueCollectionReport) return null;

    try {
      // Check if the report has the expected structure
      // If not, extract data from the summary field which is used in the backend
      const kpis =
        revenueCollectionReport.kpis || revenueCollectionReport.summary || {};
      const breakdowns = revenueCollectionReport.breakdowns || {};
      const anomalies =
        revenueCollectionReport.anomalies?.journal_anomalies ||
        revenueCollectionReport.anomalies?.etat_anomalies ||
        revenueCollectionReport.anomalies ||
        [];

      return (
        <Box>
          {/* KPI Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <PerformanceMetricsCard
                title="Total Revenue"
                subtitle="Total revenue for the selected period"
                currentValue={kpis.total_revenue}
                previousValue={
                  kpis.previous_year_revenue || kpis.previous_total_revenue
                }
                objectiveValue={kpis.revenue_objective}
                growthRate={kpis.revenue_growth_rate}
                achievementRate={kpis.revenue_achievement_rate}
                valuePrefix=""
                valueSuffix=" DZD"
                isLoading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <PerformanceMetricsCard
                title="Total Invoiced"
                subtitle="Total amount invoiced for the selected period"
                currentValue={kpis.total_invoiced}
                previousValue={kpis.previous_total_invoiced}
                objectiveValue={null}
                growthRate={kpis.invoiced_growth_rate}
                achievementRate={null}
                valuePrefix=""
                valueSuffix=" DZD"
                isLoading={loading}
                showObjective={false}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <PerformanceMetricsCard
                title="Total Collection"
                subtitle="Total amount collected for the selected period"
                currentValue={kpis.total_collection}
                previousValue={
                  kpis.previous_year_collection ||
                  kpis.previous_total_collection
                }
                objectiveValue={kpis.collection_objective}
                growthRate={kpis.collection_growth_rate}
                achievementRate={kpis.collection_achievement_rate}
                valuePrefix=""
                valueSuffix=" DZD"
                isLoading={loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <PerformanceMetricsCard
                title="Collection Rate"
                subtitle="Percentage of invoiced amount collected"
                currentValue={kpis.collection_rate}
                previousValue={kpis.previous_collection_rate}
                objectiveValue={null}
                growthRate={null}
                achievementRate={null}
                valuePrefix=""
                valueSuffix="%"
                isLoading={loading}
                showObjective={false}
                showComparison={true}
              />
            </Grid>
          </Grid>

          {/* Anomalies */}
          {anomalies && anomalies.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Detected Anomalies
              </Typography>
              {anomalies.map((anomaly, index) => (
                <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                  {anomaly.description}{" "}
                  {anomaly.invoice_number &&
                    `(Invoice: ${anomaly.invoice_number})`}
                </Alert>
              ))}
            </Box>
          )}

          {/* Breakdowns */}
          {breakdowns && Object.keys(breakdowns).length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Breakdowns
              </Typography>
              {/* Implement breakdown visualizations here */}
            </Box>
          )}
        </Box>
      );
    } catch (error) {
      console.error("Error rendering revenue collection report:", error);
      return (
        <ErrorFallback message="Error rendering revenue collection report. The data structure may be invalid." />
      );
    }
  };

  // Render corporate park report
  const renderCorporateParkReport = () => {
    if (!corporateParkReport) return null;

    try {
      // Check if the report has the expected structure
      // If not, extract data from the summary field which is used in the backend
      const kpis =
        corporateParkReport.kpis || corporateParkReport.summary || {};
      const breakdowns = corporateParkReport.breakdowns || {};
      const anomalies = corporateParkReport.anomalies || [];

      return (
        <Box>
          {/* KPI Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <PerformanceMetricsCard
                title="Total Subscribers"
                subtitle="Total subscribers for the selected period"
                currentValue={kpis.total_subscribers}
                previousValue={
                  kpis.previous_month_subscribers ||
                  kpis.previous_total_subscribers
                }
                objectiveValue={null}
                growthRate={kpis.growth_rate || kpis.subscriber_growth_rate}
                achievementRate={null}
                valuePrefix=""
                valueSuffix=""
                isLoading={loading}
                showObjective={false}
              />
            </Grid>
          </Grid>

          {/* Anomalies */}
          {anomalies && anomalies.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Detected Anomalies
              </Typography>
              {anomalies.map((anomaly, index) => (
                <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                  {anomaly.description}
                </Alert>
              ))}
            </Box>
          )}

          {/* Breakdowns */}
          {breakdowns && Object.keys(breakdowns).length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Breakdowns
              </Typography>
              {/* Implement breakdown visualizations here */}
            </Box>
          )}
        </Box>
      );
    } catch (error) {
      console.error("Error rendering corporate park report:", error);
      return (
        <ErrorFallback message="Error rendering corporate park report. The data structure may be invalid." />
      );
    }
  };

  // Render receivables report
  const renderReceivablesReport = () => {
    if (!receivablesReport) return null;

    try {
      // Check if the report has the expected structure
      // If not, extract data from the summary field which is used in the backend
      const kpis = receivablesReport.kpis || receivablesReport.summary || {};
      const breakdowns = receivablesReport.breakdowns || {};
      const anomalies = receivablesReport.anomalies || [];

      return (
        <Box>
          {/* KPI Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={4}>
              <PerformanceMetricsCard
                title="Total Receivables"
                subtitle="Total receivables for the selected period"
                currentValue={kpis.total_receivables}
                previousValue={kpis.previous_total_receivables}
                objectiveValue={null}
                growthRate={kpis.receivables_growth_rate}
                achievementRate={null}
                valuePrefix=""
                valueSuffix=" DZD"
                isLoading={loading}
                showObjective={false}
              />
            </Grid>
          </Grid>

          {/* Anomalies */}
          {anomalies && anomalies.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Detected Anomalies
              </Typography>
              {anomalies.map((anomaly, index) => (
                <Alert key={index} severity="warning" sx={{ mb: 1 }}>
                  {anomaly.description}
                </Alert>
              ))}
            </Box>
          )}

          {/* Breakdowns */}
          {breakdowns && Object.keys(breakdowns).length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Breakdowns
              </Typography>
              {/* Implement breakdown visualizations here */}
            </Box>
          )}
        </Box>
      );
    } catch (error) {
      console.error("Error rendering receivables report:", error);
      return (
        <ErrorFallback message="Error rendering receivables report. The data structure may be invalid." />
      );
    }
  };

  return (
    <PageLayout
      title={t("reports.generateReport")}
      subtitle="View detailed reports combining data from multiple sources"
      headerAction={
        <Button
          variant="contained"
          color="primary"
          startIcon={<DownloadOutlined />}
          onClick={() => handleExport("excel")}
        >
          {t("reports.exportDefault")}
        </Button>
      }
    >
      {dotsError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {dotsError}
        </Alert>
      )}

      {/* Add Dashboard Summary Card */}
      {dashboardSummary && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t("dashboard.summary.title")}
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: "center", p: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t("dashboard.summary.totalRevenue")}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(dashboardSummary.total_revenue)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: "center", p: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t("dashboard.summary.totalCollection")}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(dashboardSummary.total_collection)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: "center", p: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t("dashboard.summary.totalReceivables")}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(dashboardSummary.total_receivables)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: "center", p: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t("dashboard.summary.totalSubscribers")}
                </Typography>
                <Typography variant="h5">
                  {dashboardSummary.total_subscribers.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
          </Grid>
          {(dashboardSummary.anomalies.empty_fields_receivables > 0 ||
            dashboardSummary.anomalies.empty_fields_park > 0) && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="warning.main">
                {t("dashboard.summary.anomaliesDetected")}:
              </Typography>
              <Typography variant="body2">
                {dashboardSummary.anomalies.empty_fields_receivables > 0 &&
                  `${dashboardSummary.anomalies.empty_fields_receivables} ${t(
                    "dashboard.summary.emptyFieldsReceivables"
                  )}`}
                {dashboardSummary.anomalies.empty_fields_receivables > 0 &&
                  dashboardSummary.anomalies.empty_fields_park > 0 &&
                  ", "}
                {dashboardSummary.anomalies.empty_fields_park > 0 &&
                  `${dashboardSummary.anomalies.empty_fields_park} ${t(
                    "dashboard.summary.emptyFieldsPark"
                  )}`}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {summaryLoading && !dashboardSummary && (
        <Paper sx={{ p: 2, mb: 3, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={24} />
        </Paper>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Year filter */}
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="year-select-label">Year</InputLabel>
              <Select
                labelId="year-select-label"
                id="year-select"
                value={year}
                label="Year"
                onChange={handleYearChange}
              >
                {[...Array(5)].map((_, i) => {
                  const yearValue = getCurrentYear() - i;
                  return (
                    <MenuItem key={yearValue} value={yearValue}>
                      {yearValue}
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          </Grid>

          {/* Month filter */}
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="month-select-label">Month</InputLabel>
              <Select
                labelId="month-select-label"
                id="month-select"
                value={month}
                label="Month"
                onChange={handleMonthChange}
              >
                <MenuItem value="">All Months</MenuItem>
                {[...Array(12)].map((_, i) => (
                  <MenuItem key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", {
                      month: "long",
                    })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* DOT filter - Updated to use filtered DOTs */}
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth size="small">
              <InputLabel id="dot-select-label">DOT</InputLabel>
              <Select
                labelId="dot-select-label"
                id="dot-select"
                value={selectedDot}
                label="DOT"
                onChange={handleDotChange}
                disabled={dotsLoading}
              >
                <MenuItem value="">All DOTs</MenuItem>
                {availableDots
                  .filter((dotItem) => hasDOTPermission(dotItem.code))
                  .map((dotItem) => (
                    <MenuItem key={dotItem.code} value={dotItem.code}>
                      {dotItem.name}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Export buttons */}
          <Grid item xs={12} sm={3}>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                startIcon={<DownloadOutlined />}
                onClick={() => handleExport("excel")}
                sx={{ mr: 1 }}
              >
                Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadOutlined />}
                onClick={() => handleExport("pdf")}
              >
                PDF
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs */}
      <Paper>
        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="report tabs"
          >
            <Tab label="Revenue & Collection" {...a11yProps(0)} />
            <Tab label="Corporate Park" {...a11yProps(1)} />
            <Tab label="Receivables" {...a11yProps(2)} />
          </Tabs>
        </Box>

        {/* Loading and error states */}
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {/* Tab panels */}
        {!loading && !error && (
          <>
            <TabPanel value={tabValue} index={0}>
              {renderRevenueCollectionReport()}
            </TabPanel>
            <TabPanel value={tabValue} index={1}>
              {renderCorporateParkReport()}
            </TabPanel>
            <TabPanel value={tabValue} index={2}>
              {renderReceivablesReport()}
            </TabPanel>
          </>
        )}
      </Paper>

      {/* Add Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={
            snackbar.severity === "success" ||
            snackbar.severity === "error" ||
            snackbar.severity === "warning" ||
            snackbar.severity === "info"
              ? snackbar.severity
              : "info"
          }
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </PageLayout>
  );
};

export default ReportPage;
