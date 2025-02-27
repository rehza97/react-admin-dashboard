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
import PageLayout from "../../components/PageLayout";

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

  const headerAction = (
    <Button
      variant="contained"
      color="primary"
      startIcon={<AddIcon />}
      onClick={handleAddUser}
    >
      Add User
    </Button>
  );

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
      flex: 1,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={params.value === "admin" ? "primary" : "default"}
          size="small"
          sx={{ minWidth: 80 }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit User">
            <IconButton
              onClick={() => handleEditUser(params.row.id)}
              color="primary"
              size="small"
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete User">
            <IconButton
              onClick={() => handleDeleteUser(params.row.id)}
              color="error"
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
      <PageLayout title="Manage Users">
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Manage Users">
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
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Manage Users"
      subtitle="Add, edit, and manage user accounts"
      headerAction={headerAction}
    >
      <DataGrid
        rows={users}
        columns={columns}
        pageSize={10}
        rowsPerPageOptions={[5, 10, 20]}
        disableSelectionOnClick
        autoHeight
        sx={{
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      />
      <Outlet />
    </PageLayout>
  );
};

export default ManageUsers;
