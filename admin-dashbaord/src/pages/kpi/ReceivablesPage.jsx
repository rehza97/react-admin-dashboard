import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import ReceivablesKPI from "../../components/kpi/ReceivablesKPI";
import PageLayout from "../../components/PageLayout";

const ReceivablesPage = () => {
  return (
    <PageLayout
      title="Receivables Analysis"
      subtitle="Monitor and analyze receivables performance"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          <ReceivablesKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default ReceivablesPage;
