import React from "react";
import { Box, Paper, Button } from "@mui/material";
import NGBSSCollectionKPI from "../../components/kpi/NGBSSCollectionKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useTranslation } from "react-i18next";

const CollectionPage = () => {
  const { t } = useTranslation();

  return (
    <PageLayout
      title={t("collections.title")}
      subtitle={t("collections.subtitle")}
      headerAction={
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          size="medium"
        >
          {t("common.export")}
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
