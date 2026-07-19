import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { toast } from 'react-toastify';
import { db } from '../config/firebase';
import {
  BottomCartBar,
  CATEGORIES,
  ConfirmOrderSheet,
  ExistingBillPanel,
  MenuSections,
  NotePanel,
  OrderSkeleton,
  PublicOrderHeader,
} from '../components/PublicOrderComponents';
import { calculateOrderItemTotals } from '../utils/billCalculations';
import { getActiveBillForTable, submitCustomerOrder } from '../utils/customerOrder';

const CustomerOrder = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const isTakeawayTable = Number(tableNumber) >= 9000;

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
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].value);

  const headerRef = useRef(null);
  const tabsContainerRef = useRef(null);
  const sectionRefs = useRef({});
  const isLoading = loadingOrderItems || loadingMenuItems;

  useEffect(() => {
    document.body.style.overflow = showConfirmModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showConfirmModal]);

  useEffect(() => {
    const q = query(collection(db, 'orderItems'), orderBy('category'), orderBy('name'));
    getDocs(q)
      .then((snap) => setOrderItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))))
      .catch((error) => {
        console.error(error);
        toast.error('Không thể tải menu. Vui lòng thử lại!');
      })
      .finally(() => setLoadingOrderItems(false));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'menuItems'), orderBy('category'), orderBy('name'));
    getDocs(q)
      .then((snap) => setMenuItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))))
      .catch((error) => {
        console.error(error);
        toast.error('Không thể tải thông tin giá. Vui lòng thử lại!');
      })
      .finally(() => setLoadingMenuItems(false));
  }, []);

  useEffect(() => {
    if (!tableNumber) {
      setLoadingExistingBill(false);
      return;
    }

    getActiveBillForTable(tableNumber)
      .then((bill) => {
        setExistingBill(bill);
        if (bill) setShowExistingBill(true);
      })
      .catch((error) => console.error(error))
      .finally(() => setLoadingExistingBill(false));
  }, [tableNumber]);

  const groupedByCategory = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const catItems = orderItems
        .filter((orderItem) => orderItem.category === cat.value && orderItem.isAvailable !== false)
        .sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
      const grouped = {};
      const standalones = [];

      catItems.forEach((orderItem) => {
        if (!orderItem.parentMenuItemId) {
          standalones.push(orderItem);
          return;
        }
        if (!grouped[orderItem.parentMenuItemId]) {
          const parent = menuItems.find((menuItem) => menuItem.id === orderItem.parentMenuItemId);
          grouped[orderItem.parentMenuItemId] = { parent, items: [] };
        }
        grouped[orderItem.parentMenuItemId].items.push(orderItem);
      });

      const groups = Object.values(grouped).filter((group) => group.parent);
      standalones.forEach((orderItem) =>
        groups.push({ parent: { id: `standalone-${orderItem.id}`, name: orderItem.name, isStandalone: true }, items: [orderItem] })
      );

      return { cat, groups, count: catItems.length };
    }).filter((section) => section.count > 0);
  }, [orderItems, menuItems]);

  const visibleCats = useMemo(
    () => CATEGORIES.filter((cat) => groupedByCategory.some((section) => section.cat.value === cat.value)),
    [groupedByCategory]
  );

  useEffect(() => {
    const hasSections = CATEGORIES.some((cat) => sectionRefs.current[cat.value]);
    if (!hasSections) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const cat = intersecting[0]?.target.getAttribute('data-category');
        if (cat) setActiveCategory(cat);
      },
      { rootMargin: '-130px 0px -55% 0px', threshold: 0 }
    );

    CATEGORIES.forEach((cat) => {
      const el = sectionRefs.current[cat.value];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [groupedByCategory, isLoading]);

  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;
    const activeTab = container.querySelector(`[data-tab="${activeCategory}"]`);
    if (!activeTab) return;

    const cRect = container.getBoundingClientRect();
    const tRect = activeTab.getBoundingClientRect();
    container.scrollTo({
      left: container.scrollLeft + tRect.left - cRect.left - cRect.width / 2 + tRect.width / 2,
      behavior: 'smooth',
    });
  }, [activeCategory]);

  const scrollToCategory = useCallback((catValue) => {
    const el = sectionRefs.current[catValue];
    if (!el) return;
    const headerHeight = headerRef.current?.offsetHeight ?? 120;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerHeight - 8, behavior: 'smooth' });
  }, []);

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCost = 0;
    let totalFixedCost = 0;
    let totalItems = 0;
    const items = [];
    const invalidItems = [];

    Object.entries(quantities).forEach(([orderItemId, qty]) => {
      if (qty <= 0) return;
      const orderItem = orderItems.find((item) => item.id === orderItemId);
      if (!orderItem) return;
      const parentMenuItem = menuItems.find((item) => item.id === orderItem.parentMenuItemId);
      const totals = calculateOrderItemTotals(orderItem, parentMenuItem, qty);

      if (totals.valid) {
        totalRevenue += totals.revenue;
        totalProfit += totals.profit;
        totalCost += totals.cost;
        totalFixedCost += totals.fixedCost;
        totalItems += qty;
        items.push({ orderItemId, quantity: qty, name: orderItem.name, price: totals.price, revenue: totals.revenue });
      } else {
        invalidItems.push(orderItem.name);
      }
    });

    return { items, totalRevenue, totalProfit, totalCost, totalFixedCost, totalItems, invalidItems };
  }, [quantities, orderItems, menuItems]);

  const existingBillItems = useMemo(() => {
    if (!existingBill?.items) return [];

    return existingBill.items.map((item) => {
      if (item.orderItemId) {
        const orderItem = orderItems.find((candidate) => candidate.id === item.orderItemId);
        const parentMenuItem = orderItem ? menuItems.find((candidate) => candidate.id === orderItem.parentMenuItemId) : null;
        const totals = orderItem ? calculateOrderItemTotals(orderItem, parentMenuItem, item.quantity) : null;
        return { key: item.orderItemId, name: orderItem?.name || 'Món không xác định', quantity: item.quantity, price: totals?.price ?? 0 };
      }

      if (item.menuItemId) {
        const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
        return { key: item.menuItemId, name: menuItem?.name || 'Món không xác định', quantity: item.quantity, price: menuItem?.price ?? 0 };
      }

      if (item.customDescription) {
        return { key: `c-${item.customDescription}`, name: item.customDescription, quantity: 1, price: item.customAmount ?? 0 };
      }

      return null;
    }).filter(Boolean);
  }, [existingBill, orderItems, menuItems]);

  const handleQuantityChange = useCallback((orderItemId, change) => {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[orderItemId] || 0) + change);
      if (next === 0) {
        const { [orderItemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [orderItemId]: next };
    });
  }, []);

  const handleSubmitClick = () => {
    if (summary.totalItems === 0) {
      navigate(`/bill/${tableNumber}`);
      return;
    }

    if (summary.invalidItems.length > 0) {
      toast.warn(`Một số món chưa có giá: ${summary.invalidItems.join(', ')}. Vui lòng liên hệ nhân viên.`);
    }
    setShowConfirmModal(true);
  };

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    try {
      const billItems = summary.items.map(({ orderItemId, quantity }) => ({ orderItemId, quantity }));
      await submitCustomerOrder(
        tableNumber,
        billItems,
        summary.totalRevenue,
        summary.totalProfit,
        note,
        summary.totalCost,
        summary.totalFixedCost
      );

      if (isTakeawayTable && existingBill?.takeawayNumber) {
        navigate(`/order-success/MV-${existingBill.takeawayNumber}`);
      } else {
        navigate(`/order-success/${tableNumber}`);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] pb-28">
      <PublicOrderHeader
        headerRef={headerRef}
        tabsContainerRef={tabsContainerRef}
        activeCategory={activeCategory}
        visibleCats={visibleCats}
        isLoading={isLoading}
        onTabClick={scrollToCategory}
        eyebrow="Ốc đây nè"
        title={isTakeawayTable ? `Mang về${existingBill?.takeawayNumber ? ` ${existingBill.takeawayNumber}` : ''}` : `Bàn ${tableNumber}`}
        statusLabel={existingBill && !loadingExistingBill ? 'Đã có đơn' : ''}
      />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-5">
        {!loadingExistingBill && existingBill && existingBillItems.length > 0 && (
          <ExistingBillPanel
            existingBillItems={existingBillItems}
            existingBill={existingBill}
            showExistingBill={showExistingBill}
            onToggle={() => setShowExistingBill((value) => !value)}
          />
        )}

        {isLoading ? (
          <OrderSkeleton />
        ) : (
          <>
            <MenuSections
              groupedByCategory={groupedByCategory}
              sectionRefs={sectionRefs}
              quantities={quantities}
              menuItems={menuItems}
              onQuantityChange={handleQuantityChange}
            />
            <NotePanel
              note={note}
              setNote={setNote}
              showNoteInput={showNoteInput}
              setShowNoteInput={setShowNoteInput}
            />
          </>
        )}
      </main>

      <BottomCartBar totalItems={summary.totalItems} isTakeaway={isTakeawayTable} onSubmit={handleSubmitClick} />

      {showConfirmModal && (
        <ConfirmOrderSheet
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
