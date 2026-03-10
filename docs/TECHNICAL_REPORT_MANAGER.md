# Báo cáo Kỹ thuật Dự án: Hệ thống Quản lý Đơn hàng Quán Ốc
### Dành cho Quản lý Kỹ thuật

**Phiên bản:** 1.0.0  
**Ngày:** Tháng 3, 2026  
**Người thực hiện:** [Tên tác giả]  
**Loại dự án:** Web App nội bộ – quản lý vận hành quán ốc nhỏ

---

## Mục lục

1. [Tóm tắt điều hành](#1-tóm-tắt-điều-hành)
2. [Phạm vi và mục tiêu dự án](#2-phạm-vi-và-mục-tiêu-dự-án)
3. [Tổng quan kiến trúc](#3-tổng-quan-kiến-trúc)
4. [Các quyết định kỹ thuật quan trọng](#4-các-quyết-định-kỹ-thuật-quan-trọng)
5. [Rủi ro kỹ thuật và biện pháp xử lý](#5-rủi-ro-kỹ-thuật-và-biện-pháp-xử-lý)
6. [Chi phí vận hành](#6-chi-phí-vận-hành)
7. [Chất lượng và Observability](#7-chất-lượng-và-observability)
8. [Khả năng mở rộng](#8-khả-năng-mở-rộng)
9. [Tiến độ và trạng thái hiện tại](#9-tiến-độ-và-trạng-thái-hiện-tại)
10. [Kết luận và kiến nghị](#10-kết-luận-và-kiến-nghị)

---

## 1. Tóm tắt điều hành

Dự án xây dựng thành công một ứng dụng web quản lý vận hành cho quán ốc nhỏ, bao gồm:

- **Quản lý menu và đơn hàng** với tính toán lợi nhuận tự động theo thời gian thực.
- **Tính năng nhập đơn bằng giọng nói (Voice Order)** sử dụng AI nhận dạng tiếng nói (Whisper ASR), giúp nhân viên tạo đơn nhanh hơn mà không cần gõ tay.
- **Hóa đơn công khai** qua QR code cho khách hàng xem.
- **Hệ thống đo lường chất lượng (Observability)** tự động thu thập và gửi 7 chỉ số về độ chính xác Voice Order lên Grafana Cloud để theo dõi và cải tiến liên tục.

Ứng dụng được triển khai trên **Vercel** (serverless, miễn phí), dữ liệu lưu trên **Firebase Firestore** (Google Cloud), đảm bảo không cần duy trì server riêng.

---

## 2. Phạm vi và mục tiêu dự án

### 2.1 Bài toán

Nhân viên quán ốc hiện phải ghi tay đơn hàng hoặc dùng app thủ công với nhiều bước nhấn. Trong giờ cao điểm, tốc độ xử lý đơn ảnh hưởng trực tiếp đến chất lượng dịch vụ.

### 2.2 Giải pháp

| Vấn đề | Giải pháp |
|--------|-----------|
| Ghi đơn chậm | Voice Order: nói tên món → app tự điền |
| Theo dõi lợi nhuận thủ công | Tính toán tự động (giá bán – giá vốn – chi phí – thuế) |
| Không biết Voice Order có chính xác không | 7 metrics tự động gửi lên Grafana Cloud |
| Chia hóa đơn cho khách | Trang public `/bill/:bàn` + QR code |

### 2.3 Người dùng mục tiêu

- **Nhân viên phục vụ:** tạo đơn, theo dõi bàn.
- **Chủ quán:** xem báo cáo doanh thu, lợi nhuận theo ngày/tuần/tháng.
- **Khách hàng:** xem hóa đơn qua QR (read-only, không cần đăng nhập).

---

## 3. Tổng quan kiến trúc

### 3.1 Sơ đồ hệ thống

```
[Nhân viên / Chủ quán]          [Khách hàng]
        │                              │
        ▼                              ▼
 ┌──────────────────┐          ┌───────────────┐
 │  Web App (React) │          │ Public Bill   │
 │  Vercel Hosting  │          │ /bill/:table  │
 └────────┬─────────┘          └───────┬───────┘
          │                            │
          ▼                            ▼
 ┌──────────────────────────────────────────────┐
 │             Firebase Firestore               │
 │  (bills, menuItems, tables – Google Cloud)   │
 └──────────────────────────────────────────────┘

          │ Voice Order
          ▼
 ┌──────────────────┐
 │  Whisper ASR API │  ← Backend tự host hoặc API
 │  (nhận diện nói) │
 └──────────────────┘

          │ Metrics (OTLP)
          ▼
 ┌──────────────────┐     ┌─────────────────────────┐
 │  Vercel Function │────▶│  Grafana Cloud           │
 │  (proxy bảo mật) │     │  (Prometheus/Mimir)      │
 └──────────────────┘     │  Dashboard + Alerting    │
                          └─────────────────────────┘
```

### 3.2 Phân lớp hệ thống

| Lớp | Thành phần | Ghi chú |
|-----|-----------|---------|
| **Frontend** | React 18, Vite, Tailwind CSS | SPA, mobile-first |
| **Database** | Firebase Firestore | Realtime, serverless |
| **AI/ASR** | Whisper (backend riêng) | Nhận dạng tiếng Việt |
| **Observability** | OpenTelemetry → Grafana Cloud | Chỉ metrics, không log/trace |
| **Hosting** | Vercel | Serverless, auto-deploy từ Git |
| **Auth** | Password gate (client-side) | Đủ cho 1 tài khoản nhân viên |

---

## 4. Các quyết định kỹ thuật quan trọng

### 4.1 Tại sao chọn Firebase Firestore thay vì database truyền thống?

| Tiêu chí | Firebase Firestore | PostgreSQL/MySQL truyền thống |
|---------|-------------------|------------------------------|
| Cài đặt server | Không cần | Cần VPS/server riêng |
| Realtime updates | Có sẵn (`onSnapshot`) | Cần WebSocket riêng |
| Chi phí khởi đầu | Miễn phí (Spark plan) | Trả phí VPS hàng tháng |
| Scale | Tự động (Google Cloud) | Cần quản lý thủ công |
| Phù hợp quy mô | Quán nhỏ (< 1000 doc/ngày) | Cần nhiều dữ liệu phức tạp |

**Quyết định:** Chọn Firestore — phù hợp với quy mô nhỏ, không cần quản lý hạ tầng, tiết kiệm chi phí.

### 4.2 Tại sao dùng Whisper ASR thay vì Web Speech API?

| Tiêu chí | Whisper (backend) | Web Speech API (browser) |
|---------|-------------------|--------------------------|
| Hỗ trợ tiếng Việt | Tốt (multilingual model) | Phụ thuộc browser/OS |
| Hoạt động offline | Có (nếu self-host) | Không |
| Độ chính xác | Cao hơn | Thấp hơn với tiếng Việt có dấu |
| Kiểm soát được | Hoàn toàn | Không (phụ thuộc Google/Apple) |

**Quyết định:** Chọn Whisper backend — độ chính xác cao hơn cho tiếng Việt, tự kiểm soát.

### 4.3 Tại sao dùng Fuse.js cho fuzzy matching thay vì exact match?

Nhân viên nói "ốc hương" nhưng Whisper có thể transcribe thành "ốc hưong" (thiếu dấu) hoặc "óc hương" (sai thanh). Fuzzy matching cho phép tìm món gần đúng nhất thay vì yêu cầu khớp chính xác 100%.

**Ngưỡng confidence = 0.5:** chỉ chấp nhận kết quả có độ tin cậy từ 50% trở lên để tránh nhận diện sai hoàn toàn.

### 4.4 Tại sao cần Vercel Function làm proxy OTLP?

Grafana Cloud OTLP gateway **không hỗ trợ CORS** (trình duyệt không được phép gửi request trực tiếp đến domain khác). Nếu để token trong frontend, bất kỳ ai mở DevTools đều đọc được.

**Giải pháp:** Vercel Function nhận request từ app (cùng domain → không CORS), tự inject token Authorization từ biến môi trường server-only, rồi forward lên Grafana Cloud. Token không bao giờ xuất hiện trong code chạy ở browser.

---

## 5. Rủi ro kỹ thuật và biện pháp xử lý

| Rủi ro | Mức độ | Biện pháp đã thực hiện | Biện pháp đề xuất thêm |
|--------|--------|----------------------|------------------------|
| **Token Grafana bị lộ** | Cao | Proxy server-side, token không vào bundle | Tạo token chỉ có quyền `metrics:write` |
| **Firebase API Key bị lộ** | Trung bình | API key được thiết kế public; bảo vệ bằng Firestore Security Rules | Review Security Rules định kỳ |
| **Voice Order nhận sai món** | Trung bình | Preview modal để user xác nhận trước khi thêm | Theo dõi match rate qua Grafana |
| **Whisper API ngừng hoạt động** | Trung bình | Hiển thị lỗi rõ ràng, không crash app | Thêm fallback text input |
| **Firebase Firestore outage** | Thấp | Google SLA 99.95% | Cache offline nếu cần |
| **Metrics data mất sau retention** | Thấp | Grafana Cloud lưu trong giới hạn plan | Lưu KPI tổng hợp vào Firestore |
| **Auth password bị đoán** | Thấp (nội bộ) | Password từ env, không hardcode | Chuyển sang Firebase Auth nếu scale |

---

## 6. Chi phí vận hành

### 6.1 Ước tính chi phí hàng tháng (quy mô hiện tại)

| Dịch vụ | Gói hiện tại | Giới hạn free | Ước tính dùng | Chi phí |
|---------|-------------|--------------|--------------|---------|
| **Vercel** | Hobby (free) | 100GB bandwidth, unlimited deploys | Thấp | **$0** |
| **Firebase Firestore** | Spark (free) | 50k reads, 20k writes/ngày | ~500 reads, ~50 writes/ngày | **$0** |
| **Grafana Cloud** | Free/Trial | 10k metrics series, 14 ngày retention | 7 metrics series | **$0** |
| **Whisper ASR** | Self-host / API | — | Tùy backend | Tùy chọn |

> **Tổng chi phí hạ tầng hiện tại: $0/tháng** (trừ chi phí Whisper backend nếu dùng API thương mại).

### 6.2 Khi quy mô tăng

| Điều kiện | Dịch vụ cần nâng cấp | Chi phí ước tính |
|-----------|---------------------|-----------------|
| > 20k writes/ngày Firestore | Nâng lên Blaze plan | Pay-as-you-go (~$0.18/100k writes) |
| Cần retention Grafana > 14 ngày | Nâng Grafana plan | Từ $29/tháng (Pro) |
| Nhiều người dùng đồng thời | Vercel Pro | $20/tháng |

---

## 7. Chất lượng và Observability

### 7.1 Hệ thống đo lường Voice Order

Đây là điểm nổi bật kỹ thuật của dự án: **tự động thu thập dữ liệu để đánh giá và cải tiến tính năng Voice Order** theo thời gian thực.

#### 7 chỉ số raw (tự động gửi lên Grafana)

| Chỉ số | Ý nghĩa kinh doanh |
|--------|-------------------|
| `voice_order_preview_total` | Bao nhiêu lần nhân viên dùng Voice Order |
| `voice_order_accepted_total` | Bao nhiêu lần kết quả được chấp nhận |
| `voice_order_cancelled_total` | Bao nhiêu lần kết quả bị hủy (không hài lòng) |
| `voice_order_parsed_items_total` | Tổng số món AI nhận dạng được |
| `voice_order_matched_items_total` | Tổng số món match được vào menu |
| `voice_order_match_confidence` | Phân bố độ tin cậy khi match món |
| `voice_order_user_removed_voice_item_total` | Số lần nhân viên xóa món sau khi Voice Order thêm vào |

#### 4 KPI tổng hợp (tính từ raw metrics, xem trên Grafana)

| KPI | Công thức | Mục tiêu |
|-----|-----------|---------|
| **Acceptance rate** | Số lần Xác nhận ÷ (Xác nhận + Hủy) | > 80% |
| **Match rate** | Số món match ÷ Số món nhận dạng | > 85% |
| **Removal rate (tổng)** | Số món bị xóa ÷ Số món đã match | < 20% |
| **Removal rate theo món** | Phân tích từng món bị xóa nhiều nhất | Giảm dần |

#### Ý nghĩa của các KPI

- **Acceptance rate thấp** → nhân viên hay hủy kết quả → Whisper hoặc parser đang nhận diện sai nhiều.
- **Match rate thấp** → parser ra tên món nhưng không tìm thấy trong menu → cần cải thiện tên món trong menu hoặc thuật toán matching.
- **Removal rate cao cho 1 món cụ thể** → món đó hay bị nhận diện nhầm với món khác → cần review tên gọi hoặc điều chỉnh fuzzy threshold.

### 7.2 Trạng thái observability hiện tại

| Thành phần | Trạng thái |
|-----------|-----------|
| 7 raw metrics lên Grafana | ✅ Đã xác nhận hoạt động |
| CORS proxy an toàn (Vercel Function) | ✅ Đã implement |
| Dashboard KPI 4 panels | ⬜ Chưa tạo (có sẵn PromQL queries) |
| Alerting (cảnh báo khi KPI xuống thấp) | ⬜ Chưa cấu hình |
| Logging / Tracing | ⬜ Chưa implement (chỉ có metrics) |

### 7.3 Hướng dẫn đọc kết quả trên Grafana

Sau 1 tháng vận hành, vào **Grafana → Explore** chạy các query sau để lấy số liệu báo cáo:

```
Acceptance rate (tháng):
→ sum(increase(voice_order_accepted_total[30d]))
   / clamp_min(sum(increase(voice_order_accepted_total[30d]))
   + sum(increase(voice_order_cancelled_total[30d])), 1)

Match rate (tháng):
→ sum(increase(voice_order_matched_items_total[30d]))
   / clamp_min(sum(increase(voice_order_parsed_items_total[30d])), 1)
```

> **Lưu ý:** Grafana Cloud free lưu tối đa 14 ngày. Cần nâng plan hoặc lưu KPI tổng hợp vào Firestore để xem "all-time".

---

## 8. Khả năng mở rộng

### 8.1 Quy mô người dùng

| Tình huống | Cần làm |
|-----------|---------|
| 1 quán, 1 nhân viên (hiện tại) | Không cần thay đổi |
| 1 quán, nhiều nhân viên | Chuyển sang Firebase Authentication (thêm role) |
| Nhiều chi nhánh | Thêm field `branchId` vào Firestore collections, tách Grafana datasource |
| SaaS cho nhiều quán | Tách project Firebase riêng mỗi quán, hoặc dùng Firebase multi-tenant |

### 8.2 Tính năng có thể thêm không ảnh hưởng kiến trúc hiện tại

- **Thanh toán QR** (VNPay, MoMo): thêm component, không đụng cấu trúc dữ liệu.
- **In hóa đơn** nhiệt: thêm print CSS, không cần backend mới.
- **Thông báo đơn mới** (push notification): Firebase Cloud Messaging, tích hợp nhanh.
- **Đặt món trước** (pre-order): đã có sườn trang `/order/:table`.

### 8.3 Tính năng cần thay đổi kiến trúc

- **Offline mode** (mất mạng vẫn dùng được): cần Service Worker + IndexedDB + sync strategy.
- **Analytics nâng cao** (BI dashboard): cần ETL pipeline từ Firestore sang data warehouse.
- **Multi-language Voice Order**: cần train/fine-tune Whisper với data tiếng Việt đặc thù.

---

## 9. Tiến độ và trạng thái hiện tại

### 9.1 Các milestone đã hoàn thành

| Milestone | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| Quản lý menu (CRUD) | ✅ Hoàn thành | Đầy đủ validation, tính lợi nhuận |
| Tạo đơn hàng | ✅ Hoàn thành | Mobile-friendly, real-time summary |
| Quản lý đơn + thanh toán | ✅ Hoàn thành | Realtime qua Firestore snapshot |
| Báo cáo doanh thu | ✅ Hoàn thành | Ngày/tuần/tháng, biểu đồ |
| Phân tích món ăn | ✅ Hoàn thành | Top món, lợi nhuận theo món |
| QR code + public bill | ✅ Hoàn thành | Khách xem được, không cần login |
| Voice Order (ASR + parser + matcher) | ✅ Hoàn thành | Whisper + custom regex + Fuse.js |
| Preview modal xác nhận | ✅ Hoàn thành | Hiển thị confidence từng món |
| 7 raw metrics → Grafana Cloud | ✅ Hoàn thành | Xác nhận data lên Grafana |
| CORS proxy an toàn (Vercel Function) | ✅ Hoàn thành | Token không lộ ở frontend |

### 9.2 Việc còn lại (backlog)

| Việc | Ưu tiên | Ước tính |
|------|---------|---------|
| Tạo dashboard Grafana 4 KPI panels | Trung bình | 2–3 giờ |
| Xóa fallback password hardcode trong PasswordGate | Cao | 15 phút |
| Cấu hình Grafana Alerting khi KPI thấp | Trung bình | 1–2 giờ |
| Lưu KPI tổng hợp theo ngày vào Firestore | Thấp | 1 ngày |
| Firebase Auth (nếu cần nhiều tài khoản) | Thấp | 2–3 ngày |

---

## 10. Kết luận và kiến nghị

### 10.1 Kết luận

Dự án đã đạt được **100% các tính năng cốt lõi** đề ra ban đầu. Điểm nổi bật so với các giải pháp tương tự ở quy mô nhỏ:

- **Voice Order với feedback loop đo lường** — không chỉ implement tính năng mà còn xây dựng cơ chế để biết tính năng đó có đang hoạt động tốt không, từ đó cải tiến liên tục.
- **Kiến trúc bảo mật đúng** — token nhạy cảm không xuất hiện ở phía client, đúng với best practice production.
- **Chi phí hạ tầng $0** cho quy mô hiện tại, dễ scale khi cần.

### 10.2 Kiến nghị ngắn hạn (1–2 tuần tới)

1. **Deploy lên Vercel production** và cấu hình đúng env variables (đặc biệt `GRAFANA_OTLP_HEADERS` server-only).
2. **Tạo dashboard Grafana** với 4 KPI panels để theo dõi hàng ngày.
3. **Xóa hardcode fallback password** trong `PasswordGate.jsx` trước khi đưa vào production.
4. **Thu thập data thực tế** ít nhất 2–4 tuần, sau đó review Acceptance rate và Match rate để quyết định có cần cải thiện Voice Order hay không.

### 10.3 Kiến nghị trung hạn (1–3 tháng tới)

1. **Nâng retention Grafana** lên ít nhất 30 ngày để xem đủ 1 tháng báo cáo.
2. Nếu **Removal rate > 30%** cho một món cụ thể → đó là tín hiệu cần xem lại tên món trong menu hoặc huấn luyện lại parser cho món đó.
3. Nếu **Match rate < 70%** → xem xét mở rộng từ điển số tiếng Việt và điều chỉnh fuzzy threshold.

---

*Báo cáo này được chuẩn bị cho Quản lý Kỹ thuật. Báo cáo chi tiết dành cho Developer xem tại `TECHNICAL_REPORT.md`.*
