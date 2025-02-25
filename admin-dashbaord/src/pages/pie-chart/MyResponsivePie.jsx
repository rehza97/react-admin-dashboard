import React from "react";
import { ResponsivePie } from "@nivo/pie";
import { useTheme } from "@mui/material/styles";

const MyResponsivePie = ({ data }) => {
  const theme = useTheme(); // Get the current theme

  return (
    <ResponsivePie
      data={data}
      margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
      innerRadius={0.65}
      padAngle={4}
      cornerRadius={13}
      activeOuterRadiusOffset={8}
      borderWidth={1}
      borderColor={{
        from: "color",
        modifiers: [["darker", 0.2]],
      }}
      arcLinkLabelsSkipAngle={10}
      arcLinkLabelsTextColor={theme.palette.text.primary} // Use theme color for link labels
      arcLinkLabelsThickness={2}
      arcLinkLabelsColor={{ from: "color" }}
      arcLabelsSkipAngle={10}
      arcLabelsTextColor={theme.palette.text.primary} // Use theme color for arc label text
      arcLabelsTextSize={26} 
      defs={[
        {
          id: "dots",
          type: "patternDots",
          background: "inherit",
          color: "rgba(255, 255, 255, 0.3)",
          size: 0,
          padding: 1,
          stagger: true,
        },
        {
          id: "lines",
          type: "patternLines",
          background: "inherit",
          color: "rgba(255, 255, 255, 0.3)",
          rotation: -45,
          lineWidth: 6,
          spacing: 10,
        },
      ]}
      fill={[
        {
          match: { id: "ruby" },
          id: "dots",
        },
        {
          match: { id: "c" },
          id: "dots",
        },
        {
          match: { id: "go" },
          id: "dots",
        },
        {
          match: { id: "python" },
          id: "dots",
        },
        {
          match: { id: "scala" },
          id: "lines",
        },
        {
          match: { id: "lisp" },
          id: "lines",
        },
        {
          match: { id: "elixir" },
          id: "lines",
        },
        {
          match: { id: "javascript" },
          id: "lines",
        },
      ]}
      legends={[
        {
          anchor: "bottom",
          direction: "row",
          justify: false,
          translateX: 0,
          translateY: 56,
          itemsSpacing: 0,
          itemWidth: 100,
          itemHeight: 18,
          itemTextColor: theme.palette.text.primary, // Use theme color for legend text
          itemDirection: "left-to-right",
          itemOpacity: 1,
          symbolSize: 28,
          symbolShape: "circle",
          effects: [
            {
              on: "hover",
              style: {
                itemTextColor: theme.palette.primary.main, // Change color on hover
              },
            },
          ],
        },
      ]}
    />
  );
};

export default MyResponsivePie;
