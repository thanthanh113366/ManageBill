import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { 
  UtensilsCrossed, 
  TrendingUp, 
  DollarSign, 
  Award,
  Package,
  GlassWater
} from 'lucide-react';
import DishStatsCard from '../components/DishStatsCard';
import DishBarChart from '../components/DishBarChart';
import DishTable from '../components/DishTable';
import {
  calculateDishStats,
  calculateTrend,
  groupByCategory,
  getPreviousPeriod,
  formatCurrency
} from '../utils/dishAnalysis';

const DishAnalysis = () => {
  const { menuItems, orderItems } = useApp();
  const [loading, setLoading] = useState(false);
  const [periodType, setPeriodType] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dishStats, setDishStats] = useState([]);
  const [foodStats, setFoodStats] = useState([]);
  const [drinkStats, setDrinkStats] = useState([]);

  // Initialize default dates
  useEffect(() => {
    const today = new Date();
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    setStartDate(oneMonthAgo.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  // Load data when filters change
  useEffect(() => {
    if (menuItems.length > 0 || orderItems.length > 0) {
      loadDishAnalysis();
    }
  }, [startDate, endDate, periodType, menuItems]);

  const loadDishAnalysis = async () => {
    setLoading(true);
    
    try {
      // Build query based on period type
      let q;
      if (periodType === 'all') {
        // Get all bills
        q = query(collection(db, 'bills'), orderBy('date', 'asc'));
      } else {
        // Get bills in date range
        q = query(
          collection(db, 'bills'),
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc')
        );
      }

      const snapshot = await getDocs(q);
      const bills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Calculate current period stats
      const dateRange = periodType === 'all' ? null : { startDate, endDate };
      let currentStats = calculateDishStats(bills, menuItems, dateRange, orderItems);

      // Calculate trend if not "all" period
      if (periodType !== 'all' && startDate && endDate) {
        const previousPeriod = getPreviousPeriod({ startDate, endDate }, periodType);
        
        if (previousPeriod) {
          // Get previous period bills
          const prevQuery = query(
            collection(db, 'bills'),
            where('date', '>=', previousPeriod.startDate),
            where('date', '<=', previousPeriod.endDate),
            orderBy('date', 'asc')
          );
          
          const prevSnapshot = await getDocs(prevQuery);
          const prevBills = prevSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          const previousStats = calculateDishStats(prevBills, menuItems, previousPeriod, orderItems);
          currentStats = calculateTrend(currentStats, previousStats);
        }
      }

      // Sort by total quantity descending
      currentStats.sort((a, b) => b.totalQuantity - a.totalQuantity);

      setDishStats(currentStats);

      // Group by category
      const { food, drinks } = groupByCategory(currentStats);
      setFoodStats(food);
      setDrinkStats(drinks);

    } catch (error) {
      console.error('Error loading dish analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary metrics
  const summary = {
    totalDishes: dishStats.length,
    totalQuantity: dishStats.reduce((sum, dish) => sum + dish.totalQuantity, 0),
    totalRevenue: dishStats.reduce((sum, dish) => sum + dish.totalRevenue, 0),
    totalProfit: dishStats.reduce((sum, dish) => sum + dish.totalProfit, 0),
    avgQuantityPerDish: dishStats.length > 0 
      ? Math.round(dishStats.reduce((sum, dish) => sum + dish.totalQuantity, 0) / dishStats.length)
      : 0,
    topDish: dishStats.length > 0 ? dishStats[0] : null
  };

  const handlePeriodChange = (e) => {
    const newPeriod = e.target.value;
    setPeriodType(newPeriod);
    
    if (newPeriod !== 'all') {
      const today = new Date();
      let start;
      
      switch (newPeriod) {
        case 'week':
          start = new Date(today);
          start.setDate(start.getDate() - 7);
          break;
        case 'month':
          start = new Date(today);
          start.setMonth(start.getMonth() - 1);
          break;
        case 'quarter':
          start = new Date(today);
          start.setMonth(start.getMonth() - 3);
          break;
        default:
          start = new Date(today);
          start.setMonth(start.getMonth() - 1);
      }
      
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 Tổng kết món ăn</h1>
            <p className="text-gray-600 mt-1">
              Phân tích số lượng và xu hướng món ăn được gọi nhiều nhất
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={periodType}
              onChange={handlePeriodChange}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="all">Toàn bộ</option>
              <option value="week">7 ngày qua</option>
              <option value="month">30 ngày qua</option>
              <option value="quarter">3 tháng qua</option>
              <option value="custom">Tùy chọn</option>
            </select>
            
            {(periodType === 'custom' || (periodType !== 'all' && startDate && endDate)) && (
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={periodType !== 'custom'}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
                />
                <span className="text-gray-500">đến</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={periodType !== 'custom'}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <DishStatsCard
          icon={UtensilsCrossed}
          label="Tổng số món"
          value={summary.totalDishes}
          color="blue"
        />
        <DishStatsCard
          icon={Package}
          label="Tổng SL đã bán"
          value={summary.totalQuantity}
          color="purple"
        />
        <DishStatsCard
          icon={TrendingUp}
          label="TB SL/món"
          value={summary.avgQuantityPerDish}
          color="orange"
        />
        <DishStatsCard
          icon={Award}
          label="Món bán chạy nhất"
          value={summary.topDish ? summary.topDish.name.substring(0, 15) : '-'}
          subValue={summary.topDish ? `${summary.topDish.totalQuantity} phần` : null}
          color="indigo"
        />
        <DishStatsCard
          icon={DollarSign}
          label="Tổng doanh thu"
          value={formatCurrency(summary.totalRevenue)}
          color="green"
        />
        <DishStatsCard
          icon={TrendingUp}
          label="Tổng lợi nhuận"
          value={formatCurrency(summary.totalProfit)}
          color="indigo"
        />
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      ) : (
        <>
          {/* Food Section */}
          {foodStats.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-6 h-6 text-orange-600" />
                <h2 className="text-xl font-bold text-gray-900">🍽️ Thức ăn</h2>
                <span className="text-sm text-gray-500">
                  ({foodStats.length} món)
                </span>
              </div>
              
              <DishBarChart 
                data={foodStats} 
                title="Top 10 Món Ăn Bán Chạy"
              />
              
              <DishTable 
                dishes={foodStats}
                title="Chi tiết món ăn"
              />
            </div>
          )}

          {/* Drinks Section */}
          {drinkStats.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <GlassWater className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-900">🥤 Giải khát</h2>
                <span className="text-sm text-gray-500">
                  ({drinkStats.length} món)
                </span>
              </div>
              
              <DishBarChart 
                data={drinkStats} 
                title="Top 10 Đồ Uống Bán Chạy"
              />
              
              <DishTable 
                dishes={drinkStats}
                title="Chi tiết đồ uống"
              />
            </div>
          )}

          {/* No Data State */}
          {dishStats.length === 0 && !loading && (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <UtensilsCrossed className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Chưa có dữ liệu
              </h3>
              <p className="text-gray-600">
                Chưa có đơn hàng nào trong khoảng thời gian đã chọn
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DishAnalysis;

