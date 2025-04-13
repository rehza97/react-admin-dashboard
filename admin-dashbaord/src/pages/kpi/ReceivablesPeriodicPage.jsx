import { Box, Paper } from "@mui/material";
import PageLayout from "../../components/PageLayout";

const ReceivablesPeriodicPage = () => {
  return (
    <PageLayout
      title="Periodic Receivables Analysis"
      subtitle="Monitor and analyze periodic receivables performance"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          {/* TODO: Add KPI component */}
          <Box sx={{ p: 3 }}>Periodic Receivables KPI Content</Box>
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default ReceivablesPeriodicPage;
