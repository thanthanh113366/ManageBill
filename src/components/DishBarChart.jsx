import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../utils/dishAnalysis';

/**
 * Bar Chart component for displaying top dishes
 */
const DishBarChart = ({ data, dataKey = 'totalQuantity', title = 'Top Món Ăn' }) => {
  // Take top 10 items for chart
  const chartData = data.slice(0, 10);

  // Color gradient for bars
  const colors = [
    '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{data.name}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Tổng SL: <span className="font-semibold">{data.totalQuantity}</span>
            </p>
            <p className="text-purple-600">
              Số bills: <span className="font-semibold">{data.billCount}</span>
            </p>
            <p className="text-orange-600">
              TB/lần: <span className="font-semibold">{data.avgPerOrder}</span>
            </p>
            <p className="text-green-600">
              Doanh thu: <span className="font-semibold">{formatCurrency(data.totalRevenue)}</span>
            </p>
            <p className="text-indigo-600">
              Lợi nhuận: <span className="font-semibold">{formatCurrency(data.totalProfit)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Truncate long names for X-axis
  const truncateName = (name) => {
    return name.length > 15 ? name.substring(0, 15) + '...' : name;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tickFormatter={truncateName}
              angle={-45}
              textAnchor="end"
              height={100}
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              label={{ 
                value: 'Số lượng', 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: 12 }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={dataKey} radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DishBarChart;

