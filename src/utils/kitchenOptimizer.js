/**
 * Kitchen optimization utilities.
 * Builds a per-portion queue and sorts unfinished items by practical cooking priority.
 */

const SPEED_ESTIMATES = {
  fast: 2,
  medium: 5,
  slow: 10,
};

const DEFAULT_ESTIMATED_TIME = 5;

const getTimestamp = (value) => {
  if (!value) return 0;
  const date = value?.toDate?.() || new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

const getWaitingMinutes = (createdAt, currentTime) => {
  const created = getTimestamp(createdAt);
  if (!created) return 0;
  return Math.max(0, (currentTime.getTime() - created) / 60000);
};

const getPriority = (value) => {
  const priority = Number(value ?? 1);
  if (!Number.isFinite(priority)) return 1;
  return Math.min(4, Math.max(1, priority));
};

const isDone = (item) => item.isCompleted || item.kitchenStatus === 'ready';

export const calculateEstimatedTime = (item = {}, timing = {}) => {
  const explicitTime = Number(timing?.estimatedTime ?? item?.estimatedTime);
  if (Number.isFinite(explicitTime) && explicitTime > 0) {
    return explicitTime * (item.quantity || 1);
  }

  const baseTime = SPEED_ESTIMATES[timing?.speed] || SPEED_ESTIMATES.medium;
  return baseTime * (item.quantity || 1);
};


const getKitchenType = (sourceItem, fallback = {}) => {
  return sourceItem?.kitchenType || fallback.kitchenType || 'cook';
};

const buildTiming = (sourceItem, fallback = {}) => ({
  speed: sourceItem?.speed || fallback.speed || 'medium',
  kitchenType: getKitchenType(sourceItem, fallback),
  priority: getPriority(sourceItem?.priority ?? fallback.priority ?? 1),
  estimatedTime: sourceItem?.estimatedTime ?? fallback.estimatedTime ?? DEFAULT_ESTIMATED_TIME,
});

const buildEntry = ({ bill, item, timing, name, createdAt, batchOrder, batchTotal, isCompleted, isAdded }) => {
  const estimatedTime = calculateEstimatedTime({ ...item, quantity: 1 }, timing);
  const kitchenStatus = isCompleted ? 'ready' : 'cooking';

  const entry = {
    ...item,
    billId: bill.id,
    tableNumber: bill.tableNumber,
    takeawayNumber: bill.takeawayNumber,
    isTakeaway: Boolean(bill.isTakeaway),
    billOrder: bill.billOrder || 999,
    createdAt,
    timing,
    kitchenStatus,
    name,
    quantity: 1,
    batchOrder,
    batchTotal,
    originalQuantity: batchTotal,
    isAdded,
    estimatedTime,
    isCompleted,
  };

  return {
    ...entry,
  };
};

export const calculateKitchenQueue = (bills, orderItems = [], menuItems = []) => {
  const orderItemsMap = new Map(orderItems.map((item) => [item.id, item]));
  const menuItemsMap = new Map(menuItems.map((item) => [item.id, item]));

  const allItems = bills
    .filter((bill) => bill.status !== 'paid')
    .flatMap((bill) => {
      try {
        return (bill.items || [])
          .filter(Boolean)
          .flatMap((item) => {
            const quantity = item.quantity || 1;
            const completedCount = item.completedCount || 0;
            const remainingQuantity = Math.max(0, quantity - completedCount);
            const createdAt = item.addedAt ? new Date(item.addedAt) : bill.createdAt;
            const isAdded = Boolean(item.addedAt);

            const orderItem = item.orderItemId ? orderItemsMap.get(item.orderItemId) : null;
            const menuItem = item.menuItemId ? menuItemsMap.get(item.menuItemId) : null;
            const sourceItem = orderItem || menuItem;
            const itemId = item.orderItemId || item.menuItemId || item.customItemId || 'unknown';
            const name = item.customDescription || sourceItem?.name || item.name || `Mon ID: ${itemId}`;
            const timing = buildTiming(sourceItem, {
              speed: item.speed,
              kitchenType: item.kitchenType,
              category: item.category,
              priority: item.customDescription ? 1 : item.priority,
              estimatedTime: item.estimatedTime || (item.customDescription ? DEFAULT_ESTIMATED_TIME : undefined),
            });

            const completedEntries = Array.from({ length: completedCount }, (_, index) =>
              buildEntry({
                bill,
                item,
                timing,
                name,
                createdAt,
                batchOrder: index + 1,
                batchTotal: quantity,
                isCompleted: true,
                isAdded,
              })
            );

            const pendingEntries = Array.from({ length: remainingQuantity }, (_, index) =>
              buildEntry({
                bill,
                item,
                timing,
                name,
                createdAt,
                batchOrder: completedCount + index + 1,
                batchTotal: quantity,
                isCompleted: false,
                isAdded,
              })
            );

            return [...completedEntries, ...pendingEntries];
          });
      } catch (error) {
        console.error('Error processing bill items:', error);
        return [];
      }
    });

  return allItems.sort((a, b) => {
    const aDone = isDone(a);
    const bDone = isDone(b);
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;

    return getTimestamp(a.createdAt) - getTimestamp(b.createdAt);
  });
};

export const filterByTable = (items, tableNumber) => {
  if (!tableNumber) return items;
  return items.filter((item) => item.tableNumber === tableNumber);
};

export const groupByStatus = (items) => {
  return items.reduce((groups, item) => {
    const status = item.kitchenStatus || 'pending';
    if (!groups[status]) groups[status] = [];
    groups[status].push(item);
    return groups;
  }, {});
};

export const calculateKitchenStats = (items) => {
  const grouped = groupByStatus(items);
  const pendingItems = items.filter((item) => !isDone(item));

  return {
    total: items.length,
    pending: pendingItems.length,
    cooking: grouped.cooking?.length || 0,
    ready: grouped.ready?.length || 0,
    avgWaitingTime: calculateAvgWaitingTime(pendingItems),
  };
};

export const calculateAvgWaitingTime = (items) => {
  if (items.length === 0) return 0;

  const currentTime = new Date();
  const totalWaitingTime = items.reduce((sum, item) => {
    return sum + getWaitingMinutes(item.createdAt, currentTime);
  }, 0);

  return Math.round(totalWaitingTime / items.length);
};

export const formatTime = (minutes) => {
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}p`;
};

export const formatEstimatedCompletion = (startTime, estimatedMinutes) => {
  const completionTime = new Date(startTime.getTime() + estimatedMinutes * 60000);
  return completionTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};
