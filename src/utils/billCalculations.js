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
 * @returns {{ price: number, revenue: number, profit: number, cost: number, fixedCost: number, valid: boolean }}
 *   valid = false nếu không tìm được giá (nên cảnh báo UI)
 */
export const calculateOrderItemTotals = (orderItem, parentMenuItem, quantity) => {
  if (parentMenuItem) {
    return {
      price: parentMenuItem.price,
      revenue: calculateItemRevenue(parentMenuItem.price, quantity),
      profit: calculateItemProfit(parentMenuItem, quantity),
      cost: (parentMenuItem.costPrice || 0) * quantity,
      fixedCost: (parentMenuItem.fixedCost || 0) * quantity,
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
      cost: 0,
      fixedCost: 0,
      valid: true,
    };
  }

  // Không tính được giá
  return { price: 0, revenue: 0, profit: 0, cost: 0, fixedCost: 0, valid: false };
};

export const buildMenuItemBillSnapshot = (menuItem, quantity) => {
  const qty = quantity || 1;
  const price = Number(menuItem?.price || 0);
  const costPrice = Number(menuItem?.costPrice || 0);
  const fixedCost = Number(menuItem?.fixedCost || 0);
  const tax = Number(menuItem?.tax || 0);
  const revenue = price * qty;
  const cost = costPrice * qty;
  const fixedCostTotal = fixedCost * qty;
  const profit = revenue - cost - fixedCostTotal - revenue * (tax / 100);

  return {
    menuItemId: menuItem.id,
    name: menuItem.name || '',
    category: menuItem.category || '',
    quantity: qty,
    price,
    costPrice,
    fixedCost,
    tax,
    revenue,
    profit,
    cost,
    fixedCostTotal,
    snapshotVersion: 1,
  };
};

export const buildOrderItemBillSnapshot = (orderItem, parentMenuItem, quantity) => {
  const qty = quantity || 1;
  const totals = calculateOrderItemTotals(orderItem, parentMenuItem, qty);

  if (!totals.valid) {
    return {
      orderItemId: orderItem.id,
      name: orderItem.name || '',
      category: orderItem.category || '',
      quantity: qty,
    };
  }

  const source = parentMenuItem || orderItem || {};
  const price = Number(totals.price || 0);
  const costPrice = Number(parentMenuItem?.costPrice || 0);
  const fixedCost = Number(parentMenuItem?.fixedCost || 0);
  const tax = Number(parentMenuItem?.tax || 0);

  return {
    orderItemId: orderItem.id,
    ...(orderItem.parentMenuItemId ? { parentMenuItemId: orderItem.parentMenuItemId } : {}),
    name: orderItem.name || source.name || '',
    category: orderItem.category || source.category || '',
    quantity: qty,
    price,
    costPrice,
    fixedCost,
    tax,
    revenue: totals.revenue,
    profit: totals.profit,
    cost: totals.cost,
    fixedCostTotal: totals.fixedCost,
    snapshotVersion: 1,
  };
};

export const buildCustomBillSnapshot = ({ customItemId, customDescription, customAmount, quantity = 1 }) => {
  const qty = quantity || 1;
  const amount = Number(customAmount || 0);
  const revenue = amount * qty;

  return {
    customItemId,
    customDescription,
    name: customDescription || '',
    customAmount: amount,
    quantity: qty,
    price: amount,
    costPrice: 0,
    fixedCost: 0,
    tax: 0,
    revenue,
    profit: revenue,
    cost: 0,
    fixedCostTotal: 0,
    snapshotVersion: 1,
  };
};

export const recalculateBillLineSnapshotTotals = (item) => {
  if (item?.price == null) return item;

  const quantity = item.quantity || 1;
  const price = Number(item.price || 0);
  const costPrice = Number(item.costPrice || 0);
  const fixedCost = Number(item.fixedCost || 0);
  const tax = Number(item.tax || 0);
  const revenue = price * quantity;
  const cost = costPrice * quantity;
  const fixedCostTotal = fixedCost * quantity;
  const profit = revenue - cost - fixedCostTotal - revenue * (tax / 100);

  return {
    ...item,
    revenue,
    profit,
    cost,
    fixedCostTotal,
  };
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
