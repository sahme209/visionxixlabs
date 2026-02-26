"use client";

import React from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";

interface ProgressChartProps {
  data?: Array<{ name: string; value: number; color: string }>;
}

export default function ProgressChart({ data }: ProgressChartProps) {
  const chartData = data || [
    { name: "NVC Stage", value: 85, color: "#3B82F6", fill: "#3B82F6" },
    { name: "DQ Stage", value: 60, color: "#10B981", fill: "#10B981" },
    { name: "Interview", value: 30, color: "#F59E0B", fill: "#F59E0B" },
  ];

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={350}>
        <RadialBarChart 
          cx="50%" 
          cy="50%" 
          innerRadius="20%" 
          outerRadius="90%" 
          data={chartData}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={10}
            fill="#8884d8"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </RadialBar>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              padding: "12px",
            }}
            formatter={(value: any) => [`${value}%`, "Completion"]}
          />
          <Legend 
            iconType="circle"
            formatter={(value) => <span style={{ color: "var(--text-primary)", fontSize: "12px" }}>{value}</span>}
          />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}
