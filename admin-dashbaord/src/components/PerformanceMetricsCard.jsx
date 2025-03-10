import React from "react";
import PropTypes from "prop-types";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Divider,
  LinearProgress,
  Grid,
  Tooltip,
  IconButton,
} from "@mui/material";
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Info,
  CheckCircle,
  Warning,
  Error,
} from "@mui/icons-material";

/**
 * Component for displaying performance metrics with comparisons
 */
const PerformanceMetricsCard = ({
  title,
  subtitle,
  currentValue,
  previousValue,
  objectiveValue,
  growthRate,
  achievementRate,
  valuePrefix = "",
  valueSuffix = "",
  precision = 2,
  showComparison = true,
  showObjective = true,
  isLoading = false,
}) => {
  // Format number with specified precision
  const formatNumber = (value) => {
    if (value === null || value === undefined) return "N/A";
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
  };

  // Determine growth trend icon and color
  const getTrendInfo = (rate) => {
    if (rate === null || rate === undefined) {
      return { icon: <TrendingFlat />, color: "text.secondary" };
    }

    if (rate > 5) {
      return { icon: <TrendingUp />, color: "success.main" };
    } else if (rate < -5) {
      return { icon: <TrendingDown />, color: "error.main" };
    } else {
      return { icon: <TrendingFlat />, color: "warning.main" };
    }
  };

  // Determine achievement status icon and color
  const getAchievementInfo = (rate) => {
    if (rate === null || rate === undefined) {
      return { icon: <Info />, color: "text.secondary" };
    }

    if (rate >= 100) {
      return { icon: <CheckCircle />, color: "success.main" };
    } else if (rate >= 80) {
      return { icon: <Warning />, color: "warning.main" };
    } else {
      return { icon: <Error />, color: "error.main" };
    }
  };

  const growthTrend = getTrendInfo(growthRate);
  const achievementStatus = getAchievementInfo(achievementRate);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h6" component="div">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Tooltip title="Performance metrics comparing current values with objectives and previous period">
            <IconButton size="small">
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {isLoading ? (
          <Box sx={{ width: "100%", mt: 4, mb: 4 }}>
            <LinearProgress />
          </Box>
        ) : (
          <>
            <Typography variant="h4" component="div" sx={{ mb: 2 }}>
              {valuePrefix}
              {formatNumber(currentValue)}
              {valueSuffix}
            </Typography>

            {showComparison && previousValue !== null && (
              <Box sx={{ mb: 2 }}>
                <Grid container spacing={1} alignItems="center">
                  <Grid item>
                    <Box sx={{ color: growthTrend.color }}>
                      {growthTrend.icon}
                    </Box>
                  </Grid>
                  <Grid item xs>
                    <Typography variant="body2">
                      {growthRate > 0 ? "+" : ""}
                      {formatNumber(growthRate)}% vs previous period
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Previous: {valuePrefix}
                      {formatNumber(previousValue)}
                      {valueSuffix}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            )}

            {showObjective && objectiveValue !== null && (
              <>
                <Divider sx={{ my: 2 }} />

                <Box sx={{ mb: 1 }}>
                  <Grid container spacing={1} alignItems="center">
                    <Grid item>
                      <Box sx={{ color: achievementStatus.color }}>
                        {achievementStatus.icon}
                      </Box>
                    </Grid>
                    <Grid item xs>
                      <Typography variant="body2">
                        {formatNumber(achievementRate)}% of objective
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Target: {valuePrefix}
                        {formatNumber(objectiveValue)}
                        {valueSuffix}
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>

                <LinearProgress
                  variant="determinate"
                  value={Math.min(achievementRate, 100)}
                  color={
                    achievementRate >= 100
                      ? "success"
                      : achievementRate >= 80
                      ? "warning"
                      : "error"
                  }
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

PerformanceMetricsCard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  currentValue: PropTypes.number,
  previousValue: PropTypes.number,
  objectiveValue: PropTypes.number,
  growthRate: PropTypes.number,
  achievementRate: PropTypes.number,
  valuePrefix: PropTypes.string,
  valueSuffix: PropTypes.string,
  precision: PropTypes.number,
  showComparison: PropTypes.bool,
  showObjective: PropTypes.bool,
  isLoading: PropTypes.bool,
};

export default PerformanceMetricsCard;
