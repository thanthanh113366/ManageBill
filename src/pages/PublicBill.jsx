import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Clock, Receipt, CheckCircle } from 'lucide-react';

const PublicBill = () => {
  const { tableNumber } = useParams();
  const [bill, setBill] = useState(null);
  const [billDetails, setBillDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);

  // Load menu items for reference
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'menuItems'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMenuItems(items);
    });

    return () => unsubscribe();
  }, []);

  // Load current bill for table
  useEffect(() => {
    if (!tableNumber) return;

    const today = new Date().toISOString().split('T')[0];

    const q = query(
      collection(db, 'bills'),
      where('tableNumber', '==', tableNumber),
      where('date', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter chỉ bills chưa thanh toán (hoặc chưa có status field)
      const pendingBills = bills.filter(bill => 
        !bill.status || bill.status === 'pending'
      );
      
      // Lấy bill mới nhất chưa thanh toán
      const activeBill = pendingBills.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return timeB - timeA;
      })[0];

      setBill(activeBill || null);
      setLoading(false);
    }, (error) => {
      console.error('Error loading bill:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tableNumber]);

  // Load bill details when bill changes
  useEffect(() => {
    if (!bill || !menuItems.length) {
      setBillDetails([]);
      return;
    }

    const details = bill.items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      if (!menuItem) return null;

      const itemTotal = menuItem.price * item.quantity;
      const taxAmount = itemTotal * (menuItem.tax / 100);
      const finalPrice = itemTotal + taxAmount;

      return {
        ...item,
        menuItem,
        itemTotal,
        taxAmount,
        finalPrice
      };
    }).filter(Boolean);

    setBillDetails(details);
  }, [bill, menuItems]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTotal = () => {
    const subtotal = billDetails.reduce((sum, item) => sum + item.itemTotal, 0);
    const totalTax = billDetails.reduce((sum, item) => sum + item.taxAmount, 0);
    const total = subtotal + totalTax;
    
    return { subtotal, totalTax, total };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải hóa đơn...</p>
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Chưa có hóa đơn
          </h2>
          <p className="text-gray-600 mb-4">
            Bàn {tableNumber} chưa có hóa đơn nào hoặc đã thanh toán xong.
          </p>
          <div className="text-center text-sm text-gray-500">
            <Clock className="w-4 h-4 inline mr-1" />
            Hóa đơn sẽ hiển thị tự động khi có order mới
          </div>
        </div>
      </div>
    );
  }

  const totals = calculateTotal();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white rounded-t-lg shadow-lg p-6 text-center border-b">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Quán Ốc
          </h1>
          <p className="text-gray-600">
            Hóa đơn bàn {tableNumber}
          </p>
          <p className="text-sm text-gray-500">
            Thời gian: {formatTime(bill.createdAt)}
          </p>
          <div className="mt-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
              <Clock className="w-4 h-4 mr-1" />
              Chưa thanh toán
            </span>
          </div>
        </div>

        {/* Bill Items */}
        <div className="bg-white shadow-lg">
          <div className="px-6 py-4 border-b">
            <h3 className="font-semibold text-gray-900">Chi tiết đơn hàng</h3>
          </div>
          
          <div className="divide-y divide-gray-100">
            {billDetails.map((item, index) => (
              <div key={index} className="px-6 py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {item.menuItem.name}
                    </h4>
                    <div className="text-sm text-gray-500 mt-1">
                      {formatCurrency(item.menuItem.price)} x {item.quantity}
                      {item.menuItem.tax > 0 && (
                        <span className="ml-2 text-xs">
                          (Thuế {item.menuItem.tax}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(item.finalPrice)}
                    </div>
                    {item.taxAmount > 0 && (
                      <div className="text-xs text-gray-500">
                        +{formatCurrency(item.taxAmount)} thuế
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="bg-white shadow-lg border-t">
          <div className="px-6 py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tạm tính:</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {totals.totalTax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Thuế:</span>
                <span>{formatCurrency(totals.totalTax)}</span>
              </div>
            )}
            <div className="border-t pt-2">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900">
                  Tổng cộng:
                </span>
                <span className="text-xl font-bold text-indigo-600">
                  {formatCurrency(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Info */}
        <div className="bg-white rounded-b-lg shadow-lg p-6">
          <div className="text-center">
            <div className="mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Chờ thanh toán
              </h3>
              <p className="text-gray-600 text-sm">
                Vui lòng gọi nhân viên để thanh toán hoặc đặt thêm món
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500">
                💡 Hóa đơn này sẽ cập nhật tự động khi có thêm món mới
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <p>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
        </div>
      </div>
    </div>
  );
};

export default PublicBill; 