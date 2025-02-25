
import { Box, Button } from "@mui/material";
import { Download } from "@mui/icons-material";
import Row1 from "./Row1";
const Dashboard = () => {
  return (
    <div style={{ marginTop: '16px', width: '100%', height: '100vh' }}>
      <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Button variant="contained" color="primary">
        <Download />
        Download
      </Button>
      </Box>
      <Row1/>
        
   
      {/* <Row2/> */}

      {/* <Row3/> */}

    </div>
  );
};

export default Dashboard; 