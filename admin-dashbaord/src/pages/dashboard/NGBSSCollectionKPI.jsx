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
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  Stack,
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
  ComposedChart,
  Area,
  ReferenceLine,
  Label,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import { useTheme } from "@mui/material/styles";
import kpiService from "../../services/kpiService";

// Debug logging helper - can be toggled with localStorage.debug = "true"
const DEBUG = localStorage.getItem("debug") === "true";
const debugLog = (...args) => {
  if (DEBUG) {
    console.log("[NGBSSCollectionKPI]", ...args);
  }
};

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
    { value: "Setif", label: "Setif" },
    { value: "Tlemcen", label: "Tlemcen" },
    { value: "Batna", label: "Batna" },
  ];

  useEffect(() => {
    fetchData();
  }, [yearFilter, monthFilter, dotFilter]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append("year", yearFilter);
      if (monthFilter) params.append("month", monthFilter);

      // FIX: Ensure the DOT filter is either an ID or properly formatted for backend
      // Convert DOT name to ID if needed
      let dotId = null;
      if (dotFilter) {
        // If dotFilter is already a number, use it directly
        if (!isNaN(parseInt(dotFilter))) {
          dotId = parseInt(dotFilter);
        } else {
          // Otherwise, dotFilter might be a name or label
          debugLog(`DOT filter is not a number: ${dotFilter}`);
          // For now, we won't send it to avoid backend errors
        }
      }

      if (dotId !== null) {
        debugLog(`Using DOT ID: ${dotId} for filtering`);
        params.append("dot", dotId.toString());
      } else if (dotFilter) {
        debugLog(
          `Skipping DOT filter (${dotFilter}) to avoid backend errors. Will filter on frontend.`
        );
      }

      params.append("compare_with_previous", "true");
      params.append("compare_with_objectives", "true");

      // Additional parameters for new visualizations
      params.append("include_aging_data", "true");
      params.append("include_payment_behavior", "true");
      params.append("include_collection_rate_details", "true");
      params.append("include_monthly_comparison", "true");

      try {
        debugLog(
          `Fetching NGBSS collection data with params:`,
          Object.fromEntries(params)
        );
        const controller = new AbortController();
        const response = await kpiService.getNGBSSCollectionKPIs({
          ...Object.fromEntries(params),
          signal: controller.signal,
        });

        debugLog("API Response successful:", response.status);
        // If response is successful but no data, generate mock data
        if (!response.data) {
          debugLog("API response has no data, generating mock data");
          setCollectionData(
            generateMockCollectionData(yearFilter, monthFilter, dotFilter)
          );
        } else {
          debugLog("Processing API data with frontend filtering if needed");
          // Generate complete data, potentially filtering by DOT on frontend
          const processedData = generateCompleteData(response.data, dotFilter);
          setCollectionData(processedData);
        }
      } catch (apiError) {
        console.error("API Error:", apiError);
        debugLog("Falling back to mock data");
        // If API fails, use mock data to show visualizations
        setCollectionData(
          generateMockCollectionData(yearFilter, monthFilter, dotFilter)
        );
      }
    } catch (err) {
      console.error("Error fetching NGBSS collection data:", err);
      setError("Failed to load NGBSS collection data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to generate complete data by supplementing API data with mock data for missing fields
  const generateCompleteData = (apiData, selectedDot) => {
    if (!apiData)
      return generateMockCollectionData(yearFilter, monthFilter, selectedDot);

    debugLog("Generating complete data with DOT filter:", selectedDot);

    // Frontend DOT filtering function
    const filterByDot = (item) => {
      if (!selectedDot) return true;

      if (item.dot) {
        // Check if the item's DOT matches selectedDot (either by ID or name)
        return (
          item.dot === selectedDot ||
          item.dot === dotOptions.find((d) => d.value === selectedDot)?.label ||
          (item.dot.id && item.dot.id.toString() === selectedDot.toString()) ||
          (item.dot.name && item.dot.name === selectedDot)
        );
      }
      return true;
    };

    // Filter by DOT on the frontend if necessary
    const processedData = { ...apiData };

    // Apply frontend filtering for DOT-specific data arrays if DOT filter is active
    if (selectedDot) {
      debugLog("Applying frontend DOT filtering");

      // Filter by_dot data
      if (processedData.by_dot && Array.isArray(processedData.by_dot)) {
        processedData.by_dot = processedData.by_dot.filter(filterByDot);
      }

      // Filter dot_comparison data
      if (
        processedData.dot_comparison &&
        Array.isArray(processedData.dot_comparison)
      ) {
        processedData.dot_comparison =
          processedData.dot_comparison.filter(filterByDot);
      }

      // Filter dot_achievement data
      if (
        processedData.dot_achievement &&
        Array.isArray(processedData.dot_achievement)
      ) {
        processedData.dot_achievement =
          processedData.dot_achievement.filter(filterByDot);
      }

      // Filter aging_by_dot data
      if (
        processedData.aging_by_dot &&
        Array.isArray(processedData.aging_by_dot)
      ) {
        processedData.aging_by_dot =
          processedData.aging_by_dot.filter(filterByDot);
      }

      // Filter collection_rate_by_dot data
      if (
        processedData.collection_rate_by_dot &&
        Array.isArray(processedData.collection_rate_by_dot)
      ) {
        processedData.collection_rate_by_dot =
          processedData.collection_rate_by_dot.filter(filterByDot);
      }

      // Recalculate totals based on filtered data
      if (processedData.by_dot && processedData.by_dot.length > 0) {
        processedData.total_current_year = processedData.by_dot.reduce(
          (sum, item) => sum + (item.total || 0),
          0
        );
      }
    }

    // Enhance with mock data for fields that might be missing
    return {
      ...processedData,
      // Add aging data if not provided
      aging: processedData.aging || {
        "0-30": 15000000,
        "31-60": 8000000,
        "61-90": 4000000,
        "90+": 2000000,
      },

      // Add aging trend data if not provided
      aging_trend:
        processedData.aging_trend ||
        Array.from({ length: 12 }, (_, i) => {
          const monthNum = ((new Date().getMonth() - i + 12) % 12) + 1;
          return {
            month: monthNum.toString(),
            "0-30": Math.random() * 20000000,
            "31-60": Math.random() * 10000000,
            "61-90": Math.random() * 5000000,
            "90+": Math.random() * 3000000,
          };
        }).reverse(),

      // Add aging by DOT data if not provided
      aging_by_dot:
        processedData.aging_by_dot ||
        dotOptions
          .map((dot) => ({
            dot: dot.label,
            "0-30": Math.random() * 5000000,
            "31-60": Math.random() * 2500000,
            "61-90": Math.random() * 1000000,
            "90+": Math.random() * 500000,
          }))
          .filter(filterByDot),

      // Add heatmap data if not provided
      heatmap_data:
        processedData.heatmap_data || generateHeatmapData(selectedDot),

      // Add payment delays data if not provided
      payment_delays:
        processedData.payment_delays ||
        Array.from({ length: 30 }, (_, i) => ({
          delay_days: i * 2,
          amount: Math.random() * 10000000,
          count: Math.floor(Math.random() * 100) + 5,
        })),

      // Add funnel data if not provided
      funnel: processedData.funnel || {
        invoiced: 100000000,
        acknowledged: 90000000,
        in_process: 70000000,
        collected: 60000000,
      },

      // Add collection rate by DOT data if not provided
      collection_rate_by_dot:
        processedData.collection_rate_by_dot ||
        dotOptions
          .map((dot) => ({
            dot: dot.label,
            rate: 40 + Math.random() * 50,
            previous_rate: 40 + Math.random() * 40,
          }))
          .filter(filterByDot),

      // Add collection rate evolution if not provided
      collection_rate_evolution:
        processedData.collection_rate_evolution ||
        Array.from({ length: 12 }, (_, i) => {
          const monthNum = ((new Date().getMonth() - i + 12) % 12) + 1;
          const invoiced = Math.random() * 20000000 + 5000000;
          const collected = invoiced * (0.4 + Math.random() * 0.5);
          return {
            month: monthNum.toString(),
            invoiced,
            collected,
            rate: (collected / invoiced) * 100,
            target: 70 + Math.random() * 10,
          };
        }).reverse(),

      // Add monthly comparison data if not provided
      by_month_comparison:
        processedData.by_month_comparison ||
        Array.from({ length: 12 }, (_, i) => {
          const monthNum = ((new Date().getMonth() - i + 12) % 12) + 1;
          return {
            month: monthNum.toString(),
            current_total: Math.random() * 10000000 + 5000000,
            previous_total: Math.random() * 8000000 + 3000000,
          };
        }).reverse(),
    };
  };

  // Generate heatmap data
  const generateHeatmapData = (selectedDot = null) => {
    const data = [];

    // Filter function for dot filtering
    const filterDot = (dot) => {
      if (!selectedDot) return true;
      return dot.value === selectedDot || dot.label === selectedDot;
    };

    // Generate heatmap data for each DOT (filtered if needed)
    dotOptions.filter(filterDot).forEach((dot) => {
      for (let i = 1; i <= 12; i++) {
        data.push({
          dot: dot.label,
          month: i.toString(),
          amount: Math.random() * 10000000,
        });
      }
    });

    return data;
  };

  // Generate mock data for demonstration when API fails or data is missing
  const generateMockCollectionData = (year, month, selectedDot) => {
    debugLog(
      `Generating mock data for Year: ${year}, Month: ${month}, DOT: ${selectedDot}`
    );

    // Filter DOT options if selectedDot is provided
    const filteredDots = selectedDot
      ? dotOptions.filter(
          (dot) =>
            (typeof selectedDot === "number" && dot.id === selectedDot) ||
            (typeof selectedDot === "string" &&
              (dot.id.toString() === selectedDot ||
                dot.label.toLowerCase() === selectedDot.toLowerCase()))
        )
      : dotOptions;

    debugLog(
      `Filtered DOTs for mock data:`,
      filteredDots.map((d) => d.label)
    );

    const yearInt = parseInt(year);
    const baseValue = (yearInt % 10) * 10000000; // Make values differ by year for realism

    // Filter function for dot filtering
    const filterByDot = (item) => {
      if (!selectedDot) return true;
      return (
        item.dot === selectedDot ||
        item.dot === dotOptions.find((d) => d.value === selectedDot)?.label
      );
    };

    // Generate dot data
    const dotData = dotOptions
      .map((dot) => ({
        dot: dot.label,
        total: Math.random() * baseValue + baseValue / 2,
      }))
      .filter(filterByDot);

    // Total values
    const totalCurrentYear = dotData.reduce((sum, item) => sum + item.total, 0);
    const totalPreviousYear = totalCurrentYear * 0.85;
    const totalObjective = totalCurrentYear * 1.2;

    // Generate comparison and achievement data
    const dotComparison = dotOptions
      .map((dot) => {
        const currentTotal = Math.random() * baseValue + baseValue / 2;
        return {
          dot: dot.label,
          current_total: currentTotal,
          previous_total: currentTotal * (0.7 + Math.random() * 0.4),
          change_percentage: Math.random() * 30 - 10,
        };
      })
      .filter(filterByDot);

    const dotAchievement = dotOptions
      .map((dot) => {
        const currentTotal = Math.random() * baseValue + baseValue / 2;
        return {
          dot: dot.label,
          current_total: currentTotal,
          objective_total: currentTotal * (1 + Math.random() * 0.5),
          achievement_percentage: 60 + Math.random() * 40,
        };
      })
      .filter(filterByDot);

    // Generate monthly data
    const byMonth = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      return {
        month: monthNum.toString(),
        total: (Math.random() * baseValue) / 10 + baseValue / 20,
      };
    });

    // Filter by month if needed
    if (month) {
      byMonth.length = parseInt(month);
    }

    return {
      total_current_year: totalCurrentYear,
      total_previous_year: totalPreviousYear,
      total_objective: totalObjective,
      collection_rate: 70 + Math.random() * 20,
      achievement_percentage: (totalCurrentYear / totalObjective) * 100,
      change_percentage:
        ((totalCurrentYear - totalPreviousYear) / totalPreviousYear) * 100,

      by_dot: dotData,
      by_month: byMonth,
      dot_comparison: dotComparison,
      dot_achievement: dotAchievement,

      // Additional data for new visualizations
      aging: {
        "0-30": baseValue * 0.4,
        "31-60": baseValue * 0.3,
        "61-90": baseValue * 0.2,
        "90+": baseValue * 0.1,
      },

      aging_trend: Array.from({ length: 12 }, (_, i) => {
        const monthNum = ((new Date().getMonth() - i + 12) % 12) + 1;
        return {
          month: monthNum.toString(),
          "0-30": Math.random() * baseValue * 0.4,
          "31-60": Math.random() * baseValue * 0.3,
          "61-90": Math.random() * baseValue * 0.2,
          "90+": Math.random() * baseValue * 0.1,
        };
      }).reverse(),

      aging_by_dot: dotOptions
        .map((dot) => ({
          dot: dot.label,
          "0-30": Math.random() * baseValue * 0.4,
          "31-60": Math.random() * baseValue * 0.3,
          "61-90": Math.random() * baseValue * 0.2,
          "90+": Math.random() * baseValue * 0.1,
        }))
        .filter(filterByDot),

      heatmap_data: dotOptions
        .flatMap((dot) =>
          Array.from({ length: 12 }, (_, i) => ({
            dot: dot.label,
            month: (i + 1).toString(),
            amount: (Math.random() * baseValue) / 10,
          }))
        )
        .filter(filterByDot),

      payment_delays: Array.from({ length: 30 }, (_, i) => ({
        delay_days: i * 2,
        amount: (Math.random() * baseValue) / 10,
        count: Math.floor(Math.random() * 100) + 5,
      })),

      funnel: {
        invoiced: baseValue * 2,
        acknowledged: baseValue * 1.8,
        in_process: baseValue * 1.4,
        collected: baseValue * 1.2,
      },

      collection_rate_by_dot: dotOptions
        .map((dot) => ({
          dot: dot.label,
          rate: 40 + Math.random() * 50,
          previous_rate: 40 + Math.random() * 40,
        }))
        .filter(filterByDot),

      collection_rate_evolution: Array.from({ length: 12 }, (_, i) => {
        const monthNum = ((new Date().getMonth() - i + 12) % 12) + 1;
        const invoiced = baseValue / 10 + (Math.random() * baseValue) / 10;
        const collected = invoiced * (0.4 + Math.random() * 0.5);
        return {
          month: monthNum.toString(),
          invoiced,
          collected,
          rate: (collected / invoiced) * 100,
          target: 70 + Math.random() * 10,
        };
      }).reverse(),

      by_month_comparison: Array.from({ length: 12 }, (_, i) => {
        const monthNum = ((new Date().getMonth() - i + 12) % 12) + 1;
        return {
          month: monthNum.toString(),
          current_total: baseValue / 10 + (Math.random() * baseValue) / 10,
          previous_total: baseValue / 12 + (Math.random() * baseValue) / 15,
        };
      }).reverse(),

      // Client category and product data (mocked)
      by_client_category: [
        { customer_lev1: "Government", total: baseValue * 0.4 },
        { customer_lev1: "Corporate", total: baseValue * 0.3 },
        { customer_lev1: "SME", total: baseValue * 0.2 },
        { customer_lev1: "Individual", total: baseValue * 0.1 },
      ],

      by_product: [
        { product: "Fixed Line", total: baseValue * 0.35 },
        { product: "Mobile", total: baseValue * 0.3 },
        { product: "Internet", total: baseValue * 0.25 },
        { product: "Data Services", total: baseValue * 0.1 },
      ],
    };
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

  const handleDotChange = (event, newDot) => {
    debugLog(`DOT filter changed to: ${newDot}`);
    setDotFilter(newDot);
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
        </Box>
      </Box>

      {collectionData && (
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
                  {formatCurrency(collectionData.total_current_year)}
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
                  {formatCurrency(collectionData.total_previous_year)}
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
                  {formatCurrency(collectionData.total_objective)}
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
                  {collectionData.collection_rate
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
        </>
      )}
    </Box>
  );
};

export default NGBSSCollectionKPI;
