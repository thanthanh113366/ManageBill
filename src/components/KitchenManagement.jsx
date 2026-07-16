import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChefHat,
  Clock,
  Flame,
  Plus,
  Receipt,
  Undo2,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useKitchenOrders } from '../hooks/useKitchenOrders';
import { markBillPaid } from '../utils/customerOrder';

const formatCurrency = (amount = 0) =>
  `${new Intl.NumberFormat('vi-VN').format(amount)} đ`;

const getWaitingMinutes = (createdAt, now) => {
  if (!createdAt) return 0;
  const t = createdAt?.toDate?.() || new Date(createdAt);
  return Math.max(0, Math.floor((now - t) / 60000));
};

const getKitchenItemKey = (item) =>
  item.orderItemId || item.menuItemId || item.customItemId || item.customDescription;

const getKitchenType = (item) => item?.timing?.kitchenType || item?.kitchenType || 'cook';

const getKitchenLabel = (type) => {
  if (type === 'grill') return 'Bếp nướng';
  return 'Bếp nấu';
};

const getWaitTone = (minutes, isComplete = false) => {
  if (isComplete) {
    return {
      label: 'Hoàn tất',
      card: 'border-emerald-200 bg-emerald-50/70',
      header: 'bg-emerald-600',
      text: 'text-emerald-700',
      item: 'hover:bg-emerald-50',
    };
  }

  if (minutes >= 20) {
    return {
      label: 'Gấp',
      card: 'border-red-200 bg-red-50/40',
      header: 'bg-red-600',
      text: 'text-red-700',
      item: 'hover:bg-red-50',
    };
  }

  if (minutes >= 10) {
    return {
      label: 'Ưu tiên',
      card: 'border-amber-200 bg-amber-50/40',
      header: 'bg-amber-500',
      text: 'text-amber-700',
      item: 'hover:bg-amber-50',
    };
  }

  return {
    label: 'Ổn định',
    card: 'border-slate-200 bg-white',
    header: 'bg-[var(--primary-600)]',
    text: 'text-emerald-700',
    item: 'hover:bg-teal-50',
  };
};


const getItemTimestamp = (value) => {
  const date = value?.toDate?.() || new Date(value || 0);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
};

const getPendingItemSignature = (item) =>
  [item.billId, item.tableNumber ?? item.takeawayNumber, getKitchenItemKey(item), item.batchOrder, getItemTimestamp(item.createdAt)]
    .filter((part) => part !== undefined && part !== null && part !== '')
    .join(':');

const playNewOrderAlert = () => {
  if (typeof window === 'undefined') return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    const context = new AudioContext();
    const startAt = context.currentTime + 0.03;

    [0, 0.18, 0.36].forEach((offset) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, startAt + offset);
      gain.gain.setValueAtTime(0.0001, startAt + offset);
      gain.gain.exponentialRampToValueAtTime(0.18, startAt + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.1);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt + offset);
      oscillator.stop(startAt + offset + 0.12);
    });

    setTimeout(() => context.close().catch(() => {}), 900);
  } catch (error) {
    // Browser can block audio until the first user gesture. The kitchen board still works normally.
  }
};

