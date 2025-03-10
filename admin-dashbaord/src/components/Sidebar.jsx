import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListItem, ListItemIcon, ListItemText } from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import { useLocation } from "react-router-dom";

const Sidebar = () => {
  const location = useLocation();

  return (
    <div>
      {/* Add the DOT permissions management link to the sidebar navigation */}
      {/* Look for a user management or admin section and add the new link there */}
      {/* If there's no user management section, add it to the appropriate place */}

      {/* Example: */}
      {/* Add to the list items in the sidebar */}
      <ListItem
        button
        component={Link}
        to="/user-management/dot-permissions"
        sx={{
          color:
            location.pathname === "/user-management/dot-permissions"
              ? "primary.main"
              : "text.primary",
          pl: 4,
        }}
      >
        <ListItemIcon>
          <BusinessIcon
            color={
              location.pathname === "/user-management/dot-permissions"
                ? "primary"
                : "inherit"
            }
          />
        </ListItemIcon>
        <ListItemText primary="DOT Permissions" />
      </ListItem>
    </div>
  );
};

export default Sidebar;
