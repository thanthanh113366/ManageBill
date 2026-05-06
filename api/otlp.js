const DEFAULT_TIMEOUT_MS = 5000;

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' });
  }

  const enabled = process.env.METRICS_PROXY_ENABLED ?? 'true';
  if (String(enabled).toLowerCase() !== 'true') {
    return json(503, { error: 'metrics_proxy_disabled' });
  }

  const upstreamUrl = process.env.GRAFANA_OTLP_URL;
  const upstreamAuth = process.env.GRAFANA_OTLP_AUTH;
  if (!upstreamUrl || !upstreamAuth) {
    return json(500, { error: 'metrics_proxy_not_configured' });
  }

  let bodyBuffer;
  try {
    bodyBuffer = await request.arrayBuffer();
  } catch {
    return json(400, { error: 'invalid_request_body' });
  }

  const timeoutMs = Number(process.env.METRICS_PROXY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

  try {
    const upstreamResp = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        authorization: upstreamAuth,
        'content-type': request.headers.get('content-type') || 'application/json'
      },
      body: bodyBuffer,
      signal: controller.signal
    });

    if (!upstreamResp.ok) {
      return json(502, {
        error: 'upstream_error',
        status: upstreamResp.status
      });
    }

    return json(202, { ok: true });
  } catch (error) {
    const isTimeout = error?.name === 'AbortError';
    return json(isTimeout ? 504 : 502, {
      error: isTimeout ? 'upstream_timeout' : 'upstream_request_failed'
    });
  } finally {
    clearTimeout(timer);
  }
}
