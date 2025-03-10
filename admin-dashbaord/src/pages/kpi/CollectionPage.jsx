import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import NGBSSCollectionKPI from "../../components/kpi/NGBSSCollectionKPI";
import PageLayout from "../../components/PageLayout";

const CollectionPage = () => {
  return (
    <PageLayout
      title="Collections Analysis"
      subtitle="Monitor and analyze collection performance"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          <NGBSSCollectionKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default CollectionPage;
