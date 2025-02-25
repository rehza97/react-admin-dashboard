import React from "react";
import { Outlet } from "react-router-dom";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";

// Sample data for the DataGrid
const rows = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@example.com",
    age: 28,
    phone: "123-456-7890",
    address: "123 Main St",
    city: "New York",
    zipcode: "10001",
    registerId: "REG123",
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane.smith@example.com",
    age: 34,
    phone: "987-654-3210",
    address: "456 Elm St",
    city: "Los Angeles",
    zipcode: "90001",
    registerId: "REG124",
  },
  {
    id: 3,
    name: "Alice Johnson",
    email: "alice.johnson@example.com",
    age: 29,
    phone: "555-555-5555",
    address: "789 Oak St",
    city: "Chicago",
    zipcode: "60601",
    registerId: "REG125",
  },
  {
    id: 4,
    name: "Bob Brown",
    email: "bob.brown@example.com",
    age: 45,
    phone: "444-444-4444",
    address: "321 Pine St",
    city: "Houston",
    zipcode: "77001",
    registerId: "REG126",
  },
  {
    id: 5,
    name: "Charlie Davis",
    email: "charlie.davis@example.com",
    age: 31,
    phone: "333-333-3333",
    address: "654 Maple St",
    city: "Phoenix",
    zipcode: "85001",
    registerId: "REG127",
  },
  {
    id: 6,
    name: "Diana Prince",
    email: "diana.prince@example.com",
    age: 27,
    phone: "222-222-2222",
    address: "987 Cedar St",
    city: "Philadelphia",
    zipcode: "19101",
    registerId: "REG128",
  },
  {
    id: 7,
    name: "Ethan Hunt",
    email: "ethan.hunt@example.com",
    age: 36,
    phone: "111-111-1111",
    address: "135 Birch St",
    city: "San Antonio",
    zipcode: "78201",
    registerId: "REG129",
  },
  {
    id: 8,
    name: "Fiona Gallagher",
    email: "fiona.gallagher@example.com",
    age: 24,
    phone: "666-666-6666",
    address: "246 Spruce St",
    city: "San Diego",
    zipcode: "92101",
    registerId: "REG130",
  },
  {
    id: 9,
    name: "George Costanza",
    email: "george.costanza@example.com",
    age: 40,
    phone: "777-777-7777",
    address: "357 Fir St",
    city: "Dallas",
    zipcode: "75201",
    registerId: "REG131",
  },
  {
    id: 10,
    name: "Hannah Baker",
    email: "hannah.baker@example.com",
    age: 22,
    phone: "888-888-8888",
    address: "468 Willow St",
    city: "San Jose",
    zipcode: "95101",
    registerId: "REG132",
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
    field: "address",
    headerName: "Address",
    width: 200,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
  },
  {
    field: "city",
    headerName: "City",
    width: 150,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
  },
  {
    field: "zipcode",
    headerName: "Zip Code",
    width: 120,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
  },
  {
    field: "registerId",
    headerName: "Register ID",
    width: 150,
    headerClassName: "header-center",
    flex: 1,
    align: "center",
    headerAlign: "center",
  },
];

const ContactsInformation = () => {
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
          <DataGrid
            rows={rows}
            columns={columns}
            pageSize={5}
            slots={{
              toolbar: GridToolbar,
            }}
          />
        </div>
      </div>
      <Outlet />
    </div>
  );
};

export default ContactsInformation;
