import React from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PropTypes from "prop-types";

const ProcessingLogs = ({ logs, expanded = false }) => {
  const [isExpanded, setIsExpanded] = React.useState(expanded);

  const handleChange = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Accordion expanded={isExpanded} onChange={handleChange} sx={{ mt: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>Processing Logs</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Box
          sx={{
            bgcolor: "background.paper",
            p: 1,
            borderRadius: 1,
            height: 200,
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: "0.85rem",
          }}
        >
          {logs.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: "italic" }}
            >
              No logs available
            </Typography>
          ) : (
            logs.map((log, index) => (
              <Box
                key={index}
                sx={{
                  py: 0.5,
                  color:
                    log.level === "error"
                      ? "error.main"
                      : log.level === "success"
                      ? "success.main"
                      : log.level === "warning"
                      ? "warning.main"
                      : "text.primary",
                }}
              >
                <Typography component="span" sx={{ color: "text.secondary" }}>
                  [{log.timestamp}]
                </Typography>{" "}
                <Typography component="span">{log.message}</Typography>
              </Box>
            ))
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
};

ProcessingLogs.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      level: PropTypes.string.isRequired,
      message: PropTypes.string.isRequired,
      timestamp: PropTypes.string.isRequired,
    })
  ).isRequired,
  expanded: PropTypes.bool,
};

export default ProcessingLogs;
