import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { Calendar, FileText, Eye, ChevronDown, ChevronUp } from 'lucide-react';

const BillManagement = () => {
  const { menuItems } = useApp();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedBill, setExpandedBill] = useState(null);
  const [billDetails, setBillDetails] = useState({});

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
    
    return { totalRevenue, totalProfit, totalBills };
  };

  const summary = getTotalSummary();

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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý đơn hàng</h1>
            <p className="text-gray-600 mt-1">
              Xem và quản lý các đơn hàng theo ngày
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng đơn hàng</p>
              <p className="text-2xl font-bold text-gray-900">{summary.totalBills}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <div className="w-6 h-6 text-green-600 font-bold">₫</div>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng doanh thu</p>
              <p className="text-2xl font-bold text-green-600">
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
              <p className="text-sm text-gray-600">Tổng lợi nhuận</p>
              <p className="text-2xl font-bold text-indigo-600">
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
                        <p className="text-sm font-medium text-gray-900">
                          Đơn hàng #{bill.id.slice(-6)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatTime(bill.createdAt)}
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
                    <button
                      onClick={() => handleViewDetails(bill)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    >
                      {expandedBill === bill.id ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </button>
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
    </div>
  );
};

export default BillManagement; 