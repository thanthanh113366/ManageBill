import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { X, Plus, Minus, Save, Trash2, ShoppingCart } from 'lucide-react';
import { toast } from 'react-toastify';
import CustomItemForm from './CustomItemForm';

const CATEGORIES = [
  { id: 'oc', name: 'Ốc', emoji: '🐚' },
  { id: 'an_no', name: 'Ăn no', emoji: '🍜' },
  { id: 'an_choi', name: 'Ăn chơi', emoji: '🍢' },
  { id: 'lai_rai', name: 'Lai rai', emoji: '🥜' },
  { id: 'giai_khat', name: 'Giải khát', emoji: '🧊' },
];

const EditBill = ({ bill, onClose, onUpdated }) => {
  const { menuItems, orderItems: allOrderItems } = useApp();

  // cart: { [orderItemId]: { qty: number, _orig: object|null } }
  // _orig = raw bill item từ Firestore, dùng để giữ nguyên kitchenStatus/completedCount/addedAt khi save
  const [cart, setCart] = useState({});
  // legacyItems: bills tạo bởi staff qua CreateBill (dùng menuItemId, không có orderItemId)
  const [legacyItems, setLegacyItems] = useState([]);
  // customItems: món tự nhập
  const [customItems, setCustomItems] = useState([]);

  const [selectedCategory, setSelectedCategory] = useState('oc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // --- Load bill vào state ---
  useEffect(() => {
    if (!bill?.items) return;
    const newCart = {};
    const newLegacy = [];
    const newCustom = [];

    bill.items.forEach(item => {
      if (item.orderItemId) {
        newCart[item.orderItemId] = { qty: item.quantity || 1, _orig: item };
      } else if (item.menuItemId) {
        const menuItem = menuItems.find(m => m.id === item.menuItemId);
        newLegacy.push({
          menuItemId: item.menuItemId,
          name: menuItem?.name ?? item.menuItemId,
          quantity: item.quantity || 1,
          menuItem: menuItem ?? null,
        });
      } else if (item.customDescription) {
        newCustom.push({
          id: `custom_${Math.random()}`,
          customDescription: item.customDescription,
          customAmount: item.customAmount,
        });
      }
    });

    setCart(newCart);
    setLegacyItems(newLegacy);
    setCustomItems(newCustom);
  }, [bill, menuItems]);

  // --- Group orderItems theo category rồi parentMenuItemId ---
  const grouped = useMemo(() => {
    const filtered = allOrderItems.filter(oi => oi.category === selectedCategory);
    const standalone = [];
    const byParent = {}; // { [parentMenuItemId]: { parentName, parentId, items[] } }

    filtered.forEach(oi => {
      if (!oi.parentMenuItemId) {
        standalone.push(oi);
      } else {
        if (!byParent[oi.parentMenuItemId]) {
          const parent = menuItems.find(m => m.id === oi.parentMenuItemId);
          byParent[oi.parentMenuItemId] = {
            parentId: oi.parentMenuItemId,
            parentName: parent?.name ?? oi.parentMenuItemId,
            items: [],
          };
        }
        byParent[oi.parentMenuItemId].items.push(oi);
      }
    });

    return { standalone, groups: Object.values(byParent) };
  }, [allOrderItems, menuItems, selectedCategory]);

  // --- Badge count cho category tab ---
  const getCategoryCount = (catId) => {
    const fromCart = allOrderItems.filter(
      oi => oi.category === catId && (cart[oi.id]?.qty ?? 0) > 0
    ).length;
    const fromLegacy = legacyItems.filter(
      li => li.menuItem?.category === catId && li.quantity > 0
    ).length;
    return fromCart + fromLegacy;
  };

  // --- Cart handlers ---
  const addToCart = (oi) => {
    setCart(prev => {
      const existing = prev[oi.id];
      return {
        ...prev,
        [oi.id]: { qty: (existing?.qty ?? 0) + 1, _orig: existing?._orig ?? null },
      };
    });
  };

  const updateCartQty = (orderItemId, newQty) => {
    if (newQty <= 0) {
      setCart(prev => { const { [orderItemId]: _, ...rest } = prev; return rest; });
    } else {
      setCart(prev => ({ ...prev, [orderItemId]: { ...prev[orderItemId], qty: newQty } }));
    }
  };

  const updateLegacyQty = (menuItemId, newQty) => {
    if (newQty <= 0) {
      setLegacyItems(prev => prev.filter(li => li.menuItemId !== menuItemId));
    } else {
      setLegacyItems(prev =>
        prev.map(li => li.menuItemId === menuItemId ? { ...li, quantity: newQty } : li)
      );
    }
  };

  const removeCustomItem = (id) =>
    setCustomItems(prev => prev.filter(ci => ci.id !== id));

  const handleAddCustomItem = ({ customDescription, customAmount }) => {
    setCustomItems(prev => [
      ...prev,
      { id: `custom_${Date.now()}_${Math.random()}`, customDescription, customAmount },
    ]);
    toast.success('Đã thêm món khác');
  };

  // --- Tính tổng ---
  const calculateTotals = () => {
    let totalRevenue = 0, totalProfit = 0, totalCost = 0, totalFixedCost = 0;

    // orderItemId items
    Object.entries(cart).forEach(([id, { qty }]) => {
      const oi = allOrderItems.find(o => o.id === id);
      if (!oi) return;
      const parent = oi.parentMenuItemId
        ? menuItems.find(m => m.id === oi.parentMenuItemId)
        : null;
      const price = parent?.price ?? oi.price ?? 0;
      const costPrice = parent?.costPrice ?? 0;
      const fixedCost = parent?.fixedCost ?? 0;
      const tax = parent?.tax ?? 0;
      const revenue = price * qty;
      const taxAmt = revenue * (tax / 100);
      totalRevenue += revenue;
      totalCost += costPrice * qty;
      totalFixedCost += fixedCost * qty;
      totalProfit += (price - costPrice - fixedCost - taxAmt) * qty;
    });

    // legacy menuItemId items
    legacyItems.forEach(({ menuItem, quantity }) => {
      if (!menuItem) return;
      const price = menuItem.price ?? 0;
      const costPrice = menuItem.costPrice ?? 0;
      const fixedCost = menuItem.fixedCost ?? 0;
      const tax = menuItem.tax ?? 0;
      const revenue = price * quantity;
      const taxAmt = revenue * (tax / 100);
      totalRevenue += revenue;
      totalCost += costPrice * quantity;
      totalFixedCost += fixedCost * quantity;
      totalProfit += (price - costPrice - fixedCost - taxAmt) * quantity;
    });

    // custom items
    customItems.forEach(({ customAmount }) => {
      totalRevenue += customAmount;
      totalProfit += customAmount;
    });

    return { totalRevenue, totalProfit, totalCost, totalFixedCost };
  };

  const { totalRevenue, totalProfit, totalCost, totalFixedCost } = calculateTotals();

  const totalItems =
    Object.values(cart).reduce((s, { qty }) => s + qty, 0) +
    legacyItems.reduce((s, li) => s + li.quantity, 0) +
    customItems.length;

  // --- Save ---
  const handleUpdateBill = async () => {
    if (totalItems === 0) {
      toast.error('Vui lòng thêm ít nhất một món vào đơn hàng');
      return;
    }
    setIsSubmitting(true);
    try {
      const items = [
        // orderItemId items: spread _orig để giữ nguyên kitchenStatus/completedCount/addedAt
        // Chỉ override quantity theo thay đổi của admin
        ...Object.entries(cart).map(([id, { qty, _orig }]) =>
          _orig ? { ..._orig, quantity: qty } : { orderItemId: id, quantity: qty }
        ),
        // legacy menuItemId items: giữ nguyên format
        ...legacyItems.map(({ menuItemId, quantity }) => ({ menuItemId, quantity })),
        // custom items
        ...customItems.map(({ customDescription, customAmount }) => ({
          customDescription,
          customAmount,
        })),
      ];

      await updateDoc(doc(db, 'bills', bill.id), {
        items,
        totalRevenue,
        totalProfit,
        totalCost,
        totalFixedCost,
        updatedAt: new Date(),
      });

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

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('vi-VN');
  };

  // --- Render card cho 1 orderItem trong grid ---
  const renderOrderItemCard = (oi) => {
    const qty = cart[oi.id]?.qty ?? 0;
    const parent = oi.parentMenuItemId
      ? menuItems.find(m => m.id === oi.parentMenuItemId)
      : null;
    const price = parent?.price ?? oi.price ?? 0;
    return (
      <div
        key={oi.id}
        className={`border rounded-lg p-3 transition-shadow hover:shadow-md ${
          qty > 0 ? 'ring-2 ring-indigo-200 bg-indigo-50' : 'bg-white'
        }`}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 text-sm">{oi.name}</h4>
            {price > 0 && (
              <p className="text-base font-bold text-indigo-600">{formatCurrency(price)}</p>
            )}
          </div>
          {qty > 0 && (
            <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full ml-2">
              {qty}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {qty > 0 && (
              <button
                onClick={() => updateCartQty(oi.id, qty - 1)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <Minus size={14} />
              </button>
            )}
            <button
              onClick={() => addToCart(oi)}
              className="bg-indigo-600 text-white px-2 py-1 rounded-md hover:bg-indigo-700 text-xs"
            >
              <Plus size={14} />
            </button>
          </div>
          {qty > 0 && (
            <button
              onClick={() => updateCartQty(oi.id, 0)}
              className="text-red-600 hover:text-red-800 text-xs"
            >
              Xóa
            </button>
          )}
        </div>
      </div>
    );
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
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
              {CATEGORIES.map(cat => {
                const count = getCategoryCount(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex-shrink-0 px-3 py-2 rounded-full text-xs sm:text-sm font-medium relative ${
                      selectedCategory === cat.id
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="mr-1">{cat.emoji}</span>
                    {cat.name}
                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* OrderItem Grid — grouped by parentMenuItemId */}
            {grouped.standalone.length === 0 && grouped.groups.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-base font-medium text-gray-900">Không có món ăn nào</p>
                <p className="text-sm text-gray-600">Danh mục này chưa có món ăn nào</p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Standalone orderItems (không có parent) */}
                {grouped.standalone.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {grouped.standalone.map(oi => renderOrderItemCard(oi))}
                  </div>
                )}
                {/* Grouped: parent label + children */}
                {grouped.groups.map(({ parentId, parentName, items }) => (
                  <div key={parentId}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {parentName}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map(oi => renderOrderItemCard(oi))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <CustomItemForm onAdd={handleAddCustomItem} />
            </div>
          </div>

          {/* Order Summary */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base sm:text-lg font-semibold">Đơn hàng</h3>
              <ShoppingCart size={18} />
            </div>

            {totalItems === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Chưa có món nào</p>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {/* orderItemId items */}
                {Object.entries(cart).map(([id, { qty }]) => {
                  const oi = allOrderItems.find(o => o.id === id);
                  const parent = oi?.parentMenuItemId
                    ? menuItems.find(m => m.id === oi.parentMenuItemId)
                    : null;
                  const price = parent?.price ?? oi?.price ?? 0;
                  const name = oi?.name ?? `Món ID: ${id}`;
                  return (
                    <div key={id} className="bg-gray-50 rounded-lg p-5 border">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900 text-lg">{name}</h4>
                        <button
                          onClick={() => updateCartQty(id, 0)}
                          className="text-red-600 hover:text-red-800 ml-3 p-1 hover:bg-red-50 rounded-full"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => updateCartQty(id, qty - 1)}
                            className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                          >
                            <Minus size={20} />
                          </button>
                          <span className="w-16 text-center text-xl font-bold">{qty}</span>
                          <button
                            onClick={() => updateCartQty(id, qty + 1)}
                            className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="text-base text-gray-600">
                            {formatCurrency(price)} x {qty}
                          </div>
                          <div className="font-bold text-xl text-green-600">
                            {formatCurrency(price * qty)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Legacy menuItemId items (thêm bởi nhân viên qua CreateBill) */}
                {legacyItems.map(({ menuItemId, name, quantity, menuItem }) => (
                  <div key={menuItemId} className="bg-yellow-50 rounded-lg p-5 border border-yellow-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-lg">{name}</h4>
                        <span className="inline-block mt-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          Thêm bởi nhân viên
                        </span>
                      </div>
                      <button
                        onClick={() => updateLegacyQty(menuItemId, 0)}
                        className="text-red-600 hover:text-red-800 ml-3 p-1 hover:bg-red-50 rounded-full"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => updateLegacyQty(menuItemId, quantity - 1)}
                          className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                        >
                          <Minus size={20} />
                        </button>
                        <span className="w-16 text-center text-xl font-bold">{quantity}</span>
                        <button
                          onClick={() => updateLegacyQty(menuItemId, quantity + 1)}
                          className="p-3 hover:bg-gray-200 rounded-full bg-white border"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-base text-gray-600">
                          {formatCurrency(menuItem?.price ?? 0)} x {quantity}
                        </div>
                        <div className="font-bold text-xl text-green-600">
                          {formatCurrency((menuItem?.price ?? 0) * quantity)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Custom items */}
                {customItems.map(({ id, customDescription, customAmount }) => (
                  <div key={id} className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold text-gray-900 text-lg">{customDescription}</h4>
                        <span className="inline-block mt-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          Món khác
                        </span>
                      </div>
                      <button
                        onClick={() => removeCustomItem(id)}
                        className="text-red-600 hover:text-red-800 ml-3 p-1 hover:bg-red-50 rounded-full"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">Không thể thay đổi số lượng</div>
                      <div
                        className={`font-bold text-xl ${
                          customAmount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {customAmount >= 0 ? '+' : ''}{formatCurrency(customAmount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            <div className="border-t pt-6 mb-8 bg-white rounded-lg p-6 border">
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
                disabled={isSubmitting || totalItems === 0}
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
