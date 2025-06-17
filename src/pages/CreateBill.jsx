import React, { useState, useMemo } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { toast } from 'react-toastify';
import { Plus, Minus, ShoppingCart, Calculator } from 'lucide-react';

// Categories for menu items
const CATEGORIES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'lai_rai', label: 'Lai rai' },
  { value: 'giai_khat', label: 'Giải khát' }
];

const CreateBill = () => {
  const { menuItems } = useApp();
  const [quantities, setQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Tính toán tổng bill
  const billSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalItems = 0;

    const items = [];

    Object.entries(quantities).forEach(([menuItemId, quantity]) => {
      if (quantity > 0) {
        const menuItem = menuItems.find(item => item.id === menuItemId);
        if (menuItem) {
          const itemRevenue = menuItem.price * quantity;
          const taxAmount = itemRevenue * (menuItem.tax / 100);
          const profitPerItem = menuItem.price - menuItem.costPrice - menuItem.fixedCost - (menuItem.price * menuItem.tax / 100);
          const itemProfit = profitPerItem * quantity;

          totalRevenue += itemRevenue;
          totalProfit += itemProfit;
          totalItems += quantity;

          items.push({
            menuItemId,
            quantity,
            name: menuItem.name,
            price: menuItem.price,
            revenue: itemRevenue,
            profit: itemProfit
          });
        }
      }
    });

    return {
      items,
      totalRevenue,
      totalProfit,
      totalItems
    };
  }, [quantities, menuItems]);

  const handleQuantityChange = (menuItemId, change) => {
    setQuantities(prev => {
      const currentQuantity = prev[menuItemId] || 0;
      const newQuantity = Math.max(0, currentQuantity + change);
      
      if (newQuantity === 0) {
        const { [menuItemId]: removed, ...rest } = prev;
        return rest;
      }
      
      return {
        ...prev,
        [menuItemId]: newQuantity
      };
    });
  };

  const setQuantityDirectly = (menuItemId, value) => {
    const quantity = Math.max(0, parseInt(value) || 0);
    
    if (quantity === 0) {
      setQuantities(prev => {
        const { [menuItemId]: removed, ...rest } = prev;
        return rest;
      });
    } else {
      setQuantities(prev => ({
        ...prev,
        [menuItemId]: quantity
      }));
    }
  };

  const handleSubmit = async () => {
    if (billSummary.totalItems === 0) {
      toast.error('Vui lòng chọn ít nhất một món');
      return;
    }

    setIsSubmitting(true);

    try {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

      const billData = {
        createdAt: serverTimestamp(),
        date: dateString,
        items: billSummary.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity
        })),
        totalRevenue: billSummary.totalRevenue,
        totalProfit: billSummary.totalProfit
      };

      await addDoc(collection(db, 'bills'), billData);
      
      // Reset form
      setQuantities({});
      toast.success('Tạo đơn hàng thành công!');
    } catch (error) {
      console.error('Error creating bill:', error);
      toast.error('Có lỗi xảy ra khi tạo đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  // Filter menu items by category
  const filteredMenuItems = useMemo(() => {
    if (selectedCategory === 'all') {
      return menuItems;
    }
    return menuItems.filter(item => item.category === selectedCategory);
  }, [menuItems, selectedCategory]);

  // Get count for each category
  const getCategoryCount = (categoryValue) => {
    if (categoryValue === 'all') {
      return menuItems.length;
    }
    return menuItems.filter(item => item.category === categoryValue).length;
  };

  if (menuItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Chưa có món nào trong menu
          </h2>
          <p className="text-gray-600 mb-4">
            Vui lòng thêm các món ăn vào menu trước khi tạo đơn hàng
          </p>
          <a
            href="/menu"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Quản lý menu
          </a>
        </div>
      </div>
    );
  }

      return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Tạo đơn hàng</h1>
          
          {/* Category Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 overflow-x-auto">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => setSelectedCategory(category.value)}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      selectedCategory === category.value
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <span>{category.label}</span>
                    <span className={`inline-flex items-center justify-center w-5 h-5 text-xs rounded-full ${
                      selectedCategory === category.value
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getCategoryCount(category.value)}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
          
          {/* Menu items */}
          <div className="space-y-4 mb-8">
            {filteredMenuItems.map((item) => {
            const quantity = quantities[item.id] || 0;
            
            return (
              <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-indigo-600 font-medium">
                    {formatCurrency(item.price)}
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleQuantityChange(item.id, -1)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    disabled={quantity === 0}
                  >
                    <Minus size={16} />
                  </button>
                  
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantityDirectly(item.id, e.target.value)}
                    className="w-16 text-center border rounded-md py-1 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    min="0"
                  />
                  
                  <button
                    onClick={() => handleQuantityChange(item.id, 1)}
                    className="w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 flex items-center justify-center transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bill summary */}
        {billSummary.totalItems > 0 && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <Calculator className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Tóm tắt đơn hàng</h3>
            </div>
            
            <div className="space-y-2 mb-4">
              {billSummary.items.map((item) => (
                <div key={item.menuItemId} className="flex justify-between text-sm">
                  <span>{item.name} x {item.quantity}</span>
                  <span className="font-medium">{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-lg font-semibold">
                <span>Tổng doanh thu:</span>
                <span className="text-green-600">{formatCurrency(billSummary.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Lợi nhuận:</span>
                <span className="text-blue-600">{formatCurrency(billSummary.totalProfit)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || billSummary.totalItems === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Đang tạo đơn hàng...
            </div>
          ) : (
            'Tạo đơn hàng'
          )}
        </button>
      </div>
    </div>
  );
};

export default CreateBill; 