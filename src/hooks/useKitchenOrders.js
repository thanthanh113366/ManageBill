import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { calculateKitchenQueue, filterByTable, calculateKitchenStats } from '../utils/kitchenOptimizer';

/**
 * Custom hook để quản lý đơn hàng bếp real-time
 */
export const useKitchenOrders = (selectedTable = null, selectedDate = null) => {
  const [bills, setBills] = useState([]);
  const [menuTimings, setMenuTimings] = useState([]);
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
    const dateToUse = selectedDate || new Date().toISOString().split('T')[0];
    
    const billsQuery = query(
      collection(db, 'bills'),
      where('date', '==', dateToUse),
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

  // Load menu timings (chỉ load 1 lần)
  useEffect(() => {
    const timingsQuery = query(collection(db, 'menuItemTimings'));

    const unsubscribeTimings = onSnapshot(
      timingsQuery,
      (snapshot) => {
        const timingsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMenuTimings(timingsData);
      },
      (error) => {
        console.error('Error loading menu timings:', error);
        setError('Lỗi tải thông tin timing món ăn');
      }
    );

    return () => unsubscribeTimings();
  }, []);

  // Load order items (chỉ load 1 lần)
  useEffect(() => {
    const orderItemsQuery = query(collection(db, 'orderItems'));

    const unsubscribeOrderItems = onSnapshot(
      orderItemsQuery,
      (snapshot) => {
        const orderItemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrderItems(orderItemsData);
      },
      (error) => {
        console.error('Error loading order items:', error);
        setError('Lỗi tải danh sách món đặt hàng');
      }
    );

    return () => unsubscribeOrderItems();
  }, []);

  // Tính toán kitchen queue khi có thay đổi
  useEffect(() => {
    if (bills.length > 0 && menuTimings.length > 0 && orderItems.length > 0) {
      try {
        // Hiển thị TẤT CẢ bills trong ngày (kể cả completed) để thấy món đã xong
        const queue = calculateKitchenQueue(bills, menuTimings, orderItems);
        setKitchenQueue(queue);
        
        // Lọc theo bàn nếu có chọn
        const filtered = filterByTable(queue, selectedTable);
        setFilteredQueue(filtered);
        
        // Tính stats
        const kitchenStats = calculateKitchenStats(filtered);
        setStats(kitchenStats);
      } catch (error) {
        console.error('Error calculating kitchen queue:', error);
        setError('Lỗi tính toán danh sách món');
      }
    }
  }, [bills, menuTimings, orderItems, selectedTable]);

  /**
   * Bắt đầu làm món
   * @param {string} billId - ID của bill
   * @param {string} orderItemId - ID của order item
   */
  const startCooking = async (billId, orderItemId) => {
    try {
      const billRef = doc(db, 'bills', billId);
      
      // Cập nhật status của item thành "cooking"
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        const updatedItems = bill.items.map(item => {
          if (item.orderItemId === orderItemId || item.menuItemId === orderItemId) {
            return {
              ...item,
              kitchenStatus: 'cooking',
              startTime: new Date()
            };
          }
          return item;
        });

        await updateDoc(billRef, {
          items: updatedItems,
          kitchenStatus: 'in_progress',
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error starting cooking:', error);
      setError('Lỗi cập nhật trạng thái món ăn');
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
      
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        const updatedItems = bill.items.map(item => {
          if (item.orderItemId === orderItemId || item.menuItemId === orderItemId) {
            const completedCount = item.completedCount || 0;
            const newCompletedCount = Math.max(0, completedCount - 1);
            
            return {
              ...item,
              completedCount: newCompletedCount,
              kitchenStatus: 'cooking', // Chuyển về cooking
              completedTime: null // Xóa thời gian hoàn thành
            };
          }
          return item;
        });

        await updateDoc(billRef, {
          items: updatedItems,
          kitchenStatus: 'in_progress', // Bill chuyển về in_progress
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error undoing completed item:', error);
      setError('Lỗi khi undo món ăn');
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
      
      // Cập nhật status của item thành "ready"
      const bill = bills.find(b => b.id === billId);
      if (bill) {
        const updatedItems = bill.items.map(item => {
          if (item.orderItemId === orderItemId || item.menuItemId === orderItemId) {
            // Nếu chưa có completedCount, tạo mới
            const completedCount = item.completedCount || 0;
            const newCompletedCount = completedCount + 1;
            
            // Nếu đã hoàn thành tất cả phần trong batch
            if (newCompletedCount >= item.quantity) {
              return {
                ...item,
                kitchenStatus: 'ready',
                completedTime: new Date(),
                completedCount: newCompletedCount
              };
            } else {
              // Chỉ hoàn thành 1 phần, vẫn giữ status cooking
              return {
                ...item,
                completedCount: newCompletedCount
              };
            }
          }
          return item;
        });

        // Kiểm tra xem tất cả items đã ready chưa
        // Chỉ kiểm tra items có quantity > 0 (không kiểm tra pending items)
        const allReady = updatedItems.every(item => 
          item.kitchenStatus === 'ready' || 
          (item.completedCount || 0) >= (item.quantity || 1)
        );

        await updateDoc(billRef, {
          items: updatedItems,
          kitchenStatus: allReady ? 'completed' : 'in_progress',
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error completing cooking:', error);
      setError('Lỗi cập nhật trạng thái món ăn');
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
    kitchenQueue: filteredQueue,
    stats,
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
