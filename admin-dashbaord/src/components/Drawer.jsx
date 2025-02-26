import React from "react";
import { styled } from "@mui/material/styles";
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

const drawerWidth = 240;

const openedMixin = (theme) => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
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

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const StyledDrawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => {
  return {
    width: drawerWidth,
    flexShrink: 0,
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    maxHeight: "100vh",
    overflowY: "auto",
    ...(open && {
      ...openedMixin(theme),
      "& .MuiDrawer-paper": {
        ...openedMixin(theme),
        maxHeight: "100vh",
        overflowY: "auto",
      },
    }),
    ...(!open && {
      ...closedMixin(theme),
      "& .MuiDrawer-paper": closedMixin(theme),
    }),
    [theme.breakpoints.down("sm")]: {
      width: "100%", // Full width on small screens
      flexShrink: 0,
    },
  };
});

const Array1 = [
  {
    text: "Dashboard",
    icon: <HomeOutlinedIcon />,
    path: "/",
  },
  {
    text: "Manage Users",
    icon: <PeopleOutlinedIcon />,
    path: "/manage-users",
  },
  {
    text: "Contacts Information",
    icon: <ContactsOutlinedIcon />,
    path: "/contacts-information",
  },
  {
    text: "Invoices Balance",
    icon: <ReceiptOutlinedIcon />,
    path: "/invoices",
  },
  {
    text: "Profile Form",
    icon: <PersonOutlinedIcon />,
    path: "/form",
  },
  {
    text: "Calendar",
    icon: <CalendarTodayOutlinedIcon />,
    path: "/calendar",
  },
  {
    text: "FAQ Page",
    icon: <HelpOutlineOutlinedIcon />,
    path: "/faq",
  },
];

const Array2 = [
  {
    text: "Bar Chart",
    icon: <BarChartOutlinedIcon />,
    path: "/bar",
  },
  {
    text: "Pie Chart",
    icon: <PieChartOutlineOutlinedIcon />,
    path: "/pie",
  },
  {
    text: "Line Chart",
    icon: <TimelineOutlinedIcon />,
    path: "/line",
  },
  {
    text: "Geography Chart",
    icon: <MapOutlinedIcon />,
    path: "/geography",
  },
  {
    text: "Pivot Table",
    icon: <TableChartIcon />,
    path: "/pivot-table",
  },
];

const Array3 = [
  {
    text: "Bar Chart",
    icon: <BarChartIcon />,
    path: "/bar-chart",
  },
  {
    text: "Pie Chart",
    icon: <PieChartIcon />,
    path: "/pie-chart",
  },
  {
    text: "Line Chart",
    icon: <LineChartIcon />,
    path: "/line-chart",
  },
  {
    text: "Radar Chart",
    icon: <RadarChartIcon />,
    path: "/radar-chart",
  },
];

export default function Drawer({ open, handleDrawerClose, theme }) {
  return (
    <StyledDrawer variant="permanent" open={open}>
      <DrawerHeader>
        <IconButton onClick={handleDrawerClose}>
          {theme.direction === "rtl" ? (
            <ChevronRightIcon />
          ) : (
            <ChevronLeftIcon />
          )}
        </IconButton>
      </DrawerHeader>
      <Divider />

      <ListItem>
        <Avatar alt="User Name" src="/path/to/avatar.jpg" />
        <ListItemText
          primary="User Name"
          secondary="user@example.com"
          sx={{ marginLeft: 2 }}
        />
      </ListItem>

      <Divider />
      <List>
        {Array1.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ display: "block" }}>
            <ListItemButton
              component={NavLink}
              to={item.path}
              sx={{
                minHeight: 48,
                px: 2.5,
                justifyContent: open ? "initial" : "center",
                "&.active": {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.getContrastText(
                    theme.palette.primary.main
                  ),
                },
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  justifyContent: "center",
                  mr: open ? 3 : "auto",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {Array2.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ display: "block" }}>
            <ListItemButton
              component={NavLink}
              to={item.path}
              sx={{
                minHeight: 48,
                px: 2.5,
                justifyContent: open ? "initial" : "center",
                "&.active": {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.common.white,
                },
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  justifyContent: "center",
                  mr: open ? 3 : "auto",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {Array3.map((item) => (
          <ListItem key={item.path} disablePadding sx={{ display: "block" }}>
            <ListItemButton
              component={NavLink}
              to={item.path}
              sx={{
                minHeight: 48,
                px: 2.5,
                justifyContent: open ? "initial" : "center",
                "&.active": {
                  backgroundColor: theme.palette.primary.main,
                  color: theme.palette.common.white,
                },
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  justifyContent: "center",
                  mr: open ? 3 : "auto",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.text}
                sx={{ opacity: open ? 1 : 0 }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </StyledDrawer>
  );
}

Drawer.propTypes = {
  open: PropTypes.bool.isRequired,
  handleDrawerClose: PropTypes.func.isRequired,
  theme: PropTypes.object.isRequired,
};
