import React, { useState, useEffect } from 'react';
import { FileText, Plus } from 'lucide-react';

const CustomItemForm = ({ onAdd }) => {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const valid =
      description.trim() !== '' &&
      amount !== '' &&
      !Number.isNaN(parseFloat(amount));
    setIsValid(valid);
  }, [description, amount]);

  const handleAdd = () => {
    if (!isValid) return;

    onAdd({
      customDescription: description.trim(),
      customAmount: parseFloat(amount)
    });

    setDescription('');
    setAmount('');
    setIsValid(false);
    setShowForm(false);
  };

  const handleCancel = () => {
    setShowForm(false);
    setDescription('');
    setAmount('');
    setIsValid(false);
  };

  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
      >
        <FileText size={18} />
        <span>Thêm món khác</span>
      </button>

      {showForm && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <h4 className="font-medium text-gray-900 mb-3">Thêm món khác</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mô tả món
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="VD: Tóp mỡ, Bớt tiền ốc hương..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số tiền (VND)
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="VD: 5000, -10000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nhập số âm để giảm tiền (VD: -10000)
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!isValid}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Thêm
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomItemForm;

