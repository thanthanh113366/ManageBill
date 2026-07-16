import React, { useState, useMemo, useEffect, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { toast } from 'react-toastify';
import CustomerPageModal from '../components/CustomerPageModal';
import { Calculator, ExternalLink, Minus, Plus, Search, ShoppingCart, X } from 'lucide-react';
import { VoiceOrderButton } from '../components/VoiceOrderButton';
import { getVoiceOrderMetrics } from '../utils/voiceOrderMetrics';
import CustomItemForm from '../components/CustomItemForm';
import { submitTableOrder } from '../utils/customerOrder';
import { getVietnamDateString } from '../utils/businessDate';
import { EmptyState, PageHeader, StatusPill, SurfaceCard } from '../components/ui';

const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'lai_rai', label: 'Lai rai' },
  { value: 'giai_khat', label: 'Giải khát' },
  { value: 'all', label: 'Tất cả' },
];

const CreateBill = () => {
  const { menuItems, tables } = useApp();
  const [quantities, setQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('oc');
  const [selectedTable, setSelectedTable] = useState('');
  const [showCustomerOrderModal, setShowCustomerOrderModal] = useState(false);
  const [bills, setBills] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getVietnamDateString());
  const [customItems, setCustomItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const voiceAddedIdsRef = useRef(new Set());

  const billSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    let totalFixedCost = 0;
    let totalItems = 0;
    const items = [];

    Object.entries(quantities).forEach(([menuItemId, quantity]) => {
      if (quantity > 0) {
        const menuItem = menuItems.find((item) => item.id === menuItemId);
        if (menuItem) {
          const itemRevenue = menuItem.price * quantity;
          const profitPerItem =
            menuItem.price -
            (menuItem.costPrice || 0) -
            (menuItem.fixedCost || 0) -
            (menuItem.price * (menuItem.tax || 0)) / 100;
          const itemProfit = profitPerItem * quantity;

          totalRevenue += itemRevenue;
          totalProfit += itemProfit;
          totalCost += (menuItem.costPrice || 0) * quantity;
          totalFixedCost += (menuItem.fixedCost || 0) * quantity;
          totalItems += quantity;

          items.push({
            menuItemId,
            quantity,
            name: menuItem.name,
            price: menuItem.price,
            revenue: itemRevenue,
            profit: itemProfit,
          });
        }
      }
    });

    return { items, totalRevenue, totalProfit, totalCost, totalFixedCost, totalItems };
  }, [quantities, menuItems]);

  const customTotals = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;

    customItems.forEach((item) => {
      totalRevenue += item.customAmount;
      totalProfit += item.customAmount;
    });

    return { totalRevenue, totalProfit, totalCost: 0, totalFixedCost: 0 };
  }, [customItems]);

  const totalRevenueWithCustom = billSummary.totalRevenue + customTotals.totalRevenue;
  const totalProfitWithCustom = billSummary.totalProfit + customTotals.totalProfit;
  const totalCostWithCustom = billSummary.totalCost + customTotals.totalCost;
  const totalFixedCostWithCustom = billSummary.totalFixedCost + customTotals.totalFixedCost;
  const totalItemCount = billSummary.totalItems + customItems.length;

  const handleQuantityChange = (menuItemId, change) => {
    const currentQuantity = quantities[menuItemId] || 0;
    const newQuantity = Math.max(0, currentQuantity + change);

    if (newQuantity === 0 && voiceAddedIdsRef.current.has(menuItemId)) {
      getVoiceOrderMetrics().recordUserRemovedVoiceItem(menuItemId);
      voiceAddedIdsRef.current.delete(menuItemId);
    }

    setQuantities((prev) => {
      if (newQuantity === 0) {
        const { [menuItemId]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [menuItemId]: newQuantity };
    });
  };

  const setQuantityDirectly = (menuItemId, value) => {
    const quantity = Math.max(0, parseInt(value, 10) || 0);

    if (quantity === 0 && voiceAddedIdsRef.current.has(menuItemId)) {
      getVoiceOrderMetrics().recordUserRemovedVoiceItem(menuItemId);
      voiceAddedIdsRef.current.delete(menuItemId);
    }

    if (quantity === 0) {
      setQuantities((prev) => {
        const { [menuItemId]: removed, ...rest } = prev;
        return rest;
      });
    } else {
      setQuantities((prev) => ({ ...prev, [menuItemId]: quantity }));
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
      const menuBillItems = billSummary.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
      }));

      const customBillItems = customItems.map((item) => ({
        customItemId: item.customItemId || item.id,
        customDescription: item.customDescription,
        customAmount: item.customAmount,
        quantity: 1,
      }));

      await submitTableOrder({
        tableNumber: selectedTable,
        items: [...menuBillItems, ...customBillItems],
        totalRevenue: totalRevenueWithCustom,
        totalProfit: totalProfitWithCustom,
        totalCost: totalCostWithCustom,
        totalFixedCost: totalFixedCostWithCustom,
        source: 'internal',
      });

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

  const formatCurrency = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;

  useEffect(() => {
    const q = query(
      collection(db, 'bills'),
      where('date', '==', selectedDate),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const sortedBills = billsData.sort((a, b) => {
        const aIsPending = !a.status || a.status === 'pending';
        const bIsPending = !b.status || b.status === 'pending';

        if (aIsPending && !bIsPending) return -1;
        if (!aIsPending && bIsPending) return 1;

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
    matchedItems.forEach((item) => voiceAddedIdsRef.current.add(item.menuItemId));
    setQuantities((prev) => {
      const newQuantities = { ...prev };
      matchedItems.forEach((item) => {
        newQuantities[item.menuItemId] = item.quantity;
      });
      return newQuantities;
    });
  };

  const getActiveTables = () => {
    const activeTables = new Set();
    bills
      .filter((bill) => bill.status === 'pending' && !bill.isTakeaway)
      .forEach((bill) => {
        if (bill.tableNumber) activeTables.add(bill.tableNumber);
      });

    return Array.from(activeTables).sort((a, b) => a - b);
  };

  const getActiveBills = () =>
    bills
      .filter((bill) => bill.status === 'pending')
      .sort((a, b) => {
        if (a.isTakeaway !== b.isTakeaway) return a.isTakeaway ? 1 : -1;
        return (a.isTakeaway ? a.takeawayNumber : a.tableNumber) -
          (b.isTakeaway ? b.takeawayNumber : b.tableNumber);
      });

  const filteredMenuItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch = !normalizedSearch || item.name?.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [menuItems, selectedCategory, searchTerm]);

  const getCategoryCount = (categoryValue) => {
    if (categoryValue === 'all') return menuItems.length;
    return menuItems.filter((item) => item.category === categoryValue).length;
  };

  const removeCustomItem = (customItemId) => {
    setCustomItems((prev) => prev.filter((item) => item.id !== customItemId));
  };

  const activeTables = getActiveTables();
  const activeBills = getActiveBills();

  if (menuItems.length === 0) {
    return (
      <div className="page-shell">
        <EmptyState
          icon={ShoppingCart}
          title="Chưa có món nào trong menu"
          description="Thêm món bán trước khi tạo đơn. Sau khi có menu, màn tạo đơn sẽ tự mở danh sách món theo từng nhóm."
          action={(
            <a href="/menu" className="btn-primary px-4 py-2">
              Quản lý menu
            </a>
          )}
        />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Vận hành"
        title="Tạo đơn"
        description="Chọn bàn, thêm món và kiểm tra tổng tiền trong giỏ trước khi gửi xuống bếp."
        actions={(
          <button
            type="button"
            onClick={() => setShowCustomerOrderModal(true)}
            className="btn-primary px-4 py-2"
            title="Mở trang khách hàng"
          >
            <ExternalLink size={16} />
            Trang khách
          </button>
        )}
        meta={(
          <div className="flex flex-wrap gap-2">
            <StatusPill tone="primary">{activeTables.length} bàn đang mở</StatusPill>
            <StatusPill tone="warning">{activeBills.length} đơn chờ thanh toán</StatusPill>
            {selectedTable && <StatusPill tone="success">Đang chọn bàn {selectedTable}</StatusPill>}
          </div>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <SurfaceCard className="p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="table" className="mb-1.5 block text-sm font-semibold text-gray-800">
                    Bàn phục vụ
                  </label>
                  <select
                    id="table"
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="form-control"
                  >
                    <option value="">Chọn bàn</option>
                    {tables?.map((table) => (
                      <option key={table.id} value={table.number}>
                        Bàn {table.number} - {table.seats} chỗ
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="selected-date" className="mb-1.5 block text-sm font-semibold text-gray-800">
                    Ngày theo dõi
                  </label>
                  <input
                    id="selected-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="form-control"
                  />
                </div>
              </div>

              <div className="flex justify-start md:justify-end">
                <VoiceOrderButton
                  menuItems={menuItems}
                  currentCategory={selectedCategory}
                  onItemsMatched={handleVoiceItemsMatched}
                />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden">
            <div className="border-b border-[color:var(--border-subtle)] p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="section-kicker">Danh sách món</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-950">Chọn món cho đơn</h2>
                </div>
                <div className="relative w-full xl:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm món..."
                    className="form-control pl-9"
                  />
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <div className="flex min-w-max gap-2">
                  {CATEGORIES.map((category) => {
                    const isSelected = selectedCategory === category.value;
                    return (
                      <button
                        key={category.value}
                        type="button"
                        onClick={() => setSelectedCategory(category.value)}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                          isSelected
                            ? 'bg-teal-700 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-950'
                        }`}
                      >
                        {category.label}
                        <span className={`rounded-full px-2 py-0.5 text-xs ${isSelected ? 'bg-white/20' : 'bg-white'}`}>
                          {getCategoryCount(category.value)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="divide-y divide-[color:var(--border-subtle)]">
              {filteredMenuItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-[color:var(--text-muted)]">
                  Không tìm thấy món phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                filteredMenuItems.map((item) => {
                  const quantity = quantities[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className={`flex flex-col gap-4 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                        quantity > 0 ? 'bg-teal-50/70' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-gray-950">{item.name}</h3>
                          {quantity > 0 && <StatusPill tone="primary">Đã chọn {quantity}</StatusPill>}
                        </div>
                        <p className="mt-1 font-semibold text-teal-700">{formatCurrency(item.price)}</p>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-40"
                          disabled={quantity === 0}
                          aria-label={`Giảm ${item.name}`}
                        >
                          <Minus size={16} />
                        </button>

                        <input
                          type="number"
                          value={quantity}
                          onChange={(e) => setQuantityDirectly(item.id, e.target.value)}
                          className="h-9 w-16 rounded-lg border border-[color:var(--border-subtle)] text-center text-sm font-semibold outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                          min="0"
                          aria-label={`Số lượng ${item.name}`}
                        />

                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item.id, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-white transition-colors hover:bg-teal-800"
                          aria-label={`Thêm ${item.name}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-5">
            <div className="mb-4">
              <p className="section-kicker">Món ngoài menu</p>
              <h2 className="mt-1 text-lg font-bold text-gray-950">Thêm phụ thu hoặc giảm giá</h2>
            </div>
            <CustomItemForm
              onAdd={({ customDescription, customAmount }) => {
                const customItemId = `custom_${Date.now()}_${Math.random()}`;
                setCustomItems((prev) => [
                  ...prev,
                  { id: customItemId, customItemId, customDescription, customAmount },
                ]);
                toast.success('Đã thêm món khác');
              }}
            />
          </SurfaceCard>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <SurfaceCard className="overflow-hidden">
            <div className="border-b border-[color:var(--border-subtle)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="section-kicker">Giỏ hiện tại</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-950">Tổng kết đơn</h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--primary-soft)] text-[color:var(--primary)]">
                  <Calculator size={20} />
                </div>
              </div>
            </div>

            <div className="p-5">
              {totalItemCount === 0 ? (
                <div className="rounded-lg bg-gray-50 p-5 text-center text-sm text-[color:var(--text-muted)]">
                  Chọn món để xem tổng tiền và tạo đơn.
                </div>
              ) : (
                <div className="space-y-3">
                  {billSummary.items.map((item) => (
                    <div key={item.menuItemId} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-[color:var(--text-muted)]">x{item.quantity}</p>
                      </div>
                      <p className="shrink-0 font-semibold text-gray-950">{formatCurrency(item.revenue)}</p>
                    </div>
                  ))}

                  {customItems.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{item.customDescription}</p>
                        <p className="text-xs text-[color:var(--text-muted)]">Món khác</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className={`font-semibold ${item.customAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {item.customAmount >= 0 ? '+' : ''}{formatCurrency(item.customAmount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeCustomItem(item.id)}
                          className="rounded-full p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`Xóa ${item.customDescription}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 border-t border-[color:var(--border-subtle)] pt-5">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-gray-700">Tổng cộng</span>
                  <span className="text-2xl font-bold text-teal-700">{formatCurrency(totalRevenueWithCustom)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 text-sm text-[color:var(--text-muted)]">
                  <span>Lợi nhuận dự kiến</span>
                  <span className="font-semibold text-emerald-700">{formatCurrency(totalProfitWithCustom)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedTable || totalItemCount === 0}
                className="btn-primary mt-5 w-full px-4 py-3"
              >
                {isSubmitting ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <ShoppingCart size={20} />
                    Tạo đơn
                  </>
                )}
              </button>

              {!selectedTable && totalItemCount > 0 && (
                <p className="mt-3 text-center text-xs text-amber-700">Chọn bàn trước khi tạo đơn.</p>
              )}
            </div>
          </SurfaceCard>
        </aside>
      </div>

      {showCustomerOrderModal && (
        <CustomerPageModal
          activeBills={activeBills}
          tables={tables || []}
          onClose={() => setShowCustomerOrderModal(false)}
          onSelect={handleOpenPublicBill}
        />
      )}
    </div>
  );
};

export default CreateBill;
