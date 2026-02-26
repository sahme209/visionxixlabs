"use client";

import React from "react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays } from "date-fns";

interface AccountActivityChartProps {
  data?: Array<{ date: string; logins: number; actions: number }>;
}

export default function AccountActivityChart({ data }: AccountActivityChartProps) {
  // Generate sample data if not provided
  const chartData = data || Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    return {
      date: format(date, "MMM dd"),
      fullDate: date,
      logins: Math.floor(Math.random() * 5) + 1,
      actions: Math.floor(Math.random() * 15) + 5,
    };
  });

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--uscis-blue)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--uscis-blue)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={{ stroke: "var(--border-color)" }}
          />
          <YAxis 
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={{ stroke: "var(--border-color)" }}
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
          <Area 
            type="monotone" 
            dataKey="logins" 
            stroke="var(--uscis-blue)" 
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorLogins)"
            name="Logins"
          />
          <Area 
            type="monotone" 
            dataKey="actions" 
            stroke="#10B981" 
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorActions)"
            name="Actions"
          />
          <Legend 
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="circle"
            formatter={(value) => <span style={{ color: "var(--text-primary)", fontSize: "12px" }}>{value}</span>}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
