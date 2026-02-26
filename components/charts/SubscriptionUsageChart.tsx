"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface SubscriptionUsageChartProps {
  data?: Array<{ name: string; value: number; color: string }>;
}

export default function SubscriptionUsageChart({ data }: SubscriptionUsageChartProps) {
  const chartData = data || [
    { name: "Case Tracking", value: 45, color: "#3B82F6" },
    { name: "Statistics", value: 25, color: "#10B981" },
    { name: "Case Tools", value: 20, color: "#F59E0B" },
    { name: "Guides", value: 10, color: "#8B5CF6" },
  ];

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
            outerRadius={100}
            innerRadius={50}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              padding: "12px",
            }}
            formatter={(value: any) => [`${value}%`, "Usage"]}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => <span style={{ color: "var(--text-primary)", fontSize: "12px" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Total Usage: <span className="font-semibold text-[var(--text-primary)]">{total}%</span>
        </p>
      </div>
    </div>
  );
}
