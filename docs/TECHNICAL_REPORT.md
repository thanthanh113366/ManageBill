# Báo cáo Kỹ thuật: Hệ thống Quản lý Đơn hàng Quán Ốc

**Phiên bản:** 1.0.0  
**Ngày:** Tháng 3, 2026  
**Công nghệ chính:** React 18 · Firebase Firestore · Whisper ASR · OpenTelemetry · Grafana Cloud  

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Mô tả tính năng chi tiết](#3-mô-tả-tính-năng-chi-tiết)
4. [Tính năng Voice Order và hệ thống đánh giá metrics](#4-tính-năng-voice-order-và-hệ-thống-đánh-giá-metrics)
5. [Bảo mật](#5-bảo-mật)
6. [Triển khai](#6-triển-khai)
7. [Hiệu năng và tối ưu](#7-hiệu-năng-và-tối-ưu)
8. [Kết quả đạt được, hạn chế và hướng phát triển](#8-kết-quả-đạt-được-hạn-chế-và-hướng-phát-triển)

---

## 1. Tổng quan dự án

### 1.1 Mục tiêu

Xây dựng ứng dụng web quản lý đơn hàng cho quán ốc nhỏ, cho phép nhân viên:

- **Tạo đơn hàng** nhanh chóng bằng giao diện chọn món hoặc **giọng nói** (voice order).
- **Quản lý menu** (CRUD) với thông tin giá bán, giá vốn, chi phí cố định, thuế.
- **Theo dõi doanh thu và lợi nhuận** theo ngày/tuần/tháng.
- **Phân tích món ăn** (món bán chạy, lợi nhuận theo món).
- **Chia sẻ hóa đơn** công khai cho khách hàng qua QR code.
- **Thu thập metrics** về chất lượng Voice Order qua OpenTelemetry lên Grafana Cloud.

### 1.2 Phạm vi

| Phạm vi | Chi tiết |
|---------|----------|
| Người dùng | Nhân viên quán (1 tài khoản duy nhất, bảo vệ bằng password) |
| Thiết bị | Mobile-first, tương thích desktop |
| Dữ liệu | Lưu trữ hoàn toàn trên Firebase Firestore (realtime) |
| Observability | Voice order metrics gửi lên Grafana Cloud qua OTLP/HTTP |

### 1.3 Stack công nghệ

| Lớp | Công nghệ | Phiên bản |
|-----|-----------|-----------|
| **Frontend** | React | 18.2.0 |
| **Build tool** | Vite | 5.0.8 |
| **Styling** | Tailwind CSS | 3.3.6 |
| **Routing** | React Router DOM | 6.20.1 |
| **Database** | Firebase Firestore | 10.7.1 |
| **Form validation** | React Hook Form + Yup | 7.48.2 / 1.3.3 |
| **Charts** | Recharts | 2.8.0 |
| **Icons** | Lucide React | 0.294.0 |
| **Toast** | React Toastify | 9.1.3 |
| **Fuzzy matching** | Fuse.js | 7.1.0 |
| **QR code** | react-qr-code + qrcode | 2.0.16 / 1.5.4 |
| **ASR backend** | Whisper (self-hosted hoặc API) | — |
| **Metrics SDK** | OpenTelemetry SDK Metrics | 2.6.0 |
| **OTLP exporter** | @opentelemetry/exporter-metrics-otlp-http | 0.213.0 |
| **Observability** | Grafana Cloud (Prometheus/Mimir) | — |
| **Deploy** | Vercel | — |

---

## 2. Kiến trúc hệ thống

### 2.1 Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────┐
│                  Browser (React SPA)             │
│                                                 │
│  ┌────────────┐   ┌──────────────────────────┐  │
│  │  Protected  │   │      Public Routes        │  │
│  │   Routes   │   │  /bill/:table (read-only) │  │
│  │  (auth)    │   │  /order/:table            │  │
│  └─────┬──────┘   └──────────────┬────────────┘  │
│        │                         │               │
│  ┌─────▼──────────────────────────▼────────────┐  │
│  │            Firebase Firestore               │  │
│  │  collections: bills, menuItems, tables      │  │
│  └─────────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │        Voice Order Pipeline              │   │
│  │  Mic → Whisper API → Parser → Matcher    │   │
│  │              ↓                           │   │
│  │        OTel Metrics → /api/otlp (proxy)  │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
          │ /api/otlp                │ Firebase SDK
          ▼                         ▼
 ┌─────────────────┐      ┌──────────────────────┐
 │ Vercel Function │      │  Firebase Firestore   │
 │ (server-side    │      │  (Google Cloud)       │
 │  auth inject)   │      └──────────────────────┘
 └────────┬────────┘
          │
          ▼
 ┌─────────────────────────────┐
 │ Grafana Cloud OTLP Gateway  │
 │ Prometheus/Mimir storage    │
 │ → Dashboard / Explore       │
 └─────────────────────────────┘
```

### 2.2 Cấu trúc thư mục

```
src/
├── components/
│   ├── VoiceOrderButton.jsx    # UI + pipeline voice order
│   ├── Layout.jsx              # Navigation shell
│   ├── PasswordGate.jsx        # Auth gate
│   ├── CustomItemForm.jsx      # Thêm món tự do
│   ├── EditBill.jsx            # Sửa đơn hàng
│   └── ...                     # Charts, QR, Kitchen
├── pages/
│   ├── CreateBill.jsx          # Trang tạo đơn (chính)
│   ├── MenuManagement.jsx      # CRUD menu
│   ├── BillManagement.jsx      # Quản lý đơn hàng
│   ├── Reports.jsx             # Báo cáo doanh thu
│   ├── DishAnalysis.jsx        # Phân tích món ăn
│   ├── PublicBill.jsx          # Xem hóa đơn (public)
│   └── CustomerOrder.jsx       # Đặt món (khách)
├── utils/
│   ├── voiceParser.js          # Parse giọng nói → structured items
│   ├── menuMatcher.js          # Fuzzy match tên món vào menu
│   └── voiceOrderMetrics.js    # OpenTelemetry metrics init + record
├── hooks/
│   └── useBackendWhisperRecognition.js  # Audio recording + Whisper API
├── context/
│   └── AppContext.jsx          # Global state (menu, tables, auth)
├── config/
│   └── firebase.js             # Firebase init
└── main.jsx                    # App entry, init metrics
api/
└── otlp/v1/metrics.js          # Vercel Function – OTLP proxy
```

### 2.3 Luồng dữ liệu chính

```
[Nhân viên chọn món] ──→ setQuantities ──→ billSummary (useMemo)
                                               │
                                               ▼
                                    [Submit] → addDoc(Firestore)
                                               │
                                               ▼
                               onSnapshot → BillManagement realtime
```

```
[Voice Order Flow]
Bấm "Nói đơn"
  → startListening() [MediaRecorder, ghi audio PCM]
  → stopListening() [upload blob → Whisper Backend API]
  → handleResult(transcript: string)
  → parseVoiceOrder(transcript)         [voiceParser.js]
  → createMenuMatcher()(dishName)       [menuMatcher.js – Fuse.js]
  → setPreviewData + setShowPreview(true)
  → emit: recordPreview(), recordParsedItems(n), recordMatchedItem(), recordMatchConfidence()
  → [User bấm Xác nhận] → onItemsMatched(matchedItems) + recordAccepted()
     hoặc [User bấm Hủy] → recordCancelled()
```

---

## 3. Mô tả tính năng chi tiết

### 3.1 Xác thực (Password Gate)

Hệ thống dùng một mật khẩu duy nhất (`VITE_ADMIN_PASSWORD`) để bảo vệ toàn bộ route quản lý. Sau khi xác thực thành công, trạng thái được lưu trong `sessionStorage` để không yêu cầu đăng nhập lại trong cùng phiên làm việc. Không dùng Firebase Authentication (do quy mô nhỏ, một người dùng).

### 3.2 Quản lý Menu (CRUD)

Mỗi menu item có cấu trúc:

```js
{
  name: string,
  price: number,       // Giá bán
  costPrice: number,   // Giá vốn
  fixedCost: number,   // Chi phí cố định
  tax: number,         // Thuế (%)
  category: string     // 'oc' | 'an_no' | 'an_choi' | 'lai_rai' | 'giai_khat'
}
```

Công thức lợi nhuận:

```
profitPerItem = price - costPrice - fixedCost - (price × tax / 100)
```

Validation dùng React Hook Form + Yup schema (required fields, min value, number type).

### 3.3 Tạo đơn hàng

- Giao diện chia tab theo category, mỗi món có nút `+` / `-` và input số lượng trực tiếp.
- Hỗ trợ thêm **"Món khác"** (custom item) với mô tả tự do và số tiền (có thể âm để giảm giá).
- `billSummary` được tính bằng `useMemo` để tránh re-render không cần thiết.
- Khi submit: tạo document mới trong collection `bills` với `serverTimestamp()`.

### 3.4 Quản lý đơn hàng

- Load đơn hàng theo ngày (`selectedDate`) qua `onSnapshot` (realtime).
- Sắp xếp: đơn `pending` lên trước, trong cùng nhóm sắp xếp theo thời gian giảm dần.
- Hỗ trợ đánh dấu thanh toán, xem chi tiết, sửa đơn.

### 3.5 Báo cáo và phân tích

| Module | Nội dung |
|--------|----------|
| **Reports** | Doanh thu, lợi nhuận theo ngày/tuần/tháng. Biểu đồ line chart (Recharts). |
| **DishAnalysis** | Phân tích theo món: số lượng bán, doanh thu, lợi nhuận. Bar chart + table. |

### 3.6 Hóa đơn công khai và QR Code

- Route `/bill/:tableNumber` không yêu cầu auth → nhân viên có thể chia sẻ cho khách.
- Route `/order/:tableNumber` cho phép khách tự gọi món (customer-facing).
- `QRCodeManager` sinh QR code cho từng bàn, có thể in hoặc hiển thị trên màn hình.

---

## 4. Tính năng Voice Order và hệ thống đánh giá metrics

### 4.1 Kiến trúc Voice Order Pipeline

```
Audio capture (MediaRecorder API)
         │
         ▼ audio/webm blob
Backend Whisper API (VITE_BACKEND_API_URL)
         │
         ▼ transcript: string (tiếng Việt)
voiceParser.js  ──  parseVoiceOrder(text)
         │
         ▼ [{dishName, quantity}, ...]
menuMatcher.js  ──  createMenuMatcher()(dishName)
         │
         ▼ [{menuItemId, name, quantity, confidence}, ...]
Preview Modal (confirm / cancel)
         │
         ▼
onItemsMatched(matchedItems) → setQuantities (ghi đè)
```

### 4.2 voiceParser.js – Custom Regex Parser

Parser hỗ trợ tiếng Việt với hai pattern chính:

| Pattern | Ví dụ |
|---------|-------|
| `[Số] phần [Tên món]` | `"1 phần ốc hương"` |
| `[Tên món] [Số] phần` | `"ốc len 2 phần"` |

Đặc điểm kỹ thuật:
- **Tiền xử lý (cleanText):** loại noise words (`ạ`, `nhé`, `ơi`, …), chuẩn hóa dấu câu.
- **Số tiếng Việt:** map từ điển `một→1`, `hai→2`, … `hai mươi→20`.
- **Giới hạn iteration:** tránh infinite loop (`maxIterations = 100`).
- **Fallback pattern:** nếu pattern chính không match, thử lại với regex đơn giản hơn.
- **Dedup:** loại trùng lặp theo key `dishName_quantity`.

### 4.3 menuMatcher.js – Fuzzy Matching với Fuse.js

```js
const allItemsFuse = new Fuse(menuItems, {
  keys: ['name'],
  threshold: 0.5,     // 0 = exact, 1 = match anything
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
  shouldSort: true
});
```

Logic ưu tiên:
1. Tìm trong **category hiện tại** trước (ưu tiên context người dùng đang chọn).
2. Nếu không đủ tốt, fallback sang **toàn bộ menu**.
3. Chỉ chấp nhận match có `confidence ≥ 0.5`.
4. Trả về `{ menuItem, confidence }` hoặc `null`.

`confidence` được tính từ Fuse.js score: `confidence = 1 - score` (Fuse score gần 0 = match tốt).

### 4.4 Hệ thống Metrics (OpenTelemetry → Grafana Cloud)

#### 4.4.1 Raw Metrics (7 metrics, emit từ app)

| # | Tên metric | Loại | Khi ghi | Label |
|---|-----------|------|---------|-------|
| 1 | `voice_order_preview_total` | Counter | Mỗi lần mở modal preview | — |
| 2 | `voice_order_accepted_total` | Counter | Mỗi lần user bấm Xác nhận | — |
| 3 | `voice_order_cancelled_total` | Counter | Mỗi lần user bấm Hủy | — |
| 4 | `voice_order_parsed_items_total` | Counter | +`parsedItems.length` mỗi lần preview | — |
| 5 | `voice_order_matched_items_total` | Counter | +1 mỗi item match | `menu_item_id` |
| 6 | `voice_order_match_confidence` | Histogram | `confidence` mỗi item match | buckets: 0.5, 0.65, 0.75, 0.9, 1.0 |
| 7 | `voice_order_user_removed_voice_item_total` | Counter | Khi user giảm quantity về 0 trên món từ voice | `menu_item_id` |

**Nơi emit:**
- Metrics 1–6: `VoiceOrderButton.jsx` (sau khi có kết quả preview và khi user bấm Xác nhận/Hủy).
- Metric 7: `CreateBill.jsx` (theo dõi qua `voiceAddedIdsRef: Set<menuItemId>`).

#### 4.4.2 Derived Metrics (tính trong Grafana / PromQL)

| KPI | PromQL | Ý nghĩa |
|-----|--------|---------|
| **Acceptance rate** | `sum(increase(voice_order_accepted_total[$__range])) / clamp_min(sum(increase(voice_order_accepted_total[$__range])) + sum(increase(voice_order_cancelled_total[$__range])), 1)` | Tỷ lệ user chấp nhận kết quả voice |
| **Match rate** | `sum(increase(voice_order_matched_items_total[$__range])) / clamp_min(sum(increase(voice_order_parsed_items_total[$__range])), 1)` | Tỷ lệ món được match thành công |
| **Removal rate (tổng)** | `sum(increase(voice_order_user_removed_voice_item_total[$__range])) / clamp_min(sum(increase(voice_order_matched_items_total[$__range])), 1)` | Tỷ lệ món từ voice bị user gỡ sau khi thêm |
| **Removal rate theo món** | `sum by (menu_item_id)(...)` | Món nào hay bị nhận diện sai / hay bị gỡ nhất |

#### 4.4.3 Kiến trúc OTLP Export

**Vấn đề:** Grafana Cloud OTLP gateway không hỗ trợ CORS header → browser bị chặn khi POST trực tiếp (cross-origin).

**Giải pháp dev:** Vite dev proxy (`/otlp` → Grafana Cloud), request thành same-origin.

**Giải pháp production (Vercel):**

```
Browser
  │ POST /api/otlp/v1/metrics  (same-origin, không CORS)
  ▼
Vercel Serverless Function (api/otlp/v1/metrics.js)
  │ inject Authorization từ env server-only GRAFANA_OTLP_HEADERS
  ▼
Grafana Cloud OTLP Gateway
  │
  ▼
Prometheus/Mimir → Grafana Explore / Dashboard
```

Ưu điểm: token `Authorization` **không bao giờ xuất hiện trong frontend bundle**.

#### 4.4.4 Cấu hình môi trường

| Biến | Scope | Mục đích |
|------|-------|---------|
| `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` | Frontend (VITE_) | `/otlp` (dev) hoặc `/api/otlp` (prod) |
| `VITE_OTEL_EXPORTER_OTLP_HEADERS` | Frontend (VITE_) | **Chỉ dùng khi dev** (cross-origin với proxy local) |
| `GRAFANA_OTLP_ENDPOINT` | Server-only | Grafana Cloud OTLP URL thật |
| `GRAFANA_OTLP_HEADERS` | Server-only | `Authorization=Basic <BASE64>` |

#### 4.4.5 Init lifecycle

```js
// main.jsx – fire and forget, không block app render
initVoiceOrderMetrics().catch(() => {});
```

`initVoiceOrderMetrics()` dùng **dynamic import** (`await import(...)`) để lazy load toàn bộ OpenTelemetry SDK, tránh tăng bundle size khi metrics bị tắt (không có env).

---

## 5. Bảo mật

### 5.1 Phân tích bề mặt tấn công

| Thành phần | Rủi ro | Biện pháp |
|-----------|--------|-----------|
| `VITE_ADMIN_PASSWORD` | Bundle vào JS frontend | Không hardcode; đọc từ env; không có fallback trong production |
| Firebase API Key | Bundle vào JS | Firebase API key được thiết kế để public; bảo vệ bằng Firestore Security Rules |
| Grafana token | — | **Không** để trong biến `VITE_*`; chỉ inject server-side qua Vercel Function |
| Whisper Backend URL | Bundle vào JS | URL không phải secret; endpoint yêu cầu audio input hợp lệ |

### 5.2 Firestore Security Rules

File `firestore.rules` định nghĩa quyền truy cập theo collection. Public routes (`/bill/`, `/order/`) chỉ được read; write yêu cầu authenticated (hoặc rule riêng theo collection).

### 5.3 .gitignore

File `.env` (chứa tất cả secret thật) đã được thêm vào `.gitignore`. Chỉ commit:
- `.env.vercel.example` – template không chứa giá trị thật.
- `vite.config.js` – chứa proxy config (không phải secret).

### 5.4 Rủi ro còn lại

- `VITE_ADMIN_PASSWORD` bản chất là client-side auth → **không nên dùng cho dữ liệu nhạy cảm cao**. Phù hợp với use case quán nhỏ, 1 người dùng.
- Firebase API Key public → **bắt buộc** cấu hình Firestore Security Rules chặt chẽ để tránh write tùy ý.

---

## 6. Triển khai

### 6.1 Môi trường dev

```bash
npm install
# Tạo .env với VITE_* variables
npm run dev   # Vite dev server + proxy /otlp → Grafana Cloud
```

Vite proxy (`vite.config.js`):

```js
server: {
  proxy: {
    '/otlp': {
      target: 'https://otlp-gateway-prod-ap-southeast-1.grafana.net',
      changeOrigin: true,
      secure: true,
    }
  }
}
```

### 6.2 Triển khai Vercel

**Cấu hình `vercel.json`:**

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/bill/(.*)", "destination": "/index.html" },
    { "source": "/(.*)",     "destination": "/index.html"  }
  ]
}
```

**Vercel Serverless Function:** `api/otlp/v1/metrics.js`  
Nhận POST từ browser, inject `Authorization` từ env server-only (`GRAFANA_OTLP_HEADERS`), forward lên Grafana Cloud.

**Environment Variables trên Vercel:**

| Biến | Scope | Ghi chú |
|------|-------|---------|
| `VITE_FIREBASE_*` | Client | Từ Firebase Console |
| `VITE_ADMIN_PASSWORD` | Client | Mật khẩu đăng nhập |
| `VITE_BACKEND_API_URL` | Client | URL Whisper backend |
| `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` | Client | `/api/otlp` |
| `GRAFANA_OTLP_ENDPOINT` | Server | URL Grafana OTLP gateway |
| `GRAFANA_OTLP_HEADERS` | Server | `Authorization=Basic <BASE64>` |

### 6.3 Scripts tiện ích

```bash
npm run migrate:categories   # Migration dữ liệu categories
npm run migrate:orderitems   # Migration order items
npm run deploy:check         # Build + preview kiểm tra trước khi deploy
```

---

## 7. Hiệu năng và tối ưu

### 7.1 Bundle size

- OpenTelemetry SDK được **lazy load** qua `await import(...)` trong `initVoiceOrderMetrics()`. Chỉ tải khi có env OTLP; không ảnh hưởng bundle chính khi metrics bị tắt.
- Fuse.js (~24KB gzip) được load khi `VoiceOrderButton` mount (theo category).

### 7.2 React rendering

| Kỹ thuật | Áp dụng |
|---------|---------|
| `useMemo` | `billSummary`, `filteredMenuItems`, `customTotals`, `menuMatcher` |
| `useCallback` | `handleProcessOrder`, `handleResult` |
| `useRef` | `voiceAddedIdsRef` (Set tracking món từ voice, không trigger re-render) |

### 7.3 Firestore

- Dùng `onSnapshot` cho realtime updates (bills theo ngày), tự cleanup khi component unmount.
- Query có index: `where('date', '==', ...)` + `orderBy('createdAt', 'desc')`.

### 7.4 Voice matching

- Fuse.js matching được thiết kế để chạy **< 500ms** với menu ~50–100 items.
- `menuMatcher` được tạo một lần qua `useMemo`, không tạo lại mỗi lần re-render.

### 7.5 Metrics export

- OTLP export theo chu kỳ **10 giây** (`exportIntervalMillis: 10000`), không chặn main thread.
- Nếu init thất bại, tất cả `record*()` fallback về **no-op function** → không có runtime error.

---

## 8. Kết quả đạt được, hạn chế và hướng phát triển

### 8.1 Kết quả đạt được

| Hạng mục | Kết quả |
|---------|---------|
| Voice Order pipeline | Nhận diện được đơn hàng tiếng Việt qua Whisper ASR, parse và match vào menu với fuzzy search. |
| Preview + confirm | User có thể xem lại kết quả nhận diện và xác nhận trước khi thêm vào đơn. |
| 7 raw metrics | Emit đầy đủ lên Grafana Cloud qua OTLP/HTTP, xác nhận qua Explore. |
| 4 derived KPI | Acceptance rate, match rate, removal rate (tổng + theo món) tính được qua PromQL. |
| Bảo mật token | Token Grafana không xuất hiện trong frontend bundle (server-side injection qua Vercel Function). |
| Realtime | Đơn hàng cập nhật realtime qua Firestore `onSnapshot`. |
| QR code | Nhân viên có thể chia sẻ hóa đơn cho khách qua QR. |

### 8.2 Hạn chế

| Hạn chế | Chi tiết |
|---------|---------|
| Auth đơn giản | Password gate client-side, không dùng Firebase Auth → dễ bị brute force nếu app public. |
| Voice parser giới hạn | Chỉ hỗ trợ format `[Tên món] [Số] phần`; không xử lý câu nói tự nhiên phức tạp. |
| Số tiếng Việt | Map từ điển tĩnh, giới hạn đến 20; không xử lý số lớn hơn (ví dụ "ba mươi"). |
| Single user | Hệ thống thiết kế cho 1 nhân viên; chưa có role/permission nếu scale lên nhiều người. |
| OTLP chỉ hoạt động khi dev server có proxy | Nếu deploy mà thiếu env `GRAFANA_OTLP_HEADERS`, proxy function không inject auth → Grafana từ chối. |
| Retention Grafana | Gói free/trial có thể có retention ngắn (7–14 ngày); không đủ để xem "all-time". |

### 8.3 Hướng phát triển

| Ưu tiên | Hướng |
|---------|-------|
| **Cao** | Nâng cấp voice parser để xử lý câu nói tự nhiên hơn (không bắt buộc từ "phần"). |
| **Cao** | Thêm xác thực Firebase Auth để hỗ trợ nhiều nhân viên có quyền khác nhau. |
| **Trung bình** | Dashboard Grafana chuẩn (4 KPI panels) để theo dõi voice order hàng tháng. |
| **Trung bình** | Lưu aggregated KPI theo ngày vào Firestore để giữ "all-time stats" không phụ thuộc retention Prometheus. |
| **Thấp** | Hỗ trợ offline (service worker + IndexedDB) để hoạt động khi mất mạng tạm thời. |
| **Thấp** | Tích hợp thanh toán (VNPay, MoMo) qua QR. |

---

*Báo cáo được tạo tự động từ codebase tháng 3/2026.*
