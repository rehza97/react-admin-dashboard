import React from "react";
import { Outlet } from "react-router-dom";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { Box, Typography } from "@mui/material";
import ExportButton from "../../components/ExportButton";

// Sample data for the DataGrid
const rows = [
  {
    id: 1,
    name: "John Doe",
    phone: "123-456-7890",
    email: "john.doe@example.com",
    cost: 150.0,
    date: new Date("2023-10-01"),
  },
  {
    id: 2,
    name: "Jane Smith",
    phone: "987-654-3210",
    email: "jane.smith@example.com",
    cost: 200.0,
    date: new Date("2023-10-15"),
  },
  {
    id: 3,
    name: "Alice Johnson",
    phone: "555-555-5555",
    email: "alice.johnson@example.com",
    cost: 300.0,
    date: new Date("2023-09-20"),
  },
  {
    id: 4,
    name: "Bob Brown",
    phone: "444-444-4444",
    email: "bob.brown@example.com",
    cost: 400.0,
    date: new Date("2023-10-05"),
  },
  {
    id: 5,
    name: "Charlie Davis",
    phone: "333-333-3333",
    email: "charlie.davis@example.com",
    cost: 250.0,
    date: new Date("2023-10-10"),
  },
];

// Define the columns for the DataGrid
const columns = [
  {
    field: "id",
    headerName: "ID",
    width: 90,
    align: "center",
    headerAlign: "center",
    type: "number",
  },
  {
    field: "name",
    headerName: "Name",
    width: 150,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
    type: "string",
  },
  {
    field: "phone",
    headerName: "Phone",
    width: 150,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
    type: "string",
  },
  {
    field: "email",
    headerName: "Email",
    width: 200,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
    type: "string",
  },
  {
    field: "cost",
    headerName: "Cost",
    width: 150,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
    type: "number",
  },
  {
    field: "date",
    headerName: "Date",
    width: 150,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
    type: "date",
  },
];

// Export columns configuration
const exportColumns = [
  { field: "id", header: "Invoice ID" },
  { field: "name", header: "Customer Name" },
  { field: "phone", header: "Phone Number" },
  { field: "email", header: "Email Address" },
  { field: "cost", header: "Invoice Amount" },
  { field: "date", header: "Invoice Date" }
];

const InvoiceBalance = () => {
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
      <Box sx={{ width: "99%", mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4" component="h1">
          Invoice Balance
        </Typography>
        <ExportButton 
          data={rows} 
          columns={exportColumns} 
          fileName="invoice_balance"
        />
      </Box>
      
      <div
        style={{
          flex: 1,
          width: "99%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ height: "calc(100vh - 120px)", width: "100%" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            pageSize={5}
            checkboxSelection
            slots={{
              toolbar: GridToolbar,
            }}
            onError={(error) => {
              console.error("DataGrid Error:", error);
            }}
          />
        </div>
      </div>
      <Outlet />
    </div>
  );
};

export default InvoiceBalance;
