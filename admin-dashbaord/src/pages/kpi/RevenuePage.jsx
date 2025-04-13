import React from "react";
import { Box, Typography, Paper, Button } from "@mui/material";
import RevenueKPI from "../../components/kpi/RevenueKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useTranslation } from "react-i18next";

const RevenuePage = () => {
  const { t } = useTranslation();

  return (
    <PageLayout
      title={t("revenue.title")}
      subtitle={t("revenue.subtitle")}
      headerAction={
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          size="medium"
        >
          {t("common.export")}
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
