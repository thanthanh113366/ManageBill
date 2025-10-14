import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { Calendar, FileText, Eye, ChevronDown, ChevronUp, Edit, CheckCircle, Clock, ExternalLink, DollarSign, TrendingUp, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import EditBill from '../components/EditBill';

const BillManagement = () => {
  const { menuItems, tables } = useApp();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedBill, setExpandedBill] = useState(null);
  const [billDetails, setBillDetails] = useState({});
  const [editingBill, setEditingBill] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(null);
  const [showPublicBillModal, setShowPublicBillModal] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'bills'),
      where('date', '==', selectedDate),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sắp xếp: đơn chưa thanh toán lên đầu, giữ nguyên logic thời gian trong mỗi nhóm
      const sortedBills = billsData.sort((a, b) => {
        // Kiểm tra trạng thái thanh toán
        const aIsPending = !a.status || a.status === 'pending';
        const bIsPending = !b.status || b.status === 'pending';
        
        // Nếu một đơn pending và một đơn đã thanh toán, đưa pending lên đầu
        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;
        
        // Nếu cùng trạng thái, sắp xếp theo thời gian (mới nhất lên đầu)
        const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return timeB - timeA;
      });
      
      setBills(sortedBills);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate]);

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

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleMarkAsPaid = async (bill) => {
    if (processingPayment === bill.id) return;
    
    // Sử dụng toast để hiển thị confirmation
    const confirmPayment = () => {
      toast.dismiss(); // Đóng toast confirmation
      setProcessingPayment(bill.id);
      
      const processPayment = async () => {
        try {
          await updateDoc(doc(db, 'bills', bill.id), {
            status: 'paid',
            paidAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          toast.success(`Đã thanh toán`, {
            position: "top-right",
            autoClose: 2000,
          });
        } catch (error) {
          console.error('Error marking bill as paid:', error);
          toast.error('Có lỗi xảy ra khi cập nhật trạng thái thanh toán', {
            position: "top-right",
            autoClose: 3000,
          });
        } finally {
          setProcessingPayment(null);
        }
      };

      processPayment();
    };

    // Show confirmation toast
    toast.warn(
      <div>
        <p className="font-medium mb-2">
          Xác nhận thanh toán đơn hàng #{bill.id.slice(-6)}?
        </p>
        <p className="text-sm text-gray-600 mb-3">
          Bàn {bill.tableNumber} - {formatCurrency(bill.totalRevenue)}
        </p>
        <div className="flex gap-2">
          <button
            onClick={confirmPayment}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
          >
            Xác nhận
          </button>
          <button
            onClick={() => toast.dismiss()}
            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
          >
            Hủy
          </button>
        </div>
      </div>,
      {
        position: "top-center",
        autoClose: false,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false,
      }
    );
  };

  const handleViewDetails = async (bill) => {
    if (expandedBill === bill.id) {
      setExpandedBill(null);
      return;
    }

    setExpandedBill(bill.id);
    
    if (!billDetails[bill.id]) {
      // Load detailed information
      const detailedItems = await Promise.all(
        bill.items.map(async (item) => {
          // Handle regular menu items
          if (item.menuItemId) {
            const menuItem = menuItems.find(m => m.id === item.menuItemId);
            if (menuItem) {
              const itemRevenue = menuItem.price * item.quantity;
              const taxAmount = itemRevenue * (menuItem.tax / 100);
              const profitPerItem = menuItem.price - (menuItem.costPrice || 0) - (menuItem.fixedCost || 0) - taxAmount;
              const itemProfit = profitPerItem * item.quantity;

              return {
                ...item,
                menuItem,
                itemRevenue,
                itemProfit,
                taxAmount,
                type: 'menu'
              };
            }
          }
          // Handle order items linked to parent menu item
          else if (item.orderItemId) {
            // We only display the parent menu item in details
            // We need access to orderItems; fetch on demand
            // Import firestore inside function to avoid top-level changes
            try {
              const { getDocs, collection } = await import('firebase/firestore');
              const { db } = await import('../config/firebase');
              const snapshot = await getDocs(collection(db, 'orderItems'));
              const orderItemDoc = snapshot.docs.find(d => d.id === item.orderItemId);
              const orderItem = orderItemDoc ? { id: orderItemDoc.id, ...orderItemDoc.data() } : null;
              const parent = orderItem?.parentMenuItemId ? menuItems.find(m => m.id === orderItem.parentMenuItemId) : null;
              if (parent) {
                const itemRevenue = parent.price * item.quantity;
                const taxAmount = itemRevenue * ((parent.tax || 0) / 100);
                const profitPerItem = parent.price - (parent.costPrice || 0) - (parent.fixedCost || 0) - taxAmount;
                const itemProfit = profitPerItem * item.quantity;
                return {
                  ...item,
                  menuItem: parent,
                  itemRevenue,
                  itemProfit,
                  taxAmount,
                  type: 'menu'
                };
              } else if (orderItem) {
                // Standalone item (e.g., Lai rai) – show its own name with default price
                const price = 25000;
                const itemRevenue = price * item.quantity;
                return {
                  ...item,
                  menuItem: { id: `standalone-${orderItem.id}`, name: orderItem.name, price, tax: 0 },
                  itemRevenue,
                  itemProfit: itemRevenue,
                  taxAmount: 0,
                  type: 'menu'
                };
              }
            } catch (e) {
              // ignore
            }
          }
          // Handle custom items
          else if (item.customDescription) {
            return {
              ...item,
              itemRevenue: item.customAmount,
              itemProfit: item.customAmount,
              type: 'custom'
            };
          }
          return null;
        })
      );

      setBillDetails(prev => ({
        ...prev,
        [bill.id]: detailedItems.filter(item => item !== null)
      }));
    }
  };

  const getTotalSummary = () => {
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalRevenue, 0);
    const totalProfit = bills.reduce((sum, bill) => sum + (bill.totalProfit || 0), 0);
    const totalBills = bills.length;
    const paidBills = bills.filter(bill => bill.status === 'paid').length;
    const pendingBills = bills.filter(bill => bill.status === 'pending').length;
    
    // Calculate total cost price and fixed cost from all bill items
    let totalCostPrice = 0;
    let totalFixedCost = 0;
    
    bills.forEach(bill => {
      bill.items.forEach(item => {
        if (item.menuItemId) {
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          if (menuItem) {
            totalCostPrice += (menuItem.costPrice || 0) * item.quantity;
            totalFixedCost += (menuItem.fixedCost || 0) * item.quantity;
          }
        }
      });
    });
    
    return { 
      totalRevenue, 
      totalProfit, 
      totalCostPrice, 
      totalFixedCost, 
      totalBills, 
      paidBills, 
      pendingBills 
    };
  };

  const handleEditBill = (bill) => {
    setEditingBill(bill);
  };

  const handleBillUpdated = () => {
    // Bills will be automatically updated via the onSnapshot listener
    // No need to manually refetch data
  };

  const handleOpenPublicBill = (tableNumber) => {
    window.open(`/bill/${tableNumber}`, '_blank');
    setShowPublicBillModal(false);
  };

  const getActiveTables = () => {
    // Get tables that have active bills for today
    const activeTables = new Set();
    bills.filter(bill => bill.status === 'pending').forEach(bill => {
      if (bill.tableNumber) {
        activeTables.add(bill.tableNumber);
      }
    });
    
    return Array.from(activeTables).sort((a, b) => a - b);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  const summary = getTotalSummary();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý đơn hàng</h1>
            <p className="text-gray-600 mt-1">
              Xem, chỉnh sửa và quản lý các đơn hàng theo ngày
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPublicBillModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              title="Mở trang khách hàng"
            >
              <ExternalLink size={16} />
              <span>Trang khách</span>
            </button>
            
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bills List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Đơn hàng ngày {formatDate(selectedDate)}
          </h2>
        </div>

        {bills.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Không có đơn hàng nào
            </h3>
            <p className="text-gray-600">
              Chưa có đơn hàng nào được tạo trong ngày này
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {bills.map((bill) => (
              <div key={bill.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            Đơn hàng #{bill.id.slice(-6)}
                          </p>
                          {bill.tableNumber && (
                            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                              Bàn {bill.tableNumber}
                            </span>
                          )}
                          {bill.status === 'paid' ? (
                            <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                              ✓ Đã thanh toán
                            </span>
                          ) : (
                            <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full">
                              ⏱ Chờ thanh toán
                            </span>
                          )}
                          {bill.updatedAt && (
                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                              Đã sửa
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>Tạo: {formatTime(bill.createdAt)}</div>
                          {bill.updatedAt && (
                            <div>Sửa: {formatTime(bill.updatedAt)}</div>
                          )}
                          {bill.paidAt && (
                            <div className="text-green-600">
                              Thanh toán: {formatTime(bill.paidAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="text-left sm:text-right">
                      <p className="text-sm text-gray-600">Doanh thu</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(bill.totalRevenue)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {bill.status === 'pending' && (
                        <button
                          onClick={() => handleMarkAsPaid(bill)}
                          disabled={processingPayment === bill.id}
                          className="flex items-center gap-1 px-3 py-2 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md border border-green-200 disabled:opacity-50 transition-colors"
                          title="Đánh dấu đã thanh toán"
                        >
                          {processingPayment === bill.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                          ) : (
                            <CheckCircle size={16} />
                          )}
                          <span className="hidden sm:inline">Thanh toán</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleEditBill(bill)}
                        className="flex items-center gap-1 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md border border-blue-200 transition-colors"
                        title="Chỉnh sửa đơn hàng"
                      >
                        <Edit size={16} />
                        <span className="hidden sm:inline">Sửa</span>
                      </button>
                      <button
                        onClick={() => handleViewDetails(bill)}
                        className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md border border-gray-200 transition-colors"
                        title="Xem chi tiết"
                      >
                        {expandedBill === bill.id ? (
                          <>
                            <ChevronUp size={16} />
                            <span className="hidden sm:inline">Ẩn</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={16} />
                            <span className="hidden sm:inline">Chi tiết</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedBill === bill.id && billDetails[bill.id] && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">
                      Chi tiết đơn hàng
                    </h4>
                    <div className="space-y-2">
                      {billDetails[bill.id].map((item, index) => {
                        if (item.type === 'menu') {
                          return (
                            <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-md">
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">
                                    {item.menuItem.name}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    x {item.quantity}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                                  <span>{formatCurrency(item.menuItem.price)}/món</span>
                                  <span>Doanh thu: {formatCurrency(item.itemRevenue)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        } else if (item.type === 'custom') {
                          return (
                            <div key={index} className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-md border border-blue-200">
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-900">
                                    {item.customDescription}
                                  </span>
                                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    Món khác
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                                  <span>Tùy chỉnh</span>
                                  <span className={`font-medium ${item.customAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {item.customAmount >= 0 ? '+' : ''}{formatCurrency(item.customAmount)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Cards - Moved to bottom */}
      <div className="space-y-6">
        {/* Operational Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Tổng đơn</p>
                <p className="text-2xl font-bold text-gray-900">{summary.totalBills}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Chờ thanh toán</p>
                <p className="text-2xl font-bold text-yellow-600">{summary.pendingBills}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Đã thanh toán</p>
                <p className="text-2xl font-bold text-green-600">{summary.paidBills}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Doanh thu</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(summary.totalRevenue)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Lợi nhuận</p>
                <p className="text-xl font-bold text-emerald-600">
                  {formatCurrency(summary.totalProfit)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Chi phí cố định</p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency(summary.totalFixedCost)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <div className="w-6 h-6 text-red-600 font-bold text-lg">₫</div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Vốn</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(summary.totalCostPrice)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Bill Modal */}
      {editingBill && (
        <EditBill
          bill={editingBill}
          onClose={() => setEditingBill(null)}
          onUpdated={handleBillUpdated}
        />
      )}

      {/* Public Bill Modal */}
      {showPublicBillModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Mở trang khách hàng
              </h3>
              <button
                onClick={() => setShowPublicBillModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FileText size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Chọn bàn để mở trang xem hóa đơn cho khách hàng:
              </p>
              
              {/* Active Tables */}
              {getActiveTables().length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    Bàn có đơn hàng chưa thanh toán:
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {getActiveTables().map((tableNumber) => (
                      <button
                        key={tableNumber}
                        onClick={() => handleOpenPublicBill(tableNumber)}
                        className="w-full text-left p-3 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">
                              Bàn {tableNumber}
                            </div>
                            <div className="text-sm text-green-600">
                              ● Có đơn hàng đang chờ
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-400" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* All Tables */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Tất cả bàn:
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {tables && tables.length > 0 ? tables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => handleOpenPublicBill(table.number)}
                      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            Bàn {table.number}
                          </div>
                          <div className="text-sm text-gray-500">
                            {table.seats} chỗ ngồi
                            {table.description && ` • ${table.description}`}
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  )) : (
                    <p className="text-center text-gray-500 py-8">
                      Chưa có bàn nào được thiết lập
                    </p>
                  )}
                </div>
              </div>
              
              {getActiveTables().length === 0 && (!tables || tables.length === 0) && (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    Không có bàn nào để hiển thị
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillManagement; 