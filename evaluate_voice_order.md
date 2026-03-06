# Đánh giá module Voice Order (parsing + match)

Tài liệu chốt bộ metrics dùng để đánh giá độ chính xác và trải nghiệm của tính năng đặt món bằng giọng nói (voice order). Chỉ xét **các món đã match**; không track trường hợp unmatched.

---

## 1. Raw metrics (emit từ app)

| # | Tên | Loại | Khi ghi | Label |
|---|-----|------|---------|--------|
| 1 | `voice_order_preview_total` | Counter | Mỗi lần mở modal preview | — |
| 2 | `voice_order_accepted_total` | Counter | Mỗi lần user bấm Xác nhận | — |
| 3 | `voice_order_cancelled_total` | Counter | Mỗi lần user bấm Hủy | — |
| 4 | `voice_order_parsed_items_total` | Counter | Mỗi lần preview: cộng `parsedItems.length` | — |
| 5 | `voice_order_matched_items_total` | Counter | Mỗi item trong `matchedItems`: +1 | `menu_item_id` (tùy chọn) |
| 6 | `voice_order_match_confidence` | Histogram | Mỗi item trong `matchedItems`: ghi `confidence` (0–1) | Buckets: `[0.5, 0.65, 0.75, 0.9, 1.0]` |
| 7 | `voice_order_user_removed_voice_item_total` | Counter | Mỗi lần user xóa hoặc giảm về 0 một món vừa thêm từ voice | `menu_item_id` (tùy chọn) |

---

## 2. Derived metrics (tính trong Grafana / PromQL)

| Chỉ số | Công thức | Ý nghĩa |
|--------|-----------|---------|
| **Acceptance rate** | `voice_order_accepted_total / voice_order_preview_total` | Tỷ lệ user chấp nhận kết quả preview. |
| **Match rate** | `voice_order_matched_items_total / voice_order_parsed_items_total` | Trong số món parser ra, bao nhiêu % được match. |
| **Removal rate (tổng)** | `voice_order_user_removed_voice_item_total / voice_order_matched_items_total` | Trong số món đã match, bao nhiêu % bị user gỡ. |
| **Removal rate theo món** | `sum by (menu_item_id)(voice_order_user_removed_voice_item_total) / sum by (menu_item_id)(voice_order_matched_items_total)` | Món nào hay bị gỡ nhất. |

---

## 3. Quy ước

- **Không dùng session.** Mọi chỉ số đều đếm theo event / item.
- **Không track unmatched.** Chỉ xét các món đã match; bỏ qua trường hợp không tìm thấy trong menu.
- **Label `menu_item_id`** dùng khi cần phân tích theo từng món (ví dụ tìm món hay bị nhận diện sai / hay bị gỡ nhất). Cardinality = số món trong menu.

---

## 4. Nơi emit (gợi ý)

| Metric | Nơi ghi |
|--------|--------|
| 1–6 | `VoiceOrderButton`: khi có `parsedItems` / `matchedItems`, khi mở preview, khi user Confirm / Cancel. |
| 7 | `CreateBill`: khi user giảm quantity về 0 hoặc xóa item có đánh dấu "từ voice" (cần truyền flag từ `onItemsMatched`). |

Export qua OpenTelemetry (OTLP) lên Grafana Cloud hoặc Prometheus để vẽ dashboard.
