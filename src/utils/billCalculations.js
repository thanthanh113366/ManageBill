/**
 * Tính doanh thu của một item
 * @param {number} price
 * @param {number} quantity
 * @returns {number}
 */
export const calculateItemRevenue = (price, quantity) => {
  return price * quantity;
};

/**
 * Tính lợi nhuận của một item từ menuItem cha
 * @param {object} menuItem - { price, costPrice, fixedCost, tax }
 * @param {number} quantity
 * @returns {number}
 */
export const calculateItemProfit = (menuItem, quantity) => {
  const profitPerUnit =
    menuItem.price -
    (menuItem.costPrice || 0) -
    (menuItem.fixedCost || 0) -
    (menuItem.price * (menuItem.tax || 0)) / 100;
  return profitPerUnit * quantity;
};

/**
 * Tính đầy đủ revenue + profit + price cho một orderItem.
 * Ưu tiên dùng parentMenuItem; fallback sang orderItem.price (standalone).
 *
 * @param {object} orderItem  - document từ Firestore orderItems
 * @param {object|null} parentMenuItem - document từ Firestore menuItems (nullable)
 * @param {number} quantity
 * @returns {{ price: number, revenue: number, profit: number, valid: boolean }}
 *   valid = false nếu không tìm được giá (nên cảnh báo UI)
 */
export const calculateOrderItemTotals = (orderItem, parentMenuItem, quantity) => {
  if (parentMenuItem) {
    return {
      price: parentMenuItem.price,
      revenue: calculateItemRevenue(parentMenuItem.price, quantity),
      profit: calculateItemProfit(parentMenuItem, quantity),
      valid: true,
    };
  }

  // Standalone: dùng orderItem.price nếu được lưu trong Firestore
  const standalonePrice = orderItem?.price;
  if (standalonePrice != null && standalonePrice >= 0) {
    return {
      price: standalonePrice,
      revenue: calculateItemRevenue(standalonePrice, quantity),
      profit: calculateItemRevenue(standalonePrice, quantity), // không có cost
      valid: true,
    };
  }

  // Không tính được giá
  return { price: 0, revenue: 0, profit: 0, valid: false };
};

/**
 * Tính tổng doanh thu + lợi nhuận từ một mảng items đã có { revenue, profit }
 * @param {Array<{ revenue: number, profit: number }>} items
 * @returns {{ totalRevenue: number, totalProfit: number }}
 */
export const sumTotals = (items) => {
  return items.reduce(
    (acc, item) => ({
      totalRevenue: acc.totalRevenue + (item.revenue || 0),
      totalProfit: acc.totalProfit + (item.profit || 0),
    }),
    { totalRevenue: 0, totalProfit: 0 }
  );
};
