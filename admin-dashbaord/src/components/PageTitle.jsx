import React from "react";
import { Typography } from "@mui/material";

const PageTitle = ({ title }) => {
  return (
    <Typography variant="h4" component="h1" gutterBottom>
      {title}
    </Typography>
  );
};

export default PageTitle; 