# Quản lý đơn hàng - Quán Ốc

Ứng dụng web quản lý đơn hàng cho quán ốc được xây dựng bằng React và Firebase.

## Tính năng chính

### 🔐 Bảo mật
- **Password Gate**: Bảo vệ truy cập bằng mật khẩu duy nhất
- Lưu session trong `sessionStorage` để không phải nhập lại trong phiên làm việc

### 🍽️ Quản lý Menu (CRUD)
- Thêm, sửa, xóa các món ăn
- Thông tin chi tiết: tên, giá bán, thuế (%), giá vốn, chi phí cố định
- Tính toán tự động lợi nhuận mỗi món
- Validation đầy đủ với React Hook Form + Yup

### 📋 Tạo đơn hàng
- Giao diện mobile-friendly để chọn món và số lượng
- Tính toán realtime tổng bill và lợi nhuận
- Logic tính toán: `profitPerItem = price - costPrice - fixedCost - (price × tax/100)`
- Không cho phép tạo bill rỗng

### 📊 Quản lý đơn hàng
- Xem danh sách đơn hàng theo ngày
- Filter theo ngày tùy chọn
- Xem chi tiết từng đơn hàng
- Thống kê tổng quan: tổng đơn, doanh thu, lợi nhuận

### 📈 Báo cáo
- Phân tích theo ngày/tuần/tháng
- Biểu đồ doanh thu và lợi nhuận (Recharts)
- Xu hướng số lượng đơn hàng
- Bảng dữ liệu chi tiết

## Công nghệ sử dụng

- **Frontend**: React 18, Vite
- **Routing**: React Router DOM
- **UI Framework**: Tailwind CSS
- **Database**: Firebase Firestore
- **Form Management**: React Hook Form + Yup validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **Notifications**: React Toastify

## Cài đặt và chạy

### 1. Clone project
```bash
git clone <repository-url>
cd ManageBill
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình Environment Variables

#### Bước 3.1: Tạo file `.env`
```bash
# Tạo file .env trong thư mục gốc
touch .env
```

Thêm nội dung sau vào file `.env`:
```env
# Admin password for authentication
VITE_ADMIN_PASSWORD=quan-oc-2024
```

⚠️ **Bảo mật**: 
- File `.env` đã được thêm vào `.gitignore`
- Không commit password lên Git
- Thay đổi password mặc định trong production

### 4. Cấu hình Firebase

#### Bước 4.1: Tạo Firebase Project
1. Tạo project mới trên [Firebase Console](https://console.firebase.google.com/)
2. Tạo Firestore Database với chế độ "Start in test mode"

#### Bước 4.2: Setup Firebase Environment Variables
1. **Lấy Firebase Config từ Console:**
   - Vào Firebase Console > Project Settings > General > Your apps
   - Chọn web app và copy Firebase configuration
   - Thêm vào file `.env`:

   ```env
   # Admin password
   VITE_ADMIN_PASSWORD=quan-oc-2024

   # Firebase Configuration
   VITE_FIREBASE_API_KEY=your-actual-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   ```

✅ **Tự động**: File `firebase.js` sẽ tự động đọc từ environment variables.

### 5. Cấu hình Firestore Security Rules
Áp dụng rules sau trong Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to all documents
    // Trong production nên thêm authentication rules
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 6. Chạy ứng dụng
```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173`

## Sử dụng
 
### Đăng nhập
- Mật khẩu mặc định: `quan-oc-2024` (có thể thay đổi trong file `.env`)
- Password được đọc từ environment variable `VITE_ADMIN_PASSWORD`

### Quy trình làm việc
1. **Thiết lập nhà hàng**: 
   - Thêm các bàn ăn với số ghế trong tab "Bàn" của phần quản lý
   - Thêm các món ăn vào menu với đầy đủ thông tin giá cả trong tab "Menu"
2. **Tạo đơn hàng**: 
   - Chọn số bàn (bắt buộc)
   - Chọn món và số lượng theo danh mục (Ốc, Ăn no, Ăn chơi, Lai rai, Giải khát, Tất cả)
   - Hệ thống tự động tính toán doanh thu và lợi nhuận
3. **Quản lý đơn hàng**: Xem và theo dõi các đơn hàng theo ngày, bao gồm thông tin số bàn
4. **Phân tích báo cáo**: Theo dõi xu hướng kinh doanh qua biểu đồ

## Cấu trúc dữ liệu

### Collection `menuItems`
```javascript
{
  name: "Tên món ăn",
  category: "oc",       // Danh mục: oc, an_no, an_choi, lai_rai, giai_khat
  price: 50000,         // Giá bán (VND)
  tax: 8,               // Thuế (%)
  costPrice: 30000,     // Giá vốn (VND)
  fixedCost: 5000       // Chi phí cố định (VND)
}
```

### Collection `tables`
```javascript
{
  number: 1,            // Số bàn (unique)
  seats: 4,             // Số chỗ ngồi
  description: "Gần cửa sổ"  // Mô tả (optional)
}
```

### Collection `bills`
```javascript
{
  createdAt: timestamp,
  date: "2024-01-15",           // YYYY-MM-DD
  tableNumber: 1,               // Số bàn
  items: [
    {
      menuItemId: "doc-id",
      quantity: 2
    }
  ],
  totalRevenue: 100000,         // Tổng doanh thu
  totalProfit: 30000            // Tổng lợi nhuận
}
```

## Deployment

### Vercel (Khuyến nghị)

#### Bước 1: Chuẩn bị GitHub Repository
```bash
# Đảm bảo code đã được commit
git add .
git commit -m "Ready for deployment"

