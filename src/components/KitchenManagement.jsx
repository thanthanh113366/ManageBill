import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Clock, CheckCircle, Play, ChefHat, Trash2 } from 'lucide-react';
import { useKitchenOrders } from '../hooks/useKitchenOrders';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Số phút đã chờ kể từ createdAt của bill */
const getWaitingMinutes = (createdAt, now) => {
  if (!createdAt) return 0;
  const t = createdAt?.toDate?.() || new Date(createdAt);
  return Math.max(0, Math.floor((now - t) / 60000));
};

/** Badge màu theo độ khẩn (phút chờ) */
const urgencyBadge = (minutes) => {
  if (minutes >= 20) return { label: `${minutes}p`, cls: 'bg-red-100 text-red-700 border-red-200' };
  if (minutes >= 10) return { label: `${minutes}p`, cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return { label: `${minutes}p`, cls: 'bg-green-100 text-green-700 border-green-200' };
};

const STATUS_CONFIG = {
  pending:  { label: 'Chờ làm',    icon: <Clock    className="w-3.5 h-3.5" />, cls: 'bg-gray-100   text-gray-600'  },
  cooking:  { label: 'Đang làm',   icon: <Play     className="w-3.5 h-3.5" />, cls: 'bg-yellow-100 text-yellow-700' },
  ready:    { label: 'Hoàn thành', icon: <CheckCircle className="w-3.5 h-3.5" />, cls: 'bg-green-100  text-green-700'  },
};

// ── Component chính ───────────────────────────────────────────────────────────

const KitchenManagement = ({ onClose, selectedDate }) => {
  const [selectedTable, setSelectedTable]           = useState(null);
  const [selectedKitchenType, setSelectedKitchenType] = useState('cook');
  const [now, setNow]                               = useState(() => new Date());

  // Cập nhật "now" mỗi phút để timer tự refresh
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const {
    kitchenQueue,
    tables,
    loading,
    error,
    startCooking,
    completeCooking,
    undoCompleted,
    deleteAllMenuItemTimings,
    clearError,
  } = useKitchenOrders(selectedTable, selectedDate);

  // Lọc theo loại bếp
  const queueByType = useMemo(() =>
    kitchenQueue.filter(item => {
      const type = item?.timing?.kitchenType || item?.kitchenType || 'cook';
      return type === selectedKitchenType;
    }),
    [kitchenQueue, selectedKitchenType]
  );

  // Đếm món chưa xong theo bàn (dùng cho grid tổng quan)
  const unfinishedByTable = useCallback((tableNum) =>
    kitchenQueue.filter(i => i.tableNumber === tableNum && i.kitchenStatus !== 'ready').length,
    [kitchenQueue]
  );

  const handleStart    = (item) => startCooking(item.billId, item.orderItemId || item.menuItemId);
  const handleComplete = (item) => completeCooking(item.billId, item.orderItemId || item.menuItemId, item.batchOrder);
  const handleUndo     = (item) => undoCompleted(item.billId, item.orderItemId || item.menuItemId);

  const handleDeleteAll = async () => {
    if (window.confirm('Xóa TẤT CẢ menuItemTimings?\nHành động này KHÔNG THỂ HOÀN TÁC!')) {
      const result = await deleteAllMenuItemTimings();
      if (result.success) alert(`✅ Đã xóa ${result.count} menuItemTimings`);
      else alert('❌ Có lỗi xảy ra');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-gray-600">Đang tải...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[96vh] overflow-hidden flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 leading-tight">Quản lý bếp</h2>
              <p className="text-xs text-gray-400">Thứ tự ưu tiên theo thời gian chờ</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-xs font-medium"
              title="Xóa tất cả menuItemTimings"
            >
              <Trash2 size={12} />
              Dọn DB
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between">
            {error}
            <button onClick={clearError} className="text-red-500 hover:text-red-700 ml-2">×</button>
          </div>
        )}

        {/* ── Tổng quan bàn (lấy động từ Firestore) ── */}
        <div className="px-4 py-2 border-b bg-gray-50 shrink-0">
          <p className="text-xs font-medium text-gray-500 mb-2">Tổng quan bàn</p>
          <div className="flex flex-wrap gap-2">
            {[...tables]
              .sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
              .map(table => {
                const count = unfinishedByTable(table.number);
                const isSelected = selectedTable === table.number;
                return (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTable(isSelected ? null : table.number)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : count > 0
                          ? 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'
                          : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <span>Bàn {table.number}</span>
                    {count > 0 && (
                      <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ${
                        isSelected ? 'bg-white/30 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {count > 9 ? '9+' : count}
                      </span>
                    )}
                  </button>
                );
              })
            }
            {selectedTable && (
              <button
                onClick={() => setSelectedTable(null)}
                className="px-2.5 py-1 rounded-full border border-gray-200 text-xs text-gray-500 hover:border-gray-400"
              >
                Tất cả
              </button>
            )}
          </div>
        </div>

        {/* ── Tabs loại bếp ── */}
        <div className="px-4 pt-3 shrink-0">
          <div className="inline-flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {[
              { type: 'cook',  label: '👨‍🍳 Món nấu' },
              { type: 'grill', label: '🔥 Món nướng' },
            ].map(({ type, label }) => {
              const count = kitchenQueue.filter(i =>
                (i?.timing?.kitchenType || i?.kitchenType || 'cook') === type
              ).length;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedKitchenType(type)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    selectedKitchenType === type
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-xs text-gray-400">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Danh sách món ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {queueByType.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🍽️</span>
              </div>
              <p className="text-gray-500 text-sm">Không có món nào cần làm</p>
            </div>
          ) : (
            queueByType.map((item, index) => {
              const waitMins  = getWaitingMinutes(item.createdAt, now);
              const urgency   = urgencyBadge(waitMins);
              const statusCfg = STATUS_CONFIG[item.kitchenStatus] || STATUS_CONFIG.pending;
              const isDone    = item.isCompleted || item.kitchenStatus === 'ready';

              return (
                <div
                  key={`${item.billId}-${item.orderItemId || item.menuItemId}-${item.batchOrder ?? index}`}
                  className={`rounded-xl border p-3 transition-shadow hover:shadow-sm ${
                    isDone ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">

                    {/* Số thứ tự */}
                    <span className="text-sm font-bold text-indigo-500 w-6 shrink-0">
                      #{index + 1}
                    </span>

                    {/* Bàn */}
                    <span className="text-sm font-semibold text-gray-700 w-14 shrink-0">
                      Bàn {item.tableNumber}
                    </span>

                    {/* Tên món */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {item.name}
                        {item.batchTotal > 1 && (
                          <span className="ml-1.5 text-xs font-normal text-gray-400">
                            ({item.batchOrder}/{item.batchTotal})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">⏱ dự kiến {item.estimatedTime}p</p>
                    </div>

                    {/* Badge trạng thái */}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCfg.cls}`}>
                      {statusCfg.icon}
                      {statusCfg.label}
                    </span>

                    {/* Badge thời gian chờ */}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${urgency.cls}`}>
                      {urgency.label}
                    </span>

                    {/* Nút hành động */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDone ? (
                        <button
                          onClick={() => handleUndo(item)}
                          className="px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-medium hover:bg-orange-100"
                        >
                          Undo
                        </button>
                      ) : item.kitchenStatus === 'cooking' ? (
                        <button
                          onClick={() => handleComplete(item)}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600"
                        >
                          Hoàn thành
                        </button>
                      ) : (
                        // pending → có 2 nút
                        <>
                          <button
                            onClick={() => handleStart(item)}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg text-xs font-medium hover:bg-indigo-100"
                          >
                            Bắt đầu
                          </button>
                          <button
                            onClick={() => handleComplete(item)}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600"
                          >
                            Xong
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};

export default KitchenManagement;
