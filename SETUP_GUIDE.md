# Hướng dẫn setup Google APIs cho Chrome Extension

## 1. Tạo Google Cloud Project

### Bước 1: Truy cập Google Cloud Console

- Mở https://console.cloud.google.com/
- Đăng nhập bằng tài khoản Google

### Bước 2: Tạo Project mới

1. Click vào dropdown project ở góc trên bên trái
2. Click "New Project"
3. Nhập tên project: "Web-Table-Sheets-Exporter"
4. Chọn organization (nếu có)
5. Click "Create"

## 2. Bật APIs cần thiết

### Bước 1: Bật Google Sheets API

1. Trong Google Cloud Console, vào **APIs & Services** > **Library**
2. Tìm kiếm "Google Sheets API"
3. Click vào "Google Sheets API"
4. Click **Enable**

### Bước 2: Bật Google Drive API

1. Trong **APIs & Services** > **Library**
2. Tìm kiếm "Google Drive API"
3. Click vào "Google Drive API"
4. Click **Enable**

## 3. Tạo OAuth2.0 Credentials

### Bước 1: Cấu hình OAuth consent screen

1. Vào **APIs & Services** > **OAuth consent screen**
2. **QUAN TRỌNG**: Chọn **External** (không chọn Internal trừ khi bạn có Google Workspace)
3. Click **Create**
4. Điền thông tin:
   - **App name**: "Web Table to Sheets Exporter"  
   - **User support email**: email của bạn
   - **App logo**: (tùy chọn, có thể bỏ qua)
   - **App domain - Homepage**: `https://github.com/yourusername/web-table-to-sheets-exporter` (thay yourusername)
   - **App domain - Privacy policy**: `https://github.com/yourusername/web-table-to-sheets-exporter/blob/main/PRIVACY_POLICY.md`
   - **Developer contact information**: email của bạn
