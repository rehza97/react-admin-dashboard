import React from "react";
import MyResponsiveLine from './MyResponsiveLine';

const LineChart = () => {
  // Sample data for the line chart
  const data = [
    {
      id: 'japan',
      color: 'hsl(348, 70%, 50%)',
      data: [
        { x: 'plane', y: 200 },
        { x: 'helicopter', y: 100 },
        { x: 'boat', y: 300 },
        { x: 'train', y: 400 },
        { x: 'subway', y: 500 },
        { x: 'bus', y: 600 },
        { x: 'car', y: 700 },
      ],
    },
    {
      id: 'france',
      color: 'hsl(205, 70%, 50%)',
      data: [
        { x: 'plane', y: 300 },
        { x: 'helicopter', y: 200 },
        { x: 'boat', y: 400 },
        { x: 'train', y: 500 },
        { x: 'subway', y: 600 },
        { x: 'bus', y: 700 },
        { x: 'car', y: 800 },
      ],
    },
    // Add more data as needed
  ];

  return (
    <div style={{ marginTop: '16px', width: '100%', height: '80vh' }}>
      <h1>Line Chart Page</h1>
      <MyResponsiveLine data={data} />
    </div>
  );
};

export default LineChart; 