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
  
  // Thời gian chờ (phút) - đây là yếu tố quan trọng nhất
  const waitingTime = (currentTime - item.createdAt) / 1000 / 60;
  
  // Các hệ số - tăng weight cho thời gian chờ
  const waitingWeight = 50;    // Tăng từ 10 lên 50 - món chờ lâu = điểm cao hơn nhiều
  const billOrderWeight = 10;  // Tăng từ 5 lên 10 - bill đặt trước = điểm cao hơn
  const quantityWeight = 2;    // Số lượng nhiều = điểm cao
  const priorityWeight = 50;   // Priority cao = điểm cao
  
  // Sử dụng timestamp thay vì billOrder nếu billOrder không có
  const billTime = item.createdAt?.toDate?.() || new Date(item.createdAt);
  const billAge = (currentTime - billTime) / 1000 / 60; // phút
  
  const score = baseScore 
    - (waitingTime * waitingWeight)     // Món chờ lâu = điểm cao
    - (billAge * billOrderWeight)       // Bill cũ = điểm cao
    + (item.quantity * quantityWeight)  // Số lượng nhiều = điểm cao
    + ((4 - item.priority) * priorityWeight); // Priority cao = điểm cao
  
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
export const calculateKitchenQueue = (bills, menuTimings, orderItems = []) => {
  const currentTime = new Date();
  
  console.log('🧮 calculateKitchenQueue called with:');
  console.log('📋 Bills:', bills.length);
  console.log('🕒 MenuTimings:', menuTimings.length);
  console.log('📦 OrderItems:', orderItems.length);
  
  // Tạo map để lookup timing từ menuItemTimings (fallback)
  const timingMap = new Map();
  menuTimings.forEach(timing => {
    timingMap.set(timing.menuItemId, timing);
    timingMap.set(timing.orderItemId, timing);
  });
  
  console.log('🗺️ TimingMap created with', timingMap.size, 'entries');
  console.log('🔍 Sample timingMap keys:', Array.from(timingMap.keys()).slice(0, 5));
  
  // Tạo map để lookup thông tin món từ orderItems (primary source)
  const orderItemsMap = new Map();
  orderItems.forEach(item => {
    orderItemsMap.set(item.id, item);
  });
  
  console.log('🗺️ OrderItemsMap created with', orderItemsMap.size, 'entries');
  
  // Flatten tất cả items từ bills và thêm thông tin cần thiết
  const allItems = bills
    .filter(bill => {
      // Hiển thị tất cả bills trong ngày (kể cả completed)
      return true;
    })
    .flatMap(bill => {
      try {
        return bill.items
          .filter(item => {
            // Hiển thị tất cả items (kể cả đã xong)
            return true;
          })
          .flatMap(item => {
          // Tìm orderItem: thử orderItemId trước, sau đó thử menuItemId
          let orderItem = orderItemsMap.get(item.orderItemId);
          if (!orderItem && item.menuItemId) {
            // Nếu không tìm thấy bằng orderItemId, tìm bằng menuItemId
            // Cần tìm orderItem có parentMenuItemId = item.menuItemId
            orderItem = Array.from(orderItemsMap.values()).find(oi => oi.parentMenuItemId === item.menuItemId);
          }
          
          // ✅ FIXED: Ưu tiên menuItemTimings (có thể được admin customize) trước orderItems
          let timing = null;
          let timingSource = 'none';
          
          // 1. PRIMARY: Tìm trong menuItemTimings TRƯỚC (có thể được admin customize)
          const menuTiming = timingMap.get(item.orderItemId) || timingMap.get(item.menuItemId);
          if (menuTiming) {
            timing = {
              speed: menuTiming.speed || 'medium',
              kitchenType: menuTiming.kitchenType || 'cook',
              priority: menuTiming.priority || 1,
              name: menuTiming.name
            };
            timingSource = 'menuItemTimings';
          }
          
          // 2. FALLBACK: Nếu không có menuTiming, dùng orderItem
          if (!timing && orderItem) {
            timing = {
              speed: orderItem.speed || 'medium',
              kitchenType: orderItem.kitchenType || 'cook',
              priority: orderItem.priority || 1,
              name: orderItem.name
            };
            timingSource = 'orderItem';
          }
          
          // Debug log cho timing lookup
          console.log(`🔍 Timing lookup for item:`, {
            orderItemId: item.orderItemId,
            menuItemId: item.menuItemId,
            orderItemFound: !!orderItem,
            timingFound: !!timing,
            timingSource: timingSource,
            timing: timing
          });
          const quantity = item.quantity || 1;
          const completedCount = item.completedCount || 0;
          
          // Debug log (có thể bật lại khi cần debug)
          // console.log(`Debug item name:`, {
          //   orderItemId: item.orderItemId,
          //   menuItemId: item.menuItemId,
          //   orderItemFound: !!orderItem,
          //   orderItemName: orderItem?.name,
          //   itemName: item.name,
          //   timingName: timing?.name,
          //   finalName: orderItem?.name || item.name || timing?.name || `Món ID: ${item.orderItemId || item.menuItemId}`
          // });
          
          // Tách món có số lượng nhiều thành nhiều món riêng biệt
          // Hiển thị tất cả món (kể cả đã hoàn thành)
          const totalQuantity = quantity; // Hiển thị tất cả
          const remainingQuantity = Math.max(0, quantity - completedCount);
          
          const result = [];
          
          // Thêm món đã hoàn thành (hiển thị với status "ready")
          for (let i = 0; i < completedCount; i++) {
            // Tìm tên món với ưu tiên cao nhất
            const itemName = orderItem?.name || 
                           item.name || 
                           timing?.name || 
                           `Món ID: ${item.orderItemId || item.menuItemId}`;
            
            result.push({
              ...item,
              billId: bill.id,
              tableNumber: bill.tableNumber,
              billOrder: bill.billOrder || 999,
              createdAt: bill.createdAt,
              timing: timing,
              kitchenStatus: 'ready', // Đã hoàn thành
              name: itemName,
              quantity: 1,
              batchOrder: i + 1,
              batchTotal: quantity,
              originalQuantity: quantity,
              score: calculateScore({
                ...item,
                billOrder: bill.billOrder || 999,
                createdAt: bill.createdAt,
                priority: timing?.priority || 1,
                quantity: 1
              }, currentTime),
              estimatedTime: calculateEstimatedTime({ ...item, quantity: 1 }, timing),
              isCompleted: true // Flag để phân biệt
            });
          }
          
          // Thêm món chưa hoàn thành (hiển thị với status "cooking")
          for (let i = 0; i < remainingQuantity; i++) {
            // Tìm tên món với ưu tiên cao nhất
            const itemName = orderItem?.name || 
                           item.name || 
                           timing?.name || 
                           `Món ID: ${item.orderItemId || item.menuItemId}`;
            
            result.push({
              ...item,
              billId: bill.id,
              tableNumber: bill.tableNumber,
              billOrder: bill.billOrder || 999,
              createdAt: bill.createdAt,
              timing: timing,
              kitchenStatus: item.kitchenStatus || 'cooking',
              name: itemName,
              quantity: 1,
              batchOrder: completedCount + i + 1,
              batchTotal: quantity,
              originalQuantity: quantity,
              score: calculateScore({
                ...item,
                billOrder: bill.billOrder || 999,
                createdAt: bill.createdAt,
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
