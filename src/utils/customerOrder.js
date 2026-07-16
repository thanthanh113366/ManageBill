import {
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getVietnamDateString } from './businessDate';

const ACTIVE_BILLS_COLLECTION = 'activeBills';
const TAKEAWAY_COUNTERS_COLLECTION = 'takeawayCounters';

const createCustomItemId = () => `custom_${Date.now()}_${Math.random()}`;

const normalizeTableNumber = (tableNumber) => {
  const parsed = parseInt(tableNumber, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`tableNumber khong hop le: "${tableNumber}"`);
  }
  return parsed;
};

const getActiveBillLockId = (date, tableNumber) => `${date}_${tableNumber}`;

const getActiveBillLockRef = (date, tableNumber) =>
  doc(db, ACTIVE_BILLS_COLLECTION, getActiveBillLockId(date, tableNumber));

const getTakeawayCounterRef = (date) =>
  doc(db, TAKEAWAY_COUNTERS_COLLECTION, date);

const getCreatedMillis = (bill) => {
  const createdAt = bill?.createdAt;
  if (!createdAt) return 0;
  return createdAt.toDate?.().getTime?.() || new Date(createdAt).getTime() || 0;
};

const getTimestampMillis = (value) => {
  if (!value) return 0;
  return value.toMillis?.() || value.toDate?.().getTime?.() || new Date(value).getTime() || 0;
};

const getBillVersionMillis = (bill) =>
  getTimestampMillis(bill?.updatedAt) || getTimestampMillis(bill?.createdAt);

const isBillPendingForTable = (bill, date, tableNumber) =>
  Boolean(bill) &&
  bill.status === 'pending' &&
  bill.date === date &&
  Number(bill.tableNumber) === Number(tableNumber);

const getMergeKey = (item) => {
  if (item.orderItemId) return `order:${item.orderItemId}`;
  if (item.menuItemId) return `menu:${item.menuItemId}`;
  if (item.customItemId) return `custom:${item.customItemId}`;
  return null;
};

const normalizeItems = (items, { markAsAdded = false } = {}) => {
  const addedAt = markAsAdded ? new Date().toISOString() : null;

  return items.map((item) => ({
    ...item,
    ...(item.customDescription && !item.customItemId ? { customItemId: createCustomItemId() } : {}),
    quantity: item.quantity || 1,
    kitchenStatus: item.kitchenStatus || 'cooking',
    ...(addedAt ? { addedAt } : {}),
  }));
};

const mergeItems = (currentItems = [], incomingItems = []) => {
  const addedAt = new Date().toISOString();
  const mergedItems = currentItems.map((item) => ({ ...item }));

  incomingItems.forEach((newItem) => {
    const key = getMergeKey(newItem);

    if (!key) {
      mergedItems.push({
        ...newItem,
        ...(newItem.customDescription && !newItem.customItemId ? { customItemId: createCustomItemId() } : {}),
        quantity: newItem.quantity || 1,
        addedAt,
        kitchenStatus: 'cooking',
      });
      return;
    }

    const index = mergedItems.findIndex((item) => getMergeKey(item) === key);
    if (index >= 0) {
      mergedItems[index] = {
        ...mergedItems[index],
        quantity: (mergedItems[index].quantity || 1) + (newItem.quantity || 1),
        addedAt,
        kitchenStatus: 'cooking',
      };
    } else {
      mergedItems.push({
        ...newItem,
        ...(newItem.customDescription && !newItem.customItemId ? { customItemId: createCustomItemId() } : {}),
        quantity: newItem.quantity || 1,
        addedAt,
        kitchenStatus: 'cooking',
      });
    }
  });

  return mergedItems;
};

const mergeNote = (oldNote = '', newNote = '') => {
  const existingNote = oldNote || '';
  const nextNote = newNote?.trim() || '';
  if (existingNote && nextNote) return `${existingNote}\n${nextNote}`;
  return existingNote || nextNote;
};

