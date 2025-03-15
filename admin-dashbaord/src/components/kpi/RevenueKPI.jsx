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
  LineChart,
  Line,
  ReferenceLine,
  Label,
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
      // Fetch revenue KPIs
      const revenueResponse = await kpiService.getRevenueKPIs({
        year: yearFilter,
        month: monthFilter,
        dot: dotFilter,
      });
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

  // Get color based on achievement rate
  const getAchievementColor = (rate) => {
    if (rate >= 100) return theme.palette.success.main;
    if (rate >= 80) return theme.palette.warning.main;
    return theme.palette.error.main;
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
          <Tab label="Revenue Breakdown" />
          <Tab label="Achievement Rate" />
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

          {/* Revenue Breakdown Waterfall Chart */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Revenue Breakdown
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Breakdown of total revenue into regular revenue, previous
                exercise revenue, and advance billing
              </Typography>

              {revenueData && revenueData.current_year ? (
                <Box sx={{ height: 500, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: "Total Revenue",
                          value: revenueData.current_year.total_revenue || 0,
                          isTotal: true,
                        },
                        {
                          name: "Regular Revenue",
                          value: revenueData.current_year.regular_revenue || 0,
                          fill: theme.palette.primary.main,
                        },
                        {
                          name: "Previous Exercise",
                          value:
                            revenueData.current_year
                              .previous_exercise_revenue || 0,
                          fill: theme.palette.warning.main,
                        },
                        {
                          name: "Advance Billing",
                          value:
                            revenueData.current_year.advance_billing_revenue ||
                            0,
                          fill: theme.palette.info.main,
                        },
                      ]}
                      margin={{ top: 20, right: 30, left: 30, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={70}
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
                        formatter={(value) => [formatCurrency(value), "Amount"]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                      <Bar
                        dataKey="value"
                        fill={(entry) =>
                          entry.fill || theme.palette.success.main
                        }
                        radius={[4, 4, 0, 0]}
                        maxBarSize={100}
                      >
                        {[
                          {
                            name: "Total Revenue",
                            value: revenueData.current_year.total_revenue || 0,
                            isTotal: true,
                          },
                          {
                            name: "Regular Revenue",
                            value:
                              revenueData.current_year.regular_revenue || 0,
                            fill: theme.palette.primary.main,
                          },
                          {
                            name: "Previous Exercise",
                            value:
                              revenueData.current_year
                                .previous_exercise_revenue || 0,
                            fill: theme.palette.warning.main,
                          },
                          {
                            name: "Advance Billing",
                            value:
                              revenueData.current_year
                                .advance_billing_revenue || 0,
                            fill: theme.palette.info.main,
                          },
                        ].map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.fill ||
                              (entry.isTotal
                                ? theme.palette.success.main
                                : theme.palette.primary.main)
                            }
                          />
                        ))}
                      </Bar>
                      <ReferenceLine y={0} stroke="#000" strokeWidth={1} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 300,
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No revenue breakdown data available for the selected filters
                  </Typography>
                </Box>
              )}

              {/* Revenue Components Explanation */}
              <Grid container spacing={3} sx={{ mt: 2 }}>
                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: theme.palette.background.paper,
                      borderLeft: `4px solid ${theme.palette.primary.main}`,
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Regular Revenue
                    </Typography>
                    <Typography variant="h5" color="primary">
                      {formatCurrency(
                        revenueData?.current_year?.regular_revenue || 0
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Revenue from current exercise, excluding previous exercise
                      and advance billing
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: theme.palette.background.paper,
                      borderLeft: `4px solid ${theme.palette.warning.main}`,
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Previous Exercise
                    </Typography>
                    <Typography variant="h5" color="warning.main">
                      {formatCurrency(
                        revenueData?.current_year?.previous_exercise_revenue ||
                          0
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Revenue from previous exercise (account codes ending with
                      'A' or gl_date from previous years)
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Paper
                    elevation={1}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: theme.palette.background.paper,
                      borderLeft: `4px solid ${theme.palette.info.main}`,
                    }}
                  >
                    <Typography variant="h6" gutterBottom>
                      Advance Billing
                    </Typography>
                    <Typography variant="h5" color="info.main">
                      {formatCurrency(
                        revenueData?.current_year?.advance_billing_revenue || 0
                      )}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Revenue from advance billing (invoice date not in current
                      exercise)
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>

          {/* Achievement Rate Visualization */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Achievement Rate Against Objectives
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Visualization of revenue achievement rate against objectives and
                comparison with previous year
              </Typography>

              {revenueData &&
              revenueData.objectives &&
              revenueData.performance_rates ? (
                <Grid container spacing={4}>
                  {/* Gauge Chart for Achievement Rate */}
                  <Grid item xs={12} md={6}>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 3,
                        borderRadius: 2,
                        backgroundColor: theme.palette.background.paper,
                        height: "100%",
                      }}
                    >
                      <Typography variant="h6" align="center" gutterBottom>
                        Current Achievement Rate
                      </Typography>

                      <Box
                        sx={{
                          position: "relative",
                          height: 300,
                          width: "100%",
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                {
                                  name: "Achieved",
                                  value:
                                    revenueData.performance_rates
                                      .achievement_rate || 0,
                                  fill: getAchievementColor(
                                    revenueData.performance_rates
                                      .achievement_rate
                                  ),
                                },
                                {
                                  name: "Remaining",
                                  value: Math.max(
                                    0,
                                    100 -
                                      (revenueData.performance_rates
                                        .achievement_rate || 0)
                                  ),
                                  fill: theme.palette.grey[300],
                                },
                              ]}
                              cx="50%"
                              cy="50%"
                              startAngle={180}
                              endAngle={0}
                              innerRadius={80}
                              outerRadius={120}
                              paddingAngle={0}
                              dataKey="value"
                            >
                              {[
                                {
                                  name: "Achieved",
                                  value:
                                    revenueData.performance_rates
                                      .achievement_rate || 0,
                                  fill: getAchievementColor(
                                    revenueData.performance_rates
                                      .achievement_rate
                                  ),
                                },
                                {
                                  name: "Remaining",
                                  value: Math.max(
                                    0,
                                    100 -
                                      (revenueData.performance_rates
                                        .achievement_rate || 0)
                                  ),
                                  fill: theme.palette.grey[300],
                                },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => [
                                `${value.toFixed(2)}%`,
                                "Achievement",
                              ]}
                            />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* Center Text */}
                        <Box
                          sx={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            textAlign: "center",
                          }}
                        >
                          <Typography
                            variant="h4"
                            color={getAchievementColor(
                              revenueData.performance_rates.achievement_rate
                            )}
                          >
                            {formatPercentage(
                              revenueData.performance_rates.achievement_rate ||
                                0
                            )}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Achievement Rate
                          </Typography>
                        </Box>
                      </Box>

                      {/* Achievement Details */}
                      <Box sx={{ mt: 2 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">
                              Current Revenue:
                            </Typography>
                            <Typography variant="body1" fontWeight="bold">
                              {formatCurrency(
                                revenueData.current_year?.total_revenue || 0
                              )}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">
                              Objective:
                            </Typography>
                            <Typography variant="body1" fontWeight="bold">
                              {formatCurrency(
                                revenueData.objectives?.total || 0
                              )}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                              Gap to Objective:
                            </Typography>
                            <Typography
                              variant="body1"
                              fontWeight="bold"
                              color={
                                revenueData.performance_rates.achievement_gap >=
                                0
                                  ? "success.main"
                                  : "error.main"
                              }
                            >
                              {formatCurrency(
                                revenueData.performance_rates.achievement_gap ||
                                  0
                              )}
                              {revenueData.performance_rates.achievement_gap >=
                              0
                                ? " (Exceeded)"
                                : ""}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Comparison with Previous Year */}
                  <Grid item xs={12} md={6}>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 3,
                        borderRadius: 2,
                        backgroundColor: theme.palette.background.paper,
                        height: "100%",
                      }}
                    >
                      <Typography variant="h6" align="center" gutterBottom>
                        Year-over-Year Comparison
                      </Typography>

                      <Box sx={{ height: 300, width: "100%" }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={[
                              {
                                name: "Current Year",
                                achievement:
                                  revenueData.performance_rates
                                    .achievement_rate || 0,
                                revenue:
                                  revenueData.current_year?.total_revenue || 0,
                              },
                              {
                                name: "Previous Year",
                                achievement:
                                  revenueData.previous_year_achievement_rate ||
                                  0,
                                revenue: revenueData.previous_year_revenue || 0,
                              },
                            ]}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis
                              yAxisId="left"
                              orientation="left"
                              label={{
                                value: "Achievement %",
                                angle: -90,
                                position: "insideLeft",
                              }}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tickFormatter={(value) => formatCurrency(value)}
                            />
                            <Tooltip
                              formatter={(value, name) => {
                                if (name === "achievement")
                                  return [
                                    `${value.toFixed(2)}%`,
                                    "Achievement Rate",
                                  ];
                                return [formatCurrency(value), "Revenue"];
                              }}
                            />
                            <Legend />
                            <Bar
                              yAxisId="left"
                              dataKey="achievement"
                              name="Achievement Rate %"
                              fill={theme.palette.primary.main}
                            />
                            <Bar
                              yAxisId="right"
                              dataKey="revenue"
                              name="Revenue"
                              fill={theme.palette.secondary.main}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>

                      {/* Evolution Details */}
                      <Box sx={{ mt: 2 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                              Revenue Evolution:
                            </Typography>
                            <Typography
                              variant="body1"
                              fontWeight="bold"
                              color={
                                revenueData.performance_rates.evolution_rate >=
                                0
                                  ? "success.main"
                                  : "error.main"
                              }
                            >
                              {revenueData.performance_rates.evolution_rate >= 0
                                ? "+"
                                : ""}
                              {formatPercentage(
                                revenueData.performance_rates.evolution_rate ||
                                  0
                              )}{" "}
                              (
                              {formatCurrency(
                                revenueData.performance_rates
                                  .evolution_amount || 0
                              )}
                              )
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">
                              Achievement Rate Evolution:
                            </Typography>
                            <Typography
                              variant="body1"
                              fontWeight="bold"
                              color={
                                revenueData.performance_rates.achievement_rate -
                                  (revenueData.previous_year_achievement_rate ||
                                    0) >=
                                0
                                  ? "success.main"
                                  : "error.main"
                              }
                            >
                              {revenueData.performance_rates.achievement_rate -
                                (revenueData.previous_year_achievement_rate ||
                                  0) >=
                              0
                                ? "+"
                                : ""}
                              {(
                                (revenueData.performance_rates
                                  .achievement_rate || 0) -
                                (revenueData.previous_year_achievement_rate ||
                                  0)
                              ).toFixed(2)}
                              %
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Achievement by DOT */}
                  <Grid item xs={12}>
                    <Paper
                      elevation={1}
                      sx={{
                        p: 3,
                        borderRadius: 2,
                        backgroundColor: theme.palette.background.paper,
                      }}
                    >
                      <Typography variant="h6" gutterBottom>
                        Achievement Rate by DOT
                      </Typography>

                      {revenueData.objectives?.by_organization &&
                      revenueData.objectives.by_organization.length > 0 ? (
                        <Box sx={{ height: 400, width: "100%" }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={revenueData.objectives.by_organization.map(
                                (org) => {
                                  const dotRevenue =
                                    revenueData.revenue_by_dot?.find(
                                      (d) => d.organization === org.dot
                                    )?.total || 0;
                                  const achievementRate =
                                    org.total > 0
                                      ? (dotRevenue / org.total) * 100
                                      : 0;

                                  return {
                                    name: org.dot,
                                    objective: org.total,
                                    revenue: dotRevenue,
                                    achievement: achievementRate,
                                    color: getAchievementColor(achievementRate),
                                  };
                                }
                              )}
                              margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 70,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12 }}
                                angle={-45}
                                textAnchor="end"
                                height={70}
                              />
                              <YAxis
                                yAxisId="left"
                                tickFormatter={(value) => `${value}%`}
                                domain={[0, 120]}
                              />
                              <YAxis
                                yAxisId="right"
                                orientation="right"
                                tickFormatter={(value) => formatCurrency(value)}
                              />
                              <Tooltip
                                formatter={(value, name) => {
                                  if (name === "achievement")
                                    return [
                                      `${value.toFixed(2)}%`,
                                      "Achievement Rate",
                                    ];
                                  return [
                                    formatCurrency(value),
                                    name === "objective"
                                      ? "Objective"
                                      : "Revenue",
                                  ];
                                }}
                              />
                              <Legend />
                              <Bar
                                yAxisId="right"
                                dataKey="objective"
                                name="Objective"
                                fill={theme.palette.grey[500]}
                              />
                              <Bar
                                yAxisId="right"
                                dataKey="revenue"
                                name="Revenue"
                                fill={theme.palette.primary.main}
                              />
                              <Bar
                                yAxisId="left"
                                dataKey="achievement"
                                name="Achievement Rate"
                                fill={theme.palette.success.main}
                              >
                                {revenueData.objectives.by_organization.map(
                                  (entry, index) => {
                                    const dotRevenue =
                                      revenueData.revenue_by_dot?.find(
                                        (d) => d.organization === entry.dot
                                      )?.total || 0;
                                    const achievementRate =
                                      entry.total > 0
                                        ? (dotRevenue / entry.total) * 100
                                        : 0;

                                    return (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={getAchievementColor(
                                          achievementRate
                                        )}
                                      />
                                    );
                                  }
                                )}
                              </Bar>
                              <ReferenceLine
                                yAxisId="left"
                                y={100}
                                stroke={theme.palette.success.main}
                                strokeDasharray="3 3"
                              >
                                <Label
                                  value="100% Target"
                                  position="insideBottomRight"
                                />
                              </ReferenceLine>
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            height: 200,
                          }}
                        >
                          <Typography variant="body1" color="text.secondary">
                            No DOT achievement data available for the selected
                            filters
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: 300,
                  }}
                >
                  <Typography variant="body1" color="text.secondary">
                    No achievement data available for the selected filters
                  </Typography>
                </Box>
              )}
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
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

          <TabPanel value={tabValue} index={4}>
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
