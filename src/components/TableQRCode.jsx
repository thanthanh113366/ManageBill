import React from 'react';
import QRCode from 'react-qr-code';
import { Download, Printer } from 'lucide-react';

const TableQRCode = ({ table, baseUrl }) => {
  const qrValue = `${baseUrl}/bill/${table.number}`;

  const handleDownload = () => {
    const svg = document.getElementById(`qr-${table.number}`);
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
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const qrContainer = document.getElementById(`qr-container-${table.number}`);
    
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - Bàn ${table.number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 20px;
              margin: 0;
            }
            .qr-container {
              border: 2px solid #000;
              padding: 20px;
              margin: 20px auto;
              width: fit-content;
              border-radius: 10px;
            }
            .table-info {
              margin-bottom: 15px;
            }
            .table-number {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .table-seats {
              font-size: 14px;
              color: #666;
            }
            .instructions {
              margin-top: 15px;
              font-size: 12px;
              color: #666;
              max-width: 200px;
            }
            .restaurant-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="restaurant-name">QUÁN ỐC</div>
            <div class="table-info">
              <div class="table-number">BÀN ${table.number}</div>
              <div class="table-seats">${table.seats} chỗ ngồi</div>
            </div>
            ${qrContainer.innerHTML}
            <div class="instructions">
              Quét mã QR để xem hóa đơn và thanh toán
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Bàn {table.number}
        </h3>
        <p className="text-sm text-gray-600">
          {table.seats} chỗ ngồi
        </p>
        {table.description && (
          <p className="text-xs text-gray-500 mt-1">
            {table.description}
          </p>
        )}
      </div>

      <div id={`qr-container-${table.number}`} className="flex justify-center mb-4">
        <div className="p-4 bg-white border-2 border-gray-100 rounded-lg">
          <QRCode
            id={`qr-${table.number}`}
            value={qrValue}
            size={120}
            level="M"
          />
        </div>
      </div>

      <div className="text-center mb-4">
        <p className="text-xs text-gray-600 break-all">
          {qrValue}
        </p>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Download size={16} className="mr-1" />
          Tải về
        </button>
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
        >
          <Printer size={16} className="mr-1" />
          In
        </button>
      </div>
    </div>
  );
};

export default TableQRCode; 