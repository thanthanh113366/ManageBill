import React, { useState, useMemo, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { toast } from 'react-toastify';
import CustomerPageModal from '../components/CustomerPageModal';
import { Plus, Minus, ShoppingCart, Calculator, ExternalLink } from 'lucide-react';
import { VoiceOrderButton } from '../components/VoiceOrderButton';
import { getVoiceOrderMetrics } from '../utils/voiceOrderMetrics';
import CustomItemForm from '../components/CustomItemForm';

// Categories for menu items
const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'lai_rai', label: 'Lai rai' },
  { value: 'giai_khat', label: 'Giải khát' },
  { value: 'all', label: 'Tất cả' }
];

const CreateBill = () => {
  const { menuItems, tables } = useApp();
  const [quantities, setQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('oc');
  const [selectedTable, setSelectedTable] = useState('');
  const [showCustomerOrderModal, setShowCustomerOrderModal] = useState(false);
  const [bills, setBills] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Custom items (món khác) cho CreateBill
  const [customItems, setCustomItems] = useState([]);

  // Set menuItemId vừa thêm từ voice – dùng để emit metric 7 khi user gỡ món
  const voiceAddedIdsRef = useRef(new Set());

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

  // Tổng tiền cho custom items
  const customTotals = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;

    customItems.forEach(item => {
      totalRevenue += item.customAmount;
      totalProfit += item.customAmount;
    });

    return { totalRevenue, totalProfit };
  }, [customItems]);

  const totalRevenueWithCustom = billSummary.totalRevenue + customTotals.totalRevenue;
  const totalProfitWithCustom = billSummary.totalProfit + customTotals.totalProfit;

  const handleQuantityChange = (menuItemId, change) => {
    const currentQuantity = quantities[menuItemId] || 0;
    const newQuantity = Math.max(0, currentQuantity + change);
    if (newQuantity === 0 && voiceAddedIdsRef.current.has(menuItemId)) {
      getVoiceOrderMetrics().recordUserRemovedVoiceItem(menuItemId);
      voiceAddedIdsRef.current.delete(menuItemId);
    }
    setQuantities(prev => {
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
    if (quantity === 0 && voiceAddedIdsRef.current.has(menuItemId)) {
      getVoiceOrderMetrics().recordUserRemovedVoiceItem(menuItemId);
      voiceAddedIdsRef.current.delete(menuItemId);
    }
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
    if (billSummary.totalItems === 0 && customItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất một món');
      return;
    }

    if (!selectedTable) {
      toast.error('Vui lòng chọn số bàn');
      return;
    }

    setIsSubmitting(true);

    try {
      const today = new Date();
      const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD

      const menuBillItems = billSummary.items.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity
      }));

      const customBillItems = customItems.map(item => ({
        customDescription: item.customDescription,
        customAmount: item.customAmount
      }));

      const billData = {
        createdAt: serverTimestamp(),
        date: dateString,
        tableNumber: parseInt(selectedTable), // Convert to number
        status: 'pending', // pending, paid
        items: [...menuBillItems, ...customBillItems],
        totalRevenue: totalRevenueWithCustom,
        totalProfit: totalProfitWithCustom
      };

      await addDoc(collection(db, 'bills'), billData);
      
      // Reset form
      setQuantities({});
      setSelectedTable('');
      setCustomItems([]);
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

  // Load bills from Firestore
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
    }, (error) => {
      console.error('Error loading bills:', error);
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const handleOpenPublicBill = (tableNumber) => {
    window.open(`/bill/${tableNumber}`, '_blank');
    setShowCustomerOrderModal(false);
  };

  const handleVoiceItemsMatched = (matchedItems) => {
    matchedItems.forEach(item => voiceAddedIdsRef.current.add(item.menuItemId));
    // Ghi đè (không cộng dồn) - theo yêu cầu
    setQuantities(prev => {
      const newQuantities = { ...prev };
      matchedItems.forEach(item => {
        // Ghi đè số lượng mới (không cộng với số cũ)
        newQuantities[item.menuItemId] = item.quantity;
      });
      return newQuantities;
    });
  };

  const getActiveTables = () => {
    // Chỉ lấy bàn thật trong stat card (loại ảo 9000+)
    const activeTables = new Set();
    bills.filter(bill => bill.status === 'pending' && !bill.isTakeaway).forEach(bill => {
      if (bill.tableNumber) activeTables.add(bill.tableNumber);
    });
    
    return Array.from(activeTables).sort((a, b) => a - b);
  };

  const getActiveBills = () =>
    bills
      .filter(bill => bill.status === 'pending')
      .sort((a, b) => {
        if (a.isTakeaway !== b.isTakeaway) return a.isTakeaway ? 1 : -1;
        return (a.isTakeaway ? a.takeawayNumber : a.tableNumber) -
               (b.isTakeaway ? b.takeawayNumber : b.tableNumber);
      });

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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tạo đơn hàng</h1>
          
          <button
            onClick={() => setShowCustomerOrderModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            title="Mở trang khách hàng"
          >
            <ExternalLink size={16} />
            <span>Trang khách</span>
          </button>
        </div>
        
        {/* Table Selection */}
        <div className="mb-6">
          <label htmlFor="table" className="block text-sm font-medium text-gray-700 mb-2">
            Chọn số bàn *
          </label>
          <div className="flex items-center gap-3">
            <select
              id="table"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">-- Chọn bàn --</option>
              {tables && tables.map((table) => (
                <option key={table.id} value={table.number}>
                  Bàn {table.number} - {table.seats} chỗ
                </option>
              ))}
            </select>
            
            {/* Voice Order Button - Cạnh phần chọn bàn */}
            <VoiceOrderButton 
              menuItems={menuItems}
              currentCategory={selectedCategory}
              onItemsMatched={handleVoiceItemsMatched}
            />
          </div>
        </div>
        
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
        <div className="space-y-4 mb-6">
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

        {/* Custom items (món khác) */}
        <CustomItemForm
          onAdd={({ customDescription, customAmount }) => {
            const newCustomItem = {
              id: `custom_${Date.now()}_${Math.random()}`,
              customDescription,
              customAmount
            };
            setCustomItems(prev => [...prev, newCustomItem]);
            toast.success('Đã thêm món khác');
          }}
        />

        {/* Bill Summary */}
        {(billSummary.totalItems > 0 || customItems.length > 0) && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center mb-4">
              <Calculator className="w-5 h-5 text-indigo-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">
                Tổng kết đơn hàng
              </h2>
            </div>
            
            <div className="space-y-2 mb-4">
              {billSummary.items.map((item) => (
                <div key={item.menuItemId} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              ))}

              {customItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.customDescription}
                  </span>
                  <span
                    className={`font-medium ${
                      item.customAmount >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {item.customAmount >= 0 ? '+' : ''}
                    {formatCurrency(item.customAmount)}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between font-semibold text-lg">
                <span>Tổng cộng:</span>
                <span className="text-indigo-600">
                  {formatCurrency(totalRevenueWithCustom)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Lợi nhuận dự kiến:</span>
                <span className="text-green-600 font-medium">
                  {formatCurrency(totalProfitWithCustom)}
                </span>
              </div>
            </div>
            
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedTable}
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Đang xử lý...
                </div>
              ) : (
                <>
                  <ShoppingCart size={20} className="mr-2" />
                  Tạo đơn hàng
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Customer Order Modal */}
      {showCustomerOrderModal && (
        <CustomerPageModal
          activeBills={getActiveBills()}
          tables={tables || []}
          onClose={() => setShowCustomerOrderModal(false)}
          onSelect={handleOpenPublicBill}
        />
      )}
    </div>
  );
};

export default CreateBill; 