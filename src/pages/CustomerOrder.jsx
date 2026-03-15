import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';
import { Plus, Minus, ChevronDown, ChevronUp, MessageSquare, X } from 'lucide-react';
import { submitCustomerOrder, testFirestoreConnection, getActiveBillForTable } from '../utils/customerOrder';
import { calculateOrderItemTotals } from '../utils/billCalculations';

// Bỏ "Tất cả" — mỗi category là 1 section cuộn tới
const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'giai_khat', label: 'Giải khát' },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

// ──────────────────────────────────────────────
// Skeleton card
// ──────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
      <div className="h-4 w-1/3 bg-gray-200 rounded" />
    </div>
    <div className="p-4 space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-3 w-24 bg-gray-200 rounded" />
              <div className="h-3 w-16 bg-gray-200 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="w-6 h-4 bg-gray-200 rounded" />
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ──────────────────────────────────────────────
// Confirm modal (bottom sheet on mobile)
// ──────────────────────────────────────────────
const ConfirmModal = ({ items, note, totalRevenue, onConfirm, onCancel, isSubmitting }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
    <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
    <div className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
      <div className="flex justify-center pt-3 pb-1 sm:hidden">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      <div className="px-5 pt-3 pb-2 flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-900">Xác nhận đặt món</h2>
        <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>
      <div className="overflow-y-auto px-5 pb-2 flex-1">
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.orderItemId} className="py-2.5 flex justify-between items-center text-sm">
              <span className="text-gray-800 font-medium">
                {item.name}
                <span className="ml-1 text-gray-400 font-normal">×{item.quantity}</span>
              </span>
              <span className="text-indigo-600 font-semibold">{formatCurrency(item.revenue)}</span>
            </li>
          ))}
        </ul>
        {note?.trim() && (
          <div className="mt-3 bg-amber-50 rounded-xl p-3 text-sm text-amber-800">
            <span className="font-medium">Ghi chú: </span>{note}
          </div>
        )}
      </div>
      <div className="px-5 pt-3 pb-6 border-t border-gray-100 space-y-3">
        <div className="flex justify-between text-base font-bold text-gray-900">
          <span>Tổng cộng</span>
          <span className="text-indigo-600">{formatCurrency(totalRevenue)}</span>
        </div>
        <button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Đang gửi...</>
          ) : 'Xác nhận đặt món'}
        </button>
        <button onClick={onCancel} disabled={isSubmitting} className="w-full text-gray-500 text-sm font-medium py-1.5">
          Hủy, sửa lại
        </button>
      </div>
    </div>
  </div>
);

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
const CustomerOrder = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();

  const [orderItems, setOrderItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loadingOrderItems, setLoadingOrderItems] = useState(true);
  const [loadingMenuItems, setLoadingMenuItems] = useState(true);
  const [loadingExistingBill, setLoadingExistingBill] = useState(true);

  const [existingBill, setExistingBill] = useState(null);
  const [showExistingBill, setShowExistingBill] = useState(false);

  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // ── Scrollspy refs ──
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].value);
  const headerRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const sectionRefs = useRef({});

  const isLoading = loadingOrderItems || loadingMenuItems;

  // ── Load orderItems ──
  useEffect(() => {
    const q = query(collection(db, 'orderItems'), orderBy('category'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (snap) => { setOrderItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadingOrderItems(false); },
      (err) => { console.error(err); toast.error('Không thể tải menu. Vui lòng thử lại!'); setLoadingOrderItems(false); }
    );
    return () => unsub();
  }, []);

  // ── Load menuItems ──
  useEffect(() => {
    const q = query(collection(db, 'menuItems'), orderBy('category'), orderBy('name'));
    const unsub = onSnapshot(
      q,
      (snap) => { setMenuItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadingMenuItems(false); },
      (err) => { console.error(err); toast.error('Không thể tải thông tin giá. Vui lòng thử lại!'); setLoadingMenuItems(false); }
    );
    return () => unsub();
  }, []);

  // ── Load đơn hiện tại của bàn ──
  useEffect(() => {
    if (!tableNumber) { setLoadingExistingBill(false); return; }
    getActiveBillForTable(tableNumber)
      .then((bill) => { setExistingBill(bill); if (bill) setShowExistingBill(true); })
      .catch((err) => console.error(err))
      .finally(() => setLoadingExistingBill(false));
  }, [tableNumber]);

  // ── Scrollspy: cập nhật activeCategory khi cuộn ──
  useEffect(() => {
    const handleScroll = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 120;
      // checkY là vị trí ngay dưới header sticky (+ một chút đệm)
      const checkY = window.scrollY + headerHeight + 24;

      let current = CATEGORIES[0].value;
      for (const cat of CATEGORIES) {
        const el = sectionRefs.current[cat.value];
        if (!el) continue;
        const elTop = el.getBoundingClientRect().top + window.scrollY;
        if (elTop <= checkY) current = cat.value;
      }
      setActiveCategory(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // chạy 1 lần khi mount
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Auto-scroll tab đang active vào vùng nhìn thấy ──
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const activeTab = container.querySelector(`[data-tab="${activeCategory}"]`);
    if (!activeTab) return;
    const cRect = container.getBoundingClientRect();
    const tRect = activeTab.getBoundingClientRect();
    const scrollLeft = container.scrollLeft + tRect.left - cRect.left - cRect.width / 2 + tRect.width / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [activeCategory]);

  // ── Click tab → cuộn tới section ──
  const scrollToCategory = useCallback((catValue) => {
    const el = sectionRefs.current[catValue];
    if (!el) return;
    const headerHeight = headerRef.current?.offsetHeight ?? 120;
    const top = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  // ── Tính summary ──
  const summary = useMemo(() => {
    let totalRevenue = 0, totalProfit = 0, totalItems = 0;
    const items = [], invalidItems = [];

    Object.entries(quantities).forEach(([orderItemId, qty]) => {
      if (qty <= 0) return;
      const oi = orderItems.find((i) => i.id === orderItemId);
      if (!oi) return;
      const pm = menuItems.find((m) => m.id === oi.parentMenuItemId);
      const totals = calculateOrderItemTotals(oi, pm, qty);
      if (totals.valid) {
        totalRevenue += totals.revenue;
        totalProfit += totals.profit;
        totalItems += qty;
        items.push({ orderItemId, quantity: qty, name: oi.name, price: totals.price, revenue: totals.revenue });
      } else {
        invalidItems.push(oi.name);
      }
    });
    return { items, totalRevenue, totalProfit, totalItems, invalidItems };
  }, [quantities, orderItems, menuItems]);

  const handleQuantityChange = useCallback((orderItemId, change) => {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[orderItemId] || 0) + change);
      if (next === 0) { const { [orderItemId]: _, ...rest } = prev; return rest; }
      return { ...prev, [orderItemId]: next };
    });
  }, []);

  const handleSubmitClick = () => {
    if (summary.totalItems === 0) { navigate(`/bill/${tableNumber}`); return; }
    if (summary.invalidItems.length > 0)
      toast.warn(`Một số món chưa có giá: ${summary.invalidItems.join(', ')}. Vui lòng liên hệ nhân viên.`);
    setShowConfirmModal(true);
  };

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    try {
      const billItems = summary.items.map(({ orderItemId, quantity }) => ({ orderItemId, quantity }));
      const ok = await testFirestoreConnection();
      if (!ok) throw new Error('Firestore connection failed');
      await submitCustomerOrder(tableNumber, billItems, summary.totalRevenue, summary.totalProfit, note);
      navigate(`/order-success/${tableNumber}`);
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Gom items theo category → sub-group theo parentMenuItemId ──
  const groupedByCategory = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const catItems = orderItems.filter((oi) => oi.category === cat.value);
      const grouped = {};
      const standalones = [];

      catItems.forEach((oi) => {
        if (!oi.parentMenuItemId) { standalones.push(oi); return; }
        if (!grouped[oi.parentMenuItemId]) {
          const parent = menuItems.find((m) => m.id === oi.parentMenuItemId);
          grouped[oi.parentMenuItemId] = { parent, items: [] };
        }
        grouped[oi.parentMenuItemId].items.push(oi);
      });

      const groups = Object.values(grouped).filter((g) => g.parent);
      standalones.forEach((oi) =>
        groups.push({ parent: { id: `standalone-${oi.id}`, name: oi.name, isStandalone: true }, items: [oi] })
      );

      return { cat, groups, count: catItems.length };
    }).filter((s) => s.count > 0);
  }, [orderItems, menuItems]);

  // ── Existing bill items display ──
  const existingBillItems = useMemo(() => {
    if (!existingBill?.items) return [];
    return existingBill.items.map((item) => {
      if (item.orderItemId) {
        const oi = orderItems.find((o) => o.id === item.orderItemId);
        const pm = oi ? menuItems.find((m) => m.id === oi?.parentMenuItemId) : null;
        const t = oi ? calculateOrderItemTotals(oi, pm, item.quantity) : null;
        return { key: item.orderItemId, name: oi?.name || 'Món không xác định', quantity: item.quantity, price: t?.price ?? 0 };
      }
      if (item.menuItemId) {
        const mi = menuItems.find((m) => m.id === item.menuItemId);
        return { key: item.menuItemId, name: mi?.name || 'Món không xác định', quantity: item.quantity, price: mi?.price ?? 0 };
      }
      if (item.customDescription)
        return { key: `c-${item.customDescription}`, name: item.customDescription, quantity: 1, price: item.customAmount ?? 0 };
      return null;
    }).filter(Boolean);
  }, [existingBill, orderItems, menuItems]);

  // ── Chỉ hiển thị tabs của categories có dữ liệu ──
  const visibleCats = useMemo(
    () => CATEGORIES.filter((cat) => groupedByCategory.some((s) => s.cat.value === cat.value)),
    [groupedByCategory]
  );

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50 pb-28">

      {/* ── Sticky header ── */}
      <div ref={headerRef} className="bg-white sticky top-0 z-10 shadow-sm">

        {/* Title row */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Ốc đây nè</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xl font-extrabold text-gray-900 tracking-tight">Bàn {tableNumber}</span>
            {existingBill && !loadingExistingBill && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                Đã có đơn
              </span>
            )}
          </div>
        </div>

        {/* ── Category tabs (scrollspy underline style) ── */}
        <div ref={tabsContainerRef} className="overflow-x-auto scrollbar-hide">
          <div className="flex min-w-max px-2">
            {(isLoading ? CATEGORIES : visibleCats).map((cat) => (
              <button
                key={cat.value}
                data-tab={cat.value}
                onClick={() => scrollToCategory(cat.value)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-150 ${
                  activeCategory === cat.value
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-4 pt-4 space-y-2">

        {/* Đơn đã gọi */}
        {!loadingExistingBill && existingBill && existingBillItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden mb-4">
            <button
              onClick={() => setShowExistingBill((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-bold text-amber-800">Đã gọi trước đó</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {existingBillItems.reduce((s, i) => s + i.quantity, 0)} món •{' '}
                  {formatCurrency(existingBillItems.reduce((s, i) => s + i.price * i.quantity, 0))}
                </p>
              </div>
              {showExistingBill ? <ChevronUp size={18} className="text-amber-600" /> : <ChevronDown size={18} className="text-amber-600" />}
            </button>
            {showExistingBill && (
              <div className="border-t border-amber-200 divide-y divide-amber-100">
                {existingBillItems.map((item) => (
                  <div key={item.key} className="flex justify-between items-center px-4 py-2.5 text-sm">
                    <span className="text-gray-800">{item.name}<span className="ml-1 text-gray-400">×{item.quantity}</span></span>
                    <span className="text-gray-700 font-medium">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                {existingBill.note && (
                  <div className="px-4 py-2.5 text-xs text-amber-700 italic">Ghi chú: {existingBill.note}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Skeleton khi đang load ── */}
        {isLoading && (
          <div className="space-y-4">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        )}

        {/* ── Tất cả categories theo section ── */}
        {!isLoading && groupedByCategory.map(({ cat, groups }) => (
          <section
            key={cat.value}
            ref={(el) => { sectionRefs.current[cat.value] = el; }}
            data-category={cat.value}
            className="pt-4"
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-bold text-gray-800">{cat.label}</h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Groups */}
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.parent.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  {/* Group header (chỉ hiển thị nếu không phải standalone) */}
                  {!group.parent.isStandalone && (
                    <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
                      <h3 className="font-semibold text-gray-800 text-sm">{group.parent.name}</h3>
                    </div>
                  )}

                  <div className="divide-y divide-gray-50">
                    {group.items.map((oi) => {
                      const qty = quantities[oi.id] || 0;
                      const pm = group.parent.isStandalone ? null : menuItems.find((m) => m.id === oi.parentMenuItemId);
                      const totals = calculateOrderItemTotals(oi, pm, 1);

                      return (
                        <div
                          key={oi.id}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${qty > 0 ? 'bg-indigo-50/40' : ''}`}
                        >
                          {/* Image */}
                          {oi.imageUrl ? (
                            <img
                              src={oi.imageUrl} alt={oi.name}
                              className="w-12 h-12 object-cover rounded-xl flex-shrink-0"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">🍽️</div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight">{oi.name}</p>
                            {totals.valid
                              ? <p className="text-indigo-600 font-bold text-sm mt-0.5">{formatCurrency(totals.price)}</p>
                              : <p className="text-amber-500 text-xs mt-0.5">Liên hệ nhân viên</p>
                            }
                          </div>

                          {/* Quantity controls */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleQuantityChange(oi.id, -1)}
                              disabled={qty === 0}
                              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition-colors active:scale-90"
                            >
                              <Minus size={14} />
                            </button>
                            <span className={`w-6 text-center text-sm font-bold ${qty > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                              {qty}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(oi.id, 1)}
                              className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm transition-colors active:scale-90"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* ── Ghi chú ── */}
        {!isLoading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-6">
            <button
              onClick={() => setShowNoteInput((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2 text-gray-600">
                <MessageSquare size={16} />
                <span className="text-sm font-medium">
                  {note.trim() ? 'Ghi chú đã thêm' : 'Thêm ghi chú (ít cay, không hành...)'}
                </span>
              </div>
              {showNoteInput ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>
            {showNoteInput && (
              <div className="border-t border-gray-100 px-4 pb-4">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: ít cay, không hành, ít đá..."
                  rows={3}
                  className="w-full mt-3 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Padding cuối trang */}
        <div className="h-6" />
      </div>

      {/* ── Floating cart button ── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-gray-100 z-20">
        <button
          onClick={handleSubmitClick}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 transition-colors shadow-lg active:scale-[0.98]"
        >
          {summary.totalItems === 0 ? (
            <span className="mx-auto text-base font-semibold">Xem hóa đơn</span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="bg-white/20 rounded-xl px-2.5 py-1 text-sm font-bold">{summary.totalItems}</span>
                <span>món đã chọn</span>
              </div>
              <span className="font-extrabold text-lg">{formatCurrency(summary.totalRevenue)}</span>
            </>
          )}
        </button>
      </div>

      {/* ── Confirm Modal ── */}
      {showConfirmModal && (
        <ConfirmModal
          items={summary.items}
          note={note}
          totalRevenue={summary.totalRevenue}
          onConfirm={handleConfirmOrder}
          onCancel={() => !isSubmitting && setShowConfirmModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
};

export default CustomerOrder;
