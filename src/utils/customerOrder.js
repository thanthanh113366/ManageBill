import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Test Firestore connection
 */
export const testFirestoreConnection = async () => {
  try {
    console.log('🧪 Testing Firestore connection...');
    
    // Try to read from a collection
    const testQuery = query(collection(db, 'bills'));
    const snapshot = await getDocs(testQuery);
    
    console.log('✅ Firestore connection test successful');
    console.log('📊 Found', snapshot.size, 'documents in bills collection');
    
    return true;
  } catch (error) {
    console.error('❌ Firestore connection test failed:', error);
    return false;
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
    console.log('🔍 Searching for active bill for table:', tableNumber);
    console.log('🔢 Parsed table number:', parseInt(tableNumber));
    
    // ✅ CRITICAL: Phải filter theo ngày TRƯỚC KHI filter theo bàn
    const today = new Date().toISOString().split('T')[0];
    console.log('📅 Filtering by today date:', today);
    
    const q = query(
      collection(db, 'bills'),
      where('date', '==', today),                    // 1. NGÀY HÔM NAY (QUAN TRỌNG!)
      where('tableNumber', '==', parseInt(tableNumber)), // 2. Số bàn  
      where('status', '==', 'pending')               // 3. Chưa thanh toán
    );
    
    console.log('📊 Executing Firestore query with date filter...');
    const snapshot = await getDocs(q);
    
    console.log('📋 Query results:', snapshot.size, 'documents found for TODAY');
    
    if (snapshot.empty) {
      console.log('✅ No active bills found for table', tableNumber, 'TODAY - Safe to create new bill');
      return null;
    }
    
    const activeBill = {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };
    
    console.log('⚠️  Found existing bill TODAY:', activeBill);
    console.log('📅 Bill date:', activeBill.date);
    console.log('🏷️  Bill table:', activeBill.tableNumber);
    console.log('📊 Bill status:', activeBill.status);
    
    // Return first pending bill
    return activeBill;
  } catch (error) {
    console.error('❌ Error getting active bill:', error);
    console.error('📊 Error details:', error.message);
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
    
    console.log('📝 Creating new bill with data:', billData);
    console.log('📅 Date:', today);
    console.log('🏷️ Table number (parsed):', parseInt(tableNumber));
    console.log('📦 Items array:', items);
    
    // Test Firestore connection first
    console.log('🔗 Testing Firestore connection...');
    console.log('📊 Database instance:', db);
    console.log('📋 Collection reference:', collection(db, 'bills'));
    
    try {
      console.log('⏳ Attempting to add document to Firestore...');
      const docRef = await addDoc(collection(db, 'bills'), billData);
      
      console.log('✅ Bill created successfully in Firestore with ID:', docRef.id);
      console.log('🔗 Document reference:', docRef);
      console.log('📍 Document path:', docRef.path);
      
      return docRef.id;
    } catch (firestoreError) {
      console.error('🔥 Firestore specific error:', firestoreError);
      console.error('📊 Error code:', firestoreError.code);
      console.error('📝 Error message:', firestoreError.message);
      console.error('🔍 Full error object:', firestoreError);
      
      // Re-throw with more context
      throw new Error(`Firestore write failed: ${firestoreError.message} (Code: ${firestoreError.code})`);
    }
  } catch (error) {
    console.error('❌ Error creating order in Firestore:', error);
    console.error('📊 Error details:', error.message);
    console.error('🔍 Stack trace:', error.stack);
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
      throw new Error(`🚨 CRITICAL: Attempting to merge with bill from different date! Bill date: ${existingBill.date}, Today: ${today}`);
    }
    
    console.log('✅ Safety check passed: Bill is from today');
    console.log('📅 Bill date:', existingBill.date);
    console.log('📅 Today:', today);
    
    // Merge items
    const mergedItems = mergeItems(existingBill.items, newItems);
    
    console.log('🔄 Merging items...');
    console.log('📦 Existing items:', existingBill.items);
    console.log('📦 New items:', newItems);  
    console.log('📦 Merged items:', mergedItems);
    
    // Update bill
    await updateDoc(doc(db, 'bills', billId), {
      items: mergedItems,
      totalRevenue: existingBill.totalRevenue + additionalRevenue,
      totalProfit: existingBill.totalProfit + additionalProfit,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Bill updated successfully');
  } catch (error) {
    console.error('❌ Error adding items to bill:', error);
    console.error('📊 Error details:', error.message);
    throw error;
  }
};

/**
 * Submit order - tạo mới hoặc cộng thêm vào đơn cũ
 * @param {number|string} tableNumber - Số bàn
 * @param {Array} items - Danh sách món
 * @param {number} totalRevenue - Tổng doanh thu
 * @param {number} totalProfit - Tổng lợi nhuận
 * @returns {string} - Bill ID
 */
export const submitCustomerOrder = async (tableNumber, items, totalRevenue, totalProfit) => {
  try {
    console.log('🔍 Checking for existing bill for table:', tableNumber);
    
    // Check if table has existing pending bill
    const existingBill = await getActiveBillForTable(tableNumber);
    
    if (existingBill) {
      console.log('📋 Found existing bill:', existingBill.id);
      console.log('📝 Existing bill data:', existingBill);
      
      // Add to existing bill
      await addItemsToExistingBill(
        existingBill.id,
        existingBill,
        items,
        totalRevenue,
        totalProfit
      );
      console.log('✅ Added items to existing bill:', existingBill.id);
      return existingBill.id;
    } else {
      console.log('🆕 No existing bill found, creating new bill...');
      
      // Create new bill
      const newBillId = await createCustomerOrder(tableNumber, items, totalRevenue, totalProfit);
      console.log('✅ Created new bill with ID:', newBillId);
      return newBillId;
    }
  } catch (error) {
    console.error('❌ Error in submitCustomerOrder:', error);
    throw error;
  }
};