const TableCard = ({
  tableNumber,
  displayName,
  items,
  now,
  onComplete,
  onUndo,
  note,
  bill,
  onPayBill,
  processingPayment,
  statusSummary,
}) => {
  const pending = items.filter((item) => !item.isCompleted && item.kitchenStatus !== 'ready');
  const completed = items.filter((item) => item.isCompleted || item.kitchenStatus === 'ready');
  const summary = statusSummary || {
    pendingCount: pending.length,
    completedCount: completed.length,
    maxWait: pending.reduce((max, item) => Math.max(max, getWaitingMinutes(item.createdAt, now)), 0),
  };
  const tone = getWaitTone(summary.maxWait, summary.pendingCount === 0 && summary.completedCount > 0);
  const isProcessingPayment = processingPayment === bill?.id;

  return (
    <article className={`flex h-full min-h-0 flex-col overflow-hidden rounded-lg border shadow-sm ${tone.card}`}>
      <header className={`${tone.header} flex shrink-0 items-center justify-between gap-2 px-3 py-2 text-white`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{displayName || `Bàn ${tableNumber}`}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/80">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {summary.pendingCount > 0 ? `${summary.maxWait} phút` : 'Đã xong'}
            </span>
            <span>{summary.pendingCount} món chờ</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <a
            href={`/order/${tableNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Thêm món"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-white/15 px-2 text-[11px] font-semibold text-white transition hover:bg-white/25"
          >
            <Plus className="h-3 w-3" />
            Thêm
          </a>

          {bill?.status === 'pending' && (
            <button
              type="button"
              onClick={() => onPayBill(bill)}
              disabled={isProcessingPayment}
              title="Thanh toán"
              className="inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 text-[11px] font-semibold text-[var(--primary-700)] transition hover:bg-white/90 disabled:opacity-60"
            >
              {isProcessingPayment ? (
                <span className="h-3 w-3 rounded-full border-2 border-[var(--primary-700)] border-t-transparent animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
              Thu tiền
            </button>
          )}
        </div>
      </header>

      {note?.trim() && (
        <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span className="font-semibold">Ghi chú:</span> {note}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white/80">
        {pending.length > 0 && (
          <div className="divide-y divide-slate-100">
            {pending.map((item, idx) => {
              const wait = getWaitingMinutes(item.createdAt, now);
              const itemTone = getWaitTone(wait);

              return (
                <button
                  type="button"
                  key={`${item.billId}-${getKitchenItemKey(item)}-${item.batchOrder ?? idx}`}
                  onClick={() => onComplete(item)}
                  className={`group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${itemTone.item}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {item.isAdded && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-600">
                          Thêm
                        </span>
                      )}
                      <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-[var(--primary-700)]">
                        {item.name}
                      </span>
                    </div>
                    {item.batchTotal > 1 && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        Phần {item.batchOrder}/{item.batchTotal}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-xs font-bold ${itemTone.text}`}>{wait}p</span>
                    <span className="rounded-full border border-slate-200 bg-white p-1 text-slate-500 group-hover:border-[var(--primary-200)] group-hover:text-[var(--primary-700)]">
                      <CheckCircle className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {pending.length > 0 && completed.length > 0 && (
          <div className="border-y border-slate-100 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Đã xong
          </div>
        )}

        {completed.length > 0 && (
          <div className="divide-y divide-slate-100">
            {completed.map((item, idx) => (
              <button
                type="button"
                key={`done-${item.billId}-${getKitchenItemKey(item)}-${item.batchOrder ?? idx}`}
                onClick={() => onUndo(item)}
                className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-orange-50"
              >
                <div className="min-w-0">
                  <span className="truncate text-sm text-slate-400 line-through group-hover:text-orange-600">
                    {item.name}
                  </span>
                  {item.batchTotal > 1 && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      Phần {item.batchOrder}/{item.batchTotal}
                    </p>
                  )}
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-orange-600">
                  <Undo2 className="h-3 w-3" />
                  Hoàn tác
                </span>
              </button>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="flex h-full items-center justify-center px-4 py-8 text-sm text-slate-400">
            Không có món
          </div>
        )}
      </div>
    </article>
  );
};

const KitchenManagement = ({ onClose, selectedDate }) => {
  const [selectedKitchenType, setSelectedKitchenType] = useState('cook');
  const [now, setNow] = useState(() => new Date());
  const [processingPayment, setProcessingPayment] = useState(null);
  const knownPendingItemsRef = useRef(new Set());
  const seenPendingItemsRef = useRef(new Set());
  const hasPrimedSoundRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const {
    bills,
    kitchenQueue,
    loading,
    error,
    completeCooking,
    undoCompleted,
    clearError,
  } = useKitchenOrders(null, selectedDate);

  const filteredQueue = useMemo(
    () =>
      kitchenQueue.filter((item) => {
        return getKitchenType(item) === selectedKitchenType;
      }),
    [kitchenQueue, selectedKitchenType]
  );

  useEffect(() => {
    const pendingSignatures = new Set(
      kitchenQueue
        .filter((item) => !item.isCompleted && item.kitchenStatus !== 'ready')
        .map(getPendingItemSignature)
    );

    if (!hasPrimedSoundRef.current) {
      knownPendingItemsRef.current = pendingSignatures;
      seenPendingItemsRef.current = new Set(pendingSignatures);
      hasPrimedSoundRef.current = true;
      return;
    }

    const hasNewPendingItem = [...pendingSignatures].some(
      (signature) => !knownPendingItemsRef.current.has(signature) && !seenPendingItemsRef.current.has(signature)
    );

    if (hasNewPendingItem) playNewOrderAlert();
    pendingSignatures.forEach((signature) => seenPendingItemsRef.current.add(signature));
    knownPendingItemsRef.current = pendingSignatures;
  }, [kitchenQueue]);

  const tableStatusByTable = useMemo(() => {
    return kitchenQueue.reduce((grouped, item) => {
      const statusKey = item.isTakeaway ? `takeaway-${item.takeawayNumber || item.billId}` : `table-${item.tableNumber}`;
      if (!grouped[statusKey]) {
        grouped[statusKey] = { pendingCount: 0, completedCount: 0, maxWait: 0 };
      }

      if (item.isCompleted || item.kitchenStatus === 'ready') {
        grouped[statusKey].completedCount += 1;
      } else {
        grouped[statusKey].pendingCount += 1;
        grouped[statusKey].maxWait = Math.max(grouped[statusKey].maxWait, getWaitingMinutes(item.createdAt, now));
      }

      return grouped;
    }, {});
  }, [kitchenQueue, now]);

  const billById = useMemo(() => new Map(bills.map((bill) => [bill.id, bill])), [bills]);

  const tableCards = useMemo(() => {
    const grouped = {};

    filteredQueue.forEach((item) => {
      const tn = item.tableNumber;
      const groupKey = item.isTakeaway ? `takeaway-${item.takeawayNumber || item.billId}` : `table-${tn}`;
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          statusKey: groupKey,
          tableNumber: tn,
          items: [],
          earliestTime: Infinity,
          note: '',
          bill: null,
          displayName: '',
        };
      }

      grouped[groupKey].items.push(item);
      const createdAt = item.createdAt?.toDate?.() || new Date(item.createdAt || 0);
      if (createdAt < grouped[groupKey].earliestTime) grouped[groupKey].earliestTime = createdAt;

      if (item.billId) {
        const bill = billById.get(item.billId);
        if (bill) {
          if (!grouped[groupKey].note && bill.note?.trim()) grouped[groupKey].note = bill.note;
          if (!grouped[groupKey].bill || bill.status === 'pending') {
            grouped[groupKey].bill = bill;
            grouped[groupKey].displayName = bill.isTakeaway ? `Mang về ${bill.takeawayNumber}` : `Bàn ${tn}`;
          }
        }
      }
    });

    return Object.values(grouped).sort((a, b) => a.earliestTime - b.earliestTime);
  }, [filteredQueue, billById]);

  const handleComplete = (item) =>
    completeCooking(item.billId, getKitchenItemKey(item), item.batchOrder);

  const handleUndo = (item) => undoCompleted(item.billId, getKitchenItemKey(item));

  const handleMarkAsPaid = (bill) => {
    if (processingPayment === bill.id) return;

    const confirmPayment = () => {
      toast.dismiss();
      setProcessingPayment(bill.id);
      markBillPaid(bill)
        .then(() => toast.success(`${bill.isTakeaway ? 'Đơn mang về' : `Bàn ${bill.tableNumber}`} đã thanh toán`, { autoClose: 2000 }))
        .catch(() => toast.error('Có lỗi khi cập nhật thanh toán'))
        .finally(() => setProcessingPayment(null));
    };

    toast.warn(
      <div>
        <p className="mb-1 font-semibold text-slate-900">
          Xác nhận thanh toán {bill.isTakeaway ? 'đơn mang về' : `Bàn ${bill.tableNumber}`}?
        </p>
        <p className="mb-3 text-sm text-slate-600">{formatCurrency(bill.totalRevenue)}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={confirmPayment}
            className="rounded-md bg-[var(--primary-600)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--primary-700)]"
          >
            Xác nhận
          </button>
          <button
            type="button"
            onClick={() => toast.dismiss()}
            className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-300"
          >
            Hủy
          </button>
        </div>
      </div>,
      {
        position: 'top-center',
        autoClose: false,
        hideProgressBar: true,
        closeOnClick: false,
        pauseOnHover: true,
        draggable: false,
      }
    );
  };

  const pendingCountByType = useMemo(() => {
    return kitchenQueue.reduce((counts, item) => {
      if (!item.isCompleted && item.kitchenStatus !== 'ready') {
        const type = getKitchenType(item);
        counts[type] = (counts[type] || 0) + 1;
      }
      return counts;
    }, {});
  }, [kitchenQueue]);


  const kitchenTabs = [
    { type: 'cook', label: 'Bếp nấu', icon: ChefHat },
    { type: 'grill', label: 'Bếp nướng', icon: Flame },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-100"
      style={{
        background:
          'radial-gradient(circle at 12% 0%, rgba(20, 184, 166, 0.16), transparent 30%), linear-gradient(135deg, #f0fdfa 0%, #f8fafc 48%, #ecfeff 100%)',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        title="Đóng"
        className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-600 text-white shadow-sm backdrop-blur transition hover:bg-red-700"
      >
        <X className="h-5 w-5" />
      </button>

      {error && (
        <div className="mx-4 mt-3 flex shrink-0 items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </span>
          <button type="button" onClick={clearError} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}


      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--primary-500)] border-t-transparent animate-spin" />
        </div>
      ) : (
        <main className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
          {tableCards.length === 0 ? (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
              <Receipt className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-base font-semibold text-slate-700">Không có món cần làm</p>
              <p className="mt-1 text-sm text-slate-500">Các món mới sẽ tự xuất hiện khi có đơn trong ngày.</p>
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-auto md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2 xl:auto-rows-[minmax(0,1fr)]">
              {tableCards.map(({ statusKey, tableNumber, displayName, items, note, bill }) => (
                <TableCard
                  key={statusKey}
                  tableNumber={tableNumber}
                  displayName={displayName}
                  items={items}
                  now={now}
                  onComplete={handleComplete}
                  onUndo={handleUndo}
                  note={note}
                  bill={bill}
                  onPayBill={handleMarkAsPaid}
                  processingPayment={processingPayment}
                  statusSummary={tableStatusByTable[statusKey]}
                />
              ))}
            </div>
          )}
        </main>
      )}

      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
        {kitchenTabs.map(({ type, label, icon: Icon }) => {
          const count = pendingCountByType[type] || 0;
          const active = selectedKitchenType === type;

          return (
            <button
              type="button"
              key={type}
              onClick={() => setSelectedKitchenType(type)}
              title={label}
              aria-label={label}
              className={'relative inline-flex h-14 w-14 items-center justify-center rounded-full border shadow-lg transition ' + (active
                ? 'border-teal-600 bg-teal-600 text-white'
                : 'border-slate-200 bg-white/95 text-slate-600 hover:border-teal-200 hover:text-teal-700')}
            >
              <Icon className="h-6 w-6" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>    </div>
  );
};

export default KitchenManagement;
