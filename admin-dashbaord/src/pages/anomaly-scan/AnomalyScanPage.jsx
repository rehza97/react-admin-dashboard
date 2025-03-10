import React, { useEffect, useState } from "react";
import { Typography, Box, Button } from "@mui/material";
import AnomalyScanTool from "../../components/AnomalyScanTool";
import PageLayout from "../../components/PageLayout";
import { useTranslation } from "react-i18next";
import RefreshIcon from "@mui/icons-material/Refresh";
import anomalyService from "../../services/anomalyService";

const AnomalyScanPage = () => {
  const { t } = useTranslation();
  const [statsLoading, setStatsLoading] = useState(true);
  const [anomalyStats, setAnomalyStats] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchAnomalyStats = async () => {
      try {
        setStatsLoading(true);
        const stats = await anomalyService.getAnomalyStats();
        setAnomalyStats(stats);
      } catch (error) {
        console.error("Error fetching anomaly stats:", error);
        setSnackbar({
          open: true,
          message: t("anomalyScan.errorFetchingStats"),
          severity: "error",
        });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchAnomalyStats();
  }, [t]);

  const headerAction = (
    <Button variant="contained" color="primary" startIcon={<RefreshIcon />}>
      {t("anomalyScan.startScan")}
    </Button>
  );

  return (
    <PageLayout
      title={t("common.anomalyScan")}
      subtitle={t("anomalyScan.detectAndAnalyzeAnomalies")}
      headerAction={headerAction}
    >
      <Box sx={{ my: 4 }}>
        <AnomalyScanTool />
      </Box>
    </PageLayout>
  );
};

export default AnomalyScanPage;
