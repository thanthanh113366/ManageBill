/**
 * Helper functions for Dish Analysis
 * Tính toán metrics, trend, và grouping cho báo cáo món ăn
 */

/**
 * Calculate dish statistics from bills
 * @param {Array} bills - Array of bill documents
 * @param {Array} menuItems - Array of menu items
 * @param {Object} dateRange - Date range filter (startDate, endDate)
 * @returns {Array} Array of dish statistics
 */
export const calculateDishStats = (bills, menuItems, dateRange = null) => {
  // Filter bills by date range if provided
  let filteredBills = bills;
  if (dateRange && dateRange.startDate && dateRange.endDate) {
    filteredBills = bills.filter(bill => 
      bill.date >= dateRange.startDate && bill.date <= dateRange.endDate
    );
  }

  // Create a map to aggregate stats for each dish
  const dishStatsMap = new Map();

  // Calculate total revenue for percentage calculation
  let totalRevenue = 0;

  // Process each bill
  filteredBills.forEach(bill => {
    totalRevenue += bill.totalRevenue || 0;

    // Process each item in the bill
    bill.items.forEach(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      if (!menuItem) return; // Skip if menu item not found

      const quantity = item.quantity || 0;
      const revenue = menuItem.price * quantity;
      const costPrice = menuItem.costPrice * quantity;
      const fixedCost = menuItem.fixedCost * quantity;
      const tax = (menuItem.price * menuItem.tax / 100) * quantity;
      const profit = revenue - costPrice - fixedCost - tax;

      // Get or create stats for this dish
      if (!dishStatsMap.has(item.menuItemId)) {
        dishStatsMap.set(item.menuItemId, {
          dishId: item.menuItemId,
          name: menuItem.name,
          category: menuItem.category,
          price: menuItem.price,
          totalQuantity: 0,
          billCount: 0,
          billIds: new Set(), // Track unique bills
          totalRevenue: 0,
          totalProfit: 0,
        });
      }

      const stats = dishStatsMap.get(item.menuItemId);
      stats.totalQuantity += quantity;
      stats.billIds.add(bill.id); // Track unique bill
      stats.totalRevenue += revenue;
      stats.totalProfit += profit;
    });
  });

  // Convert map to array and calculate derived metrics
  const dishStats = Array.from(dishStatsMap.values()).map(stats => {
    stats.billCount = stats.billIds.size;
    delete stats.billIds; // Remove the Set, not needed in final output

    // Average per order
    stats.avgPerOrder = stats.billCount > 0 
      ? parseFloat((stats.totalQuantity / stats.billCount).toFixed(2))
      : 0;

    // Revenue percentage
    stats.revenuePercent = totalRevenue > 0
      ? parseFloat((stats.totalRevenue / totalRevenue * 100).toFixed(2))
      : 0;

    // Profit margin percentage
    stats.profitPercent = stats.totalRevenue > 0
      ? parseFloat((stats.totalProfit / stats.totalRevenue * 100).toFixed(2))
      : 0;

    return stats;
  });

  // Calculate average quantity across all dishes for comparison
  const totalDishQuantity = dishStats.reduce((sum, dish) => sum + dish.totalQuantity, 0);
  const avgQuantityAll = dishStats.length > 0 
    ? totalDishQuantity / dishStats.length 
    : 0;

  // Add average vs all metric
  dishStats.forEach(stats => {
    stats.avgVsAll = avgQuantityAll > 0
      ? parseFloat((stats.totalQuantity / avgQuantityAll).toFixed(2))
      : 0;
  });

  return dishStats;
};

/**
 * Calculate trend by comparing with previous period
 * @param {Array} currentStats - Current period statistics
 * @param {Array} previousStats - Previous period statistics
 * @returns {Array} Statistics with trend information
 */
export const calculateTrend = (currentStats, previousStats) => {
  return currentStats.map(current => {
    const previous = previousStats.find(p => p.dishId === current.dishId);
    
    if (!previous || previous.totalQuantity === 0) {
      return {
        ...current,
        trend: 'new', // New dish or no previous data
        trendPercent: 0,
        previousQuantity: 0
      };
    }

    const change = current.totalQuantity - previous.totalQuantity;
    const changePercent = parseFloat(((change / previous.totalQuantity) * 100).toFixed(1));

    let trend = 'stable';
    if (changePercent > 10) {
      trend = 'up';
    } else if (changePercent < -10) {
      trend = 'down';
    }

    return {
      ...current,
      trend,
      trendPercent: changePercent,
      previousQuantity: previous.totalQuantity
    };
  });
};

/**
 * Group dishes by category type
 * @param {Array} dishes - Array of dish statistics
 * @returns {Object} Object with two arrays: drinks and food
 */
export const groupByCategory = (dishes) => {
  const drinks = dishes.filter(dish => dish.category === 'giai_khat');
  const food = dishes.filter(dish => dish.category !== 'giai_khat');

  return { drinks, food };
};

/**
 * Get previous period date range based on current range and period type
 * @param {Object} dateRange - Current date range {startDate, endDate}
 * @param {string} periodType - Type of period: 'day', 'week', 'month', 'all'
 * @returns {Object} Previous period date range
 */
export const getPreviousPeriod = (dateRange, periodType) => {
  if (periodType === 'all' || !dateRange || !dateRange.startDate || !dateRange.endDate) {
    return null;
  }

  const start = new Date(dateRange.startDate);
  const end = new Date(dateRange.endDate);
  const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1; // Days inclusive

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - duration + 1);

  return {
    startDate: prevStart.toISOString().split('T')[0],
    endDate: prevEnd.toISOString().split('T')[0]
  };
};

/**
 * Sort dishes by specified field and direction
 * @param {Array} dishes - Array of dish statistics
 * @param {string} sortBy - Field to sort by
 * @param {string} sortDirection - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
export const sortDishes = (dishes, sortBy, sortDirection = 'desc') => {
  return [...dishes].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle string comparison (e.g., name)
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
};

/**
 * Format currency in VND
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
};

/**
 * Get trend icon based on trend type
 * @param {string} trend - Trend type: 'up', 'down', 'stable', 'new'
 * @returns {string} Emoji or symbol for trend
 */
export const getTrendIcon = (trend) => {
  switch (trend) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'stable':
      return '→';
    case 'new':
      return '✨';
    default:
      return '→';
  }
};

/**
 * Get trend color class based on trend type
 * @param {string} trend - Trend type
 * @returns {string} Tailwind color class
 */
export const getTrendColor = (trend) => {
  switch (trend) {
    case 'up':
      return 'text-green-600';
    case 'down':
      return 'text-red-600';
    case 'stable':
      return 'text-gray-600';
    case 'new':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
};

