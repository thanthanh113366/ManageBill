import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Kiểm tra bàn có đơn pending không
 * @param {number|string} tableNumber - Số bàn
 * @returns {Object|null} - Bill object hoặc null
 */
export const getActiveBillForTable = async (tableNumber) => {
  try {
    const q = query(
      collection(db, 'bills'),
      where('tableNumber', '==', parseInt(tableNumber)),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    // Return first pending bill
    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data()
    };
  } catch (error) {
    console.error('Error getting active bill:', error);
    throw error;
  }
};

/**
 * Tạo đơn mới
 * @param {number|string} tableNumber - Số bàn
 * @param {Array} items - Danh sách món [{orderItemId, quantity}]
 * @param {number} totalRevenue - Tổng doanh thu
 * @param {number} totalProfit - Tổng lợi nhuận
 * @returns {string} - Bill ID
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
    
    const docRef = await addDoc(collection(db, 'bills'), billData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating order:', error);
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
 * Cộng thêm món vào đơn cũ
 * @param {string} billId - ID đơn hàng
 * @param {Object} existingBill - Đơn hàng hiện tại
 * @param {Array} newItems - Items mới cần thêm
 * @param {number} additionalRevenue - Doanh thu thêm
 * @param {number} additionalProfit - Lợi nhuận thêm
 */
export const addItemsToExistingBill = async (billId, existingBill, newItems, additionalRevenue, additionalProfit) => {
  try {
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
 * Submit order - tạo mới hoặc cộng thêm vào đơn cũ
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
    
    if (existingBill) {
      // Add to existing bill
      await addItemsToExistingBill(
        existingBill.id,
        existingBill,
        items,
        totalRevenue,
        totalProfit
      );
      return existingBill.id;
    } else {
      // Create new bill
      return await createCustomerOrder(tableNumber, items, totalRevenue, totalProfit);
    }
  } catch (error) {
    console.error('Error submitting order:', error);
    throw error;
  }
};

