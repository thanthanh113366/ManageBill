import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { ArrowLeftRight, CheckCircle, ChevronRight, Clock, Receipt, UtensilsCrossed, X } from 'lucide-react';
import { db } from '../config/firebase';
import { StatusPill } from '../components/ui';
import { getVietnamDateString } from '../utils/businessDate';
import { formatCurrency } from '../components/PublicOrderComponents';

const PublicBill = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [billDetails, setBillDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [showTableSwitcher, setShowTableSwitcher] = useState(false);
  const [defaultQR, setDefaultQR] = useState('/my_qr_1.jpg');
  const [qrBroken, setQrBroken] = useState(false);

  useEffect(() => {
    setDefaultQR(localStorage.getItem('defaultPaymentQR') || '/my_qr_1.jpg');
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, 'tables'), orderBy('number')))
      .then((snapshot) => setTables(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))))
      .catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'menuItems'))
      .then((snapshot) => setMenuItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))))
      .catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'orderItems'))
      .then((snapshot) => setOrderItems(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))))
      .catch((error) => console.error(error));
  }, []);

  useEffect(() => {
    if (!tableNumber) return undefined;

    const today = getVietnamDateString();
    const q = query(collection(db, 'bills'), where('date', '==', today));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allBillsToday = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const targetTableNumber = parseInt(tableNumber, 10);
        const matchingBills = allBillsToday.filter((candidate) => {
          const billTableNumber = candidate.tableNumber;
          return (
            billTableNumber === targetTableNumber ||
            billTableNumber === tableNumber ||
            String(billTableNumber) === String(targetTableNumber)
          );
        });

        const activeBill = matchingBills
          .filter((candidate) => !candidate.status || candidate.status === 'pending')
          .sort((a, b) => {
            const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt);
            const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt);
            return timeB - timeA;
          })[0];

        setBill(activeBill || null);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading bill:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [tableNumber]);

  useEffect(() => {
    if (!bill) {
      setBillDetails([]);
      return;
    }
    if (menuItems.length === 0 || orderItems.length === 0) return;

    const details = (bill.items || []).map((item) => {
      if (item.menuItemId) {
        const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
        if (!menuItem) return null;

        const itemTotal = menuItem.price * item.quantity;
        const taxAmount = itemTotal * (menuItem.tax / 100);
        return {
          ...item,
          type: 'menu',
          name: menuItem.name,
          price: menuItem.price,
          tax: menuItem.tax,
          itemTotal,
          taxAmount,
          finalPrice: itemTotal + taxAmount,
        };
      }

      if (item.orderItemId) {
        const orderItem = orderItems.find((candidate) => candidate.id === item.orderItemId);
        if (!orderItem) {
          return {
            ...item,
            type: 'orderItem',
            name: 'Món không xác định',
            price: 25000,
            tax: 0,
            itemTotal: 25000 * item.quantity,
            taxAmount: 0,
            finalPrice: 25000 * item.quantity,
          };
        }

        const parent = orderItem.parentMenuItemId
          ? menuItems.find((candidate) => candidate.id === orderItem.parentMenuItemId)
          : null;
        const price = parent?.price ?? 25000;
        const tax = parent?.tax ?? 0;
        const itemTotal = price * item.quantity;
        const taxAmount = itemTotal * (tax / 100);

        return {
          ...item,
          type: 'orderItem',
          name: orderItem.name,
          price,
          tax,
          itemTotal,
          taxAmount,
          finalPrice: itemTotal + taxAmount,
        };
      }

      if (item.customDescription) {
        return {
          ...item,
          type: 'custom',
          name: item.customDescription,
          quantity: 1,
          price: item.customAmount,
          tax: 0,
          itemTotal: item.customAmount,
          taxAmount: 0,
          finalPrice: item.customAmount,
        };
      }

      return null;
    }).filter(Boolean);

    setBillDetails(details);
  }, [bill, menuItems, orderItems]);

  const totals = useMemo(() => {
    const subtotal = billDetails.reduce((sum, item) => sum + item.itemTotal, 0);
    const totalTax = billDetails.reduce((sum, item) => sum + item.taxAmount, 0);
    return { subtotal, totalTax, total: subtotal + totalTax };
  }, [billDetails]);

  const availableTables = useMemo(
    () => tables.filter((table) => table.number.toString() !== tableNumber),
    [tables, tableNumber]
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const handleTableSwitch = (newTableNumber) => {
    navigate(`/bill/${newTableNumber}`);
    setShowTableSwitcher(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-[var(--primary-500)] border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-slate-600">Đang tải hóa đơn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] px-4 py-6">
      <main className="mx-auto max-w-md space-y-4">
        {!bill ? (
          <section className="relative rounded-lg border border-[var(--border-subtle)] bg-white p-6 text-center shadow-[var(--shadow-sm)]">
            {availableTables.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTableSwitcher(true)}
                className="absolute right-3 top-3 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title="Đổi bàn"
              >
                <ArrowLeftRight className="h-5 w-5" />
              </button>
            )}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Receipt className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-semibold text-slate-950">Chưa có hóa đơn</h1>
            <p className="mt-2 text-sm text-slate-600">
              Bàn {tableNumber} chưa có hóa đơn hoặc đã thanh toán xong.
            </p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500">
              <Clock className="h-4 w-4" />
              Hóa đơn sẽ tự cập nhật khi có order mới
            </p>
            <button type="button" onClick={() => navigate(`/order/${tableNumber}`)} className="btn-primary mt-5 w-full justify-center py-3">
              <UtensilsCrossed className="h-5 w-5" />
              Gọi món
            </button>
          </section>
        ) : (
          <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-[var(--shadow-md)]">
            <header className="relative border-b border-slate-100 px-5 py-5 text-center">
              {availableTables.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowTableSwitcher(true)}
                  className="absolute right-3 top-3 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  title="Đổi bàn"
                >
                  <ArrowLeftRight className="h-5 w-5" />
                </button>
              )}
              <p className="section-kicker">Ốc đây nè</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">Hóa đơn bàn {tableNumber}</h1>
              <p className="mt-1 text-sm text-slate-500">Thời gian: {formatTime(bill.createdAt)}</p>
              <div className="mt-3 flex justify-center">
                <StatusPill tone="warning" icon={Clock}>Chờ thanh toán</StatusPill>
              </div>
            </header>

            <div className="divide-y divide-slate-100">
              {billDetails.map((item, index) => (
                <div key={`${item.type}-${index}`} className={`px-5 py-4 ${item.type === 'custom' ? 'bg-sky-50/60' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-slate-900">{item.name}</h2>
                      {item.type === 'custom' ? (
                        <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          Món khác
                        </span>
                      ) : (
                        <p className="mt-1 text-sm text-slate-500">
                          {formatCurrency(item.price)} x {item.quantity}
                          {item.tax > 0 && <span className="ml-1">(thuế {item.tax}%)</span>}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-semibold ${item.finalPrice >= 0 ? 'text-slate-950' : 'text-red-600'}`}>
                        {item.finalPrice >= 0 && item.type === 'custom' ? '+' : ''}{formatCurrency(item.finalPrice)}
                      </p>
                      {item.taxAmount > 0 && <p className="mt-1 text-xs text-slate-500">+{formatCurrency(item.taxAmount)} thuế</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <footer className="space-y-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Tạm tính</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.totalTax > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Thuế</span>
                  <span>{formatCurrency(totals.totalTax)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-base font-semibold text-slate-950">Tổng cộng</span>
                <span className="text-2xl font-semibold text-[var(--primary-700)]">{formatCurrency(totals.total)}</span>
              </div>
              <button type="button" onClick={() => navigate(`/order/${tableNumber}`)} className="btn-primary mt-2 w-full justify-center py-3">
                <UtensilsCrossed className="h-5 w-5" />
                Gọi thêm món
              </button>
            </footer>
          </section>
        )}

        <section className="rounded-lg border border-[var(--border-subtle)] bg-white p-5 text-center shadow-[var(--shadow-sm)]">
          <h2 className="text-base font-semibold text-slate-950">QR thanh toán</h2>
          <div className="mt-4 flex justify-center">
            {!qrBroken ? (
              <img
                src={defaultQR}
                alt="QR thanh toán"
                className="max-h-80 w-full rounded-lg border border-slate-200 object-contain"
                onError={() => setQrBroken(true)}
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                QR không khả dụng
              </div>
            )}
          </div>
          <p className="mt-3 text-sm text-slate-500">Quét mã để thanh toán qua ví điện tử hoặc ứng dụng ngân hàng.</p>
        </section>

        <p className="text-center text-sm text-slate-500">Cảm ơn quý khách đã sử dụng dịch vụ.</p>
      </main>

      {showTableSwitcher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section className="max-h-[80vh] w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-slate-100 p-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
                <ArrowLeftRight className="h-5 w-5 text-[var(--primary-600)]" />
                Đổi bàn
              </h2>
              <button type="button" onClick={() => setShowTableSwitcher(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="p-4">
              <p className="mb-3 text-sm text-slate-600">Chọn bàn muốn xem hóa đơn:</p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {availableTables.map((table) => (
                  <button
                    type="button"
                    key={table.id}
                    onClick={() => handleTableSwitch(table.number)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 p-3 text-left transition hover:border-[var(--primary-200)] hover:bg-[var(--primary-50)]"
                  >
                    <span>
                      <span className="block font-semibold text-slate-900">Bàn {table.number}</span>
                      <span className="text-sm text-slate-500">
                        {table.seats} chỗ{table.description ? ` · ${table.description}` : ''}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--primary-600)]" />
                  </button>
                ))}
              </div>
              {availableTables.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Không có bàn khác để chuyển</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default PublicBill;
