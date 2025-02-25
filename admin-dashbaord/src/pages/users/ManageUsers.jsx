import { Outlet } from "react-router-dom";
import { DataGrid } from "@mui/x-data-grid";
import { rows } from "./userData"; // Import the rows from the new data file
import { Chip, useTheme } from "@mui/material";
import AdminIcon from '@mui/icons-material/VerifiedUser'; // Import Admin icon
import UserIcon from '@mui/icons-material/Person'; // Import User icon

const ManageUsers = () => {
  const theme = useTheme(); // Move useTheme here

  const columns = [
    {
      field: "id",
      headerName: "ID",
      width: 90,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "name",
      headerName: "Name",
      width: 150,
      headerClassName: "header-center",
      flex: 1,
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
      field: "age",
      headerName: "Age",
      width: 100,
      headerClassName: "header-center",
      flex: 1,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "phone",
      headerName: "Phone",
      width: 150,
      headerClassName: "header-center",
      flex: 1,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "access",
      headerName: "Access (Role)",
      width: 150,
      headerClassName: "header-center",
      flex: 1,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => {
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {params.value === "Admin" ? (
              <AdminIcon style={{ color: theme.palette.success.main, marginRight: 4 }} />
            ) : (
              <UserIcon style={{ color: theme.palette.info.main, marginRight: 4 }} />
            )}
            <Chip
              label={params.value}
              color={params.value === "Admin" ? "success" : "default"}
              style={{
                backgroundColor: params.value === "Admin" ? theme.palette.success.main : theme.palette.grey[300],
                color: theme.palette.getContrastText(params.value === "Admin" ? theme.palette.success.main : theme.palette.grey[300]),
              }}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div
      style={{
        marginTop: "16px",
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          flex: 1,
          width: "99%", // Set a fixed width for the DataGrid container
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ height: "calc(100vh - 120px)", width: "100%" }}>
          <DataGrid rows={rows} columns={columns} pageSize={5} />
        </div>
      </div>
      <Outlet />
    </div>
  );
};

export default ManageUsers;
