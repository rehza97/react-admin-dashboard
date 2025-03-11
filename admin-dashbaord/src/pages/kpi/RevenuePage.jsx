import React from "react";
import { Box, Typography, Paper, Button } from "@mui/material";
import RevenueKPI from "../../components/kpi/RevenueKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const RevenuePage = () => {
  return (
    <PageLayout
      title="Revenue Analysis"
      subtitle="Monitor and analyze revenue performance"
      headerAction={
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          size="medium"
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
