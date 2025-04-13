import { useState, useEffect } from "react";
import {
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  CardHeader,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
} from "@mui/material";
import { Warning } from "@mui/icons-material";
import dataService from "../../services/dataService";
import { useTranslation } from "react-i18next";

export default function Row2() {
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

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return t("common.noData");
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusTranslation = (status) => {
    switch (status) {
      case "completed":
        return t("fileUpload.completed");
      case "failed":
        return t("fileUpload.failed");
      case "processing":
        return t("fileUpload.processing");
      default:
        return status;
    }
  };

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
      {/* Recent Uploads */}
      <Grid item xs={12} md={6}>
        <Paper
          elevation={2}
          sx={{
            p: 2,
            borderRadius: 2,
            height: "100%",
            transition: "all 0.3s ease-in-out",
            "&:hover": {
              transform: "translateY(-5px)",
              boxShadow: 6,
            },
          }}
        >
          <Typography variant="h6" gutterBottom fontWeight="bold">
            {t("dashboard.recentUploads")}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t("fileUpload.invoiceNumber")}</TableCell>
                  <TableCell>{t("fileUpload.uploadedBy")}</TableCell>
                  <TableCell>{t("common.date")}</TableCell>
                  <TableCell>{t("common.status")}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overviewData.recent_uploads.length > 0 ? (
                  overviewData.recent_uploads.map((upload, index) => (
                    <TableRow key={index}>
                      <TableCell>{upload.invoice_number}</TableCell>
                      <TableCell>{upload.uploaded_by__email}</TableCell>
                      <TableCell>{formatDate(upload.upload_date)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={getStatusTranslation(upload.status)}
                          color={
                            upload.status === "completed"
                              ? "success"
                              : upload.status === "failed"
                              ? "error"
                              : upload.status === "processing"
                              ? "warning"
                              : "info"
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      {t("fileUpload.noRecentUploads")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>

      {/* Data Statistics */}
      <Grid item xs={12} md={6}>
        <Paper
          elevation={2}
          sx={{
            p: 2,
            borderRadius: 2,
            height: "100%",
            transition: "all 0.3s ease-in-out",
            "&:hover": {
              transform: "translateY(-5px)",
              boxShadow: 6,
            },
          }}
        >
          <Typography variant="h6" gutterBottom fontWeight="bold">
            {t("dashboard.statistics")}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {t("common.journalVentes")}
                  </Typography>
                  <Typography variant="h4">
                    {formatter.format(overviewData.data.journal_ventes)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("dashboard.records")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="secondary">
                    {t("common.etatFacture")}
                  </Typography>
                  <Typography variant="h4">
                    {formatter.format(overviewData.data.etat_facture)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("dashboard.records")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="success.main">
                    {t("common.parcCorporate")}
                  </Typography>
                  <Typography variant="h4">
                    {formatter.format(overviewData.data.parc_corporate)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("dashboard.records")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="warning.main">
                    {t("common.creancesNGBSS")}
                  </Typography>
                  <Typography variant="h4">
                    {formatter.format(overviewData.data.creances_ngbss)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("dashboard.records")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      </Grid>
    </Grid>
  );
}
