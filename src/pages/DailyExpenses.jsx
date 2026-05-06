import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { toast } from 'react-toastify';
import {
  Plus,
  Trash2,
  Copy,
  Calendar,
  ShoppingCart,
  TrendingUp,
  Wallet,
  PiggyBank,
  AlertCircle,
  Pencil,
  Check,
  X,
  Coins,
} from 'lucide-react';
import { formatVND } from '../utils/pnlCalculations';

const KIND_LABEL = {
  cogs: 'Đi chợ',
  opex_variable: 'Chi phí biến đổi',
  opex_fixed: 'Chi phí cố định',
  owner_draw: 'Rút vốn chủ',
};

const KIND_COLOR = {
  cogs: 'bg-orange-100 text-orange-700',
  opex_variable: 'bg-amber-100 text-amber-700',
  opex_fixed: 'bg-indigo-100 text-indigo-700',
  owner_draw: 'bg-stone-100 text-stone-700',
};

const todayISO = () => new Date().toISOString().split('T')[0];

const DailyExpenses = () => {
  const { expenseCategories } = useApp();
  const [date, setDate] = useState(todayISO());
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revenue, setRevenue] = useState(0);
  const [billsCount, setBillsCount] = useState(0);

  // Form state
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  const amountInputRef = useRef(null);

  const activeCategories = useMemo(
    () => (expenseCategories || []).filter((c) => c.active !== false),
    [expenseCategories]
  );

  // Mặc định chọn category đầu tiên (kind cogs)
  useEffect(() => {
    if (!formCategoryId && activeCategories.length > 0) {
      const firstCogs =
        activeCategories.find((c) => c.kind === 'cogs') || activeCategories[0];
      setFormCategoryId(firstCogs.id);
    }
  }, [activeCategories, formCategoryId]);

  // Subscribe expenses theo ngày
  useEffect(() => {
    if (!date) return undefined;
    setLoading(true);
    const q = query(
      collection(db, 'dailyExpenses'),
      where('date', '==', date),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setExpenses(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading daily expenses:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [date]);

  // Lấy doanh thu của ngày để hiển thị lợi nhuận gộp ngày
  useEffect(() => {
    if (!date) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const q = query(collection(db, 'bills'), where('date', '==', date));
        const snap = await getDocs(q);
        if (cancelled) return;
        let rev = 0;
        snap.forEach((d) => {
          rev += Number(d.data().totalRevenue || 0);
        });
        setRevenue(rev);
        setBillsCount(snap.size);
      } catch (err) {
        console.error('Error loading bills for revenue preview:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const totals = useMemo(() => {
    let cogs = 0;
    let opex = 0;
    let ownerDraw = 0;
    const byCategory = new Map();
    for (const e of expenses) {
      const amount = Number(e.amount || 0);
      if (e.kind === 'cogs') cogs += amount;
      else if (e.kind === 'owner_draw') ownerDraw += amount;
      else opex += amount;
      const key = e.categoryId || '__none__';
      byCategory.set(key, (byCategory.get(key) || 0) + amount);
    }
    return { cogs, opex, ownerDraw, total: cogs + opex + ownerDraw, byCategory };
  }, [expenses]);

  const grossProfit = revenue - totals.cogs;
  const grossMargin = revenue > 0 ? grossProfit / revenue : 0;

  const onAdd = async (e) => {
    e?.preventDefault();
    if (!formCategoryId) {
      toast.error('Hãy chọn danh mục');
      return;
    }
    const amountNum = Number(formAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }
    const cat = activeCategories.find((c) => c.id === formCategoryId);
    if (!cat) {
      toast.error('Danh mục không tồn tại');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'dailyExpenses'), {
        date,
        categoryId: cat.id,
        kind: cat.kind || 'cogs',
        amount: amountNum,
        note: formNote.trim(),
        createdAt: serverTimestamp(),
      });
      setFormAmount('');
      setFormNote('');
      amountInputRef.current?.focus();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi thêm phiếu chi');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (item) => {
    if (!confirm(`Xoá khoản chi "${item.note || formatVND(item.amount)}"?`)) return;
    try {
      await deleteDoc(doc(db, 'dailyExpenses', item.id));
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi xoá');
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditAmount(String(item.amount || ''));
    setEditNote(item.note || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount('');
    setEditNote('');
  };

  const saveEdit = async (item) => {
    const amountNum = Number(editAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Số tiền không hợp lệ');
      return;
    }
    try {
      await updateDoc(doc(db, 'dailyExpenses', item.id), {
        amount: amountNum,
        note: editNote.trim(),
      });
      cancelEdit();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi cập nhật');
    }
  };

  const onCopyFromYesterday = async () => {
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().split('T')[0];

    try {
      const q = query(collection(db, 'dailyExpenses'), where('date', '==', yesterday));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.info(`Hôm qua (${yesterday}) chưa có khoản chi nào`);
        return;
      }
      if (!confirm(`Sao chép ${snap.size} khoản chi từ ${yesterday} sang ${date}?`)) return;

      let copied = 0;
      for (const docSnap of snap.docs) {
        const d = docSnap.data();
        if (!d.categoryId || !Number(d.amount)) continue;
        await addDoc(collection(db, 'dailyExpenses'), {
          date,
          categoryId: d.categoryId,
          kind: d.kind || 'cogs',
          amount: Number(d.amount),
          note: d.note || '',
          createdAt: serverTimestamp(),
        });
        copied += 1;
      }
      toast.success(`Đã sao chép ${copied} khoản từ hôm qua`);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi sao chép');
    }
  };

  const categoryById = useMemo(() => {
    const map = new Map();
    (expenseCategories || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [expenseCategories]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vốn hàng ngày</h1>
            <p className="text-gray-600 mt-1">
              Nhập tiền đi chợ và chi phí biến đổi mỗi ngày để tính lợi nhuận thực.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-500" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={onCopyFromYesterday}
              className="inline-flex items-center gap-2 px-3 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100"
            >
              <Copy size={16} /> Sao chép từ hôm qua
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          icon={<TrendingUp className="text-green-600" size={20} />}
          bg="bg-green-100"
          label="Doanh thu ngày"
          value={formatVND(revenue)}
          sub={`${billsCount} đơn`}
        />
        <Card
          icon={<ShoppingCart className="text-orange-600" size={20} />}
          bg="bg-orange-100"
          label="Vốn đi chợ"
          value={formatVND(totals.cogs)}
        />
        <Card
          icon={<Wallet className="text-amber-600" size={20} />}
          bg="bg-amber-100"
          label="Chi phí biến đổi"
          value={formatVND(totals.opex)}
        />
        <Card
          icon={<Coins className="text-stone-700" size={20} />}
          bg="bg-stone-100"
          label="Rút vốn chủ (chợ nhà)"
          value={formatVND(totals.ownerDraw)}
          sub="Không tính vào CP quán"
        />
        <Card
          icon={<PiggyBank className={grossProfit >= 0 ? 'text-indigo-600' : 'text-red-600'} size={20} />}
          bg={grossProfit >= 0 ? 'bg-indigo-100' : 'bg-red-100'}
          label="Lợi nhuận gộp ngày"
          value={formatVND(grossProfit)}
          sub={revenue > 0 ? `Tỷ suất ${(grossMargin * 100).toFixed(1)}%` : 'Chưa có doanh thu'}
          valueColor={grossProfit >= 0 ? 'text-indigo-700' : 'text-red-700'}
        />
      </div>

      {/* Form thêm nhanh */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Plus size={18} className="text-indigo-600" /> Thêm khoản chi
        </h2>

        {activeCategories.length === 0 ? (
          <div className="flex items-start gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800 text-sm">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              Chưa có danh mục nào. Vào trang <strong>Danh mục chi phí</strong> để tạo các nhóm
              (Hải sản, Thịt, Rau củ...) hoặc chạy <code>npm run seed:expense-categories -- --apply</code>.
            </div>
          </div>
        ) : (
          <form onSubmit={onAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Danh mục *</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                <optgroup label="Đi chợ (COGS)">
                  {activeCategories
                    .filter((c) => c.kind === 'cogs')
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
                <optgroup label="Chi phí biến đổi">
                  {activeCategories
                    .filter((c) => c.kind === 'opex_variable')
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
                <optgroup label="Rút vốn chủ (không tính CP quán)">
                  {activeCategories
                    .filter((c) => c.kind === 'owner_draw')
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </optgroup>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Số tiền (₫) *</label>
              <input
                ref={amountInputRef}
                type="number"
                inputMode="numeric"
                step="1000"
                min="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="VD: 280000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="VD: 1kg ốc hương"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
              >
                <Plus size={16} /> Thêm
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Bảng chi tiết */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Chi tiết ngày {date}</h2>
          <span className="text-sm text-gray-500">
            {expenses.length} khoản · Tổng {formatVND(totals.total)}
          </span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-gray-400 italic">
            Chưa có khoản chi nào. Bắt đầu thêm phiếu đi chợ ở phía trên.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Danh mục</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ghi chú</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Số tiền</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {expenses.map((item) => {
                  const cat = categoryById.get(item.categoryId);
                  const isEditing = editingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`inline-flex text-xs px-2 py-0.5 rounded-full ${KIND_COLOR[item.kind] || 'bg-gray-100 text-gray-600'}`}>
                          {KIND_LABEL[item.kind] || item.kind}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-gray-200"
                            style={{ backgroundColor: cat?.color || '#94a3b8' }}
                          />
                          {cat?.name || 'Đã xoá'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded-md"
                          />
                        ) : (
                          item.note || <span className="text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-32 px-2 py-1 border border-gray-300 rounded-md text-right"
                          />
                        ) : (
                          formatVND(item.amount)
                        )}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        {isEditing ? (
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(item)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-md"
                              aria-label="Lưu"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              className="p-2 text-gray-600 hover:bg-gray-50 rounded-md"
                              aria-label="Huỷ"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md"
                              aria-label="Sửa"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(item)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                              aria-label="Xoá"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-right text-gray-700">
                    Tổng chi ngày
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                    {formatVND(totals.total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Breakdown theo danh mục */}
      {totals.byCategory.size > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Phân bổ theo danh mục</h2>
          <div className="space-y-2">
            {Array.from(totals.byCategory.entries())
              .map(([catId, amount]) => ({
                cat: categoryById.get(catId),
                amount,
              }))
              .sort((a, b) => b.amount - a.amount)
              .map(({ cat, amount }, i) => {
                const pct = totals.total > 0 ? (amount / totals.total) * 100 : 0;
                return (
                  <div key={cat?.id || i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full border border-gray-200"
                          style={{ backgroundColor: cat?.color || '#94a3b8' }}
                        />
                        <span className="font-medium text-gray-700">{cat?.name || 'Đã xoá'}</span>
                      </span>
                      <span className="text-gray-600">
                        {formatVND(amount)}{' '}
                        <span className="text-gray-400">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: cat?.color || '#94a3b8',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};

const Card = ({ icon, bg, label, value, sub, valueColor = 'text-gray-900' }) => (
  <div className="bg-white rounded-lg shadow-sm border p-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className={`text-lg font-bold truncate ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  </div>
);

export default DailyExpenses;
