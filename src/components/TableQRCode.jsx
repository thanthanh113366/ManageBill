import React from 'react';
import QRCode from 'react-qr-code';
import { Download, Printer } from 'lucide-react';

const TableQRCode = ({ table, baseUrl }) => {
  const qrValue = `${baseUrl}/bill/${table.number}`;

  const handleDownload = () => {
    const svg = document.getElementById(`qr-${table.number}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const downloadLink = document.createElement('a');
      downloadLink.download = `ban-${table.number}-qr.png`;
      downloadLink.href = canvas.toDataURL('image/png');
      downloadLink.click();
    };

    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const qrContainer = document.getElementById(`qr-container-${table.number}`);
    if (!printWindow || !qrContainer) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - Bàn ${table.number}</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; margin: 0; }
            .qr-container { border: 2px solid #000; padding: 20px; margin: 20px auto; width: fit-content; border-radius: 8px; }
            .restaurant-name { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
            .table-number { font-size: 24px; font-weight: 700; margin-bottom: 5px; }
            .table-seats, .instructions { font-size: 12px; color: #555; }
            .instructions { margin-top: 15px; max-width: 220px; line-height: 1.4; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="restaurant-name">Ốc đây nè</div>
            <div class="table-number">Bàn ${table.number}</div>
            <div class="table-seats">${table.seats} chỗ</div>
            ${qrContainer.innerHTML}
            <div class="instructions">Quét QR để xem hóa đơn và thanh toán</div>
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
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-[var(--primary-200)] hover:shadow-[var(--shadow-md)]">
      <header className="mb-4 text-center">
        <h3 className="text-lg font-semibold text-slate-950">Bàn {table.number}</h3>
        <p className="text-sm text-slate-500">{table.seats} chỗ</p>
        {table.description && <p className="mt-1 text-xs text-slate-500">{table.description}</p>}
      </header>

      <div id={`qr-container-${table.number}`} className="mb-4 flex justify-center">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <QRCode id={`qr-${table.number}`} value={qrValue} size={128} level="M" />
        </div>
      </div>

      <p className="mb-4 break-all rounded-md bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">{qrValue}</p>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={handleDownload} className="btn-secondary justify-center px-3">
          <Download className="h-4 w-4" />
          Tải
        </button>
        <button type="button" onClick={handlePrint} className="btn-primary justify-center px-3">
          <Printer className="h-4 w-4" />
          In
        </button>
      </div>
    </article>
  );
};

export default TableQRCode;
