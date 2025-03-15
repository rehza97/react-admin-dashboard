import React, { useState, useEffect } from "react";
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
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
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
} from "recharts";
import { useTheme } from "@mui/material/styles";
import kpiService from "../../services/kpiService";
import dataService from "../../services/dataService";

// Custom tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`collection-tabpanel-${index}`}
      aria-labelledby={`collection-tab-${index}`}
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

const NGBSSCollectionKPI = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [collectionData, setCollectionData] = useState(null);
  const [dots, setDots] = useState([]);
  const [loadingDots, setLoadingDots] = useState(true);
  const [noData, setNoData] = useState(false);

  // Current year as default
  const currentYear = new Date().getFullYear();
  // Default to 2024 since that's where we have data
  const [yearFilter, setYearFilter] = useState("2024");
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

  // Fetch DOTs from API
  useEffect(() => {
    const fetchDOTs = async () => {
      setLoadingDots(true);
      try {
        const dotsData = await dataService.getDOTs();
        if (dotsData && Array.isArray(dotsData)) {
          setDots(dotsData);
        } else {
          console.warn("Invalid DOTs data:", dotsData);
          setDots([]);
        }
      } catch (err) {
        console.error("Error fetching DOTs:", err);
        setDots([]);
      } finally {
        setLoadingDots(false);
      }
    };

    fetchDOTs();
  }, []);

  useEffect(() => {
    fetchData();
  }, [yearFilter, monthFilter, dotFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setNoData(false);
    try {
      // Build query parameters
      const params = {
        year: yearFilter,
        month: monthFilter || undefined,
        dot: dotFilter || undefined,
        compare_with_previous: "true",
        compare_with_objectives: "true",
      };

      const response = await kpiService.getNGBSSCollectionKPIs(params);

      // Handle the response properly - it should include data property from axios
      if (response && response.data) {
        console.log("NGBSS Collection data:", response.data);

        // Check if we have any meaningful data
        const hasData =
          response.data.total_invoiced > 0 ||
          response.data.total_collected > 0 ||
          (response.data.collection_by_dot &&
            response.data.collection_by_dot.length > 0);

        if (!hasData) {
          console.warn(
            `No collection data found for year: ${yearFilter}, month: ${
              monthFilter || "All"
            }, dot: ${dotFilter || "All"}`
          );
          setNoData(true);
        } else {
          setNoData(false);
        }

        setCollectionData(response.data);
      } else {
        console.warn("Invalid response from NGBSS Collection API:", response);
        setError("Received empty or invalid response from the server.");
      }
    } catch (err) {
      console.error("Error fetching NGBSS collection data:", err);
      setError("Failed to load NGBSS collection data. Please try again later.");
    } finally {
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

  // Colors for charts
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    // Additional colors
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff8042",
  ];

  // Helper function to check if there's meaningful data to display
  const hasMeaningfulData = (data) => {
    if (!data) return false;

    // Check if there are any non-zero values or collection_by_dot items
    return (
      data.total_invoiced > 0 ||
      data.total_collected > 0 ||
      data.total_open > 0 ||
      (data.collection_by_dot && data.collection_by_dot.length > 0)
    );
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "400px",
        }}
      >
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

  console.log("Rendering with collectionData:", collectionData);
  console.log("Collection data is valid?", !!collectionData);
  console.log("Has meaningful data?", hasMeaningfulData(collectionData));

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          mb: 3,
        }}
      >
        <Typography variant="h5" component="h2" gutterBottom>
          NGBSS Collections Analysis
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
              {yearOptions.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
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
              <MenuItem value="">All Months</MenuItem>
              {monthOptions.map((month) => (
                <MenuItem key={month.value} value={month.value}>
                  {month.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel id="dot-filter-label">DOT</InputLabel>
            <Select
              labelId="dot-filter-label"
              value={dotFilter}
              onChange={handleDotChange}
              label="DOT"
              disabled={loadingDots}
            >
              <MenuItem value="">All DOTs</MenuItem>
              {dots.map((dot) => (
                <MenuItem key={dot.id} value={dot.id}>
                  {dot.name} ({dot.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {noData && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No collection data available for the selected filters. Try changing
          the year, month, or DOT.
        </Alert>
      )}

      {collectionData && hasMeaningfulData(collectionData) && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  bgcolor: theme.palette.primary.light,
                  color: theme.palette.primary.contrastText,
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Current Year Collections
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(
                    collectionData.total_current_year ||
                      collectionData.total_collected ||
                      0
                  )}
                </Typography>
                {collectionData.achievement_percentage !== undefined && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {formatPercentage(collectionData.achievement_percentage)} of
                    objective
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  bgcolor: theme.palette.secondary.light,
                  color: theme.palette.secondary.contrastText,
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Previous Year Collections
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(collectionData.total_previous_year || 0)}
                </Typography>
                {collectionData.change_percentage !== undefined && (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1,
                      color:
                        collectionData.change_percentage >= 0
                          ? "success.main"
                          : "error.main",
                    }}
                  >
                    {collectionData.change_percentage >= 0 ? "+" : ""}
                    {formatPercentage(collectionData.change_percentage)} vs
                    previous year
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  bgcolor: theme.palette.success.light,
                  color: theme.palette.success.contrastText,
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Collection Objective
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(collectionData.total_objective || 0)}
                </Typography>
                {collectionData.achievement_percentage !== undefined && (
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1,
                      color:
                        collectionData.achievement_percentage >= 100
                          ? "success.main"
                          : collectionData.achievement_percentage >= 80
                          ? "warning.main"
                          : "error.main",
                    }}
                  >
                    {formatPercentage(collectionData.achievement_percentage)}{" "}
                    achieved
                  </Typography>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  bgcolor: theme.palette.info.light,
                  color: theme.palette.info.contrastText,
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Collection Rate
                </Typography>
                <Typography variant="h4">
                  {collectionData.collection_rate !== undefined &&
                  collectionData.collection_rate !== null
                    ? formatPercentage(collectionData.collection_rate)
                    : "N/A"}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  of total invoiced amount
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Tabs for different visualizations */}
          <Paper elevation={3} sx={{ mb: 4 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: "divider" }}
            >
              <Tab label="By DOT" />
              <Tab label="Monthly Trend" />
              <Tab label="Comparison with Previous Year" />
              <Tab label="Objective Achievement" />
              {collectionData.by_client_category?.length > 0 && (
                <Tab label="By Client Category" />
              )}
              {collectionData.by_product?.length > 0 && (
                <Tab label="By Product" />
              )}
            </Tabs>

            {/* By DOT Tab */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={collectionData.by_dot}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dot"
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
                      formatter={(value) => [
                        formatCurrency(value),
                        "Collection Amount",
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="total"
                      name="Collection Amount"
                      fill={theme.palette.primary.main}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </TabPanel>

            {/* Monthly Trend Tab */}
            <TabPanel value={tabValue} index={1}>
              {collectionData.by_month && collectionData.by_month.length > 0 ? (
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={collectionData.by_month.map((item) => ({
                        ...item,
                        month:
                          monthOptions.find(
                            (m) => m.value === item.month.toString()
                          )?.label || item.month,
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("fr-DZ", {
                            notation: "compact",
                            compactDisplay: "short",
                          }).format(value)
                        }
                      />
                      <Tooltip
                        formatter={(value) => [
                          formatCurrency(value),
                          "Collection Amount",
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Collection Amount"
                        stroke={theme.palette.primary.main}
                        activeDot={{ r: 8 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography variant="body1" sx={{ p: 2 }}>
                  Monthly data is not available or you have selected a specific
                  month.
                </Typography>
              )}
            </TabPanel>

            {/* Comparison with Previous Year Tab */}
            <TabPanel value={tabValue} index={2}>
              {collectionData.dot_comparison &&
              collectionData.dot_comparison.length > 0 ? (
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={collectionData.dot_comparison}
                      margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="dot"
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
                        formatter={(value) => [formatCurrency(value), ""]}
                      />
                      <Legend />
                      <Bar
                        dataKey="current_total"
                        name="Current Year"
                        fill={theme.palette.primary.main}
                      />
                      <Bar
                        dataKey="previous_total"
                        name="Previous Year"
                        fill={theme.palette.secondary.main}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography variant="body1" sx={{ p: 2 }}>
                  Comparison data with previous year is not available.
                </Typography>
              )}
            </TabPanel>

            {/* Objective Achievement Tab */}
            <TabPanel value={tabValue} index={3}>
              {collectionData.dot_achievement &&
              collectionData.dot_achievement.length > 0 ? (
                <Box sx={{ height: 400 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={collectionData.dot_achievement}
                      margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="dot"
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
                        formatter={(value) => [formatCurrency(value), ""]}
                      />
                      <Legend />
                      <Bar
                        dataKey="current_total"
                        name="Actual Collection"
                        fill={theme.palette.primary.main}
                      />
                      <Bar
                        dataKey="objective_total"
                        name="Objective"
                        fill={theme.palette.success.main}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography variant="body1" sx={{ p: 2 }}>
                  Objective achievement data is not available.
                </Typography>
              )}
            </TabPanel>

            {/* By Client Category Tab */}
            {collectionData.by_client_category?.length > 0 && (
              <TabPanel value={tabValue} index={4}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={collectionData.by_client_category}
                            dataKey="total"
                            nameKey="customer_lev1"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            fill={theme.palette.primary.main}
                            label={(entry) =>
                              `${entry.customer_lev1}: ${formatCurrency(
                                entry.total
                              )}`
                            }
                          >
                            {collectionData.by_client_category.map(
                              (entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              )
                            )}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              formatCurrency(value),
                              "Collection Amount",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={collectionData.by_client_category}
                          margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="customer_lev1"
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
                            formatter={(value) => [
                              formatCurrency(value),
                              "Collection Amount",
                            ]}
                          />
                          <Legend />
                          <Bar
                            dataKey="total"
                            name="Collection Amount"
                            fill={theme.palette.primary.main}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                </Grid>
              </TabPanel>
            )}

            {/* By Product Tab */}
            {collectionData.by_product?.length > 0 && (
              <TabPanel value={tabValue} index={5}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={collectionData.by_product}
                            dataKey="total"
                            nameKey="product"
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            fill={theme.palette.primary.main}
                            label={(entry) =>
                              `${entry.product}: ${formatCurrency(entry.total)}`
                            }
                          >
                            {collectionData.by_product.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [
                              formatCurrency(value),
                              "Collection Amount",
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ height: 400 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={collectionData.by_product}
                          margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="product"
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
                            formatter={(value) => [
                              formatCurrency(value),
                              "Collection Amount",
                            ]}
                          />
                          <Legend />
                          <Bar
                            dataKey="total"
                            name="Collection Amount"
                            fill={theme.palette.primary.main}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                </Grid>
              </TabPanel>
            )}
          </Paper>

          {/* Only show tabs if there is dot data to display */}
          {collectionData.collection_by_dot &&
          collectionData.collection_by_dot.length > 0 ? (
            <Box>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                sx={{ mb: 3 }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Table View" />
                <Tab label="Chart View" />
              </Tabs>

              {/* Tab Panel content */}
              {tabValue === 0 && (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>DOT</TableCell>
                        <TableCell align="right">Invoiced</TableCell>
                        <TableCell align="right">Collected</TableCell>
                        <TableCell align="right">Open Balance</TableCell>
                        <TableCell align="right">Collection Rate</TableCell>
                        <TableCell align="right">Previous Year</TableCell>
                        <TableCell align="right">Change</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {collectionData.collection_by_dot &&
                        collectionData.collection_by_dot.map((dot) => (
                          <TableRow key={dot.dot_id || dot.dot_name}>
                            <TableCell>{dot.dot_name}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(dot.invoiced)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(dot.collected)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(dot.open_balance)}
                            </TableCell>
                            <TableCell align="right">
                              {dot.collection_rate !== undefined
                                ? formatPercentage(dot.collection_rate)
                                : "N/A"}
                            </TableCell>
                            <TableCell align="right">
                              {dot.previous_year !== undefined
                                ? formatCurrency(dot.previous_year)
                                : "N/A"}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{
                                color:
                                  dot.change_percentage > 0
                                    ? "success.main"
                                    : dot.change_percentage < 0
                                    ? "error.main"
                                    : "inherit",
                              }}
                            >
                              {dot.change_percentage !== undefined
                                ? (dot.change_percentage > 0 ? "+" : "") +
                                  formatPercentage(dot.change_percentage)
                                : "N/A"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {tabValue === 1 && (
                <Box>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={collectionData.collection_by_dot}
                      margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 60,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="dot_name"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar
                        dataKey="invoiced"
                        name="Invoiced"
                        fill={COLORS[0]}
                      />
                      <Bar
                        dataKey="collected"
                        name="Collected"
                        fill={COLORS[1]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Box>
          ) : (
            <Paper sx={{ p: 3, mt: 3, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No detailed DOT collection data available for the selected
                filters.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                However, summary data is available and displayed above.
              </Typography>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default NGBSSCollectionKPI;
