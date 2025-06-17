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

### 3. Cấu hình Firebase
1. Tạo project mới trên [Firebase Console](https://console.firebase.google.com/)
2. Tạo Firestore Database
3. **Setup Firebase config**:
   ```bash
   # Sao chép file example
   cp src/config/firebase.example.js src/config/firebase.js
   ```
4. Vào Firebase Console > Project Settings > General > Your apps
5. Copy Firebase config và thay thế trong `src/config/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

⚠️ **Lưu ý**: File `firebase.js` đã được thêm vào `.gitignore` để bảo mật API keys

### 4. Cấu hình Firestore Security Rules
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

### 5. Chạy ứng dụng
```bash
npm run dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173`

## Sử dụng

### Đăng nhập
- Mật khẩu mặc định: `quan-oc-2024`
- Có thể thay đổi trong `src/components/PasswordGate.jsx`

### Quy trình làm việc
1. **Thiết lập menu**: Thêm các món ăn vào menu với đầy đủ thông tin giá cả
2. **Tạo đơn hàng**: Chọn món và số lượng, hệ thống tự động tính toán
3. **Quản lý đơn hàng**: Xem và theo dõi các đơn hàng theo ngày
4. **Phân tích báo cáo**: Theo dõi xu hướng kinh doanh qua biểu đồ

## Cấu trúc dữ liệu

### Collection `menuItems`
```javascript
{
  name: "Tên món ăn",
  price: 50000,        // Giá bán (VND)
  tax: 8,              // Thuế (%)
  costPrice: 30000,    // Giá vốn (VND)
  fixedCost: 5000      // Chi phí cố định (VND)
}
```

### Collection `bills`
```javascript
{
  createdAt: timestamp,
  date: "2024-01-15",           // YYYY-MM-DD
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