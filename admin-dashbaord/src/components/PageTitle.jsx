import React from "react";
import { Typography } from "@mui/material";
import PropTypes from "prop-types";

const PageTitle = ({ title }) => {
  return (
    <Typography variant="h4" component="h1" gutterBottom>
      {title}
    </Typography>
  );
};

PageTitle.propTypes = {
  title: PropTypes.string.isRequired,
};

export default PageTitle;
