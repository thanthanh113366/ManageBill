import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, UtensilsCrossed, FileText, ShoppingBag } from 'lucide-react';

const OrderSuccess = () => {
  const { tableNumber } = useParams();
  const navigate = useNavigate();

  // "MV-N" → đây là đơn mang về số N
  const isTakeaway = tableNumber?.startsWith('MV-');
  const takeawayNumber = isTakeaway ? tableNumber.slice(3) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
            {isTakeaway
              ? <span className="text-4xl">🥡</span>
              : <CheckCircle className="w-12 h-12 text-green-600" />}
          </div>
        </div>

        {/* Success Message */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Đặt món thành công! 🎉
        </h1>
        <p className="text-gray-600 mb-2">
          {isTakeaway
            ? <>Mang về số <span className="font-semibold text-indigo-600">{takeawayNumber}</span></>
            : <>Bàn số <span className="font-semibold text-indigo-600">{tableNumber}</span></>}
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Món ăn của bạn đang được chuẩn bị.<br />
          Vui lòng chờ trong giây lát!
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          {isTakeaway ? (
            <button
              onClick={() => navigate('/takeaway')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center transition-colors shadow-md"
            >
              <ShoppingBag className="w-5 h-5 mr-2" />
              Đặt đơn mang về mới
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate(`/order/${tableNumber}`)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center transition-colors shadow-md"
              >
                <UtensilsCrossed className="w-5 h-5 mr-2" />
                Gọi thêm món
              </button>
              <button
                onClick={() => navigate(`/bill/${tableNumber}`)}
                className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl border-2 border-gray-200 flex items-center justify-center transition-colors"
              >
                <FileText className="w-5 h-5 mr-2" />
                Xem hóa đơn
              </button>
            </>
          )}
        </div>

        {/* Info Note */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-700">
            💡 <span className="font-medium">Lưu ý:</span> Nếu cần thay đổi món, vui lòng liên hệ nhân viên
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Cảm ơn bạn đã lựa chọn Ốc đây nè! 🦪
        </p>
      </div>
    </div>
  );
};

export default OrderSuccess;

