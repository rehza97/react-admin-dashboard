import { Grid } from "@mui/material";
import CardComponent from "./CardComponent";
import { Email, Person, ShoppingCart, TrendingUp } from "@mui/icons-material";

const pieData1 = [
  { name: "Group A", value: 400, color: "#0088FE" },
  { name: "Group B", value: 300, color: "#00C49F" },
];
const pieData2 = [
  { name: "Group A", value: 300, color: "#FFBB28" },
  { name: "Group B", value: 200, color: "#FF8042" },
];
const pieData3 = [
  { name: "Group A", value: 200, color: "#FFBB28" },
  { name: "Group B", value: 100, color: "#0088FE" },
];
const pieData4 = [
  { name: "Group A", value: 500, color: "#00C49F" },
  { name: "Group B", value: 300, color: "#FF8042" },
];

export default function Row1() {
  return (
    <Grid 
      container 
      spacing={{ xs: 1, sm: 2, md: 3 }} 
      sx={{ 
        p: { xs: 1, sm: 2, md: 4 },
        width: '100%',
        margin: 0,
        boxSizing: 'border-box'
      }}
    >
      <Grid item xs={12} sm={6} lg={3}>
        <CardComponent
          title="Emails Sent"
          subtitle="Total Emails"
          icon={<Email />}
          data={pieData1}
          value="12,361"
          percentageChange={14}
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <CardComponent
          title="Users"
          subtitle="Total Users"
          icon={<Person />}
          data={pieData2}
          value="8,000"
          percentageChange={-5}
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <CardComponent
          title="Sales"
          subtitle="Total Sales"
          icon={<ShoppingCart />}
          data={pieData3}
          value="5,000"
          percentageChange={10}
        />
      </Grid>
      <Grid item xs={12} sm={6} lg={3}>
        <CardComponent
          title="Growth"
          subtitle="Percentage Growth"
          icon={<TrendingUp />}
          data={pieData4}
          value="15,000"
          percentageChange={20}
        />
      </Grid>
    </Grid>
  );
}
