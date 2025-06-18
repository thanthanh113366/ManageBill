import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { Calendar, FileText, Eye, ChevronDown, ChevronUp, Edit, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import EditBill from '../components/EditBill';

const BillManagement = () => {
  const { menuItems } = useApp();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedBill, setExpandedBill] = useState(null);
  const [billDetails, setBillDetails] = useState({});
  const [editingBill, setEditingBill] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(null);

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
      
      setBills(billsData);
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
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          if (menuItem) {
            const itemRevenue = menuItem.price * item.quantity;
            const taxAmount = itemRevenue * (menuItem.tax / 100);
            const profitPerItem = menuItem.price - menuItem.costPrice - menuItem.fixedCost - taxAmount;
            const itemProfit = profitPerItem * item.quantity;

            return {
              ...item,
              menuItem,
              itemRevenue,
              itemProfit,
              taxAmount
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
    const totalProfit = bills.reduce((sum, bill) => sum + bill.totalProfit, 0);
    const totalBills = bills.length;
    const paidBills = bills.filter(bill => bill.status === 'paid').length;
    const pendingBills = bills.filter(bill => bill.status === 'pending').length;
    
    return { totalRevenue, totalProfit, totalBills, paidBills, pendingBills };
  };

  const handleEditBill = (bill) => {
    setEditingBill(bill);
  };

  const handleBillUpdated = () => {
    // Bills will be automatically updated via the onSnapshot listener
    // No need to manually refetch data
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
              <div className="w-6 h-6 text-green-600 font-bold">₫</div>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Doanh thu</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(summary.totalRevenue)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <div className="w-6 h-6 text-indigo-600 font-bold">₫</div>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Lợi nhuận</p>
              <p className="text-xl font-bold text-indigo-600">
                {formatCurrency(summary.totalProfit)}
              </p>
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
              <div key={bill.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
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
                        <p className="text-sm text-gray-600">
                          Tạo: {formatTime(bill.createdAt)}
                          {bill.updatedAt && (
                            <span className="block">
                              Sửa: {formatTime(bill.updatedAt)}
                            </span>
                          )}
                          {bill.paidAt && (
                            <span className="block text-green-600">
                              Thanh toán: {formatTime(bill.paidAt)}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Doanh thu</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCurrency(bill.totalRevenue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Lợi nhuận</p>
                      <p className="text-lg font-semibold text-indigo-600">
                        {formatCurrency(bill.totalProfit)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {bill.status === 'pending' && (
                        <button
                          onClick={() => handleMarkAsPaid(bill)}
                          disabled={processingPayment === bill.id}
                          className="p-2 text-green-600 hover:text-green-800 rounded-full hover:bg-green-50 disabled:opacity-50"
                          title="Đánh dấu đã thanh toán"
                        >
                          {processingPayment === bill.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                          ) : (
                            <CheckCircle size={20} />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleEditBill(bill)}
                        className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50"
                        title="Chỉnh sửa đơn hàng"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleViewDetails(bill)}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                        title="Xem chi tiết"
                      >
                        {expandedBill === bill.id ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
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
                      {billDetails[bill.id].map((item, index) => (
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
                              <div className="flex space-x-4">
                                <span>Doanh thu: {formatCurrency(item.itemRevenue)}</span>
                                <span className={`${item.itemProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  Lợi nhuận: {formatCurrency(item.itemProfit)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Bill Modal */}
      {editingBill && (
        <EditBill
          bill={editingBill}
          onClose={() => setEditingBill(null)}
          onUpdated={handleBillUpdated}
        />
      )}
    </div>
  );
};

export default BillManagement; 