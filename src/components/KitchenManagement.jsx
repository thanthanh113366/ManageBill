import React, { useState } from 'react';
import { X, Clock, CheckCircle, Play, Pause, Filter } from 'lucide-react';
import { useKitchenOrders } from '../hooks/useKitchenOrders';
import { formatTime } from '../utils/kitchenOptimizer';

const KitchenManagement = ({ onClose, selectedDate }) => {
  const [selectedTable, setSelectedTable] = useState(null);
  const {
    kitchenQueue,
    stats,
    availableTables,
    nextItem,
    cookingItems,
    loading,
    error,
    startCooking,
    completeCooking,
    undoCompleted,
    clearError
  } = useKitchenOrders(selectedTable, selectedDate);

  const handleStartCooking = async (item) => {
    await startCooking(item.billId, item.orderItemId || item.menuItemId);
  };

  const handleCompleteCooking = async (item) => {
    await completeCooking(item.billId, item.orderItemId || item.menuItemId, item.batchOrder);
  };

  const handleUndoCompleted = async (item) => {
    await undoCompleted(item.billId, item.orderItemId || item.menuItemId);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-red-500" />;
      case 'cooking':
        return <Play className="w-4 h-4 text-yellow-500" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Chờ làm';
      case 'cooking':
        return 'Đang làm';
      case 'ready':
        return 'Hoàn thành';
      default:
        return 'Chờ làm'; // Mặc định cho items chưa có kitchenStatus
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-red-100 text-red-800';
      case 'cooking':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-red-100 text-red-800'; // Mặc định là pending
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <span className="ml-3 text-gray-600">Đang tải...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xl">🍳</span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Quản lý bếp</h2>
              <p className="text-sm text-gray-500">Tối ưu hóa thứ tự làm món</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
            <button
              onClick={clearError}
              className="ml-2 text-red-800 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats & Filters */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">Tổng món</div>
              <div className="text-2xl font-semibold text-gray-900">{stats.total}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">Chờ làm</div>
              <div className="text-2xl font-semibold text-red-600">{stats.pending}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">Đang làm</div>
              <div className="text-2xl font-semibold text-yellow-600">{stats.cooking}</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm">
              <div className="text-sm text-gray-500">Hoàn thành</div>
              <div className="text-2xl font-semibold text-green-600">{stats.ready}</div>
            </div>
          </div>

          {/* Filter by table */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">Lọc theo bàn:</span>
            </div>
            <select
              value={selectedTable || ''}
              onChange={(e) => setSelectedTable(e.target.value ? parseInt(e.target.value) : null)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="">Tất cả bàn</option>
              {availableTables.map(tableNum => (
                <option key={tableNum} value={tableNum}>
                  Bàn {tableNum}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Kitchen Queue */}
        <div className="p-6">
          {kitchenQueue.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🍽️</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Không có món nào</h3>
              <p className="text-gray-500">Hiện tại không có món nào cần làm</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                🔥 Món cần làm (theo thứ tự ưu tiên)
              </h3>
              
              {kitchenQueue.map((item, index) => (
                <div
                  key={`${item.billId}-${item.orderItemId || item.menuItemId}-${item.batchOrder || index}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-medium text-gray-500">
                          #{index + 1}
                        </span>
                        <span className="text-lg font-semibold text-gray-900">
                          Bàn {item.tableNumber}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.kitchenStatus)}`}>
                          {getStatusText(item.kitchenStatus)}
                        </span>
                        <span className="text-sm text-gray-500">
                          Score: {Math.round(item.score)}
                        </span>
                      </div>
                      
                      <div className="text-gray-900 font-medium mb-1">
                        {item.name}
                        {item.batchTotal > 1 && (
                          <span className="text-sm text-blue-600 ml-2">
                            ({item.batchOrder}/{item.batchTotal})
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>⏰ {formatTime(item.estimatedTime)}</span>
                        <span>📊 Bill #{item.billOrder}</span>
                        {item.startTime && (
                          <span>🕐 Bắt đầu: {new Date(item.startTime.toDate()).toLocaleTimeString('vi-VN')}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(item.kitchenStatus)}
                      
                      {/* Hiển thị button phù hợp với trạng thái */}
                      {(!item.isCompleted && item.kitchenStatus !== 'ready') ? (
                        <button
                          onClick={() => handleCompleteCooking(item)}
                          className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                          Hoàn thành
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUndoCompleted(item)}
                          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors text-sm font-medium"
                        >
                          Undo
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Next Item Highlight */}
        {nextItem && (
          <div className="p-6 border-t bg-orange-50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">!</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Món tiếp theo cần làm:</h4>
                <p className="text-gray-600">
                  Bàn {nextItem.tableNumber} - {nextItem.name} x{nextItem.quantity}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenManagement;
