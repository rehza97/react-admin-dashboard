import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Typography,
  IconButton,
} from "@mui/material";
import {
  Download,
  ExpandMore,
  ChevronRight,
  LocationOn,
  Close,
} from "@mui/icons-material";
import PropTypes from "prop-types";
import Row1 from "./Row1";
import Map from "../../components/map/Map";
import { useTheme } from "@mui/material/styles";

// Fixed region definitions - removed duplicate wilayas
const regions = {
  Nord: ["Alger", "Blida", "Tizi Ouzou", "Bejaia", "Tipaza"],
  Sud: [
    "Adrar",
    "Tamanrasset",
    "Illizi",
    "Tindouf",
    "Bechar",
    "Ouargla",
    "El Oued",
    "Ghardaia",
    "Laghouat",
    "Biskra",
    "El Bayadh",
    "Naama",
    "El Mghair",
    "El Menia",
    "Touggourt",
    "Djanet",
    "In Salah",
    "In Guezzam",
    "Bordj Badji Mokhtar",
    "Ouled Djellal",
    "Beni Abbes",
    "Timimoun",
  ],
  Est: [
    "Jijel",
    "Skikda",
    "Annaba",
    "El Tarf",
    "Constantine",
    "Mila",
    "Setif",
    "Batna",
    "Khenchela",
    "Oum El Bouaghi",
    "Tebessa",
    "Souk Ahras",
    "Guelma",
    "Bordj Bou Arreridj",
  ],
  Ouest: [
    "Oran",
    "Mostaganem",
    "Mascara",
    "Tlemcen",
    "Saida",
    "Sidi Bel Abbès",
    "Relizane",
    "Ain Temouchent",
    "Chlef",
    "Tiaret",
    "Tissemsilt",
    "Ain Defla",
  ],
  Centre: ["Medea", "Msila", "Bouira", "Djelfa", "Boumerdès"],
};

