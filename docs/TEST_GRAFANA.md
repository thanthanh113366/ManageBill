```bash
# Dùng các lệnh này (PowerShell, đứng ở F:\QuanOc\ManageBill):
# Luu y: Script chay ONLINE mode duy nhat (goi VITE_BACKEND_API_URL/transcribe tu file audio)

# 1) Chạy chính (online + export metrics + tách source)
node "scripts/test-voice-metrics-from-dataset.js" --dataset "F:\Nam_3\NhandangMLops\data-voice-vietnamese-restaurant\dataset_output" --env ".env.development.local" --samples 50 --timeout-ms 45000 --export --source "voice_dataset_online_test"

# 2) Chạy gần thực tế: accepted theo rule + tạo bill test khi accepted
node "scripts/test-voice-metrics-from-dataset.js" --dataset "F:\Nam_3\NhandangMLops\data-voice-vietnamese-restaurant\dataset_output" --env ".env.development.local" --samples 50 --create-bill --auto-paid --accept-min-matched 1 --accept-min-match-rate 0.6 --accept-min-avg-confidence 0.55 --export --source "voice_dataset_online_test"

# 2.1) Chạy có trace + JSON event log để truy bug theo sample
node "scripts/test-voice-metrics-from-dataset.js" --dataset "F:\Nam_3\NhandangMLops\data-voice-vietnamese-restaurant\dataset_output" --env ".env.development.local" --samples 50 --timeout-ms 45000 --export --trace --log-events --run-id "run_voice_20260420" --source "voice_dataset_online_test"

# 3) Chạy nhanh để smoke test
node "scripts/test-voice-metrics-from-dataset.js" --dataset "F:\Nam_3\NhandangMLops\data-voice-vietnamese-restaurant\dataset_output" --env ".env.development.local" --samples 5 --source "voice_dataset_online_test"
```

## Logic accepted/cancelled (gan thuc te)

- `accepted` khi dong thoi dat tat ca dieu kien:
  - `matched_count >= accept_min_matched` (mac dinh `1`)
  - `match_rate = matched_count / parsed_count >= accept_min_match_rate` (mac dinh `0.6`)
  - `avg_confidence >= accept_min_avg_confidence` (mac dinh `0.55`)
- `cancelled` khi thieu bat ky dieu kien nao o tren, hoac API loi, hoac transcript rong, hoac parse ra 0 item.

## Logic tao don hang test

- Chi tao bill khi co flag `--create-bill` va file duoc `accepted`.
- Neu them `--auto-paid` (kem `--create-bill`) thi bill test tao ra se co `status: "paid"`.
- Bill tao vao collection `bills` voi:
  - `isSyntheticTest: true`
  - `source`: bang gia tri cua `--source`
  - `runId`: theo `--run-id` (neu co)
  - `audioSampleId`: ten file audio
  - `tableNumber`: bat dau tu `--table-number-start` (mac dinh `9000`)
  - `items`: luu theo `orderItemId` (khong dung `menuItemId`)
- Gia tri tong (`totalRevenue`, `totalCost`, `totalFixedCost`, `totalProfit`) tinh tu `orderItems` va fallback `menuItems` cha.

## Metrics can co cho test + alert

- `voice_test_run_total` (Counter)  
Label: `run_id`, `dataset`, `env`
- `voice_test_file_total` (Counter)  
Label: `run_id`, `category`
- `voice_test_file_parse_empty_total` (Counter)  
Label: `run_id`, `category`, `reason_code`
- `voice_test_file_parse_nonempty_total` (Counter)  
Label: `run_id`, `category`
- `voice_test_parsed_items_total` (Counter)  
Label: `run_id`, `category`
- `voice_test_matched_items_total` (Counter)  
Label: `run_id`, `category`
- `voice_test_file_match_zero_total` (Counter)  
Label: `run_id`, `category`
- `voice_test_file_accepted_total` (Counter)  
Label: `run_id`, `category`
- `voice_test_file_cancelled_total` (Counter)  
Label: `run_id`, `category`, `cancel_reason`
- `voice_order_api_latency_ms` (Histogram)  
Label: `run_id`, `category`
- `voice_test_api_error_total` (Counter)  
Label: `run_id`, `status_code`
- `voice_test_empty_transcript_total` (Counter)  
Label: `run_id`
- `voice_test_parse_latency_ms` (Histogram)  
Label: `run_id`, `category`
- `voice_test_match_latency_ms` (Histogram)  
Label: `run_id`, `category`
- `voice_test_total_latency_ms` (Histogram)  
Label: `run_id`, `category`
- `voice_test_match_confidence` (Histogram)  
Label: `run_id`, `category`
- `voice_test_match_below_threshold_total` (Counter)  
Label: `run_id`, `category`, `threshold`
- `voice_test_error_total` (Counter)  
Label: `run_id`, `stage`, `error_code`

## Log/Trace fields bat buoc de debug tung sample

- `run_id`
- `sample_id` (ten file hoac hash)
- `stage` (`read|parse|match|final`)
- `stage` (`api|parse|match|final`)
- `status` (`ok|fail`)
- `reason_code` (`parse_empty|match_zero|exception|...`)
- `parsed_count`
- `matched_count`
- `top_match_name`
- `top_match_confidence`
- `duration_ms`
- `category_context`
- `env`
- `project_id`

## KPI truy van nhanh tren Grafana

- Parse fail rate = `voice_test_file_parse_empty_total / voice_test_file_total`
- Match success rate = `voice_test_matched_items_total / voice_test_parsed_items_total`
- End-to-end acceptance = `voice_test_file_accepted_total / voice_test_file_total`
- API error rate = `voice_test_api_error_total / voice_test_file_total`

## Trace status

- Script da co the gui OpenTelemetry spans khi bat `--trace`.
- De truy bug theo sample, dung them `--log-events --run-id "<ten_run>"` de co JSON event logs.
- Span stages hien co: `voice_test.sample`, `voice_test.api_transcribe`, `voice_test.parse`, `voice_test.match`, `voice_test.acceptance_decision`, `voice_test.create_bill`.

## Luu y cardinality

- Khong dua transcript raw vao metric label.
- `sample_id` nen de o logs/traces, khong de o metrics.
- Chuan hoa `reason_code` thanh tap gia tri co dinh de tranh no series.

## Tach UI va script theo source (1 stack Grafana)

- UI app that: dat `VITE_METRICS_SOURCE=app_ui` trong env cua app/web.
- Script test: dung `--source "voice_dataset_online_test"` khi chay script.
- Mau query:
  - UI: `sum(increase(voice_order_accepted_total{source="app_ui"}[15m]))`
  - Script: `sum(increase(voice_order_accepted_total{source="voice_dataset_online_test"}[15m]))`

