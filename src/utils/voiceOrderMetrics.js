/**
 * Voice order metrics – OpenTelemetry metrics for evaluate_voice_order.md
 *
 * Browser note:
 * - Frontend always exports via same-origin proxy endpoint `/api/otlp`.
 * - Backend proxy injects auth server-side to avoid CORS and credential exposure.
 */

const noop = () => {};

let recordPreview = noop;
let recordAccepted = noop;
let recordCancelled = noop;
let recordParsedItems = noop;
let recordMatchedItem = noop;
let recordMatchConfidence = noop;
let recordUserRemovedVoiceItem = noop;
let recordApiLatency = noop;
let recordParseLatency = noop;
let recordMatchLatency = noop;
let recordTotalProcessingLatency = noop;

function withSource(source, attrs = {}) {
  return { source, ...attrs };
}

/**
 * Call once at app startup (main.jsx). Safe to fire-and-forget.
 */
export async function initVoiceOrderMetrics() {
  const endpointRaw =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT;
  const metricsSource =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_METRICS_SOURCE) ||
    'app_ui';

  if (!endpointRaw) return;

  const endpoint =
    typeof endpointRaw === 'string' && endpointRaw.startsWith('/') ? endpointRaw : '/api/otlp';

  try {
    const { MeterProvider, PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');

    const url = String(endpoint).replace(/\/?$/, '').replace(/\/v1\/metrics\/?$/, '') + '/v1/metrics';

    const exporter = new OTLPMetricExporter({ url });
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
      unit: '1'
    });
    const cUserRemoved = meter.createCounter('voice_order_user_removed_voice_item_total', {
      description: 'Số lần user xóa/giảm về 0 món vừa thêm từ voice'
    });
    const hApiLatency = meter.createHistogram('voice_order_api_latency_ms', {
      description: 'Thời gian gọi API transcribe (ms)',
      unit: 'ms'
    });
    const hParseLatency = meter.createHistogram('voice_order_parse_latency_ms', {
      description: 'Thời gian parse regex voice order (ms)',
      unit: 'ms'
    });
    const hMatchLatency = meter.createHistogram('voice_order_match_latency_ms', {
      description: 'Thời gian matching menu item (ms)',
      unit: 'ms'
    });
    const hTotalProcessingLatency = meter.createHistogram('voice_order_total_processing_latency_ms', {
      description: 'Tổng thời gian xử lý voice order ở frontend (ms)',
      unit: 'ms'
    });

    recordPreview = () => cPreview.add(1, withSource(metricsSource));
    recordAccepted = () => cAccepted.add(1, withSource(metricsSource));
    recordCancelled = () => cCancelled.add(1, withSource(metricsSource));
    recordParsedItems = (n) => {
      const v = Number(n);
      if (!Number.isNaN(v) && v > 0) cParsedItems.add(v, withSource(metricsSource));
    };
    recordMatchedItem = (menuItemId) => {
      if (menuItemId) {
        cMatchedItems.add(1, withSource(metricsSource, { menu_item_id: String(menuItemId) }));
      } else {
        cMatchedItems.add(1, withSource(metricsSource));
      }
    };
    recordMatchConfidence = (value) => {
      const v = Number(value);
      if (!Number.isNaN(v) && v >= 0 && v <= 1) hConfidence.record(v, withSource(metricsSource));
    };
    recordUserRemovedVoiceItem = (menuItemId) => {
      if (menuItemId) {
        cUserRemoved.add(1, withSource(metricsSource, { menu_item_id: String(menuItemId) }));
      } else {
        cUserRemoved.add(1, withSource(metricsSource));
      }
    };
    recordApiLatency = (ms) => {
      const v = Number(ms);
      if (!Number.isNaN(v) && v >= 0) hApiLatency.record(v, withSource(metricsSource));
    };
    recordParseLatency = (ms) => {
      const v = Number(ms);
      if (!Number.isNaN(v) && v >= 0) hParseLatency.record(v, withSource(metricsSource));
    };
    recordMatchLatency = (ms) => {
      const v = Number(ms);
      if (!Number.isNaN(v) && v >= 0) hMatchLatency.record(v, withSource(metricsSource));
    };
    recordTotalProcessingLatency = (ms) => {
      const v = Number(ms);
      if (!Number.isNaN(v) && v >= 0) hTotalProcessingLatency.record(v, withSource(metricsSource));
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
    recordUserRemovedVoiceItem,
    recordApiLatency,
    recordParseLatency,
    recordMatchLatency,
    recordTotalProcessingLatency
  };
}

