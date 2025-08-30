# Web Table to Google Sheets Exporter

Chrome Extension để export dữ liệu từ bảng HTML trên website sang Google Sheets.

## 🚀 Tính năng

- **Quản lý Google Sheet**: Lưu và mở link Google Sheet
- **Phát hiện bảng tự động**: Tự động scan và phát hiện bảng HTML trên trang web
- **Chọn cột linh hoạt**: Cho phép chọn cột nào muốn export
- **Export đa dạng**: Export vào sheet bất kỳ với tùy chọn vị trí
- **Bảo mật**: Sử dụng OAuth2.0 với Google APIs

## 📋 Yêu cầu hệ thống

- Google Chrome hoặc Edge (Chromium-based browsers)
- Tài khoản Google
- Google Cloud Project với Sheets API được bật

## 🛠️ Setup Instructions

### Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Bật Google Sheets API:
   - Vào **APIs & Services** > **Library**
   - Tìm "Google Sheets API" và click **Enable**
   - Tìm "Google Drive API" và click **Enable**

### Bước 2: Tạo OAuth2.0 Credentials

1. Vào **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Chọn **Application type**: **Chrome extension**
4. Nhập **Name**: "Web Table to Sheets Exporter"
5. Trong **Item ID**: để trống (sẽ điền sau khi upload extension)
6. Click **Create** và lưu lại **Client ID**

### Bước 3: Cấu hình Extension

1. Mở file `manifest.json`
2. Thay thế `YOUR_GOOGLE_CLIENT_ID` bằng Client ID vừa tạo:
   ```json
   "oauth2": {
     "client_id": "123456789-abc123def456.apps.googleusercontent.com",
     "scopes": [...]
   }
   ```

### Bước 4: Load Extension

1. Mở Chrome và vào `chrome://extensions/`
2. Bật **Developer mode**
3. Click **Load unpacked** và chọn thư mục chứa extension
4. Copy **Extension ID** từ card extension
5. Quay lại Google Cloud Console:
   - Vào **Credentials** > Edit OAuth client
   - Trong **Item ID**: paste Extension ID vừa copy
   - Click **Save**

### Bước 5: Test Extension

1. Click icon extension trên thanh toolbar
2. Click **Connect to Google** để authenticate
3. Paste link Google Sheet vào ô input và click **Save Sheet URL**
4. Truy cập trang web có bảng dữ liệu
5. Click **Scan Current Page** để phát hiện bảng
6. Chọn cột muốn export và click **Export to Google Sheets**

## 📁 Cấu trúc Files

```
├── manifest.json          # Extension manifest (Manifest V3)
├── popup.html             # Giao diện popup
├── popup.js               # Logic xử lý popup
├── content.js             # Script phát hiện và trích xuất dữ liệu bảng
├── background.js          # Service worker xử lý API calls
└── README.md              # Hướng dẫn này
```

## 🔧 Cấu hình nâng cao

### Thay đổi phạm vi quyền (Scopes)

Trong `manifest.json`, bạn có thể điều chỉnh scopes:

```json
"oauth2": {
  "scopes": [
    "https://www.googleapis.com/auth/spreadsheets",      // Đọc/ghi Sheets
    "https://www.googleapis.com/auth/drive.readonly"     // Đọc Drive metadata
  ]
}
```

### Thêm domain hỗ trợ

Trong `content_scripts.matches`, thêm domain cụ thể:

```json
"content_scripts": [
  {
    "matches": [
      "https://example.com/*",
      "https://another-site.com/*"
    ],
    "js": ["content.js"]
  }
]
```

## 🐛 Troubleshooting

### ❌ Lỗi: "Ứng dụng đang trong giai đoạn thử nghiệm"

**Thông báo lỗi**: "Tools For BroSis Website chưa hoàn tất quy trình xác minh của Google..."

**Giải pháp nhanh nhất**:
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** > **OAuth consent screen**
3. Click **PUBLISH APP**
4. Click **Confirm**
5. Thử authentication lại

**Chi tiết**: Xem file `FIX_AUTH_ERROR.md` để biết thêm thông tin.

### Lỗi Authentication khác

- **Lỗi**: "OAuth2 not configured"
  - **Giải pháp**: Kiểm tra Client ID trong manifest.json
  - **Giải pháp**: Đảm bảo Extension ID đã được cập nhật trong Google Cloud Console

### Lỗi API

- **Lỗi**: "Sheets API not enabled"

  - **Giải pháp**: Bật Google Sheets API và Drive API trong Cloud Console

- **Lỗi**: "Insufficient permissions"
  - **Giải pháp**: Kiểm tra scopes trong manifest.json
  - **Giải pháp**: Logout và login lại để refresh permissions

### Lỗi Table Detection

- **Lỗi**: "No tables found"
  - **Giải pháp**: Đảm bảo trang có thẻ `<table>` HTML
  - **Giải pháp**: Refresh trang và thử lại
  - **Giải pháp**: Kiểm tra Console để xem có lỗi JavaScript không

## 📝 Sử dụng

### 1. Cấu hình Google Sheet

1. Tạo Google Sheet mới hoặc mở sheet hiện có
2. Copy URL của sheet
3. Trong extension popup, paste URL và click **Save Sheet URL**

### 2. Export dữ liệu

1. Truy cập trang web có bảng dữ liệu
2. Mở extension popup
3. Click **Scan Current Page**
4. Chọn cột muốn export
5. Chọn sheet đích
6. (Tùy chọn) Nhập số hàng bắt đầu
7. Click **Export to Google Sheets**

## 🔐 Bảo mật

- Extension chỉ yêu cầu quyền cần thiết
- Sử dụng OAuth2.0 tiêu chuẩn Google
- Không lưu trữ dữ liệu nhạy cảm
- Token được refresh tự động

## 📄 License

MIT License - Xem file LICENSE để biết thêm chi tiết

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng:

1. Kiểm tra [Troubleshooting](#-troubleshooting)
2. Mở DevTools Console để xem lỗi
3. Tạo issue trên GitHub với thông tin chi tiết

---

**Lưu ý**: Extension này được phát triển cho mục đích học tập và sử dụng cá nhân. Vui lòng tuân thủ Terms of Service của Google APIs khi sử dụng.
