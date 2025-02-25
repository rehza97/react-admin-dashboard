import React, { useState } from "react";
import { Box, Typography, Paper } from "@mui/material";
import PivotTableUI from "react-pivottable/PivotTableUI";
import "react-pivottable/pivottable.css";
import TableRenderers from "react-pivottable/TableRenderers";
import Plot from "react-plotly.js";
import createPlotlyRenderers from "react-pivottable/PlotlyRenderers";

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

  // Initial state for the pivot table
  const [state, setState] = useState({
    data: data,
    rows: ["Month"],
    cols: ["Category"],
    vals: ["Sales"],
    rendererName: "Table",
    aggregatorName: "Sum",
  });

  return (
    <Box sx={{ height: "100%" ,width: "98%" }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Pivot Table
      </Typography>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 2, 
          height: "calc(100vh - 180px)", 
          overflow: "auto",
          backgroundColor: "background.paper" 
        }}
      >
        <PivotTableUI
          data={state.data}
          onChange={s => setState(s)}
          renderers={Object.assign({}, TableRenderers, PlotlyRenderers)}
          {...state}
        />
      </Paper>
    </Box>
  );
};

export default PivotTable; 