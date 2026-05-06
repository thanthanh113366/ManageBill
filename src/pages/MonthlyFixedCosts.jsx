import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  getDocs,
  setDoc,
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
  Building2,
  Pencil,
  Check,
  X,
  Settings,
  Save,
} from 'lucide-react';
import { formatVND, daysInMonth } from '../utils/pnlCalculations';

const todayMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const TAX_MODE_OPTIONS = [
  { value: 'on_profit_before_tax', label: 'Trên lợi nhuận trước thuế' },
  { value: 'on_revenue', label: 'Trên doanh thu' },
];

const MonthlyFixedCosts = () => {
  const { expenseCategories, pnlSettings } = useApp();
  const [month, setMonth] = useState(todayMonth());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Inline edit
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  // Settings form
  const [settingsDraft, setSettingsDraft] = useState({
    taxRate: 0,
    taxMode: 'on_profit_before_tax',
    depreciationMonthly: 0,
    otherReservePercent: 0,
    useTheoreticalCost: true,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (pnlSettings) {
      setSettingsDraft({
        taxRate: Number(pnlSettings.taxRate || 0),
        taxMode: pnlSettings.taxMode || 'on_profit_before_tax',
        depreciationMonthly: Number(pnlSettings.depreciationMonthly || 0),
        otherReservePercent: Number(pnlSettings.otherReservePercent || 0),
        useTheoreticalCost: pnlSettings.useTheoreticalCost !== false,
      });
    }
  }, [pnlSettings]);

  const fixedCategories = useMemo(
    () =>
      (expenseCategories || []).filter(
        (c) => c.kind === 'opex_fixed' && c.active !== false
      ),
    [expenseCategories]
  );

  useEffect(() => {
    if (!formCategoryId && fixedCategories.length > 0) {
      setFormCategoryId(fixedCategories[0].id);
    }
  }, [fixedCategories, formCategoryId]);

  // Subscribe theo month
  useEffect(() => {
    if (!month) return undefined;
    setLoading(true);
    const q = query(collection(db, 'monthlyFixedCosts'), where('month', '==', month));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.categoryId || '').localeCompare(b.categoryId || ''));
        setItems(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error loading monthly fixed costs:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [month]);

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.amount || 0), 0), [items]);
  const dim = daysInMonth(month);
  const perDayAvg = dim > 0 ? total / dim : 0;

  const categoryById = useMemo(() => {
    const map = new Map();
    (expenseCategories || []).forEach((c) => map.set(c.id, c));
    return map;
  }, [expenseCategories]);

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
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'monthlyFixedCosts'), {
        month,
        categoryId: formCategoryId,
        amount: amountNum,
        note: formNote.trim(),
        createdAt: serverTimestamp(),
      });
      setFormAmount('');
      setFormNote('');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi thêm chi phí cố định');
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (item) => {
    const cat = categoryById.get(item.categoryId);
    if (!confirm(`Xoá chi phí "${cat?.name || ''}" (${formatVND(item.amount)}) tháng ${item.month}?`)) return;
    try {
      await deleteDoc(doc(db, 'monthlyFixedCosts', item.id));
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
      await updateDoc(doc(db, 'monthlyFixedCosts', item.id), {
        amount: amountNum,
        note: editNote.trim(),
      });
      cancelEdit();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi cập nhật');
    }
  };

  const onCopyToNext = async () => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return;
    const next = new Date(y, m, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;

    if (items.length === 0) {
      toast.info('Tháng này chưa có chi phí nào để sao chép');
      return;
    }
    if (!confirm(`Sao chép ${items.length} chi phí từ ${month} sang ${nextMonth}?`)) return;

    try {
      // Kiểm tra tháng đích đã có gì chưa để cảnh báo
      const existingQ = query(collection(db, 'monthlyFixedCosts'), where('month', '==', nextMonth));
      const existingSnap = await getDocs(existingQ);
      const existingKeys = new Set(existingSnap.docs.map((d) => d.data().categoryId || ''));

      let copied = 0;
      let skipped = 0;
      for (const it of items) {
        if (existingKeys.has(it.categoryId)) {
          skipped += 1;
          continue;
        }
        await addDoc(collection(db, 'monthlyFixedCosts'), {
          month: nextMonth,
          categoryId: it.categoryId,
          amount: Number(it.amount || 0),
          note: it.note || '',
          createdAt: serverTimestamp(),
        });
        copied += 1;
      }
      toast.success(
        `Đã sao chép ${copied} chi phí sang ${nextMonth}` +
          (skipped ? ` (bỏ qua ${skipped} đã có)` : '')
      );
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi sao chép');
    }
  };

  const onSaveSettings = async (e) => {
    e?.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(
        doc(db, 'pnlSettings', 'default'),
        {
          taxRate: Number(settingsDraft.taxRate) || 0,
          taxMode: settingsDraft.taxMode || 'on_profit_before_tax',
          depreciationMonthly: Number(settingsDraft.depreciationMonthly) || 0,
          otherReservePercent: Number(settingsDraft.otherReservePercent) || 0,
          useTheoreticalCost: !!settingsDraft.useTheoreticalCost,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success('Đã lưu cài đặt P&L');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi lưu cài đặt');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chi phí cố định theo tháng</h1>
            <p className="text-gray-600 mt-1">
              Lương, mặt bằng, internet, khấu hao... Sẽ được phân bổ về từng ngày trong báo cáo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-gray-500" />
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={onCopyToNext}
              className="inline-flex items-center gap-2 px-3 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100"
            >
              <Copy size={16} /> Sao chép sang tháng sau
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          icon={<Building2 className="text-indigo-600" size={20} />}
          bg="bg-indigo-100"
          label={`Tổng chi cố định tháng ${month}`}
          value={formatVND(total)}
        />
        <Card
          icon={<Calendar className="text-purple-600" size={20} />}
          bg="bg-purple-100"
          label="Phân bổ mỗi ngày"
          value={formatVND(perDayAvg)}
          sub={`/ ${dim} ngày`}
        />
        <Card
          icon={<Settings className="text-gray-600" size={20} />}
          bg="bg-gray-100"
          label="Khấu hao tháng (cài đặt)"
          value={formatVND(pnlSettings?.depreciationMonthly || 0)}
        />
      </div>

      {/* Form thêm */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Plus size={18} className="text-indigo-600" /> Thêm chi phí cố định
        </h2>

        {fixedCategories.length === 0 ? (
          <p className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            Chưa có danh mục cố định nào. Vào trang <strong>Danh mục chi phí</strong> để tạo (Lương,
            Mặt bằng, Internet, Khấu hao...).
          </p>
        ) : (
          <form onSubmit={onAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Danh mục *</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              >
                {fixedCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Số tiền tháng (₫) *</label>
              <input
                type="number"
                inputMode="numeric"
                step="10000"
                min="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="VD: 5000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="VD: Lương 1 nhân viên"
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

      {/* Bảng */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Chi tiết tháng {month}</h2>
          <span className="text-sm text-gray-500">{items.length} khoản · {formatVND(total)}</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Đang tải...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 italic">Chưa có chi phí nào tháng này.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Danh mục</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ghi chú</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tháng</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">/ Ngày</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Hành động</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => {
                  const cat = categoryById.get(item.categoryId);
                  const isEditing = editingId === item.id;
                  const perDay = dim > 0 ? Number(item.amount || 0) / dim : 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-gray-200"
                            style={{ backgroundColor: cat?.color || '#94a3b8' }}
                          />
                          <span className="font-medium text-gray-900">{cat?.name || 'Đã xoá'}</span>
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
                      <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-500">
                        {formatVND(perDay)}
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
                  <td colSpan={2} className="px-6 py-3 text-sm font-semibold text-right text-gray-700">
                    Tổng tháng
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                    {formatVND(total)}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                    {formatVND(perDayAvg)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Cài đặt P&L */}
      <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings size={18} className="text-gray-600" /> Cài đặt tính P&amp;L
        </h2>
        <form onSubmit={onSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Thuế suất (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settingsDraft.taxRate}
              onChange={(e) => setSettingsDraft((s) => ({ ...s, taxRate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cách tính thuế</label>
            <select
              value={settingsDraft.taxMode}
              onChange={(e) => setSettingsDraft((s) => ({ ...s, taxMode: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            >
              {TAX_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Khấu hao tháng (₫)</label>
            <input
              type="number"
              min="0"
              step="10000"
              value={settingsDraft.depreciationMonthly}
              onChange={(e) => setSettingsDraft((s) => ({ ...s, depreciationMonthly: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-1">Phân bổ ÷ 30 vào mỗi ngày báo cáo.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Dự phòng / hao hụt (% trên doanh thu)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={settingsDraft.otherReservePercent}
              onChange={(e) =>
                setSettingsDraft((s) => ({ ...s, otherReservePercent: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <label className="md:col-span-2 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!settingsDraft.useTheoreticalCost}
              onChange={(e) =>
                setSettingsDraft((s) => ({ ...s, useTheoreticalCost: e.target.checked }))
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Hiển thị cột "Vốn lý thuyết theo menu" để so sánh chênh lệch.
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
            >
              <Save size={16} /> {savingSettings ? 'Đang lưu...' : 'Lưu cài đặt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Card = ({ icon, bg, label, value, sub }) => (
  <div className="bg-white rounded-lg shadow-sm border p-4">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  </div>
);

export default MonthlyFixedCosts;
