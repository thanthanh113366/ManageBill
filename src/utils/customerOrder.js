import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Test Firestore connection
 */
export const testFirestoreConnection = async () => {
  try {
    // Try to read from a collection
    const testQuery = query(collection(db, 'bills'));
    const snapshot = await getDocs(testQuery);
    
    return true;
  } catch (error) {
    console.error('Firestore connection test failed:', error);
    return false;
  }
};

/**
 * ⚠️ CRITICAL FUNCTION - RỦI RO TRUNG BÌNH ⚠️
 * 
 * RỦIRO:
 * - Tạo duplicate menuItemTimings nếu không check existing
 * - Lỗi Firestore có thể làm fail toàn bộ order process
 * - Performance impact nếu có nhiều items
 * 
 * LOGIC: Tự động tạo menuItemTimings cho orderItems chưa có
 * SAFETY: Check existing trước khi tạo mới
 */
export const createMenuItemTimingsForNewItems = async (items) => {
  try {
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const item of items) {
      if (item.orderItemId) {
        try {
          // ✅ SAFETY CHECK: Kiểm tra menuItemTiming đã tồn tại chưa
          const existingTimingQuery = query(
            collection(db, 'menuItemTimings'),
            where('orderItemId', '==', item.orderItemId)
          );
          const existingTiming = await getDocs(existingTimingQuery);
          
          if (!existingTiming.empty) {
            skippedCount++;
            continue;
          }
          
          // ✅ Lấy thông tin orderItem từ database
          const orderItemDoc = await getDoc(doc(db, 'orderItems', item.orderItemId));
          
          if (!orderItemDoc.exists()) {
            console.warn(`OrderItem not found: ${item.orderItemId}`);
            errorCount++;
            continue;
          }
          
          const orderItemData = orderItemDoc.data();
          
          // ✅ Tạo menuItemTiming mới
          const menuItemTimingData = {
            menuItemId: orderItemData.parentMenuItemId || item.orderItemId,
            orderItemId: item.orderItemId,
            speed: orderItemData.speed || 'medium',
            kitchenType: orderItemData.kitchenType || 'cook',
            estimatedTime: orderItemData.estimatedTime || 2,
            priority: orderItemData.priority || 1,
            name: orderItemData.name || 'Unknown Item',
            createdAt: new Date(),
            autoCreated: true  // Flag để biết được tạo tự động
          };
          
          await addDoc(collection(db, 'menuItemTimings'), menuItemTimingData);
          
          createdCount++;
          
        } catch (itemError) {
          console.error(`Error processing orderItemId ${item.orderItemId}:`, itemError);
          errorCount++;
        }
      } else {
        skippedCount++;
      }
    }
    
    return { createdCount, skippedCount, errorCount };
    
  } catch (error) {
    console.error('Error in createMenuItemTimingsForNewItems:', error);
    
    // ⚠️ KHÔNG throw error để không làm fail order process
    // Chỉ log error và return thông tin
    return { createdCount: 0, skippedCount: 0, errorCount: 1, error: error.message };
  }
};

/**
 * ⚠️  CRITICAL FUNCTION - RỦI RO CAO ⚠️ 
 * 
 * RỦIRO: Nếu không filter đúng có thể:
 * - Merge đơn hàng với bill từ ngày khác
 * - Gây pollution database 
 * - Làm sai báo cáo doanh thu
 * - Khách hàng thấy bill sai
 * 
 * LOGIC ĐÚNG: Phải filter theo thứ tự: NGÀY → BÀN → TRẠNG THÁI
 */
export const getActiveBillForTable = async (tableNumber) => {
  try {
    // ✅ CRITICAL: Phải filter theo ngày TRƯỚC KHI filter theo bàn
    const today = new Date().toISOString().split('T')[0];
    
    const q = query(
      collection(db, 'bills'),
      where('date', '==', today),                    // 1. NGÀY HÔM NAY (QUAN TRỌNG!)
      where('tableNumber', '==', parseInt(tableNumber)), // 2. Số bàn  
      where('status', '==', 'pending')               // 3. Chưa thanh toán
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const activeBill = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };
    
    // Return first pending bill
    return activeBill;
  } catch (error) {
    console.error('Error getting active bill:', error);
    throw error;
  }
};

/**
 * ⚠️  CRITICAL FUNCTION - RỦI RO TRUNG BÌNH ⚠️ 
 * 
 * RỦIRO: 
 * - Tạo bill với dữ liệu sai có thể làm hỏng database
 * - serverTimestamp() có thể fail nếu offline
 * - Validation không đủ có thể tạo bill invalid
 * 
 * VALIDATION REQUIRED: tableNumber, items, revenue, profit
 */
