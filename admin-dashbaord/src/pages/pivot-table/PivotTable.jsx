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
  Button,
  Tooltip,
  Divider,
} from "@mui/material";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import Plot from "react-plotly.js";
import createPlotlyRenderers from "react-pivottable/PlotlyRenderers";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SaveIcon from "@mui/icons-material/Save";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import PageLayout from "../../components/PageLayout";
import fileService from "../../services/fileService";
import { useTranslation } from "react-i18next";

// Create Plotly renderers
const PlotlyRenderers = createPlotlyRenderers(Plot);

const PivotTable = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState("facturation_manuelle");
  const [zoomLevel, setZoomLevel] = useState(100);

  // Define available data sources
  const dataSources = [
    { value: "facturation_manuelle", label: t("common.facturationManuelle") },
    { value: "journal_ventes", label: t("common.journalVentes") },
    { value: "etat_facture", label: t("common.etatFacture") },
    { value: "parc_corporate", label: t("common.parcCorporate") },
    { value: "creances_ngbss", label: t("common.creancesNGBSS") },
    { value: "ca_periodique", label: t("common.caPeriodique") },
    { value: "ca_non_periodique", label: t("common.caNonPeriodique") },
    { value: "ca_dnt", label: t("common.caDNT") },
    { value: "ca_rfd", label: t("common.caRFD") },
    { value: "ca_cnt", label: t("common.caCNT") },
  ];

  // Initial pivot table configuration based on data source
  const getInitialPivotState = (source) => {
    switch (source) {
      case "facturation_manuelle":
        return {
          rows: ["department", "fiscal_year"],
          cols: ["description"],
          vals: ["total_amount"],
          aggregatorName: "Sum",
          rendererName: "Table",
          valueFilter: {},
        };
      case "journal_ventes":
        return {
          rows: ["client", "date"],
          cols: ["product"],
          vals: ["amount"],
          aggregatorName: "Sum",
          rendererName: "Table",
          valueFilter: {},
        };
      // Add more configurations for other data sources
      default:
        return {
          rows: ["department"],
          cols: ["description"],
          vals: ["amount"],
          aggregatorName: "Sum",
          rendererName: "Table",
          valueFilter: {},
        };
    }
  };

  const [pivotState, setPivotState] = useState(
    getInitialPivotState(dataSource)
  );

  // Handle data source change
  const handleDataSourceChange = (event) => {
    const newDataSource = event.target.value;
    setDataSource(newDataSource);
    setPivotState(getInitialPivotState(newDataSource));
  };

  // Fetch data based on selected data source
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fileService.getPivotData(dataSource);
        setData(response.data || []);
      } catch (err) {
        console.error("Error fetching pivot data:", err);
        setError(t("pivotTable.errorLoadingData"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataSource, t]);

  // Translate aggregator names
  const translateAggregatorName = (name) => {
    const translations = {
      Sum: t("pivotTable.sum"),
      Count: t("pivotTable.count"),
      "Count Unique Values": t("pivotTable.countUnique"),
      "List Unique Values": t("pivotTable.listUnique"),
      Average: t("pivotTable.average"),
      Median: t("pivotTable.median"),
      "Sample Variance": t("pivotTable.variance"),
      "Sample Standard Deviation": t("pivotTable.standardDeviation"),
      Minimum: t("pivotTable.min"),
      Maximum: t("pivotTable.max"),
    };
    return translations[name] || name;
  };

  // Translate renderer names
  const translateRendererName = (name) => {
    const translations = {
      Table: t("common.table"),
      "Table Heatmap": t("pivotTable.tableHeatmap"),
      Heatmap: t("pivotTable.heatmap"),
      "Row Heatmap": t("pivotTable.rowHeatmap"),
      "Col Heatmap": t("pivotTable.colHeatmap"),
      "Line Chart": t("common.line"),
      "Bar Chart": t("common.bar"),
      "Stacked Bar Chart": t("pivotTable.stackedBar"),
      "Area Chart": t("pivotTable.areaChart"),
      "Scatter Chart": t("pivotTable.scatterChart"),
    };
    return translations[name] || name;
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 10, 50));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  const handleZoomChange = (event, newValue) => {
    setZoomLevel(newValue);
  };

  const handleSaveConfiguration = () => {
    const config = JSON.stringify(pivotState);
    localStorage.setItem("pivotTableConfig", config);
    alert(t("pivotTable.configurationSaved"));
  };

  const handleLoadConfiguration = () => {
    const savedConfig = localStorage.getItem("pivotTableConfig");
    if (savedConfig) {
      setPivotState(JSON.parse(savedConfig));
      alert(t("pivotTable.configurationLoaded"));
    }
  };

  const handleExportData = () => {
    // Simple CSV export
    if (data.length === 0) return;

    const headers = Object.keys(data[0]).join(",");
    const csvRows = data.map((row) =>
      Object.values(row)
        .map((value) =>
          typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value
        )
        .join(",")
    );

    const csvContent = [headers, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pivot_data_${dataSource}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRefreshData = () => {
    // Trigger a re-fetch of the data
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fileService.getPivotData(dataSource);
        setData(response.data || []);
      } catch (err) {
        console.error("Error refreshing pivot data:", err);
        setError(t("pivotTable.errorLoadingData"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  };

  const headerAction = (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <FormControl sx={{ minWidth: 200 }}>
        <InputLabel id="data-source-label">{t("common.dataSource")}</InputLabel>
        <Select
          labelId="data-source-label"
          value={dataSource}
          label={t("common.dataSource")}
          onChange={handleDataSourceChange}
        >
          {dataSources.map((source) => (
            <MenuItem key={source.value} value={source.value}>
              {source.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Tooltip title={t("pivotTable.refreshData")}>
        <IconButton onClick={handleRefreshData} color="primary">
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );

  return (
    <PageLayout
      title={t("common.pivotTable")}
      subtitle={t("pivotTable.analyzeData")}
      headerAction={headerAction}
    >
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : data.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t("pivotTable.noDataAvailable")}
        </Alert>
      ) : (
        <Box>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6">
                {t("pivotTable.tableOptions")}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Tooltip title={t("pivotTable.zoomIn")}>
                  <IconButton onClick={handleZoomIn}>
                    <ZoomInIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("pivotTable.zoomOut")}>
                  <IconButton onClick={handleZoomOut}>
                    <ZoomOutIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("pivotTable.resetZoom")}>
                  <IconButton onClick={handleZoomReset}>
                    <RestartAltIcon />
                  </IconButton>
                </Tooltip>
                <Slider
                  value={zoomLevel}
                  onChange={handleZoomChange}
                  aria-labelledby="zoom-slider"
                  min={50}
                  max={200}
                  sx={{ width: 100, mx: 2 }}
                />
                <Typography variant="body2">{zoomLevel}%</Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={handleSaveConfiguration}
              >
                {t("pivotTable.saveConfiguration")}
              </Button>
              <Button variant="outlined" onClick={handleLoadConfiguration}>
                {t("pivotTable.loadConfiguration")}
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportData}
              >
                {t("pivotTable.exportTable")}
              </Button>
            </Box>
          </Paper>

          <Paper
            sx={{
              p: 2,
              overflow: "auto",
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: "top left",
              width: `${10000 / zoomLevel}%`,
              transition: "transform 0.2s",
            }}
          >
            <PivotTableUI
              data={data}
              onChange={(s) => setPivotState(s)}
              renderers={Object.assign({}, TableRenderers, PlotlyRenderers)}
              {...pivotState}
              unusedOrientationCutoff={Infinity}
              // Translate UI elements
              rows={pivotState.rows}
              cols={pivotState.cols}
              vals={pivotState.vals}
              aggregatorName={pivotState.aggregatorName}
              rendererName={pivotState.rendererName}
              valueFilter={pivotState.valueFilter}
              // Localization props
              localeStrings={{
                renderError: t("pivotTable.renderError"),
                computeError: t("pivotTable.computeError"),
                rowTotal: t("pivotTable.rowTotal"),
                colTotal: t("pivotTable.colTotal"),
                totals: t("pivotTable.totals"),
                vs: t("pivotTable.vs"),
                by: t("pivotTable.by"),
              }}
            />
          </Paper>
        </Box>
      )}
    </PageLayout>
  );
};

export default PivotTable;
