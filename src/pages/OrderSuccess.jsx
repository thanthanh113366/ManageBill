import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, FileText, ShoppingBag, UtensilsCrossed } from 'lucide-react';

const OrderSuccess = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();
  const isTakeaway = tableNumber?.startsWith('MV-');
  const takeawayNumber = isTakeaway ? tableNumber.slice(3) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] p-4">
      <main className="w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-white p-7 text-center shadow-[var(--shadow-md)]">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          {isTakeaway ? <ShoppingBag className="h-8 w-8" /> : <CheckCircle className="h-9 w-9" />}
        </div>

        <h1 className="text-2xl font-semibold text-slate-950">Đặt món thành công</h1>
        <p className="mt-2 text-slate-600">
          {isTakeaway ? (
            <>Đơn mang về số <span className="font-semibold text-[var(--primary-700)]">{takeawayNumber}</span></>
          ) : (
            <>Bàn <span className="font-semibold text-[var(--primary-700)]">{tableNumber}</span></>
          )}
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Món của bạn đã được gửi tới bếp. Vui lòng chờ nhân viên phục vụ.
        </p>

        <div className="mt-7 space-y-3">
          {isTakeaway ? (
            <button type="button" onClick={() => navigate('/takeaway')} className="btn-primary w-full justify-center py-3">
              <ShoppingBag className="h-5 w-5" />
              Đặt đơn mang về mới
            </button>
          ) : (
            <>
              <button type="button" onClick={() => navigate(`/order/${tableNumber}`)} className="btn-primary w-full justify-center py-3">
                <UtensilsCrossed className="h-5 w-5" />
                Gọi thêm món
              </button>
              <button type="button" onClick={() => navigate(`/bill/${tableNumber}`)} className="btn-secondary w-full justify-center py-3">
                <FileText className="h-5 w-5" />
                Xem hóa đơn
              </button>
            </>
          )}
        </div>

        <div className="mt-6 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-800">
          Nếu cần thay đổi món, vui lòng liên hệ nhân viên.
        </div>

        <p className="mt-5 text-xs text-slate-400">Cảm ơn quý khách đã chọn Ốc đây nè.</p>
      </main>
    </div>
  );
};

export default OrderSuccess;