# Push lên GitHub (nếu chưa có remote)
git remote add origin https://github.com/your-username/manage-bill.git
git branch -M main
git push -u origin main
```

#### Bước 2: Deploy với Vercel
1. Truy cập [vercel.com](https://vercel.com) và đăng nhập bằng GitHub
2. Click **"New Project"**
3. Import repository `ManageBill` từ GitHub
4. **Framework Preset**: Vercel sẽ tự động detect Vite
5. **Root Directory**: `.` (mặc định)
6. **Build Command**: `npm run build` (mặc định)
7. **Output Directory**: `dist` (mặc định)

#### Bước 3: Cấu hình Environment Variables
Trong Vercel dashboard > Project Settings > Environment Variables, thêm:

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

#### Bước 4: Cập nhật Firebase Config
Firebase config sẽ đọc từ environment variables (xem `src/config/firebase.production.js`)

#### Bước 5: Deploy
- Vercel sẽ tự động deploy khi push code lên GitHub
- Mỗi commit sẽ tạo preview deployment
- Branch `main` sẽ auto-deploy lên production

### Firebase Hosting (Alternative)
1. Cài đặt Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login và init project:
```bash
firebase login
firebase init hosting
```

3. Build và deploy:
```bash
npm run build
firebase deploy
```

### Cấu hình cho Production
- Thay đổi mật khẩu trong `PasswordGate.jsx`
- Cập nhật Firestore Security Rules để bảo mật hơn
- Cấu hình environment variables cho Firebase config

## Grafana và Voice Metrics

Phần này dùng để test luồng gọi API giọng nói theo dataset và đẩy metrics phục vụ dashboard/alert trên Grafana.

### Chạy script test để xuất metrics

Đọc file docs/TEST_GRAFANA để rõ hơn:

```bash
# Online test + export metrics
node "scripts/test-voice-metrics-from-dataset.js" --dataset "path_to_voice_dataset" --env ".env" --samples 50 --timeout-ms 45000 --export --source "voice_dataset_online_test"

# Gần thực tế: áp rule accepted + tạo bill test
node "scripts/test-voice-metrics-from-dataset.js" --dataset "path_to_voice_dataset" --env ".env" --samples 50 --create-bill --auto-paid --accept-min-matched 1 --accept-min-match-rate 0.6 --accept-min-avg-confidence 0.55 --export --source "voice_dataset_online_test"
```

Khi cần truy bug theo từng sample, bật thêm trace và event log:

```bash
node "scripts/test-voice-metrics-from-dataset.js" --dataset "path_to_voice_dataset" --env ".env" --samples 50 --timeout-ms 45000 --export --trace --log-events --run-id "run_voice_20260420" --source "voice_dataset_online_test"
```

### Logic accepted/cancelled (gần thực tế)

- `accepted` khi đồng thời đạt:
  - `matched_count >= accept_min_matched` (mặc định `1`)
  - `match_rate >= accept_min_match_rate` (mặc định `0.6`)
  - `avg_confidence >= accept_min_avg_confidence` (mặc định `0.55`)
- `cancelled` khi thiếu một trong các điều kiện trên, hoặc API lỗi, transcript rỗng, hoặc parse ra 0 item.

### KPI query nhanh trên Grafana

- Parse fail rate = `voice_test_file_parse_empty_total / voice_test_file_total`
- Match success rate = `voice_test_matched_items_total / voice_test_parsed_items_total`
- End-to-end acceptance = `voice_test_file_accepted_total / voice_test_file_total`
- API error rate = `voice_test_api_error_total / voice_test_file_total`

### Tách dữ liệu UI và script bằng `source`

- UI app: đặt `VITE_METRICS_SOURCE=app_ui` trong env của app/web.
- Script test: dùng `--source "voice_dataset_online_test"` khi chạy script.
- Query mẫu:
  - UI: `sum(increase(voice_order_accepted_total{source="app_ui"}[15m]))`
  - Script: `sum(increase(voice_order_accepted_total{source="voice_dataset_online_test"}[15m]))`

### Lưu ý về cardinality

- Không đưa transcript raw vào metric labels.
- `sample_id` chỉ nên để ở logs/traces, không để ở metrics.
- Chuẩn hóa `reason_code` thành tập giá trị cố định để tránh nổ series.

## Tính năng nâng cao có thể thêm

- [ ] Multiple user accounts với roles khác nhau
- [ ] Export báo cáo ra Excel/PDF
- [ ] Notification cho đơn hàng mới
- [ ] Inventory management
- [ ] Customer management
- [ ] POS integration
- [ ] Mobile app (React Native)

## Hỗ trợ

Nếu gặp vấn đề trong quá trình cài đặt hoặc sử dụng, vui lòng tạo issue trên GitHub repository.

## License

MIT License 