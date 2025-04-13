import { Box, Paper } from "@mui/material";
import PageLayout from "../../components/PageLayout";

const ReceivablesDCISITPage = () => {
  return (
    <PageLayout
      title="DCISIT Receivables Analysis"
      subtitle="Monitor and analyze DCISIT receivables performance"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          {/* TODO: Add KPI component */}
          <Box sx={{ p: 3 }}>DCISIT Receivables KPI Content</Box>
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default ReceivablesDCISITPage;
