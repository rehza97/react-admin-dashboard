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
  Button,
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
import kpiService, { getCurrentYear } from "../../services/kpiService";

// Custom tab panel component
function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`receivables-tabpanel-${index}`}
      aria-labelledby={`receivables-tab-${index}`}
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

const ReceivablesKPI = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [receivablesData, setReceivablesData] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  // Set default year to 2024 where we know data exists
  const [yearFilter, setYearFilter] = useState("2024");
  const [dotFilter, setDotFilter] = useState("");
  const [noData, setNoData] = useState(false);

  // Available years for selection (make sure to include years where we have data)
  const availableYears = ["2024", "2025", "2023", "2022"];

  // Fetch receivables data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("Fetching receivables data with params:", {
          year: yearFilter,
          dot: dotFilter || "All",
        });

        const data = await kpiService.getReceivablesKPIs({
          year: yearFilter || getCurrentYear(),
          dot: dotFilter || undefined,
        });

        console.log("Receivables API response:", data);

        if (!data) {
          console.warn("Empty response received from receivables API");
          setError("No data received from the server. Please try again later.");
          setNoData(true);
          setReceivablesData(null);
        } else {
          // Check if current year has data or if we should show previous year
          const hasCurYearData =
            data.total_receivables > 0 ||
            (data.receivables_by_dot && data.receivables_by_dot.length > 0);

          // If we have previous year data but no current year data, show a message
          if (!hasCurYearData && data.previous_year_receivables > 0) {
            console.log(
              `No data for ${yearFilter}, but previous year has data:`,
              data.previous_year_receivables
            );
          }

          // Initialize default structure to ensure all properties exist
          const processedData = {
            total_receivables: data.total_receivables || 0,
            previous_year_receivables: data.previous_year_receivables || 0,
            growth_percentage: data.growth_percentage || 0,
            receivables_by_year: data.receivables_by_year || [],
            receivables_by_dot: data.receivables_by_dot || [],
            receivables_by_category: data.receivables_by_category || [],
            receivables_by_product: data.receivables_by_product || [],
            receivables_by_age: data.receivables_by_age || [],
            anomalies: data.anomalies || {},
          };

          // If total_receivables is just a number (as shown in logs), convert to expected object structure
          if (typeof processedData.total_receivables === "number") {
            processedData.total_receivables = {
              total_brut: processedData.total_receivables,
              total_net: processedData.total_receivables,
              total_ht: processedData.total_receivables,
            };
          }

          console.log("Setting receivables data:", {
            totalGross: processedData.total_receivables.total_brut,
            totalNet: processedData.total_receivables.total_net,
            previousYear: processedData.previous_year_receivables,
            byYear: processedData.receivables_by_year?.length,
            byDot: processedData.receivables_by_dot?.length,
          });

          setReceivablesData(processedData);

          // Check if meaningful data exists (including previous year data)
          const hasData =
            processedData.total_receivables?.total_brut > 0 ||
            processedData.previous_year_receivables > 0 ||
            processedData.receivables_by_year?.length > 0 ||
            processedData.receivables_by_dot?.length > 0;

          setNoData(!hasData);
        }
      } catch (err) {
        console.error("Error fetching receivables data:", err);
        if (err.message === "Network Error") {
          setError(
            "Network error. Please check your connection and try again."
          );
        } else if (err.response && err.response.status === 404) {
          setError(
            "Data not found for the selected filters. Please try a different selection."
          );
          setNoData(true);
        } else {
          setError("Failed to load receivables data. Please try again later.");
        }
        setReceivablesData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [yearFilter, dotFilter]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle filter changes
  const handleYearChange = (event) => {
    setYearFilter(event.target.value);
  };

  const handleDotChange = (event) => {
    setDotFilter(event.target.value);
  };

  // Reset filters to defaults
  const resetFilters = () => {
    // Set to 2024 since that's where data exists based on API response
    setYearFilter("2024");
    setDotFilter("");
    // Reset back to the overview tab
    setTabValue(0);
  };

  // Format currency values
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  // Get unique filter options
  const getUniqueOptions = (data, key) => {
    if (!data || !Array.isArray(data) || !data.length) return [];

    const uniqueValues = Array.from(new Set(data.map((item) => item[key])));
    return uniqueValues.filter(Boolean).sort();
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
          aria-label="receivables tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" />
          <Tab label="By Year" />
          <Tab label="By DOT" />
          <Tab label="By Category" />
          <Tab label="By Product" />
          <Tab label="Anomalies" />
        </Tabs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "300px",
          }}
        >
          <CircularProgress />
        </Box>
      ) : noData ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "300px",
            flexDirection: "column",
            textAlign: "center",
            p: 3,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No receivables data available
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Try selecting year 2024 to see available data.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            onClick={resetFilters}
            size="small"
          >
            Reset Filters
          </Button>
        </Box>
      ) : (
        receivablesData && (
          <>
            {/* Filters */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: "divider" }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="year-select-label">Year</InputLabel>
                    <Select
                      labelId="year-select-label"
                      id="year-select"
                      value={yearFilter}
                      label="Year"
                      onChange={handleYearChange}
                    >
                      <MenuItem value="">All Years</MenuItem>
                      {availableYears.map((year) => (
                        <MenuItem key={year} value={year}>
                          {year}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="dot-select-label">DOT</InputLabel>
                    <Select
                      labelId="dot-select-label"
                      id="dot-select"
                      value={dotFilter}
                      label="DOT"
                      onChange={handleDotChange}
                    >
                      <MenuItem value="">All DOTs</MenuItem>
                      {getUniqueOptions(
                        receivablesData.receivables_by_dot,
                        "dot"
                      ).map((dot) => (
                        <MenuItem key={dot} value={dot}>
                          {dot}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            {/* Overview Tab */}
            <TabPanel value={tabValue} index={0}>
              {/* Show message if there's previous year data but no current year data */}
              {receivablesData.total_receivables?.total_brut === 0 &&
                receivablesData.previous_year_receivables > 0 && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    No receivables data found for {yearFilter}. Showing previous
                    year data (
                    {receivablesData.previous_year_receivables > 0
                      ? "available"
                      : "not available"}
                    ).
                  </Alert>
                )}

              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: "center", mb: 2 }}>
                    <Typography variant="h6" color="text.secondary">
                      Total Gross Receivables
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {formatCurrency(
                        receivablesData.total_receivables?.total_brut || 0
                      )}
                    </Typography>
                    {receivablesData.total_receivables?.total_brut === 0 &&
                      receivablesData.previous_year_receivables > 0 && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          Previous Year:{" "}
                          {formatCurrency(
                            receivablesData.previous_year_receivables
                          )}
                        </Typography>
                      )}
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: "center", mb: 2 }}>
                    <Typography variant="h6" color="text.secondary">
                      Total Net Receivables
                    </Typography>
                    <Typography
                      variant="h4"
                      fontWeight="bold"
                      color="secondary"
                    >
                      {formatCurrency(
                        receivablesData.total_receivables?.total_net || 0
                      )}
                    </Typography>
                    {receivablesData.total_receivables?.total_net === 0 &&
                      receivablesData.previous_year_receivables > 0 && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          Previous Year:{" "}
                          {formatCurrency(
                            receivablesData.previous_year_receivables
                          )}
                        </Typography>
                      )}
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: "center", mb: 2 }}>
                    <Typography variant="h6" color="text.secondary">
                      Total Pre-Tax Receivables
                    </Typography>
                    <Typography
                      variant="h4"
                      fontWeight="bold"
                      color="info.main"
                    >
                      {formatCurrency(
                        receivablesData.total_receivables?.total_ht || 0
                      )}
                    </Typography>
                    {receivablesData.total_receivables?.total_ht === 0 &&
                      receivablesData.previous_year_receivables > 0 && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          Previous Year:{" "}
                          {formatCurrency(
                            receivablesData.previous_year_receivables
                          )}
                        </Typography>
                      )}
                  </Box>
                </Grid>
              </Grid>

              {/* Add Year-over-Year Change section when previous year data is available */}
              {(receivablesData.previous_year_receivables > 0 ||
                receivablesData.total_receivables?.total_brut > 0) && (
                <>
                  <Divider sx={{ my: 3 }} />
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Year-over-Year Change
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={4}>
                        <Paper
                          elevation={2}
                          sx={{
                            p: 2,
                            textAlign: "center",
                            bgcolor:
                              receivablesData.growth_percentage >= 0
                                ? "success.light"
                                : "error.light",
                            color:
                              receivablesData.growth_percentage >= 0
                                ? "success.contrastText"
                                : "error.contrastText",
                          }}
                        >
                          <Typography variant="h6">
                            {receivablesData.growth_percentage >= 0 ? "+" : ""}
                            {receivablesData.growth_percentage}%
                          </Typography>
                          <Typography variant="body2">
                            Change from Previous Year
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper elevation={2} sx={{ p: 2, textAlign: "center" }}>
                          <Typography variant="h6">
                            {formatCurrency(
                              receivablesData.previous_year_receivables || 0
                            )}
                          </Typography>
                          <Typography variant="body2">
                            Previous Year Receivables
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Paper elevation={2} sx={{ p: 2, textAlign: "center" }}>
                          <Typography variant="h6">
                            {formatCurrency(
                              receivablesData.total_receivables?.total_brut || 0
                            )}
                          </Typography>
                          <Typography variant="body2">
                            Current Year Receivables
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>
                </>
              )}

              <Divider sx={{ my: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by DOT
                  </Typography>
                  {Array.isArray(receivablesData.receivables_by_dot) &&
                  receivablesData.receivables_by_dot.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={receivablesData.receivables_by_dot.map(
                            (item) => ({
                              name: item.dot || "Unknown",
                              value: item.total || 0,
                            })
                          )}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {receivablesData.receivables_by_dot.map(
                            (entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            )
                          )}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                      <Typography variant="body1" color="text.secondary">
                        No DOT distribution data available
                      </Typography>
                    </Box>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by Product
                  </Typography>
                  {Array.isArray(receivablesData.receivables_by_product) &&
                  receivablesData.receivables_by_product.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={receivablesData.receivables_by_product.map(
                            (item) => ({
                              name: item.product || "Unknown",
                              value: item.total || 0,
                            })
                          )}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {receivablesData.receivables_by_product.map(
                            (entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            )
                          )}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box sx={{ textAlign: "center", py: 10 }}>
                      <Typography variant="body1" color="text.secondary">
                        No product distribution data available
                      </Typography>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </TabPanel>

            {/* By Year Tab */}
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Receivables by Year
              </Typography>
              {Array.isArray(receivablesData.receivables_by_year) &&
              receivablesData.receivables_by_year.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={receivablesData.receivables_by_year.map((item) => ({
                      name: item.year || "Unknown",
                      value: item.total || 0,
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar
                      dataKey="value"
                      name="Receivables"
                      fill={theme.palette.primary.main}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: "center", py: 10 }}>
                  <Typography variant="body1" color="text.secondary">
                    No yearly receivables data available
                  </Typography>
                </Box>
              )}
            </TabPanel>

            {/* By DOT Tab */}
            <TabPanel value={tabValue} index={2}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Receivables by DOT
              </Typography>
              {Array.isArray(receivablesData.receivables_by_dot) &&
              receivablesData.receivables_by_dot.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={receivablesData.receivables_by_dot.map((item) => ({
                      name: item.dot || "Unknown",
                      value: item.total || 0,
                    }))}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar
                      dataKey="value"
                      name="Receivables"
                      fill={theme.palette.secondary.main}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: "center", py: 10 }}>
                  <Typography variant="body1" color="text.secondary">
                    No DOT receivables data available
                  </Typography>
                </Box>
              )}
            </TabPanel>

            {/* By Category Tab */}
            <TabPanel value={tabValue} index={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Receivables by Client Category
              </Typography>
              {Array.isArray(receivablesData.receivables_by_category) &&
              receivablesData.receivables_by_category.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={receivablesData.receivables_by_category.map(
                      (item) => ({
                        name: item.customer_lev1 || "Unknown",
                        value: item.total || 0,
                      })
                    )}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar
                      dataKey="value"
                      name="Receivables"
                      fill={theme.palette.success.main}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: "center", py: 10 }}>
                  <Typography variant="body1" color="text.secondary">
                    No category receivables data available
                  </Typography>
                </Box>
              )}
            </TabPanel>

            {/* By Product Tab */}
            <TabPanel value={tabValue} index={4}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Receivables by Product
              </Typography>
              {Array.isArray(receivablesData.receivables_by_product) &&
              receivablesData.receivables_by_product.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={receivablesData.receivables_by_product.map(
                      (item) => ({
                        name: item.product || "Unknown",
                        value: item.total || 0,
                      })
                    )}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Bar
                      dataKey="value"
                      name="Receivables"
                      fill={theme.palette.warning.main}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ textAlign: "center", py: 10 }}>
                  <Typography variant="body1" color="text.secondary">
                    No product receivables data available
                  </Typography>
                </Box>
              )}
            </TabPanel>

            {/* Anomalies Tab */}
            <TabPanel value={tabValue} index={5}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Detected Anomalies
              </Typography>

              {receivablesData.anomalies &&
              Object.keys(receivablesData.anomalies).length > 0 ? (
                <Grid container spacing={2}>
                  {Object.entries(receivablesData.anomalies).map(
                    ([key, value]) => (
                      <Grid item xs={12} sm={6} md={4} key={key}>
                        <Paper
                          elevation={1}
                          sx={{
                            p: 2,
                            borderRadius: 1,
                            bgcolor:
                              value > 0
                                ? theme.palette.error.light
                                : theme.palette.success.light,
                            color:
                              value > 0
                                ? theme.palette.error.contrastText
                                : theme.palette.success.contrastText,
                            textAlign: "center",
                          }}
                        >
                          <Typography variant="h6">{value}</Typography>
                          <Typography variant="body2">
                            {key
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Typography>
                        </Paper>
                      </Grid>
                    )
                  )}
                </Grid>
              ) : (
                <Box sx={{ textAlign: "center", mt: 3 }}>
                  <Typography variant="h6" color="success.main">
                    No anomalies detected
                  </Typography>
                </Box>
              )}

              {receivablesData.anomalies &&
                Object.keys(receivablesData.anomalies).length > 0 &&
                Object.values(receivablesData.anomalies).every(
                  (val) => val === 0
                ) && (
                  <Box sx={{ textAlign: "center", mt: 3 }}>
                    <Typography variant="h6" color="success.main">
                      No anomalies detected
                    </Typography>
                  </Box>
                )}
            </TabPanel>
          </>
        )
      )}
    </Paper>
  );
};

export default ReceivablesKPI;
