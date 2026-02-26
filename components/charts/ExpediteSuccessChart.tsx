"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface ExpediteSuccessChartProps {
  data?: Array<{ month: string; successRate: number; avgDays: number }>;
}

export default function ExpediteSuccessChart({ data }: ExpediteSuccessChartProps) {
  const chartData = data || [
    { month: "Jan", successRate: 68, avgDays: 45 },
    { month: "Feb", successRate: 72, avgDays: 42 },
    { month: "Mar", successRate: 75, avgDays: 38 },
    { month: "Apr", successRate: 73, avgDays: 40 },
    { month: "May", successRate: 78, avgDays: 35 },
    { month: "Jun", successRate: 80, avgDays: 32 },
  ];

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
          <defs>
            <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={{ stroke: "var(--border-color)" }}
          />
          <YAxis 
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={{ stroke: "var(--border-color)" }}
            label={{ 
              value: "Success Rate (%)", 
              angle: -90, 
              position: "insideLeft",
              style: { textAnchor: "middle", fontSize: 11, fill: "var(--text-secondary)" },
            }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#F59E0B" }}
            axisLine={{ stroke: "#F59E0B" }}
            tickLine={{ stroke: "#F59E0B" }}
            label={{ 
              value: "Avg Days", 
              angle: 90, 
              position: "insideRight",
              style: { textAnchor: "middle", fontSize: 11, fill: "#F59E0B" },
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
          />
          <ReferenceLine yAxisId="left" y={70} stroke="#10B981" strokeDasharray="5 5" strokeOpacity={0.5} />
          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="successRate" 
            stroke="#10B981" 
            strokeWidth={3}
            dot={{ fill: "#10B981", r: 5, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: "#fff" }}
            name="Success Rate (%)"
            isAnimationActive={true}
            animationDuration={800}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="avgDays" 
            stroke="#F59E0B" 
            strokeWidth={3}
            strokeDasharray="5 5"
            dot={{ fill: "#F59E0B", r: 5, strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: "#fff" }}
            name="Avg Processing Days"
            isAnimationActive={true}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
