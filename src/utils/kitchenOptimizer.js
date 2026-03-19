/**
 * Kitchen Optimization Utilities
 * Thuật toán tối ưu hóa thứ tự làm món cho bếp
 * Sử dụng speed (fast/medium/slow) để tính thời gian dự kiến
 */

/**
 * Tính điểm ưu tiên cho một món ăn
 * @param {Object} item - Món ăn với thông tin bill và timing
 * @param {Date} currentTime - Thời gian hiện tại
 * @returns {number} - Điểm ưu tiên (cao hơn = ưu tiên hơn)
 */
export const calculateScore = (item, currentTime) => {
  const baseScore = 1000;

  // Thời gian chờ tính từ lúc bill được tạo (phút)
  const billTime = item.createdAt?.toDate?.() || new Date(item.createdAt);
  const waitingMinutes = (currentTime - billTime) / 1000 / 60;

  // Trọng số
  const waitingWeight = 50;   // Chờ lâu → ưu tiên cao
  const quantityWeight = 2;   // Nhiều phần → ưu tiên nhẹ hơn
  const priorityWeight = 50;  // Priority của món (1=cao nhất)

  const score = baseScore
    - (waitingMinutes * waitingWeight)
    + (item.quantity * quantityWeight)
    + ((4 - item.priority) * priorityWeight);

  return Math.max(score, 1);
};

/**
 * Tính thời gian dự kiến hoàn thành dựa trên speed
 * @param {Object} item - Món ăn
 * @param {Object} timing - Thông tin timing của món
 * @returns {number} - Thời gian dự kiến (phút)
 */
export const calculateEstimatedTime = (item, timing) => {
  const quantity = item.quantity || 1;
  
  // Thời gian cơ bản dựa trên speed
  const speedTiming = {
    'fast': 2,     // Nhanh: 2 phút
    'medium': 5,   // Vừa: 5 phút
    'slow': 10     // Chậm: 10 phút
  };
  
  const baseTime = speedTiming[timing?.speed] || speedTiming['medium']; // Mặc định vừa (5p)
  
  // Thời gian làm = thời gian cơ bản * số lượng
  return baseTime * quantity;
};

/**
 * Sắp xếp danh sách món theo thứ tự tối ưu
 * 
 * TIMING PRIORITY (đã sửa):
 * 1. menuItemTimings (PRIMARY) - có thể được admin customize
 * 2. orderItems (FALLBACK) - timing mặc định từ migration
 * 
 * @param {Array} bills - Danh sách bills
 * @param {Array} menuTimings - Danh sách timing của menu items (PRIMARY SOURCE)
 * @param {Array} orderItems - Danh sách order items (FALLBACK SOURCE)
 * @returns {Array} - Danh sách món đã sắp xếp theo ưu tiên
 */
