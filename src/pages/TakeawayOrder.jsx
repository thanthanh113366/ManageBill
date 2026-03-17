import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';
import { Plus, Minus, ChevronDown, ChevronUp, MessageSquare, X, ShoppingBag } from 'lucide-react';
import { createTakeawayOrder } from '../utils/customerOrder';
import { calculateOrderItemTotals } from '../utils/billCalculations';

const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'giai_khat', label: 'Giải khát' },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

// ── Skeleton ──────────────────────────────────
const SkeletonCard = () => (
  <div className="space-y-5 animate-pulse">
    <div className="h-4 w-1/4 bg-white/50 rounded" />
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <div className="aspect-square bg-white/50 rounded-2xl" />
          <div className="h-3 w-3/4 bg-white/50 rounded" />
          <div className="h-3 w-1/2 bg-white/50 rounded" />
        </div>
      ))}
    </div>
  </div>
);

// ── Confirm Modal ─────────────────────────────
const SWIPE_CLOSE_THRESHOLD = 80;

const ConfirmModal = ({ items, note, totalRevenue, onConfirm, onCancel, isSubmitting }) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(null);

  const handleTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e) => {
    if (startYRef.current === null) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (dragY >= SWIPE_CLOSE_THRESHOLD && !isSubmitting) onCancel();
    else setDragY(0);
    setIsDragging(false);
    startYRef.current = null;
  };

  const opacity = Math.max(0.15, 0.4 - (dragY / 400));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" style={{ opacity: opacity / 0.4 }} />
      <div
        className="relative bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32,0.72,0,1)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className={`w-10 h-1 rounded-full transition-colors ${dragY > 40 ? 'bg-indigo-400' : 'bg-gray-300'}`} />
        </div>
        <div className="px-5 pt-3 pb-2 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">Xác nhận đặt món</h2>
          <button onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
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
            {isSubmitting
              ? <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> Đang gửi...</>
              : 'Xác nhận đặt món'}
          </button>
          <button onClick={onCancel} disabled={isSubmitting} className="w-full text-gray-500 text-sm font-medium py-1.5">
            Hủy, sửa lại
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────
const TakeawayOrder = () => {
  const navigate = useNavigate();

  const [orderItems, setOrderItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingOrderItems, setLoadingOrderItems] = useState(true);
  const [loadingMenuItems, setLoadingMenuItems] = useState(true);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].value);
  const headerRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const sectionRefs = useRef({});

  const isLoading = loadingOrderItems || loadingMenuItems;

  // ── Khoá scroll body khi modal mở ──
  useEffect(() => {
    document.body.style.overflow = showConfirmModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showConfirmModal]);

  // ── Load orderItems ──
  useEffect(() => {
    const q = query(collection(db, 'orderItems'), orderBy('category'), orderBy('name'));
    return onSnapshot(
      q,
      (snap) => { setOrderItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadingOrderItems(false); },
      (err) => { console.error(err); toast.error('Không thể tải menu. Vui lòng thử lại!'); setLoadingOrderItems(false); }
    );
  }, []);

  // ── Load menuItems ──
  useEffect(() => {
    const q = query(collection(db, 'menuItems'), orderBy('category'), orderBy('name'));
    return onSnapshot(
      q,
      (snap) => { setMenuItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadingMenuItems(false); },
      (err) => { console.error(err); toast.error('Không thể tải thông tin giá. Vui lòng thử lại!'); setLoadingMenuItems(false); }
    );
  }, []);

  // ── Scrollspy ──
  useEffect(() => {
    const hasSections = CATEGORIES.some((cat) => sectionRefs.current[cat.value]);
    if (!hasSections) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (intersecting.length > 0) {
          const cat = intersecting[0].target.getAttribute('data-category');
          if (cat) setActiveCategory(cat);
        }
      },
      { rootMargin: '-130px 0px -55% 0px', threshold: 0 }
    );
    CATEGORIES.forEach((cat) => { const el = sectionRefs.current[cat.value]; if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [orderItems, isLoading]);

  // ── Auto-scroll active tab ──
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const activeTab = container.querySelector(`[data-tab="${activeCategory}"]`);
    if (!activeTab) return;
    const cRect = container.getBoundingClientRect();
    const tRect = activeTab.getBoundingClientRect();
    container.scrollTo({ left: container.scrollLeft + tRect.left - cRect.left - cRect.width / 2 + tRect.width / 2, behavior: 'smooth' });
  }, [activeCategory]);

  const scrollToCategory = useCallback((catValue) => {
    const el = sectionRefs.current[catValue];
    if (!el) return;
    const headerHeight = headerRef.current?.offsetHeight ?? 120;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerHeight - 8, behavior: 'smooth' });
  }, []);

  // ── Summary ──
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
    if (summary.totalItems === 0) return;
    if (summary.invalidItems.length > 0)
      toast.warn(`Một số món chưa có giá: ${summary.invalidItems.join(', ')}. Vui lòng liên hệ nhân viên.`);
    setShowConfirmModal(true);
  };

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    try {
      const billItems = summary.items.map(({ orderItemId, quantity }) => ({ orderItemId, quantity }));
      const n = await createTakeawayOrder(billItems, summary.totalRevenue, summary.totalProfit, note);
      navigate(`/order-success/MV-${n}`);
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Grouping ──
  const groupedByCategory = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const catItems = orderItems
        .filter((oi) => oi.category === cat.value && oi.isAvailable !== false)
        .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
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

  const visibleCats = useMemo(
    () => CATEGORIES.filter((cat) => groupedByCategory.some((s) => s.cat.value === cat.value)),
    [groupedByCategory]
  );

  // ════════════════════════
  // RENDER
  // ════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-purple-50 to-indigo-100 pb-28">

      {/* ── Sticky header ── */}
      <div ref={headerRef} className="bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-sm">
        <div className="px-5 py-2 border-b border-white/50 flex items-center gap-3">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider shrink-0">Ốc đây nè</span>
          <span className="text-gray-300 text-sm">·</span>
          <span className="text-xl font-extrabold text-gray-900 tracking-tight">🥡 Mang về</span>
        </div>

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

        {isLoading && (
          <div className="space-y-4">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        )}

        {!isLoading && groupedByCategory.map(({ cat, groups }, sectionIndex) => (
          <section
            key={cat.value}
            ref={(el) => { sectionRefs.current[cat.value] = el; }}
            data-category={cat.value}
            className="pt-4 animate-fade-slide-up"
            style={{ animationDelay: `${sectionIndex * 60}ms` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-base font-bold text-gray-800/90">{cat.label}</h2>
              <div className="flex-1 h-px bg-white/60" />
            </div>

            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.parent.id}>
                  {!group.parent.isStandalone && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-0.5">
                      {group.parent.name}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {group.items.map((oi) => {
                      const qty = quantities[oi.id] || 0;
                      const pm = group.parent.isStandalone ? null : menuItems.find((m) => m.id === oi.parentMenuItemId);
                      const totals = calculateOrderItemTotals(oi, pm, 1);
                      return (
                        <div
                          key={oi.id}
                          onClick={() => handleQuantityChange(oi.id, 1)}
                          className={`relative bg-white/75 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm border border-white/60 cursor-pointer select-none
                            active:scale-[0.96] transition-transform duration-100
                            ${qty > 0 ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
                            ${oi.fullWidth ? 'col-span-2' : ''}
                            ${oi.breakBefore ? 'col-start-1' : ''}`}
                        >
                          <div className="relative">
                            {oi.imageUrl ? (
                              <img src={oi.imageUrl} alt={oi.name} className="w-full aspect-square object-cover"
                                onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              <div className="w-full aspect-square bg-white/40 flex items-center justify-center text-3xl">🍽️</div>
                            )}
                            {qty > 0 && (
                              <span key={qty} className="absolute top-2 left-2 bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center animate-badge-pop shadow-md z-10">
                                {qty}
                              </span>
                            )}
                            <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10" onClick={(e) => e.stopPropagation()}>
                              {qty > 0 && (
                                <button onClick={() => handleQuantityChange(oi.id, -1)}
                                  className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center animate-slide-in-right active:scale-90 transition-colors hover:bg-gray-50">
                                  <Minus size={12} />
                                </button>
                              )}
                              <button onClick={() => handleQuantityChange(oi.id, 1)}
                                className="w-7 h-7 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md active:scale-90 transition-colors">
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                          <div className="p-2.5">
                            <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{oi.name}</p>
                            {totals.valid
                              ? <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(totals.price)}</p>
                              : <p className="text-amber-500 text-xs mt-0.5">Liên hệ nhân viên</p>
                            }
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
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm overflow-hidden mt-6">
            <button onClick={() => setShowNoteInput((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left">
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
                <textarea value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: ít cay, không hành, ít đá..." rows={3}
                  className="w-full mt-3 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none outline-none" />
              </div>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>

      {/* ── Floating cart button ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-2.5 bg-white/80 backdrop-blur-md border-t border-white/40 z-20 flex justify-center">
        {summary.totalItems === 0 ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-2.5">
            <ShoppingBag size={17} />
            <span>Chọn món để đặt mang về</span>
          </div>
        ) : (
          <button
            onClick={handleSubmitClick}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 shadow-lg active:scale-[0.98] min-w-[200px]"
          >
            <ShoppingBag size={17} />
            <span className="text-sm font-semibold">Đặt</span>
            <span key={summary.totalItems} className="animate-bump bg-white/20 rounded-lg px-2 py-0.5 text-sm font-bold">
              {summary.totalItems}
            </span>
            <span className="text-sm font-semibold">món</span>
          </button>
        )}
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

export default TakeawayOrder;
