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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
      id={`invoice-tabpanel-${index}`}
      aria-labelledby={`invoice-tab-${index}`}
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

const UnfinishedInvoiceKPI = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invoiceData, setInvoiceData] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters
  const [dotFilter, setDotFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [minDaysFilter, setMinDaysFilter] = useState("");
  const [maxDaysFilter, setMaxDaysFilter] = useState("");

  // DOT options (simplified for now)
  const dotOptions = [
    { value: "Alger", label: "Alger" },
    { value: "Oran", label: "Oran" },
    { value: "Constantine", label: "Constantine" },
    { value: "Annaba", label: "Annaba" },
    { value: "Blida", label: "Blida" },
    { value: "Setif", label: "Setif" },
    { value: "Tlemcen", label: "Tlemcen" },
    { value: "Batna", label: "Batna" },
  ];

  // Status options
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "in_progress", label: "In Progress" },
    { value: "blocked", label: "Blocked" },
    { value: "rejected", label: "Rejected" },
  ];

  // Age range options
  const ageRangeOptions = [
    { min: 0, max: 30, label: "0-30 days" },
    { min: 31, max: 60, label: "31-60 days" },
    { min: 61, max: 90, label: "61-90 days" },
    { min: 91, max: 180, label: "91-180 days" },
    { min: 181, max: 365, label: "181-365 days" },
    { min: 366, max: null, label: "Over 365 days" },
  ];

  useEffect(() => {
    fetchData();
  }, [dotFilter, statusFilter, minDaysFilter, maxDaysFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (dotFilter) params.append("dot", dotFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (minDaysFilter) params.append("min_days", minDaysFilter);
      if (maxDaysFilter) params.append("max_days", maxDaysFilter);

      const response = await kpiService.getUnfinishedInvoiceKPI(params);
      setInvoiceData(response.data);
    } catch (err) {
      console.error("Error fetching unfinished invoice data:", err);
      setError(
        "Failed to load unfinished invoice data. Please try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleDotChange = (event) => {
    setDotFilter(event.target.value);
  };

  const handleStatusChange = (event) => {
    setStatusFilter(event.target.value);
  };

  const handleAgeRangeChange = (event) => {
    const selectedRange = ageRangeOptions.find(
      (range) => range.label === event.target.value
    );
    if (selectedRange) {
      setMinDaysFilter(selectedRange.min.toString());
      setMaxDaysFilter(selectedRange.max ? selectedRange.max.toString() : "");
    } else {
      setMinDaysFilter("");
      setMaxDaysFilter("");
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
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

  // Format date values
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("fr-DZ");
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

  // Get current age range label
  const getCurrentAgeRangeLabel = () => {
    if (!minDaysFilter && !maxDaysFilter) return "All";

    const selectedRange = ageRangeOptions.find(
      (range) =>
        range.min.toString() === minDaysFilter &&
        (range.max === null
          ? maxDaysFilter === ""
          : range.max.toString() === maxDaysFilter)
    );

    return selectedRange ? selectedRange.label : "Custom";
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
          Unfinished Invoices Analysis
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
            <InputLabel id="dot-select-label">DOT</InputLabel>
            <Select
              labelId="dot-select-label"
              id="dot-select"
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

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="status-select-label">Status</InputLabel>
            <Select
              labelId="status-select-label"
              id="status-select"
              value={statusFilter}
              label="Status"
              onChange={handleStatusChange}
            >
              <MenuItem value="">All Statuses</MenuItem>
              {statusOptions.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="age-range-select-label">Age Range</InputLabel>
            <Select
              labelId="age-range-select-label"
              id="age-range-select"
              value={getCurrentAgeRangeLabel()}
              label="Age Range"
              onChange={handleAgeRangeChange}
            >
              <MenuItem value="All">All</MenuItem>
              {ageRangeOptions.map((range) => (
                <MenuItem key={range.label} value={range.label}>
                  {range.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {invoiceData && (
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
                  Total Unfinished Invoices
                </Typography>
                <Typography variant="h4">{invoiceData.total_count}</Typography>
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
                  Total Amount
                </Typography>
                <Typography variant="h4">
                  {formatCurrency(invoiceData.total_amount)}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  bgcolor: theme.palette.error.light,
                  color: theme.palette.error.contrastText,
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Average Days Pending
                </Typography>
                <Typography variant="h4">
                  {Math.round(invoiceData.avg_days_pending)} days
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={3}
                sx={{
                  p: 3,
                  textAlign: "center",
                  height: "100%",
                  bgcolor: theme.palette.warning.light,
                  color: theme.palette.warning.contrastText,
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Critical Invoices (>90 days)
                </Typography>
                <Typography variant="h4">
                  {invoiceData.by_age
                    ? invoiceData.by_age
                        .filter(
                          (item) =>
                            item.label === "91-180 days" ||
                            item.label === "181-365 days" ||
                            item.label === "Over 365 days"
                        )
                        .reduce((sum, item) => sum + item.count, 0)
                    : "N/A"}
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
              <Tab label="By Age" />
              <Tab label="By DOT" />
              <Tab label="By Status" />
              <Tab label="By Client" />
              <Tab label="Invoice List" />
            </Tabs>

            {/* By Age Tab */}
            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={invoiceData.by_age}
                          dataKey="count"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          fill={theme.palette.primary.main}
                          label={(entry) => `${entry.label}: ${entry.count}`}
                        >
                          {invoiceData.by_age.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => [
                            value,
                            "Invoices",
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={invoiceData.by_age}
                        margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="label"
                          angle={-45}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis />
                        <Tooltip
                          formatter={(value, name, props) => [
                            formatCurrency(value),
                            "Amount",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="total"
                          name="Amount"
                          fill={theme.palette.primary.main}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>
            </TabPanel>

            {/* By DOT Tab */}
            <TabPanel value={tabValue} index={1}>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={invoiceData.by_dot}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dot"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) =>
                        new Intl.NumberFormat("fr-DZ", {
                          notation: "compact",
                          compactDisplay: "short",
                        }).format(value)
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "Count") return [value, name];
                        return [formatCurrency(value), name];
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="count"
                      name="Count"
                      fill={theme.palette.primary.main}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="total"
                      name="Amount"
                      fill={theme.palette.secondary.main}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </TabPanel>

            {/* By Status Tab */}
            <TabPanel value={tabValue} index={2}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={invoiceData.by_status}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          fill={theme.palette.primary.main}
                          label={(entry) => `${entry.status}: ${entry.count}`}
                        >
                          {invoiceData.by_status.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => [
                            value,
                            "Invoices",
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={invoiceData.by_status}
                        margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="status"
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
                            "Amount",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="total"
                          name="Amount"
                          fill={theme.palette.primary.main}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>
            </TabPanel>

            {/* By Client Tab */}
            <TabPanel value={tabValue} index={3}>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={invoiceData.by_client}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="client"
                      angle={-45}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) =>
                        new Intl.NumberFormat("fr-DZ", {
                          notation: "compact",
                          compactDisplay: "short",
                        }).format(value)
                      }
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "Count") return [value, name];
                        if (name === "Avg Days")
                          return [Math.round(value) + " days", name];
                        return [formatCurrency(value), name];
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="count"
                      name="Count"
                      fill={theme.palette.primary.main}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="total"
                      name="Amount"
                      fill={theme.palette.secondary.main}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </TabPanel>

            {/* Invoice List Tab */}
            <TabPanel value={tabValue} index={4}>
              <TableContainer>
                <Table
                  sx={{ minWidth: 650 }}
                  aria-label="unfinished invoices table"
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice Number</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>DOT</TableCell>
                      <TableCell>Invoice Date</TableCell>
                      <TableCell>Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Days Pending</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Mock data for invoice list - in a real app, this would come from the API */}
                    {[
                      {
                        invoice_number: "INV-2023-001",
                        client: "Client A",
                        dot: "Alger",
                        invoice_date: "2023-01-15",
                        invoice_amount: 1250000,
                        status: "pending",
                        days_pending: 120,
                      },
                      {
                        invoice_number: "INV-2023-002",
                        client: "Client B",
                        dot: "Oran",
                        invoice_date: "2023-02-20",
                        invoice_amount: 980000,
                        status: "in_progress",
                        days_pending: 85,
                      },
                      {
                        invoice_number: "INV-2023-003",
                        client: "Client C",
                        dot: "Constantine",
                        invoice_date: "2023-03-10",
                        invoice_amount: 1750000,
                        status: "blocked",
                        days_pending: 65,
                      },
                      {
                        invoice_number: "INV-2023-004",
                        client: "Client D",
                        dot: "Annaba",
                        invoice_date: "2023-04-05",
                        invoice_amount: 2100000,
                        status: "pending",
                        days_pending: 40,
                      },
                      {
                        invoice_number: "INV-2023-005",
                        client: "Client E",
                        dot: "Blida",
                        invoice_date: "2023-05-12",
                        invoice_amount: 890000,
                        status: "rejected",
                        days_pending: 30,
                      },
                    ]
                      .slice(
                        page * rowsPerPage,
                        page * rowsPerPage + rowsPerPage
                      )
                      .map((row) => (
                        <TableRow
                          key={row.invoice_number}
                          sx={{
                            "&:last-child td, &:last-child th": { border: 0 },
                            bgcolor:
                              row.days_pending > 90
                                ? theme.palette.error.light
                                : row.days_pending > 60
                                ? theme.palette.warning.light
                                : "inherit",
                          }}
                        >
                          <TableCell component="th" scope="row">
                            {row.invoice_number}
                          </TableCell>
                          <TableCell>{row.client}</TableCell>
                          <TableCell>{row.dot}</TableCell>
                          <TableCell>{formatDate(row.invoice_date)}</TableCell>
                          <TableCell>
                            {formatCurrency(row.invoice_amount)}
                          </TableCell>
                          <TableCell>{row.status}</TableCell>
                          <TableCell>{row.days_pending} days</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={5} // In a real app, this would be the total count from the API
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </TabPanel>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default UnfinishedInvoiceKPI;
