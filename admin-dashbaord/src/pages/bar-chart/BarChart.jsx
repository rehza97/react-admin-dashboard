import React from "react";
import MyResponsiveBar from './MyResponsiveBar';
import { useTheme } from "@mui/material";

const BarChart = () => {
  // Sample data for the bar chart
  const data = [
    {
      country: 'AD',
      'hot dog': 60,
      'burger': 80,
      'sandwich': 30,
      'kebab': 50,
      'fries': 90,
      'donut': 40,
    },
    {
      country: 'AE',
      'hot dog': 70,
      'burger': 60,
      'sandwich': 50,
      'kebab': 80,
      'fries': 30,
      'donut': 20,
    },
    // Add more data as needed
  ];
  const theme = useTheme();
  return (
    <div style={{ marginTop: '16px', width: '100%', height: '80vh' }}>
      <h1>Bar Chart Page</h1>
      <MyResponsiveBar data={data} theme={theme} />
    </div>
  );
};

export default BarChart; 