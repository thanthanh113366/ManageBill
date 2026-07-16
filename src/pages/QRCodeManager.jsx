import React, { useEffect, useState } from 'react';
import { Download, Printer, QrCode, Settings } from 'lucide-react';
import PaymentQRManager from '../components/PaymentQRManager';
import TableQRCode from '../components/TableQRCode';
import { EmptyState, PageHeader, SurfaceCard } from '../components/ui';
import { useApp } from '../context/AppContext';

const QRCodeManager = () => {
  const { tables } = useApp();
  const [baseUrl, setBaseUrl] = useState(window.location.origin);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const handleDownloadAll = () => {
    tables.forEach((table, index) => {
      setTimeout(() => {
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
      }, index * 180);
    });
  };

  const handlePrintAll = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const allQRContent = tables.map((table) => `
      <div class="qr-page">
        <div class="qr-container">
          <div class="restaurant-name">Ốc đây nè</div>
          <div class="table-number">Bàn ${table.number}</div>
          <div class="table-seats">${table.seats} chỗ</div>
          ${table.description ? `<div class="table-desc">${table.description}</div>` : ''}
          <div class="qr-placeholder">${baseUrl}/bill/${table.number}</div>
          <div class="instructions">Quét QR để xem hóa đơn và thanh toán</div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Tất cả QR Code - Ốc đây nè</title>
          <style>
            @page { margin: 10mm; size: A4; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
            .qr-page { break-inside: avoid; page-break-inside: avoid; display: inline-block; width: 48%; margin: 1%; vertical-align: top; }
            .qr-container { border: 2px solid #000; padding: 15px; margin: 10px 0; text-align: center; border-radius: 8px; background: white; }
            .restaurant-name { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
            .table-number { font-size: 20px; font-weight: 700; margin-bottom: 3px; }
            .table-seats, .table-desc { font-size: 12px; color: #555; }
            .qr-placeholder { width: 120px; min-height: 80px; border: 1px dashed #aaa; margin: 12px auto; padding: 8px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #666; word-break: break-all; }
            .instructions { font-size: 10px; color: #555; margin-top: 10px; line-height: 1.3; }
          </style>
        </head>
        <body>${allQRContent}</body>
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
      <div className="page-shell">
        <EmptyState
          icon={QrCode}
          title="Chưa có bàn nào"
          description="Thêm bàn trong phần quản lý menu để tạo QR cho khách xem hóa đơn."
          action={(
            <a href="/menu" className="btn-primary">
              Quản lý bàn
            </a>
          )}
        />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="QR khách hàng"
        title="Quản lý QR"
        description="Tạo mã QR cho từng bàn và chọn QR thanh toán mặc định hiển thị trên hóa đơn khách."
        actions={(
          <>
            <button type="button" onClick={() => setShowSettings((value) => !value)} className="btn-secondary">
              <Settings className="h-4 w-4" />
              Cài đặt
            </button>
            <button type="button" onClick={handleDownloadAll} className="btn-secondary">
              <Download className="h-4 w-4" />
              Tải tất cả
            </button>
            <button type="button" onClick={handlePrintAll} className="btn-primary">
              <Printer className="h-4 w-4" />
              In tất cả
            </button>
          </>
        )}
      />

      {showSettings && (
        <SurfaceCard>
          <div className="max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-950">URL gốc</h2>
            <p className="mt-1 text-sm text-slate-500">Dùng khi deploy lên domain khác. QR sẽ dẫn đến đường dẫn hóa đơn theo từng bàn.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="text-sm font-semibold text-slate-700" htmlFor="base-url">URL</label>
              <input
                id="base-url"
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                className="form-control max-w-xl"
                placeholder="https://your-domain.com"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">Mẫu: {baseUrl}/bill/[số-bàn]</p>
          </div>
        </SurfaceCard>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SurfaceCard>
          <p className="section-kicker">Bàn</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{tables.length}</p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="section-kicker">Có thể tải</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--primary-700)]">{tables.length}</p>
        </SurfaceCard>
        <SurfaceCard>
          <p className="section-kicker">Có thể in</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-700">{tables.length}</p>
        </SurfaceCard>
      </section>

      <PaymentQRManager />

      <SurfaceCard>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Theo bàn</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">QR gọi món và xem hóa đơn</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tables.map((table) => (
            <TableQRCode key={table.id} table={table} baseUrl={baseUrl} />
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard className="border-sky-100 bg-sky-50">
        <h2 className="text-lg font-semibold text-sky-950">Ghi chú vận hành</h2>
        <div className="mt-3 grid gap-2 text-sm text-sky-800 md:grid-cols-2">
          <p>Tải từng QR để in và dán lên bàn.</p>
          <p>Khách quét QR để xem hóa đơn, thanh toán hoặc gọi thêm món.</p>
          <p>Hóa đơn cập nhật realtime khi có món mới.</p>
          <p>QR thanh toán mặc định được chọn ở phần thanh toán phía trên.</p>
        </div>
      </SurfaceCard>
    </div>
  );
};

export default QRCodeManager;
