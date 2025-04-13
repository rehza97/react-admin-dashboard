import { Box, Paper } from "@mui/material";
import PageLayout from "../../components/PageLayout";

const ReceivablesNonPeriodicPage = () => {
  return (
    <PageLayout
      title="Non-Periodic Receivables Analysis"
      subtitle="Monitor and analyze non-periodic receivables performance"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          {/* TODO: Add KPI component */}
          <Box sx={{ p: 3 }}>Non-Periodic Receivables KPI Content</Box>
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default ReceivablesNonPeriodicPage;
