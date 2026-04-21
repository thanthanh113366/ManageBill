import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { addDoc, collection, getDocs, getFirestore, serverTimestamp } from 'firebase/firestore';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { parseVoiceOrder } from '../src/utils/voiceParser.js';
import { createMenuMatcher } from '../src/utils/menuMatcher.js';

function getArg(flag, defaultValue = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i === process.argv.length - 1) return defaultValue;
  return process.argv[i + 1];
}

function getArgNumber(flags, defaultValue) {
  for (const flag of flags) {
    const value = getArg(flag, null);
    if (value !== null) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return defaultValue;
}

function hasArg(flag) {
  return process.argv.includes(flag);
}

function parseHeaders(headersStr) {
  const headers = {};
  if (!headersStr) return headers;
  String(headersStr)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((part) => {
      const eq = part.indexOf('=');
      if (eq > 0) {
        const key = part.slice(0, eq).trim();
        const raw = part.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        try {
          headers[key] = decodeURIComponent(raw);
        } catch {
          headers[key] = raw;
        }
      }
    });
  return headers;
}

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.webm', '.flac', '.ogg']);

async function collectAudioFiles(rootDir, maxFiles = 0, recursive = false) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(rootDir, e.name);
    if (e.isDirectory()) {
      if (recursive) {
        const remaining = maxFiles > 0 ? Math.max(0, maxFiles - files.length) : 0;
        const nested = await collectAudioFiles(full, remaining, true);
        files.push(...nested);
        if (maxFiles > 0 && files.length >= maxFiles) {
          return files.slice(0, maxFiles);
        }
      }
      continue;
    }
    if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (AUDIO_EXTENSIONS.has(ext)) {
        files.push(full);
        if (maxFiles > 0 && files.length >= maxFiles) {
          return files;
        }
      }
    }
  }
  return files;
}

function buildFirebaseConfig(env) {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };
}

function parsePercentOrRatio(raw, defaultValue) {
  if (raw == null) return defaultValue;
  const text = String(raw).trim();
  if (!text) return defaultValue;
  const value = Number(text);
  if (!Number.isFinite(value)) return defaultValue;
  if (value > 1) return value / 100;
  return value;
}

function withSource(source, attrs = {}) {
  return { source, ...attrs };
}

function emitEvent(logEvents, event) {
  if (!logEvents) return;
  console.log(JSON.stringify({ type: 'voice_test_event', ...event }));
}

