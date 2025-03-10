import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import PropTypes from "prop-types";

const PageLayout = ({
  title,
  subtitle,
  headerAction,
  children,
  maxWidth = "100%",
  paperProps = {},
}) => {
  return (
    <Box sx={{ p: 3, maxWidth, mx: "auto", width: "100%" }}>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="subtitle1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {headerAction && <Box sx={{ ml: 2 }}>{headerAction}</Box>}
      </Box>

      <Paper
        elevation={2}
        sx={{
          p: 3,
          borderRadius: 2,
          ...(paperProps.sx || {}),
        }}
        {...paperProps}
      >
        {children}
      </Paper>
    </Box>
  );
};

PageLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  headerAction: PropTypes.node,
  children: PropTypes.node.isRequired,
  maxWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  paperProps: PropTypes.object,
};

export default PageLayout;
