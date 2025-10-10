import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency, getTrendIcon, getTrendColor } from '../utils/dishAnalysis';

/**
 * Sortable Table component for dish details
 */
const DishTable = ({ dishes, title = 'Chi tiết món ăn' }) => {
  const [sortBy, setSortBy] = useState('totalQuantity');
  const [sortDirection, setSortDirection] = useState('desc');

  const handleSort = (field) => {
    if (sortBy === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to desc for new field
      setSortBy(field);
      setSortDirection('desc');
    }
  };

  // Sort dishes
  const sortedDishes = [...dishes].sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];

    // Handle string comparison
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  const SortHeader = ({ field, label, align = 'left' }) => {
    const isActive = sortBy === field;
    const alignClass = align === 'right' ? 'text-right' : 'text-left';
    
    return (
      <th 
        className={`px-4 py-3 ${alignClass} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none`}
        onClick={() => handleSort(field)}
      >
        <div className={`flex items-center ${align === 'right' ? 'justify-end' : 'justify-start'} gap-1`}>
          <span>{label}</span>
          {isActive && (
            sortDirection === 'asc' 
              ? <ChevronUp size={14} className="text-indigo-600" />
              : <ChevronDown size={14} className="text-indigo-600" />
          )}
        </div>
      </th>
    );
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'oc': 'Ốc',
      'an_no': 'Ăn no',
      'an_choi': 'Ăn chơi',
      'lai_rai': 'Lai rai',
      'giai_khat': 'Giải khát'
    };
    return labels[category] || category;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">
          Click vào tiêu đề cột để sắp xếp
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
              <SortHeader field="name" label="Món ăn" />
              <SortHeader field="category" label="Danh mục" />
              <SortHeader field="totalQuantity" label="Tổng SL" align="right" />
              <SortHeader field="billCount" label="Số Bills" align="right" />
              <SortHeader field="avgPerOrder" label="TB/Lần" align="right" />
              <SortHeader field="totalRevenue" label="Doanh thu" align="right" />
              <SortHeader field="totalProfit" label="Lợi nhuận" align="right" />
              <SortHeader field="revenuePercent" label="% DT" align="right" />
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Xu hướng
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedDishes.length === 0 ? (
              <tr>
                <td colSpan="10" className="px-6 py-8 text-center text-gray-500">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              sortedDishes.map((dish, index) => (
                <tr key={dish.dishId} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    <div>
                      <div className="font-medium">{dish.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(dish.price)}/phần
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                      {getCategoryLabel(dish.category)}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-semibold text-blue-600">
                    {dish.totalQuantity}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-purple-600">
                    {dish.billCount}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-orange-600">
                    {dish.avgPerOrder}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-green-600">
                    {formatCurrency(dish.totalRevenue)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium text-indigo-600">
                    {formatCurrency(dish.totalProfit)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {dish.revenuePercent}%
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                    {dish.trend && (
                      <div className="flex flex-col items-center">
                        <span className={`text-lg ${getTrendColor(dish.trend)}`}>
                          {getTrendIcon(dish.trend)}
                        </span>
                        {dish.trend !== 'new' && dish.trendPercent !== undefined && (
                          <span className={`text-xs font-medium ${getTrendColor(dish.trend)}`}>
                            {dish.trendPercent > 0 ? '+' : ''}{dish.trendPercent}%
                          </span>
                        )}
                        {dish.trend === 'new' && (
                          <span className="text-xs text-blue-600">Mới</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {sortedDishes.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t">
          <p className="text-sm text-gray-600">
            Tổng: <span className="font-semibold">{sortedDishes.length}</span> món
          </p>
        </div>
      )}
    </div>
  );
};

export default DishTable;

