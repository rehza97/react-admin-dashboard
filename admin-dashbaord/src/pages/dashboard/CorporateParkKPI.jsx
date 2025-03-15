import React, { useState, useEffect, useCallback, useMemo } from "react";
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
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          year: new Date().getFullYear(),
          month: new Date().getMonth() + 1,
        };

        if (stateFilter) params.state = stateFilter;
        if (telecomTypeFilter) params.telecom_type = telecomTypeFilter;
        if (offerNameFilter) params.offer_name = offerNameFilter;

        const data = await kpiService.getCorporateParkKPIs(params);

        if (!data) {
          throw new Error("No data received from the server");
        }

        setParkData(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching corporate park data:", err);
          setError(
            "Failed to load corporate park data. Please try again later."
          );
        }
      } finally {
        if (controller.signal.aborted) return;
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
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
    if (!data || !data.length) return [];

    // Use Array.from instead of spread operator for Set
    const uniqueValues = Array.from(new Set(data.map((item) => item[key])));
    return uniqueValues.filter(Boolean).sort();
  }, []);

  const uniqueStates = useMemo(
    () => getUniqueOptions(parkData?.subscribers_by_state || [], "state"),
    [parkData?.subscribers_by_state, getUniqueOptions]
  );

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
                      {uniqueStates.map((state) => (
                        <MenuItem key={state} value={state}>
                          {state}
                        </MenuItem>
                      ))}
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
                      {getUniqueOptions(
                        parkData.subscribers_by_telecom,
                        "telecom_type"
                      ).map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
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
                      {getUniqueOptions(
                        parkData.subscribers_by_offer,
                        "offer_name"
                      ).map((offer) => (
                        <MenuItem key={offer} value={offer}>
                          {offer}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            {/* Overview Tab */}
            <TabPanel value={tabValue} index={0}>
              <Box sx={{ textAlign: "center", mb: 3 }}>
                <Typography variant="h4" fontWeight="bold" color="primary">
                  {parkData.total_subscribers.toLocaleString()}
                </Typography>
                <Typography variant="subtitle1">
                  Total Active Subscribers
                </Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by Telecom Type
                  </Typography>
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
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by Subscriber Status
                  </Typography>
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
                      <Tooltip formatter={(value) => value.toLocaleString()} />
                    </PieChart>
                  </ResponsiveContainer>
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
