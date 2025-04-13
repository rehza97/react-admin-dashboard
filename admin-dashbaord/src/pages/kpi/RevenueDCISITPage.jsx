import { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import PageLayout from "../../components/PageLayout";
import kpiService from "../../services/kpiService";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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

const RevenueDCISITPage = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    year: "",
    month: "",
    department: "",
    product: "",
  });
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await kpiService.getDCISITRevenueKPIs(filters);
      setData(response);

      // Extract unique departments and products for filter dropdowns
      if (response.departments && response.departments.length > 0) {
        const uniqueDepartments = response.departments.map((dept) => dept.name);
        setDepartmentOptions(uniqueDepartments);
      }

      if (response.products && response.products.length > 0) {
        const uniqueProducts = response.products.map((prod) => prod.name);
        setProductOptions(uniqueProducts);
      }
    } catch (err) {
      console.error("Error fetching DCISIT revenue data:", err);
      setError("Failed to load DCISIT revenue data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleApplyFilters = () => {
    fetchData();
  };

  const handleResetFilters = () => {
    setFilters({
      year: "",
      month: "",
      department: "",
      product: "",
    });
  };

  // Format number as currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("fr-DZ", {
      style: "currency",
      currency: "DZD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value) => {
    return `${value.toFixed(1)}%`;
  };

  // Colors for charts
  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    "#8884d8",
    "#82ca9d",
    "#ff7300",
    "#0088FE",
  ];

  // Monthly names for axis labels
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Prepare data for monthly trends chart
  const getMonthlyTrendsData = () => {
    if (!data || !data.monthly_trends) return [];

    return data.monthly_trends.map((item) => ({
      month: MONTHS[item.month - 1],
      revenue: item.revenue,
      collection: item.collection,
    }));
  };

  return (
    <PageLayout
      title="DCISIT Revenue Analysis"
      subtitle="Monitor and analyze DCISIT revenue performance"
    >
      {/* Filters */}
      <Box sx={{ p: 3, mb: 2 }}>
        <Paper elevation={0} sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Year</InputLabel>
                <Select
                  name="year"
                  value={filters.year}
                  label="Year"
                  onChange={handleFilterChange}
                >
                  <MenuItem value="">All Years</MenuItem>
                  {[...Array(10)].map((_, i) => {
                    const year = new Date().getFullYear() - i;
                    return (
                      <MenuItem key={year} value={year}>
                        {year}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Month</InputLabel>
                <Select
                  name="month"
                  value={filters.month}
                  label="Month"
                  onChange={handleFilterChange}
                >
                  <MenuItem value="">All Months</MenuItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <MenuItem key={month} value={month}>
                      {new Date(2000, month - 1, 1).toLocaleString("default", {
                        month: "long",
                      })}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Department</InputLabel>
                <Select
                  name="department"
                  value={filters.department}
                  label="Department"
                  onChange={handleFilterChange}
                >
                  <MenuItem value="">All Departments</MenuItem>
                  {departmentOptions.map((dept) => (
                    <MenuItem key={dept} value={dept}>
                      {dept}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Product</InputLabel>
                <Select
                  name="product"
                  value={filters.product}
                  label="Product"
                  onChange={handleFilterChange}
                >
                  <MenuItem value="">All Products</MenuItem>
                  {productOptions.map((prod) => (
                    <MenuItem key={prod} value={prod}>
                      {prod}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleApplyFilters}
              >
                Apply Filters
              </Button>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ m: 3 }}>
          {error}
        </Alert>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <Box sx={{ p: 3, mb: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={4}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Total Revenue
                    </Typography>
                    <Typography variant="h4" sx={{ mt: 1, mb: 1 }}>
                      {formatCurrency(data.summary.total_revenue)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Based on {data.summary.journal_count} transactions
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Total Collection
                    </Typography>
                    <Typography variant="h4" sx={{ mt: 1, mb: 1 }}>
                      {formatCurrency(data.summary.total_collection)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Based on {data.summary.etat_count} transactions
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <Card elevation={3}>
                  <CardContent>
                    <Typography variant="subtitle2" color="textSecondary">
                      Collection Rate
                    </Typography>
                    <Typography variant="h4" sx={{ mt: 1, mb: 1 }}>
                      {formatPercentage(data.summary.collection_rate)}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {data.summary.collection_rate > 75
                        ? "Good"
                        : data.summary.collection_rate > 50
                        ? "Average"
                        : "Needs Improvement"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          {/* Charts */}
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Department Revenue */}
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 3, height: "400px" }}>
                  <Typography variant="h6" gutterBottom>
                    Revenue by Department
                  </Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart
                      data={data.departments}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("fr-DZ").format(value)
                        }
                      />
                      <YAxis type="category" dataKey="name" width={150} />
                      <Tooltip
                        formatter={(value) => [
                          formatCurrency(value),
                          "Revenue",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="total"
                        fill={theme.palette.primary.main}
                        name="Revenue"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Product Revenue */}
              <Grid item xs={12} md={6}>
                <Paper elevation={0} sx={{ p: 3, height: "400px" }}>
                  <Typography variant="h6" gutterBottom>
                    Revenue by Product
                  </Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <PieChart>
                      <Pie
                        data={data.products}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={({ name, total }) =>
                          `${name}: ${formatCurrency(total)}`
                        }
                      >
                        {data.products.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>

              {/* Monthly Trends */}
              <Grid item xs={12}>
                <Paper elevation={0} sx={{ p: 3, height: "400px" }}>
                  <Typography variant="h6" gutterBottom>
                    Monthly Revenue & Collection Trends
                  </Typography>
                  <ResponsiveContainer width="100%" height="90%">
                    <LineChart
                      data={getMonthlyTrendsData()}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis
                        tickFormatter={(value) =>
                          new Intl.NumberFormat("fr-DZ", {
                            notation: "compact",
                          }).format(value)
                        }
                      />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke={theme.palette.primary.main}
                        strokeWidth={2}
                        activeDot={{ r: 8 }}
                        name="Revenue"
                      />
                      <Line
                        type="monotone"
                        dataKey="collection"
                        stroke={theme.palette.secondary.main}
                        strokeWidth={2}
                        name="Collection"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          {/* Anomalies */}
          {data.anomalies && (
            <Box sx={{ p: 3 }}>
              <Paper elevation={0} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Data Anomalies
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="textSecondary">
                          Empty Invoice Numbers
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 1 }}>
                          {data.anomalies.empty_invoice_number}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="textSecondary">
                          Empty Client Information
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 1 }}>
                          {data.anomalies.empty_client}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="textSecondary">
                          Zero/Empty Revenue
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 1 }}>
                          {data.anomalies.empty_revenue}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="textSecondary">
                          Duplicate Records
                        </Typography>
                        <Typography variant="h5" sx={{ mt: 1 }}>
                          {data.anomalies.duplicates}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          )}

          {/* Applied Filters */}
          <Box sx={{ p: 3 }}>
            <Paper elevation={0} sx={{ p: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Applied Filters
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                <Chip
                  label={
                    data.applied_filters.year
                      ? `Year: ${data.applied_filters.year}`
                      : "Year: All Years"
                  }
                />
                {data.applied_filters.month && (
                  <Chip
                    label={`Month: ${new Date(
                      2000,
                      data.applied_filters.month - 1,
                      1
                    ).toLocaleString("default", { month: "long" })}`}
                  />
                )}
                {data.applied_filters.department && (
                  <Chip
                    label={`Department: ${data.applied_filters.department}`}
                  />
                )}
                {data.applied_filters.product && (
                  <Chip label={`Product: ${data.applied_filters.product}`} />
                )}
              </Box>
            </Paper>
          </Box>
        </>
      ) : (
        <Alert severity="info" sx={{ m: 3 }}>
          No data available. Try adjusting your filters.
        </Alert>
      )}
    </PageLayout>
  );
};

export default RevenueDCISITPage;
