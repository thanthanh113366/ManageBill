# Script Migration - Thêm Category cho Menu Items

## Mục đích
Script này được tạo để thêm trường `category` với giá trị mặc định `"oc"` vào tất cả các món ăn hiện có trong Firebase Firestore collection `menuItems`.

## Tại sao cần script này?
- Ứng dụng ban đầu không có chức năng phân loại món ăn
- Code mới đã thêm trường `category` bắt buộc
- Cần migrate dữ liệu cũ để tương thích với code mới

## Cách sử dụng

### Phương pháp 1: Sử dụng npm script (Khuyến nghị)
```bash
npm run migrate:categories
```

### Phương pháp 2: Chạy trực tiếp bằng Node
```bash
node scripts/migrate-categories-simple.js
```

### Phương pháp 3: Sử dụng config riêng
1. Cập nhật Firebase config trong `scripts/migrate-categories.js`
2. Chạy: `node scripts/migrate-categories.js`

## Kết quả mong đợi
```
🔧 Script Migration - Thêm Category cho Menu Items
💡 Script này sử dụng config Firebase từ src/config/firebase.js

🚀 Bắt đầu migration thêm category cho menuItems...
📋 Tìm thấy 5 món ăn cần cập nhật
✅ Đã cập nhật "Ốc hương luộc" với category: "oc"
✅ Đã cập nhật "Ốc len xào" với category: "oc"
⏭️  Bỏ qua "Cơm tấm" - đã có category: an_no
...

🎉 HOÀN THÀNH MIGRATION!
✅ Đã cập nhật: 3 món ăn
⏭️  Đã bỏ qua: 2 món ăn (đã có category)
📊 Tổng cộng: 5 món ăn

✨ Script hoàn thành! Bạn có thể xóa thư mục scripts sau khi chạy.
```

## Lưu ý quan trọng
- ⚠️ **Script này chỉ chạy một lần** - sau khi hoàn thành, có thể xóa thư mục `scripts`
- 🔒 **An toàn**: Script sẽ bỏ qua những món đã có category
- 🛡️ **Backup**: Nên backup Firestore trước khi chạy (tùy chọn)
- 🕒 **Delay**: Script có delay 100ms giữa các lần update để tránh quá tải Firebase

## Sau khi chạy script
1. Tất cả món ăn cũ sẽ có `category: "oc"`
2. Vào trang "Quản lý menu" để chỉnh sửa category cho từng món theo ý muốn
3. Các category có sẵn:
   - `oc` - Ốc
   - `an_no` - Ăn no  
   - `an_choi` - Ăn chơi
   - `lai_rai` - Lai rai
   - `giai_khat` - Giải khát

## Troubleshooting
- Nếu gặp lỗi "Firebase config", kiểm tra file `src/config/firebase.js`
- Nếu lỗi permission, kiểm tra Firestore Security Rules
- Nếu script không chạy, đảm bảo đã `npm install` đầy đủ dependencies 