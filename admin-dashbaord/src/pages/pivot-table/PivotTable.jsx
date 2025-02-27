import React, { useState } from "react";
import { Box, Typography, Paper, IconButton, Slider, Tooltip } from "@mui/material";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import Plot from "react-plotly.js";
import createPlotlyRenderers from "react-pivottable/PlotlyRenderers";
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PageLayout from "../../components/PageLayout";

// Create Plotly renderers
const PlotlyRenderers = createPlotlyRenderers(Plot);

const PivotTable = () => {
  // Sample data for the pivot table
  const data = [
    { Month: "Jan", Category: "Fruits", Region: "North", Sales: 150, Quantity: 20 },
    { Month: "Jan", Category: "Vegetables", Region: "North", Sales: 200, Quantity: 30 },
    { Month: "Jan", Category: "Fruits", Region: "South", Sales: 180, Quantity: 25 },
    { Month: "Feb", Category: "Fruits", Region: "North", Sales: 160, Quantity: 22 },
    { Month: "Feb", Category: "Vegetables", Region: "North", Sales: 190, Quantity: 28 },
    { Month: "Feb", Category: "Fruits", Region: "South", Sales: 170, Quantity: 24 },
    { Month: "Mar", Category: "Fruits", Region: "North", Sales: 140, Quantity: 19 },
    { Month: "Mar", Category: "Vegetables", Region: "North", Sales: 210, Quantity: 32 },
    { Month: "Mar", Category: "Fruits", Region: "South", Sales: 190, Quantity: 27 },
    { Month: "Apr", Category: "Fruits", Region: "North", Sales: 170, Quantity: 23 },
    { Month: "Apr", Category: "Vegetables", Region: "North", Sales: 220, Quantity: 35 },
    { Month: "Apr", Category: "Fruits", Region: "South", Sales: 200, Quantity: 29 },
    { Month: "May", Category: "Fruits", Region: "North", Sales: 180, Quantity: 25 },
    { Month: "May", Category: "Vegetables", Region: "North", Sales: 230, Quantity: 37 },
    { Month: "May", Category: "Fruits", Region: "South", Sales: 210, Quantity: 31 },
    { Month: "Jun", Category: "Fruits", Region: "North", Sales: 190, Quantity: 27 },
    { Month: "Jun", Category: "Vegetables", Region: "North", Sales: 240, Quantity: 39 },
    { Month: "Jun", Category: "Fruits", Region: "South", Sales: 220, Quantity: 33 },
    { Month: "Jul", Category: "Fruits", Region: "North", Sales: 200, Quantity: 29 },
    { Month: "Jul", Category: "Vegetables", Region: "North", Sales: 250, Quantity: 41 },
    { Month: "Jul", Category: "Fruits", Region: "South", Sales: 230, Quantity: 35 },
    { Month: "Aug", Category: "Fruits", Region: "North", Sales: 210, Quantity: 31 },
    { Month: "Aug", Category: "Vegetables", Region: "North", Sales: 260, Quantity: 43 },
    { Month: "Aug", Category: "Fruits", Region: "South", Sales: 240, Quantity: 37 },
    { Month: "Sep", Category: "Fruits", Region: "North", Sales: 220, Quantity: 33 },
    { Month: "Sep", Category: "Vegetables", Region: "North", Sales: 270, Quantity: 45 },
    { Month: "Sep", Category: "Fruits", Region: "South", Sales: 250, Quantity: 39 },
    { Month: "Oct", Category: "Fruits", Region: "North", Sales: 230, Quantity: 35 },
    { Month: "Oct", Category: "Vegetables", Region: "North", Sales: 280, Quantity: 47 },
    { Month: "Oct", Category: "Fruits", Region: "South", Sales: 260, Quantity: 41 },
    { Month: "Nov", Category: "Fruits", Region: "North", Sales: 240, Quantity: 37 },
    { Month: "Nov", Category: "Vegetables", Region: "North", Sales: 290, Quantity: 49 },
    { Month: "Nov", Category: "Fruits", Region: "South", Sales: 270, Quantity: 43 },
    { Month: "Dec", Category: "Fruits", Region: "North", Sales: 250, Quantity: 39 },
    { Month: "Dec", Category: "Vegetables", Region: "North", Sales: 300, Quantity: 51 },
    { Month: "Dec", Category: "Fruits", Region: "South", Sales: 280, Quantity: 45 },
  ];

  // State for zoom control
  const [zoom, setZoom] = useState(100);
  const [state, setState] = useState({
    data: data,
    rows: ["Month"],
    cols: ["Category"],
    vals: ["Sales"],
    rendererName: "Table",
    aggregatorName: "Sum",
  });

  // Zoom control handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 10, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 10, 50));
  };

  const handleZoomReset = () => {
    setZoom(100);
  };

  const handleZoomChange = (event, newValue) => {
    setZoom(newValue);
  };

  // Custom styles for the zoom controls
  const zoomControlStyles = {
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'background.paper',
    padding: 1,
    borderRadius: 2,
    boxShadow: 3,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  };

  return (
    <PageLayout
      title="Pivot Table"
      subtitle="Interactive data analysis tool"
    >
      <Box 
        sx={{ 
          position: 'relative',
          height: 'calc(100vh - 200px)',
          overflow: 'auto'
        }}
      >
        {/* Zoom Controls */}
        <Paper sx={zoomControlStyles}>
          <Tooltip title="Zoom Out">
            <IconButton 
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              size="small"
            >
              <ZoomOutIcon />
            </IconButton>
          </Tooltip>

          <Box sx={{ width: 100, mx: 2 }}>
            <Slider
              value={zoom}
              onChange={handleZoomChange}
              min={50}
              max={200}
              step={10}
              valueLabelDisplay="auto"
              valueLabelFormat={value => `${value}%`}
            />
          </Box>

          <Tooltip title="Zoom In">
            <IconButton 
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              size="small"
            >
              <ZoomInIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Reset Zoom">
            <IconButton 
              onClick={handleZoomReset}
              disabled={zoom === 100}
              size="small"
            >
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Pivot Table Container */}
        <Box 
          sx={{ 
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            transition: 'transform 0.2s ease',
            '& .pvtTable': {
              // Override default table styles
              maxWidth: 'none',
              whiteSpace: 'nowrap',
            },
            '& .pvtAxisContainer, & .pvtVals': {
              // Improve drag and drop areas
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              padding: 1,
              margin: 1,
            },
            '& .pvtAxisContainer li': {
              // Improve draggable items
              padding: '2px 5px',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              margin: '2px',
              backgroundColor: 'background.paper',
            },
            // Add responsive styles
            '@media (max-width: 600px)': {
              '& .pvtTable': {
                fontSize: '12px',
              },
              '& .pvtAxisContainer li': {
                fontSize: '11px',
                padding: '1px 3px',
              },
            },
          }}
        >
          <PivotTableUI
            data={state.data}
            onChange={s => setState(s)}
            renderers={Object.assign({}, TableRenderers, PlotlyRenderers)}
            {...state}
            unusedOrientationCutoff={Infinity}
          />
        </Box>
      </Box>
    </PageLayout>
  );
};

export default PivotTable; 