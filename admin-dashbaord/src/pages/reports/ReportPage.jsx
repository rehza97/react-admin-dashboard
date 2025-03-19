import { useState, useEffect } from "react";
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
  Button,
  Snackbar,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  TablePagination,
  Skeleton,
} from "@mui/material";
import {
  PieChart,
  Pie,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { DownloadOutlined } from "@mui/icons-material";
import PageLayout from "../../components/PageLayout";
import useDOTPermissions from "../../hooks/useDOTPermissions";
import PerformanceMetricsCard from "../../components/PerformanceMetricsCard";

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

// Add PropTypes validation for TabPanel
TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

// Helper function for tab props
function a11yProps(index) {
  return {
    id: `report-tab-${index}`,
    "aria-controls": `report-tabpanel-${index}`,
  };
}

// Helper function to get current year
const getCurrentYear = () => new Date().getFullYear();

// Helper function to format currency
const formatCurrency = (value) => {
  if (value === null || value === undefined) return "N/A";

  // Some API responses may be returning numbers as strings
  const numValue = typeof value === "string" ? parseFloat(value) : value;

  // Format the number as currency
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  }).format(numValue);
};

// Add back the ErrorFallback component
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

// Add PropTypes validation for ErrorFallback
ErrorFallback.propTypes = {
  message: PropTypes.string,
};

// Add these constants back
const ITEMS_PER_PAGE = 10;
const MAX_CHART_ITEMS = 20;
const CHART_COLORS = [
  "#0088FE", // Blue
  "#00C49F", // Green
  "#FFBB28", // Yellow
  "#FF8042", // Orange
  "#8884D8", // Purple
  "#FF6B6B", // Red
  "#6B8E23", // Olive
  "#483D8B", // Dark Slate Blue
  "#CD853F", // Peru
  "#708090", // Slate Gray
];

// Helper function for chart data processing
const processChartData = (data, maxItems = MAX_CHART_ITEMS) => {
  if (!data || data.length <= maxItems) return data;

  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const topItems = sortedData.slice(0, maxItems - 1);

  // Aggregate remaining items
  const otherItems = sortedData.slice(maxItems - 1);
  const otherValue = otherItems.reduce((sum, item) => sum + item.value, 0);

  return [
    ...topItems,
    {
      name: "Others",
      value: otherValue,
    },
  ];
};

// Add this helper function to extract the base type from anomaly type names
const getAnomalyBaseType = (anomalyType) => {
  if (!anomalyType) return "Unknown";

  // Remove any numeric suffixes or detailed identifiers
  const parts = anomalyType.split("_");
  if (parts.length > 2) {
    // Return a more readable format
    return `${parts[0]} ${parts[1]}`;
  }
  return anomalyType;
};

