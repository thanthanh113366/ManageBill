import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, X, Save } from 'lucide-react';

// Categories for menu items
const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'lai_rai', label: 'Lai rai' },
  { value: 'giai_khat', label: 'Giải khát' }
];

// Validation schema
const schema = yup.object({
  name: yup.string().required('Tên món là bắt buộc'),
  category: yup.string().required('Danh mục là bắt buộc'),
  price: yup.number()
    .required('Giá bán là bắt buộc')
    .min(0, 'Giá bán phải lớn hơn hoặc bằng 0'),
  tax: yup.number()
    .required('Thuế là bắt buộc')
    .min(0, 'Thuế phải từ 0%')
    .max(100, 'Thuế không được vượt quá 100%'),
  costPrice: yup.number()
    .required('Giá vốn là bắt buộc')
    .min(0, 'Giá vốn phải lớn hơn hoặc bằng 0'),
  fixedCost: yup.number()
    .required('Chi phí cố định là bắt buộc')
    .min(0, 'Chi phí cố định phải lớn hơn hoặc bằng 0')
});

const MenuManagement = () => {
  const { menuItems } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm({
    resolver: yupResolver(schema)
  });

  const openModal = (item = null) => {
    setEditingItem(item);
    setIsModalOpen(true);
    
    if (item) {
      // Pre-fill form for editing
      setValue('name', item.name);
      setValue('category', item.category || 'oc');
      setValue('price', item.price);
      setValue('tax', item.tax);
      setValue('costPrice', item.costPrice);
      setValue('fixedCost', item.fixedCost);
    } else {
      reset();
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setIsSubmitting(false); // Reset loading state
    reset();
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      if (editingItem) {
        // Update existing item
        await updateDoc(doc(db, 'menuItems', editingItem.id), data);
        toast.success('Cập nhật món thành công!');
      } else {
        // Add new item
        await addDoc(collection(db, 'menuItems'), data);
        toast.success('Thêm món thành công!');
      }
      
      closeModal();
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast.error('Có lỗi xảy ra khi lưu món');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa món "${item.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'menuItems', item.id));
        toast.success('Xóa món thành công!');
      } catch (error) {
        console.error('Error deleting menu item:', error);
        toast.error('Có lỗi xảy ra khi xóa món');
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const getCategoryLabel = (categoryValue) => {
    const category = CATEGORIES.find(cat => cat.value === categoryValue);
    return category ? category.label : categoryValue;
  };

  const calculateProfit = (item) => {
    const taxAmount = item.price * (item.tax / 100);
    return item.price - item.costPrice - item.fixedCost - taxAmount;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Quản lý menu</h1>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={20} className="mr-2" />
            Thêm món
          </button>
        </div>

        {menuItems.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Plus size={48} className="mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Chưa có món nào
            </h3>
            <p className="text-gray-600 mb-4">
              Thêm món đầu tiên vào menu của bạn
            </p>
            <button
              onClick={() => openModal()}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              Thêm món
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tên món
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Danh mục
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Giá bán
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thuế (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Giá vốn
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chi phí cố định
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lợi nhuận/món
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {menuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {item.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {getCategoryLabel(item.category || 'oc')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(item.price)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {item.tax}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(item.costPrice)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(item.fixedCost)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        calculateProfit(item) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(calculateProfit(item))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openModal(item)}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="text-red-600 hover:text-red-900 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingItem ? 'Chỉnh sửa món' : 'Thêm món mới'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên món *
                  </label>
                  <input
                    type="text"
                    {...register('name')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Nhập tên món"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Danh mục *
                  </label>
                  <select
                    {...register('category')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="text-red-500 text-sm mt-1">{errors.category.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá bán (VND) *
                  </label>
                  <input
                    type="number"
                    {...register('price')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="1000"
                  />
                  {errors.price && (
                    <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thuế (%) *
                  </label>
                  <input
                    type="number"
                    {...register('tax')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  {errors.tax && (
                    <p className="text-red-500 text-sm mt-1">{errors.tax.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá vốn (VND) *
                  </label>
                  <input
                    type="number"
                    {...register('costPrice')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="1000"
                  />
                  {errors.costPrice && (
                    <p className="text-red-500 text-sm mt-1">{errors.costPrice.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chi phí cố định (VND) *
                  </label>
                  <input
                    type="number"
                    {...register('fixedCost')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="1000"
                  />
                  {errors.fixedCost && (
                    <p className="text-red-500 text-sm mt-1">{errors.fixedCost.message}</p>
                  )}
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save size={16} className="mr-2" />
                    )}
                    {editingItem ? 'Cập nhật' : 'Thêm món'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement; 