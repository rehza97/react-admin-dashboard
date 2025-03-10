import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import RevenueKPI from "../../components/kpi/RevenueKPI";
import PageLayout from "../../components/PageLayout";

const RevenuePage = () => {
  return (
    <PageLayout
      title="Revenue Analysis"
      subtitle="Monitor and analyze revenue performance"
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
