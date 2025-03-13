import React, { useState } from "react";
import { styled, useTheme } from "@mui/material/styles";
import MuiDrawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import { NavLink } from "react-router-dom";
import BarChartIcon from "@mui/icons-material/BarChart";
import PieChartIcon from "@mui/icons-material/PieChart";
import LineChartIcon from "@mui/icons-material/ShowChart";
import RadarChartIcon from "@mui/icons-material/Radar";
import PropTypes from "prop-types";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import PieChartOutlineOutlinedIcon from "@mui/icons-material/PieChartOutlineOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import BusinessIcon from "@mui/icons-material/Business";
import StorageIcon from "@mui/icons-material/Storage";
import VerifiedIcon from "@mui/icons-material/Verified";
import { useAuth } from "../context/AuthContext";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import { styled as muiStyled } from "@mui/material/styles";

const drawerWidth = 260;

const openedMixin = (theme) => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
  boxShadow: theme.shadows[8],
});

const closedMixin = (theme) => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(7)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(8)} + 1px)`,
  },
});

const DrawerHeader = muiStyled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const StyledDrawer = muiStyled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  ...(open && openedMixin(theme)),
  ...(!open && closedMixin(theme)),
  "& .MuiDrawer-paper": {
    border: "none",
    ...(open && openedMixin(theme)),
    ...(!open && closedMixin(theme)),
  },
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    flexShrink: 0,
  },
}));

const UserProfile = ({ open, currentUser, theme }) => (
  <Box
    sx={{
      p: 2,
      mb: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: open ? "flex-start" : "center",
    }}
  >
    <Avatar
      alt={currentUser?.first_name || "User"}
      src={currentUser?.profile_picture}
      sx={{
        width: 40,
        height: 40,
        bgcolor: theme.palette.primary.main,
        fontSize: "1.2rem",
        border: `2px solid ${theme.palette.background.paper}`,
        boxShadow: theme.shadows[3],
        children:
          currentUser?.first_name?.[0] || currentUser?.email?.[0] || "U",
      }}
    />
    {open && (
      <Box sx={{ ml: 2, overflow: "hidden" }}>
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {currentUser?.first_name
            ? `${currentUser.first_name} ${currentUser.last_name || ""}`
            : "Guest User"}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {currentUser?.email || "Not logged in"}
        </Typography>
      </Box>
    )}
  </Box>
);

const listItemStyles = {
  display: "block",
  mb: 0.5,
  "&:last-child": {
    mb: 0,
  },
};

const listItemButtonStyles = (theme, open) => ({
  minHeight: 48,
  px: 2.5,
  py: 1.2,
  justifyContent: open ? "initial" : "center",
  borderRadius: "8px",
  mx: 1,
  "&.active": {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    "& .MuiListItemIcon-root": {
      color: theme.palette.primary.contrastText,
    },
    "&:hover": {
      backgroundColor: theme.palette.primary.dark,
    },
  },
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
});

export default function Drawer({ open, handleDrawerClose }) {
  const theme = useTheme();
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const [openSubmenu, setOpenSubmenu] = useState(null);

  // Define menu items with translation keys
  const Array1 = [
    {
      text: t("common.dashboard"),
      icon: <HomeOutlinedIcon />,
      path: "/",
    },
    {
      title: "KPI Analysis",
      icon: <BarChartOutlinedIcon />,
      items: [
        {
          title: "Revenue Analysis",
          path: "/kpi/revenue",
        },
        {
          title: "Collections Analysis",
          path: "/kpi/collections",
        },
        {
          title: "Receivables Analysis",
          path: "/kpi/receivables",
        },
        {
          title: "Corporate Park",
          path: "/kpi/corporate-park",
        },
        {
          title: "Unfinished Invoices",
          path: "/kpi/unfinished-invoices",
        },
      ],
    },
    {
      title: "User Management",
      icon: <PeopleOutlinedIcon />,
      path: "/manage-users",
      items: [
        {
          title: "Manage Users",
          path: "/manage-users",
        },
        {
          title: "DOT Permissions",
          path: "/user-dot-permissions",
        },
        {
          title: "DOT Management",
          path: "/dot-management",
        },
      ],
    },
    {
      text: t("common.reports"),
      icon: <BarChartOutlinedIcon />,
      path: "/reports",
    },
    {
      text: t("common.profile"),
      icon: <PersonOutlinedIcon />,
      path: "/form",
    },
    {
      text: t("common.calendar"),
      icon: <CalendarTodayOutlinedIcon />,
      path: "/calendar",
    },
    {
      text: t("common.fileUpload"),
      icon: <CloudUploadIcon />,
      path: "/file-upload",
    },
    {
      text: t("common.anomalyScan"),
      icon: <BarChartOutlinedIcon />,
      path: "/anomaly-scan",
    },
    {
      title: "Data Tools",
      icon: <StorageIcon />,
      items: [
        {
          title: "Data Management",
          path: "/data-management",
        },
        {
          title: "Data Validation",
          path: "/data-validation",
        },
      ],
    },
    {
      text: t("common.pivot"),
      icon: <TableChartIcon />,
      path: "/pivot-table",
    },
    {
      text: t("common.faq"),
      icon: <HelpOutlineOutlinedIcon />,
      path: "/faq",
    },
  ];

  return (
    <StyledDrawer variant="permanent" open={open}>
      <DrawerHeader sx={{ px: 2, py: 1 }}>
        <IconButton onClick={handleDrawerClose}>
          {theme.direction === "rtl" ? (
            <ChevronRightIcon />
          ) : (
            <ChevronLeftIcon />
          )}
        </IconButton>
      </DrawerHeader>

      <Divider sx={{ mb: 1 }} />

      <UserProfile open={open} currentUser={currentUser} theme={theme} />

      <Divider sx={{ mb: 2 }} />

      <List sx={{ px: 1 }}>
        {Array1.map((item) => (
          <React.Fragment key={item.path || item.title}>
            <ListItem sx={listItemStyles} disablePadding>
              {item.items ? (
                <ListItemButton
                  onClick={() =>
                    setOpenSubmenu(
                      item.title === openSubmenu ? null : item.title
                    )
                  }
                  sx={listItemButtonStyles(theme, open)}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      justifyContent: "center",
                      mr: open ? 2 : "auto",
                      color: theme.palette.text.primary,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title || item.text}
                    sx={{
                      opacity: open ? 1 : 0,
                      "& .MuiTypography-root": {
                        fontWeight: 500,
                      },
                    }}
                  />
                </ListItemButton>
              ) : (
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  sx={listItemButtonStyles(theme, open)}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      justifyContent: "center",
                      mr: open ? 2 : "auto",
                      color: theme.palette.text.primary,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{
                      opacity: open ? 1 : 0,
                      "& .MuiTypography-root": {
                        fontWeight: 500,
                      },
                    }}
                  />
                </ListItemButton>
              )}
            </ListItem>
            {item.items && openSubmenu === item.title && open && (
              <List component="div" disablePadding>
                {item.items.map((subItem) => (
                  <ListItem key={subItem.path} sx={{ pl: 4 }} disablePadding>
                    <ListItemButton
                      component={NavLink}
                      to={subItem.path}
                      sx={listItemButtonStyles(theme, open)}
                    >
                      <ListItemText
                        primary={subItem.title}
                        sx={{
                          opacity: open ? 1 : 0,
                          "& .MuiTypography-root": {
                            fontWeight: 500,
                          },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </React.Fragment>
        ))}
      </List>

      <Divider sx={{ my: 2 }} />
    </StyledDrawer>
  );
}

Drawer.propTypes = {
  open: PropTypes.bool.isRequired,
  handleDrawerClose: PropTypes.func.isRequired,
};

UserProfile.propTypes = {
  open: PropTypes.bool.isRequired,
  currentUser: PropTypes.object,
  theme: PropTypes.object.isRequired,
};
