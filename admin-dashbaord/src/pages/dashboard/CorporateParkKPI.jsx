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
  OutlinedInput,
  Chip,
  Button,
  TextField,
  ListItemText,
  Checkbox,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
  LabelList,
} from "recharts";
import { useTheme } from "@mui/material/styles";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Menu from "@mui/material/Menu";
import kpiService from "../../services/kpiService";
import { exportCorporatePark } from "../../services/exportService";

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

  // Temporary filter states (before applying)
  const [tempDotFilter, setTempDotFilter] = useState([]);
  const [tempExcludedDots, setTempExcludedDots] = useState([]);
  const [dotSearchTerm, setDotSearchTerm] = useState("");
  const [tempTelecomTypeFilter, setTempTelecomTypeFilter] = useState([]);
  const [tempOfferNameFilter, setTempOfferNameFilter] = useState([]);
  const [tempCustomerL2Filter, setTempCustomerL2Filter] = useState([]);
  const [tempCustomerL3Filter, setTempCustomerL3Filter] = useState([]);
  const [tempSubscriberStatusFilter, setTempSubscriberStatusFilter] = useState(
    []
  );
  const [tempYear, setTempYear] = useState(null);
  const [tempMonth, setTempMonth] = useState(null);

  // Applied filter states
  const [appliedFilters, setAppliedFilters] = useState({
    dots: [],
    excludedDots: [],
    telecomType: [],
    offerName: [],
    customerL2: [],
    customerL3: [],
    subscriberStatus: [],
    year: null,
    month: null,
  });

  // Available DOTs state
  const [availableDots, setAvailableDots] = useState([]);
  const [loadingDots, setLoadingDots] = useState(true);

  // Export functionality
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const exportMenuOpen = Boolean(exportAnchorEl);

  // Add offer search state
  const [offerSearchTerm, setOfferSearchTerm] = useState("");

  const [previewData, setPreviewData] = useState(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewRowsPerPage, setPreviewRowsPerPage] = useState(10);
  const [previewTotalCount, setPreviewTotalCount] = useState(0);

  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleExport = async (format) => {
    try {
      setExportAnchorEl(null);

      // Use the exportCorporatePark function from exportService
      await exportCorporatePark(format, appliedFilters);
    } catch (err) {
      console.error("Error exporting data:", err);
    }
  };

  // Fetch DOTs from backend
  useEffect(() => {
    const fetchDots = async () => {
      try {
        setLoadingDots(true);
        const response = await kpiService.getDots();

        // Extract the dots array from the response and format if needed
        if (response && response.dots && Array.isArray(response.dots)) {
          // DOT items might be objects with {id, code, name} structure
          // Ensure we're using simple strings or properly formatted objects
          const formattedDots = response.dots.map((dot) => {
            // If dot is already a string, use it directly
            if (typeof dot === "string") return dot;

            // If dot is an object, extract the code or name property
            if (dot && typeof dot === "object") {
              return dot.code || dot.name || dot.id || JSON.stringify(dot);
            }

            // Fallback
            return String(dot);
          });

          setAvailableDots(formattedDots);
        } else {
          setAvailableDots([]);
        }
      } catch (error) {
        console.error("Error fetching DOTs:", error);
        setError("Failed to load DOTs. Please try again later.");
        setAvailableDots([]);
      } finally {
        setLoadingDots(false);
      }
    };

    fetchDots();
  }, []);

  // Handle tab change
  const handleTabChange = (event, newValue) => {
    console.log("Tab changed to:", newValue);
    setTabValue(newValue);
  };

  // Handle filter changes
  const handleFilterChange = (event, setFilter) => {
    console.log("Filter changed:", {
      value: event.target.value,
      filterSetter: setFilter.name,
    });
    const value = event.target.value;
    // If it's an empty string or empty array, set empty array
    if (!value || (Array.isArray(value) && value.length === 0)) {
      setFilter([]);
    } else {
      setFilter(value);
    }
  };

  // Handle selecting all wilayas except siege
  const handleSelectAllWilayasExceptSiege = () => {
    console.log("Selecting all wilayas except siege");
    const nonSiegeDots = availableDots.filter((dot) => {
      const dotStr = typeof dot === "object" ? dot.code : dot;
      return !dotStr.toLowerCase().includes("siege");
    });
    console.log("Non-siege DOTs:", nonSiegeDots);
    setTempDotFilter(nonSiegeDots);
  };

  // Filter DOTs based on search term
  const getFilteredDots = () => {
    if (!dotSearchTerm) {
      return availableDots;
    }
    return availableDots.filter((dot) =>
      dot.toString().toLowerCase().includes(dotSearchTerm.toLowerCase())
    );
  };

  // Filter offers based on search term
  const getFilteredOffers = () => {
    if (!offerSearchTerm || !parkData) {
      return parkData
        ? getUniqueOptions(parkData.subscribers_by_offer, "offer_name")
        : [];
    }
    return getUniqueOptions(parkData.subscribers_by_offer, "offer_name").filter(
      (offer) => offer.toLowerCase().includes(offerSearchTerm.toLowerCase())
    );
  };

  // Apply filters
  const handleApplyFilters = () => {
    console.log("Applying filters:", {
      dots: tempDotFilter,
      excludedDots: tempExcludedDots,
      telecomType: tempTelecomTypeFilter,
      offerName: tempOfferNameFilter,
      customerL2: tempCustomerL2Filter,
      customerL3: tempCustomerL3Filter,
      subscriberStatus: tempSubscriberStatusFilter,
      year: tempYear,
      month: tempMonth,
    });

    setAppliedFilters({
      dots: tempDotFilter,
      excludedDots: tempExcludedDots,
      telecomType: tempTelecomTypeFilter,
      offerName: tempOfferNameFilter,
      customerL2: tempCustomerL2Filter,
      customerL3: tempCustomerL3Filter,
      subscriberStatus: tempSubscriberStatusFilter,
      year: tempYear,
      month: tempMonth,
    });
  };

  // Reset filters
  const handleResetFilters = () => {
    console.log("Resetting all filters");

    setTempDotFilter([]);
    setTempExcludedDots([]);
    setDotSearchTerm("");
    setOfferSearchTerm("");
    setTempTelecomTypeFilter([]);
    setTempOfferNameFilter([]);
    setTempCustomerL2Filter([]);
    setTempCustomerL3Filter([]);
    setTempSubscriberStatusFilter([]);
    setTempYear(null);
    setTempMonth(null);

    setAppliedFilters({
      dots: [],
      excludedDots: [],
      telecomType: [],
      offerName: [],
      customerL2: [],
      customerL3: [],
      subscriberStatus: [],
      year: null,
      month: null,
    });
  };

  // Delete individual filter items
  const handleDeleteFilter = (filterType, value) => {
    console.log("Deleting filter item:", { filterType, value });
    switch (filterType) {
      case "dot":
        setTempDotFilter((prev) => prev.filter((item) => item !== value));
        break;
      case "telecomType":
        setTempTelecomTypeFilter((prev) =>
          prev.filter((item) => item !== value)
        );
        break;
      case "offerName":
        setTempOfferNameFilter((prev) => prev.filter((item) => item !== value));
        break;
      case "customerL2":
        setTempCustomerL2Filter((prev) =>
          prev.filter((item) => item !== value)
        );
        break;
      case "customerL3":
        setTempCustomerL3Filter((prev) =>
          prev.filter((item) => item !== value)
        );
        break;
      case "subscriberStatus":
        setTempSubscriberStatusFilter((prev) =>
          prev.filter((item) => item !== value)
        );
        break;
      default:
        break;
    }
  };

  // Delete individual excluded dot
  const handleDeleteExcludedDot = (dotToRemove) => {
    console.log("Removing excluded DOT:", dotToRemove);
    setTempExcludedDots((prev) => prev.filter((dot) => dot !== dotToRemove));
  };

  // Fetch corporate park data
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("Starting fetchData with filters:", appliedFilters);
        console.log("Current excluded DOTs:", appliedFilters.excludedDots);
        console.log("Current included DOTs:", appliedFilters.dots);

        const params = {
          include_creation_date: true,
        };

        // Only add year and month if they're not null/empty
        if (appliedFilters.year) params.year = appliedFilters.year;
        if (appliedFilters.month) params.month = appliedFilters.month;

        if (appliedFilters.dots && appliedFilters.dots.length > 0) {
          console.log(
            "Processing included DOTs for request:",
            appliedFilters.dots
          );
          params.dot = appliedFilters.dots
            .map((dot) => {
              console.log("Processing DOT for inclusion:", dot);
              const dotCode = typeof dot === "object" ? dot.code : dot;
              console.log("Mapped included DOT code:", dotCode);
              return dotCode;
            })
            .filter(Boolean); // Remove any undefined/null values
          console.log("Final included DOTs for request:", params.dot);
        }

        if (
          appliedFilters.excludedDots &&
          appliedFilters.excludedDots.length > 0
        ) {
          console.log(
            "Processing excluded DOTs for request:",
            appliedFilters.excludedDots
          );
          params.exclude_dot = appliedFilters.excludedDots
            .map((dot) => {
              console.log("Processing DOT for exclusion:", dot);
              const dotCode = typeof dot === "object" ? dot.code : dot;
              console.log("Mapped excluded DOT code:", dotCode);
              return dotCode;
            })
            .filter(Boolean); // Remove any undefined/null values
          console.log("Final excluded DOTs for request:", params.exclude_dot);
        }

        if (appliedFilters.telecomType.length)
          params.telecom_type = appliedFilters.telecomType;
        if (appliedFilters.offerName.length)
          params.offer_name = appliedFilters.offerName;
        if (appliedFilters.customerL2.length)
          params.customer_l2 = appliedFilters.customerL2;
        if (appliedFilters.customerL3.length)
          params.customer_l3 = appliedFilters.customerL3;
        if (appliedFilters.subscriberStatus.length)
          params.subscriber_status = appliedFilters.subscriberStatus;

        console.log("Final request parameters:", params);

        const data = await kpiService.getCorporateParkKPIs(params);
        console.log("Received corporate park data:", data);

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
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [appliedFilters]);

  // Prepare chart data
  const prepareChartData = (data, valueKey, nameKey) => {
    if (!data || !data.length) return [];

    const chartData = data.map((item) => ({
      name: item[nameKey],
      value: item[valueKey],
    }));

    console.log("Prepared chart data:", {
      source: `${nameKey} by ${valueKey}`,
      data: chartData,
    });

    return chartData;
  };

  // Get unique filter options
  const getUniqueOptions = useCallback((data, key) => {
    if (!data || !data.length) return [];

    const uniqueValues = Array.from(new Set(data.map((item) => item[key])));
    return uniqueValues.filter(Boolean).sort();
  }, []);

  // Helper function for generating month options
  const getMonthOptions = () => {
    return [
      { value: 1, label: "January" },
      { value: 2, label: "February" },
      { value: 3, label: "March" },
      { value: 4, label: "April" },
      { value: 5, label: "May" },
      { value: 6, label: "June" },
      { value: 7, label: "July" },
      { value: 8, label: "August" },
      { value: 9, label: "September" },
      { value: 10, label: "October" },
      { value: 11, label: "November" },
      { value: 12, label: "December" },
    ];
  };

  // Helper function for generating year options (last 5 years)
  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push(currentYear - i);
    }
    return years;
  };

  // Custom colors for charts
  const COLORS = [
    theme.palette.primary.main, // Blue
    theme.palette.secondary.main, // Purple
    theme.palette.success.main, // Green
    theme.palette.warning.main, // Orange/Yellow
    theme.palette.error.main, // Red
    theme.palette.info.main, // Light Blue
    "#8884d8", // Purple
    "#82ca9d", // Green
    "#ffc658", // Yellow
    "#ff8042", // Orange
    "#0088FE", // Bright Blue
    "#00C49F", // Teal
    "#FFBB28", // Golden Yellow
    "#FF8042", // Coral
    "#a4de6c", // Light Green
    "#d0ed57", // Lime Green
    "#83a6ed", // Pastel Blue
    "#8dd1e1", // Sky Blue
    "#b6a2de", // Lavender
    "#d6684e", // Brick Red
    "#e397ec", // Pink
    "#fac858", // Amber
    "#f5c542", // Gold
    "#fe777c", // Salmon
    "#4d6ab3", // Indigo
    "#d72e3d", // Crimson
    "#ad4faf", // Magenta
    "#00695c", // Dark Teal
    "#3949ab", // Navy Blue
    "#43a047", // Forest Green
    ...Array(10)
      .fill()
      .map((_, i) => theme.palette.primary[(i % 9) * 100 + 100]),
  ];

  // Fetch preview data
  useEffect(() => {
    const fetchPreviewData = async () => {
      if (tabValue !== 7) return; // Only fetch when preview tab is active

      setLoading(true);
      setError(null);
      try {
        const params = {
          page: previewPage + 1, // API uses 1-based indexing
          page_size: previewRowsPerPage,
        };

        // Add filters
        if (appliedFilters.year) params.year = appliedFilters.year;
        if (appliedFilters.month) params.month = appliedFilters.month;

        if (appliedFilters.dots && appliedFilters.dots.length > 0) {
          params.dot = appliedFilters.dots.map((dot) =>
            typeof dot === "object" ? dot.code : dot
          );
        }

        if (appliedFilters.telecomType && appliedFilters.telecomType.length) {
          params.telecom_type = appliedFilters.telecomType;
        }

        if (appliedFilters.offerName && appliedFilters.offerName.length) {
          params.offer_name = appliedFilters.offerName;
        }

        if (appliedFilters.customerL2 && appliedFilters.customerL2.length) {
          params.customer_l2 = appliedFilters.customerL2;
        }

        if (appliedFilters.customerL3 && appliedFilters.customerL3.length) {
          params.customer_l3 = appliedFilters.customerL3;
        }

        if (
          appliedFilters.subscriberStatus &&
          appliedFilters.subscriberStatus.length
        ) {
          params.subscriber_status = appliedFilters.subscriberStatus;
        }

        const data = await kpiService.getCorporateParkPreview(params);
        setPreviewData(data.results);
        setPreviewTotalCount(data.pagination.total_count);
      } catch (err) {
        console.error("Error fetching preview data:", err);
        setError("Failed to load preview data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchPreviewData();
  }, [tabValue, previewPage, previewRowsPerPage, appliedFilters]);

  const handleChangePage = (event, newPage) => {
    setPreviewPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setPreviewRowsPerPage(parseInt(event.target.value, 10));
    setPreviewPage(0);
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
          <Tab label="By DOT" />
          <Tab label="By Telecom Type" />
          <Tab label="By Offer" />
          <Tab label="By Code Customer L2" />
          <Tab label="By Code Customer L3" />
          <Tab label="New Creations" />
          <Tab label="Preview Data" />
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
                      value={tempDotFilter.join(",")}
                      label="State (DOT)"
                      onChange={(event) =>
                        handleFilterChange(event, setTempDotFilter)
                      }
                      renderValue={(selected) => {
                        if (!selected) return "All States";
                        const values = selected.split(",");
                        return (
                          <Box
                            sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                          >
                            {values.map((value) => (
                              <Chip
                                key={value}
                                label={value}
                                onDelete={() =>
                                  handleDeleteFilter("dot", value)
                                }
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            ))}
                          </Box>
                        );
                      }}
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 300,
                          },
                        },
                      }}
                    >
                      <MenuItem disabled>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Search DOTs..."
                          value={dotSearchTerm}
                          onChange={(e) => setDotSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          variant="outlined"
                          autoFocus
                        />
                      </MenuItem>
                      <MenuItem value="" divider>
                        All States
                      </MenuItem>
                      <MenuItem onClick={handleSelectAllWilayasExceptSiege}>
                        <ListItemText primary="All Wilayas (excluding siege)" />
                      </MenuItem>
                      {loadingDots ? (
                        <MenuItem disabled>Loading DOTs...</MenuItem>
                      ) : (
                        getFilteredDots().map((state) => (
                          <MenuItem key={state} value={state}>
                            {state}
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <Autocomplete
                      multiple
                      id="exclude-dots"
                      options={availableDots}
                      value={tempExcludedDots}
                      onChange={(event, newValue) => {
                        setTempExcludedDots(newValue);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Exclude DOTs"
                          placeholder="Select DOTs to exclude"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option}
                            {...getTagProps({ index })}
                            key={option}
                            onDelete={() => handleDeleteExcludedDot(option)}
                          />
                        ))
                      }
                    />
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
                      value={tempTelecomTypeFilter.join(",")}
                      label="Telecom Type"
                      onChange={(event) =>
                        handleFilterChange(event, setTempTelecomTypeFilter)
                      }
                      renderValue={(selected) => {
                        if (!selected) return "All Types";
                        return (
                          <Box
                            sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                          >
                            {selected.split(",").map((value) => (
                              <Chip
                                key={value}
                                label={value}
                                onDelete={() =>
                                  handleDeleteFilter("telecomType", value)
                                }
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            ))}
                          </Box>
                        );
                      }}
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
                        labelLine={false}
                        label={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
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
                        labelFormatter={(name) => `${name}`}
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ fontSize: "11px", paddingTop: "15px" }}
                        formatter={(value, entry) => {
                          const { payload } = entry;
                          const percentage = (
                            (payload.value / parkData.total_subscribers) *
                            100
                          ).toFixed(1);
                          return `${value}: ${percentage}%`;
                        }}
                      />
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
                          parkData.subscribers_by_status || [],
                          "count",
                          "subscriber_status"
                        )}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        label={({ percent, x, y }) => {
                          // Only show labels for slices with significant percentage (>3%)
                          if (percent < 0.03) return null;
                          return (
                            <text
                              x={x}
                              y={y}
                              fill="#fff"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize="12"
                              fontWeight="bold"
                            >
                              {`${(percent * 100).toFixed(0)}%`}
                            </text>
                          );
                        }}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                      >
                        {prepareChartData(
                          parkData.subscribers_by_status || [],
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
                        labelFormatter={(name) => `${name}`}
                      />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{ fontSize: "11px", paddingTop: "15px" }}
                        formatter={(value, entry) => {
                          const { payload } = entry;
                          const percentage = (
                            (payload.value / parkData.total_subscribers) *
                            100
                          ).toFixed(1);
                          return `${value}: ${percentage}%`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Grid>

                <Grid item xs={12} md={12}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Distribution by Code Customer L2
                  </Typography>
                  <ResponsiveContainer width="100%" height={450}>
                    <PieChart>
                      <Pie
                        data={prepareChartData(
                          // Filter out entries with less than 0.5% to reduce clutter
                          parkData.subscribers_by_customer.filter(
                            (item) =>
                              (item.count / parkData.total_subscribers) * 100 >=
                              0.5
                          ),
                          "count",
                          "customer_l2_code"
                        )}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        nameKey="name"
                      >
                        {prepareChartData(
                          parkData.subscribers_by_customer.filter(
                            (item) =>
                              (item.count / parkData.total_subscribers) * 100 >=
                              0.5
                          ),
                          "count",
                          "customer_l2_code"
                        ).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => value.toLocaleString()}
                        labelFormatter={(name) => {
                          // Find the full customer data for this code
                          const customer =
                            parkData.subscribers_by_customer.find(
                              (c) => c.customer_l2_code === name
                            );
                          const description = customer?.customer_l2_desc || "";
                          return `${name}${
                            description ? ` (${description})` : ""
                          }`;
                        }}
                      />
                      <Legend
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                        wrapperStyle={{
                          fontSize: "11px",
                          paddingLeft: "20px",
                          maxHeight: "350px",
                          overflowY: "auto",
                          width: "250px",
                        }}
                        formatter={(value, entry) => {
                          const { payload } = entry;
                          const percentage = (
                            (payload.value / parkData.total_subscribers) *
                            100
                          ).toFixed(1);

                          // Find the full customer data for this code
                          const customer =
                            parkData.subscribers_by_customer.find(
                              (c) => c.customer_l2_code === value
                            );

                          // Use customer description if available, otherwise just the code
                          let displayName = value;
                          if (customer?.customer_l2_desc) {
                            displayName = `${value} (${customer.customer_l2_desc})`;
                          }

                          return `${displayName}: ${percentage}%`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Grid>
              </Grid>
            </TabPanel>

            {/* By DOT Tab */}
            <TabPanel value={tabValue} index={1}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Subscribers by DOT
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={prepareChartData(
                    parkData.subscribers_by_state ||
                      parkData.subscribers_by_dot ||
                      [],
                    "count",
                    "state" in (parkData.subscribers_by_state?.[0] || {})
                      ? "state"
                      : "dot"
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
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(value) => value.toLocaleString()}
                    />
                  </Bar>
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
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(value) => value.toLocaleString()}
                    />
                  </Bar>
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
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(value) => value.toLocaleString()}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* By Code Customer L2 Tab */}
            <TabPanel value={tabValue} index={4}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Subscribers by Code Customer L2
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={parkData.subscribers_by_customer.map((item) => ({
                    name: item.customer_l2_code,
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
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(value) => value.toLocaleString()}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* By Code Customer L3 Tab */}
            <TabPanel value={tabValue} index={5}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Subscribers by Code Customer L3
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={parkData.subscribers_by_customer.map((item) => ({
                    name: item.customer_l3_code,
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
                    fill={theme.palette.error.main}
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(value) => value.toLocaleString()}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* New Creations Tab */}
            <TabPanel value={tabValue} index={6}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                New Creations by Telecom Type (Last Month)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={prepareChartData(
                    parkData.new_creations || [],
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
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(value) => value.toLocaleString()}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabPanel>

            {/* Preview Data Tab */}
            <TabPanel value={tabValue} index={7}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Preview Data
              </Typography>
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              ) : previewData ? (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>DOT</TableCell>
                          <TableCell>Telecom Type</TableCell>
                          <TableCell>Offer Name</TableCell>
                          <TableCell>Customer L2</TableCell>
                          <TableCell>Customer L3</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Creation Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewData.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.dot_code || row.state}</TableCell>
                            <TableCell>{row.telecom_type}</TableCell>
                            <TableCell>{row.offer_name}</TableCell>
                            <TableCell>{`${row.customer_l2_code} - ${row.customer_l2_desc}`}</TableCell>
                            <TableCell>{`${row.customer_l3_code} - ${row.customer_l3_desc}`}</TableCell>
                            <TableCell>{row.subscriber_status}</TableCell>
                            <TableCell>
                              {new Date(row.creation_date).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={previewTotalCount}
                    page={previewPage}
                    onPageChange={handleChangePage}
                    rowsPerPage={previewRowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                  />
                </>
              ) : (
                <Typography>No preview data available</Typography>
              )}
            </TabPanel>
          </>
        )
      )}
    </Paper>
  );
};

export default CorporateParkKPI;
