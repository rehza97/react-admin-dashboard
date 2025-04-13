import { useState, useEffect } from "react";
import { Grid, CircularProgress, Box, Tooltip } from "@mui/material";
import CardComponent from "./CardComponent";
import { Person, Warning, CloudUpload, Business } from "@mui/icons-material";
import dataService from "../../services/dataService";
import { useTranslation } from "react-i18next";

export default function Row1() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [overviewData, setOverviewData] = useState({
    users: { total: 0, active: 0, disabled: 0 },
    files: { total: 0, size: "0 bytes" },
    anomalies: { total: 0, open: 0 },
    dots: { count: 0, list: [] },
    data: {
      journal_ventes: 0,
      etat_facture: 0,
      parc_corporate: 0,
      creances_ngbss: 0,
      total_records: 0,
    },
    recent_uploads: [],
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchOverviewData = async () => {
      try {
        setLoading(true);
        // Use dataService instead of direct axios call
        const data = await dataService.getDashboardOverview();

        // Ensure all expected properties exist with defaults
        const processedData = {
          users: {
            total: data.users?.total || 0,
            active: data.users?.active || 0,
            disabled: data.users?.disabled || 0,
          },
          files: {
            total: data.files?.total || 0,
            size: data.files?.size || "0 bytes",
          },
          anomalies: {
            total: data.anomalies?.total || 0,
            open: data.anomalies?.open || 0,
          },
          dots: {
            count: data.dots?.count || 0,
            list: data.dots?.list || [],
          },
          data: {
            journal_ventes: data.data?.journal_ventes || 0,
            etat_facture: data.data?.etat_facture || 0,
            parc_corporate: data.data?.parc_corporate || 0,
            creances_ngbss: data.data?.creances_ngbss || 0,
            total_records: data.data?.total_records || 0,
          },
          recent_uploads: data.recent_uploads || [],
        };

        setOverviewData(processedData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching overview data:", err);
        setError(t("dashboard.errorLoading"));
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, [t]);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <Warning color="error" sx={{ mr: 1 }} />
        {error}
      </Box>
    );
  }

  // Create pie data for users (active vs disabled)
  const userPieData = [
    {
      name: t("users.active"),
      value: overviewData.users.active,
      color: "#00C49F",
    },
    {
      name: t("users.inactive"),
      value: overviewData.users.disabled,
      color: "#FF8042",
    },
  ];

  // Create pie data for anomalies (open vs resolved)
  const anomalyPieData = [
    {
      name: t("anomalyScan.openAnomalies"),
      value: overviewData.anomalies.open,
      color: "#FF8042",
    },
    {
      name: t("anomalyScan.resolvedAnomalies"),
      value: overviewData.anomalies.total - overviewData.anomalies.open,
      color: "#00C49F",
    },
  ];

  // Create pie data for DOTs
  const dotPieData =
    overviewData.dots.count > 0
      ? [{ name: "DOTs", value: overviewData.dots.count, color: "#0088FE" }]
      : [];

  const formatter = new Intl.NumberFormat("fr-FR");

  return (
    <Grid
      container
      spacing={{ xs: 1, sm: 2, md: 3 }}
      sx={{
        p: { xs: 1, sm: 2, md: 4 },
        width: "100%",
        margin: 0,
        boxSizing: "border-box",
      }}
    >
      <Grid item xs={12} sm={6} lg={3}>
        <Tooltip
          title={`${t("users.active")}: ${formatter.format(
            overviewData.users.active
          )}, ${t("users.inactive")}: ${formatter.format(
            overviewData.users.disabled
          )}`}
        >
          <div style={{ width: "100%", height: "100%" }}>
            <CardComponent
              title={t("dashboard.totalUsers")}
              subtitle={t("dashboard.userAccounts")}
              icon={<Person />}
              data={userPieData}
              value={formatter.format(overviewData.users.total)}
              change={0}
              percentageChange={0}
              changeLabel={t("dashboard.userAccounts")}
              color="#00C49F"
            />
          </div>
        </Tooltip>
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Tooltip
          title={`${t("dashboard.databaseSize")}: ${overviewData.files.size}`}
        >
          <div style={{ width: "100%", height: "100%" }}>
            <CardComponent
              title={t("dashboard.totalFiles")}
              subtitle={t("dashboard.totalUploaded")}
              icon={<CloudUpload />}
              data={[]}
              value={formatter.format(overviewData.files.total)}
              change={0}
              percentageChange={0}
              changeLabel={t("dashboard.filesUploaded")}
              color="#0088FE"
            />
          </div>
        </Tooltip>
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Tooltip
          title={`${t("anomalyScan.openAnomalies")}: ${formatter.format(
            overviewData.anomalies.open
          )}, ${t("anomalyScan.totalAnomalies")}: ${formatter.format(
            overviewData.anomalies.total
          )}`}
        >
          <div style={{ width: "100%", height: "100%" }}>
            <CardComponent
              title={t("dashboard.anomalies")}
              subtitle={t("dashboard.issuesDetected")}
              icon={<Warning />}
              data={anomalyPieData}
              value={formatter.format(overviewData.anomalies.total)}
              change={overviewData.anomalies.open}
              percentageChange={0}
              changeLabel={t("anomalyScan.openAnomalies")}
              color="#FF8042"
            />
          </div>
        </Tooltip>
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <Tooltip
          title={`${t("dots.totalDOTs")}: ${formatter.format(
            overviewData.dots.count
          )}`}
        >
          <div style={{ width: "100%", height: "100%" }}>
            <CardComponent
              title="DOTs"
              subtitle={t("dots.businessUnits")}
              icon={<Business />}
              data={dotPieData}
              value={formatter.format(overviewData.dots.count)}
              change={0}
              percentageChange={0}
              changeLabel={t("dots.businessUnits")}
              color="#FFBB28"
            />
          </div>
        </Tooltip>
      </Grid>
    </Grid>
  );
}
