import { Box, Paper, Button } from "@mui/material";
import ReceivablesKPI from "../../components/kpi/ReceivablesKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useTranslation } from "react-i18next";

const ReceivablesPage = () => {
  const { t } = useTranslation();

  return (
    <PageLayout
      title={t("receivables.title")}
      subtitle={t("receivables.subtitle")}
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
          <ReceivablesKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default ReceivablesPage;
