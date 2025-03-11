import { Box, Paper, Button } from "@mui/material";
import ReceivablesKPI from "../../components/kpi/ReceivablesKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

const ReceivablesPage = () => {
  return (
    <PageLayout
      title="Receivables Analysis"
      subtitle="Monitor and analyze receivables performance"
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
          <ReceivablesKPI />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default ReceivablesPage;