// Add a function to group anomalies by their base type
const groupAnomaliesByBaseType = (anomalies) => {
  if (!anomalies || !anomalies.length) return [];

  const groups = {};

  anomalies.forEach((anomaly) => {
    const baseType = getAnomalyBaseType(anomaly.type || "Unknown");

    if (!groups[baseType]) {
      groups[baseType] = {
        name: baseType,
        value: 0,
        items: [],
      };
    }

    groups[baseType].value += 1;
    groups[baseType].items.push(anomaly);
  });

  return Object.values(groups);
};

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

  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);

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
    loading: dotsLoading,
    error: dotsError,
    hasDOTPermission,
  } = useDOTPermissions();

  // Add state for dashboard summary
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Create a proper effect for fetching dashboard summary
  useEffect(() => {
    const controller = new AbortController();

    const fetchDashboardSummary = async () => {
      setSummaryLoading(true);
      try {
        const filters = {
          year,
          month: month || undefined,
          dot: selectedDot || undefined,
        };
        console.log("Fetching dashboard summary with filters:", filters);
        const summaryData = await kpiService.getDashboardSummary(filters);
        if (!controller.signal.aborted) {
          console.log("Dashboard summary received:", summaryData);
          setDashboardSummary(summaryData);
        }
      } catch (error) {
        console.error("Error fetching dashboard summary:", error);
      } finally {
        if (!controller.signal.aborted) {
          setSummaryLoading(false);
        }
      }
    };

    fetchDashboardSummary();

    return () => {
      controller.abort();
    };
  }, [year, month, selectedDot]);

  // Modify the report data fetch to use dashboard summary as fallback
  useEffect(() => {
    const controller = new AbortController();

    const fetchReportData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = {
          year,
          ...(month ? { month: Number(month) } : {}),
          ...(selectedDot ? { dot: selectedDot } : {}),
        };

        let data;
        if (tabValue === 0) {
          data = await reportService.getRevenueCollectionReport(params);
          console.log("Revenue Collection Report Data:", data);

          // If the report data has empty values but dashboard summary has data,
          // supplement the report data with summary values
          if (dashboardSummary && data) {
            const kpis = data.kpis || data.summary || {};

            // Check if report data values are zero or missing
            if (!kpis.total_revenue || kpis.total_revenue === 0) {
              console.log("Using dashboard summary value for total_revenue");
              if (!data.kpis) data.kpis = {};
              if (!data.summary) data.summary = {};
              data.kpis.total_revenue = dashboardSummary.total_revenue;
              data.summary.total_revenue = dashboardSummary.total_revenue;
            }

            if (!kpis.total_collection || kpis.total_collection === 0) {
              console.log("Using dashboard summary value for total_collection");
              if (!data.kpis) data.kpis = {};
              if (!data.summary) data.summary = {};
              data.kpis.total_collection = dashboardSummary.total_collection;
              data.summary.total_collection = dashboardSummary.total_collection;
            }
          }

          setRevenueCollectionReport(data);
        } else if (tabValue === 1) {
          data = await reportService.getCorporateParkReport(params);
          console.log("Corporate Park Report Data:", data);

          // If the report data has empty values but dashboard summary has data,
          // supplement the report data with summary values
          if (dashboardSummary && data) {
            const kpis = data.kpis || data.summary || {};

            // Check if report data values are zero or missing
            if (!kpis.total_subscribers || kpis.total_subscribers === 0) {
              console.log(
                "Using dashboard summary value for total_subscribers"
              );
              if (!data.kpis) data.kpis = {};
              if (!data.summary) data.summary = {};
              data.kpis.total_subscribers = dashboardSummary.total_subscribers;
              data.summary.total_subscribers =
                dashboardSummary.total_subscribers;
            }
          }

          setCorporateParkReport(data);
        } else if (tabValue === 2) {
          data = await reportService.getReceivablesReport(params);
          console.log("Receivables Report Data:", data);

          // If the report data has empty values but dashboard summary has data,
          // supplement the report data with summary values
          if (dashboardSummary && data) {
            const kpis = data.kpis || data.summary || {};

            // Check if report data values are zero or missing
            if (!kpis.total_receivables || kpis.total_receivables === 0) {
              console.log(
                "Using dashboard summary value for total_receivables"
              );
              if (!data.kpis) data.kpis = {};
              if (!data.summary) data.summary = {};
              data.kpis.total_receivables = dashboardSummary.total_receivables;
              data.summary.total_receivables =
                dashboardSummary.total_receivables;
            }
          }

          setReceivablesReport(data);
        }
      } catch (err) {
        console.error("Error fetching report data:", err);
        setError("Failed to load report data. Please try again later.");
        setSnackbar({
          open: true,
          message: t("reports.errorLoadingData"),
          severity: "error",
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    // Wait for dashboard summary to be available before fetching report data
    if (dashboardSummary || summaryLoading === false) {
      fetchReportData();
    }

    return () => {
      controller.abort();
    };
  }, [tabValue, year, month, selectedDot, dashboardSummary, t]);

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

  // Update the handleExport function to remove reference to exporting state
  const handleExport = async (format) => {
    try {
      // Show loading in snackbar instead
      setSnackbar({
        open: true,
        message: t("reports.exportLoading"),
        severity: "info",
      });

      // Determine report type based on active tab
      let reportType;
      if (tabValue === 0) {
        reportType = "revenue_collection";
      } else if (tabValue === 1) {
        reportType = "corporate_park";
      } else if (tabValue === 2) {
        reportType = "receivables";
      }

      // Prepare params
      const params = {
        year,
        ...(month ? { month } : {}),
        ...(selectedDot ? { dot: selectedDot } : {}),
        format,
      };

      // Call the export function with the correct report type
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
        message:
          t("reports.exportError") + ": " + (err.message || "Unknown error"),
        severity: "error",
      });
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
      const kpis =
        revenueCollectionReport.kpis || revenueCollectionReport.summary || {};
      const breakdowns = revenueCollectionReport.breakdowns || {};
      const anomalies =
        revenueCollectionReport.anomalies?.journal_anomalies ||
        revenueCollectionReport.anomalies?.etat_anomalies ||
        revenueCollectionReport.anomalies ||
        [];

      // Process chart data with better grouping
      const groupedAnomalies = groupAnomaliesByBaseType(anomalies);
      const chartData = processChartData(groupedAnomalies);

      // Calculate pagination
      const startIndex = (currentPage - 1) * itemsPerPage;
      const paginatedAnomalies = anomalies.slice(
        startIndex,
        startIndex + itemsPerPage
      );

      return (
        <Box>
          {/* KPI Cards with enhanced styling */}
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

          {/* Improved Charts Section */}
          {chartData.length > 0 && (
            <Box sx={{ height: 400, mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Anomaly Distribution
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={150}
                    fill="#8884d8"
                    label={({ name, value, percent }) =>
                      `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                    }
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} anomalies`, name]}
                    labelFormatter={() => "Count"}
                  />
                  <Legend formatter={(value) => value} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          )}

          {/* Improved Anomalies Table with Pagination */}
          {anomalies.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Detected Anomalies ({anomalies.length})
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "primary.main" }}>
                      <TableCell
                        sx={{ color: "common.white", fontWeight: "bold" }}
                      >
                        Type
                      </TableCell>
                      <TableCell
                        sx={{ color: "common.white", fontWeight: "bold" }}
                      >
                        Description
                      </TableCell>
                      <TableCell
                        sx={{ color: "common.white", fontWeight: "bold" }}
                      >
                        Invoice
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedAnomalies.map((anomaly, index) => {
                      const baseType = getAnomalyBaseType(
                        anomaly.type || "Unknown"
                      );
                      const typeIndex = chartData.findIndex(
                        (item) => item.name === baseType
                      );
                      const typeColor =
                        CHART_COLORS[typeIndex % CHART_COLORS.length];

                      return (
                        <TableRow
                          key={index}
                          sx={{
                            "&:nth-of-type(odd)": {
                              backgroundColor: "action.hover",
                            },
                            borderLeft: `4px solid ${typeColor}`,
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: "50%",
                                  bgcolor: typeColor,
                                  mr: 1,
                                }}
                              />
                              {baseType}
                            </Box>
                          </TableCell>
                          <TableCell>{anomaly.description}</TableCell>
                          <TableCell>
                            {anomaly.invoice_number && (
                              <Chip
                                label={anomaly.invoice_number}
                                size="small"
                                color="primary"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination Controls */}
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                <TablePagination
                  component="div"
                  count={anomalies.length}
                  page={currentPage - 1}
                  onPageChange={(event, newPage) => setCurrentPage(newPage + 1)}
                  rowsPerPage={itemsPerPage}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  onRowsPerPageChange={(event) => {
                    setCurrentPage(1);
                    setItemsPerPage(parseInt(event.target.value, 10));
                  }}
                />
              </Box>
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

      {/* Enhanced Dashboard Summary Card */}
      {dashboardSummary && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t("dashboard.summary.title")}
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  textAlign: "center",
                  p: 1,
                  borderRadius: 1,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  bgcolor: "background.paper",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {t("dashboard.summary.totalRevenue")}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(dashboardSummary.total_revenue)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  textAlign: "center",
                  p: 1,
                  borderRadius: 1,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  bgcolor: "background.paper",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {t("dashboard.summary.totalCollection")}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(dashboardSummary.total_collection)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  textAlign: "center",
                  p: 1,
                  borderRadius: 1,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  bgcolor: "background.paper",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {t("dashboard.summary.totalReceivables")}
                </Typography>
                <Typography variant="h5">
                  {formatCurrency(dashboardSummary.total_receivables)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box
                sx={{
                  textAlign: "center",
                  p: 1,
                  borderRadius: 1,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  bgcolor: "background.paper",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <Typography variant="subtitle2" color="text.secondary">
                  {t("dashboard.summary.totalSubscribers")}
                </Typography>
                <Typography variant="h5">
                  {dashboardSummary.total_subscribers.toLocaleString()}
                </Typography>
              </Box>
            </Grid>
          </Grid>
          {(dashboardSummary.anomalies?.empty_fields_receivables > 0 ||
            dashboardSummary.anomalies?.empty_fields_park > 0) && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="warning.main">
                {t("dashboard.summary.anomaliesDetected")}:
              </Typography>
              <Typography variant="body2">
                {dashboardSummary.anomalies?.empty_fields_receivables > 0 &&
                  `${dashboardSummary.anomalies.empty_fields_receivables} ${t(
                    "dashboard.summary.emptyFieldsReceivables"
                  )}`}
                {dashboardSummary.anomalies?.empty_fields_receivables > 0 &&
                  dashboardSummary.anomalies?.empty_fields_park > 0 &&
                  ", "}
                {dashboardSummary.anomalies?.empty_fields_park > 0 &&
                  `${dashboardSummary.anomalies.empty_fields_park} ${t(
                    "dashboard.summary.emptyFieldsPark"
                  )}`}
              </Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* Improved loading state for summary */}
      {summaryLoading && !dashboardSummary && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            <Skeleton width="40%" />
          </Typography>
          <Grid container spacing={3}>
            {[1, 2, 3, 4].map((item) => (
              <Grid item xs={12} sm={6} md={3} key={item}>
                <Box sx={{ textAlign: "center", p: 1 }}>
                  <Skeleton variant="text" width="60%" sx={{ mx: "auto" }} />
                  <Skeleton variant="text" height={40} sx={{ mx: "auto" }} />
                </Box>
              </Grid>
            ))}
          </Grid>
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
