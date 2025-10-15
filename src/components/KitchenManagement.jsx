import React, { useState, useMemo } from 'react';
import { X, Clock, CheckCircle, Play, Pause, Filter, Trash2 } from 'lucide-react';
import { useKitchenOrders } from '../hooks/useKitchenOrders';
import { formatTime } from '../utils/kitchenOptimizer';

const KitchenManagement = ({ onClose, selectedDate }) => {
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedKitchenType, setSelectedKitchenType] = useState('cook'); // 'cook' | 'grill'
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
    deleteAllMenuItemTimings,
    clearError
  } = useKitchenOrders(selectedTable, selectedDate);

  // Filter queue by kitchen type tab
  const queueByKitchenType = useMemo(() => {
    return kitchenQueue.filter(item => {
      const type = item?.timing?.kitchenType || item?.kitchenType || 'cook';
      return type === selectedKitchenType;
    });
  }, [kitchenQueue, selectedKitchenType]);

  // Next item for current tab
  const nextItemByKitchenType = useMemo(() => {
    return queueByKitchenType.find(i => i.kitchenStatus === 'pending') || queueByKitchenType[0] || null;
  }, [queueByKitchenType]);

  const handleStartCooking = async (item) => {
    await startCooking(item.billId, item.orderItemId || item.menuItemId);
  };

  const handleCompleteCooking = async (item) => {
    await completeCooking(item.billId, item.orderItemId || item.menuItemId, item.batchOrder);
  };

  const handleUndoCompleted = async (item) => {
    await undoCompleted(item.billId, item.orderItemId || item.menuItemId);
  };

  const handleDeleteAllMenuItemTimings = async () => {
    const confirmMessage = `Bạn có chắc muốn xóa TẤT CẢ menuItemTimings?\n\nĐiều này sẽ:\n- Xóa tất cả thông tin timing của món\n- Không ảnh hưởng đến bills và đơn hàng\n- Có thể tạo lại bằng npm run migrate:kitchen\n\nHành động này KHÔNG THỂ HOÀN TÁC!`;
    
    if (window.confirm(confirmMessage)) {
      const result = await deleteAllMenuItemTimings();
      if (result.success) {
        alert(`✅ Đã xóa thành công ${result.count} menuItemTimings!\n\nĐể tạo lại, chạy: npm run migrate:kitchen`);
      } else {
        alert('❌ Có lỗi xảy ra khi xóa menuItemTimings');
      }
    }
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
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
        
        <div className="flex items-center space-x-2">
          {/* Delete All MenuItemTimings Button */}
          <button
            onClick={handleDeleteAllMenuItemTimings}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            title="Xóa tất cả menuItemTimings để dọn dẹp database"
          >
            <Trash2 size={14} />
            <span>Dọn dẹp DB</span>
          </button>
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
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

        {/* Table Overview */}
        <div className="p-3 border-b bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Tổng quan các bàn</h3>
          
          {/* Tables Grid */}
          <div className="space-y-2">
            {/* Row 1: Tables 1-4 */}
            <div className="flex justify-center space-x-4">
              {[1, 2, 3, 4].map(tableNum => {
                const unfinishedCount = kitchenQueue.filter(item => 
                  item.tableNumber === tableNum && 
                  item.kitchenStatus !== 'ready'
                ).length;
                
                return (
                  <div key={tableNum} className="flex items-center space-x-1">
                    {/* Table Number Circle */}
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {tableNum}
                    </div>
                    
                    {/* Unfinished Dishes Circles */}
                    <div className="flex space-x-0.5">
                      {Array.from({ length: Math.min(unfinishedCount, 6) }, (_, index) => (
                        <div
                          key={index}
                          className="w-2 h-2 bg-red-500 rounded-full border border-white"
                        />
                      ))}
                      {unfinishedCount > 6 && (
                        <div className="w-2 h-2 bg-gray-400 rounded-full border border-white flex items-center justify-center">
                          <span className="text-xs text-white font-bold">+</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Row 2: Tables 5-8 */}
            <div className="flex justify-center space-x-4">
              {[5, 6, 7, 8].map(tableNum => {
                const unfinishedCount = kitchenQueue.filter(item => 
                  item.tableNumber === tableNum && 
                  item.kitchenStatus !== 'ready'
                ).length;
                
                return (
                  <div key={tableNum} className="flex items-center space-x-1">
                    {/* Table Number Circle */}
                    <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {tableNum}
                    </div>
                    
                    {/* Unfinished Dishes Circles */}
                    <div className="flex space-x-0.5">
                      {Array.from({ length: Math.min(unfinishedCount, 6) }, (_, index) => (
                        <div
                          key={index}
                          className="w-2 h-2 bg-red-500 rounded-full border border-white"
                        />
                      ))}
                      {unfinishedCount > 6 && (
                        <div className="w-2 h-2 bg-gray-400 rounded-full border border-white flex items-center justify-center">
                          <span className="text-xs text-white font-bold">+</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Kitchen Queue */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Tabs for kitchen type */}
            <div className="mb-4">
              <div className="inline-flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setSelectedKitchenType('cook')}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${selectedKitchenType === 'cook' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  👨‍🍳 Món nấu
                  <span className="ml-2 text-xs text-gray-500">
                    ({kitchenQueue.filter(i => (i?.timing?.kitchenType || i?.kitchenType || 'cook') === 'cook').length})
                  </span>
                </button>
                <button
                  onClick={() => setSelectedKitchenType('grill')}
                  className={`ml-1 px-4 py-2 rounded-md text-sm font-medium ${selectedKitchenType === 'grill' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  🔥 Món nướng
                  <span className="ml-2 text-xs text-gray-500">
                    ({kitchenQueue.filter(i => (i?.timing?.kitchenType || i?.kitchenType || 'cook') === 'grill').length})
                  </span>
                </button>
              </div>
            </div>

            {queueByKitchenType.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🍽️</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Không có món nào</h3>
                <p className="text-gray-500">Hiện tại không có món nào cần làm cho tab này</p>
              </div>
            ) : (
              <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                🔥 Món cần làm (theo thứ tự ưu tiên)
              </h3>
              
                {queueByKitchenType.map((item, index) => (
                <div
                  key={`${item.billId}-${item.orderItemId || item.menuItemId}-${item.batchOrder || index}`}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="grid grid-cols-12 gap-4 items-center mb-2">
                        <div className="col-span-1">
                          <span className="text-lg font-bold text-indigo-600">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-lg font-semibold text-gray-900">
                            Bàn {item.tableNumber}
                          </span>
                        </div>
                        <div className="col-span-4">
                          <span className="text-xl font-bold text-gray-900">
                            {item.name}
                          </span>
                          {item.batchTotal > 1 && (
                            <span className="ml-2 text-sm text-gray-500">
                              ({item.batchOrder}/{item.batchTotal})
                            </span>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(item.kitchenStatus)}`}>
                            {getStatusText(item.kitchenStatus)}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-sm text-gray-500">
                            ⏱️ {item.estimatedTime}p | Score: {Math.round(item.score)}
                          </span>
                        </div>
                        <div className="col-span-1">
                          <span className="text-xs text-gray-400">
                            Bill #{item.billOrder}
                          </span>
                        </div>
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
        </div>


        {/* Next Item Highlight */}
        {nextItemByKitchenType && (
          <div className="p-6 border-t bg-orange-50">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">!</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Món tiếp theo cần làm:</h4>
                <p className="text-gray-600">
                  Bàn {nextItemByKitchenType.tableNumber} - {nextItemByKitchenType.name} x{nextItemByKitchenType.quantity}
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
