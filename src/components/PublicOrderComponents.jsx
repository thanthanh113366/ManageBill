import React, { useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Minus,
  MessageSquare,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  X,
} from 'lucide-react';
import { calculateOrderItemTotals } from '../utils/billCalculations';

export const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'giai_khat', label: 'Giải khát' },
];

export const formatCurrency = (amount = 0) =>
  `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;

const SWIPE_CLOSE_THRESHOLD = 80;

export const OrderSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {[1, 2, 3].map((section) => (
      <div key={section} className="space-y-3">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="aspect-square bg-slate-100" />
              <div className="space-y-2 p-3">
                <div className="h-3 rounded bg-slate-100" />
                <div className="h-3 w-20 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const ConfirmOrderSheet = ({ items, note, totalRevenue, onConfirm, onCancel, isSubmitting }) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(null);

  const handleTouchStart = (event) => {
    startYRef.current = event.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (event) => {
    if (startYRef.current === null) return;
    const delta = event.touches[0].clientY - startYRef.current;
    if (delta > 0) setDragY(delta);
  };

  const handleTouchEnd = () => {
    if (dragY >= SWIPE_CLOSE_THRESHOLD && !isSubmitting) {
      onCancel();
    } else {
      setDragY(0);
    }
    setIsDragging(false);
    startYRef.current = null;
  };

  const opacity = Math.max(0.18, 0.42 - dragY / 420);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-slate-950" style={{ opacity }} onClick={onCancel} />
      <section
        className="relative flex max-h-[82vh] w-full flex-col rounded-t-lg bg-white shadow-2xl sm:max-w-md sm:rounded-lg"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 220ms ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Xác nhận đặt món</h2>
            <p className="text-sm text-slate-500">Kiểm tra lại trước khi gửi bếp.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-2">
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.orderItemId} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-medium text-slate-800">
                  {item.name}
                  <span className="ml-1 font-normal text-slate-500">x{item.quantity}</span>
                </span>
                <span className="font-semibold text-[var(--primary-700)]">{formatCurrency(item.revenue)}</span>
              </li>
            ))}
          </ul>

          {note?.trim() && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <span className="font-semibold">Ghi chú:</span> {note}
            </div>
          )}
        </div>

        <footer className="space-y-3 border-t border-slate-100 px-5 pb-5 pt-4">
          <div className="flex items-center justify-between text-base font-semibold text-slate-950">
            <span>Tổng cộng</span>
            <span className="text-[var(--primary-700)]">{formatCurrency(totalRevenue)}</span>
          </div>
          <button type="button" onClick={onConfirm} disabled={isSubmitting} className="btn-primary w-full justify-center py-3">
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Đang gửi...
              </>
            ) : (
              'Xác nhận đặt món'
            )}
          </button>
          <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn-secondary w-full justify-center">
            Sửa lại
          </button>
        </footer>
      </section>
    </div>
  );
};

export const PublicOrderHeader = ({ headerRef, tabsContainerRef, activeCategory, visibleCats, isLoading, onTabClick, title, eyebrow, statusLabel }) => (
  <header ref={headerRef} className="sticky top-0 z-20 border-b border-[var(--border-subtle)] bg-white/95 shadow-sm backdrop-blur">
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="section-kicker">{eyebrow}</p>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="truncate text-xl font-semibold text-slate-950">{title}</h1>
          {statusLabel && (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {statusLabel}
            </span>
          )}
        </div>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-50)] text-[var(--primary-700)]">
        <Utensils className="h-5 w-5" />
      </div>
    </div>

    <nav ref={tabsContainerRef} className="scrollbar-hide overflow-x-auto">
      <div className="mx-auto flex max-w-5xl min-w-max px-2 sm:px-4">
        {(isLoading ? CATEGORIES : visibleCats).map((cat) => (
          <button
            type="button"
            key={cat.value}
            data-tab={cat.value}
            onClick={() => onTabClick(cat.value)}
            className={`border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition ${
              activeCategory === cat.value
                ? 'border-[var(--primary-600)] text-[var(--primary-700)]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </nav>
  </header>
);

export const ExistingBillPanel = ({ existingBillItems, existingBill, showExistingBill, onToggle }) => (
  <section className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
      <div>
        <p className="text-sm font-semibold text-amber-900">Đã gọi trước đó</p>
        <p className="mt-0.5 text-xs text-amber-700">
          {existingBillItems.reduce((sum, item) => sum + item.quantity, 0)} món · {formatCurrency(existingBillItems.reduce((sum, item) => sum + item.price * item.quantity, 0))}
        </p>
      </div>
      {showExistingBill ? <ChevronUp className="h-5 w-5 text-amber-700" /> : <ChevronDown className="h-5 w-5 text-amber-700" />}
    </button>

    {showExistingBill && (
      <div className="divide-y divide-amber-100 border-t border-amber-200 bg-white/55">
        {existingBillItems.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span className="font-medium text-slate-800">
              {item.name}<span className="ml-1 font-normal text-slate-500">x{item.quantity}</span>
            </span>
            <span className="font-semibold text-slate-700">{formatCurrency(item.price * item.quantity)}</span>
          </div>
        ))}
        {existingBill.note && <div className="px-4 py-2.5 text-sm text-amber-800">Ghi chú: {existingBill.note}</div>}
      </div>
    )}
  </section>
);

