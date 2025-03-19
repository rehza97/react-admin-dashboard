import { useState, useEffect, useCallback } from "react";
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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
      id={`park-tabpanel-${index}`}
      aria-labelledby={`park-tab-${index}`}
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

const CorporateParkKPI = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parkData, setParkData] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [stateFilter, setStateFilter] = useState("");
  const [telecomTypeFilter, setTelecomTypeFilter] = useState("");
  const [offerNameFilter, setOfferNameFilter] = useState("");

  // Fetch corporate park data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {};
        if (stateFilter) params.state = stateFilter;
        if (telecomTypeFilter) params.telecom_type = telecomTypeFilter;
        if (offerNameFilter) params.offer_name = offerNameFilter;

        console.log("Fetching corporate park data with filters:", params);

        const data = await kpiService.getCorporateParkKPIs(params);

        console.log("Received corporate park data:", {
          totalSubscribers: data.total_subscribers,
          byState: data.subscribers_by_state?.length,
          byTelecom: data.subscribers_by_telecom?.length,
          byOffer: data.subscribers_by_offer?.length,
        });

        // Ensure we have all required data or provide defaults
        const processedData = {
          total_subscribers: data.total_subscribers || 0,
          subscribers_by_state: data.subscribers_by_state || [],
          subscribers_by_telecom: data.subscribers_by_telecom || [],
          subscribers_by_offer: data.subscribers_by_offer || [],
          subscribers_by_status: data.subscribers_by_status || [],
          subscribers_by_customer: data.subscribers_by_customer || [],
          new_subscribers: data.new_subscribers || [],
        };

        setParkData(processedData);
      } catch (err) {
        console.error("Error fetching corporate park data:", err);
        if (err.message === "Network Error") {
          setError(
            "Network error. Please check your connection and try again."
          );
        } else if (err.response && err.response.status === 404) {
          setError("Data not found for the selected filters.");
        } else {
          setError(
            "Failed to load corporate park data. Please try again later."
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [stateFilter, telecomTypeFilter, offerNameFilter]);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Handle filter changes
  const handleStateChange = (event) => {
    setStateFilter(event.target.value);
  };

  const handleTelecomTypeChange = (event) => {
    setTelecomTypeFilter(event.target.value);
  };

  const handleOfferNameChange = (event) => {
    setOfferNameFilter(event.target.value);
  };

  // Prepare chart data
  const prepareChartData = (data, valueKey, nameKey) => {
    if (!data || !data.length) return [];

    return data.map((item) => ({
      name: item[nameKey],
      value: item[valueKey],
    }));
  };

  // Get unique filter options
  const getUniqueOptions = useCallback((data, key) => {
    if (!data || !Array.isArray(data) || !data.length) return [];

    // Use Array.from instead of spread operator for Set
    const uniqueValues = Array.from(new Set(data.map((item) => item[key])))
      .filter(Boolean)
      .sort();

    console.log(`Unique ${key} values:`, uniqueValues);
    return uniqueValues;
  }, []);

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

  // Reset all filters
  const resetFilters = () => {
    setStateFilter("");
    setTelecomTypeFilter("");
    setOfferNameFilter("");
    // Reset to overview tab
    setTabValue(0);
  };

  return (
    <Paper elevation={2} sx={{ p: 0, borderRadius: 2, overflow: "hidden" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="corporate park tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Overview" />
          <Tab label="By State" />
          <Tab label="By Telecom Type" />
          <Tab label="By Offer" />
          <Tab label="By Customer" />
          <Tab label="New Creations" />
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
        parkData && (
          <>
            {/* Filters */}
            <Box sx={{ p: 3, borderBottom: 1, borderColor: "divider" }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="state-select-label">State (DOT)</InputLabel>
                    <Select
                      labelId="state-select-label"
                      id="state-select"
                      value={stateFilter}
                      label="State (DOT)"
                      onChange={handleStateChange}
                    >
                      <MenuItem value="">All States</MenuItem>
                      {parkData?.subscribers_by_state &&
                      parkData.subscribers_by_state.length > 0 ? (
                        getUniqueOptions(
                          parkData.subscribers_by_state,
                          "state"
                        ).map((state) => (
                          <MenuItem key={state} value={state}>
                            {state}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>No states available</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="telecom-type-select-label">
                      Telecom Type
                    </InputLabel>
                    <Select
                      labelId="telecom-type-select-label"
                      id="telecom-type-select"
                      value={telecomTypeFilter}
                      label="Telecom Type"
                      onChange={handleTelecomTypeChange}
                    >
                      <MenuItem value="">All Types</MenuItem>
                      {parkData?.subscribers_by_telecom &&
                      parkData.subscribers_by_telecom.length > 0 ? (
                        getUniqueOptions(
                          parkData.subscribers_by_telecom,
                          "telecom_type"
                        ).map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>No telecom types available</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="offer-name-select-label">
                      Offer Name
                    </InputLabel>
                    <Select
                      labelId="offer-name-select-label"
                      id="offer-name-select"
                      value={offerNameFilter}
                      label="Offer Name"
                      onChange={handleOfferNameChange}
                    >
                      <MenuItem value="">All Offers</MenuItem>
                      {parkData?.subscribers_by_offer &&
                      parkData.subscribers_by_offer.length > 0 ? (
                        getUniqueOptions(
                          parkData.subscribers_by_offer,
                          "offer_name"
                        ).map((offer) => (
                          <MenuItem key={offer} value={offer}>
                            {offer}
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem disabled>No offers available</MenuItem>
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid
                  item
                  xs={12}
                  sm={1}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    onClick={resetFilters}
                    disabled={
                      !stateFilter && !telecomTypeFilter && !offerNameFilter
                    }
                  >
                    Reset
                  </Button>
                </Grid>
              </Grid>

              {/* Add a message when filters are applied */}
              {(stateFilter || telecomTypeFilter || offerNameFilter) && (
                <Box sx={{ mt: 2 }}>
                  <Alert
                    severity="info"
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    <Box>
                      Filters applied:
                      {stateFilter && <strong> State: {stateFilter}</strong>}
                      {telecomTypeFilter && (
                        <strong> Type: {telecomTypeFilter}</strong>
                      )}
                      {offerNameFilter && (
                        <strong> Offer: {offerNameFilter}</strong>
                      )}
                    </Box>
                  </Alert>
                </Box>
              )}
            </Box>

            {/* Overview Tab */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Typography variant="h4" fontWeight="bold" color="primary">
                  {(parkData.total_subscribers || 0).toLocaleString()}
                </Typography>
                <Typography variant="subtitle1">
                  Total Active Subscribers
                </Typography>
              </Box>

              {/* If we have no distribution data, show a message */}
              {(!parkData.subscribers_by_telecom ||
                parkData.subscribers_by_telecom.length === 0) &&
                (!parkData.subscribers_by_status ||
                  parkData.subscribers_by_status.length === 0) && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    No detailed distribution data available for the selected
                    filters.
                  </Alert>
                )}

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by Telecom Type
                  </Typography>
                  {parkData.subscribers_by_telecom &&
                  parkData.subscribers_by_telecom.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={prepareChartData(
                            parkData.subscribers_by_telecom,
                            "count",
                            "telecom_type"
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
                          {prepareChartData(
                            parkData.subscribers_by_telecom,
                            "count",
                            "telecom_type"
                          ).map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => value.toLocaleString()}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box
                      sx={{
                        height: 300,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Typography color="text.secondary">
                        No telecom type data available
                      </Typography>
                    </Box>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by Subscriber Status
                  </Typography>
                  {parkData.subscribers_by_status &&
                  parkData.subscribers_by_status.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={prepareChartData(
                            parkData.subscribers_by_status,
                            "count",
                            "subscriber_status"
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
                          {prepareChartData(
                            parkData.subscribers_by_status,
                            "count",
                            "subscriber_status"
                          ).map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => value.toLocaleString()}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box
                      sx={{
                        height: 300,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Typography color="text.secondary">
                        No subscriber status data available
                      </Typography>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </TabPanel>

            {/* By State Tab */}
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Subscribers by State (DOT)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={prepareChartData(
                    parkData.subscribers_by_state,
                    "count",
                    "state"
                  )}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toLocaleString()} />
                  <Legend />
                  <Bar
                    dataKey="value"
                    name="Subscribers"
                    fill={theme.palette.primary.main}
                  />
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* By Telecom Type Tab */}
            <TabPanel value={tabValue} index={2}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Subscribers by Telecom Type
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={prepareChartData(
                    parkData.subscribers_by_telecom,
                    "count",
                    "telecom_type"
                  )}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toLocaleString()} />
                  <Legend />
                  <Bar
                    dataKey="value"
                    name="Subscribers"
                    fill={theme.palette.secondary.main}
                  />
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* By Offer Tab */}
            <TabPanel value={tabValue} index={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Subscribers by Offer Name
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={prepareChartData(
                    parkData.subscribers_by_offer,
                    "count",
                    "offer_name"
                  )}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toLocaleString()} />
                  <Legend />
                  <Bar
                    dataKey="value"
                    name="Subscribers"
                    fill={theme.palette.success.main}
                  />
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* By Customer Tab */}
            <TabPanel value={tabValue} index={4}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Subscribers by Customer (L2)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={parkData.subscribers_by_customer.map((item) => ({
                    name: item.customer_l2_desc || item.customer_l2_code,
                    value: item.count,
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toLocaleString()} />
                  <Legend />
                  <Bar
                    dataKey="value"
                    name="Subscribers"
                    fill={theme.palette.warning.main}
                  />
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* New Creations Tab */}
            <TabPanel value={tabValue} index={5}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                New Creations by Telecom Type (Last 30 Days)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={prepareChartData(
                    parkData.new_creations,
                    "count",
                    "telecom_type"
                  )}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => value.toLocaleString()} />
                  <Legend />
                  <Bar
                    dataKey="value"
                    name="New Subscribers"
                    fill={theme.palette.info.main}
                  />
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>
          </>
        )
      )}
    </Paper>
  );
};

export default CorporateParkKPI;
