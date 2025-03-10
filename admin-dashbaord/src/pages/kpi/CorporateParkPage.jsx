import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import CorporateParkKPI from "../../components/kpi/CorporateParkKPI";
import PageLayout from "../../components/PageLayout";

const CorporateParkPage = () => {
  return (
    <PageLayout
      title="Corporate Park Analysis"
      subtitle="Monitor and analyze corporate park performance"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          <CorporateParkKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default CorporateParkPage;
