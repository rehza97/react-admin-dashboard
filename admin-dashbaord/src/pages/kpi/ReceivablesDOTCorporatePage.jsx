import { Box, Paper } from "@mui/material";
import PageLayout from "../../components/PageLayout";

const ReceivablesDOTCorporatePage = () => {
  return (
    <PageLayout
      title="DOT Corporate Receivables Analysis"
      subtitle="Monitor and analyze DOT Corporate receivables performance"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          {/* TODO: Add KPI component */}
          <Box sx={{ p: 3 }}>DOT Corporate Receivables KPI Content</Box>
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default ReceivablesDOTCorporatePage;
