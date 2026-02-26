"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface StageCompletionChartProps {
  data?: Array<{ stage: string; completed: number; total: number; color: string }>;
}

export default function StageCompletionChart({ data }: StageCompletionChartProps) {
  const chartData = data || [
    { stage: "NVC", completed: 8, total: 10, color: "#3B82F6" },
    { stage: "DQ", completed: 6, total: 8, color: "#10B981" },
    { stage: "Interview", completed: 3, total: 5, color: "#F59E0B" },
  ];

  const processedData = chartData.map(item => ({
    ...item,
    percentage: Math.round((item.completed / item.total) * 100),
    remaining: item.total - item.completed,
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={processedData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
          <defs>
            {processedData.map((item, index) => (
              <linearGradient key={index} id={`stageGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={item.color} stopOpacity={0.9}/>
                <stop offset="95%" stopColor={item.color} stopOpacity={0.5}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
          <XAxis 
            dataKey="stage" 
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={{ stroke: "var(--border-color)" }}
          />
          <YAxis 
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={{ stroke: "var(--border-color)" }}
            label={{ 
              value: "Steps", 
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
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                const name = payload[0].dataKey;
                const value = payload[0].value as number;
                
                if (name === "completed") {
                  return (
                    <div style={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px",
                      padding: "12px",
                    }}>
                      <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                        {data.stage}
                      </p>
                      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        Completed: {value}/{data.total} ({data.percentage}%)
                      </p>
                    </div>
                  );
                } else {
                  return (
                    <div style={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "12px",
                      padding: "12px",
                    }}>
                      <p style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                        {data.stage}
                      </p>
                      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                        Remaining: {value} steps
                      </p>
                    </div>
                  );
                }
              }
              return null;
            }}
          />
          <Bar dataKey="completed" radius={[8, 8, 0, 0]} name="completed">
            {processedData.map((entry, index) => (
              <Cell key={`cell-completed-${index}`} fill={`url(#stageGradient-${index})`} />
            ))}
          </Bar>
          <Bar dataKey="remaining" radius={[0, 0, 8, 8]} fill="#E5E7EB" name="remaining" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
