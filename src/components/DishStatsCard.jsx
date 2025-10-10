import React from 'react';
import { formatCurrency } from '../utils/dishAnalysis';

/**
 * Stats Card component for Dish Analysis overview
 */
const DishStatsCard = ({ icon: Icon, label, value, color = 'blue', subValue = null }) => {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-100',
      icon: 'text-blue-600',
      text: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-100',
      icon: 'text-green-600',
      text: 'text-green-600'
    },
    indigo: {
      bg: 'bg-indigo-100',
      icon: 'text-indigo-600',
      text: 'text-indigo-600'
    },
    orange: {
      bg: 'bg-orange-100',
      icon: 'text-orange-600',
      text: 'text-orange-600'
    },
    purple: {
      bg: 'bg-purple-100',
      icon: 'text-purple-600',
      text: 'text-purple-600'
    },
    gray: {
      bg: 'bg-gray-100',
      icon: 'text-gray-600',
      text: 'text-gray-600'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center">
        <div className={`p-2 ${colors.bg} rounded-lg`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
        <div className="ml-4 flex-1">
          <p className="text-sm text-gray-600">{label}</p>
          <p className={`text-2xl font-bold ${colors.text}`}>
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-gray-500 mt-1">{subValue}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DishStatsCard;

