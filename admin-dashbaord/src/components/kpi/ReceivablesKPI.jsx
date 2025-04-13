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
  const [yearFilter, setYearFilter] = useState("");
  const [dotFilter, setDotFilter] = useState("");

  // Fetch receivables data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await kpiService.getReceivablesKPIs({
          year: getCurrentYear(),
        });
        setReceivablesData(data);
      } catch (err) {
        console.error("Error fetching receivables data:", err);
        setError("Failed to load receivables data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  // Format currency values
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get unique filter options
  const getUniqueOptions = (data, key) => {
    if (!data || !data.length) return [];

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
                      {getUniqueOptions(
                        receivablesData.receivables_by_year,
                        "year"
                      ).map((year) => (
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
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ textAlign: "center", mb: 2 }}>
                    <Typography variant="h6" color="text.secondary">
                      Total Gross Receivables
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {formatCurrency(
                        receivablesData.total_receivables.total_brut
                      )}
                    </Typography>
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
                        receivablesData.total_receivables.total_net
                      )}
                    </Typography>
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
                        receivablesData.total_receivables.total_ht
                      )}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by DOT
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={receivablesData.receivables_by_dot.map(
                          (item) => ({
                            name: item.dot,
                            value: item.total,
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
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by Product
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={receivablesData.receivables_by_product.map(
                          (item) => ({
                            name: item.product,
                            value: item.total,
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
                </Grid>
              </Grid>
            </TabPanel>

            {/* By Year Tab */}
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Receivables by Year
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={receivablesData.receivables_by_year.map((item) => ({
                    name: item.year,
                    value: item.total,
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
            </TabPanel>

            {/* By DOT Tab */}
            <TabPanel value={tabValue} index={2}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Receivables by DOT
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={receivablesData.receivables_by_dot.map((item) => ({
                    name: item.dot,
                    value: item.total,
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
            </TabPanel>

            {/* By Category Tab */}
            <TabPanel value={tabValue} index={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Receivables by Client Category
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={receivablesData.receivables_by_category.map((item) => ({
                    name: item.customer_lev1,
                    value: item.total,
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
                    fill={theme.palette.success.main}
                  />
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* By Product Tab */}
            <TabPanel value={tabValue} index={4}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Receivables by Product
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={receivablesData.receivables_by_product.map((item) => ({
                    name: item.product,
                    value: item.total,
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
                    fill={theme.palette.warning.main}
                  />
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* Anomalies Tab */}
            <TabPanel value={tabValue} index={5}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Detected Anomalies
              </Typography>

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

              {Object.values(receivablesData.anomalies).every(
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
