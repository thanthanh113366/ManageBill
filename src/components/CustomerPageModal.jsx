import React from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';

/**
 * Modal chọn bàn để mở trang khách hàng.
 * Props:
 *   activeBills   – Bill[]     danh sách bill đang pending (để hiển thị đúng tên)
 *   tables        – Table[]    tất cả bàn từ Firestore
 *   onClose       – () => void
 *   onSelect      – (tableNumber: number) => void
 */
const getBillLabel = (bill) =>
  bill.isTakeaway ? `Mang về ${bill.takeawayNumber}` : `Bàn ${bill.tableNumber}`;

const CustomerPageModal = ({ activeBills = [], tables = [], onClose, onSelect }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Mở trang khách hàng</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 overflow-y-auto max-h-[calc(80vh-64px)]">
        <p className="text-sm text-gray-600 mb-4">
          Chọn bàn để mở trang đặt món / xem hóa đơn cho khách hàng:
        </p>

        {/* Đơn đang chờ thanh toán */}
        {activeBills.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Đang có đơn chưa thanh toán:
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {activeBills.map((bill) => (
                <button
                  key={bill.id}
                  onClick={() => onSelect(bill.tableNumber)}
                  className="w-full text-left p-3 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 hover:border-green-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{getBillLabel(bill)}</div>
                      <div className="text-sm text-green-600">● Có đơn hàng đang chờ</div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tất cả bàn */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Tất cả bàn:</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {tables.length > 0 ? tables.map((table) => (
              <button
                key={table.id}
                onClick={() => onSelect(table.number)}
                className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Bàn {table.number}</div>
                    <div className="text-sm text-gray-500">
                      {table.seats} chỗ ngồi
                      {table.description && ` • ${table.description}`}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </div>
              </button>
            )) : (
              <p className="text-center text-gray-500 py-8">Chưa có bàn nào được thiết lập</p>
            )}
          </div>
        </div>

        {activeBills.length === 0 && tables.length === 0 && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Không có bàn nào để hiển thị</p>
          </div>
        )}
      </div>
    </div>
  </div>
);

export default CustomerPageModal;
