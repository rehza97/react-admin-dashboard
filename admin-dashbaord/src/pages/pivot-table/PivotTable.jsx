import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Button,
  Tooltip,
  LinearProgress,
  Slider,
} from "@mui/material";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import Plot from "react-plotly.js";
import createPlotlyRenderers from "react-pivottable/PlotlyRenderers";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import RestoreIcon from "@mui/icons-material/Restore";
import PageLayout from "../../components/PageLayout";
import fileService from "../../services/fileService";
import { useTranslation } from "react-i18next";
import { numberFormat } from "react-pivottable/Utilities";

// Create Plotly renderers
const PlotlyRenderers = createPlotlyRenderers(Plot);

// Batch size for processing large datasets
const BATCH_SIZE = 1000;

// Create custom number formatter with French locale
const customNumberFormat = numberFormat({
  thousandsSep: " ",
  decimalSep: ",",
});

// Create custom aggregator with optimized processing
const sumOverSum = function (formatter = customNumberFormat) {
  return function (attributeArray) {
    return function () {
      let sum = 0;
      let count = 0;
      let lastProcessedTime = Date.now();

      return {
        push: function (record) {
          if (!isNaN(record[attributeArray[0]])) {
            sum += parseFloat(record[attributeArray[0]]);
            count += 1;

            // Check processing time every 1000 records
            if (count % 1000 === 0) {
              const currentTime = Date.now();
              if (currentTime - lastProcessedTime > 100) {
                // If processing takes too long, allow UI to update
                lastProcessedTime = currentTime;
                return new Promise((resolve) => setTimeout(resolve, 0));
              }
            }
          }
        },
        value: function () {
          return sum;
        },
        format: formatter,
      };
    };
  };
};

// Define aggregators
const aggregators = {
  Somme: sumOverSum(),
};

// Add column name mappings
const columnMappings = {
  month: "Mois",
  invoice_date: "Date de Facture",
  department: "Dépts",
  invoice_number: "N° Factures",
  fiscal_year: "Exercices",
  client: "Client",
  amount_pre_tax: "Montant HT",
  tax_rate: "% TVA",
  tax_amount: "Montant TVA",
  total_amount: "Montant TTC",
  description: "Désignations",
  period: "Période",
};

