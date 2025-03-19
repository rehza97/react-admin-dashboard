import { useEffect } from "react";
import { Box, Paper, Button } from "@mui/material";
import RevenueKPI from "../../components/kpi/RevenueKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const RevenuePage = () => {
  // Add component mount logging
  useEffect(() => {
    console.log("=== REVENUE PAGE MOUNTED ===");
    console.log(
      "This page uses the RevenueKPI component to fetch and display revenue data"
    );
    console.log(
      "Check the RevenueKPI component logs for detailed API response data"
    );

    return () => {
      console.log("=== REVENUE PAGE UNMOUNTED ===");
    };
  }, []);

  const handleExportData = () => {
    console.log("Export button clicked - data would be exported here");
    // Export functionality would go here
  };

  return (
    <PageLayout
      title="Revenue Analysis"
      subtitle="Monitor and analyze revenue performance"
      headerAction={
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          size="medium"
          onClick={handleExportData}
        >
          Export
        </Button>
      }
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          <RevenueKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default RevenuePage;
