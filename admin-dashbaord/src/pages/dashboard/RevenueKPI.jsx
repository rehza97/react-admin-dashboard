import { useState, useEffect } from "react";
import PropTypes from "prop-types";
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
import { useTheme } from "@mui/material/styles";
import kpiService from "../../services/kpiService";

// Custom tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`revenue-tabpanel-${index}`}
      aria-labelledby={`revenue-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node.isRequired,
  value: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
};

const RevenueKPI = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [periodicRevenueData, setPeriodicRevenueData] = useState(null);
  const [nonPeriodicRevenueData, setNonPeriodicRevenueData] = useState(null);
  const [specialRevenueData, setSpecialRevenueData] = useState({
    dnt: null,
    rfd: null,
    cnt: null,
  });

  // Current year as default
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(currentYear.toString());
  const [monthFilter, setMonthFilter] = useState("");
  const [dotFilter, setDotFilter] = useState("");

  // Generate year options (current year and 5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) =>
    (currentYear - 5 + i).toString()
  );

  // Month options
  const monthOptions = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  // DOT options (simplified for now)
  const dotOptions = [
    { value: "Alger", label: "Alger" },
    { value: "Oran", label: "Oran" },
    { value: "Constantine", label: "Constantine" },
    { value: "Annaba", label: "Annaba" },
    { value: "Blida", label: "Blida" },
  ];

  useEffect(() => {
    fetchData();
  }, [yearFilter, monthFilter, dotFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch revenue KPIs with proper error handling
      const revenueResponse = await kpiService.getRevenueKPIs({
        year: yearFilter,
        month: monthFilter,
        dot: dotFilter,
      });

      if (!revenueResponse) {
        throw new Error("No data received from the server");
      }

      setRevenueData(revenueResponse);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching KPI data:", err);
      setError(err.message || "Failed to load revenue data");
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleYearChange = (event) => {
    setYearFilter(event.target.value);
  };

  const handleMonthChange = (event) => {
    setMonthFilter(event.target.value);
  };

  const handleDotChange = (event) => {
    setDotFilter(event.target.value);
  };

  // Format currency values
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return "N/A";
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage values
  const formatPercentage = (value) => {
    if (value === undefined || value === null) return "N/A";
    return `${value.toFixed(2)}%`;
  };

  // Custom colors for charts
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
    ...Array(20)
      .fill()
      .map((_, i) => theme.palette.primary[(i % 9) * 100 + 100]),
  ];

  return (
    <Paper elevation={2} sx={{ p: 0, borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="revenue tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" />
          <Tab label="Monthly Trends" />
          <Tab label="DOT Analysis" />
        </Tabs>
      </Box>

      {/* Filter controls */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel id="year-filter-label">Year</InputLabel>
          <Select
            labelId="year-filter-label"
            id="year-filter"
            value={yearFilter}
            label="Year"
            onChange={handleYearChange}
          >
            {yearOptions.map((year) => (
              <MenuItem key={year} value={year}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel id="month-filter-label">Month</InputLabel>
          <Select
            labelId="month-filter-label"
            id="month-filter"
            value={monthFilter}
            label="Month"
            onChange={handleMonthChange}
          >
            <MenuItem value="">All Months</MenuItem>
            {monthOptions.map((month) => (
              <MenuItem key={month.value} value={month.value}>
                {month.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel id="dot-filter-label">DOT</InputLabel>
          <Select
            labelId="dot-filter-label"
            id="dot-filter"
            value={dotFilter}
            label="DOT"
            onChange={handleDotChange}
          >
            <MenuItem value="">All DOTs</MenuItem>
            {dotOptions.map((dot) => (
              <MenuItem key={dot.value} value={dot.value}>
                {dot.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Loading and error states */}
      {loading && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            p: 4,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Box sx={{ p: 2 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        </Box>
      )}

      {/* Content tabs */}
      {!loading && !error && revenueData && (
        <>
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 2 }}>
              <Grid container spacing={3}>
                {/* Summary cards */}
                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: theme.palette.background.paper,
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Total Revenue
                    </Typography>
                    <Typography variant="h4" color="primary">
                      {formatCurrency(revenueData.total_revenue)}
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        mt: 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        color={
                          revenueData.growth_percentage >= 0
                            ? "success.main"
                            : "error.main"
                        }
                        sx={{ display: "flex", alignItems: "center" }}
                      >
                        {revenueData.growth_percentage >= 0 ? "+" : ""}
                        {formatPercentage(revenueData.growth_percentage)}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        vs previous year
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: theme.palette.background.paper,
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Previous Year Revenue
                    </Typography>
                    <Typography variant="h4" color="secondary">
                      {formatCurrency(revenueData.previous_year_revenue)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      {yearFilter
                        ? `Year ${parseInt(yearFilter) - 1}`
                        : "Previous year"}
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: theme.palette.background.paper,
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Top DOT
                    </Typography>
                    {revenueData.revenue_by_dot &&
                    revenueData.revenue_by_dot.length > 0 ? (
                      <>
                        <Typography variant="h4" color="info.main">
                          {revenueData.revenue_by_dot[0].organization}
                        </Typography>
                        <Typography variant="body1" sx={{ mt: 1 }}>
                          {formatCurrency(revenueData.revenue_by_dot[0].total)}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body1" color="text.secondary">
                        No DOT data available
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 2, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                Monthly Revenue Trends
              </Typography>
              {revenueData.revenue_by_month &&
              revenueData.revenue_by_month.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueData.revenue_by_month}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month_name"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.substring(0, 3)}
                    />
                    <YAxis
                      tickFormatter={(value) =>
                        new Intl.NumberFormat("fr-DZ", {
                          notation: "compact",
                          compactDisplay: "short",
                        }).format(value)
                      }
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), "Revenue"]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Legend />
                    <Bar
                      dataKey="revenue"
                      name="Revenue"
                      fill={theme.palette.primary.main}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No monthly data available for the selected filters
                  </Typography>
                </Box>
              )}
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 2, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                Revenue by DOT
              </Typography>
              {revenueData.revenue_by_dot &&
              revenueData.revenue_by_dot.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueData.revenue_by_dot}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={150}
                      fill="#8884d8"
                      dataKey="total"
                      nameKey="organization"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {revenueData.revenue_by_dot.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), "Revenue"]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100%",
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No DOT data available for the selected filters
                  </Typography>
                </Box>
              )}
            </Box>
          </TabPanel>
        </>
      )}
    </Paper>
  );
};

export default RevenueKPI;
