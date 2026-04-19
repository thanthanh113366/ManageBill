import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Clock, Receipt, CheckCircle, ArrowLeftRight, ChevronDown, X, UtensilsCrossed } from 'lucide-react';

const PublicBill = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [billDetails, setBillDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [showTableSwitcher, setShowTableSwitcher] = useState(false);
  const [defaultQR, setDefaultQR] = useState('/my_qr_1.jpg');

  // Load default QR from localStorage
  useEffect(() => {
    const savedQR = localStorage.getItem('defaultPaymentQR') || '/my_qr_1.jpg';
    setDefaultQR(savedQR);
  }, []);

  // Load tables for table switching
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'tables'), orderBy('number')), 
      (snapshot) => {
        const tablesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setTables(tablesData);
      }
    );

    return () => unsubscribe();
  }, []);

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

  // Load order items for reference
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'orderItems'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrderItems(items);
    });

    return () => unsubscribe();
  }, []);

  // Load current bill for table
  useEffect(() => {
    if (!tableNumber) return;

    const today = new Date().toISOString().split('T')[0];

    // Query tất cả bills của ngày hôm nay (không filter tableNumber trong query)
    const q = query(
      collection(db, 'bills'),
      where('date', '==', today)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allBillsToday = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter manually để hỗ trợ cả string và number
      const bills = allBillsToday.filter(bill => {
          // So sánh tableNumber: hỗ trợ cả string và number
          const billTableNumber = bill.tableNumber;
          const targetTableNumber = parseInt(tableNumber);
          
          return billTableNumber === targetTableNumber || 
                 billTableNumber === tableNumber ||
                 String(billTableNumber) === String(targetTableNumber);
        });
      
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
    if (!bill) {
      setBillDetails([]);
      return;
    }

    // Chờ cả menuItems và orderItems load xong để tránh race condition
    if (menuItems.length === 0 || orderItems.length === 0) {
      return;
    }

    const details = bill.items.map(item => {
      // Handle regular menu items
      if (item.menuItemId) {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        if (!menuItem) {
          console.warn(`MenuItems not found: ${item.menuItemId}`);
          return null;
        }

        const itemTotal = menuItem.price * item.quantity;
        const taxAmount = itemTotal * (menuItem.tax / 100);
        const finalPrice = itemTotal + taxAmount;

        return {
          ...item,
          menuItem,
          itemTotal,
          taxAmount,
          finalPrice,
          type: 'menu'
        };
      }
      // Handle order items (new flow)
      else if (item.orderItemId) {
        const orderItem = orderItems.find(o => o.id === item.orderItemId);
        if (!orderItem) {
          console.warn(`OrderItem not found: ${item.orderItemId}`);
          // Fallback: hiển thị với thông tin cơ bản thay vì return null
          return {
            ...item,
            orderItem: { name: 'Món không xác định', id: item.orderItemId },
            parentMenuItem: null,
            itemTotal: 25000 * item.quantity,
            taxAmount: 0,
            finalPrice: 25000 * item.quantity,
            price: 25000,
            tax: 0,
            type: 'orderItem'
          };
        }

        // Resolve price from parent menu item when available
        const parent = orderItem.parentMenuItemId
          ? menuItems.find(m => m.id === orderItem.parentMenuItemId)
          : null;

        const price = parent?.price ?? 25000; // default for standalone items
        const tax = parent?.tax ?? 0;

        const itemTotal = price * item.quantity;
        const taxAmount = itemTotal * (tax / 100);
        const finalPrice = itemTotal + taxAmount;


        return {
          ...item,
          orderItem,
          parentMenuItem: parent || null,
          itemTotal,
          taxAmount,
          finalPrice,
          price,
          tax,
          type: 'orderItem'
        };
      }
      // Handle custom items
      else if (item.customDescription) {
        return {
          ...item,
          customDescription: item.customDescription,
          customAmount: item.customAmount,
          itemTotal: item.customAmount,
          taxAmount: 0,
          finalPrice: item.customAmount,
          type: 'custom'
        };
      }
      return null;
    }).filter(Boolean);

    setBillDetails(details);
  }, [bill, menuItems, orderItems]);

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

  // Xem hóa đơn bàn khác (chỉ điều hướng, không thay đổi dữ liệu)
  const handleTableSwitch = (newTableNumber) => {
    navigate(`/bill/${newTableNumber}`);
    setShowTableSwitcher(false);
  };

  // Lấy tất cả bàn khác
  const getAvailableTables = () => {
    return tables.filter(table => table.number.toString() !== tableNumber);
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

  const totals = bill ? calculateTotal() : { subtotal: 0, totalTax: 0, total: 0 };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto space-y-6">

        {/* Nút đổi bàn + nội dung chính */}
        {!bill ? (
          /* Trạng thái chưa có hóa đơn */
          <div className="bg-white rounded-lg shadow-lg p-8 text-center relative">
            {getAvailableTables().length > 0 && (
              <button
                onClick={() => setShowTableSwitcher(true)}
                className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Chuyển bàn khác"
              >
                <ArrowLeftRight size={20} />
              </button>
            )}
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
        ) : (
          /* Trạng thái có hóa đơn */
          <>
            {/* Header */}
            <div className="bg-white rounded-t-lg shadow-lg p-6 text-center border-b relative">
              {getAvailableTables().length > 0 && (
                <button
                  onClick={() => setShowTableSwitcher(true)}
                  className="absolute top-4 right-4 p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-colors"
                  title="Đổi bàn"
                >
                  <ArrowLeftRight size={20} />
                </button>
              )}
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
                {billDetails.map((item, index) => {
                  if (item.type === 'menu') {
                    return (
                      <div key={index} className="px-6 py-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.menuItem.name}</h4>
                            <div className="text-sm text-gray-500 mt-1">
                              {formatCurrency(item.menuItem.price)} x {item.quantity}
                              {item.menuItem.tax > 0 && (
                                <span className="ml-2 text-xs">(Thuế {item.menuItem.tax}%)</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900">{formatCurrency(item.finalPrice)}</div>
                            {item.taxAmount > 0 && (
                              <div className="text-xs text-gray-500">+{formatCurrency(item.taxAmount)} thuế</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  } else if (item.type === 'orderItem') {
                    return (
                      <div key={index} className="px-6 py-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {item.orderItem.name}
                            </h4>
                            <div className="text-sm text-gray-500 mt-1">
                              {formatCurrency(item.price)} x {item.quantity}
                              {item.tax > 0 && (
                                <span className="ml-2 text-xs">(Thuế {item.tax}%)</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium text-gray-900">{formatCurrency(item.finalPrice)}</div>
                            {item.taxAmount > 0 && (
                              <div className="text-xs text-gray-500">+{formatCurrency(item.taxAmount)} thuế</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  } else if (item.type === 'custom') {
                    return (
                      <div key={index} className="px-6 py-4 bg-blue-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.customDescription}</h4>
                            <div className="text-sm text-gray-500 mt-1">
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                Món khác
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${item.customAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {item.customAmount >= 0 ? '+' : ''}{formatCurrency(item.customAmount)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
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
                    <span className="text-lg font-semibold text-gray-900">Tổng cộng:</span>
                    <span className="text-xl font-bold text-indigo-600">{formatCurrency(totals.total)}</span>
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Chờ thanh toán</h3>
                  <p className="text-gray-600 text-sm">
                    Vui lòng gọi nhân viên để thanh toán hoặc đặt thêm món
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500">
                    💡 Hóa đơn này sẽ cập nhật tự động khi có thêm món mới
                  </p>
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => navigate(`/order/${tableNumber}`)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center shadow-md"
                  >
                    <UtensilsCrossed className="w-5 h-5 mr-2" />
                    🍽️ Gọi thêm món
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Nút gọi món - chỉ hiện khi chưa có hóa đơn */}
        {!bill && (
          <button
            onClick={() => navigate(`/order/${tableNumber}`)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center shadow-md"
          >
            <UtensilsCrossed className="w-5 h-5 mr-2" />
            🍽️ Gọi món
          </button>
        )}

        {/* QR Code - dùng chung */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mã QR thanh toán</h3>
            <div className="flex justify-center mb-4">
              <img
                src={defaultQR}
                alt="QR Code thanh toán"
                className="w-48 h-48 object-contain border border-gray-200 rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm" style={{display: 'none'}}>
                QR Code không khả dụng
              </div>
            </div>
            <p className="text-sm text-gray-600">Quét mã QR để thanh toán qua ví điện tử</p>
          </div>
        </div>

        {/* Footer - dùng chung */}
        <div className="text-center text-sm text-gray-500">
          <p>Cảm ơn quý khách đã sử dụng dịch vụ!</p>
        </div>
      </div>

      {/* Modal đổi bàn - dùng chung cho cả 2 trạng thái */}
      {showTableSwitcher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-indigo-500" />
                Đổi bàn
              </h3>
              <button
                onClick={() => setShowTableSwitcher(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-3">Chọn bàn muốn xem hóa đơn:</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getAvailableTables().map((table) => (
                  <button
                    key={table.id}
                    onClick={() => handleTableSwitch(table.number)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">Bàn {table.number}</div>
                        <div className="text-sm text-gray-500">
                          {table.seats} chỗ ngồi
                          {table.description && ` • ${table.description}`}
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 text-indigo-400 transform -rotate-90" />
                    </div>
                  </button>
                ))}
              </div>
              {getAvailableTables().length === 0 && (
                <p className="text-center text-gray-500 py-8">Không có bàn khác để chuyển</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicBill; 