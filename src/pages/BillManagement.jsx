import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  CheckCircle,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Edit,
  ExternalLink,
  FileText,
  Package,
  RotateCcw,
  TrendingUp,
  X,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import CustomerPageModal from '../components/CustomerPageModal';
import EditBill from '../components/EditBill';
import KitchenManagement from '../components/KitchenManagement';
import { EmptyState, PageHeader, StatusPill, SurfaceCard } from '../components/ui';
import { getBillCostTotalsForReport } from '../utils/billCostTotals';
import { changeBillTable, getPendingBillDuplicates, markBillPaid, undoBillPaid } from '../utils/customerOrder';
import { getVietnamDateString } from '../utils/businessDate';

const BillManagement = () => {
  const { menuItems, orderItems, tables } = useApp();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getVietnamDateString());
  const [expandedBill, setExpandedBill] = useState(null);
  const [billDetails, setBillDetails] = useState({});
  const [editingBill, setEditingBill] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(null);
  const [showPublicBillModal, setShowPublicBillModal] = useState(false);
  const [showKitchenModal, setShowKitchenModal] = useState(false);
  const [changingTableBill, setChangingTableBill] = useState(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'bills'),
      where('date', '==', selectedDate),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
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
      setLoading(false);
    }, (error) => {
      console.error('Error loading bills:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate]);

  const formatCurrency = (amount = 0) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;

  const getBillLabel = (bill) => (
    bill?.isTakeaway ? `Mang về ${bill.takeawayNumber}` : `Bàn ${bill.tableNumber}`
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return '--:--';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(`${dateString}T00:00:00`);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleMarkAsPaid = async (bill) => {
    if (processingPayment === bill.id) return;

    const confirmPayment = () => {
      toast.dismiss();
      setProcessingPayment(bill.id);
      markBillPaid(bill)
        .then(() => toast.success('Đã thanh toán', { autoClose: 2000 }))
        .catch((error) => {
          console.error('Error marking bill as paid:', error);
          toast.error('Có lỗi khi cập nhật thanh toán');
        })
        .finally(() => setProcessingPayment(null));
    };

    toast.warn(
      <div>
        <p className="mb-1 font-medium">Xác nhận thanh toán đơn #{bill.id.slice(-6)}?</p>
        <p className="mb-3 text-sm text-gray-600">
          {getBillLabel(bill)} - {formatCurrency(bill.totalRevenue)}
        </p>
        <div className="flex gap-2">
          <button onClick={confirmPayment} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700">
            Xác nhận
          </button>
          <button onClick={() => toast.dismiss()} className="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600">
            Hủy
          </button>
        </div>
      </div>,
      { position: 'top-center', autoClose: false, hideProgressBar: true, closeOnClick: false, pauseOnHover: true, draggable: false }
    );
  };

  const handleUndoPayment = (bill) => {
    if (processingPayment === bill.id) return;

    const doUndo = () => {
      toast.dismiss();
      setProcessingPayment(bill.id);
      undoBillPaid(bill)
        .then(() => toast.success(`Đã hoàn tác thanh toán đơn #${bill.id.slice(-6)}`, { autoClose: 2000 }))
        .catch(() => toast.error('Có lỗi khi hoàn tác thanh toán'))
        .finally(() => setProcessingPayment(null));
    };

    toast.warn(
      <div>
        <p className="mb-1 font-medium">Hoàn tác thanh toán đơn #{bill.id.slice(-6)}?</p>
        <p className="mb-3 text-sm text-gray-600">
          {getBillLabel(bill)} - {formatCurrency(bill.totalRevenue)}
        </p>
        <div className="flex gap-2">
          <button onClick={doUndo} className="rounded bg-orange-600 px-3 py-1 text-sm text-white hover:bg-orange-700">
            Xác nhận
          </button>
          <button onClick={() => toast.dismiss()} className="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600">
            Hủy
          </button>
        </div>
      </div>,
      { position: 'top-center', autoClose: false, hideProgressBar: true, closeOnClick: false, pauseOnHover: true, draggable: false }
    );
  };

  const handleViewDetails = async (bill) => {
    if (expandedBill === bill.id) {
      setExpandedBill(null);
      return;
    }

    setExpandedBill(bill.id);
    if (billDetails[bill.id]) return;

    const detailedItems = await Promise.all(
      (bill.items || []).map(async (item) => {
        if (item.menuItemId) {
          const menuItem = menuItems.find((m) => m.id === item.menuItemId);
          if (!menuItem) return null;
          const itemRevenue = menuItem.price * item.quantity;
          return { ...item, menuItem, itemRevenue, type: 'menu' };
        }

        if (item.orderItemId) {
          try {
            const { doc, getDoc } = await import('firebase/firestore');
            const orderItemDoc = await getDoc(doc(db, 'orderItems', item.orderItemId));
            const orderItem = orderItemDoc.exists() ? { id: orderItemDoc.id, ...orderItemDoc.data() } : null;
            const parent = orderItem?.parentMenuItemId
              ? menuItems.find((m) => m.id === orderItem.parentMenuItemId)
              : null;
            const priceRef = parent || { price: orderItem?.price ?? 0, tax: 0, costPrice: 0, fixedCost: 0 };
            const itemRevenue = priceRef.price * item.quantity;
            return {
              ...item,
              menuItem: { ...priceRef, name: orderItem?.name || 'Món không xác định' },
              itemRevenue,
              type: 'menu',
            };
          } catch (error) {
            console.error('Error loading order item detail:', error);
          }
        }

        if (item.customDescription) {
          return { ...item, itemRevenue: item.customAmount, type: 'custom' };
        }

        return null;
      })
    );

    setBillDetails((prev) => ({ ...prev, [bill.id]: detailedItems.filter(Boolean) }));
  };

  const getTotalSummary = () => {
    const totalRevenue = bills.reduce((sum, bill) => sum + (bill.totalRevenue || 0), 0);
    const totalProfit = bills.reduce((sum, bill) => sum + (bill.totalProfit || 0), 0);
    const totalBills = bills.length;
    const paidBills = bills.filter((bill) => bill.status === 'paid').length;
    const pendingBills = bills.filter((bill) => !bill.status || bill.status === 'pending').length;
    let totalCostPrice = 0;
    let totalFixedCost = 0;

    bills.forEach((bill) => {
      const { costPrice, fixedCost } = getBillCostTotalsForReport(bill, menuItems, orderItems);
      totalCostPrice += costPrice;
      totalFixedCost += fixedCost;
    });

    return { totalRevenue, totalProfit, totalCostPrice, totalFixedCost, totalBills, paidBills, pendingBills };
  };

  const handleOpenPublicBill = (tableNumber) => {
    window.open(`/bill/${tableNumber}`, '_blank');
    setShowPublicBillModal(false);
  };

  const getActiveTables = () => {
    const activeTables = new Set();
    bills
      .filter((bill) => (!bill.status || bill.status === 'pending') && !bill.isTakeaway)
      .forEach((bill) => {
        if (Number(bill.tableNumber) > 0) activeTables.add(bill.tableNumber);
      });
    return Array.from(activeTables).sort((a, b) => a - b);
  };

  const getActiveBills = () =>
    bills
      .filter((bill) => !bill.status || bill.status === 'pending')
      .sort((a, b) => {
        if (a.isTakeaway !== b.isTakeaway) return a.isTakeaway ? 1 : -1;
        return (a.isTakeaway ? a.takeawayNumber : a.tableNumber) -
          (b.isTakeaway ? b.takeawayNumber : b.tableNumber);
      });

  const getEmptyTablesForChange = () => {
    const occupiedTableNumbers = new Set(
      bills
        .filter((bill) => (!bill.status || bill.status === 'pending') && !bill.isTakeaway)
        .map((bill) => String(bill.tableNumber))
    );
    return (tables || []).filter((table) => !occupiedTableNumbers.has(String(table.number)));
  };

  const handleConfirmChangeTable = async (targetTableNumber) => {
    if (!changingTableBill) return;
    const fromLabel = getBillLabel(changingTableBill);
    try {
      await changeBillTable(changingTableBill, targetTableNumber);
      toast.success(`Đã đổi ${fromLabel} sang bàn ${targetTableNumber}`, { autoClose: 2500 });
      setChangingTableBill(null);
    } catch (error) {
      console.error('Error changing table:', error);
      toast.error('Có lỗi khi đổi bàn. Vui lòng thử lại.', { autoClose: 3000 });
    }
  };

  const summary = getTotalSummary();
  const duplicatePendingBillGroups = getPendingBillDuplicates(bills);
  const activeTables = getActiveTables();
  const activeBills = getActiveBills();

  if (loading) {
    return (
      <div className="page-shell">
        <SurfaceCard className="p-8 text-center">
          <div className="animate-pulse space-y-4">
            <div className="mx-auto h-4 w-1/3 rounded bg-gray-200" />
            <div className="mx-auto h-8 w-1/2 rounded bg-gray-200" />
          </div>
        </SurfaceCard>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, tone = 'teal', sub = null }) => {
    const tones = {
      teal: 'bg-teal-100 text-teal-700',
      amber: 'bg-amber-100 text-amber-700',
      emerald: 'bg-emerald-100 text-emerald-700',
      rose: 'bg-rose-100 text-rose-700',
      orange: 'bg-orange-100 text-orange-700',
      gray: 'bg-gray-100 text-gray-700',
    };

    return (
      <SurfaceCard className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone] || tones.teal}`}>
            <Icon size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-[color:var(--text-muted)]">{label}</p>
            <p className="mt-1 text-xl font-bold text-gray-950">{value}</p>
            {sub && <p className="mt-1 text-xs text-[color:var(--text-muted)]">{sub}</p>}
          </div>
        </div>
      </SurfaceCard>
    );
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Vận hành"
        title="Quản lý đơn"
        description={`Theo dõi đơn trong ${formatDate(selectedDate)}, xử lý thanh toán, sửa đơn và điều phối bếp.`}
        actions={(
          <>
            <button type="button" onClick={() => setShowKitchenModal(true)} className="btn-secondary px-4 py-2 text-sm">
              <ChefHat size={16} />
              Bếp
            </button>
            <button type="button" onClick={() => setShowPublicBillModal(true)} className="btn-primary px-4 py-2 text-sm">
              <ExternalLink size={16} />
              Trang khách
            </button>
          </>
        )}
        meta={(
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="primary">{activeTables.length} bàn đang mở</StatusPill>
              <StatusPill tone="warning">{summary.pendingBills} đơn chờ thanh toán</StatusPill>
              <StatusPill tone="success">{summary.paidBills} đã thanh toán</StatusPill>
            </div>
            <label className="flex w-full items-center gap-2 sm:w-auto">
              <Calendar className="h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="form-control sm:w-44"
              />
            </label>
          </div>
        )}
      />

      {duplicatePendingBillGroups.length > 0 && (
        <div className="surface-card border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-950">Phát hiện bill đang mở bị trùng bàn</p>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                Có {duplicatePendingBillGroups.length} bàn/ngày đang có hơn một bill chưa thanh toán. Đơn mới vẫn ghi vào bill active, nhưng dữ liệu cũ cần kiểm tra thủ công.
              </p>
            </div>
          </div>
        </div>
      )}


      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-[color:var(--border-subtle)] p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-kicker">Danh sách đơn</p>
              <h2 className="mt-1 text-xl font-bold text-gray-950">{formatDate(selectedDate)}</h2>
            </div>
            <p className="text-sm text-[color:var(--text-muted)]">{bills.length} đơn trong ngày</p>
          </div>
        </div>

        {bills.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={FileText}
              title="Chưa có đơn hàng"
              description="Khi nhân viên hoặc khách tạo đơn trong ngày này, danh sách sẽ cập nhật realtime tại đây."
            />
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border-subtle)]">
            {bills.map((bill) => {
              const isPaid = bill.status === 'paid';
              const isPending = !bill.status || bill.status === 'pending';
              const details = billDetails[bill.id] || [];

              return (
                <article key={bill.id} className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-gray-950">Đơn #{bill.id.slice(-6)}</h3>
                            <StatusPill tone={bill.isTakeaway ? 'warning' : 'neutral'}>{getBillLabel(bill)}</StatusPill>
                            <StatusPill tone={isPaid ? 'success' : 'warning'}>{isPaid ? 'Đã thanh toán' : 'Chờ thanh toán'}</StatusPill>
                            {bill.updatedAt && <StatusPill tone="primary">Đã sửa</StatusPill>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--text-muted)]">
                            <span>Tạo {formatTime(bill.createdAt)}</span>
                            {bill.updatedAt && <span>Sửa {formatTime(bill.updatedAt)}</span>}
                            {bill.paidAt && <span>Thanh toán {formatTime(bill.paidAt)}</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 xl:items-end">
                      <div className="text-left xl:text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">Doanh thu</p>
                        <p className="text-xl font-bold text-teal-700">{formatCurrency(bill.totalRevenue)}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(bill)}
                            disabled={processingPayment === bill.id}
                            className="btn-secondary px-3 py-2 text-sm text-emerald-700"
                            title="Đánh dấu đã thanh toán"
                          >
                            {processingPayment === bill.id ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                            ) : (
                              <CheckCircle size={16} />
                            )}
                            Thanh toán
                          </button>
                        )}
                        {isPaid && (
                          <button
                            type="button"
                            onClick={() => handleUndoPayment(bill)}
                            disabled={processingPayment === bill.id}
                            className="btn-secondary px-3 py-2 text-sm text-orange-700"
                            title="Hoàn tác thanh toán"
                          >
                            {processingPayment === bill.id ? (
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
                            ) : (
                              <RotateCcw size={16} />
                            )}
                            Hoàn tác
                          </button>
                        )}
                        {isPending && !bill.isTakeaway && (
                          <button
                            type="button"
                            onClick={() => setChangingTableBill(bill)}
                            className="btn-secondary px-3 py-2 text-sm text-purple-700"
                            title="Đổi bàn"
                          >
                            <ArrowLeftRight size={16} />
                            Đổi bàn
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingBill(bill)}
                          className="btn-secondary px-3 py-2 text-sm text-blue-700"
                          title="Chỉnh sửa đơn"
                        >
                          <Edit size={16} />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewDetails(bill)}
                          className="btn-secondary px-3 py-2 text-sm"
                          title="Xem chi tiết"
                        >
                          {expandedBill === bill.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          Chi tiết
                        </button>
                      </div>
                    </div>
                  </div>

                  {expandedBill === bill.id && (
                    <div className="mt-4 border-t border-[color:var(--border-subtle)] pt-4">
                      <h4 className="mb-3 text-sm font-semibold text-gray-950">Chi tiết đơn</h4>
                      {details.length === 0 ? (
                        <p className="rounded-lg bg-gray-50 p-4 text-sm text-[color:var(--text-muted)]">Đang tải chi tiết...</p>
                      ) : (
                        <div className="space-y-2">
                          {details.map((item, index) => (
                            <div key={`${bill.id}-${index}`} className="rounded-lg bg-gray-50 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-950">
                                    {item.type === 'custom' ? item.customDescription : item.menuItem.name}
                                  </p>
                                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                                    {item.type === 'custom' ? 'Món khác' : `x ${item.quantity} - ${formatCurrency(item.menuItem.price)}/món`}
                                  </p>
                                </div>
                                <p className={`shrink-0 text-sm font-bold ${item.itemRevenue >= 0 ? 'text-teal-700' : 'text-rose-700'}`}>
                                  {item.itemRevenue >= 0 && item.type === 'custom' ? '+' : ''}{formatCurrency(item.itemRevenue)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} label="Tổng đơn" value={summary.totalBills} tone="gray" />
        <StatCard icon={Clock} label="Chờ thanh toán" value={summary.pendingBills} tone="amber" />
        <StatCard icon={CheckCircle} label="Đã thanh toán" value={summary.paidBills} tone="emerald" />
        <StatCard icon={DollarSign} label="Doanh thu" value={formatCurrency(summary.totalRevenue)} tone="teal" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={TrendingUp} label="Lợi nhuận" value={formatCurrency(summary.totalProfit)} tone="emerald" />
        <StatCard icon={Package} label="Chi phí cố định" value={formatCurrency(summary.totalFixedCost)} tone="orange" />
        <StatCard icon={DollarSign} label="Vốn" value={formatCurrency(summary.totalCostPrice)} tone="rose" />
      </div>

      {editingBill && (
        <EditBill
          bill={editingBill}
          onClose={() => setEditingBill(null)}
          onUpdated={() => {}}
        />
      )}

      {showPublicBillModal && (
        <CustomerPageModal
          activeBills={activeBills}
          tables={tables || []}
          onClose={() => setShowPublicBillModal(false)}
          onSelect={handleOpenPublicBill}
        />
      )}

      {showKitchenModal && (
        <KitchenManagement onClose={() => setShowKitchenModal(false)} selectedDate={selectedDate} />
      )}

      {changingTableBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-[var(--shadow-modal)]">
            <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border-subtle)] p-4">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-950">
                  <ArrowLeftRight size={18} className="text-purple-600" />
                  Đổi bàn
                </h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  {getBillLabel(changingTableBill)} sang bàn trống
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChangingTableBill(null)}
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-950"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              {getEmptyTablesForChange().length > 0 ? (
                <div className="space-y-2 overflow-y-auto">
                  {getEmptyTablesForChange().map((table) => (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => handleConfirmChangeTable(table.number)}
                      className="w-full rounded-lg border border-[color:var(--border-subtle)] p-3 text-left transition-colors hover:border-purple-300 hover:bg-purple-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-950">Bàn {table.number}</p>
                          <p className="text-sm text-[color:var(--text-muted)]">
                            {table.seats} chỗ{table.description ? ` - ${table.description}` : ''}
                          </p>
                        </div>
                        <ChevronDown className="h-4 w-4 -rotate-90 text-purple-500" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[color:var(--text-muted)]">Hiện không có bàn trống để đổi.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillManagement;
