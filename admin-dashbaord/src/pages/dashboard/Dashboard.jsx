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
import { useAuth } from "../../context/AuthContext";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [customerL2Data, setCustomerL2Data] = useState([]);
  const [loadingCustomerData, setLoadingCustomerData] = useState(true);

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchSummaryData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch main dashboard summary
        const data = await kpiService.getDashboardSummary({
          signal: controller.signal,
        });

        // Fetch additional KPI data
        const [
          dotCorporateRevenueData,
          dotCorporateCollectionData,
          siegeRevenueData,
          receivablesDCISITData,
        ] = await Promise.allSettled([
          kpiService.getDOTCorporateRevenueKPIs(),
          kpiService.getDOTCorporateCollectionKPIs(),
          kpiService.getSiegeRevenueKPIs(),
          kpiService.getReceivablesKPIs({ customer_lev1: "DCISIT" }),
        ]);

        if (isMounted) {
          // Combine all data
          const combinedData = {
            ...data,
            total_revenue_dot_corporate:
              dotCorporateRevenueData.status === "fulfilled"
                ? dotCorporateRevenueData.value?.summary?.total_revenue || 0
                : 0,
            revenue_dot_corporate_change:
              dotCorporateRevenueData.status === "fulfilled"
                ? ((dotCorporateRevenueData.value?.summary?.total_revenue ||
                    0) /
                    (data.total_revenue || 1)) *
                    100 -
                  100
                : 0,

            total_collection_dot_corporate:
              dotCorporateCollectionData.status === "fulfilled"
                ? dotCorporateCollectionData.value?.summary?.total_collection ||
                  0
                : 0,
            collection_dot_corporate_rate:
              dotCorporateCollectionData.status === "fulfilled"
                ? dotCorporateCollectionData.value?.summary?.collection_rate ||
                  0
                : 0,

            total_revenue_siege:
              siegeRevenueData.status === "fulfilled"
                ? siegeRevenueData.value?.summary?.total_revenue || 0
                : 0,
            revenue_siege_change:
              siegeRevenueData.status === "fulfilled"
                ? ((siegeRevenueData.value?.summary?.total_revenue || 0) /
                    (data.total_revenue || 1)) *
                    100 -
                  100
                : 0,
          };

          setSummaryData(combinedData);
        }
      } catch (error) {
        if (error.name !== "AbortError" && isMounted) {
          console.error("Error fetching dashboard summary:", error);
          setError(error.message || t("common.error"));
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
  }, [t]);

  // Add new effect to fetch customer L2 distribution data
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const fetchCustomerL2Data = async () => {
      try {
        setLoadingCustomerData(true);
        const response = await kpiService.getCorporateParkKPIs({
          signal: controller.signal,
        });

        if (isMounted && response && response.subscribers_by_customer) {
          // Group by customer_l2_code and sum counts
          const groupedData = {};
          response.subscribers_by_customer.forEach((item) => {
            if (!item.customer_l2_code) return;

            if (!groupedData[item.customer_l2_code]) {
              groupedData[item.customer_l2_code] = {
                name: item.customer_l2_code,
                value: 0,
              };
            }
            groupedData[item.customer_l2_code].value += item.count;
          });

          // Convert to array and sort by count (descending)
          const chartData = Object.values(groupedData)
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // Take top 8 for better visualization

          setCustomerL2Data(chartData);
        }
      } catch (error) {
        if (error.name !== "AbortError" && isMounted) {
          console.error("Error fetching customer L2 data:", error);
        }
      } finally {
        if (isMounted) {
          setLoadingCustomerData(false);
        }
      }
    };

    fetchCustomerL2Data();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Define KPI cards with role-based access
  const kpiCards = [
    {
      title: t("kpi.revenueDCISIT"),
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      color: "primary.main",
      path: "/kpi/revenue/dcisit",
      value: summaryData?.total_revenue || 0,
      change: summaryData?.revenue_change || 0,
      format: "currency",
      allowedRoles: ["admin", "viewer"],
    },
    {
      title: t("kpi.revenueSiege"),
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      color: "#4caf50",
      path: "/kpi/revenue/siege",
      value: summaryData?.total_revenue_siege || 0,
      change: summaryData?.revenue_siege_change || 0,
      format: "currency",
      allowedRoles: ["admin", "viewer"],
    },
    {
      title: t("kpi.revenueDOTCorporate"),
      icon: <AttachMoney sx={{ fontSize: 40 }} />,
      color: "#2196f3",
      path: "/kpi/revenue/dot-corporate",
      value: summaryData?.total_revenue_dot_corporate || 0,
      change: summaryData?.revenue_dot_corporate_change || 0,
      format: "currency",
      allowedRoles: ["admin", "viewer"],
    },
    {
      title: t("kpi.collectionsDOTCorporate"),
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: "#ff9800",
      path: "/kpi/collections/dot-corporate",
      value: summaryData?.total_collection_dot_corporate || 0,
      change: summaryData?.collection_dot_corporate_rate || 0,
      format: "currency",
      allowedRoles: ["admin", "viewer"],
    },
    {
      title: t("common.parcCorporate"),
      icon: <Business sx={{ fontSize: 40 }} />,
      color: "#9c27b0",
      path: "/kpi/corporate-park",
      value: summaryData?.total_subscribers || 0,
      change: summaryData?.subscribers_change || 0,
      format: "number",
      allowedRoles: ["admin", "viewer"],
    },
    {
      title: t("kpi.receivablesDCISIT"),
      icon: <AccountBalance sx={{ fontSize: 40 }} />,
      color: "#e91e63",
      path: "/kpi/receivables/dcisit",
      value: summaryData?.total_receivables || 0,
      change: summaryData?.receivables_change || 0,
      format: "currency",
      allowedRoles: ["admin", "viewer"],
    },
  ];

  // Filter KPI cards based on user role
  const filteredKpiCards = kpiCards.filter((card) =>
    card.allowedRoles.includes(currentUser?.role)
  );

  const formatValue = (value, format) => {
    if (value === undefined || value === null) return t("common.noData");

    if (format === "currency") {
      return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "DZD",
        maximumFractionDigits: 0,
      }).format(value);
    }

    return new Intl.NumberFormat("fr-FR").format(value);
  };

  // Colors for the pie chart
  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#8dd1e1",
    "#a4de6c",
    "#d0ed57",
  ];

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
          {filteredKpiCards.map((card, index) => (
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
                          borderRadius: "50%",
                          bgcolor: card.color,
                          p: 1,
                          mr: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {card.icon}
                      </Box>
                      <Typography variant="h6" component="div">
                        {card.title}
                      </Typography>
                    </Box>
                    <Typography variant="h4" gutterBottom>
                      {formatValue(card.value, card.format)}
                    </Typography>
                    <Typography
                      variant="body2"
                      color={card.change >= 0 ? "success.main" : "error.main"}
                    >
                      {card.change >= 0 ? "+" : ""}
                      {card.change.toFixed(2)}%{" "}
                      {card.change >= 0
                        ? t("common.increase")
                        : t("common.decrease")}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Only show Row1 and Row2 for admin users */}
        {isAdmin && (
          <>
            <Grid item xs={12}>
              <Row1 />
            </Grid>

            <Grid item xs={12}>
              <Row2 />
            </Grid>
          </>
        )}

        {/* Customer L2 Distribution Pie Chart - visible to both admin and viewer */}
        <Grid item xs={12} md={12}>
          <Paper
            sx={{
              p: 3,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" gutterBottom>
              {t("dashboard.corporateParkDistribution")}
            </Typography>
            {loadingCustomerData ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  flexGrow: 1,
                }}
              >
                <CircularProgress />
              </Box>
            ) : customerL2Data.length > 0 ? (
              <Box sx={{ height: 300, mt: 2 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerL2Data}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {customerL2Data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [
                        new Intl.NumberFormat("fr-FR").format(value),
                        t("dashboard.subscribers"),
                      ]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ mt: 2 }}>
                {t("common.noData")}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Only show the KPI dashboard section for admin users */}
      </Grid>
    </Box>
  );
};

export default Dashboard;
