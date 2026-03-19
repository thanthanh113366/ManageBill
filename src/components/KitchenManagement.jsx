import React, { useState, useMemo, useEffect } from 'react';
import { X, ChefHat, Trash2, CheckCircle, Plus } from 'lucide-react';
import { useKitchenOrders } from '../hooks/useKitchenOrders';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { toast } from 'react-toastify';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

// ── Helpers ──────────────────────────────────────────────────────────────────

const getWaitingMinutes = (createdAt, now) => {
  if (!createdAt) return 0;
  const t = createdAt?.toDate?.() || new Date(createdAt);
  return Math.max(0, Math.floor((now - t) / 60000));
};

const urgencyColor = (minutes) => {
  if (minutes >= 20) return 'text-red-600';
  if (minutes >= 10) return 'text-yellow-600';
  return 'text-green-600';
};

// ── Table Card ────────────────────────────────────────────────────────────────

const TableCard = ({ tableNumber, displayName, items, now, onComplete, onUndo, note, bill, onPayBill, processingPayment }) => {
  const pending   = items.filter(i => !i.isCompleted && i.kitchenStatus !== 'ready');
  const completed = items.filter(i =>  i.isCompleted || i.kitchenStatus === 'ready');

  // Thời gian chờ lâu nhất trong bàn
  const maxWait = items.reduce((max, i) => {
    const m = getWaitingMinutes(i.createdAt, now);
    return m > max ? m : max;
  }, 0);

  const headerColor =
    maxWait >= 20 ? 'bg-red-500' :
    maxWait >= 10 ? 'bg-yellow-500' :
    'bg-indigo-500';

  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full">
      {/* Header bàn */}
      <div className={`${headerColor} px-3 py-2 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-white font-bold text-base shrink-0">{displayName || `Bàn ${tableNumber}`}</span>
          <span className="text-white/70 text-xs font-medium shrink-0">{maxWait}p</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Thêm món — mở tab mới đến trang order */}
          <a
            href={`/order/${tableNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Thêm món"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-white/20 hover:bg-white/35 text-white text-xs font-medium transition-colors"
          >
            <Plus size={12} />
            Thêm
          </a>

          {/* Thanh toán — chỉ hiện khi bill đang pending */}
          {bill?.status === 'pending' && (
            <button
              onClick={() => onPayBill(bill)}
              disabled={processingPayment === bill.id}
              title="Thanh toán"
              className="flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white text-xs font-medium transition-colors"
            >
              {processingPayment === bill.id ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle size={12} />
              )}
              Thanh toán
            </button>
          )}
        </div>
      </div>

      {/* Ghi chú của khách */}
      {note?.trim() && (
        <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-100 shrink-0">
          <p className="text-xs text-amber-700 italic leading-snug">📝 {note}</p>
        </div>
      )}

      {/* Danh sách món */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">

        {/* Món chưa xong — bấm tên để hoàn thành */}
        {pending.map((item, idx) => (
          <button
            key={`${item.billId}-${item.orderItemId || item.menuItemId || item.customDescription}-${item.batchOrder ?? idx}`}
            onClick={() => onComplete(item)}
            className={`w-full text-left px-3 py-2 transition-colors group ${
              item.isAdded ? 'hover:bg-red-50' : 'hover:bg-indigo-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-medium leading-tight ${
                item.isAdded
                  ? 'text-red-600 group-hover:text-red-800'
                  : 'text-gray-800 group-hover:text-indigo-700'
              }`}>
                {item.isAdded && (
                  <span className="mr-1 text-[10px] font-bold bg-red-100 text-red-500 px-1 py-0.5 rounded uppercase tracking-wide">
                    +
                  </span>
                )}
                {item.name}
                {item.batchTotal > 1 && (
                  <span className="ml-1 text-xs text-gray-400 font-normal">
                    {item.batchOrder}/{item.batchTotal}
                  </span>
                )}
              </span>
              <span className={`text-xs font-semibold shrink-0 ${urgencyColor(getWaitingMinutes(item.createdAt, now))}`}>
                {getWaitingMinutes(item.createdAt, now)}p
              </span>
            </div>
          </button>
        ))}

        {/* Separator nếu có cả 2 loại */}
        {pending.length > 0 && completed.length > 0 && (
          <div className="px-3 py-1 bg-gray-50">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Đã xong</p>
          </div>
        )}

        {/* Món đã xong — bấm để undo */}
        {completed.map((item, idx) => (
          <button
            key={`done-${item.billId}-${item.orderItemId || item.menuItemId || item.customDescription}-${item.batchOrder ?? idx}`}
            onClick={() => onUndo(item)}
            className="w-full text-left px-3 py-2 hover:bg-orange-50 transition-colors group"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-gray-400 line-through group-hover:text-orange-500 leading-tight">
                {item.name}
                {item.batchTotal > 1 && (
                  <span className="ml-1">
                    {item.batchOrder}/{item.batchTotal}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-gray-300 shrink-0 group-hover:text-orange-400">undo</span>
            </div>
          </button>
        ))}

        {/* Bàn trống */}
        {items.length === 0 && (
          <div className="flex items-center justify-center h-full py-6">
            <span className="text-xs text-gray-300">Không có món</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Component chính ───────────────────────────────────────────────────────────

const KitchenManagement = ({ onClose, selectedDate }) => {
  const [selectedKitchenType, setSelectedKitchenType] = useState('cook');
  const [now, setNow] = useState(() => new Date());
  const [processingPayment, setProcessingPayment] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const {
    bills,
    kitchenQueue,
    tables,
    loading,
    error,
    completeCooking,
    undoCompleted,
    deleteAllMenuItemTimings,
    clearError,
  } = useKitchenOrders(null, selectedDate);

  // Lọc theo loại bếp
  const filteredQueue = useMemo(() =>
    kitchenQueue.filter(item => {
      const type = item?.timing?.kitchenType || item?.kitchenType || 'cook';
      return type === selectedKitchenType;
    }),
    [kitchenQueue, selectedKitchenType]
  );

  // Nhóm theo bàn, sắp xếp bàn theo thời gian tạo bill sớm nhất
  const tableCards = useMemo(() => {
    const grouped = {};

    filteredQueue.forEach(item => {
      const tn = item.tableNumber;
      if (!grouped[tn]) {
        grouped[tn] = { tableNumber: tn, items: [], earliestTime: Infinity, note: '', bill: null, displayName: '' };
      }
      grouped[tn].items.push(item);
      const t = item.createdAt?.toDate?.() || new Date(item.createdAt || 0);
      if (t < grouped[tn].earliestTime) grouped[tn].earliestTime = t;
      // Lấy ghi chú + bill từ billId
      if (item.billId) {
        const bill = bills.find(b => b.id === item.billId);
        if (bill) {
          if (!grouped[tn].note && bill.note?.trim()) grouped[tn].note = bill.note;
          // Ưu tiên bill pending (chờ thanh toán)
          if (!grouped[tn].bill || bill.status === 'pending') {
            grouped[tn].bill = bill;
            grouped[tn].displayName = bill.isTakeaway
              ? `MV ${bill.takeawayNumber}`
              : `Bàn ${tn}`;
          }
        }
      }
    });

    return Object.values(grouped)
      .sort((a, b) => a.earliestTime - b.earliestTime);
  }, [filteredQueue, bills]);

  const handleComplete = (item) =>
    completeCooking(item.billId, item.orderItemId || item.menuItemId || item.customDescription, item.batchOrder);

  const handleUndo = (item) =>
    undoCompleted(item.billId, item.orderItemId || item.menuItemId || item.customDescription);

  const handleMarkAsPaid = (bill) => {
    if (processingPayment === bill.id) return;

    const confirmPayment = () => {
      toast.dismiss();
      setProcessingPayment(bill.id);
      updateDoc(doc(db, 'bills', bill.id), {
        status: 'paid',
        paidAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
        .then(() => toast.success(`Bàn ${bill.tableNumber} đã thanh toán`, { autoClose: 2000 }))
        .catch(() => toast.error('Có lỗi khi cập nhật thanh toán'))
        .finally(() => setProcessingPayment(null));
    };

    toast.warn(
      <div>
        <p className="font-medium mb-1">
          Xác nhận thanh toán Bàn {bill.tableNumber}?
        </p>
        <p className="text-sm text-gray-600 mb-3">
          {formatCurrency(bill.totalRevenue)}
        </p>
        <div className="flex gap-2">
          <button
            onClick={confirmPayment}
            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
          >
            Xác nhận
          </button>
          <button
            onClick={() => toast.dismiss()}
            className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
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

  const handleDeleteAll = async () => {
    if (window.confirm('Xóa TẤT CẢ menuItemTimings?\nHành động này KHÔNG THỂ HOÀN TÁC!')) {
      const r = await deleteAllMenuItemTimings();
      alert(r.success ? `✅ Đã xóa ${r.count} records` : '❌ Có lỗi xảy ra');
    }
  };

  // Đếm số món chưa xong cho tab badge
  const countByType = (type) =>
    kitchenQueue.filter(i => {
      const t = i?.timing?.kitchenType || i?.kitchenType || 'cook';
      return t === type && !i.isCompleted && i.kitchenStatus !== 'ready';
    }).length;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col">

      {/* ── Header ── */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-orange-500" />
          </div>
          <span className="font-semibold text-gray-900">Quản lý bếp</span>
          <span className="text-xs text-gray-400 hidden sm:inline">— bấm tên món để hoàn thành</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs loại bếp */}
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {[
              { type: 'cook',  label: '👨‍🍳 Nấu'   },
              { type: 'grill', label: '🔥 Nướng' },
            ].map(({ type, label }) => {
              const cnt = countByType(type);
              return (
                <button
                  key={type}
                  onClick={() => setSelectedKitchenType(type)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    selectedKitchenType === type
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                  {cnt > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {cnt > 9 ? '9+' : cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleDeleteAll}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Dọn dẹp DB"
          >
            <Trash2 size={15} />
          </button>

          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 mt-2 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between shrink-0">
          {error}
          <button onClick={clearError} className="ml-2 text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Grid bàn: 2 hàng × 4 cột ── */}
      {!loading && (
        <div className="flex-1 overflow-auto p-3">
          {tableCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <span className="text-4xl mb-3">🍽️</span>
              <p className="text-sm">Không có món nào cần làm</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 grid-rows-2 gap-3 h-full min-h-0"
                 style={{ gridAutoRows: 'minmax(0, 1fr)' }}>
              {tableCards.map(({ tableNumber, displayName, items, note, bill }) => (
                <TableCard
                  key={tableNumber}
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
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KitchenManagement;
