import React, { useState, useEffect } from 'react';
import { CheckCircle, Image as ImageIcon } from 'lucide-react';

/**
 * Component quản lý mã QR thanh toán
 * Cho phép chọn 1 trong 3 mã QR làm mặc định
 */
const PaymentQRManager = () => {
  const QR_OPTIONS = [
    { id: 'qr1', name: 'Mã QR Trân', path: '/my_qr_1.jpg' },
    { id: 'qr2', name: 'Mã QR Trúc', path: '/my_qr_2.jpg' }
  ];

  const [defaultQR, setDefaultQR] = useState(() => {
    // Load from localStorage
    return localStorage.getItem('defaultPaymentQR') || '/my_qr_1.jpg';
  });

  const handleSetDefault = (qrPath) => {
    setDefaultQR(qrPath);
    localStorage.setItem('defaultPaymentQR', qrPath);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Quản lý mã QR thanh toán
        </h3>
        <p className="text-sm text-gray-600">
          Chọn mã QR mặc định để hiển thị cho khách hàng khi xem hóa đơn
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {QR_OPTIONS.map((qr) => (
          <div
            key={qr.id}
            className={`relative border-2 rounded-lg p-4 transition-all ${
              defaultQR === qr.path
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* Badge mặc định */}
            {defaultQR === qr.path && (
              <div className="absolute top-2 right-2 bg-indigo-600 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                <CheckCircle size={12} />
                Mặc định
              </div>
            )}

            {/* Tên mã QR */}
            <div className="text-center mb-3">
              <h4 className="font-semibold text-gray-900">{qr.name}</h4>
            </div>

            {/* Ảnh QR */}
            <div className="flex justify-center mb-4">
              <img
                src={qr.path}
                alt={qr.name}
                className="w-40 h-40 object-contain border border-gray-200 rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div
                className="w-40 h-40 bg-gray-100 rounded-lg flex-col items-center justify-center text-gray-400"
                style={{ display: 'none' }}
              >
                <ImageIcon size={32} className="mb-2" />
                <span className="text-xs">Không tải được ảnh</span>
              </div>
            </div>

            {/* Nút chọn mặc định */}
            <button
              onClick={() => handleSetDefault(qr.path)}
              disabled={defaultQR === qr.path}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                defaultQR === qr.path
                  ? 'bg-indigo-600 text-white cursor-default'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {defaultQR === qr.path ? 'Đang sử dụng' : 'Đặt làm mặc định'}
            </button>
          </div>
        ))}
      </div>

      {/* Thông tin */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>💡 Lưu ý:</strong> Mã QR mặc định sẽ được hiển thị cho khách hàng 
          khi họ xem hóa đơn trên trang thanh toán. Bạn có thể thay đổi mã mặc định 
          bất cứ lúc nào bằng cách nhấn nút "Đặt làm mặc định".
        </p>
      </div>
    </div>
  );
};

export default PaymentQRManager;

