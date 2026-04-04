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
    const parsedTableNumber = parseInt(tableNumber, 10);
    if (isNaN(parsedTableNumber) || parsedTableNumber <= 0) {
      return null;
    }

    // ✅ CRITICAL: Phải filter theo ngày TRƯỚC KHI filter theo bàn
    const today = new Date().toISOString().split('T')[0];
    
    const q = query(
      collection(db, 'bills'),
      where('date', '==', today),                          // 1. NGÀY HÔM NAY (QUAN TRỌNG!)
      where('tableNumber', '==', parsedTableNumber),        // 2. Số bàn
      where('status', '==', 'pending')                     // 3. Chưa thanh toán
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
 * @param {number} [totalCost=0] - Tổng vốn (costPrice × qty) của lần đặt này
 * @param {number} [totalFixedCost=0] - Tổng chi phí cố định × qty
 */
export const createCustomerOrder = async (
  tableNumber,
  items,
  totalRevenue,
  totalProfit,
  note = '',
  totalCost = 0,
  totalFixedCost = 0
) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const parsedTableNumber = parseInt(tableNumber, 10);
    if (isNaN(parsedTableNumber) || parsedTableNumber <= 0) {
      throw new Error(`tableNumber không hợp lệ: "${tableNumber}"`);
    }

    const billData = {
      createdAt: serverTimestamp(),
      date: today,
      tableNumber: parsedTableNumber,
      status: 'pending',
      items: items,
      totalRevenue: totalRevenue,
      totalProfit: totalProfit,
      totalCost,
      totalFixedCost,
      ...(note?.trim() ? { note: note.trim() } : {}),
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
 * Merge items: nếu món đã có thì cộng quantity, chưa có thì thêm mới.
 * Đánh dấu addedAt trên các item được thêm sau (để bếp nhận biết).
 */
const mergeItems = (existingItems, newItems) => {
  const addedAt = new Date().toISOString();
  // Bắt đầu từ existing items (giữ nguyên cấu trúc + addedAt cũ nếu có)
  const result = existingItems.map(i => ({ ...i }));

  newItems.forEach(newItem => {
    const newKey = newItem.orderItemId || newItem.menuItemId;
    const idx = result.findIndex(i => (i.orderItemId || i.menuItemId) === newKey);

    if (idx >= 0) {
      // Món đã có — tăng số lượng, đánh dấu thêm mới, xóa kitchenStatus cũ
      // để bếp biết có thêm phần mới cần làm (tránh bug "tự nhảy thành đã làm")
      result[idx] = {
        ...result[idx],
        quantity: result[idx].quantity + newItem.quantity,
        addedAt,
        kitchenStatus: 'cooking', // reset về cooking vì có phần mới chưa làm
      };
    } else {
      // Món hoàn toàn mới — thêm vào cuối với addedAt
      result.push({ ...newItem, addedAt });
    }
  });

  return result;
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
export const addItemsToExistingBill = async (
  billId,
  existingBill,
  newItems,
  additionalRevenue,
  additionalProfit,
  note = '',
  additionalCost = 0,
  additionalFixedCost = 0
) => {
  try {
    // ✅ SAFETY CHECK: Đảm bảo bill là của ngày hôm nay
    const today = new Date().toISOString().split('T')[0];
    if (existingBill.date !== today) {
      throw new Error(`CRITICAL: Attempting to merge with bill from different date! Bill date: ${existingBill.date}, Today: ${today}`);
    }
    
    // Merge items
    const mergedItems = mergeItems(existingBill.items, newItems);

    // Gộp note: nối thêm nếu đã có
    const existingNote = existingBill.note || '';
    const newNote = note?.trim() || '';
    const mergedNote = existingNote && newNote
      ? `${existingNote}\n${newNote}`
      : existingNote || newNote;
    
    // Update bill
    await updateDoc(doc(db, 'bills', billId), {
      items: mergedItems,
      totalRevenue: (existingBill.totalRevenue || 0) + additionalRevenue,
      totalProfit: (existingBill.totalProfit || 0) + additionalProfit,
      totalCost: (existingBill.totalCost || 0) + additionalCost,
      totalFixedCost: (existingBill.totalFixedCost || 0) + additionalFixedCost,
      ...(mergedNote ? { note: mergedNote } : {}),
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
 * @param {number} [totalCost=0]
 * @param {number} [totalFixedCost=0]
 * @returns {string} - Bill ID
 */
export const submitCustomerOrder = async (
  tableNumber,
  items,
  totalRevenue,
  totalProfit,
  note = '',
  totalCost = 0,
  totalFixedCost = 0
) => {
  try {
    // Check if table has existing pending bill
    const existingBill = await getActiveBillForTable(tableNumber);
    
    let billId;
    
    if (existingBill) {
      // Add to existing bill (note được gộp vào nếu có)
      await addItemsToExistingBill(
        existingBill.id,
        existingBill,
        items,
        totalRevenue,
        totalProfit,
        note,
        totalCost,
        totalFixedCost
      );
      billId = existingBill.id;
    } else {
      // Create new bill
      billId = await createCustomerOrder(
        tableNumber,
        items,
        totalRevenue,
        totalProfit,
        note,
        totalCost,
        totalFixedCost
      );
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

/**
 * Tạo đơn hàng mang về — luôn tạo bill mới, đánh số thứ tự trong ngày.
 * @returns {number} takeawayNumber — số thứ tự đơn mang về hôm nay (1, 2, 3...)
 */
export const createTakeawayOrder = async (
  items,
  totalRevenue,
  totalProfit,
  note = '',
  totalCost = 0,
  totalFixedCost = 0
) => {
  const today = new Date().toISOString().split('T')[0];

  // Đếm số đơn mang về hôm nay để lấy số thứ tự tiếp theo
  const snap = await getDocs(
    query(collection(db, 'bills'), where('date', '==', today), where('isTakeaway', '==', true))
  );
  const takeawayNumber = snap.size + 1;

  await addDoc(collection(db, 'bills'), {
    createdAt: serverTimestamp(),
    date: today,
    tableNumber: 9000 + takeawayNumber, // virtual — tránh trùng bàn thật (1-9)
    status: 'pending',
    items,
    totalRevenue,
    totalProfit,
    totalCost,
    totalFixedCost,
    isTakeaway: true,
    takeawayNumber,
    ...(note?.trim() ? { note: note.trim() } : {}),
  });

  // Tạo menuItemTimings (non-blocking)
  await createMenuItemTimingsForNewItems(items).catch(() => {});

  return takeawayNumber;
};

