import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Tabs,
  Tab,
  Typography,
} from "@mui/material";
import {
  AttachMoney,
  TrendingUp,
  AccountBalance,
  People,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import kpiService from "../../services/kpiService";
import PageLayout from "../../components/PageLayout";
import CardComponent from "./CardComponent";
import RevenueKPI from "./RevenueKPI";
import ReceivablesKPI from "./ReceivablesKPI";
import CorporateParkKPI from "./CorporateParkKPI";
import NGBSSCollectionKPI from "./NGBSSCollectionKPI";
import UnfinishedInvoiceKPI from "./UnfinishedInvoiceKPI";
import PropTypes from "prop-types";

// TabPanel component for accessibility
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`kpi-tabpanel-${index}`}
      aria-labelledby={`kpi-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `kpi-tab-${index}`,
    "aria-controls": `kpi-tabpanel-${index}`,
  };
}

// Get current year and month
const getCurrentYear = () => new Date().getFullYear();
const getCurrentMonth = () => new Date().getMonth() + 1;

// Mock data for when API fails
const mockSummaryData = {
  total_revenue: 1250000000,
  previous_year_revenue: 1100000000,
  revenue_change: 13.64,
  total_collection: 980000000,
  collection_rate: 78.4,
  collections_change: 8.89,
  total_receivables: 270000000,
  receivables_change: -5.26,
  total_corporate_subscribers: 12500,
  subscribers_change: 4.17,
  objective_achievement_rate: 83.33,
  top_performing_dots: [
    { organization: "Algiers", total: 450000000 },
    { organization: "Oran", total: 320000000 },
    { organization: "Constantine", total: 280000000 },
    { organization: "Annaba", total: 200000000 },
  ],
  anomalies: {
    missing_invoices: 12,
    duplicate_entries: 5,
    negative_values: 3,
    outlier_values: 8,
  },
  zero_revenue_dots: [{ organization: "Illizi" }, { organization: "Tindouf" }],
  zero_collection_dots: [
    { organization: "Naama" },
    { organization: "El Bayadh" },
  ],
};

const KPIDashboard = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [yearFilter, setYearFilter] = useState(getCurrentYear().toString());
  const [monthFilter, setMonthFilter] = useState("");

  // Fetch dashboard summary data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Build parameters object
        const params = {
          year: yearFilter,
        };

        // Only add month if it's defined
        if (monthFilter) {
          params.month = monthFilter;
        }

        // Fetch data from the API
        const data = await kpiService.getDashboardSummary(params);

        // Transform data with safe fallbacks
        setSummaryData({
          total_revenue: data.total_revenue || 0,
          revenue_change: data.revenue_change || 0,
          total_collection: data.total_collection || 0,
          collection_rate: data.collection_rate || 0,
          total_receivables: data.total_receivables || 0,
          total_corporate_subscribers: data.total_subscribers || 0,
          top_performing_dots: data.top_performing_dots || [],
          zero_revenue_dots: data.zero_revenue_dots || [],
          zero_collection_dots: data.zero_collection_dots || [],
          anomalies: data.anomalies || {
            empty_fields_receivables: 0,
            empty_fields_park: 0,
          },
        });

        setError(null);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError(
          err.message ||
            "Failed to load dashboard data. Please try again later."
        );

        // Reset data on error
        setSummaryData({
          total_revenue: 0,
          revenue_change: 0,
          total_collection: 0,
          collection_rate: 0,
          total_receivables: 0,
          total_corporate_subscribers: 0,
          top_performing_dots: [],
          zero_revenue_dots: [],
          zero_collection_dots: [],
          anomalies: {
            empty_fields_receivables: 0,
            empty_fields_park: 0,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [yearFilter, monthFilter]);

  const handleYearChange = (event) => {
    setYearFilter(event.target.value);
  };

  const handleMonthChange = (event) => {
    setMonthFilter(event.target.value);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) {
      return new Intl.NumberFormat("fr-DZ", {
        style: "currency",
        currency: "DZD",
        minimumFractionDigits: 0,
      }).format(0);
    }
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <PageLayout
      title="KPI Dashboard"
      subtitle="Monitor key performance indicators"
      headerAction={null}
    >
      <Box sx={{ mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Commercial Performance Dashboard
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              gap: 2,
              width: { xs: "100%", md: "auto" },
            }}
          >
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="year-select-label">Year</InputLabel>
              <Select
                labelId="year-select-label"
                id="year-select"
                value={yearFilter}
                label="Year"
                onChange={handleYearChange}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <MenuItem
                    key={getCurrentYear() - i}
                    value={(getCurrentYear() - i).toString()}
                  >
                    {getCurrentYear() - i}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="month-select-label">Month</InputLabel>
              <Select
                labelId="month-select-label"
                id="month-select"
                value={monthFilter}
                label="Month"
                onChange={handleMonthChange}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="1">January</MenuItem>
                <MenuItem value="2">February</MenuItem>
                <MenuItem value="3">March</MenuItem>
                <MenuItem value="4">April</MenuItem>
                <MenuItem value="5">May</MenuItem>
                <MenuItem value="6">June</MenuItem>
                <MenuItem value="7">July</MenuItem>
                <MenuItem value="8">August</MenuItem>
                <MenuItem value="9">September</MenuItem>
                <MenuItem value="10">October</MenuItem>
                <MenuItem value="11">November</MenuItem>
                <MenuItem value="12">December</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </Box>

        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "200px",
            }}
          >
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} lg={3}>
                <CardComponent
                  title="Revenue"
                  value={formatCurrency(summaryData?.total_revenue || 0)}
                  subtitle={`${
                    (summaryData?.revenue_change || 0) >= 0 ? "+" : ""
                  }${(summaryData?.revenue_change || 0).toFixed(
                    2
                  )}% vs last year`}
                  icon={<AttachMoney />}
                  color={theme.palette.primary.main}
                  percentageChange={summaryData?.revenue_change || 0}
                  change={summaryData?.revenue_change || 0}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <CardComponent
                  title="Collections"
                  value={formatCurrency(summaryData?.total_collection || 0)}
                  subtitle={`${(summaryData?.collection_rate || 0).toFixed(
                    2
                  )}% of invoiced`}
                  icon={<TrendingUp />}
                  color={theme.palette.success.main}
                  percentageChange={summaryData?.collection_rate || 0}
                  change={summaryData?.collection_rate || 0}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <CardComponent
                  title="Receivables"
                  value={formatCurrency(summaryData?.total_receivables || 0)}
                  subtitle={`${
                    (summaryData?.receivables_change || 0) >= 0 ? "+" : ""
                  }${(summaryData?.receivables_change || 0).toFixed(
                    2
                  )}% vs last year`}
                  icon={<AccountBalance />}
                  color={theme.palette.warning.main}
                  percentageChange={summaryData?.receivables_change || 0}
                  change={summaryData?.receivables_change || 0}
                />
              </Grid>
              <Grid item xs={12} sm={6} lg={3}>
                <CardComponent
                  title="Corporate Subscribers"
                  value={(
                    summaryData?.total_corporate_subscribers || 0
                  ).toLocaleString()}
                  subtitle={`${
                    (summaryData?.subscribers_change || 0) >= 0 ? "+" : ""
                  }${(summaryData?.subscribers_change || 0).toFixed(
                    2
                  )}% vs last year`}
                  icon={<People />}
                  color={theme.palette.info.main}
                  percentageChange={summaryData?.subscribers_change || 0}
                  change={summaryData?.subscribers_change || 0}
                />
              </Grid>
            </Grid>

            {/* KPI Tabs */}
            <Paper sx={{ width: "100%" }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ borderBottom: 1, borderColor: "divider" }}
              >
                <Tab label="Revenue" {...a11yProps(0)} />
                <Tab label="Collections" {...a11yProps(1)} />
                <Tab label="Receivables" {...a11yProps(2)} />
                <Tab label="Corporate Park" {...a11yProps(3)} />
                <Tab label="NGBSS Collections" {...a11yProps(4)} />
                <Tab label="Unfinished Invoices" {...a11yProps(5)} />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                <RevenueKPI />
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <NGBSSCollectionKPI />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <ReceivablesKPI />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <CorporateParkKPI />
              </TabPanel>

              <TabPanel value={tabValue} index={4}>
                <NGBSSCollectionKPI />
              </TabPanel>

              <TabPanel value={tabValue} index={5}>
                <UnfinishedInvoiceKPI />
              </TabPanel>
            </Paper>
          </>
        )}
      </Box>
    </PageLayout>
  );
};

export default KPIDashboard;
