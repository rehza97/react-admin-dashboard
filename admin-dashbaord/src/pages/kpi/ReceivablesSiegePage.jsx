import { Box, Paper } from "@mui/material";
import PageLayout from "../../components/PageLayout";

const ReceivablesSiegePage = () => {
  return (
    <PageLayout
      title="Siège Receivables Analysis"
      subtitle="Monitor and analyze Siège receivables performance"
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          {/* TODO: Add KPI component */}
          <Box sx={{ p: 3 }}>Siège Receivables KPI Content</Box>
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default ReceivablesSiegePage;