async function main() {
  const envPath = getArg('--env', '.env.development.local');
  const datasetDir = getArg(
    '--dataset',
    'F:\\Nam_3\\NhandangMLops\\data-voice-vietnamese-restaurant\\dataset_output'
  );
  const category = getArg('--category', 'oc');
  const samples = getArgNumber(['--samples', '--limit'], 0);
  const offset = getArgNumber(['--offset'], 0);
  const recursive = hasArg('--recursive');
  const enableExport = hasArg('--export');
  const timeoutMs = getArgNumber(['--timeout-ms'], 30000);
  const createBill = hasArg('--create-bill');
  const autoPaid = hasArg('--auto-paid');
  const tableNumberStart = getArgNumber(['--table-number-start'], 9000);
  const acceptMinMatched = getArgNumber(['--accept-min-matched'], 1);
  const acceptMinMatchRate = parsePercentOrRatio(getArg('--accept-min-match-rate', null), 0.6);
  const acceptMinAvgConfidence = parsePercentOrRatio(getArg('--accept-min-avg-confidence', null), 0.55);
  const metricsSource = getArg('--source', 'voice_dataset_online_test');
  const enableTrace = hasArg('--trace');
  const logEvents = hasArg('--log-events');
  const runId = getArg('--run-id', `run_${Date.now()}`);

  const envResult = dotenv.config({ path: envPath, override: true });
  if (envResult.error) {
    throw new Error(`Khong doc duoc env: ${envPath}`);
  }
  const env = envResult.parsed || {};

  const app = initializeApp(buildFirebaseConfig(env), `metrics-test-${Date.now()}`);
  const db = getFirestore(app);
  const backendUrl = String(env.VITE_BACKEND_API_URL || '').trim();
  if (!backendUrl) {
    throw new Error('Thieu VITE_BACKEND_API_URL trong env de goi transcribe API (online mode).');
  }
  const transcribeUrl = `${backendUrl.replace(/\/$/, '')}/transcribe`;

  const [menuSnap, orderSnap] = await Promise.all([
    getDocs(collection(db, 'menuItems')),
    getDocs(collection(db, 'orderItems')),
  ]);
  const menuItems = menuSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const orderItems = orderSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!orderItems.length) {
    throw new Error('Khong co orderItems trong DB test. Hay seed du lieu truoc.');
  }

  const orderItemById = new Map(orderItems.map((x) => [x.id, x]));
  const menuItemById = new Map(menuItems.map((x) => [x.id, x]));
  const matcher = createMenuMatcher(orderItems, category);
  const readCap = samples > 0 ? samples + offset : 0;
  const audioFiles = (await collectAudioFiles(datasetDir, readCap, recursive)).sort((a, b) =>
    a.localeCompare(b, 'vi')
  );
  const pickedFiles =
    samples > 0 ? audioFiles.slice(offset, offset + samples) : audioFiles.slice(offset);
  if (!pickedFiles.length) {
    throw new Error(`Khong tim thay file audio trong: ${datasetDir}`);
  }

  const endpointRaw = env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT_PRODUCT || env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT;
  const endpoint = endpointRaw
    ? String(endpointRaw).replace(/\/?$/, '').replace(/\/v1\/metrics\/?$/, '') + '/v1/metrics'
    : null;
  const traceEndpoint = endpointRaw
    ? String(endpointRaw).replace(/\/?$/, '').replace(/\/v1\/traces\/?$/, '') + '/v1/traces'
    : null;
  const headers = parseHeaders(env.VITE_OTEL_EXPORTER_OTLP_HEADERS);

  let meterProvider = null;
  let reader = null;
  let cPreview = null;
  let cAccepted = null;
  let cCancelled = null;
  let cParsedItems = null;
  let cMatchedItems = null;
  let hConfidence = null;
  let hParseLatency = null;
  let hMatchLatency = null;
  let hTotalLatency = null;
  let hApiLatency = null;
  let cApiError = null;
  let cEmptyTranscript = null;
  let cSyntheticBillCreated = null;
  let cSyntheticBillCreateError = null;
  let cFileTotal = null;
  let cFileParseEmpty = null;
  let cFileParseNonEmpty = null;
  let cFileMatchZero = null;
  let tracerProvider = null;
  let tracer = null;

  if (enableExport) {
    if (!endpoint || endpoint.startsWith('/')) {
      throw new Error(
        'Endpoint OTLP khong hop le de export tu Node. Hay set VITE_OTEL_EXPORTER_OTLP_ENDPOINT_PRODUCT la URL day du.'
      );
    }
    const exporter = new OTLPMetricExporter({ url: endpoint, headers });
    reader = new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 5000,
    });
    meterProvider = new MeterProvider({ readers: [reader] });
    const meter = meterProvider.getMeter('manage-bill-voice-dataset-test', '1.0.0');

    cPreview = meter.createCounter('voice_order_preview_total');
    cAccepted = meter.createCounter('voice_order_accepted_total');
    cCancelled = meter.createCounter('voice_order_cancelled_total');
    cParsedItems = meter.createCounter('voice_order_parsed_items_total');
    cMatchedItems = meter.createCounter('voice_order_matched_items_total');
    hConfidence = meter.createHistogram('voice_order_match_confidence', { unit: '1' });
    hApiLatency = meter.createHistogram('voice_order_api_latency_ms', { unit: 'ms' });
    hParseLatency = meter.createHistogram('voice_order_parse_latency_ms', { unit: 'ms' });
    hMatchLatency = meter.createHistogram('voice_order_match_latency_ms', { unit: 'ms' });
    hTotalLatency = meter.createHistogram('voice_order_total_processing_latency_ms', { unit: 'ms' });
    cApiError = meter.createCounter('voice_test_api_error_total');
    cEmptyTranscript = meter.createCounter('voice_test_empty_transcript_total');
    cSyntheticBillCreated = meter.createCounter('voice_test_synthetic_bill_created_total');
    cSyntheticBillCreateError = meter.createCounter('voice_test_synthetic_bill_create_error_total');
    cFileTotal = meter.createCounter('voice_test_file_total');
    cFileParseEmpty = meter.createCounter('voice_test_file_parse_empty_total');
    cFileParseNonEmpty = meter.createCounter('voice_test_file_parse_nonempty_total');
    cFileMatchZero = meter.createCounter('voice_test_file_match_zero_total');
  }

  if (enableTrace) {
    if (!traceEndpoint || traceEndpoint.startsWith('/')) {
      throw new Error(
        'Endpoint OTLP trace khong hop le. Hay set VITE_OTEL_EXPORTER_OTLP_ENDPOINT_PRODUCT la URL day du.'
      );
    }
    const traceExporter = new OTLPTraceExporter({ url: traceEndpoint, headers });
    tracerProvider = new BasicTracerProvider({
      spanProcessors: [new BatchSpanProcessor(traceExporter)]
    });
    trace.setGlobalTracerProvider(tracerProvider);
    tracer = trace.getTracer('manage-bill-voice-dataset-test', '1.0.0');
  }

  const stats = {
    files: pickedFiles.length,
    parsedItems: 0,
    matchedItems: 0,
    accepted: 0,
    cancelled: 0,
    filesNoParsed: 0,
    filesNoMatched: 0,
    apiErrors: 0,
    emptyTranscript: 0,
    billCreated: 0,
    billCreateErrors: 0,
  };

  console.log('=== VOICE METRIC TEST ===');
  console.log(`Env: ${envPath}`);
  console.log(`Firebase project: ${env.VITE_FIREBASE_PROJECT_ID}`);
  console.log(`Dataset (audio only): ${datasetDir}`);
  console.log(`Recursive scan: ${recursive ? 'YES' : 'NO'}`);
  console.log(`Offset: ${offset}`);
  console.log(`Samples: ${samples > 0 ? samples : 'ALL'}`);
  console.log(`Files selected: ${pickedFiles.length}/${audioFiles.length}`);
  console.log(`Category context: ${category}`);
  console.log(`Metrics source label: ${metricsSource}`);
  console.log(`Run ID: ${runId}`);
  console.log(`Transcribe API: ${transcribeUrl}`);
  console.log(`Request timeout: ${timeoutMs}ms`);
  console.log(`Create bill when accepted: ${createBill ? 'YES' : 'NO'}`);
  console.log(`Auto paid for synthetic bill: ${autoPaid ? 'YES' : 'NO'}`);
  console.log(`Acceptance rule: matched>=${acceptMinMatched}, match_rate>=${acceptMinMatchRate}, avg_confidence>=${acceptMinAvgConfidence}`);
  console.log(`Export metrics: ${enableExport ? 'YES' : 'NO (dry-run summary)'}`);
  console.log(`Trace export: ${enableTrace ? 'YES' : 'NO'}`);
  console.log(`Event logs: ${logEvents ? 'YES' : 'NO'}`);
  if (enableExport) {
    console.log(`OTLP endpoint: ${endpoint}`);
  }
  if (enableTrace) {
    console.log(`OTLP trace endpoint: ${traceEndpoint}`);
  }
  console.log('');

  for (const filePath of pickedFiles) {
    cFileTotal?.add(1, withSource(metricsSource, { category }));
    const sampleId = path.basename(filePath);
    const sampleSpan = tracer?.startSpan('voice_test.sample', {
      attributes: {
        run_id: runId,
        sample_id: sampleId,
        source: metricsSource,
        category_context: category
      }
    });
    const spanCtx = sampleSpan ? trace.setSpan(context.active(), sampleSpan) : context.active();
    const totalStart = performance.now();
    cPreview?.add(1, withSource(metricsSource));
    emitEvent(logEvents, {
      run_id: runId,
      sample_id: sampleId,
      stage: 'sample_start',
      status: 'ok',
      source: metricsSource
    });

    let transcript = '';
    try {
      const apiSpan = tracer?.startSpan(
        'voice_test.api_transcribe',
        { attributes: { run_id: runId, sample_id: sampleId } },
        spanCtx
      );
      const ext = path.extname(filePath).toLowerCase();
      const mimeByExt = {
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.webm': 'audio/webm',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
      };
      const mimeType = mimeByExt[ext] || 'application/octet-stream';
      const audioBuffer = await fs.readFile(filePath);
      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer], { type: mimeType }), path.basename(filePath));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const apiStart = performance.now();
      const response = await fetch(transcribeUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const apiMs = performance.now() - apiStart;
      hApiLatency?.record(apiMs, withSource(metricsSource));

      if (!response.ok) {
        cApiError?.add(1, withSource(metricsSource, { status_code: String(response.status) }));
        stats.apiErrors += 1;
        cCancelled?.add(1, withSource(metricsSource));
        stats.cancelled += 1;
        apiSpan?.setStatus({ code: SpanStatusCode.ERROR, message: `http_${response.status}` });
        apiSpan?.setAttribute('reason_code', 'api_error');
        apiSpan?.end();
        sampleSpan?.setStatus({ code: SpanStatusCode.ERROR, message: 'api_error' });
        sampleSpan?.setAttribute('reason_code', 'api_error');
        sampleSpan?.setAttribute('cancelled', true);
        sampleSpan?.end();
        emitEvent(logEvents, {
          run_id: runId,
          sample_id: sampleId,
          stage: 'api',
          status: 'fail',
          reason_code: 'api_error',
          http_status: response.status,
          source: metricsSource
        });
        continue;
      }

      const data = await response.json().catch(() => ({}));
      transcript = String(data.text || '').trim();
      if (!transcript) {
        cEmptyTranscript?.add(1, withSource(metricsSource));
        stats.emptyTranscript += 1;
        cCancelled?.add(1, withSource(metricsSource));
        stats.cancelled += 1;
        apiSpan?.setStatus({ code: SpanStatusCode.ERROR, message: 'empty_transcript' });
        apiSpan?.setAttribute('reason_code', 'empty_transcript');
        apiSpan?.end();
        sampleSpan?.setStatus({ code: SpanStatusCode.ERROR, message: 'empty_transcript' });
        sampleSpan?.setAttribute('reason_code', 'empty_transcript');
        sampleSpan?.setAttribute('cancelled', true);
        sampleSpan?.end();
        emitEvent(logEvents, {
          run_id: runId,
          sample_id: sampleId,
          stage: 'api',
          status: 'fail',
          reason_code: 'empty_transcript',
          source: metricsSource
        });
        continue;
      }
      apiSpan?.setAttribute('transcript_length', transcript.length);
      apiSpan?.end();
    } catch (err) {
      cApiError?.add(
        1,
        withSource(metricsSource, { status_code: err?.name === 'AbortError' ? 'timeout' : 'network_or_parse' })
      );
      stats.apiErrors += 1;
      cCancelled?.add(1, withSource(metricsSource));
      stats.cancelled += 1;
      sampleSpan?.setStatus({ code: SpanStatusCode.ERROR, message: err?.message || 'api_exception' });
      sampleSpan?.setAttribute('reason_code', err?.name === 'AbortError' ? 'timeout' : 'api_exception');
      sampleSpan?.setAttribute('cancelled', true);
      sampleSpan?.end();
      emitEvent(logEvents, {
        run_id: runId,
        sample_id: sampleId,
        stage: 'api',
        status: 'fail',
        reason_code: err?.name === 'AbortError' ? 'timeout' : 'api_exception',
        source: metricsSource
      });
      continue;
    }

    const parseSpan = tracer?.startSpan(
      'voice_test.parse',
      { attributes: { run_id: runId, sample_id: sampleId } },
      spanCtx
    );
    const parseStart = performance.now();
    const parsed = parseVoiceOrder(transcript);
    const parseMs = performance.now() - parseStart;
    hParseLatency?.record(parseMs, withSource(metricsSource));
    parseSpan?.setAttribute('duration_ms', parseMs);
    parseSpan?.setAttribute('parsed_count', parsed.length);
    parseSpan?.end();

    if (!parsed.length) {
      stats.filesNoParsed += 1;
      cFileParseEmpty?.add(1, withSource(metricsSource, { category, reason_code: 'parse_empty' }));
      cCancelled?.add(1, withSource(metricsSource));
      stats.cancelled += 1;
      sampleSpan?.setStatus({ code: SpanStatusCode.ERROR, message: 'parse_empty' });
      sampleSpan?.setAttribute('reason_code', 'parse_empty');
      sampleSpan?.setAttribute('cancelled', true);
      sampleSpan?.end();
      emitEvent(logEvents, {
        run_id: runId,
        sample_id: sampleId,
        stage: 'parse',
        status: 'fail',
        reason_code: 'parse_empty',
        source: metricsSource
      });
      continue;
    }

    cFileParseNonEmpty?.add(1, withSource(metricsSource, { category }));
    cParsedItems?.add(parsed.length, withSource(metricsSource));
    stats.parsedItems += parsed.length;

    const matchSpan = tracer?.startSpan(
      'voice_test.match',
      { attributes: { run_id: runId, sample_id: sampleId } },
      spanCtx
    );
    const matchStart = performance.now();
    let matchedCountThisFile = 0;
    let confidenceSum = 0;
    const matchedOrderItems = [];
    for (const item of parsed) {
      const match = matcher(item.dishName);
      if (match && match.menuItem && match.confidence >= 0.5) {
        matchedCountThisFile += 1;
        confidenceSum += Number(match.confidence) || 0;
        matchedOrderItems.push({
          orderItemId: String(match.menuItem.id),
          quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
          confidence: Number(match.confidence) || 0,
        });
        cMatchedItems?.add(1, withSource(metricsSource, { menu_item_id: String(match.menuItem.id) }));
        hConfidence?.record(Number(match.confidence) || 0, withSource(metricsSource));
      }
    }
    const matchMs = performance.now() - matchStart;
    hMatchLatency?.record(matchMs, withSource(metricsSource));
    hTotalLatency?.record(performance.now() - totalStart, withSource(metricsSource));
    matchSpan?.setAttribute('duration_ms', matchMs);
    matchSpan?.setAttribute('matched_count', matchedCountThisFile);
    matchSpan?.end();

    stats.matchedItems += matchedCountThisFile;
    const parsedCount = parsed.length;
    const matchRateThisFile = parsedCount > 0 ? matchedCountThisFile / parsedCount : 0;
    const avgConfidenceThisFile = matchedCountThisFile > 0 ? confidenceSum / matchedCountThisFile : 0;
    const accepted =
      matchedCountThisFile >= acceptMinMatched &&
      matchRateThisFile >= acceptMinMatchRate &&
      avgConfidenceThisFile >= acceptMinAvgConfidence;

    const decisionSpan = tracer?.startSpan(
      'voice_test.acceptance_decision',
      { attributes: { run_id: runId, sample_id: sampleId } },
      spanCtx
    );
    decisionSpan?.setAttribute('matched_count', matchedCountThisFile);
    decisionSpan?.setAttribute('parsed_count', parsedCount);
    decisionSpan?.setAttribute('match_rate', matchRateThisFile);
    decisionSpan?.setAttribute('avg_confidence', avgConfidenceThisFile);
    decisionSpan?.setAttribute('accepted', accepted);
    decisionSpan?.end();

    if (accepted) {
      cAccepted?.add(1, withSource(metricsSource));
      stats.accepted += 1;
      sampleSpan?.setAttribute('accepted', true);

      if (createBill) {
        try {
          const createBillSpan = tracer?.startSpan(
            'voice_test.create_bill',
            { attributes: { run_id: runId, sample_id: sampleId } },
            spanCtx
          );
          const grouped = new Map();
          for (const m of matchedOrderItems) {
            const current = grouped.get(m.orderItemId) || 0;
            grouped.set(m.orderItemId, current + m.quantity);
          }
          const billItems = Array.from(grouped.entries()).map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity,
          }));

          let totalRevenue = 0;
          let totalCost = 0;
          let totalFixedCost = 0;
          let totalProfit = 0;
          for (const item of billItems) {
            const oi = orderItemById.get(item.orderItemId);
            if (!oi) continue;
            const menuParent = oi.parentMenuItemId ? menuItemById.get(String(oi.parentMenuItemId)) : null;
            const price = Number(oi.price ?? menuParent?.price ?? 0);
            const costPrice = Number(oi.costPrice ?? menuParent?.costPrice ?? 0);
            const fixedCost = Number(oi.fixedCost ?? menuParent?.fixedCost ?? 0);
            const tax = Number(oi.tax ?? menuParent?.tax ?? 0);
            const qty = Number(item.quantity) || 0;
            const revenue = price * qty;
            const profitPerItem = price - costPrice - fixedCost - (price * tax / 100);
            totalRevenue += revenue;
            totalCost += costPrice * qty;
            totalFixedCost += fixedCost * qty;
            totalProfit += profitPerItem * qty;
          }

          const now = new Date();
          const dateString = now.toISOString().split('T')[0];
          await addDoc(collection(db, 'bills'), {
            createdAt: serverTimestamp(),
            date: dateString,
            tableNumber: tableNumberStart + stats.billCreated,
            status: autoPaid ? 'paid' : 'pending',
            isSyntheticTest: true,
            source: metricsSource,
            runId,
            categoryContext: category,
            acceptance: {
              matchRate: matchRateThisFile,
              avgConfidence: avgConfidenceThisFile,
              parsedCount,
              matchedCount: matchedCountThisFile,
              acceptMinMatched,
              acceptMinMatchRate,
              acceptMinAvgConfidence,
            },
            transcriptLength: transcript.length,
            audioSampleId: path.basename(filePath),
            items: billItems,
            totalRevenue,
            totalProfit,
            totalCost,
            totalFixedCost,
          });
          stats.billCreated += 1;
          cSyntheticBillCreated?.add(1, withSource(metricsSource));
          createBillSpan?.setAttribute('bill_created', true);
          createBillSpan?.end();
        } catch (err) {
          stats.billCreateErrors += 1;
          cSyntheticBillCreateError?.add(1, withSource(metricsSource));
          sampleSpan?.setStatus({ code: SpanStatusCode.ERROR, message: 'create_bill_error' });
          sampleSpan?.setAttribute('reason_code', 'create_bill_error');
          emitEvent(logEvents, {
            run_id: runId,
            sample_id: sampleId,
            stage: 'create_bill',
            status: 'fail',
            reason_code: 'create_bill_error',
            source: metricsSource
          });
        }
      }
      emitEvent(logEvents, {
        run_id: runId,
        sample_id: sampleId,
        stage: 'final',
        status: 'ok',
        accepted: true,
        parsed_count: parsedCount,
        matched_count: matchedCountThisFile,
        avg_confidence: avgConfidenceThisFile,
        match_rate: matchRateThisFile,
        source: metricsSource
      });
    } else {
      cFileMatchZero?.add(1, withSource(metricsSource, { category }));
      cCancelled?.add(1, withSource(metricsSource));
      stats.cancelled += 1;
      stats.filesNoMatched += 1;
      sampleSpan?.setStatus({ code: SpanStatusCode.ERROR, message: 'rejected_by_threshold' });
      sampleSpan?.setAttribute('reason_code', 'rejected_by_threshold');
      sampleSpan?.setAttribute('accepted', false);
      emitEvent(logEvents, {
        run_id: runId,
        sample_id: sampleId,
        stage: 'final',
        status: 'fail',
        reason_code: 'rejected_by_threshold',
        parsed_count: parsedCount,
        matched_count: matchedCountThisFile,
        avg_confidence: avgConfidenceThisFile,
        match_rate: matchRateThisFile,
        source: metricsSource
      });
    }

    sampleSpan?.setAttribute('parsed_count', parsedCount);
    sampleSpan?.setAttribute('matched_count', matchedCountThisFile);
    sampleSpan?.setAttribute('avg_confidence', avgConfidenceThisFile);
    sampleSpan?.setAttribute('match_rate', matchRateThisFile);
    sampleSpan?.end();
  }

  if (enableExport && meterProvider) {
    if (reader?.forceFlush) {
      await reader.forceFlush();
    }
    if (meterProvider.forceFlush) {
      await meterProvider.forceFlush();
    }
    if (meterProvider.shutdown) {
      await meterProvider.shutdown();
    }
  }

  if (tracerProvider) {
    await tracerProvider.shutdown();
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log(`files: ${stats.files}`);
  console.log(`parsed_items_total: ${stats.parsedItems}`);
  console.log(`matched_items_total: ${stats.matchedItems}`);
  console.log(`accepted_total: ${stats.accepted}`);
  console.log(`cancelled_total: ${stats.cancelled}`);
  console.log(`files_no_parsed: ${stats.filesNoParsed}`);
  console.log(`files_no_matched: ${stats.filesNoMatched}`);
  console.log(`api_errors_total: ${stats.apiErrors}`);
  console.log(`empty_transcript_total: ${stats.emptyTranscript}`);
  console.log(`synthetic_bill_created_total: ${stats.billCreated}`);
  console.log(`synthetic_bill_create_error_total: ${stats.billCreateErrors}`);
  console.log(
    `match_rate: ${stats.parsedItems > 0 ? (stats.matchedItems / stats.parsedItems).toFixed(4) : '0.0000'}`
  );

  process.exit(0);
}

main().catch((err) => {
  console.error('Script loi:', err.message);
  process.exit(1);
});
