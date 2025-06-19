import React, { useState, useEffect } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { X, Plus, Minus, Save, Trash2, ShoppingCart, Calculator, FileText } from 'lucide-react';
import { toast } from 'react-toastify';

const EditBill = ({ bill, onClose, onUpdated }) => {
  const { menuItems } = useApp();
  const [selectedCategory, setSelectedCategory] = useState('oc');
  const [orderItems, setOrderItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // States for custom item form
  const [showCustomItemForm, setShowCustomItemForm] = useState(false);
  const [customItem, setCustomItem] = useState({
    description: '',
    amount: '',
    isValid: false
  });

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
        // Handle regular menu items
        if (item.menuItemId) {
          const menuItem = menuItems.find(m => m.id === item.menuItemId);
          return {
            menuItemId: item.menuItemId,
            menuItem: menuItem,
            quantity: item.quantity,
            type: 'menu'
          };
        }
        // Handle custom items
        else if (item.customDescription) {
          return {
            customDescription: item.customDescription,
            customAmount: item.customAmount,
            quantity: 1, // Custom items always have quantity 1
            type: 'custom',
            id: `custom_${Date.now()}_${Math.random()}` // Generate unique ID for custom items
          };
        }
        return null;
      }).filter(item => item !== null && (item.type === 'custom' || item.menuItem)); // Filter out items where menuItem is not found
      
      setOrderItems(initialItems);
    }
  }, [bill, menuItems]);

  // Validate custom item
  useEffect(() => {
    const isValid = customItem.description.trim() !== '' && customItem.amount !== '' && !isNaN(parseFloat(customItem.amount));
    setCustomItem(prev => ({ ...prev, isValid }));
  }, [customItem.description, customItem.amount]);

  // Filter menu items by category
  const filteredMenuItems = menuItems.filter(item => item.category === selectedCategory);

  // Get item count for each category
  const getCategoryItemCount = (categoryId) => {
    return orderItems.filter(orderItem => 
      orderItem.type === 'menu' && orderItem.menuItem && orderItem.menuItem.category === categoryId
    ).length;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const addToOrder = (menuItem) => {
    setOrderItems(prev => {
      const existingIndex = prev.findIndex(item => item.type === 'menu' && item.menuItemId === menuItem.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        return [...prev, {
          menuItemId: menuItem.id,
          menuItem: menuItem,
          quantity: 1,
          type: 'menu'
        }];
      }
    });
  };

  const addCustomItem = () => {
    if (!customItem.isValid) return;

    const newCustomItem = {
      customDescription: customItem.description.trim(),
      customAmount: parseFloat(customItem.amount),
      quantity: 1,
      type: 'custom',
      id: `custom_${Date.now()}_${Math.random()}`
    };

    setOrderItems(prev => [...prev, newCustomItem]);
    
    // Reset form
    setCustomItem({ description: '', amount: '', isValid: false });
    setShowCustomItemForm(false);
    
    toast.success('Đã thêm món khác');
  };

  const updateQuantity = (itemId, newQuantity, itemType) => {
    if (itemType === 'custom') {
      // Custom items can't change quantity, only remove
      if (newQuantity <= 0) {
        removeFromOrder(itemId, itemType);
      }
      return;
    }

    if (newQuantity <= 0) {
      setOrderItems(prev => prev.filter(item => !(item.type === 'menu' && item.menuItemId === itemId)));
    } else {
      setOrderItems(prev => 
        prev.map(item => 
          item.type === 'menu' && item.menuItemId === itemId 
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    }
  };

  const removeFromOrder = (itemId, itemType = 'menu') => {
    if (itemType === 'custom') {
      setOrderItems(prev => prev.filter(item => !(item.type === 'custom' && item.id === itemId)));
    } else {
      setOrderItems(prev => prev.filter(item => !(item.type === 'menu' && item.menuItemId === itemId)));
    }
  };

  const calculateTotals = () => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    let totalFixedCost = 0;

    orderItems.forEach(item => {
      if (item.type === 'menu') {
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
      } else if (item.type === 'custom') {
        // Custom items add directly to revenue and profit (no cost calculation)
        totalRevenue += item.customAmount;
        totalProfit += item.customAmount;
      }
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
        items: orderItems.map(item => {
          if (item.type === 'menu') {
            return {
              menuItemId: item.menuItemId,
              quantity: item.quantity
            };
          } else if (item.type === 'custom') {
            return {
              customDescription: item.customDescription,
              customAmount: item.customAmount
            };
          }
        }),
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Chỉnh sửa đơn hàng #{bill.id.slice(-6)}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              Tạo lúc: {formatTime(bill.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Content */}
        <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
          {/* Menu Section */}
          <div className="mb-8">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Thực đơn</h3>
            
            {/* Category Tabs */}
            <div className="flex overflow-x-auto space-x-2 mb-6 pb-2">
              {categories.map(category => {
                const itemCount = getCategoryItemCount(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex-shrink-0 px-3 py-2 rounded-full text-xs sm:text-sm font-medium relative ${
                      selectedCategory === category.id
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-1">{category.emoji}</span>
                    {category.name}
                    {itemCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {itemCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filteredMenuItems.map(item => {
                const orderItem = orderItems.find(o => o.menuItemId === item.id);
                const quantity = orderItem ? orderItem.quantity : 0;
                
                return (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-3 hover:shadow-md transition-shadow ${
                      quantity > 0 ? 'ring-2 ring-indigo-200 bg-indigo-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                        <p className="text-base font-bold text-indigo-600">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      {quantity > 0 && (
                        <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full">
                          {quantity}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {quantity > 0 && (
                          <button
                            onClick={() => updateQuantity(item.id, quantity - 1, 'menu')}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Minus size={14} />
                          </button>
                        )}
                        
                        <button
                          onClick={() => addToOrder(item)}
                          className="bg-indigo-600 text-white px-2 py-1 rounded-md hover:bg-indigo-700 text-xs"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      {quantity > 0 && (
                        <button
                          onClick={() => removeFromOrder(item.id, 'menu')}
                          className="text-red-600 hover:text-red-800 text-xs"
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
                  <svg className="w-10 h-10 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-base font-medium text-gray-900">Không có món ăn nào</p>
                  <p className="text-sm text-gray-600">Danh mục này chưa có món ăn nào</p>
                </div>
              </div>
            )}

            {/* Add Custom Item Button */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowCustomItemForm(!showCustomItemForm)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                <FileText size={18} />
                <span>Thêm món khác</span>
              </button>

              {/* Custom Item Form */}
              {showCustomItemForm && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-3">Thêm món khác</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mô tả món
                      </label>
                      <input
                        type="text"
                        value={customItem.description}
                        onChange={(e) => setCustomItem(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="VD: Tóp mỡ, Bớt tiền ốc hương..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Số tiền (VND)
                      </label>
                      <input
                        type="number"
                        value={customItem.amount}
                        onChange={(e) => setCustomItem(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="VD: 5000, -10000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Nhập số âm để giảm tiền (VD: -10000)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addCustomItem}
                        disabled={!customItem.isValid}
                        className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Plus size={16} />
                        Thêm
                      </button>
                      <button
                        onClick={() => {
                          setShowCustomItemForm(false);
                          setCustomItem({ description: '', amount: '', isValid: false });
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base sm:text-lg font-semibold">Đơn hàng</h3>
              <ShoppingCart size={18} />
            </div>

            {orderItems.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có món nào</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {orderItems.map(item => {
                  if (item.type === 'menu') {
                    return (
                      <div key={item.menuItemId} className="bg-gray-50 rounded-lg p-5 border">
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-semibold text-gray-900 text-lg">
                            {item.menuItem.name}
                          </h4>
                          <button
                            onClick={() => removeFromOrder(item.menuItemId, 'menu')}
                            className="text-red-600 hover:text-red-800 ml-3 p-1 hover:bg-red-50 rounded-full"
                          >
                            <X size={20} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <button
                              onClick={() => updateQuantity(item.menuItemId, item.quantity - 1, 'menu')}
                              className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                            >
                              <Minus size={20} />
                            </button>
                            <span className="w-16 text-center text-xl font-bold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.menuItemId, item.quantity + 1, 'menu')}
                              className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                            >
                              <Plus size={20} />
                            </button>
                          </div>
                          <div className="text-right">
                            <div className="text-base text-gray-600">
                              {formatCurrency(item.menuItem.price)} x {item.quantity}
                            </div>
                            <div className="font-bold text-xl text-green-600">
                              {formatCurrency(item.menuItem.price * item.quantity)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (item.type === 'custom') {
                    return (
                      <div key={item.id} className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 text-lg">
                              {item.customDescription}
                            </h4>
                            <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              Món khác
                            </span>
                          </div>
                          <button
                            onClick={() => removeFromOrder(item.id, 'custom')}
                            className="text-red-600 hover:text-red-800 ml-3 p-1 hover:bg-red-50 rounded-full"
                          >
                            <X size={20} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            Không thể thay đổi số lượng
                          </div>
                          <div className="text-right">
                            <div className={`font-bold text-xl ${item.customAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
            )}

            {/* Summary */}
            <div className="border-t pt-6 space-y-4 mb-8 bg-white rounded-lg p-6 border">
              <div className="flex justify-between items-center">
                <span className="text-2xl font-semibold text-gray-900">Tổng cộng:</span>
                <span className="text-3xl font-bold text-green-600">
                  {formatCurrency(totalRevenue)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <button
                onClick={handleUpdateBill}
                disabled={isSubmitting || orderItems.length === 0}
                className="w-full bg-indigo-600 text-white py-5 px-6 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-semibold text-xl"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : (
                  <Save size={24} />
                )}
                {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật đơn hàng'}
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-600 text-white py-4 px-6 rounded-lg hover:bg-red-700 flex items-center justify-center gap-3 font-semibold text-lg"
              >
                <Trash2 size={20} />
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