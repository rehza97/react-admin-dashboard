import React, { useState } from "react";
import { useTheme } from "@mui/material/styles";
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
import PropTypes from "prop-types";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import TableChartIcon from "@mui/icons-material/TableChart";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InsightsIcon from "@mui/icons-material/Insights";
import { useAuth } from "../context/AuthContext";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
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

const StyledDrawer = muiStyled(MuiDrawer)(({ theme, open }) => ({
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

  // Check if user is admin
  const isAdmin = currentUser?.role === "admin";

  // Define menu items with translation keys and role-based access
  const Array1 = [
    {
      text: t("common.dashboard"),
      icon: <HomeOutlinedIcon />,
      path: "/",
      allowedRoles: ["admin", "viewer"], // Both admin and viewer can see dashboard
    },
    {
      title: t("kpi.analysis"),
      icon: <BarChartOutlinedIcon />,
      items: [
        {
          title: t("common.parcCorporate"),
          path: "/kpi/corporate-park",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.revenueDCISIT"),
          path: "/kpi/revenue/dcisit",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.revenueSiege"),
          path: "/kpi/revenue/siege",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.revenueDOTCorporate"),
          path: "/kpi/revenue/dot-corporate",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.revenuePeriodic"),
          path: "/kpi/revenue/periodic",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.revenueNonPeriodic"),
          path: "/kpi/revenue/non-periodic",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.collectionsDOTCorporate"),
          path: "/kpi/collections/dot-corporate",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.receivablesDCISIT"),
          path: "/kpi/receivables/dcisit",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.receivablesSiege"),
          path: "/kpi/receivables/siege",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.receivablesDOTCorporate"),
          path: "/kpi/receivables/dot-corporate",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.receivablesPeriodic"),
          path: "/kpi/receivables/periodic",
          allowedRoles: ["admin", "viewer"],
        },
        {
          title: t("kpi.receivablesNonPeriodic"),
          path: "/kpi/receivables/non-periodic",
          allowedRoles: ["admin", "viewer"],
        },
      ],
      allowedRoles: ["admin", "viewer"], // Only admin and viewer can see KPI analysis
    },
    {
      title: t("users.manageUsers"),
      icon: <PeopleOutlinedIcon />,
      path: "/manage-users",
      items: [
        {
          title: t("users.manageUsers"),
          path: "/manage-users",
          allowedRoles: ["admin"],
        },
        {
          title: t("permissions.dotPermissions"),
          path: "/user-dot-permissions",
          allowedRoles: ["admin"],
        },
        {
          title: t("dots.manageDOTs"),
          path: "/dot-management",
          allowedRoles: ["admin"],
        },
      ],
      allowedRoles: ["admin"], // Only admin can see user management
    },
    {
      title: t("anomalyScan.title"),
      icon: <WarningAmberIcon />,
      items: [
        {
          title: t("anomalyScan.analyticsTitle"),
          path: "/anomaly-dashboard",
          icon: <InsightsIcon />,
          allowedRoles: ["admin"],
        },
      ],
      allowedRoles: ["admin"], // Only admin can see anomaly scan
    },
    {
      text: t("common.profile"),
      icon: <PersonOutlinedIcon />,
      path: "/form",
      allowedRoles: ["admin", "viewer"], // Both roles can see their profile
    },
    {
      text: t("common.calendar"),
      icon: <CalendarTodayOutlinedIcon />,
      path: "/calendar",
      allowedRoles: ["admin", "viewer"], // Both roles can see calendar
    },
    {
      text: t("common.fileUpload"),
      icon: <CloudUploadIcon />,
      path: "/file-upload",
      allowedRoles: ["admin"], // Only admin can upload files
    },
    {
      text: t("common.pivot"),
      icon: <TableChartIcon />,
      path: "/pivot-table",
      allowedRoles: ["admin"], // Only admin can see pivot table
    },
    {
      text: t("common.faq"),
      icon: <HelpOutlineOutlinedIcon />,
      path: "/faq",
      allowedRoles: ["admin", "viewer"], // Both roles can see FAQ
    },
  ];

  // Filter menu items based on user role
  const filteredArray1 = Array1.filter((item) => {
    // Check if user has permission to see this item
    const hasPermission = item.allowedRoles?.includes(currentUser?.role);

    // If it's a menu with subitems, filter the subitems as well
    if (item.items) {
      item.items = item.items.filter((subItem) =>
        subItem.allowedRoles?.includes(currentUser?.role)
      );
      // Only show the menu if it has at least one visible subitem
      return hasPermission && item.items.length > 0;
    }

    return hasPermission;
  });

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
        {filteredArray1.map((item) => (
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
                    secondary={open ? item.description : null}
                    sx={{
                      opacity: open ? 1 : 0,
                      "& .MuiTypography-root": {
                        fontWeight: 500,
                      },
                      "& .MuiTypography-secondary": {
                        fontSize: "0.75rem",
                        opacity: 0.7,
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