5. Click **Save and Continue**
6. Trong **Scopes**, click **Add or Remove Scopes**
7. Thêm scopes:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/drive.readonly`
8. Click **Save and Continue**
9. **QUAN TRỌNG**: Trong **Test users**, thêm email của bạn và tất cả users sẽ sử dụng extension
10. Click **Save and Continue**
11. Review và click **Back to Dashboard**

### 🚨 GIẢI QUYẾT LỖI: "Ứng dụng đang trong giai đoạn thử nghiệm"

**Tùy chọn A: Publish App (Khuyến nghị cho sử dụng rộng rãi)**
1. Trong **OAuth consent screen**, click **PUBLISH APP**  
2. Click **Confirm**
3. App sẽ chuyển sang trạng thái **In production**
4. **Lưu ý**: Google có thể yêu cầu verification cho một số scopes nhạy cảm, nhưng với Sheets API basic thường không cần

**Tùy chọn B: Thêm Test Users (Giải pháp tạm thời)**
1. Trong **OAuth consent screen** > **Test users**
2. Click **Add users**  
3. Thêm email của tất cả người sẽ sử dụng extension
4. Click **Save**
5. **Hạn chế**: Chỉ có thể có tối đa 100 test users và token hết hạn sau 7 ngày

### Bước 2: Tạo OAuth Client ID

1. Vào **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Chọn **Application type**: **Chrome extension**
4. Nhập **Name**: "Web Table Sheets Exporter"
5. **Application ID**: để trống (sẽ điền sau)
6. Click **Create**
7. **LÀM GÌ VỚI CLIENT ID**: Copy và lưu lại Client ID

## 4. Cấu hình Extension

### Bước 1: Cập nhật manifest.json

Mở file `manifest.json` và thay đổi:

```json
{
  "oauth2": {
    "client_id": "PASTE_CLIENT_ID_Ở_ĐÂY.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  }
}
```

**Ví dụ**:

```json
{
  "oauth2": {
    "client_id": "123456789012-abcdefghijklmnop123456789012abcd.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  }
}
```

## 5. Load Extension và lấy Extension ID

### Bước 1: Load Extension

1. Mở Chrome browser
2. Vào `chrome://extensions/`
3. Bật **Developer mode** (toggle ở góc trên bên phải)
4. Click **Load unpacked**
5. Chọn thư mục chứa extension (thư mục có file manifest.json)
6. Extension sẽ xuất hiện trong danh sách

### Bước 2: Copy Extension ID

1. Tìm extension vừa load trong danh sách
2. Copy **ID** (chuỗi 32 ký tự)
   - Ví dụ: `abcdefghijklmnopqrstuvwxyz123456`

## 6. Cập nhật OAuth Client với Extension ID

### Bước 1: Quay lại Google Cloud Console

1. Vào **APIs & Services** > **Credentials**
2. Click vào OAuth client ID vừa tạo (tên "Web Table Sheets Exporter")

### Bước 2: Cập nhật Application ID

1. Trong **Application ID**, paste Extension ID vừa copy
2. Click **Save**

## 7. Test Extension

### Bước 1: Test Authentication

1. Click vào icon extension trên thanh toolbar Chrome
2. Click nút **Connect to Google**
3. Sẽ mở popup OAuth của Google
4. Chọn tài khoản Google
5. Cho phép quyền truy cập
6. Nếu thành công, sẽ hiện "Successfully authenticated!"

### Bước 2: Test Google Sheet Integration

1. Tạo một Google Sheet mới
2. Copy URL của sheet
3. Trong extension popup, paste URL vào ô "Google Sheet URL"
4. Click **Save Sheet URL**
5. Nếu thành công, nút **Open Google Sheet** sẽ active

## 8. Troubleshooting thường gặp

### ❌ Lỗi: "Ứng dụng đang trong giai đoạn thử nghiệm" 

**Thông báo**: "Tools For BroSis Website chưa hoàn tất quy trình xác minh của Google. Ứng dụng này đang trong giai đoạn thử nghiệm..."

**Nguyên nhân**: OAuth consent screen chưa được publish

**Giải pháp nhanh**:
1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** > **OAuth consent screen**
3. Click **PUBLISH APP**
4. Click **Confirm**
5. Thử authenticate lại

**Giải pháp tạm thời** (nếu không muốn publish):
1. Trong **OAuth consent screen** > **Test users**
2. Click **Add users**
3. Thêm email của bạn
4. Click **Save**
5. Thử authenticate lại

### ❌ Lỗi: "OAuth2 not configured"

- **Nguyên nhân**: Client ID chưa được cấu hình đúng
- **Giải pháp**: Kiểm tra lại Client ID trong manifest.json

### ❌ Lỗi: "redirect_uri_mismatch"

- **Nguyên nhân**: Extension ID chưa được cập nhật trong OAuth client
- **Giải pháp**: Cập nhật lại Application ID trong Google Cloud Console

### Lỗi: "invalid_client"

- **Nguyên nhân**: Client ID không đúng hoặc không tồn tại
- **Giải pháp**: Tạo lại OAuth client ID

### Lỗi: "access_denied"

- **Nguyên nhân**: User từ chối cấp quyền hoặc app chưa được approve
- **Giải pháp**:
  - Thêm email test user trong OAuth consent screen
  - Publish app nếu cần sử dụng rộng rãi

### Extension không hiện trong Chrome

- **Nguyên nhân**: Lỗi trong manifest.json
- **Giải pháp**:
  - Kiểm tra syntax JSON
  - Xem lỗi trong chrome://extensions/
  - Đảm bảo tất cả file cần thiết đều có

## 9. Publish Extension (Tùy chọn)

Nếu muốn publish lên Chrome Web Store:

1. Zip toàn bộ folder extension
2. Truy cập Chrome Web Store Developer Dashboard
3. Upload file zip
4. Điền thông tin extension
5. Submit để review

**Lưu ý**: Khi publish, OAuth consent screen phải được verify bởi Google.

## 10. Security Best Practices

1. **Không commit Client ID**: Đừng push Client ID lên public repository
2. **Sử dụng environment variables**: Cho production apps
3. **Minimum permissions**: Chỉ yêu cầu scopes cần thiết
4. **Regular token refresh**: Extension tự động refresh token

---

**Hoàn thành!** Extension đã sẵn sàng sử dụng. Nếu gặp vấn đề, hãy kiểm tra Console logs và Google Cloud Console logs.
