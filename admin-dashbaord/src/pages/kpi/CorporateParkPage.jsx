import { Box, Paper, Button, Menu, MenuItem } from "@mui/material";
import CorporateParkKPI from "../../components/kpi/CorporateParkKPI";
import PageLayout from "../../components/PageLayout";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { useState, useRef } from "react";
import { useExportNotifications } from "../../components/export";
import { useTranslation } from "react-i18next";

const CorporateParkPage = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const kpiRef = useRef(null);
  const { addExportNotification } = useExportNotifications();

  const handleExportClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setAnchorEl(null);
  };

  const handleExportFormatSelect = (format) => {
    setAnchorEl(null);
    const filters = kpiRef.current?.getAppliedFilters() || {};
    addExportNotification(format, filters, t("common.parcCorporate"));
  };

  return (
    <PageLayout
      title={t("common.parcCorporate")}
      subtitle={t("corporatePark.subtitle")}
      headerAction={
        <>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            size="medium"
            onClick={handleExportClick}
          >
            {t("common.export")}
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleExportClose}
          >
            <MenuItem onClick={() => handleExportFormatSelect("excel")}>
              {t("reports.excel")}
            </MenuItem>
            <MenuItem onClick={() => handleExportFormatSelect("csv")}>
              {t("reports.csv")}
            </MenuItem>
            <MenuItem onClick={() => handleExportFormatSelect("pdf")}>
              {t("reports.pdf")}
            </MenuItem>
          </Menu>
        </>
      }
    >
      <Box sx={{ p: 3 }}>
        <Paper elevation={0}>
          <CorporateParkKPI ref={kpiRef} />
        </Paper>
      </Box>
    </PageLayout>
  );
};

export default CorporateParkPage;
