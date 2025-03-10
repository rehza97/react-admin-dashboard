# Enhanced Interactive Map Component

This directory contains an enhanced interactive map visualization for the admin dashboard. The map provides a visual representation of regional data across Algeria with advanced features for data exploration and analysis.

## Components

### 1. Map.jsx

The original map component with basic functionality.

### 2. DashboardMap.jsx

An advanced version of the map with the following features:

- Heat map visualization of regional data
- Interactive region search
- Zoom and pan controls
- Detailed region statistics
- Data comparison charts
- Responsive design

## Features

### Heat Map Visualization

- Regions are colored based on data intensity
- Color gradient indicates the relative value of the selected metric
- Easily switch between different metrics (users, files, anomalies)

### Interactive Controls

- Search for specific regions
- Zoom in/out and pan across the map
- Reset view to default position

### Data Visualization

- Click on regions to view detailed statistics
- Interactive charts show data distribution
- Compare selected region with top regions

### Responsive Design

- Works on desktop and mobile devices
- Adapts to different screen sizes
- Supports both light and dark themes

## Integration with Dashboard

The map is integrated directly into the Dashboard component in the "Map View" tab. It fetches real data from the backend API and displays it for all wilayas in Algeria.

## Usage

```jsx
import DashboardMap from "./components/map/DashboardMap";

// Define which regions should be interactive
const activeLinks = {
  Adrar: true,
  Chlef: true,
  // ... other regions
};

// Use the component
function MyComponent() {
  return <DashboardMap activeLinks={activeLinks} />;
}
```

## Data Source

The map fetches data from the backend API endpoint `/data/map/wilayas/`. If the API call fails, it falls back to mock data to ensure the map always displays something.

## Customization

The map can be customized by:

1. Modifying the data fetched from the backend API
2. Adjusting the color scheme in the `getHeatMapColor` function
3. Adding additional metrics to visualize
4. Customizing the modal content for region details

## Dependencies

- React
- Material-UI
- Recharts (for data visualization)
