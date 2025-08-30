# 🚨 GIẢI QUYẾT LỖI AUTHENTICATION

## Lỗi: "Ứng dụng đang trong giai đoạn thử nghiệm"

**Thông báo đầy đủ**: 
> "Tools For BroSis Website chưa hoàn tất quy trình xác minh của Google. Ứng dụng này đang trong giai đoạn thử nghiệm và chỉ những người thử nghiệm mà nhà phát triển đã phê duyệt mới truy cập được."

## 🎯 Giải pháp NHANH NHẤT (5 phút)

### Bước 1: Truy cập Google Cloud Console
1. Mở https://console.cloud.google.com/
2. Chọn project của bạn (tên project tạo cho extension)

### Bước 2: Cập nhật OAuth Consent Screen
1. Vào **APIs & Services** > **OAuth consent screen**
2. Click **EDIT APP**
3. Điền thông tin bắt buộc:
   - **App name**: "Web Table to Sheets Exporter"
   - **User support email**: email của bạn
   - **App logo**: (tùy chọn, có thể bỏ qua)
   - **App domain - Homepage**: Chọn một trong các tùy chọn sau:
     - `https://github.com/yourusername/web-table-to-sheets-exporter` (thay yourusername)
     - `https://your-website.com` (nếu bạn có website)
     - `https://pages.github.com/yourusername` (GitHub Pages)
   - **App domain - Privacy policy**: Chọn một trong các tùy chọn sau:
     - `https://github.com/yourusername/web-table-to-sheets-exporter/blob/main/PRIVACY_POLICY.md`
     - `https://your-website.com/privacy-policy` (nếu bạn có website)
     - Tạo Gist: Copy nội dung từ `PRIVACY_POLICY.md` → tạo public gist tại https://gist.github.com
   - **Developer contact information**: email của bạn
4. Click **Save and Continue**

### TÙY CHỌN NHANH: Sử dụng placeholder URLs
Nếu bạn không có website, có thể dùng:
- **Homepage**: `https://example.com`
- **Privacy Policy**: `https://example.com/privacy`

⚠️ **Lưu ý**: Google có thể review các URLs này, nên tốt nhất là tạo GitHub repository thực.

### Bước 3: Publish OAuth Consent Screen
1. Bạn sẽ thấy status "Testing" 
2. Click nút **PUBLISH APP** (màu xanh)
3. Popup sẽ hiện ra, click **Confirm**
4. Status sẽ chuyển thành "In production"

### Bước 4: Test lại Extension
1. Quay lại Chrome extension
2. Click **Connect to Google**
3. Lần này sẽ không có cảnh báo nữa!

---

## 🔧 Tùy chọn khác: Tạo GitHub Repository (5 phút)

Nếu bạn muốn tạo URLs chính thức cho extension:

### Bước 1: Tạo GitHub Repository
1. Truy cập https://github.com/new
2. **Repository name**: `web-table-to-sheets-exporter`
3. Chọn **Public**
4. Check ✅ **Add a README file**
5. Click **Create repository**

### Bước 2: Upload files
1. Click **uploading an existing file**
2. Drag & drop tất cả files từ extension folder
3. Commit changes

### Bước 3: Sử dụng URLs
- **Homepage**: `https://github.com/yourusername/web-table-to-sheets-exporter`
- **Privacy Policy**: `https://github.com/yourusername/web-table-to-sheets-exporter/blob/main/PRIVACY_POLICY.md`

---

## 🔧 Giải pháp TẠM THỜI (nếu không muốn publish)

### Thêm Test Users
1. Trong **OAuth consent screen** > **Test users**
2. Click **+ ADD USERS**
3. Nhập email của bạn (và email của team nếu có)
4. Click **Save**
5. Test lại extension

**Hạn chế**: 
- Chỉ có thể thêm tối đa 100 test users
- Refresh token có thể hết hạn sau 7 ngày

---

## ❓ Tại sao lỗi này xảy ra?

Google yêu cầu tất cả OAuth applications phải được "verify" trước khi cho phép public access. Khi app ở trạng thái "Testing", chỉ có:
- Chính tài khoản developer 
- Test users được thêm thủ công

mới có thể sử dụng được.

## ✅ Sau khi Publish

- ✅ Bất kỳ ai cũng có thể sử dụng extension
- ✅ Không cần thêm test users
- ✅ Tokens ổn định hơn
- ⚠️ Google có thể review app (hiếm khi xảy ra với Sheets API cơ bản)

## 🛠️ Nếu vẫn gặp vấn đề

1. **Kiểm tra email**: Đảm bảo email bạn đang dùng để authenticate trùng với email owner của Google Cloud Project

2. **Clear browser cache**: 
   - Vào `chrome://settings/content/cookies`
   - Xóa cookies cho `accounts.google.com`

3. **Retry authentication**: Logout khỏi extension và login lại

4. **Check Console**: Mở DevTools > Console để xem error details

---

**Tóm tắt**: Click **PUBLISH APP** là cách nhanh nhất và ổn định nhất! 🎉