// Region Selection Component
const RegionList = ({
  regions,
  expandedRegion,
  setExpandedRegion,
  activeLinks,
  onWilayaClick,
  onRegionDoubleClick,
}) => {
  const handleRegionClick = (region) => {
    setExpandedRegion(expandedRegion === region ? "" : region);
  };

  return (
    <List
      component="nav"
      dense
      sx={{
        "& .MuiListItem-root": {
          py: 0.5,
        },
        "& .MuiListItemIcon-root": {
          minWidth: 32,
        },
      }}
      aria-label="Region list"
    >
      {Object.entries(regions).map(([region, wilayas]) => (
        <Box key={region}>
          <ListItem
            component="div"
            button
            onClick={() => handleRegionClick(region)}
            onDoubleClick={() => onRegionDoubleClick(region)}
            aria-expanded={expandedRegion === region}
            aria-label={`${region} region`}
            sx={{
              backgroundColor:
                expandedRegion === region ? "primary.light" : "inherit",
              "&:hover": { backgroundColor: "primary.light" },
            }}
          >
            <ListItemIcon>
              {expandedRegion === region ? (
                <ExpandMore fontSize="small" aria-hidden="true" />
              ) : (
                <ChevronRight fontSize="small" aria-hidden="true" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={region}
              primaryTypographyProps={{ fontSize: "0.875rem" }}
            />
          </ListItem>
          <Collapse in={expandedRegion === region} timeout="auto" unmountOnExit>
            <List
              component="div"
              disablePadding
              dense
              aria-label={`${region} wilayas`}
            >
              {wilayas.map((wilaya) => (
                <ListItem
                  key={wilaya}
                  component="div"
                  button
                  sx={{ pl: 4 }}
                  onClick={() => onWilayaClick(wilaya)}
                  selected={activeLinks[wilaya]}
                  aria-pressed={activeLinks[wilaya]}
                  aria-label={`${wilaya} wilaya`}
                >
                  <ListItemIcon>
                    <LocationOn
                      fontSize="small"
                      color={activeLinks[wilaya] ? "primary" : "disabled"}
                      aria-hidden="true"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={wilaya}
                    primaryTypographyProps={{ fontSize: "0.875rem" }}
                  />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>
      ))}
    </List>
  );
};

// Add PropTypes validation
RegionList.propTypes = {
  regions: PropTypes.object.isRequired,
  expandedRegion: PropTypes.string.isRequired,
  setExpandedRegion: PropTypes.func.isRequired,
  activeLinks: PropTypes.object.isRequired,
  onWilayaClick: PropTypes.func.isRequired,
  onRegionDoubleClick: PropTypes.func.isRequired,
};

// Selected Wilayas Component with styling similar to reference image
const SelectedWilayasList = ({ activeLinks, onClose, theme }) => {
  const selectedWilayas = Object.keys(activeLinks).filter(
    (wilaya) => activeLinks[wilaya]
  );

  return (
    <Box
      sx={{
        position: "absolute",
        top: 10,
        right: 10,
        backgroundColor: theme.palette.background.paper,
        borderRadius: 1,
        boxShadow: 2,
        maxWidth: "250px",
        zIndex: 10,
        border: `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
      aria-label="Selected wilayas list"
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
        }}
      >
        <Typography variant="subtitle2">Selected Wilayas</Typography>
        <IconButton
          size="small"
          onClick={onClose}
          aria-label="Close selected wilayas list"
          sx={{ color: theme.palette.primary.contrastText }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>
      <Box
        sx={{
          maxHeight: "300px",
          overflowY: "auto",
          p: 1,
        }}
      >
        {selectedWilayas.length > 0 ? (
          selectedWilayas.map((wilaya, index) => (
            <Box
              key={wilaya}
              sx={{
                p: 0.5,
                backgroundColor:
                  index % 2 === 0 ? theme.palette.action.hover : "transparent",
                borderRadius: 0.5,
                mb: 0.5,
              }}
            >
              <Typography variant="body2">{wilaya}</Typography>
            </Box>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            No wilayas selected
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// Add PropTypes validation
SelectedWilayasList.propTypes = {
  activeLinks: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  theme: PropTypes.object.isRequired,
};

const Dashboard = () => {
  const [activeLinks, setActiveLinks] = useState({});
  const [expandedRegion, setExpandedRegion] = useState("");
  const [panelVisible, setPanelVisible] = useState(true);
  const [selectedListVisible, setSelectedListVisible] = useState(true);
  const theme = useTheme();

  const handleWilayaClick = (wilaya) => {
    setActiveLinks((prev) => ({
      ...prev,
      [wilaya]: !prev[wilaya],
    }));
  };

  const handleRegionDoubleClick = (region) => {
    const regionWilayas = regions[region];
    const allRegionSelected = regionWilayas.every(
      (wilaya) => activeLinks[wilaya]
    );

    setActiveLinks((prev) => ({
      ...prev,
      ...Object.fromEntries(
        regionWilayas.map((wilaya) => [wilaya, !allRegionSelected])
      ),
    }));
  };

  const handleSelectAllRegions = () => {
    const allWilayas = Object.values(regions).flat();
    const allSelected = allWilayas.every((wilaya) => activeLinks[wilaya]);

    setActiveLinks(
      Object.fromEntries(allWilayas.map((wilaya) => [wilaya, !allSelected]))
    );
  };

  const togglePanelVisibility = () => {
    setPanelVisible((prev) => !prev);
  };

  const toggleSelectedList = () => {
    setSelectedListVisible((prev) => !prev);
  };

  // Set CSS variables for map colors based on theme
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--map-inactive-color",
      theme.palette.mode === "dark"
        ? theme.palette.grey[700]
        : theme.palette.grey[300]
    );
    document.documentElement.style.setProperty(
      "--map-active-color",
      theme.palette.primary.main
    );
    document.documentElement.style.setProperty(
      "--map-hover-color",
      theme.palette.primary.light
    );
    document.documentElement.style.setProperty(
      "--map-disabled-color",
      theme.palette.mode === "dark"
        ? theme.palette.grey[800]
        : theme.palette.grey[200]
    );
    document.documentElement.style.setProperty(
      "--map-stroke-color",
      theme.palette.mode === "dark"
        ? theme.palette.grey[900]
        : theme.palette.common.white
    );
  }, [theme]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "16px",
        }}
      >
        <Button
          variant="contained"
          color="primary"
          aria-label="Download"
          startIcon={<Download />}
        >
          Download
        </Button>
      </Box>
      <Row1 />

      {/* Map and Panel Container */}
      <Box
        sx={{
          width: "100%",
          height: "400px",
          maxWidth: "800px",
          backgroundColor: "background.paper",
          borderRadius: 2,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          display: "flex",
          overflow: "hidden",
          margin: "20px auto",
          position: "relative",
        }}
      >
        {/* Side Panel - Compact */}
        {panelVisible && (
          <Box
            sx={{
              width: "250px",
              borderRight: "1px solid",
              borderColor: "divider",
              overflowY: "auto",
              maxHeight: "400px",
              position: "relative",
            }}
          >
            <IconButton
              onClick={togglePanelVisibility}
              sx={{ position: "absolute", top: 10, right: 10, zIndex: 1 }}
              aria-label="Close panel"
            >
              <Close />
            </IconButton>

            <RegionList
              regions={regions}
              expandedRegion={expandedRegion}
              setExpandedRegion={setExpandedRegion}
              activeLinks={activeLinks}
              onWilayaClick={handleWilayaClick}
              onRegionDoubleClick={handleRegionDoubleClick}
            />

            <ListItem
              component="div"
              button
              onClick={handleSelectAllRegions}
              aria-label="Select or deselect all regions"
            >
              <ListItemText primary="Select/Deselect All Regions" />
            </ListItem>
          </Box>
        )}

        {/* Map Container */}
        <Box
          sx={{
            flex: 1,
            position: "relative",
            transition: "margin-left 0.3s ease",
            marginLeft: panelVisible ? 0 : 0,
            backgroundColor: "background.default",
          }}
        >
          {!panelVisible && (
            <IconButton
              onClick={togglePanelVisibility}
              sx={{ position: "absolute", top: 10, left: 10, zIndex: 1 }}
              aria-label="Open panel"
            >
              <ChevronRight />
            </IconButton>
          )}

          <Map activeLinks={activeLinks} />

          {selectedListVisible && (
            <SelectedWilayasList
              activeLinks={activeLinks}
              onClose={toggleSelectedList}
              theme={theme}
            />
          )}
        </Box>
      </Box>
    </div>
  );
};

export default Dashboard;
