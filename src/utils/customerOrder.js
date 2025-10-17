import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
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
    console.log('🕒 Creating menuItemTimings for new items...');
    console.log('📦 Items to process:', items);
    
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const item of items) {
      if (item.orderItemId) {
        try {
          console.log(`🔍 Processing orderItemId: ${item.orderItemId}`);
          
          // ✅ SAFETY CHECK: Kiểm tra menuItemTiming đã tồn tại chưa
          const existingTimingQuery = query(
            collection(db, 'menuItemTimings'),
            where('orderItemId', '==', item.orderItemId)
          );
          const existingTiming = await getDocs(existingTimingQuery);
          
          if (!existingTiming.empty) {
            console.log(`⏭️  MenuItemTiming already exists for orderItemId: ${item.orderItemId}`);
            skippedCount++;
            continue;
          }
          
          // ✅ Lấy thông tin orderItem từ database
          console.log(`📋 Fetching orderItem data for: ${item.orderItemId}`);
          const orderItemDoc = await getDoc(doc(db, 'orderItems', item.orderItemId));
          
          if (!orderItemDoc.exists()) {
            console.warn(`⚠️  OrderItem not found: ${item.orderItemId}`);
            errorCount++;
            continue;
          }
          
          const orderItemData = orderItemDoc.data();
          console.log(`📊 OrderItem data:`, orderItemData);
          
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
          
          console.log(`📝 Creating menuItemTiming:`, menuItemTimingData);
          
          await addDoc(collection(db, 'menuItemTimings'), menuItemTimingData);
          
          console.log(`✅ Created menuItemTiming for: ${orderItemData.name} (${orderItemData.speed || 'medium'}, ${orderItemData.kitchenType || 'cook'})`);
          createdCount++;
          
        } catch (itemError) {
          console.error(`❌ Error processing orderItemId ${item.orderItemId}:`, itemError);
          errorCount++;
        }
      } else {
        console.log(`⏭️  Item has no orderItemId, skipping:`, item);
        skippedCount++;
      }
    }
    
    console.log(`🎉 MenuItemTimings creation completed:`);
    console.log(`✅ Created: ${createdCount}`);
    console.log(`⏭️  Skipped (existing): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    return { createdCount, skippedCount, errorCount };
    
  } catch (error) {
    console.error('❌ Error in createMenuItemTimingsForNewItems:', error);
    console.error('📊 Error details:', error.message);
    
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
    console.log('🔍 Checking for existing bill for table:', tableNumber);
    
    // Check if table has existing pending bill
    const existingBill = await getActiveBillForTable(tableNumber);
    
    let billId;
    
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
      billId = existingBill.id;
    } else {
      console.log('🆕 No existing bill found, creating new bill...');
      
      // Create new bill
      billId = await createCustomerOrder(tableNumber, items, totalRevenue, totalProfit);
      console.log('✅ Created new bill with ID:', billId);
    }
    
    // ✅ CRITICAL: Tự động tạo menuItemTimings cho items mới (non-blocking)
    console.log('🕒 Starting automatic menuItemTimings creation...');
    try {
      const timingResult = await createMenuItemTimingsForNewItems(items);
      console.log('🎉 MenuItemTimings creation result:', timingResult);
      
      if (timingResult.createdCount > 0) {
        console.log(`✅ Successfully created ${timingResult.createdCount} menuItemTimings`);
      }
      
      if (timingResult.errorCount > 0) {
        console.warn(`⚠️  ${timingResult.errorCount} errors occurred during menuItemTimings creation`);
      }
      
    } catch (timingError) {
      // ⚠️ IMPORTANT: Timing creation failure KHÔNG được làm fail order
      console.error('❌ MenuItemTimings creation failed, but order was successful:', timingError);
      console.error('📊 Timing error details:', timingError.message);
      console.log('✅ Order process continues normally despite timing creation failure');
    }
    
    return billId;
    
  } catch (error) {
    console.error('❌ Error in submitCustomerOrder:', error);
    throw error;
  }
};