export const MenuSections = ({ groupedByCategory, sectionRefs, quantities, menuItems, onQuantityChange }) => (
  <div className="space-y-8">
    {groupedByCategory.map(({ cat, groups }, sectionIndex) => (
      <section
        key={cat.value}
        ref={(el) => { sectionRefs.current[cat.value] = el; }}
        data-category={cat.value}
        className="scroll-mt-32"
        style={{ animationDelay: `${sectionIndex * 60}ms` }}
      >
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-950">{cat.label}</h2>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.parent.id}>
              {!group.parent.isStandalone && (
                <p className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {group.parent.name}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.items.map((orderItem) => {
                  const qty = quantities[orderItem.id] || 0;
                  const parentMenuItem = group.parent.isStandalone
                    ? null
                    : menuItems.find((menuItem) => menuItem.id === orderItem.parentMenuItemId);
                  const totals = calculateOrderItemTotals(orderItem, parentMenuItem, 1);

                  return (
                    <article
                      key={orderItem.id}
                      onClick={() => onQuantityChange(orderItem.id, 1)}
                      className={`relative cursor-pointer select-none overflow-hidden rounded-lg border bg-white shadow-sm transition active:scale-[0.98] ${
                        qty > 0
                          ? 'border-[var(--primary-300)] ring-2 ring-[var(--primary-100)]'
                          : 'border-slate-200 hover:border-[var(--primary-200)]'
                      } ${orderItem.fullWidth ? 'col-span-2' : ''} ${orderItem.breakBefore ? 'col-start-1' : ''}`}
                    >
                      <div className="relative aspect-square bg-slate-100">
                        {orderItem.imageUrl ? (
                          <img
                            src={orderItem.imageUrl}
                            alt={orderItem.name}
                            className="h-full w-full object-cover"
                            onError={(event) => { event.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300">
                            <Utensils className="h-10 w-10" />
                          </div>
                        )}

                        {qty > 0 && (
                          <span className="absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--primary-600)] px-2 text-xs font-bold text-white shadow-sm">
                            {qty}
                          </span>
                        )}

                        <div className="absolute bottom-2 right-2 flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                          {qty > 0 && (
                            <button
                              type="button"
                              onClick={() => onQuantityChange(orderItem.id, -1)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onQuantityChange(orderItem.id, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-600)] text-white shadow-sm transition hover:bg-[var(--primary-700)]"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="p-3">
                        <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-slate-950">{orderItem.name}</p>
                        {totals.valid ? (
                          <p className="mt-1 text-sm font-semibold text-[var(--primary-700)]">{formatCurrency(totals.price)}</p>
                        ) : (
                          <p className="mt-1 text-xs font-semibold text-amber-700">Liên hệ nhân viên</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    ))}
  </div>
);

export const NotePanel = ({ note, setNote, showNoteInput, setShowNoteInput }) => (
  <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
    <button type="button" onClick={() => setShowNoteInput((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <MessageSquare className="h-4 w-4 text-slate-500" />
        {note.trim() ? 'Ghi chú đã thêm' : 'Thêm ghi chú'}
      </span>
      {showNoteInput ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
    </button>
    {showNoteInput && (
      <div className="border-t border-slate-100 px-4 pb-4">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="VD: ít cay, không hành, ít đá..."
          rows={3}
          className="form-control mt-3 resize-none"
        />
      </div>
    )}
  </section>
);

export const BottomCartBar = ({ totalItems, isTakeaway, onSubmit }) => {
  const Icon = isTakeaway ? ShoppingBag : ShoppingCart;

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-subtle)] bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl justify-center">
        {totalItems === 0 && isTakeaway ? (
          <div className="flex h-11 items-center gap-2 text-sm font-semibold text-slate-500">
            <ShoppingBag className="h-4 w-4" />
            Chọn món để đặt mang về
          </div>
        ) : (
          <button type="button" onClick={onSubmit} className="btn-primary min-w-[220px] justify-center py-3">
            <Icon className="h-4 w-4" />
            {totalItems === 0 ? 'Xem hóa đơn' : `Đặt ${totalItems} món`}
          </button>
        )}
      </div>
    </footer>
  );
};
