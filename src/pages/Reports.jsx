import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { getBillCostTotalsForReport } from '../utils/billCostTotals';
import { computePnL, groupPnLByPeriod, formatVND, formatPercent } from '../utils/pnlCalculations';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  DollarSign,
  FileText,
  Package,
  ShoppingBag,
  Wallet,
  PiggyBank,
  Scale,
  Receipt,
  Activity,
  Coins,
  Banknote,
} from 'lucide-react';

const TABS = [
  { id: 'classic', label: 'Báo cáo cũ', icon: BarChart },
  { id: 'pnl', label: 'P&L nhà hàng', icon: Activity },
];

const Reports = () => {
  const { menuItems, orderItems, expenseCategories, pnlSettings } = useApp();

  const [activeTab, setActiveTab] = useState('pnl');

  const [reportData, setReportData] = useState([]);
  const [bills, setBills] = useState([]);
  const [dailyExpenses, setDailyExpenses] = useState([]);
  const [monthlyFixedCosts, setMonthlyFixedCosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadCallIdRef = useRef(0);

  const [periodType, setPeriodType] = useState('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showTheoretical, setShowTheoretical] = useState(true);

  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalBills: 0,
    avgRevenuePerBill: 0,
    totalCostPrice: 0,
    totalFixedCost: 0,
  });

  useEffect(() => {
    const today = new Date();
    let start, end;
    switch (periodType) {
      case 'day':
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        end = today;
        break;
      case 'week':
        start = new Date(today);
        start.setDate(start.getDate() - 28);
        end = today;
        break;
      case 'month':
        start = new Date(today);
        start.setMonth(start.getMonth() - 5);
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
      loadAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, periodType, menuItems, orderItems]);

  const loadAllData = async () => {
    const callId = ++loadCallIdRef.current;
    setLoading(true);

    try {
      const billsQ = query(
        collection(db, 'bills'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );
      const expensesQ = query(
        collection(db, 'dailyExpenses'),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );

      const monthsInRange = enumerateMonths(startDate, endDate);

      const [billsSnap, expensesSnap, monthlySnaps] = await Promise.all([
        getDocs(billsQ),
        getDocs(expensesQ),
        Promise.all(
          monthsInRange.map((m) =>
            getDocs(query(collection(db, 'monthlyFixedCosts'), where('month', '==', m)))
          )
        ),
      ]);

      if (callId !== loadCallIdRef.current) return;

      const billList = billsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const expenseList = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const monthlyList = monthlySnaps.flatMap((s) =>
        s.docs.map((d) => ({ id: d.id, ...d.data() }))
      );

      setBills(billList);
      setDailyExpenses(expenseList);
      setMonthlyFixedCosts(monthlyList);

      // Báo cáo cổ điển (group + summary)
      const groupedData = groupDataByPeriod(billList, periodType, menuItems, orderItems);
      setReportData(groupedData);

      const totalRevenue = billList.reduce((s, b) => s + (b.totalRevenue || 0), 0);
      const totalProfit = billList.reduce((s, b) => s + (b.totalProfit || 0), 0);
      const totalBills = billList.length;
      const avgRevenuePerBill = totalBills > 0 ? totalRevenue / totalBills : 0;
      let totalCostPrice = 0;
      let totalFixedCost = 0;
      billList.forEach((bill) => {
        const { costPrice, fixedCost } = getBillCostTotalsForReport(bill, menuItems, orderItems);
        totalCostPrice += costPrice;
        totalFixedCost += fixedCost;
      });
      setSummary({
        totalRevenue,
        totalProfit,
        totalBills,
        avgRevenuePerBill,
        totalCostPrice,
        totalFixedCost,
      });
    } catch (err) {
      if (callId === loadCallIdRef.current) {
        console.error('Error loading report data:', err);
      }
    } finally {
      if (callId === loadCallIdRef.current) {
        setLoading(false);
      }
    }
  };

  // ===== P&L (compute from raw data using shared util) =====
  const pnl = useMemo(() => {
    if (!startDate || !endDate) return null;
    return computePnL({
      bills,
      dailyExpenses,
      monthlyFixedCosts,
      menuItems,
      orderItems,
      expenseCategories,
      settings: pnlSettings,
      from: startDate,
      to: endDate,
    });
  }, [
    bills,
    dailyExpenses,
    monthlyFixedCosts,
    menuItems,
    orderItems,
    expenseCategories,
    pnlSettings,
    startDate,
    endDate,
  ]);

  const pnlByPeriod = useMemo(() => {
    if (!pnl) return [];
    return groupPnLByPeriod(pnl.byDay, periodType, pnlSettings);
  }, [pnl, periodType, pnlSettings]);

  const groupDataByPeriod = (billsArr, period, menuItemsArg, orderItemsArg) => {
    const groups = {};
    billsArr.forEach((bill) => {
      let key;
      const date = new Date(bill.date);
      switch (period) {
        case 'day':
          key = bill.date;
          break;
        case 'week': {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        }
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        default:
          key = bill.date;
      }
      if (!groups[key]) {
        groups[key] = { period: key, revenue: 0, profit: 0, bills: 0, costPrice: 0, fixedCost: 0 };
      }
      groups[key].revenue += bill.totalRevenue;
      groups[key].profit += bill.totalProfit;
      groups[key].bills += 1;
      const { costPrice, fixedCost } = getBillCostTotalsForReport(bill, menuItemsArg, orderItemsArg);
      groups[key].costPrice += costPrice;
      groups[key].fixedCost += fixedCost;
    });
    return Object.values(groups).sort((a, b) => a.period.localeCompare(b.period));
  };

  const formatCurrency = (n) => formatVND(n);

  const formatPeriodLabel = (period) => {
    switch (periodType) {
      case 'day':
        return new Date(period).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
      case 'week': {
        const weekStart = new Date(period);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`;
      }
      case 'month': {
        const [year, month] = period.split('-');
        return `${month}/${year}`;
      }
      default:
        return period;
    }
  };

  const ClassicTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataRow = reportData.find((row) => row.period === label);
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{formatPeriodLabel(label)}</p>
          <div className="space-y-1">
            <p className="text-green-600">Doanh thu: {formatCurrency(payload[0].value)}</p>
            <p className="text-blue-600">Lợi nhuận: {formatCurrency(payload[1].value)}</p>
            {dataRow && (
              <>
                <p className="text-orange-600">Vốn: {formatCurrency(dataRow.costPrice || 0)}</p>
                <p className="text-red-600">Chi phí cố định: {formatCurrency(dataRow.fixedCost || 0)}</p>
                <p className="text-gray-600">Số đơn: {dataRow.bills}</p>
              </>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const PnlTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const row = pnlByPeriod.find((r) => r.period === label);
      if (!row) return null;
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg text-sm">
          <p className="font-semibold text-gray-900 mb-2">{formatPeriodLabel(label)}</p>
          <div className="space-y-1">
            <p className="text-green-600">Doanh thu: {formatCurrency(row.revenue)}</p>
            <p className="text-orange-600">- Vốn (đi chợ): {formatCurrency(row.cogsActual)}</p>
            <p className="text-amber-600">- OPEX biến đổi: {formatCurrency(row.opexVariable)}</p>
            <p className="text-indigo-600">- OPEX cố định: {formatCurrency(row.opexFixed)}</p>
            <p className="text-gray-600">- Khấu hao: {formatCurrency(row.depreciation)}</p>
            <hr className="my-1" />
            <p className="text-gray-700">Lợi nhuận gộp: {formatCurrency(row.grossProfit)}</p>
            <p className="text-purple-700">Lợi nhuận ròng: {formatCurrency(row.netOperatingProfit)}</p>
            <p className={row.netIncome >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
              Lợi nhuận thực: {formatCurrency(row.netIncome)}
            </p>
            {row.ownerDraw > 0 && (
              <>
                <p className="text-stone-700">- Rút vốn chủ (chợ nhà): {formatCurrency(row.ownerDraw)}</p>
                <p className={row.retainedProfit >= 0 ? 'text-teal-700 font-semibold' : 'text-red-700 font-semibold'}>
                  Lợi nhuận giữ lại: {formatCurrency(row.retainedProfit)}
                </p>
              </>
            )}
            {showTheoretical && (
              <>
                <hr className="my-1" />
                <p className="text-gray-500">Vốn lý thuyết: {formatCurrency(row.cogsTheoretical)}</p>
                <p className={row.costVariance > 0 ? 'text-red-600' : 'text-green-600'}>
                  Chênh lệch vốn: {formatCurrency(row.costVariance)}
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
              Phân tích doanh thu, vốn và lợi nhuận theo chuẩn nhà hàng.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            >
              <option value="day">Theo ngày</option>
              <option value="week">Theo tuần</option>
              <option value="month">Theo tháng</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-500">đến</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-6 border-b">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'pnl' ? (
        <PnLDashboard
          pnl={pnl}
          pnlByPeriod={pnlByPeriod}
          periodType={periodType}
          loading={loading}
          showTheoretical={showTheoretical}
          setShowTheoretical={setShowTheoretical}
          PnlTooltip={PnlTooltip}
          formatPeriodLabel={formatPeriodLabel}
        />
      ) : (
        <ClassicSection
          summary={summary}
          reportData={reportData}
          loading={loading}
          formatCurrency={formatCurrency}
          formatPeriodLabel={formatPeriodLabel}
          ClassicTooltip={ClassicTooltip}
        />
      )}
    </div>
  );
};

const PNL_PERIOD_LABEL = { day: 'ngày', week: 'tuần', month: 'tháng' };

const PnLDashboard = ({ pnl, pnlByPeriod, periodType, loading, showTheoretical, setShowTheoretical, PnlTooltip, formatPeriodLabel }) => {
  if (!pnl) return null;
  const totals = pnl.totals;
  const periodLabel = PNL_PERIOD_LABEL[periodType] || 'kỳ';

  const cogsByCategory = pnl.byCategory.filter((c) => c.kind === 'cogs');
  const opexByCategory = pnl.byCategory.filter((c) => c.kind === 'opex_variable' || c.kind === 'opex_fixed');
  const ownerDrawByCategory = pnl.byCategory.filter((c) => c.kind === 'owner_draw');
  const hasOwnerDraw = totals.ownerDraw > 0 || ownerDrawByCategory.length > 0;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <Kpi icon={<DollarSign className="text-green-600" size={20} />} bg="bg-green-100" label="Doanh thu" value={formatVND(totals.revenue)} sub={`${totals.bills} đơn`} />
        <Kpi icon={<ShoppingBag className="text-orange-600" size={20} />} bg="bg-orange-100" label="COGS thực (đi chợ)" value={formatVND(totals.cogsActual)} />
        <Kpi
          icon={<Scale className={totals.grossProfit >= 0 ? 'text-blue-600' : 'text-red-600'} size={20} />}
          bg={totals.grossProfit >= 0 ? 'bg-blue-100' : 'bg-red-100'}
          label="Lợi nhuận gộp"
          value={formatVND(totals.grossProfit)}
          sub={`Tỷ suất ${formatPercent(totals.grossMargin)}`}
          valueColor={totals.grossProfit >= 0 ? 'text-blue-700' : 'text-red-700'}
        />
        <Kpi icon={<Wallet className="text-amber-600" size={20} />} bg="bg-amber-100" label="OPEX (biến + cố định)" value={formatVND(totals.opexVariable + totals.opexFixed + totals.depreciation)} />
        <Kpi
          icon={<TrendingUp className={totals.netOperatingProfit >= 0 ? 'text-purple-600' : 'text-red-600'} size={20} />}
          bg={totals.netOperatingProfit >= 0 ? 'bg-purple-100' : 'bg-red-100'}
          label="Lợi nhuận ròng (EBT)"
          value={formatVND(totals.netOperatingProfit)}
          valueColor={totals.netOperatingProfit >= 0 ? 'text-purple-700' : 'text-red-700'}
        />
        <Kpi
          icon={<PiggyBank className={totals.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600'} size={20} />}
          bg={totals.netIncome >= 0 ? 'bg-emerald-100' : 'bg-red-100'}
          label="Lợi nhuận thực"
          value={formatVND(totals.netIncome)}
          sub={`Thuế: ${formatVND(totals.tax)}`}
          valueColor={totals.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}
        />
        <Kpi
          icon={<Coins className="text-stone-700" size={20} />}
          bg="bg-stone-100"
          label="Rút vốn chủ"
          value={formatVND(totals.ownerDraw)}
          sub="Chợ nhà / chi tiêu CN"
          valueColor="text-stone-800"
        />
        <Kpi
          icon={<Banknote className={totals.retainedProfit >= 0 ? 'text-teal-600' : 'text-red-600'} size={20} />}
          bg={totals.retainedProfit >= 0 ? 'bg-teal-100' : 'bg-red-100'}
          label="Lợi nhuận giữ lại"
          value={formatVND(totals.retainedProfit)}
          sub="Sau khi rút vốn"
          valueColor={totals.retainedProfit >= 0 ? 'text-teal-700' : 'text-red-700'}
        />
      </div>

      {/* Toggle */}
      <div className="bg-white rounded-lg shadow-sm border px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Kỳ {pnl.from} → {pnl.to} ({pnl.daysCount} ngày)
        </p>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showTheoretical}
            onChange={(e) => setShowTheoretical(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Hiển thị "Vốn lý thuyết theo menu" để so sánh
        </label>
      </div>

      {/* Stacked bar */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Cấu trúc P&L theo {periodLabel}</h2>
        {loading ? (
          <div className="h-80 animate-pulse bg-gray-100 rounded" />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pnlByPeriod}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={formatPeriodLabel} angle={-30} textAnchor="end" height={60} />
                <YAxis
                  tickFormatter={(v) =>
                    new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(v)
                  }
                />
                <Tooltip content={<PnlTooltip />} />
                <Legend />
                <Bar dataKey="cogsActual" stackId="cost" fill="#fb923c" name="Vốn đi chợ" />
                <Bar dataKey="opexVariable" stackId="cost" fill="#fbbf24" name="OPEX biến đổi" />
                <Bar dataKey="opexFixed" stackId="cost" fill="#6366f1" name="OPEX cố định" />
                <Bar dataKey="depreciation" stackId="cost" fill="#94a3b8" name="Khấu hao" />
                <Bar dataKey="netIncome" fill="#10b981" name="Lợi nhuận thực" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Lợi nhuận thực theo ngày (line) */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Xu hướng lợi nhuận thực theo {periodLabel}</h2>
        {loading ? (
          <div className="h-72 animate-pulse bg-gray-100 rounded" />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pnlByPeriod}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={formatPeriodLabel} angle={-30} textAnchor="end" height={60} />
                <YAxis
                  tickFormatter={(v) =>
                    new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(v)
                  }
                />
                <Tooltip content={<PnlTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="netIncome" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} name="Lợi nhuận thực" />
                <Line type="monotone" dataKey="grossProfit" stroke="#3b82f6" strokeWidth={2} dot={false} name="Lợi nhuận gộp" />
                <Line type="monotone" dataKey="cogsActual" stroke="#fb923c" strokeWidth={2} dot={false} name="Vốn đi chợ" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Bảng chi tiết */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Chi tiết theo {periodLabel}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Kỳ</Th>
                <Th align="right">Đơn</Th>
                <Th align="right">Doanh thu</Th>
                <Th align="right">Vốn (đi chợ)</Th>
                <Th align="right">OPEX biến đổi</Th>
                <Th align="right">OPEX cố định</Th>
                <Th align="right">Lợi nhuận gộp</Th>
                <Th align="right">% Gộp</Th>
                <Th align="right">Lợi nhuận ròng</Th>
                <Th align="right">Thuế</Th>
                <Th align="right">Lợi nhuận thực</Th>
                {hasOwnerDraw && (
                  <>
                    <Th align="right">Rút vốn</Th>
                    <Th align="right">Giữ lại</Th>
                  </>
                )}
                {showTheoretical && (
                  <>
                    <Th align="right">Vốn lý thuyết</Th>
                    <Th align="right">Chênh lệch</Th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pnlByPeriod.map((row) => (
                <tr key={row.period} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">{formatPeriodLabel(row.period)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-right">{row.bills}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-green-700">{formatVND(row.revenue)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-orange-700">{formatVND(row.cogsActual)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-amber-700">{formatVND(row.opexVariable)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-indigo-700">{formatVND(row.opexFixed + row.depreciation)}</td>
                  <td className={`px-4 py-2 whitespace-nowrap text-right font-medium ${row.grossProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {formatVND(row.grossProfit)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-gray-600">{formatPercent(row.grossMargin)}</td>
                  <td className={`px-4 py-2 whitespace-nowrap text-right ${row.netOperatingProfit >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                    {formatVND(row.netOperatingProfit)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-gray-600">{formatVND(row.tax)}</td>
                  <td className={`px-4 py-2 whitespace-nowrap text-right font-semibold ${row.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatVND(row.netIncome)}
                  </td>
                  {hasOwnerDraw && (
                    <>
                      <td className="px-4 py-2 whitespace-nowrap text-right text-stone-700">
                        {row.ownerDraw > 0 ? formatVND(row.ownerDraw) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className={`px-4 py-2 whitespace-nowrap text-right font-semibold ${row.retainedProfit >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                        {formatVND(row.retainedProfit)}
                      </td>
                    </>
                  )}
                  {showTheoretical && (
                    <>
                      <td className="px-4 py-2 whitespace-nowrap text-right text-gray-500">{formatVND(row.cogsTheoretical)}</td>
                      <td className={`px-4 py-2 whitespace-nowrap text-right ${row.costVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatVND(row.costVariance)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-2 text-sm font-bold text-gray-900">Tổng</td>
                <td className="px-4 py-2 text-right text-sm font-bold">{pnl.totals.bills}</td>
                <td className="px-4 py-2 text-right text-sm font-bold text-green-700">{formatVND(pnl.totals.revenue)}</td>
                <td className="px-4 py-2 text-right text-sm font-bold text-orange-700">{formatVND(pnl.totals.cogsActual)}</td>
                <td className="px-4 py-2 text-right text-sm font-bold text-amber-700">{formatVND(pnl.totals.opexVariable)}</td>
                <td className="px-4 py-2 text-right text-sm font-bold text-indigo-700">{formatVND(pnl.totals.opexFixed + pnl.totals.depreciation)}</td>
                <td className={`px-4 py-2 text-right text-sm font-bold ${pnl.totals.grossProfit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {formatVND(pnl.totals.grossProfit)}
                </td>
                <td className="px-4 py-2 text-right text-sm font-bold text-gray-600">{formatPercent(pnl.totals.grossMargin)}</td>
                <td className={`px-4 py-2 text-right text-sm font-bold ${pnl.totals.netOperatingProfit >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
                  {formatVND(pnl.totals.netOperatingProfit)}
                </td>
                <td className="px-4 py-2 text-right text-sm font-bold text-gray-600">{formatVND(pnl.totals.tax)}</td>
                <td className={`px-4 py-2 text-right text-sm font-bold ${pnl.totals.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatVND(pnl.totals.netIncome)}
                </td>
                {hasOwnerDraw && (
                  <>
                    <td className="px-4 py-2 text-right text-sm font-bold text-stone-700">{formatVND(pnl.totals.ownerDraw)}</td>
                    <td className={`px-4 py-2 text-right text-sm font-bold ${pnl.totals.retainedProfit >= 0 ? 'text-teal-700' : 'text-red-700'}`}>
                      {formatVND(pnl.totals.retainedProfit)}
                    </td>
                  </>
                )}
                {showTheoretical && (
                  <>
                    <td className="px-4 py-2 text-right text-sm font-bold text-gray-500">{formatVND(pnl.totals.cogsTheoretical)}</td>
                    <td className={`px-4 py-2 text-right text-sm font-bold ${pnl.totals.costVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatVND(pnl.totals.costVariance)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Phân bổ theo nhóm nguyên liệu */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdown title="Vốn đi chợ theo nhóm nguyên liệu" data={cogsByCategory} totalKey={pnl.totals.cogsActual} />
        <CategoryBreakdown title="Chi phí vận hành theo nhóm" data={opexByCategory} totalKey={pnl.totals.opexVariable + pnl.totals.opexFixed} />
      </div>

      {hasOwnerDraw && (
        <div className="bg-stone-50 rounded-lg shadow-sm border border-stone-200 p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-stone-200">
              <Coins className="text-stone-700" size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-stone-900">Rút vốn chủ (chợ nhà / chi tiêu cá nhân)</h2>
              <p className="text-sm text-stone-600 mt-0.5">
                Đây là phần chủ rút từ <strong>lợi nhuận thực</strong> để chi tiêu cá nhân, KHÔNG phải chi phí của quán.
                P&amp;L của quán đã loại khoản này để phản ánh đúng hiệu quả kinh doanh.
              </p>
            </div>
          </div>
          <CategoryBreakdown title="" data={ownerDrawByCategory} totalKey={pnl.totals.ownerDraw} />
        </div>
      )}
    </div>
  );
};

const CategoryBreakdown = ({ title, data, totalKey }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
        <p className="text-sm text-gray-400 italic">Chưa có dữ liệu trong kỳ này.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h2 className="font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="amount" nameKey="name" innerRadius={40} outerRadius={80}>
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [formatVND(v), n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {data.map((c) => {
            const pct = totalKey > 0 ? (c.amount / totalKey) * 100 : 0;
            return (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-gray-200"
                      style={{ backgroundColor: c.color || '#94a3b8' }}
                    />
                    <span className="font-medium text-gray-700">{c.name}</span>
                  </span>
                  <span className="text-gray-600">
                    {formatVND(c.amount)} <span className="text-gray-400">({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color || '#94a3b8' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ClassicSection = ({ summary, reportData, loading, formatCurrency, formatPeriodLabel, ClassicTooltip }) => (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <Kpi icon={<FileText className="text-blue-600" size={20} />} bg="bg-blue-100" label="Tổng đơn hàng" value={summary.totalBills} />
      <Kpi icon={<DollarSign className="text-green-600" size={20} />} bg="bg-green-100" label="Tổng doanh thu" value={formatCurrency(summary.totalRevenue)} valueColor="text-green-700" />
      <Kpi icon={<TrendingUp className="text-indigo-600" size={20} />} bg="bg-indigo-100" label="Tổng lợi nhuận (lý thuyết)" value={formatCurrency(summary.totalProfit)} valueColor="text-indigo-700" />
      <Kpi icon={<Package className="text-orange-600" size={20} />} bg="bg-orange-100" label="Tổng vốn (theo menu)" value={formatCurrency(summary.totalCostPrice)} valueColor="text-orange-700" />
      <Kpi icon={<Receipt className="text-red-600" size={20} />} bg="bg-red-100" label="Chi phí cố định (theo menu)" value={formatCurrency(summary.totalFixedCost)} valueColor="text-red-700" />
      <Kpi icon={<Calendar className="text-purple-600" size={20} />} bg="bg-purple-100" label="TB doanh thu/đơn" value={formatCurrency(summary.avgRevenuePerBill)} valueColor="text-purple-700" />
    </div>

    {loading ? (
      <div className="bg-white rounded-lg shadow-sm border p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    ) : (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Doanh thu và lợi nhuận</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={formatPeriodLabel} angle={-45} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(v)} />
                <Tooltip content={<ClassicTooltip />} />
                <Bar dataKey="revenue" fill="#10b981" name="Doanh thu" />
                <Bar dataKey="profit" fill="#6366f1" name="Lợi nhuận" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Xu hướng số lượng đơn hàng</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={formatPeriodLabel} angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip labelFormatter={formatPeriodLabel} formatter={(v) => [v, 'Số đơn hàng']} />
                <Line type="monotone" dataKey="bills" stroke="#f59e0b" strokeWidth={3} dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    )}

    {reportData.length > 0 && (
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Chi tiết dữ liệu</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Kỳ</Th>
                <Th>Số đơn</Th>
                <Th>Doanh thu</Th>
                <Th>Vốn (theo menu)</Th>
                <Th>Chi phí cố định (menu)</Th>
                <Th>Lợi nhuận</Th>
                <Th>TB doanh thu/đơn</Th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatPeriodLabel(row.period)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.bills}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{formatCurrency(row.revenue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 font-medium">{formatCurrency(row.costPrice || 0)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{formatCurrency(row.fixedCost || 0)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-medium">{formatCurrency(row.profit)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(row.bills > 0 ? row.revenue / row.bills : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </>
);

const Kpi = ({ icon, bg, label, value, sub, valueColor = 'text-gray-900' }) => (
  <div className="bg-white rounded-lg shadow-sm border p-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className={`text-lg font-bold truncate ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  </div>
);

const Th = ({ children, align = 'left' }) => (
  <th className={`px-4 py-3 text-${align} text-xs font-medium text-gray-500 uppercase tracking-wider`}>
    {children}
  </th>
);

// Liệt kê các tháng 'YYYY-MM' giao với khoảng [from,to]
const enumerateMonths = (from, to) => {
  if (!from || !to) return [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const stop = new Date(end.getFullYear(), end.getMonth(), 1);
  const out = [];
  while (cur <= stop) {
    out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
};

export default Reports;
