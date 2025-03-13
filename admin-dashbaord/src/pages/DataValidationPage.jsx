import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Stack,
  Paper,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { FindInPage, CleaningServices } from "@mui/icons-material";
import PageTitle from "../components/PageTitle";
import ValidationProgressTracker from "../components/ValidationProgressTracker";
import api from "../services/api";

const DataValidationPage = () => {
  // Filter state
  const [dot, setDot] = useState("");
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Task tracking state
  const [activeTask, setActiveTask] = useState(null);
  const [taskType, setTaskType] = useState(null);

  // Cleaning options
  const [validateBeforeCleaning, setValidateBeforeCleaning] = useState(true);
  const [selectedModelsToClean, setSelectedModelsToClean] = useState({
    parc_corporate: true,
    creances_ngbss: true,
    ca_periodique: true,
    ca_non_periodique: true,
    journal_ventes: true,
    etat_facture: true,
  });

  // Results state
  const [validationResults, setValidationResults] = useState(null);
  const [cleaningResults, setCleaningResults] = useState(null);
  const [error, setError] = useState(null);

  const handleDotChange = (event) => {
    setDot(event.target.value);
  };

  const handleStartDateChange = (date) => {
    setStartDate(date);
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
  };

  const handleModelCheckboxChange = (event) => {
    setSelectedModelsToClean({
      ...selectedModelsToClean,
      [event.target.name]: event.target.checked,
    });
  };

  const startValidation = async () => {
    try {
      setError(null);
      setValidationResults(null);

      // Prepare params
      const params = {};
      if (dot) params.dot = dot;
      if (startDate) params.start_date = startDate.toISOString().split("T")[0];
      if (endDate) params.end_date = endDate.toISOString().split("T")[0];

      // Start validation
      const response = await api.get(`/data/validation/`, { params });

      // Set task tracking info
      setActiveTask(response.data.task_id);
      setTaskType("validation");
    } catch (error) {
      console.error("Error starting validation:", error);
      setError(
        error.response?.data?.error ||
          error.message ||
          "Error starting validation"
      );
    }
  };

  const startCleaning = async () => {
    try {
      setError(null);
      setCleaningResults(null);

      // Get list of models to clean
      const modelsToClean = Object.keys(selectedModelsToClean).filter(
        (key) => selectedModelsToClean[key]
      );

      if (modelsToClean.length === 0) {
        setError("Please select at least one model to clean");
        return;
      }

      // Prepare request body
      const requestData = {
        validate_first: validateBeforeCleaning,
        models_to_clean: modelsToClean,
      };

      if (dot) requestData.dot = dot;
      if (startDate)
        requestData.start_date = startDate.toISOString().split("T")[0];
      if (endDate) requestData.end_date = endDate.toISOString().split("T")[0];

      // Start cleaning
      const response = await api.post(`/data/cleaning/`, requestData);

      // Set task tracking info
      setActiveTask(response.data.task_id);
      setTaskType("cleaning");
    } catch (error) {
      console.error("Error starting cleaning:", error);
      setError(
        error.response?.data?.error ||
          error.message ||
          "Error starting cleaning"
      );
    }
  };

  const handleOperationComplete = (result) => {
    if (taskType === "validation") {
      setValidationResults(result.result);
    } else if (taskType === "cleaning") {
      setCleaningResults(result.result);
    }

    // Clear active task
    setActiveTask(null);
    setTaskType(null);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <PageTitle title="Data Validation & Cleaning" />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Filter Section */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Filters
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel id="dot-label">DOT</InputLabel>
                  <Select
                    labelId="dot-label"
                    value={dot}
                    label="DOT"
                    onChange={handleDotChange}
                  >
                    <MenuItem value="">All DOTs</MenuItem>
                    <MenuItem value="DOT_ABIDJAN">DOT Abidjan</MenuItem>
                    <MenuItem value="DOT_YAMOUSSOUKRO">
                      DOT Yamoussoukro
                    </MenuItem>
                    <MenuItem value="DOT_BOUAKE">DOT Bouaké</MenuItem>
                    <MenuItem value="DOT_DALOA">DOT Daloa</MenuItem>
                    <MenuItem value="DOT_KORHOGO">DOT Korhogo</MenuItem>
                    <MenuItem value="DOT_SAN_PEDRO">DOT San Pedro</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={handleStartDateChange}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={handleEndDateChange}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Progress Tracker (if operation is active) */}
        {activeTask && (
          <ValidationProgressTracker
            taskId={activeTask}
            taskType={taskType}
            onComplete={handleOperationComplete}
          />
        )}

        {/* Action Buttons */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Data Validation
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Analyze data to check if all filtering rules have been applied
                  correctly. This will scan all relevant tables to check for any
                  anomalies or issues.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<FindInPage />}
                  onClick={startValidation}
                  disabled={activeTask !== null}
                  fullWidth
                >
                  Start Validation
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Data Cleaning
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                  Clean data according to the client requirements. This will
                  apply all filtering rules to ensure data compliance.
                </Typography>

                <FormGroup sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={validateBeforeCleaning}
                        onChange={(e) =>
                          setValidateBeforeCleaning(e.target.checked)
                        }
                      />
                    }
                    label="Validate before cleaning"
                  />
                </FormGroup>

                <Typography variant="subtitle2" gutterBottom>
                  Models to clean:
                </Typography>

                <Grid container sx={{ mb: 2 }}>
                  {Object.keys(selectedModelsToClean).map((model) => (
                    <Grid item xs={12} sm={6} key={model}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedModelsToClean[model]}
                            onChange={handleModelCheckboxChange}
                            name={model}
                          />
                        }
                        label={model.replace("_", " ").toUpperCase()}
                      />
                    </Grid>
                  ))}
                </Grid>

                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<CleaningServices />}
                  onClick={startCleaning}
                  disabled={activeTask !== null}
                  fullWidth
                >
                  Start Cleaning
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Results Section */}
        {(validationResults || cleaningResults) && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Operation Results
              </Typography>

              <Stack spacing={3}>
                {validationResults && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Validation Results
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">
                          Total tables validated:
                        </Typography>
                        <Typography variant="body1">
                          {validationResults.tables_validated}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">
                          Records checked:
                        </Typography>
                        <Typography variant="body1">
                          {validationResults.records_checked}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">
                          Issues found:
                        </Typography>
                        <Typography variant="body1">
                          {validationResults.total_issues_found}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="body2" color="textSecondary">
                          Cleaning needed:
                        </Typography>
                        <Typography variant="body1">
                          {validationResults.client_cleaning_required
                            ? "Yes"
                            : "No"}
                        </Typography>
                      </Grid>
                    </Grid>

                    {validationResults.total_issues_found > 0 && (
                      <Alert severity="warning" sx={{ mt: 2 }}>
                        Issues were found in the data. Consider running the
                        cleaning process.
                      </Alert>
                    )}
                  </Paper>
                )}

                {cleaningResults && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Cleaning Results
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">
                          Models cleaned:
                        </Typography>
                        <Typography variant="body1">
                          {(cleaningResults.models_cleaned || []).length}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">
                          Records cleaned:
                        </Typography>
                        <Typography variant="body1">
                          {cleaningResults.total_records_cleaned}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6} md={4}>
                        <Typography variant="body2" color="textSecondary">
                          Execution time:
                        </Typography>
                        <Typography variant="body1">
                          {cleaningResults.execution_time_seconds?.toFixed(2)}{" "}
                          seconds
                        </Typography>
                      </Grid>
                    </Grid>

                    {cleaningResults.total_records_cleaned > 0 ? (
                      <Alert severity="success" sx={{ mt: 2 }}>
                        Data cleaning completed successfully.{" "}
                        {cleaningResults.total_records_cleaned} records were
                        cleaned.
                      </Alert>
                    ) : (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        No records needed cleaning.
                      </Alert>
                    )}
                  </Paper>
                )}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default DataValidationPage;
