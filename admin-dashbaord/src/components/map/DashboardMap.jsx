import { memo, useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  CircularProgress,
  Chip,
  Grid,
  Autocomplete,
  Divider,
  Card,
  CardContent,
} from "@mui/material";
import {
  Search,
  ZoomIn,
  ZoomOut,
  Public,
  Info,
  PieChart as PieChartIcon,
} from "@mui/icons-material";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import dataService from "../../services/dataService";
import "./map.css";
import "./enhanced-map.css";

// Function to generate a color based on value intensity
const getHeatMapColor = (value, max) => {
  const intensity = value / max;
  // Color gradient from light blue to dark blue
  return `rgba(25, 118, 210, ${0.2 + intensity * 0.8})`;
};

const DashboardMap = ({ activeLinks }) => {
  const theme = useTheme();
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [dataMetric, setDataMetric] = useState("users");
  const [loading, setLoading] = useState(true);
  const [mapData, setMapData] = useState({});

  // List of all regions for search functionality
  const allRegions = [
    "Adrar",
    "Chlef",
    "Laghouat",
    "Oum El Bouaghi",
    "Batna",
    "Bejaia",
    "Biskra",
    "Bechar",
    "Blida",
    "Bouira",
    "Tamanrasset",
    "Tebessa",
    "Tlemcen",
    "Tiaret",
    "Tizi Ouzou",
    "Alger",
    "Djelfa",
    "Jijel",
    "Setif",
    "Saida",
    "Skikda",
    "Sidi Bel Abbès",
    "Annaba",
    "Guelma",
    "Constantine",
    "Medea",
    "Mostaganem",
    "Msila",
    "Mascara",
    "Ouargla",
    "Oran",
    "El Bayadh",
    "Illizi",
    "Bordj Bou Arreridj",
    "Boumerdès",
    "El Tarf",
    "Tindouf",
    "Tissemsilt",
    "El Oued",
    "Khenchela",
    "Souk Ahras",
    "Tipaza",
    "Mila",
    "Ain Defla",
    "Naama",
    "Ain Temouchent",
    "Ghardaia",
    "Relizane",
    "Timimoun",
    "Bordj Badji Mokhtar",
    "Ouled Djellal",
    "Beni Abbes",
    "In Salah",
    "In Guezzam",
    "Touggourt",
    "Djanet",
    "El Mghair",
    "El Menia",
  ];

  // Fetch map data from backend
  useEffect(() => {
    const fetchMapData = async () => {
      setLoading(true);
      try {
        const data = await dataService.getMapData();
        setMapData(data);
      } catch (error) {
        console.error("Error fetching map data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMapData();
  }, []);

  // Get the maximum value for the selected metric to normalize heat map colors
  const getMaxValue = () => {
    return Math.max(
      ...Object.values(mapData)
        .filter((data) => data)
        .map((data) => data[dataMetric] || 0)
    );
  };

  // Simulate loading data when changing metrics
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [dataMetric]);

  // Handle region click
  const handleRegionClick = (region) => {
    if (activeLinks[region]) {
      setSelectedRegion(region);
    }
  };

  // Handle zoom in/out
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };

  // Handle map dragging
  const handleMouseDown = (e) => {
    if (e.button === 0) {
      // Left mouse button
      setIsDragging(true);
      setStartDragPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const dx = e.clientX - startDragPosition.x;
      const dy = e.clientY - startDragPosition.y;
      setPosition((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setStartDragPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset map position and zoom
  const resetMapView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Generate chart data for the selected region
  const getChartData = () => {
    if (!selectedRegion || !mapData[selectedRegion]) return [];

    const data = mapData[selectedRegion];
    return [
      { name: "Users", value: data.users },
      { name: "Files", value: data.files },
      { name: "Anomalies", value: data.anomalies },
    ];
  };

  // Generate comparison data for bar chart
  const getComparisonData = () => {
    if (!selectedRegion) return [];

    // Get top 5 regions by the selected metric
    const topRegions = Object.entries(mapData)
      .filter(([, data]) => data)
      .sort(([, a], [, b]) => b[dataMetric] - a[dataMetric])
      .slice(0, 5)
      .map(([region, data]) => ({
        name: region,
        [dataMetric]: data[dataMetric],
        isSelected: region === selectedRegion,
      }));

    return topRegions;
  };

  // Colors for charts
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box sx={{ position: "relative", flex: "1 0 auto", minHeight: "300px" }}>
        {/* Controls overlay */}
        <Box
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Search Regions
            </Typography>
            <Autocomplete
              freeSolo
              options={allRegions}
              value={searchTerm}
              onChange={(_, newValue) => {
                setSearchTerm(newValue || "");
                if (newValue && mapData[newValue]) {
                  setSelectedRegion(newValue);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Search..."
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
          </Paper>

          <Paper elevation={3} sx={{ p: 2, borderRadius: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Data Visualization
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Select Metric
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                {["users", "files", "anomalies"].map((metric) => (
                  <Chip
                    key={metric}
                    label={metric.charAt(0).toUpperCase() + metric.slice(1)}
                    onClick={() => setDataMetric(metric)}
                    color={dataMetric === metric ? "primary" : "default"}
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* Zoom controls */}
        <Box
          sx={{
            position: "absolute",
            bottom: 16,
            right: 16,
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <Paper elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <IconButton onClick={handleZoomIn} size="small">
              <ZoomIn />
            </IconButton>
            <IconButton onClick={handleZoomOut} size="small">
              <ZoomOut />
            </IconButton>
            <IconButton onClick={resetMapView} size="small">
              <Public />
            </IconButton>
          </Paper>
        </Box>

        {/* Loading overlay */}
        {loading && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              zIndex: 20,
            }}
          >
            <CircularProgress />
          </Box>
        )}

        {/* Map */}
        <div
          className="map"
          style={{
            backgroundColor: theme.palette.background.default,
            cursor: isDragging ? "grabbing" : "grab",
            height: "100%",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="mapdiv">
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              x="0px"
              y="0px"
              width="300"
              height="300"
              viewBox="-248.385 -239.386 982.451 955.452"
              enableBackground="new -248.385 -239.386 982.451 955.452"
              xmlSpace="preserve"
              style={{
                backgroundColor: theme.palette.background.default,
                transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                transition: isDragging ? "none" : "transform 0.3s ease-out",
              }}
            >
              {/* Map regions */}
              <a
                title="Adrar"
                href={activeLinks["Adrar"] ? "#" : undefined}
                onClick={() => handleRegionClick("Adrar")}
              >
                <polygon
                  id="1"
                  points="251.102,224.174 251.02,224.415 250.081,227.454 243.742,237.514 242.119,257.674 238.4,264.035 238.502,276.455 242.201,282.015 237.081,294.895
                      236.14,312.654 231.442,316.015 231.16,314.375 227.68,314.775 225.9,313.154 220.64,314.775 218.26,319.674 203.3,335.034 208.722,347.115 225.861,371.375 226.16,415.255 226.38,448.154 226.38,448.835 -28.201,377.695 -41.679,378.515 -68.019,387.974
                      -101.86,361.635 -75.94,353.174 -61.539,339.275 -33.179,339.734 -27.101,326.294 -12.74,306.854 -8.101,302.895 -0.399,299.734 14.981,300.854 18.539,298.734 25.18,276.815 22.861,274.315 29.581,253.054 41.879,237.994 45.341,230.475 58.42,220.614
                      72.081,202.014 98.559,194.774 120.942,193.855 123.64,191.554 147.442,213.934 155.442,216.274 162.102,218.874 168.779,218.874 173.779,221.614 180.38,223.614 187.442,223.614 193.102,222.274 196.442,220.934 201.779,218.874 210.442,215.274 224.442,214.934
                      229.442,216.934 242.8,215.614 248.779,218.874 "
                  style={{
                    fill:
                      activeLinks["Adrar"] && mapData["Adrar"]
                        ? getHeatMapColor(
                            mapData["Adrar"][dataMetric],
                            getMaxValue()
                          )
                        : theme.palette.mode === "dark"
                        ? "#555"
                        : "#e0e0e0",
                    stroke:
                      searchTerm &&
                      "Adrar".toLowerCase().includes(searchTerm.toLowerCase())
                        ? theme.palette.warning.main
                        : theme.palette.background.paper,
                    strokeWidth:
                      searchTerm &&
                      "Adrar".toLowerCase().includes(searchTerm.toLowerCase())
                        ? 2
                        : 0.75,
                  }}
                />
              </a>

              <a
                title="Chlef"
                href={activeLinks["Chlef"] ? "#" : undefined}
                onClick={() => handleRegionClick("Chlef")}
              >
                <path
                  id="2"
                  d="M238.734-160.41
                      l0.508-3.518l-2.536-1.818l-1.364-3.214l0.514-2.198l-1.6,0.358l-1.36-1.406l-0.008-2.038l2.66-1.77l-3.658-1.072l2.392-2.338
                      l-2.992-3.244l0.26-2.344l4.458-3.28l2.196-4.934l-8.664,1.306l-5.338-1.374l-3.18,2.402l-8.416,0.628l-6.11,2.364l-1.98,3.374
                      l-6.23,2.496l-2,6.566l4.11,0.642l4.346-1.602l0.934,3.788l1.074,0.042l-1.654,3.374l1.018-0.314l1.038,3.994l3.55-1.326
                      l-0.694,0.488l1.186,0.082l1.082,2.358l3.126,1.97l5.676-1.626l4.344,6.574l0.12-2.828l1.036-0.666l-0.768-0.696l4.524-1.24
                      l0.072-1.73l2.438-2.328l2.072,3.752L238.734-160.41L238.734-160.41z"
                  style={{
                    fill:
                      activeLinks["Chlef"] && mapData["Chlef"]
                        ? getHeatMapColor(
                            mapData["Chlef"][dataMetric],
                            getMaxValue()
                          )
                        : theme.palette.mode === "dark"
                        ? "#555"
                        : "#e0e0e0",
                    stroke:
                      searchTerm &&
                      "Chlef".toLowerCase().includes(searchTerm.toLowerCase())
                        ? theme.palette.warning.main
                        : theme.palette.background.paper,
                    strokeWidth:
                      searchTerm &&
                      "Chlef".toLowerCase().includes(searchTerm.toLowerCase())
                        ? 2
                        : 0.75,
                  }}
                />
              </a>

              {/* Add more regions here... */}
            </svg>
          </div>
        </div>
      </Box>

      {/* Region data section - displayed below the map */}
      {selectedRegion && mapData[selectedRegion] ? (
        <Box sx={{ mt: 3, p: 2 }}>
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h5" gutterBottom>
              {selectedRegion} Region Data
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={3}>
              {/* Region statistics */}
              <Grid item xs={12} md={4}>
                <Card
                  variant="outlined"
                  sx={{ height: "100%" }}
                  className="region-card"
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Region Statistics
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Population
                      </Typography>
                      <Typography variant="h6">
                        {mapData[selectedRegion].population.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Revenue
                      </Typography>
                      <Typography variant="h6">
                        ${mapData[selectedRegion].revenue.toLocaleString()}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Users
                      </Typography>
                      <Typography variant="h6">
                        {mapData[selectedRegion].users}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Files
                      </Typography>
                      <Typography variant="h6">
                        {mapData[selectedRegion].files}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Anomalies
                      </Typography>
                      <Typography variant="h6">
                        {mapData[selectedRegion].anomalies}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Data distribution chart */}
              <Grid item xs={12} md={4}>
                <Card
                  variant="outlined"
                  sx={{ height: "100%" }}
                  className="region-card"
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Data Distribution
                    </Typography>
                    <Box
                      sx={{
                        height: 250,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getChartData()}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) =>
                              `${name} ${(percent * 100).toFixed(0)}%`
                            }
                          >
                            {getChartData().map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              {/* Comparison chart */}
              <Grid item xs={12} md={4}>
                <Card
                  variant="outlined"
                  sx={{ height: "100%" }}
                  className="region-card"
                >
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Comparison with Top Regions
                    </Typography>
                    <Box
                      sx={{
                        height: 250,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={getComparisonData()}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <RechartsTooltip />
                          <Bar dataKey={dataMetric}>
                            {getComparisonData().map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.isSelected ? COLORS[0] : "#8884d8"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box
              sx={{
                mt: 3,
                display: "flex",
                justifyContent: "flex-end",
                gap: 2,
              }}
            >
              <Button
                variant="outlined"
                startIcon={<PieChartIcon />}
                onClick={() => {
                  // Navigate to detailed analytics page for this region
                  // history.push(`/analytics/${selectedRegion}`);
                }}
              >
                View Analytics
              </Button>
              <Button
                variant="contained"
                startIcon={<Info />}
                onClick={() => {
                  // Navigate to detailed region page
                  // history.push(`/regions/${selectedRegion}`);
                }}
              >
                Region Details
              </Button>
            </Box>
          </Paper>
        </Box>
      ) : (
        <Box sx={{ mt: 3, p: 2 }}>
          <Paper
            elevation={3}
            sx={{ p: 3, borderRadius: 2, textAlign: "center" }}
          >
            <Typography variant="h6" color="text.secondary">
              Select a region on the map to view detailed statistics
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

DashboardMap.propTypes = {
  activeLinks: PropTypes.object.isRequired,
};

// Memoize the component to prevent unnecessary re-renders
export default memo(DashboardMap);
