import React, { useState } from 'react';
import { CheckCircle, Image as ImageIcon } from 'lucide-react';

const QR_OPTIONS = [
  { id: 'qr1', name: 'QR Trân', path: '/my_qr_1.jpg' },
  { id: 'qr2', name: 'QR Trúc', path: '/my_qr_2.jpg' },
  { id: 'qr3', name: 'QR 3', path: '/my_qr_3.jpg' },
];

const PaymentQRManager = () => {
  const [defaultQR, setDefaultQR] = useState(() => localStorage.getItem('defaultPaymentQR') || '/my_qr_1.jpg');

  const handleSetDefault = (qrPath) => {
    setDefaultQR(qrPath);
    localStorage.setItem('defaultPaymentQR', qrPath);
  };

  return (
    <section className="surface-card">
      <div className="mb-5">
        <p className="section-kicker">Thanh toán</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">QR thanh toán mặc định</h2>
        <p className="mt-1 text-sm text-slate-500">
          Chọn mã QR sẽ hiển thị cho khách khi xem hóa đơn.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {QR_OPTIONS.map((qr) => {
          const active = defaultQR === qr.path;

          return (
            <article
              key={qr.id}
              className={`relative rounded-lg border p-4 transition ${
                active
                  ? 'border-[var(--primary-300)] bg-[var(--primary-50)] ring-2 ring-[var(--primary-100)]'
                  : 'border-slate-200 bg-white hover:border-[var(--primary-200)]'
              }`}
            >
              {active && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[var(--primary-600)] px-2 py-1 text-xs font-semibold text-white">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Mặc định
                </span>
              )}

              <h3 className="mb-3 pr-24 text-center font-semibold text-slate-950">{qr.name}</h3>

              <div className="mb-4 flex justify-center">
                <img
                  src={qr.path}
                  alt={qr.name}
                  className="h-64 w-64 rounded-lg border border-slate-200 bg-white object-contain"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                    event.currentTarget.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden h-64 w-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                  <ImageIcon className="mb-2 h-8 w-8" />
                  <span className="text-xs">Không tải được ảnh</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSetDefault(qr.path)}
                disabled={active}
                className={active ? 'btn-primary w-full justify-center' : 'btn-secondary w-full justify-center'}
              >
                {active ? 'Đang sử dụng' : 'Đặt làm mặc định'}
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-sky-800">
        QR mặc định được lưu trên trình duyệt hiện tại và dùng cho trang hóa đơn khách hàng.
      </div>
    </section>
  );
};

export default PaymentQRManager;
