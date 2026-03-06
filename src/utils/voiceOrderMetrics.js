/**
 * Voice order metrics – OpenTelemetry metrics for evaluate_voice_order.md
 * Chỉ init và gửi OTLP khi có đủ VITE_OTEL_EXPORTER_OTLP_ENDPOINT và VITE_OTEL_EXPORTER_OTLP_HEADERS
 */

const noop = () => {};

let recordPreview = noop;
let recordAccepted = noop;
let recordCancelled = noop;
let recordParsedItems = noop;
let recordMatchedItem = noop;
let recordMatchConfidence = noop;
let recordUserRemovedVoiceItem = noop;

/**
 * Gọi một lần khi app load (ví dụ trong main.jsx)
 */
export async function initVoiceOrderMetrics() {
  const endpoint = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT;
  const headersStr = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS;

  if (!endpoint || !headersStr) {
    return;
  }

  try {
    const { MeterProvider, PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');

    const headers = {};
    headersStr.split(',').forEach((part) => {
      const eq = part.indexOf('=');
      if (eq > 0) {
        const key = part.slice(0, eq).trim();
        const value = decodeURIComponent(part.slice(eq + 1).trim().replace(/^["']|["']$/g, ''));
        headers[key] = value;
      }
    });

    const url = endpoint.replace(/\/?$/, '').replace(/\/v1\/metrics\/?$/, '') + '/v1/metrics';
    const exporter = new OTLPMetricExporter({ url, headers });

    const reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 10000
    });

    const meterProvider = new MeterProvider({ readers: [reader] });
    const meter = meterProvider.getMeter('manage-bill', '1.0.0');

    const cPreview = meter.createCounter('voice_order_preview_total', { description: 'Số lần mở modal preview' });
    const cAccepted = meter.createCounter('voice_order_accepted_total', { description: 'Số lần user bấm Xác nhận' });
    const cCancelled = meter.createCounter('voice_order_cancelled_total', { description: 'Số lần user bấm Hủy' });
    const cParsedItems = meter.createCounter('voice_order_parsed_items_total', { description: 'Tổng số item parser trả về' });
    const cMatchedItems = meter.createCounter('voice_order_matched_items_total', {
      description: 'Tổng số item match thành công'
    });
    const hConfidence = meter.createHistogram('voice_order_match_confidence', {
      description: 'Phân bố confidence khi match',
      unit: '1',
      boundaries: [0.5, 0.65, 0.75, 0.9, 1.0]
    });
    const cUserRemoved = meter.createCounter('voice_order_user_removed_voice_item_total', {
      description: 'Số lần user xóa/giảm về 0 món vừa thêm từ voice'
    });

    recordPreview = () => cPreview.add(1);
    recordAccepted = () => cAccepted.add(1);
    recordCancelled = () => cCancelled.add(1);
    recordParsedItems = (n) => { if (n > 0) cParsedItems.add(n); };
    recordMatchedItem = (menuItemId) => {
      if (menuItemId) {
        cMatchedItems.add(1, { menu_item_id: String(menuItemId) });
      } else {
        cMatchedItems.add(1);
      }
    };
    recordMatchConfidence = (value) => {
      const v = Number(value);
      if (!Number.isNaN(v) && v >= 0 && v <= 1) hConfidence.record(v);
    };
    recordUserRemovedVoiceItem = (menuItemId) => {
      if (menuItemId) {
        cUserRemoved.add(1, { menu_item_id: String(menuItemId) });
      } else {
        cUserRemoved.add(1);
      }
    };
  } catch (err) {
    console.warn('[voiceOrderMetrics] Init failed, metrics disabled:', err);
  }
}

export function getVoiceOrderMetrics() {
  return {
    recordPreview,
    recordAccepted,
    recordCancelled,
    recordParsedItems,
    recordMatchedItem,
    recordMatchConfidence,
    recordUserRemovedVoiceItem
  };
}
