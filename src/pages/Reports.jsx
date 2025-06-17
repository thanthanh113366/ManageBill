import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, TrendingUp, DollarSign, FileText, Package, ShoppingBag } from 'lucide-react';

const Reports = () => {
  const { menuItems } = useApp();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [periodType, setPeriodType] = useState('week'); // 'day', 'week', 'month'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalBills: 0,
    avgRevenuePerBill: 0,
    totalCostPrice: 0,
    totalFixedCost: 0
  });

  useEffect(() => {
    // Set default date range based on period type
    const today = new Date();
    let start, end;

    switch (periodType) {
      case 'day':
        start = new Date(today);
        start.setDate(start.getDate() - 6); // Last 7 days
        end = today;
        break;
      case 'week':
        start = new Date(today);
        start.setDate(start.getDate() - 28); // Last 4 weeks
        end = today;
        break;
      case 'month':
        start = new Date(today);
        start.setMonth(start.getMonth() - 5); // Last 6 months
        end = today;
        break;
      default:
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        end = today;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, [periodType]);

  useEffect(() => {
    if (startDate && endDate) {
      loadReportData();
    }
  }, [startDate, endDate, periodType]);

  const loadReportData = async () => {
    setLoading(true);
    
    try {
      const q = query(
        collection(db, 'bills'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(q);
      const bills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Group data by period
      const groupedData = groupDataByPeriod(bills, periodType);
      setReportData(groupedData);

      // Calculate summary
      const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalRevenue, 0);
      const totalProfit = bills.reduce((sum, bill) => sum + bill.totalProfit, 0);
      const totalBills = bills.length;
      const avgRevenuePerBill = totalBills > 0 ? totalRevenue / totalBills : 0;

      // Calculate total cost price and fixed cost
      let totalCostPrice = 0;
      let totalFixedCost = 0;

      bills.forEach(bill => {
        bill.items.forEach(item => {
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          if (menuItem) {
            totalCostPrice += menuItem.costPrice * item.quantity;
            totalFixedCost += menuItem.fixedCost * item.quantity;
          }
        });
      });

      setSummary({
        totalRevenue,
        totalProfit,
        totalBills,
        avgRevenuePerBill,
        totalCostPrice,
        totalFixedCost
      });

    } catch (error) {
      console.error('Error loading report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupDataByPeriod = (bills, period) => {
    const groups = {};

    bills.forEach(bill => {
      let key;
      const date = new Date(bill.date);

      switch (period) {
        case 'day':
          key = bill.date;
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = bill.date;
      }

      if (!groups[key]) {
        groups[key] = {
          period: key,
          revenue: 0,
          profit: 0,
          bills: 0,
          costPrice: 0,
          fixedCost: 0
        };
      }

      groups[key].revenue += bill.totalRevenue;
      groups[key].profit += bill.totalProfit;
      groups[key].bills += 1;

      // Calculate cost price and fixed cost for this period
      bill.items.forEach(item => {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        if (menuItem) {
          groups[key].costPrice += menuItem.costPrice * item.quantity;
          groups[key].fixedCost += menuItem.fixedCost * item.quantity;
        }
      });
    });

    return Object.values(groups).sort((a, b) => a.period.localeCompare(b.period));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const formatPeriodLabel = (period) => {
    switch (periodType) {
      case 'day':
        return new Date(period).toLocaleDateString('vi-VN', { 
          month: 'short', 
          day: 'numeric' 
        });
      case 'week':
        const weekStart = new Date(period);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
      case 'month':
        const [year, month] = period.split('-');
        return `${month}/${year}`;
      default:
        return period;
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Find the corresponding data row for additional info
      const dataRow = reportData.find(row => row.period === label);
      
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">
            {formatPeriodLabel(label)}
          </p>
          <div className="space-y-1">
            <p className="text-green-600">
              Doanh thu: {formatCurrency(payload[0].value)}
            </p>
            <p className="text-blue-600">
              Lợi nhuận: {formatCurrency(payload[1].value)}
            </p>
            {dataRow && (
              <>
                <p className="text-orange-600">
                  Vốn: {formatCurrency(dataRow.costPrice || 0)}
                </p>
                <p className="text-red-600">
                  Chi phí cố định: {formatCurrency(dataRow.fixedCost || 0)}
                </p>
                <p className="text-gray-600">
                  Số đơn: {dataRow.bills}
                </p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Báo cáo</h1>
            <p className="text-gray-600 mt-1">
              Phân tích doanh thu và lợi nhuận theo thời gian
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="day">Theo ngày</option>
              <option value="week">Theo tuần</option>
              <option value="month">Theo tháng</option>
            </select>
            
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span className="text-gray-500">đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng đơn hàng</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalBills}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng doanh thu</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totalRevenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng lợi nhuận</p>
              <p className="text-2xl font-bold text-indigo-600">
                {formatCurrency(summary.totalProfit)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Package className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng vốn</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(summary.totalCostPrice)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Chi phí cố định</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.totalFixedCost)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">TB doanh thu/đơn</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(summary.avgRevenuePerBill)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Revenue and Profit Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Biểu đồ doanh thu và lợi nhuận
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    tickFormatter={formatPeriodLabel}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tickFormatter={(value) => 
                      new Intl.NumberFormat('vi-VN', {
                        notation: 'compact',
                        compactDisplay: 'short'
                      }).format(value)
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="#10b981" name="Doanh thu" />
                  <Bar dataKey="profit" fill="#6366f1" name="Lợi nhuận" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bills Trend Chart */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Xu hướng số lượng đơn hàng
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="period" 
                    tickFormatter={formatPeriodLabel}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={formatPeriodLabel}
                    formatter={(value, name) => [value, 'Số đơn hàng']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="bills" 
                    stroke="#f59e0b" 
                    strokeWidth={3}
                    dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Data Table */}
      {reportData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Chi tiết dữ liệu
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kỳ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Số đơn hàng
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Doanh thu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vốn
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chi phí cố định
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lợi nhuận
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TB doanh thu/đơn
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatPeriodLabel(row.period)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.bills}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">
                      {formatCurrency(row.costPrice || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      {formatCurrency(row.fixedCost || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-medium">
                      {formatCurrency(row.profit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(row.bills > 0 ? row.revenue / row.bills : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports; 