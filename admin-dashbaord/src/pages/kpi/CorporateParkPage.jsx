import React from "react";
import { Box, Typography, Paper, Button } from "@mui/material";
import CorporateParkKPI from "../../components/kpi/CorporateParkKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const CorporateParkPage = () => {
  return (
    <PageLayout
      title="Corporate Park Analysis"
      subtitle="Monitor and analyze corporate park performance"
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
          <CorporateParkKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default CorporateParkPage;