const PivotTable = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState("facturation_manuelle");
  const [attrValues, setAttrValues] = useState({});
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);

  // Format numbers in French style
  const formatNumber = (value) => {
    if (typeof value !== "number") return value;
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Define available data sources
  const dataSources = [
    { value: "facturation_manuelle", label: t("common.facturationManuelle") },
  ];

  // Process data in batches
  const processDataInBatches = async (rawData) => {
    setIsProcessing(true);
    setProcessingProgress(0);

    const values = {};
    const totalBatches = Math.ceil(rawData.length / BATCH_SIZE);

    try {
      for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
        const batch = rawData.slice(i, i + BATCH_SIZE);

        // Process batch
        batch.forEach((item) => {
          Object.keys(item).forEach((key) => {
            if (!values[key]) {
              values[key] = new Set();
            }
            if (item[key] !== null && item[key] !== undefined) {
              values[key].add(item[key].toString());
            }
          });
        });

        // Update progress
        const progress = Math.min(
          ((i + BATCH_SIZE) / rawData.length) * 100,
          100
        );
        setProcessingProgress(progress);

        // Allow UI to update
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Convert Sets to Arrays
      Object.keys(values).forEach((key) => {
        values[key] = Array.from(values[key]);
      });

      return values;
    } catch (error) {
      console.error("Error processing data:", error);
      throw error;
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  // Handle zoom change
  const handleZoomChange = (newZoom) => {
    setZoomLevel(newZoom);
    const pivotTable = document.querySelector(".pvtTable");
    if (pivotTable) {
      pivotTable.style.transform = `scale(${newZoom / 100})`;
      pivotTable.style.transformOrigin = "top left";
    }
  };

  // Handle zoom in
  const handleZoomIn = () => {
    handleZoomChange(Math.min(zoomLevel + 10, 200));
  };

  // Handle zoom out
  const handleZoomOut = () => {
    handleZoomChange(Math.max(zoomLevel - 10, 50));
  };

  // Handle zoom reset
  const handleZoomReset = () => {
    handleZoomChange(100);
  };

  // Fetch data with error handling and progress tracking
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fileService.getPivotData(dataSource);
        const rawData = response.data || [];

        // Transform data to use French labels
        const transformedData = rawData.map((item) => ({
          Mois: item.month,
          "Date de Facture": item.invoice_date,
          Dépts: item.department,
          "N° Factures": item.invoice_number,
          Exercices: item.fiscal_year,
          Client: item.client,
          "Montant HT": item.amount_pre_tax,
          "% TVA": item.tax_rate,
          "Montant TVA": item.tax_amount,
          "Montant TTC": item.total_amount,
          Désignations: item.description,
          Période: item.period,
        }));

        setData(transformedData);
        const processedValues = await processDataInBatches(transformedData);
        setAttrValues(processedValues);
      } catch (err) {
        console.error("Error fetching pivot data:", err);
        setError(t("pivotTable.errorLoadingData"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataSource, t]);

  // Update initial pivot state configurations
  const getInitialPivotState = (source) => {
    switch (source) {
      case "facturation_manuelle":
        return {
          rows: ["Dépts", "Exercices"],
          cols: ["Désignations"],
          vals: ["Montant TTC"],
          aggregatorName: "Somme",
          rendererName: "Table",
          valueFilter: {},
          aggregators: aggregators,
        };
      case "journal_ventes":
        return {
          rows: ["Client", "Date de Facture"],
          cols: ["Désignations"],
          vals: ["Montant TTC"],
          aggregatorName: "Somme",
          rendererName: "Table",
          valueFilter: {},
          aggregators: aggregators,
        };
      default:
        return {
          rows: ["Dépts"],
          cols: ["Désignations"],
          vals: ["Montant HT"],
          aggregatorName: "Somme",
          rendererName: "Table",
          valueFilter: {},
          aggregators: aggregators,
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

  const handleExportToExcel = () => {
    const pivotTable = document.querySelector(".pvtTable");
    if (!pivotTable) {
      alert(t("pivotTable.noDataToExport"));
      return;
    }

    const rows = pivotTable.querySelectorAll("tr");
    const tableData = [];

    // Convert table to 2D array
    rows.forEach((row) => {
      const cells = row.querySelectorAll("th, td");
      const rowData = Array.from(cells).map((cell) => cell.textContent.trim());
      tableData.push(rowData);
    });

    const timestamp = new Date().toISOString().split("T")[0];

    // Export as Excel
    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet(tableData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Pivot Table");
      XLSX.writeFile(wb, `pivot_table_${dataSource}_${timestamp}.xlsx`);
    });
  };

  const handleRefreshData = () => {
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
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Tooltip title="Zoom Out">
          <IconButton onClick={handleZoomOut} disabled={zoomLevel <= 50}>
            <ZoomOutIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ width: 100 }}>
          <Slider
            value={zoomLevel}
            min={50}
            max={200}
            onChange={(_, value) => handleZoomChange(value)}
            aria-label="Zoom"
          />
        </Box>
        <Tooltip title="Zoom In">
          <IconButton onClick={handleZoomIn} disabled={zoomLevel >= 200}>
            <ZoomInIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Reset Zoom">
          <IconButton onClick={handleZoomReset} disabled={zoomLevel === 100}>
            <RestoreIcon />
          </IconButton>
        </Tooltip>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportToExcel}
        >
          {t("pivotTable.exportAsExcel")}
        </Button>
        <Tooltip title={t("pivotTable.refreshData")}>
          <IconButton onClick={handleRefreshData} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <PageLayout
      title={t("common.pivotTable")}
      subtitle={t("pivotTable.analyzeData")}
      headerAction={headerAction}
    >
      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 4 }}>
          <CircularProgress />
          <Typography variant="body2" color="textSecondary" align="center">
            {t("pivotTable.loadingData")}
          </Typography>
        </Box>
      ) : isProcessing ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, p: 4 }}>
          <LinearProgress variant="determinate" value={processingProgress} />
          <Typography variant="body2" color="textSecondary" align="center">
            {t("pivotTable.processingData")} ({Math.round(processingProgress)}%)
          </Typography>
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
        <Paper sx={{ p: 2, overflow: "auto" }}>
          <Box
            sx={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: "top left",
              transition: "transform 0.2s ease",
            }}
          >
            <PivotTableUI
              data={data}
              onChange={setPivotState}
              renderers={Object.assign({}, TableRenderers, PlotlyRenderers)}
              {...pivotState}
              unusedOrientationCutoff={Infinity}
              rows={pivotState.rows}
              cols={pivotState.cols}
              vals={pivotState.vals}
              aggregatorName={pivotState.aggregatorName}
              rendererName={pivotState.rendererName}
              valueFilter={pivotState.valueFilter}
              attrValues={attrValues}
              aggregators={aggregators}
              localeStrings={{
                renderError: t("pivotTable.renderError"),
                computeError: t("pivotTable.computeError"),
                rowTotal: "Total",
                colTotal: "Total",
                totals: "Totaux",
                vs: "contre",
                by: "par",
              }}
            />
          </Box>
        </Paper>
      )}
    </PageLayout>
  );
};

export default PivotTable;
