import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActionArea,
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

  useEffect(() => {
    const fetchSummaryData = async () => {
      try {
        const data = await kpiService.getDashboardSummary();
        setSummaryData(data);
      } catch (error) {
        console.error("Error fetching dashboard summary:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummaryData();
  }, []);

  const kpiCards = [
    {
      title: "Revenue Analysis",
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      color: "primary.main",
      path: "/kpi/revenue",
      value: summaryData?.total_revenue || 0,
      change: summaryData?.revenue_change || 0,
    },
    {
      title: "Collections Analysis",
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: "success.main",
      path: "/kpi/collections",
      value: summaryData?.total_collection || 0,
      change: summaryData?.collection_rate || 0,
    },
    {
      title: "Receivables Analysis",
      icon: <AccountBalance sx={{ fontSize: 40 }} />,
      color: "warning.main",
      path: "/kpi/receivables",
      value: summaryData?.total_receivables || 0,
      change: summaryData?.receivables_change || 0,
    },
    {
      title: "Corporate Park",
      icon: <Business sx={{ fontSize: 40 }} />,
      color: "info.main",
      path: "/kpi/corporate-park",
      value: summaryData?.total_subscribers || 0,
      change: summaryData?.subscribers_change || 0,
    },
    {
      title: "Unfinished Invoices",
      icon: <Receipt sx={{ fontSize: 40 }} />,
      color: "error.main",
      path: "/kpi/unfinished-invoices",
      value: summaryData?.unfinished_invoices?.total || 0,
      change: summaryData?.unfinished_invoices?.change || 0,
    },
  ];

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t("dashboard.overview")}
      </Typography>

      {/* KPI Navigation Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                height: "100%",
                transition: "transform 0.2s",
                "&:hover": {
                  transform: "translateY(-4px)",
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
                    {typeof card.value === "number"
                      ? new Intl.NumberFormat("fr-DZ", {
                          style: "currency",
                          currency: "DZD",
                          maximumFractionDigits: 0,
                        }).format(card.value)
                      : card.value}
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

      {/* Overview Rows */}
      <Row1 />
      <Row2 />
    </Box>
  );
};

export default Dashboard;