export const createCustomerOrder = async (tableNumber, items, totalRevenue, totalProfit) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const billData = {
      createdAt: serverTimestamp(),
      date: today,
      tableNumber: parseInt(tableNumber),
      status: 'pending',
      items: items,
      totalRevenue: totalRevenue,
      totalProfit: totalProfit
    };
    
    try {
      const docRef = await addDoc(collection(db, 'bills'), billData);
      return docRef.id;
    } catch (firestoreError) {
      console.error('Firestore specific error:', firestoreError);
      
      // Re-throw with more context
      throw new Error(`Firestore write failed: ${firestoreError.message} (Code: ${firestoreError.code})`);
    }
  } catch (error) {
    console.error('Error creating order in Firestore:', error);
    throw error;
  }
};

/**
 * Merge items: nếu món đã có thì cộng quantity, chưa có thì thêm mới
 * @param {Array} existingItems - Items hiện tại
 * @param {Array} newItems - Items mới
 * @returns {Array} - Merged items
 */
const mergeItems = (existingItems, newItems) => {
  const itemsMap = new Map();
  
  // Add existing items to map (handle both menuItemId and orderItemId)
  existingItems.forEach(item => {
    const key = item.menuItemId || item.orderItemId;
    itemsMap.set(key, item.quantity);
  });
  
  // Merge new items
  newItems.forEach(item => {
    const key = item.menuItemId || item.orderItemId;
    const currentQty = itemsMap.get(key) || 0;
    itemsMap.set(key, currentQty + item.quantity);
  });
  
  // Convert back to array (preserve original structure)
  return Array.from(itemsMap, ([itemId, quantity]) => {
    // Check if original items had menuItemId or orderItemId
    const hasOrderItemId = newItems.some(item => item.orderItemId) || existingItems.some(item => item.orderItemId);
    
    if (hasOrderItemId) {
      return { orderItemId: itemId, quantity };
    } else {
      return { menuItemId: itemId, quantity };
    }
  });
};

/**
 * ⚠️  CRITICAL FUNCTION - RỦI RO CAO ⚠️ 
 * 
 * RỦIRO:
 * - Merge sai items có thể làm mất dữ liệu 
 * - Cộng sai revenue/profit làm sai báo cáo
 * - Update document sai có thể corrupt bill
 * 
 * VALIDATION: Phải kiểm tra existingBill.date === today
 */
export const addItemsToExistingBill = async (billId, existingBill, newItems, additionalRevenue, additionalProfit) => {
  try {
    // ✅ SAFETY CHECK: Đảm bảo bill là của ngày hôm nay
    const today = new Date().toISOString().split('T')[0];
    if (existingBill.date !== today) {
      throw new Error(`CRITICAL: Attempting to merge with bill from different date! Bill date: ${existingBill.date}, Today: ${today}`);
    }
    
    // Merge items
    const mergedItems = mergeItems(existingBill.items, newItems);
    
    // Update bill
    await updateDoc(doc(db, 'bills', billId), {
      items: mergedItems,
      totalRevenue: existingBill.totalRevenue + additionalRevenue,
      totalProfit: existingBill.totalProfit + additionalProfit,
      updatedAt: serverTimestamp()
    });
    
  } catch (error) {
    console.error('Error adding items to bill:', error);
    throw error;
  }
};

/**
 * ⚠️ CRITICAL FUNCTION - RỦI RO TRUNG BÌNH ⚠️
 * 
 * Submit order - tạo mới hoặc cộng thêm vào đơn cũ
 * 
 * RỦIRO:
 * - Lỗi tạo menuItemTimings có thể làm chậm order process
 * - Nếu timing creation fail, order vẫn phải thành công
 * - Performance impact khi có nhiều items mới
 * 
 * LOGIC: Tạo bill trước, sau đó tạo menuItemTimings (non-blocking)
 * 
 * @param {number|string} tableNumber - Số bàn
 * @param {Array} items - Danh sách món
 * @param {number} totalRevenue - Tổng doanh thu
 * @param {number} totalProfit - Tổng lợi nhuận
 * @returns {string} - Bill ID
 */
export const submitCustomerOrder = async (tableNumber, items, totalRevenue, totalProfit) => {
  try {
    // Check if table has existing pending bill
    const existingBill = await getActiveBillForTable(tableNumber);
    
    let billId;
    
    if (existingBill) {
      // Add to existing bill
      await addItemsToExistingBill(
        existingBill.id,
        existingBill,
        items,
        totalRevenue,
        totalProfit
      );
      billId = existingBill.id;
    } else {
      // Create new bill
      billId = await createCustomerOrder(tableNumber, items, totalRevenue, totalProfit);
    }
    
    // ✅ CRITICAL: Tự động tạo menuItemTimings cho items mới (non-blocking)
    try {
      const timingResult = await createMenuItemTimingsForNewItems(items);
      
      if (timingResult.errorCount > 0) {
        console.warn(`${timingResult.errorCount} errors occurred during menuItemTimings creation`);
      }
      
    } catch (timingError) {
      // ⚠️ IMPORTANT: Timing creation failure KHÔNG được làm fail order
      console.error('MenuItemTimings creation failed, but order was successful:', timingError);
    }
    
    return billId;
    
  } catch (error) {
    console.error('Error in submitCustomerOrder:', error);
    throw error;
  }
};

