import React from "react";
import { Box, Typography, Card, CardContent, Grid } from "@mui/material";
import PageLayout from "../components/PageLayout";
import PageTitle from "../components/PageTitle";

const DataManagementPage = () => {
  return (
    <PageLayout title="Data Management">
      <PageTitle title="Data Management" />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Data Management
              </Typography>
              <Typography variant="body1">
                This page provides tools for managing your data. Use the Data
                Validation page for validating and cleaning data.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </PageLayout>
  );
};

export default DataManagementPage;