const findPendingBillsForTable = async (tableNumber, date = getVietnamDateString()) => {
  const parsedTableNumber = normalizeTableNumber(tableNumber);
  const q = query(
    collection(db, 'bills'),
    where('date', '==', date),
    where('tableNumber', '==', parsedTableNumber),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((billDoc) => ({ id: billDoc.id, ...billDoc.data() }))
    .sort((a, b) => getCreatedMillis(a) - getCreatedMillis(b));
};

export const getActiveBillForTable = async (tableNumber, date = getVietnamDateString()) => {
  try {
    const bills = await findPendingBillsForTable(tableNumber, date);
    return bills[0] || null;
  } catch (error) {
    console.error('Error getting active bill:', error);
    throw error;
  }
};

export const getPendingBillDuplicates = (bills) => {
  const groups = new Map();

  bills
    .filter((bill) => bill.status === 'pending' && !bill.isTakeaway)
    .forEach((bill) => {
      const key = `${bill.date}_${bill.tableNumber}`;
      const group = groups.get(key) || [];
      group.push(bill);
      groups.set(key, group);
    });

  return Array.from(groups.values()).filter((group) => group.length > 1);
};

const resolveLockedBill = async (transaction, lockSnap, date, tableNumber) => {
  if (!lockSnap.exists()) return null;

  const lock = lockSnap.data();
  if (!lock?.billId) return null;

  const billRef = doc(db, 'bills', lock.billId);
  const billSnap = await transaction.get(billRef);
  if (!billSnap.exists()) return null;

  const bill = { id: billSnap.id, ...billSnap.data() };
  if (!isBillPendingForTable(bill, date, tableNumber)) return null;

  return { bill, billRef };
};

const resolveFallbackBill = async (transaction, fallbackBill, date, tableNumber) => {
  if (!fallbackBill?.id) return null;

  const billRef = doc(db, 'bills', fallbackBill.id);
  const billSnap = await transaction.get(billRef);
  if (!billSnap.exists()) return null;

  const bill = { id: billSnap.id, ...billSnap.data() };
  if (!isBillPendingForTable(bill, date, tableNumber)) return null;

  return { bill, billRef };
};

export const submitTableOrder = async ({
  tableNumber,
  items,
  totalRevenue,
  totalProfit,
  note = '',
  totalCost = 0,
  totalFixedCost = 0,
  source = 'unknown',
}) => {
  const date = getVietnamDateString();
  const parsedTableNumber = normalizeTableNumber(tableNumber);
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Don hang phai co it nhat mot mon');
  }

  const fallbackBill = await getActiveBillForTable(parsedTableNumber, date);
  const lockRef = getActiveBillLockRef(date, parsedTableNumber);
  let billId = null;

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef);
    const lockedTarget = await resolveLockedBill(transaction, lockSnap, date, parsedTableNumber);
    const fallbackTarget = lockedTarget
      ? null
      : await resolveFallbackBill(transaction, fallbackBill, date, parsedTableNumber);
    const target = lockedTarget || fallbackTarget;

    if (target) {
      const { bill, billRef } = target;
      const mergedNote = mergeNote(bill.note, note);

      transaction.update(billRef, {
        items: mergeItems(bill.items || [], items),
        totalRevenue: (bill.totalRevenue || 0) + totalRevenue,
        totalProfit: (bill.totalProfit || 0) + totalProfit,
        totalCost: (bill.totalCost || 0) + totalCost,
        totalFixedCost: (bill.totalFixedCost || 0) + totalFixedCost,
        kitchenStatus: 'in_progress',
        ...(mergedNote ? { note: mergedNote } : {}),
        updatedAt: serverTimestamp(),
      });

      transaction.set(lockRef, {
        billId: bill.id,
        date,
        tableNumber: parsedTableNumber,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      billId = bill.id;
      return;
    }

    const billRef = doc(collection(db, 'bills'));
    transaction.set(billRef, {
      createdAt: serverTimestamp(),
      date,
      tableNumber: parsedTableNumber,
      status: 'pending',
      kitchenStatus: 'in_progress',
      items: normalizeItems(items),
      totalRevenue,
      totalProfit,
      totalCost,
      totalFixedCost,
      orderSource: source,
      ...(note?.trim() ? { note: note.trim() } : {}),
    });

    transaction.set(lockRef, {
      billId: billRef.id,
      date,
      tableNumber: parsedTableNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    billId = billRef.id;
  });

  return billId;
};

export const submitCustomerOrder = async (
  tableNumber,
  items,
  totalRevenue,
  totalProfit,
  note = '',
  totalCost = 0,
  totalFixedCost = 0
) => submitTableOrder({
  tableNumber,
  items,
  totalRevenue,
  totalProfit,
  note,
  totalCost,
  totalFixedCost,
  source: 'customer',
});

export const markBillPaid = async (bill) => {
  const billRef = doc(db, 'bills', bill.id);

  await runTransaction(db, async (transaction) => {
    const billSnap = await transaction.get(billRef);
    if (!billSnap.exists()) {
      throw new Error('Bill khong ton tai');
    }

    const currentBill = { id: billSnap.id, ...billSnap.data() };
    let lockRef = null;
    let lockSnap = null;

    if (!currentBill.isTakeaway) {
      const date = currentBill.date || getVietnamDateString();
      const tableNumber = normalizeTableNumber(currentBill.tableNumber);
      lockRef = getActiveBillLockRef(date, tableNumber);
      lockSnap = await transaction.get(lockRef);
    }

    transaction.update(billRef, {
      status: 'paid',
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (lockRef && lockSnap?.exists() && lockSnap.data()?.billId === bill.id) {
      transaction.delete(lockRef);
    }
  });
};

export const undoBillPaid = async (bill) => {
  const billRef = doc(db, 'bills', bill.id);

  if (bill.isTakeaway) {
    await runTransaction(db, async (transaction) => {
      transaction.update(billRef, {
        status: 'pending',
        paidAt: null,
        updatedAt: serverTimestamp(),
      });
    });
    return;
  }

  const date = bill.date || getVietnamDateString();
  const tableNumber = normalizeTableNumber(bill.tableNumber);
  const existingPending = await getActiveBillForTable(tableNumber, date);
  if (existingPending && existingPending.id !== bill.id) {
    throw new Error(`Ban ${tableNumber} dang co bill pending khac`);
  }

  const lockRef = getActiveBillLockRef(date, tableNumber);

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef);
    const lockedTarget = await resolveLockedBill(transaction, lockSnap, date, tableNumber);

    if (lockedTarget && lockedTarget.bill.id !== bill.id) {
      throw new Error(`Ban ${tableNumber} dang co bill pending khac`);
    }

    transaction.update(billRef, {
      status: 'pending',
      paidAt: null,
      updatedAt: serverTimestamp(),
    });

    transaction.set(lockRef, {
      billId: bill.id,
      date,
      tableNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};

export const changeBillTable = async (bill, targetTableNumber) => {
  if (bill.isTakeaway) {
    throw new Error('Khong the doi ban cho don mang ve');
  }

  const date = bill.date || getVietnamDateString();
  const sourceTableNumber = normalizeTableNumber(bill.tableNumber);
  const nextTableNumber = normalizeTableNumber(targetTableNumber);
  const existingPending = await getActiveBillForTable(nextTableNumber, date);
  if (existingPending && existingPending.id !== bill.id) {
    throw new Error(`Ban ${nextTableNumber} dang co bill pending khac`);
  }

  const billRef = doc(db, 'bills', bill.id);
  const sourceLockRef = getActiveBillLockRef(date, sourceTableNumber);
  const targetLockRef = getActiveBillLockRef(date, nextTableNumber);

  await runTransaction(db, async (transaction) => {
    const sourceLockSnap = await transaction.get(sourceLockRef);
    const targetLockSnap = await transaction.get(targetLockRef);
    const lockedTarget = await resolveLockedBill(transaction, targetLockSnap, date, nextTableNumber);

    if (lockedTarget && lockedTarget.bill.id !== bill.id) {
      throw new Error(`Ban ${nextTableNumber} dang co bill pending khac`);
    }

    transaction.update(billRef, {
      tableNumber: nextTableNumber,
      updatedAt: serverTimestamp(),
    });

    if (sourceLockSnap.exists() && sourceLockSnap.data()?.billId === bill.id) {
      transaction.delete(sourceLockRef);
    }

    transaction.set(targetLockRef, {
      billId: bill.id,
      date,
      tableNumber: nextTableNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
};

export const updateBillDetails = async (bill, updates) => {
  const billRef = doc(db, 'bills', bill.id);

  await runTransaction(db, async (transaction) => {
    const billSnap = await transaction.get(billRef);
    if (!billSnap.exists()) {
      throw new Error('Bill khong ton tai');
    }

    const currentBill = { id: billSnap.id, ...billSnap.data() };
    const originalVersion = getBillVersionMillis(bill);
    const currentVersion = getBillVersionMillis(currentBill);
    if (originalVersion && currentVersion && originalVersion !== currentVersion) {
      throw new Error('Bill da thay doi, vui long dong va mo lai de cap nhat');
    }

    transaction.update(billRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  });
};

export const deleteBillWithActiveLock = async (bill) => {
  const billRef = doc(db, 'bills', bill.id);

  await runTransaction(db, async (transaction) => {
    const billSnap = await transaction.get(billRef);
    if (!billSnap.exists()) return;

    const currentBill = { id: billSnap.id, ...billSnap.data() };
    let lockRef = null;
    let lockSnap = null;

    if (!currentBill.isTakeaway) {
      const date = currentBill.date || getVietnamDateString();
      const tableNumber = normalizeTableNumber(currentBill.tableNumber);
      lockRef = getActiveBillLockRef(date, tableNumber);
      lockSnap = await transaction.get(lockRef);
    }

    transaction.delete(billRef);

    if (lockRef && lockSnap?.exists() && lockSnap.data()?.billId === bill.id) {
      transaction.delete(lockRef);
    }
  });
};

export const createTakeawayOrder = async (
  items,
  totalRevenue,
  totalProfit,
  note = '',
  totalCost = 0,
  totalFixedCost = 0
) => {
  const today = getVietnamDateString();

  const existingSnap = await getDocs(
    query(collection(db, 'bills'), where('date', '==', today), where('isTakeaway', '==', true))
  );
  const existingMaxNumber = existingSnap.docs.reduce((max, billDoc) => {
    const number = Number(billDoc.data()?.takeawayNumber) || 0;
    return Math.max(max, number);
  }, 0);

  let takeawayNumber = null;

  await runTransaction(db, async (transaction) => {
    const counterRef = getTakeawayCounterRef(today);
    const counterSnap = await transaction.get(counterRef);
    const counterLastNumber = counterSnap.exists()
      ? Number(counterSnap.data()?.lastNumber) || 0
      : 0;

    takeawayNumber = Math.max(counterLastNumber, existingMaxNumber) + 1;

    const billRef = doc(collection(db, 'bills'));
    transaction.set(billRef, {
      createdAt: serverTimestamp(),
      date: today,
      tableNumber: 9000 + takeawayNumber,
      status: 'pending',
      kitchenStatus: 'in_progress',
      items: normalizeItems(items),
      totalRevenue,
      totalProfit,
      totalCost,
      totalFixedCost,
      isTakeaway: true,
      takeawayNumber,
      ...(note?.trim() ? { note: note.trim() } : {}),
    });

    transaction.set(counterRef, {
      date: today,
      lastNumber: takeawayNumber,
      updatedAt: serverTimestamp(),
      ...(counterSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true });
  });

  return takeawayNumber;
};
