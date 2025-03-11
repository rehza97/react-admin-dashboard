import React from "react";
import { Box, Paper, Button } from "@mui/material";
import NGBSSCollectionKPI from "../../components/kpi/NGBSSCollectionKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const CollectionPage = () => {
  return (
    <PageLayout
      title="Collections Analysis"
      subtitle="Monitor and analyze collection performance"
      headerAction={
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          size="medium"
        >
          Export
        </Button>
      }
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
