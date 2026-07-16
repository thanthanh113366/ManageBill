import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { calculateKitchenQueue, filterByTable, calculateKitchenStats } from '../utils/kitchenOptimizer';
import { getVietnamDateString } from '../utils/businessDate';

const getBillItemKey = (item) =>
  item.orderItemId || item.menuItemId || item.customItemId || item.customDescription;

const itemMatchesKey = (item, itemKey) => getBillItemKey(item) === itemKey;
/**
 * Custom hook để quản lý đơn hàng bếp real-time
 */
export const useKitchenOrders = (selectedTable = null, selectedDate = null) => {
  const { tables, orderItems: contextOrderItems, menuItems } = useApp();
  const [bills, setBills] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [kitchenQueue, setKitchenQueue] = useState([]);
  const [filteredQueue, setFilteredQueue] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    cooking: 0,
    ready: 0,
    avgWaitingTime: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load bills real-time
  useEffect(() => {
    const dateToUse = selectedDate || getVietnamDateString();
    
    const billsQuery = query(
      collection(db, 'bills'),
      where('date', '==', dateToUse),
      where('status', 'in', ['pending', 'in_progress']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeBills = onSnapshot(
      billsQuery,
      (snapshot) => {
        const billsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setBills(billsData);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading bills:', error);
        setError('Lỗi tải danh sách đơn hàng');
        setLoading(false);
      }
    );

    return () => unsubscribeBills();
  }, [selectedDate]);

  // Use orderItems from AppContext instead of opening a separate listener
  useEffect(() => {
    setOrderItems(contextOrderItems);
  }, [contextOrderItems]);

  // Tính toán kitchen queue khi có thay đổi
  useEffect(() => {
    if (!loading && orderItems.length >= 0) {
      try {
        const queue = calculateKitchenQueue(bills, orderItems, menuItems);
        setKitchenQueue(queue);

        const filtered = filterByTable(queue, selectedTable);
        setFilteredQueue(filtered);

        const kitchenStats = calculateKitchenStats(filtered);
        setStats(kitchenStats);
      } catch (error) {
        console.error('Error calculating kitchen queue:', error);
        setError('Lỗi tính toán danh sách món');
      }
    }
  }, [bills, orderItems, menuItems, selectedTable, loading]);

  /**
   * Bắt đầu làm món
   * @param {string} billId - ID của bill
   * @param {string} orderItemId - ID của order item
   */
  const startCooking = async (billId, orderItemId) => {
    try {
      const billRef = doc(db, 'bills', billId);

      await runTransaction(db, async (transaction) => {
        const billSnap = await transaction.get(billRef);
        if (!billSnap.exists()) return;

        const bill = billSnap.data();
        const updatedItems = (bill.items || []).map(item => {
          if (itemMatchesKey(item, orderItemId)) {
            return {
              ...item,
              kitchenStatus: 'cooking',
              startTime: new Date()
            };
          }
          return item;
        });

        transaction.update(billRef, {
          items: updatedItems,
          kitchenStatus: 'in_progress',
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      console.error('Error starting cooking:', error);
      setError('Loi cap nhat trang thai mon an');
    }
  };

  /**
   * Undo món đã hoàn thành (chuyển từ ready về cooking)
   * @param {string} billId - ID của bill
   * @param {string} orderItemId - ID của order item
   */
  const undoCompleted = async (billId, orderItemId) => {
    try {
      const billRef = doc(db, 'bills', billId);

      await runTransaction(db, async (transaction) => {
        const billSnap = await transaction.get(billRef);
        if (!billSnap.exists()) return;

        const bill = billSnap.data();
        const updatedItems = (bill.items || []).map(item => {
          if (itemMatchesKey(item, orderItemId)) {
            const completedCount = item.completedCount || 0;
            const newCompletedCount = Math.max(0, completedCount - 1);

            return {
              ...item,
              completedCount: newCompletedCount,
              kitchenStatus: 'cooking',
              completedTime: null
            };
          }
          return item;
        });

        transaction.update(billRef, {
          items: updatedItems,
          kitchenStatus: 'in_progress',
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      console.error('Error undoing completed item:', error);
      setError('Loi khi undo mon an');
    }
  };

  /**
   * Hoàn thành món (1 phần trong batch)
   * @param {string} billId - ID của bill
   * @param {string} orderItemId - ID của order item
   * @param {number} batchOrder - Thứ tự trong batch (1, 2, 3...)
   */
  const completeCooking = async (billId, orderItemId, batchOrder = 1) => {
    try {
      const billRef = doc(db, 'bills', billId);

      await runTransaction(db, async (transaction) => {
        const billSnap = await transaction.get(billRef);
        if (!billSnap.exists()) return;

        const bill = billSnap.data();
        const updatedItems = (bill.items || []).map(item => {
          if (itemMatchesKey(item, orderItemId)) {
            const completedCount = item.completedCount || 0;
            const quantity = item.quantity || 1;
            const newCompletedCount = Math.min(quantity, completedCount + 1);

            if (newCompletedCount >= quantity) {
              return {
                ...item,
                kitchenStatus: 'ready',
                completedTime: new Date(),
                completedCount: newCompletedCount
              };
            }

            return {
              ...item,
              completedCount: newCompletedCount,
              kitchenStatus: 'cooking'
            };
          }
          return item;
        });

        const allReady = updatedItems.every(item =>
          item.kitchenStatus === 'ready' ||
          (item.completedCount || 0) >= (item.quantity || 1)
        );

        transaction.update(billRef, {
          items: updatedItems,
          kitchenStatus: allReady ? 'completed' : 'in_progress',
          updatedAt: serverTimestamp()
        });
      });
    } catch (error) {
      console.error('Error completing cooking:', error);
      setError('Loi cap nhat trang thai mon an');
    }
  };

  /**
   * Lấy danh sách bàn có đơn
   * @returns {Array} - Danh sách số bàn
   */
  const getAvailableTables = () => {
    const tables = new Set();
    kitchenQueue.forEach(item => {
      tables.add(item.tableNumber);
    });
    return Array.from(tables).sort((a, b) => a - b);
  };

  /**
   * Lấy món tiếp theo cần làm
   * @returns {Object|null} - Món tiếp theo
   */
  const getNextItem = () => {
    return filteredQueue.find(item => item.kitchenStatus === 'pending') || null;
  };

  /**
   * Lấy món đang làm
   * @returns {Array} - Danh sách món đang làm
   */
  const getCookingItems = () => {
    return filteredQueue.filter(item => item.kitchenStatus === 'cooking');
  };

  return {
    // Data
    bills,
    kitchenQueue: filteredQueue,
    stats,
    tables,
    availableTables: getAvailableTables(),
    nextItem: getNextItem(),
    cookingItems: getCookingItems(),

    // States
    loading,
    error,

    // Actions
    startCooking,
    completeCooking,
    undoCompleted,

    // Utils
    clearError: () => setError(null)
  };
};
