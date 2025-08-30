# Hướng dẫn nhanh: Tạo GitHub Repository cho Extension

## 🎯 Mục đích

Tạo GitHub repository để có Homepage và Privacy Policy URLs cho OAuth consent screen.

## ⚡ Các bước thực hiện (5 phút)

### Bước 1: Tạo Repository

1. Truy cập https://github.com/new
2. **Repository name**: `web-table-to-sheets-exporter`
3. **Description**: "Chrome Extension to export web table data to Google Sheets"
4. Chọn **📁 Public** (bắt buộc để Google có thể truy cập)
5. Check ✅ **Add a README file**
6. Click **Create repository**

### Bước 2: Upload Extension Files

1. Trong repository vừa tạo, click **uploading an existing file**
2. Drag & drop TẤT CẢ files từ extension folder:
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `content.js`
   - `background.js`
   - `README.md`
   - `PRIVACY_POLICY.md`
   - `SETUP_GUIDE.md`
   - `FIX_AUTH_ERROR.md`
   - `package.json`
3. **Commit message**: "Initial commit - Chrome Extension files"
4. Click **Commit changes**

### Bước 3: Lấy URLs

Sau khi upload xong, bạn sẽ có:

✅ **Homepage URL**:

```
https://github.com/yourusername/web-table-to-sheets-exporter
```

✅ **Privacy Policy URL**:

```
https://github.com/yourusername/web-table-to-sheets-exporter/blob/main/PRIVACY_POLICY.md
```

### Bước 4: Cập nhật OAuth Consent Screen

1. Quay lại [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** > **OAuth consent screen**
3. Click **EDIT APP**
4. Paste 2 URLs vừa lấy vào:
   - **App domain - Homepage**: URL từ Bước 3
   - **App domain - Privacy policy**: URL từ Bước 3
5. Click **Save and Continue**
6. Click **PUBLISH APP**

## 🔥 Bonus: Làm đẹp README

Nếu muốn README.md đẹp hơn, edit file trên GitHub:

```markdown
# Web Table to Google Sheets Exporter

Chrome Extension để export dữ liệu từ bảng HTML trên website sang Google Sheets.

## 🚀 Features

- Phát hiện tự động bảng HTML và MUI DataGrid
- Chọn cột linh hoạt để export
- Kết nối trực tiếp với Google Sheets API
- Giao diện thân thiện

## 📦 Installation

1. Download source code
2. Load unpacked extension trong Chrome
3. Follow setup guide

## 🔗 Links

- [Setup Guide](SETUP_GUIDE.md)
- [Privacy Policy](PRIVACY_POLICY.md)
- [Troubleshooting](FIX_AUTH_ERROR.md)
```

## ✅ Kết quả

- ✅ Repository public với đầy đủ files
- ✅ Homepage và Privacy Policy URLs hợp lệ
- ✅ Google có thể truy cập và verify
- ✅ Sẵn sàng publish OAuth consent screen

**Tổng thời gian**: ~5 phút
**Kết quả**: Extension có thể authenticate không giới hạn users! 🎉
