import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  AttachMoney,
  AccountBalance,
  Business,
  Receipt,
  Assessment,
  TrendingUp,
} from "@mui/icons-material";
import Row1 from "./Row1";
import Row2 from "./Row2";
import { useTranslation } from "react-i18next";
import kpiService from "../../services/kpiService";

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchSummaryData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await kpiService.getDashboardSummary({
          signal: controller.signal,
        });
        if (isMounted) {
          setSummaryData(data);
        }
      } catch (error) {
        if (error.name !== "AbortError" && isMounted) {
          console.error("Error fetching dashboard summary:", error);
          setError(error.message || "Failed to load dashboard data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSummaryData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const kpiCards = [
    {
      title: t("dashboard.revenueAnalysis"),
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      color: "primary.main",
      path: "/kpi/revenue",
      value: summaryData?.total_revenue || 0,
      change: summaryData?.revenue_change || 0,
      format: "currency",
    },
    {
      title: t("dashboard.collectionsAnalysis"),
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: "success.main",
      path: "/kpi/collections",
      value: summaryData?.total_collection || 0,
      change: summaryData?.collection_rate || 0,
      format: "currency",
    },
    {
      title: t("dashboard.receivablesAnalysis"),
      icon: <AccountBalance sx={{ fontSize: 40 }} />,
      color: "warning.main",
      path: "/kpi/receivables",
      value: summaryData?.total_receivables || 0,
      change: summaryData?.receivables_change || 0,
      format: "currency",
    },
    {
      title: t("dashboard.corporatePark"),
      icon: <Business sx={{ fontSize: 40 }} />,
      color: "info.main",
      path: "/kpi/corporate-park",
      value: summaryData?.total_subscribers || 0,
      change: summaryData?.subscribers_change || 0,
      format: "number",
    },
    {
      title: t("dashboard.unfinishedInvoices"),
      icon: <Receipt sx={{ fontSize: 40 }} />,
      color: "error.main",
      path: "/kpi/unfinished-invoices",
      value: summaryData?.unfinished_invoices?.total || 0,
      change: summaryData?.unfinished_invoices?.change || 0,
      format: "number",
    },
  ];

  const formatValue = (value, format) => {
    if (value === undefined || value === null) return "N/A";

    if (format === "currency") {
      return new Intl.NumberFormat("fr-DZ", {
        style: "currency",
        currency: "DZD",
        maximumFractionDigits: 0,
      }).format(value);
    }

    return new Intl.NumberFormat("fr-DZ").format(value);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t("dashboard.overview")}
      </Typography>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* KPI Navigation Cards */}
      {!loading && !error && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {kpiCards.map((card, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card
                sx={{
                  height: "100%",
                  transition: "transform 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 6,
                  },
                }}
              >
                <CardActionArea
                  onClick={() => navigate(card.path)}
                  sx={{ height: "100%" }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        mb: 2,
                      }}
                    >
                      <Box
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          bgcolor: card.color,
                          color: "white",
                          mr: 2,
                        }}
                      >
                        {card.icon}
                      </Box>
                      <Typography variant="h6" component="div">
                        {card.title}
                      </Typography>
                    </Box>
                    <Typography variant="h4" color="text.primary" gutterBottom>
                      {formatValue(card.value, card.format)}
                    </Typography>
                    {card.change !== undefined && (
                      <Typography
                        variant="body2"
                        color={card.change >= 0 ? "success.main" : "error.main"}
                      >
                        {card.change >= 0 ? "+" : ""}
                        {card.change.toFixed(2)}%
                      </Typography>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Overview Rows */}
      <Row1 />
      <Row2 />
    </Box>
  );
};

export default Dashboard;
