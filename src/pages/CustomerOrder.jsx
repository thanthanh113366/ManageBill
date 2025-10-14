import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { submitCustomerOrder } from '../utils/customerOrder';

const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'giai_khat', label: 'Giải khát' },
  { value: 'all', label: 'Tất cả' }
];

const CustomerOrder = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  
  const [orderItems, setOrderItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('oc');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load order items
  useEffect(() => {
    const q = query(collection(db, 'orderItems'), orderBy('category'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrderItems(items);
    }, (error) => {
      console.error('Error loading order items:', error);
      toast.error('Không thể tải menu. Vui lòng thử lại!');
    });

    return () => unsubscribe();
  }, []);

  // Load menu items for price reference
  useEffect(() => {
    const q = query(collection(db, 'menuItems'), orderBy('category'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMenuItems(items);
    }, (error) => {
      console.error('Error loading menu items:', error);
    });

    return () => unsubscribe();
  }, []);

  // Calculate summary
  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalItems = 0;
    const items = [];

    Object.entries(quantities).forEach(([orderItemId, quantity]) => {
      if (quantity > 0) {
        const orderItem = orderItems.find(item => item.id === orderItemId);
        if (orderItem) {
          // Get price from parent menu item
          const parentMenuItem = menuItems.find(item => item.id === orderItem.parentMenuItemId);
          if (parentMenuItem) {
            const itemRevenue = parentMenuItem.price * quantity;
            const profitPerItem = parentMenuItem.price - parentMenuItem.costPrice - parentMenuItem.fixedCost - (parentMenuItem.price * parentMenuItem.tax / 100);
            const itemProfit = profitPerItem * quantity;

            totalRevenue += itemRevenue;
            totalProfit += itemProfit;
            totalItems += quantity;

            items.push({
              orderItemId,
              quantity,
              name: orderItem.name,
              price: parentMenuItem.price,
              revenue: itemRevenue
            });
          }
        }
      }
    });

    return { items, totalRevenue, totalProfit, totalItems };
  }, [quantities, orderItems, menuItems]);

  const handleQuantityChange = (orderItemId, change) => {
    setQuantities(prev => {
      const currentQuantity = prev[orderItemId] || 0;
      const newQuantity = Math.max(0, currentQuantity + change);
      
      if (newQuantity === 0) {
        const { [orderItemId]: removed, ...rest } = prev;
        return rest;
      }
      
      return { ...prev, [orderItemId]: newQuantity };
    });
  };

  const handleSubmit = async () => {
    if (summary.totalItems === 0) {
      toast.error('Vui lòng chọn ít nhất một món');
      return;
    }

    setIsSubmitting(true);

    try {
      const billItems = summary.items.map(item => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity
      }));

      await submitCustomerOrder(
        tableNumber,
        billItems,
        summary.totalRevenue,
        summary.totalProfit
      );

      // Redirect to success page
      navigate(`/order-success/${tableNumber}`);
      
    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  // Group order items by parent menu item
  const groupedOrderItems = useMemo(() => {
    const filtered = selectedCategory === 'all' 
      ? orderItems 
      : orderItems.filter(item => item.category === selectedCategory);
    
    // Group by parentMenuItemId
    const grouped = {};
    const standaloneItems = [];
    
    filtered.forEach(orderItem => {
      const parentId = orderItem.parentMenuItemId;
      
      // Handle standalone items (like Lai rai items)
      if (!parentId) {
        standaloneItems.push(orderItem);
        return;
      }
      
      if (!grouped[parentId]) {
        const parentMenuItem = menuItems.find(item => item.id === parentId);
        grouped[parentId] = {
          parentMenuItem,
          orderItems: []
        };
      }
      grouped[parentId].orderItems.push(orderItem);
    });
    
    const groupedArray = Object.values(grouped).filter(group => group.parentMenuItem);
    
    // Add standalone items as individual groups
    standaloneItems.forEach(item => {
      groupedArray.push({
        parentMenuItem: { id: `standalone-${item.id}`, name: item.name },
        orderItems: [item]
      });
    });
    
    return groupedArray;
  }, [orderItems, menuItems, selectedCategory]);

  const getCategoryCount = (categoryValue) => {
    if (categoryValue === 'all') return orderItems.length;
    return orderItems.filter(item => item.category === categoryValue).length;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-6 shadow-lg sticky top-0 z-10">
        <h1 className="text-2xl font-bold">🍽️ Ốc đây nè</h1>
        <p className="text-indigo-100 mt-1">📍 Bàn số {tableNumber}</p>
      </div>

      {/* Category Tabs */}
      <div className="bg-white border-b sticky top-[104px] z-10 shadow-sm">
        <div className="overflow-x-auto">
          <div className="flex space-x-2 px-4 py-3 min-w-max">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                  selectedCategory === category.value
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.label}
                <span className={`ml-2 text-xs ${
                  selectedCategory === category.value ? 'text-indigo-200' : 'text-gray-500'
                }`}>
                  ({getCategoryCount(category.value)})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="p-4 space-y-4">
        {groupedOrderItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
            <p className="text-gray-500">
              {orderItems.length === 0 ? 'Đang tải menu...' : 'Không có món nào trong danh mục này'}
            </p>
          </div>
        ) : (
          groupedOrderItems.map((group) => (
            <div key={group.parentMenuItem.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Parent Menu Item Header */}
              <div className="bg-gray-50 px-4 py-3 border-b">
                <h2 className="font-bold text-gray-900 text-lg">{group.parentMenuItem.name}</h2>
                <p className="text-gray-600 text-sm">Chọn món con bên dưới</p>
              </div>
              
              {/* Order Items */}
              <div className="p-4 space-y-3">
                {group.orderItems.map((orderItem) => {
                  const quantity = quantities[orderItem.id] || 0;
                  // For standalone items, we need to get price from the orderItem itself or a default
                  const price = group.parentMenuItem.id.startsWith('standalone-') 
                    ? 25000 // Default price for Lai rai items
                    : group.parentMenuItem.price; // Price from parent
                  
                  return (
                    <div key={orderItem.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center space-x-3 flex-1">
                        {/* Image */}
                        {orderItem.imageUrl ? (
                          <img 
                            src={orderItem.imageUrl} 
                            alt={orderItem.name}
                            className="w-12 h-12 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400 text-xs">🍽️</span>
                          </div>
                        )}
                        
                        {/* Item Info */}
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{orderItem.name}</h3>
                          <p className="text-indigo-600 font-bold">
                            {formatCurrency(price)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleQuantityChange(orderItem.id, -1)}
                          disabled={quantity === 0}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors active:scale-95"
                        >
                          <Minus size={16} />
                        </button>
                        
                        <span className="w-8 text-center text-lg font-semibold text-gray-900">
                          {quantity}
                        </span>
                        
                        <button
                          onClick={() => handleQuantityChange(orderItem.id, 1)}
                          className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors active:scale-95 shadow-md"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Cart Button */}
      {summary.totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-20">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 rounded-xl flex items-center justify-between px-6 transition-colors shadow-lg active:scale-98"
          >
            <div className="flex items-center">
              <ShoppingCart size={24} className="mr-2" />
              <span className="text-lg">{summary.totalItems} món</span>
            </div>
            
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-2"></div>
                <span>Đang xử lý...</span>
              </div>
            ) : (
              <span className="text-lg font-bold">
                {formatCurrency(summary.totalRevenue)}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerOrder;

