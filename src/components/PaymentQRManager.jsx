import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { CheckCircle, Image as ImageIcon } from 'lucide-react';
import { db } from '../config/firebase';
import {
  DEFAULT_PAYMENT_QR,
  PAYMENT_QR_OPTIONS,
  PAYMENT_QR_SETTINGS_COLLECTION,
  PAYMENT_QR_SETTINGS_DOC,
  isValidPaymentQRPath,
} from '../utils/paymentQR';

const PaymentQRManager = () => {
  const [defaultQR, setDefaultQR] = useState(DEFAULT_PAYMENT_QR);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const settingsRef = doc(db, PAYMENT_QR_SETTINGS_COLLECTION, PAYMENT_QR_SETTINGS_DOC);
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const savedQR = snapshot.data()?.defaultQR;
        setDefaultQR(isValidPaymentQRPath(savedQR) ? savedQR : DEFAULT_PAYMENT_QR);
      },
      (error) => {
        console.error('Error loading payment QR setting:', error);
        setDefaultQR(DEFAULT_PAYMENT_QR);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSetDefault = async (qrPath) => {
    if (!isValidPaymentQRPath(qrPath)) return;

    setIsSaving(true);
    setDefaultQR(qrPath);
    try {
      await setDoc(
        doc(db, PAYMENT_QR_SETTINGS_COLLECTION, PAYMENT_QR_SETTINGS_DOC),
        { defaultQR: qrPath, updatedAt: new Date() },
        { merge: true }
      );
    } catch (error) {
      console.error('Error saving payment QR setting:', error);
      setDefaultQR(DEFAULT_PAYMENT_QR);
    } finally {
      setIsSaving(false);
    }
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
        {PAYMENT_QR_OPTIONS.map((qr) => {
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
                disabled={active || isSaving}
                className={active ? 'btn-primary w-full justify-center' : 'btn-secondary w-full justify-center'}
              >
                {active ? 'Đang sử dụng' : 'Đặt làm mặc định'}
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-lg border border-sky-100 bg-sky-50 p-4 text-sm text-sky-800">
        QR mặc định được đồng bộ cho tất cả thiết bị admin và trang hóa đơn khách hàng.
      </div>
    </section>
  );
};

export default PaymentQRManager;
