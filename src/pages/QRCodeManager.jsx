import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import TableQRCode from '../components/TableQRCode';
import { QrCode, Download, Printer, Settings } from 'lucide-react';

const QRCodeManager = () => {
  const { tables } = useApp();
  const [baseUrl, setBaseUrl] = useState(window.location.origin);
  const [showSettings, setShowSettings] = useState(false);

  const handleDownloadAll = () => {
    // Tạo zip file chứa tất cả QR codes (cần thêm library jszip nếu muốn)
    tables.forEach((table, index) => {
      setTimeout(() => {
        const svg = document.getElementById(`qr-${table.number}`);
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const pngFile = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.download = `ban-${table.number}-qr.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
          };
          
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        }
      }, index * 200); // Delay để tránh download cùng lúc
    });
  };

  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    const allQRContent = tables.map(table => {
      return `
        <div class="qr-page">
          <div class="qr-container">
            <div class="restaurant-name">QUÁN ỐC</div>
            <div class="table-info">
              <div class="table-number">BÀN ${table.number}</div>
              <div class="table-seats">${table.seats} chỗ ngồi</div>
              ${table.description ? `<div class="table-desc">${table.description}</div>` : ''}
            </div>
            <div class="qr-placeholder" data-table="${table.number}">
              [QR Code sẽ được tạo khi in]
            </div>
            <div class="instructions">
              Quét mã QR để xem hóa đơn và thanh toán
            </div>
            <div class="url">
              ${baseUrl}/bill/${table.number}
            </div>
          </div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Tất cả QR Code - Quán Ốc</title>
          <style>
            @page {
              margin: 10mm;
              size: A4;
            }
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 0;
            }
            .qr-page {
              break-inside: avoid;
              page-break-inside: avoid;
              display: inline-block;
              width: 48%;
              margin: 1%;
              vertical-align: top;
            }
            .qr-container {
              border: 2px solid #000;
              padding: 15px;
              margin: 10px 0;
              text-align: center;
              border-radius: 10px;
              background: white;
            }
            .restaurant-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 8px;
            }
            .table-number {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 3px;
            }
            .table-seats {
              font-size: 12px;
              color: #666;
              margin-bottom: 2px;
            }
            .table-desc {
              font-size: 10px;
              color: #666;
              margin-bottom: 10px;
            }
            .qr-placeholder {
              width: 100px;
              height: 100px;
              border: 1px dashed #ccc;
              margin: 10px auto;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8px;
              color: #999;
            }
            .instructions {
              font-size: 10px;
              color: #666;
              margin-top: 10px;
              line-height: 1.3;
            }
            .url {
              font-size: 8px;
              color: #999;
              margin-top: 5px;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          ${allQRContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  if (!tables || tables.length === 0) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Chưa có bàn nào
          </h2>
          <p className="text-gray-600 mb-4">
            Vui lòng thêm bàn trong phần quản lý để tạo QR code
          </p>
          <a
            href="/menu"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Quản lý bàn
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Quản lý QR Code thanh toán
            </h1>
            <p className="text-gray-600">
              Tạo và quản lý mã QR cho từng bàn để khách hàng có thể xem hóa đơn và thanh toán
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <Settings size={18} />
              <span>Cài đặt</span>
            </button>
            <button
              onClick={handleDownloadAll}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Download size={18} />
              <span>Tải tất cả</span>
            </button>
            <button
              onClick={handlePrintAll}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <Printer size={18} />
              <span>In tất cả</span>
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-medium text-gray-900 mb-3">Cài đặt URL</h3>
            <div className="flex items-center space-x-4">
              <label className="text-sm text-gray-600">URL gốc:</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="https://your-domain.com"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Thay đổi URL này nếu bạn deploy lên domain khác. QR code sẽ dẫn đến: {baseUrl}/bill/[số-bàn]
            </p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <QrCode className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng số bàn</p>
              <p className="text-2xl font-bold text-gray-900">{tables.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Download className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Sẵn sàng tải về</p>
              <p className="text-2xl font-bold text-green-600">{tables.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Printer className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Sẵn sàng in</p>
              <p className="text-2xl font-bold text-blue-600">{tables.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* QR Codes Grid */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          QR Code cho từng bàn
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {tables.map((table) => (
            <TableQRCode
              key={table.id}
              table={table}
              baseUrl={baseUrl}
            />
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Hướng dẫn sử dụng
        </h3>
        <div className="space-y-2 text-blue-800">
          <p>• <strong>Tải về:</strong> Tải từng QR code để in ra và dán lên bàn</p>
          <p>• <strong>In:</strong> In trực tiếp QR code với thông tin bàn</p>
          <p>• <strong>Khách hàng:</strong> Quét QR → Xem hóa đơn → Thanh toán</p>
          <p>• <strong>Tự động:</strong> Hóa đơn cập nhật real-time và tự xóa sau thanh toán</p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeManager; 