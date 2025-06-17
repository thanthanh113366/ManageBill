import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { X, Plus, Minus, Save, Trash2, ShoppingCart, Calculator } from 'lucide-react';
import { toast } from 'react-toastify';

const EditBill = ({ bill, onClose, onUpdated }) => {
  const { menuItems } = useApp();
  const [selectedCategory, setSelectedCategory] = useState('oc');
  const [orderItems, setOrderItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Categories
  const categories = [
    { id: 'oc', name: 'Ốc', emoji: '🐚' },
    { id: 'an_no', name: 'Ăn no', emoji: '🍜' },
    { id: 'an_choi', name: 'Ăn chơi', emoji: '🍢' },
    { id: 'lai_rai', name: 'Lai rai', emoji: '🥜' },
    { id: 'giai_khat', name: 'Giải khát', emoji: '🧊' }
  ];

  // Initialize order items from bill data
  useEffect(() => {
    if (bill && bill.items) {
      const initialItems = bill.items.map(item => {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        return {
          menuItemId: item.menuItemId,
          menuItem: menuItem,
          quantity: item.quantity
        };
      }).filter(item => item.menuItem); // Filter out items where menuItem is not found
      
      setOrderItems(initialItems);
    }
  }, [bill, menuItems]);

  // Filter menu items by category
  const filteredMenuItems = menuItems.filter(item => item.category === selectedCategory);

  // Get item count for each category
  const getCategoryItemCount = (categoryId) => {
    return orderItems.filter(orderItem => 
      orderItem.menuItem && orderItem.menuItem.category === categoryId
    ).length;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const addToOrder = (menuItem) => {
    setOrderItems(prev => {
      const existingIndex = prev.findIndex(item => item.menuItemId === menuItem.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        return [...prev, {
          menuItemId: menuItem.id,
          menuItem: menuItem,
          quantity: 1
        }];
      }
    });
  };

  const updateQuantity = (menuItemId, newQuantity) => {
    if (newQuantity <= 0) {
      setOrderItems(prev => prev.filter(item => item.menuItemId !== menuItemId));
    } else {
      setOrderItems(prev => 
        prev.map(item => 
          item.menuItemId === menuItemId 
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    }
  };

  const removeFromOrder = (menuItemId) => {
    setOrderItems(prev => prev.filter(item => item.menuItemId !== menuItemId));
  };

  const calculateTotals = () => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    let totalFixedCost = 0;

    orderItems.forEach(item => {
      const { menuItem, quantity } = item;
      const itemRevenue = menuItem.price * quantity;
      const taxAmount = itemRevenue * (menuItem.tax / 100);
      const itemCost = menuItem.costPrice * quantity;
      const itemFixedCost = menuItem.fixedCost * quantity;
      const profitPerItem = menuItem.price - menuItem.costPrice - menuItem.fixedCost - taxAmount;
      const itemProfit = profitPerItem * quantity;

      totalRevenue += itemRevenue;
      totalProfit += itemProfit;
      totalCost += itemCost;
      totalFixedCost += itemFixedCost;
    });

    return { totalRevenue, totalProfit, totalCost, totalFixedCost };
  };

  const { totalRevenue, totalProfit, totalCost, totalFixedCost } = calculateTotals();

  const handleUpdateBill = async () => {
    if (orderItems.length === 0) {
      toast.error('Vui lòng thêm ít nhất một món vào đơn hàng');
      return;
    }

    setIsSubmitting(true);
    try {
      const billData = {
        items: orderItems.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity
        })),
        totalRevenue,
        totalProfit,
        totalCost,
        totalFixedCost,
        updatedAt: new Date()
      };

      await updateDoc(doc(db, 'bills', bill.id), billData);
      
      toast.success('Cập nhật đơn hàng thành công!');
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating bill:', error);
      toast.error('Có lỗi xảy ra khi cập nhật đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBill = async () => {
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'bills', bill.id));
      toast.success('Xóa đơn hàng thành công!');
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error deleting bill:', error);
      toast.error('Có lỗi xảy ra khi xóa đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('vi-VN');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Chỉnh sửa đơn hàng #{bill.id.slice(-6)}
            </h2>
            <p className="text-sm text-gray-600">
              Tạo lúc: {formatTime(bill.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Menu Section */}
          <div className="flex-1 p-6 overflow-y-auto border-r">
            <h3 className="text-lg font-semibold mb-4">Thực đơn</h3>
            
            {/* Category Tabs */}
            <div className="flex overflow-x-auto space-x-2 mb-6 pb-2">
              {categories.map(category => {
                const itemCount = getCategoryItemCount(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium relative ${
                      selectedCategory === category.id
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-1">{category.emoji}</span>
                    {category.name}
                    {itemCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {itemCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMenuItems.map(item => {
                const orderItem = orderItems.find(o => o.menuItemId === item.id);
                const quantity = orderItem ? orderItem.quantity : 0;
                
                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                      quantity > 0 ? 'ring-2 ring-indigo-200 bg-indigo-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.name}</h4>
                        <p className="text-lg font-bold text-indigo-600">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      {quantity > 0 && (
                        <span className="bg-indigo-600 text-white text-sm px-2 py-1 rounded-full">
                          {quantity}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {quantity > 0 && (
                          <button
                            onClick={() => updateQuantity(item.id, quantity - 1)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                        
                        <button
                          onClick={() => addToOrder(item)}
                          className="bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 text-sm"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      
                      {quantity > 0 && (
                        <button
                          onClick={() => removeFromOrder(item.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Xóa
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty state */}
            {filteredMenuItems.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-lg font-medium text-gray-900">Không có món ăn nào</p>
                  <p className="text-sm text-gray-600">Danh mục này chưa có món ăn nào</p>
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="w-96 p-6 bg-gray-50 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Đơn hàng</h3>
              <ShoppingCart size={20} />
            </div>

            {orderItems.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có món nào</p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {orderItems.map(item => (
                  <div key={item.menuItemId} className="bg-white rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 flex-1">
                        {item.menuItem.name}
                      </h4>
                      <button
                        onClick={() => removeFromOrder(item.menuItemId)}
                        className="text-red-600 hover:text-red-800 ml-2"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">
                          {formatCurrency(item.menuItem.price)} x {item.quantity}
                        </div>
                        <div className="font-medium">
                          {formatCurrency(item.menuItem.price * item.quantity)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            {orderItems.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center">
                  <Calculator className="w-5 h-5 text-gray-500 mr-2" />
                  <span className="font-medium">Tổng kết</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Vốn:</span>
                    <span>{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Chi phí cố định:</span>
                    <span>{formatCurrency(totalFixedCost)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Doanh thu:</span>
                    <span className="text-green-600">{formatCurrency(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Lợi nhuận:</span>
                    <span className={totalProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}>
                      {formatCurrency(totalProfit)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 space-y-3">
              <button
                onClick={handleUpdateBill}
                disabled={isSubmitting || orderItems.length === 0}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Save size={20} className="mr-2" />
                )}
                {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật đơn hàng'}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting}
                className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <Trash2 size={20} className="mr-2" />
                Xóa đơn hàng
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">Xác nhận xóa</h3>
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa đơn hàng này? Hành động này không thể hoàn tác.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteBill}
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300"
                >
                  {isSubmitting ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditBill; 