export const calculateKitchenQueue = (bills, menuTimings = [], orderItems = []) => {
  const currentTime = new Date();

  // Map timing từ menuItemTimings (nguồn chính, do admin customize) — chỉ dùng orderItemId
  const timingMap = new Map();
  menuTimings.forEach(timing => {
    if (timing.orderItemId) timingMap.set(timing.orderItemId, timing);
  });
  
  // Map orderItems để lookup nhanh theo ID
  const orderItemsMap = new Map();
  orderItems.forEach(item => {
    orderItemsMap.set(item.id, item);
  });
  
  // Flatten tất cả items từ bills và thêm thông tin cần thiết
  const allItems = bills
    .filter(bill => bill.status !== 'paid') // Ẩn đơn đã thanh toán
    .flatMap(bill => {
      try {
        return bill.items
          .filter(item => Boolean(item)) // bỏ qua item null/undefined
          .flatMap(item => {
          // Tìm orderItem theo orderItemId
          const orderItem = orderItemsMap.get(item.orderItemId);

          // Tìm timing: ưu tiên menuItemTimings (admin customize), fallback sang orderItem
          const menuTiming = timingMap.get(item.orderItemId);
          const timing = menuTiming
            ? {
                speed: menuTiming.speed || 'medium',
                kitchenType: menuTiming.kitchenType || 'cook',
                priority: menuTiming.priority || 1,
              }
            : orderItem
            ? {
                speed: orderItem.speed || 'medium',
                kitchenType: orderItem.kitchenType || 'cook',
                priority: orderItem.priority || 1,
              }
            : null;
          
          const quantity = item.quantity || 1;
          const completedCount = item.completedCount || 0;
          
          const remainingQuantity = Math.max(0, quantity - completedCount);
          const result = [];
          const isAdded = !!item.addedAt;
          const itemCreatedAt = item.addedAt ? new Date(item.addedAt) : bill.createdAt;
          const itemName = orderItem?.name || item.name || `Món ID: ${item.orderItemId}`;

          // Thêm món đã hoàn thành (hiển thị với status "ready")
          for (let i = 0; i < completedCount; i++) {
            
            result.push({
              ...item,
              billId: bill.id,
              tableNumber: bill.tableNumber,
              billOrder: bill.billOrder || 999,
              createdAt: itemCreatedAt,
              timing: timing,
              kitchenStatus: 'ready',
              name: itemName,
              quantity: 1,
              batchOrder: i + 1,
              batchTotal: quantity,
              originalQuantity: quantity,
              isAdded,
              score: calculateScore({
                ...item,
                billOrder: bill.billOrder || 999,
                createdAt: itemCreatedAt,
                priority: timing?.priority || 1,
                quantity: 1
              }, currentTime),
              estimatedTime: calculateEstimatedTime({ ...item, quantity: 1 }, timing),
              isCompleted: true
            });
          }
          
          // Thêm món chưa hoàn thành (hiển thị với status "cooking")
          for (let i = 0; i < remainingQuantity; i++) {
            
            result.push({
              ...item,
              billId: bill.id,
              tableNumber: bill.tableNumber,
              billOrder: bill.billOrder || 999,
              createdAt: itemCreatedAt,
              timing: timing,
              kitchenStatus: 'cooking', // luôn là cooking — không kế thừa trạng thái cũ khi món được thêm sau
              name: itemName,
              quantity: 1,
              batchOrder: completedCount + i + 1,
              batchTotal: quantity,
              originalQuantity: quantity,
              isAdded,
              score: calculateScore({
                ...item,
                billOrder: bill.billOrder || 999,
                createdAt: itemCreatedAt,
                priority: timing?.priority || 1,
                quantity: 1
              }, currentTime),
              estimatedTime: calculateEstimatedTime({ ...item, quantity: 1 }, timing),
              isCompleted: false
            });
          }
          
          return result;
          });
      } catch (error) {
        console.error('Error processing bill items:', error);
        return [];
      }
    });
  
  // Sắp xếp theo thứ tự ưu tiên:
  // 1. Món chưa xong lên đầu
  // 2. Score cao hơn (ưu tiên theo thời gian chờ, priority)
  // 3. Món nhanh hơn (thời gian ngắn hơn)
  // 4. Bill đặt trước (FIFO)
  return allItems.sort((a, b) => {
    // Món chưa xong (cooking/pending) lên đầu
    const aIsCompleted = a.isCompleted || a.kitchenStatus === 'ready';
    const bIsCompleted = b.isCompleted || b.kitchenStatus === 'ready';
    
    // Nếu một món đã xong và một món chưa xong
    if (aIsCompleted && !bIsCompleted) return 1;  // a xuống cuối
    if (!aIsCompleted && bIsCompleted) return -1; // b xuống cuối
    
    // Nếu cùng trạng thái (cùng xong hoặc cùng chưa xong)
    // Sắp xếp theo score (cao → thấp)
    const scoreDiff = Math.abs(a.score - b.score);
    if (scoreDiff > 10) {
      return b.score - a.score;
    }
    
    // Nếu score gần nhau, ưu tiên món nhanh hơn (thời gian ngắn hơn)
    const timeDiff = Math.abs(a.estimatedTime - b.estimatedTime);
    if (timeDiff > 1) { // Nếu chênh lệch thời gian > 1 phút
      return a.estimatedTime - b.estimatedTime; // Món nhanh hơn lên đầu
    }
    
    // Nếu thời gian gần nhau, sắp xếp theo thời gian tạo bill (cũ hơn lên đầu)
    const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
    const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
    return aTime - bTime;
  });
};

/**
 * Lọc món theo bàn
 * @param {Array} items - Danh sách món
 * @param {number|null} tableNumber - Số bàn (null = tất cả)
 * @returns {Array} - Danh sách món đã lọc
 */
export const filterByTable = (items, tableNumber) => {
  if (!tableNumber) return items;
  return items.filter(item => item.tableNumber === tableNumber);
};

/**
 * Nhóm món theo trạng thái
 * @param {Array} items - Danh sách món
 * @returns {Object} - Object với các nhóm trạng thái
 */
export const groupByStatus = (items) => {
  return items.reduce((groups, item) => {
    const status = item.kitchenStatus || 'pending';
    if (!groups[status]) {
      groups[status] = [];
    }
    groups[status].push(item);
    return groups;
  }, {});
};

/**
 * Tính thống kê cho kitchen
 * @param {Array} items - Danh sách món
 * @returns {Object} - Thống kê
 */
export const calculateKitchenStats = (items) => {
  const grouped = groupByStatus(items);
  
  return {
    total: items.length,
    pending: grouped.pending?.length || 0,
    cooking: grouped.cooking?.length || 0,
    ready: grouped.ready?.length || 0,
    avgWaitingTime: calculateAvgWaitingTime(items)
  };
};

/**
 * Tính thời gian chờ trung bình
 * @param {Array} items - Danh sách món
 * @returns {number} - Thời gian chờ trung bình (phút)
 */
export const calculateAvgWaitingTime = (items) => {
  if (items.length === 0) return 0;
  
  const currentTime = new Date();
  const totalWaitingTime = items.reduce((sum, item) => {
    const waitingTime = (currentTime - item.createdAt) / 1000 / 60;
    return sum + waitingTime;
  }, 0);
  
  return Math.round(totalWaitingTime / items.length);
};

/**
 * Format thời gian hiển thị
 * @param {number} minutes - Số phút
 * @returns {string} - Chuỗi hiển thị
 */
export const formatTime = (minutes) => {
  if (minutes < 60) {
    return `${minutes} phút`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}p`;
  }
};

/**
 * Format thời gian dự kiến
 * @param {Date} startTime - Thời gian bắt đầu
 * @param {number} estimatedMinutes - Số phút dự kiến
 * @returns {string} - Chuỗi hiển thị thời gian hoàn thành
 */
export const formatEstimatedCompletion = (startTime, estimatedMinutes) => {
  const completionTime = new Date(startTime.getTime() + estimatedMinutes * 60000);
  return completionTime.toLocaleTimeString('vi-VN', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};
