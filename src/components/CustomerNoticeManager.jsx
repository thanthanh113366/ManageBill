import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { Bell, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import { db } from '../config/firebase';
import {
  CUSTOMER_NOTICE_SETTINGS_COLLECTION,
  CUSTOMER_NOTICE_SETTINGS_DOC,
  DEFAULT_CUSTOMER_NOTICE,
  normalizeCustomerNotice,
} from '../utils/customerNotice';

const toDatetimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDatetimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

const CustomerNoticeManager = () => {
  const [enabled, setEnabled] = useState(DEFAULT_CUSTOMER_NOTICE.enabled);
  const [message, setMessage] = useState(DEFAULT_CUSTOMER_NOTICE.message);
  const [expiresAt, setExpiresAt] = useState(DEFAULT_CUSTOMER_NOTICE.expiresAt);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const settingsRef = doc(
      db,
      CUSTOMER_NOTICE_SETTINGS_COLLECTION,
      CUSTOMER_NOTICE_SETTINGS_DOC
    );
    const unsubscribe = onSnapshot(
      settingsRef,
      (snapshot) => {
        const notice = normalizeCustomerNotice(snapshot.data());
        setEnabled(notice.enabled);
        setMessage(notice.message);
        setExpiresAt(toDatetimeLocalValue(notice.expiresAt));
      },
      (error) => {
        console.error('Error loading customer notice setting:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();

    if (enabled && !message.trim()) {
      toast.error('Vui lòng nhập nội dung thông báo');
      return;
    }

    setIsSaving(true);
    try {
      await setDoc(
        doc(db, CUSTOMER_NOTICE_SETTINGS_COLLECTION, CUSTOMER_NOTICE_SETTINGS_DOC),
        {
          enabled,
          message: message.trim(),
          expiresAt: fromDatetimeLocalValue(expiresAt),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      toast.success('Đã lưu thông báo cho khách');
    } catch (error) {
      console.error('Error saving customer notice setting:', error);
      toast.error('Có lỗi khi lưu thông báo');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="surface-card">
      <div className="mb-5">
        <p className="section-kicker">Gọi món public</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-slate-950">
          <Bell className="h-5 w-5 text-[var(--primary-700)]" />
          Thông báo cho khách hàng
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Nội dung sẽ hiển thị ở đầu trang gọi món của khách cho đến khi hết hạn.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-[var(--primary-600)] focus:ring-[var(--primary-500)]"
          />
          <span className="text-sm font-semibold text-slate-800">Bật thông báo</span>
        </label>

        <div>
          <label htmlFor="customer-notice-message" className="text-sm font-semibold text-slate-700">
            Nội dung thông báo
          </label>
          <textarea
            id="customer-notice-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            className="form-control mt-2 resize-none"
            placeholder="VD: Hôm nay quán hết nghêu hấp sả. Quý khách vui lòng chọn món khác."
          />
        </div>

        <div>
          <label htmlFor="customer-notice-expires-at" className="text-sm font-semibold text-slate-700">
            Hiển thị đến
          </label>
          <input
            id="customer-notice-expires-at"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            className="form-control mt-2 max-w-sm"
          />
          <p className="mt-1 text-xs text-slate-500">Để trống nếu muốn hiển thị cho đến khi tắt thủ công.</p>
        </div>

        <button type="submit" disabled={isSaving} className="btn-primary justify-center">
          {isSaving ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Lưu thông báo
            </>
          )}
        </button>
      </form>
    </section>
  );
};

export default CustomerNoticeManager;
