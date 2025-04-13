import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
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
  Autocomplete,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
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
import { FilterAlt, RestartAlt, FileDownload } from "@mui/icons-material";
import Menu from "@mui/material/Menu";
import kpiService from "../../services/kpiService";
import { useExportNotifications } from "../export";

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

const CorporateParkKPI = forwardRef((props, ref) => {
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
  const [tempActelCode, setTempActelCode] = useState([]);

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
    actelCode: [],
  });

  // Available DOTs state
  const [availableDots, setAvailableDots] = useState([]);
  const [loadingDots, setLoadingDots] = useState(true);

  // Preview data state
  const [previewData, setPreviewData] = useState([]);
  const [previewTotalCount, setPreviewTotalCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(0);
  const [previewRowsPerPage, setPreviewRowsPerPage] = useState(10);

  // Export dialog state
  const [previewExportAnchorEl, setPreviewExportAnchorEl] = useState(null);
  const { addExportNotification } = useExportNotifications();

  // Available years state
  const [availableYears, setAvailableYears] = useState([]);

  // Expose methods to parent component through ref
  useImperativeHandle(ref, () => ({
    getAppliedFilters: () => appliedFilters,
  }));

  const handlePreviewExportClick = (event) => {
    setPreviewExportAnchorEl(event.currentTarget);
  };

  const handlePreviewExportClose = () => {
    setPreviewExportAnchorEl(null);
  };

  const handlePreviewExportFormatSelect = (format) => {
    handlePreviewExportClose();

    // Get applied filters for the notification
    const appliedFilters = {
      dots: tempDotFilter,
      excludedDots: tempExcludedDots,
      telecomType: tempTelecomTypeFilter,
      offerName: tempOfferNameFilter,
      customerL2: tempCustomerL2Filter,
      customerL3: tempCustomerL3Filter,
      subscriberStatus: tempSubscriberStatusFilter,
      year: tempYear,
      month: tempMonth,
      actelCode: tempActelCode,
    };

    // Debug logging for export parameters
    console.log("=== Export Debug Information ===");
    console.log("Export Format:", format);
    console.log("Applied Filters:", {
      dots: {
        value: appliedFilters.dots,
        count: appliedFilters.dots?.length || 0,
        type: typeof appliedFilters.dots,
      },
      excludedDots: {
        value: appliedFilters.excludedDots,
        count: appliedFilters.excludedDots?.length || 0,
        type: typeof appliedFilters.excludedDots,
      },
      telecomType: {
        value: appliedFilters.telecomType,
        count: appliedFilters.telecomType?.length || 0,
        type: typeof appliedFilters.telecomType,
      },
      offerName: {
        value: appliedFilters.offerName,
        count: appliedFilters.offerName?.length || 0,
        type: typeof appliedFilters.offerName,
      },
      customerL2: {
        value: appliedFilters.customerL2,
        count: appliedFilters.customerL2?.length || 0,
        type: typeof appliedFilters.customerL2,
      },
      customerL3: {
        value: appliedFilters.customerL3,
        count: appliedFilters.customerL3?.length || 0,
        type: typeof appliedFilters.customerL3,
      },
      subscriberStatus: {
        value: appliedFilters.subscriberStatus,
        count: appliedFilters.subscriberStatus?.length || 0,
        type: typeof appliedFilters.subscriberStatus,
      },
      actelCode: {
        value: appliedFilters.actelCode,
        count: appliedFilters.actelCode?.length || 0,
        type: typeof appliedFilters.actelCode,
      },
      year: {
        value: appliedFilters.year,
        type: typeof appliedFilters.year,
      },
      month: {
        value: appliedFilters.month,
        type: typeof appliedFilters.month,
      },
    });

    // Prepare API parameters
    const exportParams = {
      format: format,
      filters: {},
    };

    // Add non-empty filters to export parameters
    if (appliedFilters.dots?.length > 0)
      exportParams.filters.dot = appliedFilters.dots;
    if (appliedFilters.excludedDots?.length > 0)
      exportParams.filters.exclude_dot = appliedFilters.excludedDots;
    if (appliedFilters.telecomType?.length > 0)
      exportParams.filters.telecom_type = appliedFilters.telecomType;
    if (appliedFilters.offerName?.length > 0)
      exportParams.filters.offer_name = appliedFilters.offerName;
    if (appliedFilters.customerL2?.length > 0)
      exportParams.filters.customer_l2 = appliedFilters.customerL2;
    if (appliedFilters.customerL3?.length > 0)
      exportParams.filters.customer_l3 = appliedFilters.customerL3;
    if (appliedFilters.subscriberStatus?.length > 0)
      exportParams.filters.subscriber_status = appliedFilters.subscriberStatus;
    if (appliedFilters.actelCode?.length > 0)
      exportParams.filters.actel_code = appliedFilters.actelCode;
    if (appliedFilters.year) exportParams.filters.year = appliedFilters.year;
    if (appliedFilters.month) exportParams.filters.month = appliedFilters.month;

    console.log("Final Export Parameters:", exportParams);
    console.log("=== End Export Debug Information ===");

    // Get row count estimate
    const rowCount = parkData?.total_subscribers || 0;

    // Add notification with filters
    addExportNotification("Corporate Park Preview Export", format, null, null, {
      inProgress: true,
      progress: 0,
      status: "processing",
      filters: appliedFilters,
      rowCount: rowCount,
    });
  };

  // Fetch DOTs from backend
  useEffect(() => {
    const fetchDots = async () => {
      try {
        setLoadingDots(true);
        console.log("Fetching DOTs...");
        const response = await kpiService.getDots();
        console.log("Received DOTs:", response.dots);

        if (response && response.dots && Array.isArray(response.dots)) {
          // DOT items are objects with {id, code, name} structure
          // Extract just the dot codes for the dropdown
          const formattedDots = response.dots.map((dot) => dot.code);
          console.log("Formatted DOT codes:", formattedDots);
          setAvailableDots(formattedDots);
        } else if (Array.isArray(response)) {
          // Fallback if response is directly an array
          const formattedDots = response.map((dot) => {
            if (typeof dot === "string") return dot;
            if (dot && typeof dot === "object") {
              return dot.code || dot.name || dot.id || String(dot);
            }
            return String(dot);
          });
          setAvailableDots(formattedDots);
        } else {
          console.log("Invalid DOTs data format:", response);
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

  // Fetch corporate park data
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(
          "Fetching corporate park data with filters:",
          appliedFilters
        );

        const params = {
          // Always include creation_date parameter for new creations data
          include_creation_date: true,
        };

        // Only add year and month if they're not null/empty
        if (appliedFilters.year) params.year = appliedFilters.year;
        if (appliedFilters.month) params.month = appliedFilters.month;

        if (appliedFilters.dots.length) params.dot = appliedFilters.dots;
        if (appliedFilters.excludedDots.length)
          params.exclude_dot = appliedFilters.excludedDots;
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
        if (appliedFilters.actelCode && appliedFilters.actelCode.length) {
          console.log(
            "[DEBUG] Adding Actel codes to params:",
            appliedFilters.actelCode
          );
          params.actel_code = appliedFilters.actelCode;
        }

        console.log("Request parameters:", params);

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

  // Add this after other useEffect hooks
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

        // Update DOT handling to use dot_code consistently
        if (appliedFilters.dots && appliedFilters.dots.length > 0) {
          params.dot = appliedFilters.dots
            .map((dot) => {
              // Handle both object (from API) and string (from user input) cases
              const dotCode =
                typeof dot === "object" ? dot.code || dot.name : dot;
              console.log(
                "Processing DOT for inclusion:",
                dot,
                "-> code:",
                dotCode
              );
              return dotCode;
            })
            .filter(Boolean);
          console.log("Final DOT codes for request:", params.dot);
        }

        if (
          appliedFilters.excludedDots &&
          appliedFilters.excludedDots.length > 0
        ) {
          params.exclude_dot = appliedFilters.excludedDots
            .map((dot) => {
              const dotCode =
                typeof dot === "object" ? dot.code || dot.name : dot;
              console.log(
                "Processing DOT for exclusion:",
                dot,
                "-> code:",
                dotCode
              );
              return dotCode;
            })
            .filter(Boolean);
          console.log("Final excluded DOT codes:", params.exclude_dot);
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

        console.log("Fetching preview data with params:", params);
        const data = await kpiService.getCorporateParkPreview(params);
        console.log("Received preview data:", data);

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

  // Add this useEffect to fetch years when component mounts
  useEffect(() => {
    const fetchYears = async () => {
      try {
        console.log("[KPI DEBUG] Fetching available years");
        const years = await kpiService.getCorporateParkYears();
        console.log("[KPI DEBUG] Available years:", years);
        setAvailableYears(years);
      } catch (error) {
        console.error("[KPI DEBUG] Error fetching years:", error);
        // Handle error appropriately
      }
    };

    fetchYears();
  }, []); // Empty dependency array means this runs once on mount

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
    } else if (typeof value === "string" && value.includes(",")) {
      // Handle comma-separated string
      setFilter(value.split(","));
    } else {
      setFilter(Array.isArray(value) ? value : [value]);
    }
  };

  // Helper to check if a DOT is a siege
  const isSiegeDot = (dot) => {
    return typeof dot === "string" && dot.toLowerCase().includes("siege");
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

  // Apply filters
  const handleApplyFilters = () => {
    console.log("=== Filter Application Debug ===");
    console.log("Applying filters with current values:", {
      dots: {
        value: tempDotFilter,
        count: tempDotFilter?.length || 0,
        type: typeof tempDotFilter,
      },
      excludedDots: {
        value: tempExcludedDots,
        count: tempExcludedDots?.length || 0,
        type: typeof tempExcludedDots,
      },
      telecomType: {
        value: tempTelecomTypeFilter,
        count: tempTelecomTypeFilter?.length || 0,
        type: typeof tempTelecomTypeFilter,
      },
      offerName: {
        value: tempOfferNameFilter,
        count: tempOfferNameFilter?.length || 0,
        type: typeof tempOfferNameFilter,
      },
      customerL2: {
        value: tempCustomerL2Filter,
        count: tempCustomerL2Filter?.length || 0,
        type: typeof tempCustomerL2Filter,
      },
      customerL3: {
        value: tempCustomerL3Filter,
        count: tempCustomerL3Filter?.length || 0,
        type: typeof tempCustomerL3Filter,
      },
      subscriberStatus: {
        value: tempSubscriberStatusFilter,
        count: tempSubscriberStatusFilter?.length || 0,
        type: typeof tempSubscriberStatusFilter,
      },
      actelCode: {
        value: tempActelCode,
        count: tempActelCode?.length || 0,
        type: typeof tempActelCode,
      },
      year: {
        value: tempYear,
        type: typeof tempYear,
      },
      month: {
        value: tempMonth,
        type: typeof tempMonth,
      },
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
      actelCode: tempActelCode,
    });

    console.log("=== End Filter Application Debug ===");
  };

  // Reset filters
  const handleResetFilters = () => {
    console.log("Resetting all filters");

    setTempDotFilter([]);
    setTempExcludedDots([]);
    setDotSearchTerm("");
    setTempTelecomTypeFilter([]);
    setTempOfferNameFilter([]);
    setTempCustomerL2Filter([]);
    setTempCustomerL3Filter([]);
    setTempSubscriberStatusFilter([]);
    setTempYear(null);
    setTempMonth(null);
    setTempActelCode([]);

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
      actelCode: [],
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
      case "actelCode":
        setTempActelCode((prev) => prev.filter((item) => item !== value));
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

  // Handle preview data change
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
          <Tab label="By Offer Name" />
          <Tab label="By Code Customer L2" />
          <Tab label="By Code Customer L3" />
          <Tab label="New Creations" />
          <Tab label="Preview Data" value={7} />
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
                {/* DOT Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="dot-select-label">DOT</InputLabel>
                    <Select
                      labelId="dot-select-label"
                      id="dot-select"
                      multiple
                      value={tempDotFilter}
                      onChange={(e) => handleFilterChange(e, setTempDotFilter)}
                      input={<OutlinedInput label="DOT" />}
                      renderValue={(selected) => (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {selected.map((value) => (
                            <Chip
                              key={value}
                              label={value}
                              onDelete={() => handleDeleteFilter("dot", value)}
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      )}
                      onOpen={() => setDotSearchTerm("")}
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

                      {loadingDots ? (
                        <MenuItem disabled>Loading DOTs...</MenuItem>
                      ) : (
                        getFilteredDots().map((dot) => (
                          <MenuItem key={dot} value={dot}>
                            {dot}
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Exclude DOT Filter */}
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
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ))
                      }
                    />
                  </FormControl>
                </Grid>

                {/* Actel Code Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <Autocomplete
                      multiple
                      id="actel-code-select"
                      options={
                        parkData
                          ? getUniqueOptions(
                              parkData.subscribers_by_actel,
                              "actel_code"
                            )
                          : []
                      }
                      value={tempActelCode}
                      onChange={(event, newValue) => {
                        setTempActelCode(newValue);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Actel Code"
                          placeholder="Select Actel codes"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option}
                            {...getTagProps({ index })}
                            key={option}
                            onDelete={() =>
                              handleDeleteFilter("actelCode", option)
                            }
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ))
                      }
                    />
                  </FormControl>
                </Grid>

                {/* Subscriber Status Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="subscriber-status-select-label">
                      Subscriber Status
                    </InputLabel>
                    <Select
                      labelId="subscriber-status-select-label"
                      id="subscriber-status-select"
                      multiple
                      value={tempSubscriberStatusFilter}
                      onChange={(e) =>
                        handleFilterChange(e, setTempSubscriberStatusFilter)
                      }
                      input={<OutlinedInput label="Subscriber Status" />}
                      renderValue={(selected) => (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {selected.map((value) => (
                            <Chip
                              key={value}
                              label={value}
                              onDelete={() =>
                                handleDeleteFilter("subscriberStatus", value)
                              }
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      )}
                    >
                      {getUniqueOptions(
                        parkData.subscribers_by_status,
                        "subscriber_status"
                      ).map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Telecom Type Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="telecom-type-select-label">
                      Telecom Type
                    </InputLabel>
                    <Select
                      labelId="telecom-type-select-label"
                      id="telecom-type-select"
                      multiple
                      value={tempTelecomTypeFilter}
                      onChange={(e) =>
                        handleFilterChange(e, setTempTelecomTypeFilter)
                      }
                      input={<OutlinedInput label="Telecom Type" />}
                      renderValue={(selected) => (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {selected.map((value) => (
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
                      )}
                    >
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

                {/* Offer Name Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <Autocomplete
                      multiple
                      id="offer-name-select"
                      options={
                        parkData
                          ? getUniqueOptions(
                              parkData.subscribers_by_offer,
                              "offer_name"
                            )
                          : []
                      }
                      value={tempOfferNameFilter}
                      onChange={(event, newValue) => {
                        setTempOfferNameFilter(newValue);
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Offer Name"
                          placeholder="Select offers"
                        />
                      )}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option}
                            {...getTagProps({ index })}
                            key={option}
                            onDelete={() =>
                              handleDeleteFilter("offerName", option)
                            }
                            onMouseDown={(e) => e.stopPropagation()}
                          />
                        ))
                      }
                    />
                  </FormControl>
                </Grid>

                {/* Customer L2 Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="customer-l2-select-label">
                      Code Customer L2
                    </InputLabel>
                    <Select
                      labelId="customer-l2-select-label"
                      id="customer-l2-select"
                      multiple
                      value={tempCustomerL2Filter}
                      onChange={(e) =>
                        handleFilterChange(e, setTempCustomerL2Filter)
                      }
                      input={<OutlinedInput label="Code Customer L2" />}
                      renderValue={(selected) => (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {selected.map((value) => (
                            <Chip
                              key={value}
                              label={value}
                              onDelete={() =>
                                handleDeleteFilter("customerL2", value)
                              }
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      )}
                    >
                      {getUniqueOptions(
                        parkData.subscribers_by_customer,
                        "customer_l2_code"
                      ).map((code) => (
                        <MenuItem key={code} value={code}>
                          {code}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Customer L3 Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="customer-l3-select-label">
                      Code Customer L3
                    </InputLabel>
                    <Select
                      labelId="customer-l3-select-label"
                      id="customer-l3-select"
                      multiple
                      value={tempCustomerL3Filter}
                      onChange={(e) =>
                        handleFilterChange(e, setTempCustomerL3Filter)
                      }
                      input={<OutlinedInput label="Code Customer L3" />}
                      renderValue={(selected) => (
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {selected.map((value) => (
                            <Chip
                              key={value}
                              label={value}
                              onDelete={() =>
                                handleDeleteFilter("customerL3", value)
                              }
                              onMouseDown={(e) => e.stopPropagation()}
                            />
                          ))}
                        </Box>
                      )}
                    >
                      {getUniqueOptions(
                        parkData.subscribers_by_customer,
                        "customer_l3_code"
                      ).map((code) => (
                        <MenuItem key={code} value={code}>
                          {code}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Year Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="year-select-label">Year</InputLabel>
                    <Select
                      labelId="year-select-label"
                      id="year-select"
                      value={tempYear || ""}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? null : Number(e.target.value);
                        setTempYear(value);
                      }}
                      input={<OutlinedInput label="Year" />}
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

                {/* Month Filter */}
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="month-select-label">Month</InputLabel>
                    <Select
                      labelId="month-select-label"
                      id="month-select"
                      value={tempMonth || ""}
                      onChange={(e) => {
                        const value =
                          e.target.value === "" ? null : Number(e.target.value);
                        setTempMonth(value);
                      }}
                      input={<OutlinedInput label="Month" />}
                    >
                      <MenuItem value="">All Months</MenuItem>
                      {getMonthOptions().map((month) => (
                        <MenuItem key={month.value} value={month.value}>
                          {month.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Filter Actions */}
              <Box
                sx={{
                  mt: 2,
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 2,
                }}
              >
                <Button
                  variant="outlined"
                  startIcon={<RestartAlt />}
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </Button>
                <Button
                  variant="contained"
                  startIcon={<FilterAlt />}
                  onClick={handleApplyFilters}
                >
                  Apply Filters
                </Button>
              </Box>
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
                  <ResponsiveContainer width="100%" height={400}>
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
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 2,
                }}
              >
                <Typography variant="h6">Preview Data</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FileDownload />}
                  onClick={handlePreviewExportClick}
                  sx={{ ml: 2 }}
                >
                  Export Preview
                </Button>
                <Menu
                  anchorEl={previewExportAnchorEl}
                  open={Boolean(previewExportAnchorEl)}
                  onClose={handlePreviewExportClose}
                >
                  <MenuItem
                    onClick={() => handlePreviewExportFormatSelect("excel")}
                  >
                    Excel
                  </MenuItem>
                  <MenuItem
                    onClick={() => handlePreviewExportFormatSelect("csv")}
                  >
                    CSV
                  </MenuItem>
                  <MenuItem
                    onClick={() => handlePreviewExportFormatSelect("pdf")}
                  >
                    PDF
                  </MenuItem>
                </Menu>
              </Box>
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              ) : (
                <Box sx={{ width: "100%" }}>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>DOT</TableCell>
                          <TableCell>State</TableCell>
                          <TableCell>Actel Code</TableCell>
                          <TableCell>Customer L1 Code</TableCell>
                          <TableCell>Customer L1 Description</TableCell>
                          <TableCell>Customer L2 Code</TableCell>
                          <TableCell>Customer L2 Description</TableCell>
                          <TableCell>Customer L3 Code</TableCell>
                          <TableCell>Customer L3 Description</TableCell>
                          <TableCell>Customer Full Name</TableCell>
                          <TableCell>Telecom Type</TableCell>
                          <TableCell>Offer Type</TableCell>
                          <TableCell>Offer Name</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Creation Date</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {previewData.map((row, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              {row.dot_code ||
                                (row.dot && (row.dot.code || row.dot.name)) ||
                                row.state ||
                                "-"}
                            </TableCell>
                            <TableCell>{row.state || "-"}</TableCell>
                            <TableCell>{row.actel_code || "-"}</TableCell>
                            <TableCell>{row.customer_l1_code || "-"}</TableCell>
                            <TableCell>{row.customer_l1_desc || "-"}</TableCell>
                            <TableCell>{row.customer_l2_code || "-"}</TableCell>
                            <TableCell>{row.customer_l2_desc || "-"}</TableCell>
                            <TableCell>{row.customer_l3_code || "-"}</TableCell>
                            <TableCell>{row.customer_l3_desc || "-"}</TableCell>
                            <TableCell>
                              {row.customer_full_name || "-"}
                            </TableCell>
                            <TableCell>{row.telecom_type || "-"}</TableCell>
                            <TableCell>{row.offer_type || "-"}</TableCell>
                            <TableCell>{row.offer_name || "-"}</TableCell>
                            <TableCell>
                              {row.subscriber_status || "-"}
                            </TableCell>
                            <TableCell>
                              {row.creation_date
                                ? new Date(
                                    row.creation_date
                                  ).toLocaleDateString()
                                : "-"}
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
                </Box>
              )}
            </TabPanel>
          </>
        )
      )}
    </Paper>
  );
});

CorporateParkKPI.displayName = "CorporateParkKPI";

CorporateParkKPI.propTypes = {
  ref: PropTypes.any,
};

export default CorporateParkKPI;
