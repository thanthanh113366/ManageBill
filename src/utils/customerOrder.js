import { collection, query, where, getDocs, addDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

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

    const today = new Date().toISOString().split('T')[0];
    
    const q = query(
      collection(db, 'bills'),
      where('date', '==', today),
      where('tableNumber', '==', parsedTableNumber),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
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
 * Submit order — ghi bill (tạo mới hoặc merge vào bill pending).
 * Kitchen tự động đọc speed/kitchenType/priority từ orderItems, không cần timing doc.
 * 
 * @param {number|string} tableNumber
 * @param {Array} items - [{ orderItemId, quantity }]
 * @param {number} totalRevenue
 * @param {number} totalProfit
 * @param {string} [note='']
 * @param {number} [totalCost=0]
 * @param {number} [totalFixedCost=0]
 * @param {object} [existingBill] - bill đã load từ client, tránh query lại
 * @returns {string} billId
 */
export const submitCustomerOrder = async (
  tableNumber,
  items,
  totalRevenue,
  totalProfit,
  note = '',
  totalCost = 0,
  totalFixedCost = 0,
  existingBill = undefined
) => {
  const today = new Date().toISOString().split('T')[0];
  const parsedTableNumber = parseInt(tableNumber, 10);
  if (isNaN(parsedTableNumber) || parsedTableNumber <= 0) {
    throw new Error(`tableNumber không hợp lệ: "${tableNumber}"`);
  }

  const bill = existingBill !== undefined ? existingBill : await getActiveBillForTable(tableNumber);
  const batch = writeBatch(db);
  let billId;

  if (bill) {
    // ── Merge vào bill đã có ──
    if (bill.date !== today) {
      throw new Error(`CRITICAL: bill date mismatch (${bill.date} vs ${today})`);
    }

    const addedAt = new Date().toISOString();
    const mergedItems = bill.items.map(i => ({ ...i }));

    items.forEach(newItem => {
      const newKey = newItem.orderItemId || newItem.menuItemId;
      const idx = mergedItems.findIndex(i => (i.orderItemId || i.menuItemId) === newKey);
      if (idx >= 0) {
        mergedItems[idx] = {
          ...mergedItems[idx],
          quantity: mergedItems[idx].quantity + newItem.quantity,
          addedAt,
          kitchenStatus: 'cooking',
        };
      } else {
        mergedItems.push({ ...newItem, addedAt });
      }
    });

    const existingNote = bill.note || '';
    const newNote = note?.trim() || '';
    const mergedNote = existingNote && newNote
      ? `${existingNote}\n${newNote}`
      : existingNote || newNote;

    batch.update(doc(db, 'bills', bill.id), {
      items: mergedItems,
      totalRevenue: (bill.totalRevenue || 0) + totalRevenue,
      totalProfit: (bill.totalProfit || 0) + totalProfit,
      totalCost: (bill.totalCost || 0) + totalCost,
      totalFixedCost: (bill.totalFixedCost || 0) + totalFixedCost,
      ...(mergedNote ? { note: mergedNote } : {}),
      updatedAt: serverTimestamp(),
    });

    billId = bill.id;
  } else {
    // ── Tạo bill mới ──
    const billRef = doc(collection(db, 'bills'));
    batch.set(billRef, {
      createdAt: serverTimestamp(),
      date: today,
      tableNumber: parsedTableNumber,
      status: 'pending',
      items,
      totalRevenue,
      totalProfit,
      totalCost,
      totalFixedCost,
      ...(note?.trim() ? { note: note.trim() } : {}),
    });
    billId = billRef.id;
  }

  await batch.commit();
  return billId;
};


/**
 * Tạo đơn hàng mang về — ghi bill, đánh số thứ tự trong ngày.
 * @returns {number} takeawayNumber
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

  const snap = await getDocs(
    query(collection(db, 'bills'), where('date', '==', today), where('isTakeaway', '==', true))
  );
  const takeawayNumber = snap.size + 1;

  await addDoc(collection(db, 'bills'), {
    createdAt: serverTimestamp(),
    date: today,
    tableNumber: 9000 + takeawayNumber,
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

  return takeawayNumber;
};

