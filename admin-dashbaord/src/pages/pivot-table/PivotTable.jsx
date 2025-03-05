import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Slider,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
} from "@mui/material";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import Plot from "react-plotly.js";
import createPlotlyRenderers from "react-pivottable/PlotlyRenderers";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import PageLayout from "../../components/PageLayout";
import fileService from "../../services/fileService";

// Create Plotly renderers
const PlotlyRenderers = createPlotlyRenderers(Plot);

const PivotTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState("facturation_manuelle");
  const [zoomLevel, setZoomLevel] = useState(100);

  // Initial pivot table configuration with focus on Department, Fiscal Year, Total Amount, and Description
  const [pivotState, setPivotState] = useState({
    rows: ["department", "fiscal_year"],
    cols: ["description"],
    vals: ["total_amount"],
    aggregatorName: "Sum",
    rendererName: "Table",
    valueFilter: {},
  });

  // Fetch data based on selected data source
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        let responseData = [];

        switch (dataSource) {
          case "facturation_manuelle": {
            const response = await fileService.getFacturationManuelle();
            console.log("Facturation Manuelle response:", response);
            responseData = response.results || response || [];
            break;
          }
          case "journal_ventes": {
            const journalResponse = await fileService.getJournalVentes();
            responseData = journalResponse.results || journalResponse || [];
            break;
          }
          case "etat_facture": {
            const etatResponse = await fileService.getEtatFacture();
            responseData = etatResponse.results || etatResponse || [];
            break;
          }
          case "ca_periodique": {
            const caResponse = await fileService.getCAPeriodique();
            responseData = caResponse.results || caResponse || [];
            break;
          }
          default:
            responseData = [];
        }

        console.log("Raw data:", responseData);

        // Transform data to focus on Department, Fiscal Year, Total Amount, and Description
        const transformedData = responseData.map((item) => {
          // Create a simplified object with just the columns we need
          const transformedItem = {
            department: item.department || "Unknown",
            fiscal_year: item.fiscal_year || "Unknown",
            total_amount: parseFloat(item.total_amount || 0),
            description: item.description || "No Description",
            invoice_date: item.invoice_date
              ? new Date(item.invoice_date).toLocaleDateString()
              : "Unknown",
            invoice_number: item.invoice_number || "Unknown",
            client_name: item.client_name || "Unknown",
            status: item.status || "Unknown",
          };

          return transformedItem;
        });

        console.log("Transformed data:", transformedData);
        setData(transformedData);

        // Update pivot state based on data source
        if (dataSource === "facturation_manuelle") {
          setPivotState({
            rows: ["department", "fiscal_year"],
            cols: ["description"],
            vals: ["total_amount"],
            aggregatorName: "Sum",
            rendererName: "Table",
            valueFilter: {},
          });
        } else if (dataSource === "journal_ventes") {
          setPivotState({
            rows: ["organization", "origin"],
            cols: ["invoice_date"],
            vals: ["revenue_amount"],
            aggregatorName: "Sum",
            rendererName: "Table",
            valueFilter: {},
          });
        } else if (dataSource === "etat_facture") {
          setPivotState({
            rows: ["client", "invoice_type"],
            cols: ["payment_status"],
            vals: ["amount"],
            aggregatorName: "Sum",
            rendererName: "Table",
            valueFilter: {},
          });
        } else if (dataSource === "ca_periodique") {
          setPivotState({
            rows: ["product", "region"],
            cols: ["period"],
            vals: ["revenue"],
            aggregatorName: "Sum",
            rendererName: "Table",
            valueFilter: {},
          });
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataSource]);

  const handleDataSourceChange = (event) => {
    setDataSource(event.target.value);
  };

  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - 10, 50));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  const handleZoomChange = (event, newValue) => {
    setZoomLevel(newValue);
  };

  return (
    <PageLayout
      title="Pivot Table"
      subtitle="Analyze and visualize your data"
      headerAction={<Box />}
      maxWidth="1400px"
    >
      <Paper
        elevation={3}
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 2,
          backgroundColor: "background.paper",
        }}
      >
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Data Source
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="data-source-label">Select Data Source</InputLabel>
            <Select
              labelId="data-source-label"
              id="data-source-select"
              value={dataSource}
              label="Select Data Source"
              onChange={handleDataSourceChange}
            >
              <MenuItem value="facturation_manuelle">
                Facturation Manuelle
              </MenuItem>
              <MenuItem value="journal_ventes">Journal des Ventes</MenuItem>
              <MenuItem value="etat_facture">État de Facture</MenuItem>
              <MenuItem value="ca_periodique">CA Periodique</MenuItem>
            </Select>
          </FormControl>

          {dataSource === "facturation_manuelle" && (
            <Typography variant="body2" color="text.secondary">
              Showing data organized by Department, Fiscal Year, Total Amount,
              and Description
            </Typography>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
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
        ) : (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6">Zoom Controls</Typography>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <IconButton onClick={handleZoomOut} color="primary">
                  <ZoomOutIcon />
                </IconButton>
                <Slider
                  value={zoomLevel}
                  onChange={handleZoomChange}
                  min={50}
                  max={200}
                  step={5}
                  sx={{ mx: 2, width: 150 }}
                />
                <IconButton onClick={handleZoomIn} color="primary">
                  <ZoomInIcon />
                </IconButton>
                <IconButton onClick={handleZoomReset} color="secondary">
                  <RestartAltIcon />
                </IconButton>
              </Box>
            </Box>

            <Box
              sx={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: "top left",
                width: `${10000 / zoomLevel}%`,
                transition: "transform 0.2s ease",
                overflow: "auto",
              }}
            >
              {data.length > 0 ? (
                <PivotTableUI
                  data={data}
                  onChange={(s) => {
                    // Only update the state with properties we care about
                    const newState = {
                      ...pivotState,
                      ...s,
                    };
                    setPivotState(newState);
                  }}
                  {...pivotState}
                  renderers={{
                    ...TableRenderers,
                    ...PlotlyRenderers,
                  }}
                />
              ) : (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="h6" color="text.secondary">
                    No data available for the selected source
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 2 }}
                  >
                    Please make sure you have uploaded and processed files of
                    this type.
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}
      </Paper>
    </PageLayout>
  );
};

export default PivotTable;
