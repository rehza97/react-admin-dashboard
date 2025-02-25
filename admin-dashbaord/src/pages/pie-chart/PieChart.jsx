import React from "react";
import MyResponsivePie from "./MyResponsivePie";

const PieChart = () => {
  // Sample data for the pie chart
  const data = [
    {
      id: "ruby",
      label: "Ruby",
      value: 55,
      color: "hsl(348, 70%, 50%)",
    },
    {
      id: "c",
      label: "C",
      value: 25,
      color: "hsl(205, 70%, 50%)",
    },
    {
      id: "go",
      label: "Go",
      value: 20,
      color: "hsl(120, 70%, 50%)",
    },
    {
      id: "python",
      label: "Python",
      value: 30,
      color: "hsl(60, 70%, 50%)",
    },
    // Add more data as needed
  ];

  return (
    <div style={{ marginTop: "16px", width: "100%", height: "80vh" }}>
      <h1>Pie Chart Page</h1>
      <MyResponsivePie data={data} />
    </div>
  );
};

export default PieChart;
