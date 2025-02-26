import React, { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";
import {
  Chip,
  useTheme,
  Button,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import AdminIcon from "@mui/icons-material/VerifiedUser";
import UserIcon from "@mui/icons-material/Person";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { userService } from "../../services/api";

const ManageUsers = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await userService.getUsers();
        console.log("Users data:", data);
        setUsers(data.results); // Use data.results instead of data
      } catch (err) {
        console.error("Failed to fetch users:", err);
        setError("Failed to load users. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleDeleteUser = async (id) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await userService.deleteUser(id);
        setUsers(users.filter((user) => user.id !== id));
      } catch (err) {
        console.error("Failed to delete user:", err);
        alert("Failed to delete user. Please try again.");
      }
    }
  };

  const handleEditUser = (id) => {
    navigate(`/manage-users/edit/${id}`);
  };

  const handleAddUser = () => {
    navigate("/manage-users/add");
  };

  const columns = [
    {
      field: "id",
      headerName: "ID",
      width: 90,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "email",
      headerName: "Email",
      width: 200,
      headerClassName: "header-center",
      flex: 1,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "first_name",
      headerName: "First Name",
      width: 150,
      headerClassName: "header-center",
      flex: 1,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "last_name",
      headerName: "Last Name",
      width: 150,
      headerClassName: "header-center",
      flex: 1,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "role",
      headerName: "Role",
      width: 150,
      headerClassName: "header-center",
      flex: 1,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => {
        const isAdmin = params.value === "admin";
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isAdmin ? (
              <AdminIcon
                style={{ color: theme.palette.success.main, marginRight: 4 }}
              />
            ) : (
              <UserIcon
                style={{ color: theme.palette.info.main, marginRight: 4 }}
              />
            )}
            <Chip
              label={params.value}
              color={isAdmin ? "success" : "default"}
              style={{
                backgroundColor: isAdmin
                  ? theme.palette.success.main
                  : theme.palette.grey[300],
                color: theme.palette.getContrastText(
                  isAdmin ? theme.palette.success.main : theme.palette.grey[300]
                ),
              }}
            />
          </div>
        );
      },
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 150,
      headerClassName: "header-center",
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit User">
            <IconButton
              color="primary"
              onClick={() => handleEditUser(params.row.id)}
              size="small"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton
              color="error"
              onClick={() => handleDeleteUser(params.row.id)}
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          flexDirection: "column",
        }}
      >
        <Typography color="error" variant="h6" gutterBottom>
          {error}
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <div
      style={{
        marginTop: "16px",
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h4" component="h1">
          Manage Users
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddUser}
        >
          Add User
        </Button>
      </Box>

      <div style={{ height: "calc(100vh - 180px)", width: "100%" }}>
        <DataGrid
          rows={users}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[5, 10, 20]}
          disableSelectionOnClick
        />
      </div>
      <Outlet />
    </div>
  );
};

export default ManageUsers;
