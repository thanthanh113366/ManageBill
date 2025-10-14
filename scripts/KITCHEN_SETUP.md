# 🍳 HƯỚNG DẪN SETUP HỆ THỐNG QUẢN LÝ BẾP

## 📋 **TỔNG QUAN**

Hệ thống quản lý bếp được tích hợp vào trang "Quản lý đơn hàng" với pop-up tối ưu hóa thứ tự làm món.

## 🚀 **CÁC BƯỚC SETUP**

### **1. Chạy Migration Script**

```bash
npm run migrate:kitchen
```

Script này sẽ:
- Tạo collection `menuItemTimings` 
- Set giá trị mặc định cho tất cả món:
  - `kitchenType: "cook"` (tất cả món = nấu)
  - `estimatedTime: 2` (2 phút)
  - `priority: 1` (ưu tiên cao)
  - `speed: "medium"` (tốc độ vừa)

### **2. Kiểm tra Database**

Sau khi chạy migration, kiểm tra trong Firebase Console:
- Collection `menuItemTimings` đã được tạo
- Mỗi món trong `menuItems` có 1 record tương ứng

### **3. Sử dụng hệ thống**

1. **Truy cập**: Vào trang "Quản lý đơn hàng"
2. **Mở bếp**: Click button "🍳 Quản lý bếp" (màu cam)
3. **Xem món**: Pop-up hiển thị danh sách món theo thứ tự ưu tiên
4. **Tương tác**: 
   - Click "Bắt đầu làm" → Món chuyển sang "Đang làm"
   - Click "Hoàn thành" → Món chuyển sang "Hoàn thành"

## 🧮 **THUẬT TOÁN TỐI ƯU**

### **Công thức tính điểm ưu tiên:**
```
Score = 1000 
  - (Thời gian chờ × 10)      // Món chờ lâu = điểm cao
  - (Số thứ tự bill × 5)      // Bill đặt trước = điểm cao  
  + (Số lượng × 2)            // Số lượng nhiều = điểm cao
  + ((4 - Priority) × 50)     // Priority cao = điểm cao
```

### **Thứ tự ưu tiên:**
1. **Điểm cao nhất** → Làm trước
2. **Cùng điểm** → Bill đặt trước làm trước
3. **Real-time update** khi có thay đổi

## 📊 **TÍNH NĂNG**

### **Hiển thị:**
- ✅ Danh sách món theo thứ tự ưu tiên
- ✅ Thông tin: Bàn, tên món, số lượng, thời gian dự kiến
- ✅ Trạng thái: Chờ làm / Đang làm / Hoàn thành
- ✅ Score ưu tiên (để debug)

### **Lọc:**
- ✅ Lọc theo bàn cụ thể
- ✅ Xem tất cả bàn

### **Thống kê:**
- ✅ Tổng số món
- ✅ Số món chờ làm
- ✅ Số món đang làm  
- ✅ Số món hoàn thành

### **Real-time:**
- ✅ Cập nhật khi có đơn mới
- ✅ Cập nhật khi bếp thay đổi trạng thái
- ✅ Delay ≤ 5 giây

## 🔧 **TÙY CHỈNH**

### **Thay đổi thời gian món:**
```javascript
// Trong Firebase Console, edit collection menuItemTimings
{
  estimatedTime: 5  // Thay đổi từ 2 phút thành 5 phút
}
```

### **Thay đổi priority:**
```javascript
// Priority: 1 = cao, 2 = vừa, 3 = thấp
{
  priority: 2  // Thay đổi từ 1 (cao) thành 2 (vừa)
}
```

### **Thay đổi loại bếp:**
```javascript
// Hiện tại tất cả = "cook", có thể thay thành "grill"
{
  kitchenType: "grill"  // Món nướng
}
```

## 🐛 **TROUBLESHOOTING**

### **Lỗi "Không có món nào":**
1. Kiểm tra có bills trong ngày hôm nay không
2. Kiểm tra bills có `kitchenStatus: "pending"` không
3. Kiểm tra items có `kitchenStatus: "pending"` không

### **Lỗi "Lỗi tải thông tin timing":**
1. Chạy lại migration: `npm run migrate:kitchen`
2. Kiểm tra collection `menuItemTimings` có tồn tại không

### **Lỗi Real-time không cập nhật:**
1. Kiểm tra kết nối Firebase
2. Refresh trang
3. Kiểm tra Firestore rules

## 📈 **PLANS TƯƠNG LAI**

- [ ] Thêm âm thanh thông báo
- [ ] Export báo cáo hiệu suất bếp
- [ ] Thêm loại bếp "nướng" vs "nấu"
- [ ] Tối ưu thuật toán với machine learning
- [ ] Mobile app cho bếp

## 🎯 **LƯU Ý QUAN TRỌNG**

1. **billOrder**: Bạn cần tự tạo field này trong bills
2. **Real-time**: Chỉ refresh khi có thay đổi thực sự
3. **Performance**: Thuật toán được tối ưu cho ≤ 100 món/ngày
4. **Backup**: Nên backup database trước khi chạy migration

---

**🎉 Chúc bạn sử dụng hệ thống hiệu quả!**
