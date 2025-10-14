import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useApp } from '../context/AppContext';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { toast } from 'react-toastify';
import { Plus, Edit, Trash2, X, Save, UtensilsCrossed, Table2, ShoppingBag } from 'lucide-react';

// Categories for menu items
const CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'lai_rai', label: 'Lai rai' },
  { value: 'giai_khat', label: 'Giải khát' }
];

// Categories for order items (simplified)
const ORDER_CATEGORIES = [
  { value: 'oc', label: 'Ốc' },
  { value: 'an_no', label: 'Ăn no' },
  { value: 'an_choi', label: 'Ăn chơi' },
  { value: 'giai_khat', label: 'Giải khát' }
];

// Validation schema for menu items
const menuSchema = yup.object({
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

// Validation schema for order items
const orderItemSchema = yup.object({
  name: yup.string().required('Tên món là bắt buộc'),
  category: yup.string().required('Danh mục là bắt buộc'),
  parentMenuItemId: yup.string().required('Món cha là bắt buộc'),
  imageUrl: yup.string().url('URL hình ảnh không hợp lệ'),
  // Kitchen timing fields
  estimatedTime: yup.number()
    .required('Thời gian dự kiến là bắt buộc')
    .min(1, 'Thời gian phải lớn hơn 0 phút')
    .max(60, 'Thời gian không được vượt quá 60 phút'),
  priority: yup.number()
    .required('Độ ưu tiên là bắt buộc')
    .min(1, 'Độ ưu tiên phải từ 1-4')
    .max(4, 'Độ ưu tiên phải từ 1-4'),
  speed: yup.string()
    .required('Tốc độ là bắt buộc')
    .oneOf(['fast', 'medium', 'slow'], 'Tốc độ phải là fast, medium hoặc slow'),
  kitchenType: yup.string()
    .required('Loại bếp là bắt buộc')
    .oneOf(['cook', 'grill'], 'Loại bếp phải là cook hoặc grill')
});

// Validation schema for tables
const tableSchema = yup.object({
  number: yup.number()
    .required('Số bàn là bắt buộc')
    .min(1, 'Số bàn phải lớn hơn 0'),
  seats: yup.number()
    .required('Số ghế là bắt buộc')
    .min(1, 'Số ghế phải lớn hơn 0')
    .max(20, 'Số ghế không được vượt quá 20'),
  description: yup.string()
});

const TABS = [
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'orderItems', label: 'Món đặt hàng', icon: ShoppingBag },
  { id: 'tables', label: 'Bàn', icon: Table2 }
];

const MenuManagement = () => {
  const { menuItems, orderItems, tables } = useApp();
  const [activeTab, setActiveTab] = useState('menu');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Menu form
  const menuForm = useForm({
    resolver: yupResolver(menuSchema)
  });

  // Order item form
  const orderItemForm = useForm({
    resolver: yupResolver(orderItemSchema)
  });

  // Table form
  const tableForm = useForm({
    resolver: yupResolver(tableSchema)
  });

  const openModal = (item = null, type = 'menu') => {
    setEditingItem({ ...item, type });
    setIsModalOpen(true);
    
    if (item) {
      if (type === 'menu') {
        menuForm.setValue('name', item.name);
        menuForm.setValue('category', item.category || 'oc');
        menuForm.setValue('price', item.price);
        menuForm.setValue('tax', item.tax);
        menuForm.setValue('costPrice', item.costPrice);
        menuForm.setValue('fixedCost', item.fixedCost);
      } else if (type === 'orderItems') {
        orderItemForm.setValue('name', item.name);
        orderItemForm.setValue('category', item.category || 'oc');
        orderItemForm.setValue('parentMenuItemId', item.parentMenuItemId);
        orderItemForm.setValue('imageUrl', item.imageUrl || '');
        // Kitchen timing fields
        orderItemForm.setValue('estimatedTime', item.estimatedTime || 2);
        orderItemForm.setValue('priority', item.priority || 1);
        orderItemForm.setValue('speed', item.speed || 'medium');
        orderItemForm.setValue('kitchenType', item.kitchenType || 'cook');
      } else {
        tableForm.setValue('number', item.number);
        tableForm.setValue('seats', item.seats);
        tableForm.setValue('description', item.description || '');
      }
    } else {
      if (type === 'menu') {
        menuForm.reset();
      } else if (type === 'orderItems') {
        orderItemForm.reset();
      } else {
        tableForm.reset();
      }
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setIsSubmitting(false);
    menuForm.reset();
    orderItemForm.reset();
    tableForm.reset();
  };

  const onSubmitMenu = async (data) => {
    setIsSubmitting(true);

    try {
      if (editingItem && editingItem.id) {
        await updateDoc(doc(db, 'menuItems', editingItem.id), data);
        toast.success('Cập nhật món thành công!');
      } else {
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

  const onSubmitOrderItem = async (data) => {
    setIsSubmitting(true);

    try {
      if (editingItem && editingItem.id) {
        await updateDoc(doc(db, 'orderItems', editingItem.id), data);
        toast.success('Cập nhật món đặt hàng thành công!');
      } else {
        await addDoc(collection(db, 'orderItems'), data);
        toast.success('Thêm món đặt hàng thành công!');
      }
      
      closeModal();
    } catch (error) {
      console.error('Error saving order item:', error);
      toast.error('Có lỗi xảy ra khi lưu món đặt hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmitTable = async (data) => {
    setIsSubmitting(true);

    try {
      // Check if table number already exists (for new tables or when editing number)
      const existingTable = tables?.find(table => 
        table.number === data.number && 
        (!editingItem?.id || table.id !== editingItem.id)
      );

      if (existingTable) {
        toast.error(`Bàn số ${data.number} đã tồn tại`);
        setIsSubmitting(false);
        return;
      }

      if (editingItem && editingItem.id) {
        await updateDoc(doc(db, 'tables', editingItem.id), data);
        toast.success('Cập nhật bàn thành công!');
      } else {
        await addDoc(collection(db, 'tables'), data);
        toast.success('Thêm bàn thành công!');
      }
      
      closeModal();
    } catch (error) {
      console.error('Error saving table:', error);
      toast.error('Có lỗi xảy ra khi lưu bàn');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item, type) => {
    let itemName;
    let collection_name;
    let successMessage;
    
    if (type === 'menu') {
      itemName = item.name;
      collection_name = 'menuItems';
      successMessage = 'Xóa món thành công!';
    } else if (type === 'orderItems') {
      itemName = item.name;
      collection_name = 'orderItems';
      successMessage = 'Xóa món đặt hàng thành công!';
    } else {
      itemName = `Bàn ${item.number}`;
      collection_name = 'tables';
      successMessage = 'Xóa bàn thành công!';
    }
    
    if (window.confirm(`Bạn có chắc chắn muốn xóa ${itemName}?`)) {
      try {
        await deleteDoc(doc(db, collection_name, item.id));
        toast.success(successMessage);
      } catch (error) {
        console.error(`Error deleting ${type}:`, error);
        toast.error(`Có lỗi xảy ra khi xóa ${type === 'menu' ? 'món' : type === 'orderItems' ? 'món đặt hàng' : 'bàn'}`);
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

  const getOrderCategoryLabel = (categoryValue) => {
    const category = ORDER_CATEGORIES.find(cat => cat.value === categoryValue);
    return category ? category.label : categoryValue;
  };

  const getParentMenuItemName = (parentMenuItemId) => {
    const parentItem = menuItems.find(item => item.id === parentMenuItemId);
    return parentItem ? parentItem.name : 'Không xác định';
  };

  const calculateProfit = (item) => {
    const taxAmount = item.price * (item.tax / 100);
    return item.price - item.costPrice - item.fixedCost - taxAmount;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header with tabs */}
        <div className="border-b border-gray-200">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900">Quản lý nhà hàng</h1>
          </div>
          <nav className="flex space-x-8 px-6">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon size={20} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Add button */}
          <div className="flex justify-end mb-6">
            <button
              onClick={() => openModal(null, activeTab)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus size={20} className="mr-2" />
              {activeTab === 'menu' ? 'Thêm món' : activeTab === 'orderItems' ? 'Thêm món đặt hàng' : 'Thêm bàn'}
            </button>
          </div>

          {/* Menu Tab Content */}
          {activeTab === 'menu' && (
            <>
              {menuItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <UtensilsCrossed size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Chưa có món nào
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Thêm món đầu tiên vào menu của bạn
                  </p>
                  <button
                    onClick={() => openModal(null, 'menu')}
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
                                onClick={() => openModal(item, 'menu')}
                                className="text-indigo-600 hover:text-indigo-900 p-1"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item, 'menu')}
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
            </>
          )}

          {/* Order Items Tab Content */}
          {activeTab === 'orderItems' && (
            <>
              {orderItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <ShoppingBag size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Chưa có món đặt hàng nào
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Thêm món đặt hàng đầu tiên cho khách hàng
                  </p>
                  <button
                    onClick={() => openModal(null, 'orderItems')}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={20} className="mr-2" />
                    Thêm món đặt hàng
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
                          Món cha
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Hình ảnh
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orderItems.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {item.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                              {getOrderCategoryLabel(item.category || 'oc')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {getParentMenuItemName(item.parentMenuItemId)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {item.imageUrl ? (
                              <img 
                                src={item.imageUrl} 
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded-lg"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                <ShoppingBag size={20} className="text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => openModal(item, 'orderItems')}
                                className="text-indigo-600 hover:text-indigo-900 p-1"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item, 'orderItems')}
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
            </>
          )}

          {/* Tables Tab Content */}
          {activeTab === 'tables' && (
            <>
              {(!tables || tables.length === 0) ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <Table2 size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Chưa có bàn nào
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Thêm bàn đầu tiên cho nhà hàng của bạn
                  </p>
                  <button
                    onClick={() => openModal(null, 'tables')}
                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Plus size={20} className="mr-2" />
                    Thêm bàn
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {tables.map((table) => (
                    <div key={table.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Bàn {table.number}
                        </h3>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => openModal(table, 'tables')}
                            className="text-indigo-600 hover:text-indigo-900 p-1"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(table, 'tables')}
                            className="text-red-600 hover:text-red-900 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {table.seats} chỗ ngồi
                      </p>
                      {table.description && (
                        <p className="text-sm text-gray-500">
                          {table.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-full overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingItem?.id 
                    ? (editingItem?.type === 'menu' ? 'Chỉnh sửa món' : editingItem?.type === 'orderItems' ? 'Chỉnh sửa món đặt hàng' : 'Chỉnh sửa bàn')
                    : (activeTab === 'menu' ? 'Thêm món mới' : activeTab === 'orderItems' ? 'Thêm món đặt hàng mới' : 'Thêm bàn mới')
                  }
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Menu Form */}
              {(activeTab === 'menu' || editingItem?.type === 'menu') && (
                <form onSubmit={menuForm.handleSubmit(onSubmitMenu)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên món *
                    </label>
                    <input
                      type="text"
                      {...menuForm.register('name')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Nhập tên món"
                    />
                    {menuForm.formState.errors.name && (
                      <p className="text-red-500 text-sm mt-1">{menuForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Danh mục *
                    </label>
                    <select
                      {...menuForm.register('category')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    {menuForm.formState.errors.category && (
                      <p className="text-red-500 text-sm mt-1">{menuForm.formState.errors.category.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Giá bán (VND) *
                    </label>
                    <input
                      type="number"
                      {...menuForm.register('price')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      step="1000"
                    />
                    {menuForm.formState.errors.price && (
                      <p className="text-red-500 text-sm mt-1">{menuForm.formState.errors.price.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Thuế (%) *
                    </label>
                    <input
                      type="number"
                      {...menuForm.register('tax')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    {menuForm.formState.errors.tax && (
                      <p className="text-red-500 text-sm mt-1">{menuForm.formState.errors.tax.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Giá vốn (VND) *
                    </label>
                    <input
                      type="number"
                      {...menuForm.register('costPrice')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      step="1000"
                    />
                    {menuForm.formState.errors.costPrice && (
                      <p className="text-red-500 text-sm mt-1">{menuForm.formState.errors.costPrice.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chi phí cố định (VND) *
                    </label>
                    <input
                      type="number"
                      {...menuForm.register('fixedCost')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      step="1000"
                    />
                    {menuForm.formState.errors.fixedCost && (
                      <p className="text-red-500 text-sm mt-1">{menuForm.formState.errors.fixedCost.message}</p>
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
                      {editingItem?.id ? 'Cập nhật' : 'Thêm món'}
                    </button>
                  </div>
                </form>
              )}

              {/* Order Item Form */}
              {(activeTab === 'orderItems' || editingItem?.type === 'orderItems') && (
                <form onSubmit={orderItemForm.handleSubmit(onSubmitOrderItem)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên món đặt hàng *
                    </label>
                    <input
                      type="text"
                      {...orderItemForm.register('name')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Nhập tên món đặt hàng"
                    />
                    {orderItemForm.formState.errors.name && (
                      <p className="text-red-500 text-sm mt-1">{orderItemForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Danh mục *
                    </label>
                    <select
                      {...orderItemForm.register('category')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      {ORDER_CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    {orderItemForm.formState.errors.category && (
                      <p className="text-red-500 text-sm mt-1">{orderItemForm.formState.errors.category.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Món cha *
                    </label>
                    <select
                      {...orderItemForm.register('parentMenuItemId')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">-- Chọn món cha --</option>
                      {menuItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({getCategoryLabel(item.category)})
                        </option>
                      ))}
                    </select>
                    {orderItemForm.formState.errors.parentMenuItemId && (
                      <p className="text-red-500 text-sm mt-1">{orderItemForm.formState.errors.parentMenuItemId.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      URL hình ảnh
                    </label>
                    <input
                      type="url"
                      {...orderItemForm.register('imageUrl')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="https://example.com/image.jpg"
                    />
                    {orderItemForm.formState.errors.imageUrl && (
                      <p className="text-red-500 text-sm mt-1">{orderItemForm.formState.errors.imageUrl.message}</p>
                    )}
                  </div>

                  {/* Kitchen Timing Fields */}
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">🍳 Thông tin bếp</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Thời gian dự kiến (phút) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          {...orderItemForm.register('estimatedTime')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="2"
                        />
                        {orderItemForm.formState.errors.estimatedTime && (
                          <p className="text-red-500 text-sm mt-1">{orderItemForm.formState.errors.estimatedTime.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Độ ưu tiên *
                        </label>
                        <select
                          {...orderItemForm.register('priority')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value={1}>1 - Cao nhất (Ốc)</option>
                          <option value={2}>2 - Cao (Ăn no)</option>
                          <option value={3}>3 - Trung bình (Ăn chơi)</option>
                          <option value={4}>4 - Thấp (Giải khát)</option>
                        </select>
                        {orderItemForm.formState.errors.priority && (
                          <p className="text-red-500 text-sm mt-1">{orderItemForm.formState.errors.priority.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tốc độ *
                        </label>
                        <select
                          {...orderItemForm.register('speed')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="fast">⚡ Nhanh (1-2 phút)</option>
                          <option value="medium">⏱️ Vừa (2-4 phút)</option>
                          <option value="slow">🐌 Chậm (4+ phút)</option>
                        </select>
                        {orderItemForm.formState.errors.speed && (
                          <p className="text-red-500 text-sm mt-1">{orderItemForm.formState.errors.speed.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Loại bếp *
                        </label>
                        <select
                          {...orderItemForm.register('kitchenType')}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="cook">👨‍🍳 Nấu (Xào, Hấp, Sốt)</option>
                          <option value="grill">🔥 Nướng (Grill, BBQ)</option>
                        </select>
                        {orderItemForm.formState.errors.kitchenType && (
                          <p className="text-red-500 text-sm mt-1">{orderItemForm.formState.errors.kitchenType.message}</p>
                        )}
                      </div>
                    </div>
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
                      {editingItem?.id ? 'Cập nhật' : 'Thêm món đặt hàng'}
                    </button>
                  </div>
                </form>
              )}

              {/* Table Form */}
              {(activeTab === 'tables' || editingItem?.type === 'tables') && (
                <form onSubmit={tableForm.handleSubmit(onSubmitTable)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số bàn *
                    </label>
                    <input
                      type="number"
                      {...tableForm.register('number')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="1"
                      min="1"
                    />
                    {tableForm.formState.errors.number && (
                      <p className="text-red-500 text-sm mt-1">{tableForm.formState.errors.number.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số chỗ ngồi *
                    </label>
                    <input
                      type="number"
                      {...tableForm.register('seats')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="4"
                      min="1"
                      max="20"
                    />
                    {tableForm.formState.errors.seats && (
                      <p className="text-red-500 text-sm mt-1">{tableForm.formState.errors.seats.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mô tả (tùy chọn)
                    </label>
                    <textarea
                      {...tableForm.register('description')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Ví dụ: Gần cửa sổ, có view đẹp..."
                      rows="3"
                    />
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
                      {editingItem?.id ? 'Cập nhật' : 'Thêm bàn'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement; 