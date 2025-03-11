import React from "react";
import { Box, Typography, Paper, Button } from "@mui/material";
import UnfinishedInvoiceKPI from "../../components/kpi/UnfinishedInvoiceKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const UnfinishedInvoicePage = () => {
  return (
    <PageLayout
      title="Unfinished Invoices Analysis"
      subtitle="Monitor and analyze unfinished invoices"
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
          <UnfinishedInvoiceKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default UnfinishedInvoicePage;
