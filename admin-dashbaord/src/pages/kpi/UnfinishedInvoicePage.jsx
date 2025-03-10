import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import UnfinishedInvoiceKPI from "../../components/kpi/UnfinishedInvoiceKPI";
import PageLayout from "../../components/PageLayout";

const UnfinishedInvoicePage = () => {
  return (
    <PageLayout
      title="Unfinished Invoices Analysis"
      subtitle="Monitor and analyze unfinished invoices"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          <UnfinishedInvoiceKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default UnfinishedInvoicePage;
