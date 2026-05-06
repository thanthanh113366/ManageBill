import React, { useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import {
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Tag,
  GripVertical,
  ShoppingCart,
  Zap,
  Building2,
  Coins,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const KIND_OPTIONS = [
  {
    value: 'cogs',
    label: 'Giá vốn (đi chợ)',
    description: 'Nguyên liệu nấu món: hải sản, thịt, rau...',
    icon: ShoppingCart,
    color: 'text-orange-600 bg-orange-100',
  },
  {
    value: 'opex_variable',
    label: 'Chi phí biến đổi',
    description: 'Gas, đá, túi nilon, vận chuyển...',
    icon: Zap,
    color: 'text-amber-600 bg-amber-100',
  },
  {
    value: 'opex_fixed',
    label: 'Chi phí cố định (tháng)',
    description: 'Lương, mặt bằng, internet, khấu hao...',
    icon: Building2,
    color: 'text-indigo-600 bg-indigo-100',
  },
  {
    value: 'owner_draw',
    label: 'Rút vốn chủ (chợ nhà / chi tiêu cá nhân)',
    description: 'KHÔNG tính vào chi phí quán. Trừ ra ở dòng "Lợi nhuận giữ lại" sau khi đã có Lợi nhuận thực.',
    icon: Coins,
    color: 'text-stone-700 bg-stone-100',
  },
];

const PRESET_COLORS = [
  '#0ea5e9', '#22c55e', '#ef4444', '#f59e0b', '#a855f7',
  '#0f172a', '#fb923c', '#38bdf8', '#84cc16', '#f472b6',
  '#6366f1', '#14b8a6', '#64748b', '#94a3b8',
];

const schema = yup.object({
  name: yup.string().trim().required('Tên danh mục là bắt buộc').max(60, 'Tối đa 60 ký tự'),
  kind: yup.string().required('Loại chi phí là bắt buộc').oneOf(['cogs', 'opex_variable', 'opex_fixed', 'owner_draw']),
  color: yup.string().required('Màu là bắt buộc'),
  active: yup.boolean(),
});

const SortableRow = ({ category, kindMeta, onEdit, onDelete, onToggleActive }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const KindIcon = kindMeta?.icon || Tag;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 bg-white border rounded-lg ${
        isDragging ? 'opacity-50 shadow-lg' : 'shadow-sm'
      } ${category.active === false ? 'opacity-60' : ''}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        aria-label="Kéo để sắp xếp"
      >
        <GripVertical size={18} />
      </button>

      <span
        className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0"
        style={{ backgroundColor: category.color || '#94a3b8' }}
      />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{category.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${kindMeta?.color || 'bg-gray-100 text-gray-600'}`}>
            <KindIcon size={12} />
            {kindMeta?.label || category.kind}
          </span>
          {category.active === false && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Tạm tắt</span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggleActive(category)}
        className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
          category.active === false
            ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
        }`}
      >
        {category.active === false ? 'Bật' : 'Tắt'}
      </button>

      <button
        type="button"
        onClick={() => onEdit(category)}
        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-md"
        aria-label="Sửa"
      >
        <Edit size={16} />
      </button>

      <button
        type="button"
        onClick={() => onDelete(category)}
        className="p-2 text-red-600 hover:bg-red-50 rounded-md"
        aria-label="Xoá"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

const ExpenseCategories = () => {
  const { expenseCategories } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  const form = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      name: '',
      kind: 'cogs',
      color: PRESET_COLORS[0],
      active: true,
    },
  });

  const grouped = useMemo(() => {
    const buckets = { cogs: [], opex_variable: [], opex_fixed: [], owner_draw: [] };
    [...(expenseCategories || [])]
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
      .forEach((cat) => {
        const k = cat.kind || 'cogs';
        if (!buckets[k]) buckets[k] = [];
        buckets[k].push(cat);
      });
    return buckets;
  }, [expenseCategories]);

  const openModal = (item = null) => {
    setEditingItem(item);
    setIsModalOpen(true);
    if (item) {
      form.reset({
        name: item.name || '',
        kind: item.kind || 'cogs',
        color: item.color || PRESET_COLORS[0],
        active: item.active !== false,
      });
    } else {
      form.reset({
        name: '',
        kind: 'cogs',
        color: PRESET_COLORS[0],
        active: true,
      });
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setIsSubmitting(false);
    form.reset();
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      if (editingItem?.id) {
        await updateDoc(doc(db, 'expenseCategories', editingItem.id), {
          ...data,
        });
        toast.success('Cập nhật danh mục thành công');
      } else {
        const maxOrder = (expenseCategories || [])
          .filter((c) => c.kind === data.kind)
          .reduce((m, c) => Math.max(m, c.order ?? 0), 0);
        await addDoc(collection(db, 'expenseCategories'), {
          ...data,
          order: maxOrder + 1,
          createdAt: serverTimestamp(),
        });
        toast.success('Thêm danh mục thành công');
      }
      closeModal();
    } catch (err) {
      console.error('Error saving expense category:', err);
      toast.error('Có lỗi xảy ra khi lưu danh mục');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async (category) => {
    if (!confirm(`Xoá danh mục "${category.name}"? Các phiếu chi đã ghi vẫn được giữ.`)) return;
    try {
      await deleteDoc(doc(db, 'expenseCategories', category.id));
      toast.success('Đã xoá danh mục');
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('Lỗi khi xoá');
    }
  };

  const onToggleActive = async (category) => {
    try {
      await updateDoc(doc(db, 'expenseCategories', category.id), {
        active: category.active === false ? true : false,
      });
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi cập nhật');
    }
  };

  const handleDragEnd = async (event, kind) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = grouped[kind] || [];
    const oldIdx = list.findIndex((i) => i.id === active.id);
    const newIdx = list.findIndex((i) => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(list, oldIdx, newIdx);
    try {
      const batch = writeBatch(db);
      reordered.forEach((item, index) => {
        batch.update(doc(db, 'expenseCategories', item.id), { order: index + 1 });
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi sắp xếp');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Danh mục chi phí</h1>
            <p className="text-gray-600 mt-1">
              Phân loại nguyên liệu đi chợ và chi phí vận hành để tính P&amp;L theo chuẩn nhà hàng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <Plus size={18} />
            Thêm danh mục
          </button>
        </div>
      </div>

      {KIND_OPTIONS.map((kindOpt) => {
        const items = grouped[kindOpt.value] || [];
        const KindIcon = kindOpt.icon;
        return (
          <div key={kindOpt.value} className="bg-white rounded-lg shadow-sm border p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${kindOpt.color}`}>
                <KindIcon size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{kindOpt.label}</h2>
                <p className="text-sm text-gray-500">{kindOpt.description}</p>
              </div>
              <span className="ml-auto text-sm text-gray-500">{items.length} danh mục</span>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-gray-400 italic px-4 py-6 text-center bg-gray-50 rounded-md">
                Chưa có danh mục nào. Bấm "Thêm danh mục" để tạo.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(event, kindOpt.value)}
              >
                <SortableContext
                  items={items.map((c) => c.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {items.map((cat) => (
                      <SortableRow
                        key={cat.id}
                        category={cat}
                        kindMeta={kindOpt}
                        onEdit={openModal}
                        onDelete={onDelete}
                        onToggleActive={onToggleActive}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        );
      })}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingItem ? 'Sửa danh mục' : 'Thêm danh mục'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên danh mục *</label>
                <input
                  type="text"
                  {...form.register('name')}
                  placeholder="Ví dụ: Hải sản"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại chi phí *</label>
                <select
                  {...form.register('kind')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Màu</label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => {
                    const selected = form.watch('color') === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => form.setValue('color', c)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          selected ? 'border-indigo-600 scale-110' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Chọn màu ${c}`}
                      />
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  {...form.register('active')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Đang sử dụng</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Save size={16} />
                  {isSubmitting ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseCategories;
