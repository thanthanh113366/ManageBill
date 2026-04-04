/**
 * Gắn một dòng bill.items với document menuItems (cùng thứ tự với BillManagement getTotalSummary).
 *
 * @param {object} item - Phần tử trong bill.items
 * @param {Array<{ id: string, costPrice?: number, fixedCost?: number }>} menuItems
 * @param {Array<{ id: string, parentMenuItemId?: string }>} orderItems
 * @returns {object|null} menuItem khớp hoặc null
 */
export const resolveMenuItemForBillLine = (item, menuItems, orderItems) => {
  let menuItem = null;
  if (item.menuItemId) {
    menuItem = menuItems.find((m) => m.id === item.menuItemId);
  } else if (item.orderItemId) {
    const oi = orderItems.find((o) => o.id === item.orderItemId);
    if (oi?.parentMenuItemId) {
      menuItem = menuItems.find((m) => m.id === oi.parentMenuItemId);
    }
  }
  return menuItem ?? null;
};

/**
 * Tổng vốn + chi phí cố định từ items × menu hiện tại (fallback).
 *
 * @param {{ items?: Array<{ menuItemId?: string, orderItemId?: string, quantity?: number }> }} bill
 */
export const computeBillCostTotalsFromItems = (bill, menuItems, orderItems) => {
  let costPrice = 0;
  let fixedCost = 0;
  if (!bill.items?.length) return { costPrice, fixedCost };

  bill.items.forEach((item) => {
    const menuItem = resolveMenuItemForBillLine(item, menuItems, orderItems);
    if (menuItem) {
      costPrice += (menuItem.costPrice || 0) * (item.quantity || 0);
      fixedCost += (menuItem.fixedCost || 0) * (item.quantity || 0);
    }
  });
  return { costPrice, fixedCost };
};

const hasCompleteStoredCostTotals = (bill) => {
  const c = bill.totalCost;
  const f = bill.totalFixedCost;
  if (c === undefined || c === null || f === undefined || f === null) return false;
  const cn = Number(c);
  const fn = Number(f);
  return Number.isFinite(cn) && Number.isFinite(fn);
};

/**
 * Báo cáo / tổng hợp: ưu tiên totalCost + totalFixedCost trên bill khi đủ cả hai;
 * nếu thiếu một trong hai thì tính lại toàn bill từ items (giống BillManagement).
 */
export const getBillCostTotalsForReport = (bill, menuItems, orderItems) => {
  if (hasCompleteStoredCostTotals(bill)) {
    return {
      costPrice: Number(bill.totalCost),
      fixedCost: Number(bill.totalFixedCost),
    };
  }
  return computeBillCostTotalsFromItems(bill, menuItems, orderItems);
};
