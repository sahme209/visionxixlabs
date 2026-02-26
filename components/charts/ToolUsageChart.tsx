"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface ToolUsageChartProps {
  data?: Array<{ name: string; usage: number; color: string }>;
}

export default function ToolUsageChart({ data }: ToolUsageChartProps) {
  const chartData = data || [
    { name: "RFE/NOID", usage: 45, color: "#F97316" },
    { name: "Document Pack", usage: 38, color: "#3B82F6" },
    { name: "Timeline Alerts", usage: 52, color: "#0071e3" },
    { name: "Evidence Checklist", usage: 29, color: "#8B5CF6" },
  ];

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
          <defs>
            {chartData.map((item, index) => (
              <linearGradient key={index} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={item.color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={item.color} stopOpacity={0.3}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={{ stroke: "var(--border-color)" }}
          />
          <YAxis 
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={{ stroke: "var(--border-color)" }}
            label={{ 
              value: "Usage Count", 
              angle: -90, 
              position: "insideLeft",
              style: { textAnchor: "middle", fontSize: 11, fill: "var(--text-secondary)" },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-color)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              padding: "12px",
            }}
            labelStyle={{ 
              color: "var(--text-primary)", 
              fontWeight: 600,
              fontSize: 12,
              marginBottom: 4,
            }}
            itemStyle={{ 
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
            formatter={(value: any) => [`${value} times`, "Usage"]}
          />
          <Bar dataKey="usage" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={`url(#gradient-${index})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
