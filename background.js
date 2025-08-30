// background.js - Service Worker cho Manifest V3
// Xử lý authentication và API calls đến Google Sheets

// Google Sheets API configuration
const GOOGLE_SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

// Global variables để lưu access token
let accessToken = null;

// Lắng nghe messages từ popup và content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "authenticate":
      handleAuthentication(sendResponse);
      break;
    case "checkAuth":
      checkAuthStatus(sendResponse);
      break;
    case "logout":
      handleLogout(sendResponse);
      break;
    case "getSheetInfo":
      getSheetInfo(request.sheetId, sendResponse);
      break;
    case "exportToSheets":
      exportToGoogleSheets(request, sendResponse);
      break;
    default:
      sendResponse({ success: false, error: "Unknown action" });
  }
  return true; // Giữ kết nối cho async operations
});

/**
 * Xử lý authentication với Google OAuth2
 */
async function handleAuthentication(sendResponse) {
  try {
    console.log("Starting authentication process...");

    // Sử dụng Chrome Identity API để lấy OAuth token
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken(
        {
          interactive: true,
          scopes: [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.readonly",
          ],
        },
        (token) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Chrome Identity API error:",
              chrome.runtime.lastError
            );

            // Kiểm tra các loại lỗi thường gặp
            const errorMessage = chrome.runtime.lastError.message;

            if (errorMessage.includes("OAuth2 not granted or revoked")) {
              reject(
                new Error(
                  "OAuth2 permissions not granted. Please check OAuth consent screen configuration."
                )
              );
            } else if (errorMessage.includes("OAuth2 client not found")) {
              reject(
                new Error(
                  "OAuth2 client not found. Please check Client ID in manifest.json."
                )
              );
            } else if (errorMessage.includes("redirect_uri_mismatch")) {
              reject(
                new Error(
                  "Redirect URI mismatch. Please update Extension ID in Google Cloud Console."
                )
              );
            } else if (errorMessage.includes("access_denied")) {
              reject(
                new Error(
                  "Access denied. App may be in testing mode. Please publish OAuth consent screen or add test users."
                )
              );
            } else {
              reject(new Error(`Authentication failed: ${errorMessage}`));
            }
          } else {
            console.log("Authentication successful, token received");
            resolve(token);
          }
        }
      );
    });

    accessToken = token;

    // Lưu token vào storage để sử dụng sau
    await chrome.storage.local.set({
      accessToken: token,
      tokenTimestamp: Date.now(),
    });

    console.log("Token saved to storage");

    sendResponse({
      success: true,
      message: "Authentication successful",
    });
  } catch (error) {
    console.error("Authentication error:", error);

    // Cung cấp thông tin hữu ích cho user
    let userFriendlyMessage = error.message;

    if (error.message.includes("testing mode")) {
      userFriendlyMessage = `
Authentication failed: App is in testing mode.

Quick fix:
1. Go to Google Cloud Console
2. APIs & Services > OAuth consent screen  
3. Click "PUBLISH APP"
4. Try authentication again

Or add your email as test user if you prefer to keep it in testing mode.
      `.trim();
    }

    sendResponse({
      success: false,
      error: userFriendlyMessage,
      originalError: error.message,
    });
  }
}

/**
 * Kiểm tra trạng thái authentication
 */
async function checkAuthStatus(sendResponse) {
  try {
    // Kiểm tra token trong storage
    const result = await chrome.storage.local.get([
      "accessToken",
      "tokenTimestamp",
    ]);

    if (result.accessToken) {
      // Kiểm tra token còn hợp lệ không (Google tokens thường hết hạn sau 1 giờ)
      const tokenAge = Date.now() - (result.tokenTimestamp || 0);
      const isTokenExpired = tokenAge > 50 * 60 * 1000; // 50 phút

      if (!isTokenExpired) {
        accessToken = result.accessToken;
        sendResponse({ authenticated: true });
        return;
      }
    }

    // Token hết hạn hoặc không tồn tại, thử refresh
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
          {
            interactive: false, // Không hiện UI, chỉ refresh
          },
          (token) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(token);
            }
          }
        );
      });

      if (token) {
        accessToken = token;
        await chrome.storage.local.set({
          accessToken: token,
          tokenTimestamp: Date.now(),
        });
        sendResponse({ authenticated: true });
      } else {
        sendResponse({ authenticated: false });
      }
    } catch (refreshError) {
      sendResponse({ authenticated: false });
    }
  } catch (error) {
    console.error("Error checking auth status:", error);
    sendResponse({ authenticated: false });
  }
}

/**
 * Xử lý logout
 */
async function handleLogout(sendResponse) {
  try {
    // Xóa token khỏi storage
    await chrome.storage.local.remove(["accessToken", "tokenTimestamp"]);

    // Revoke token trên Google
    if (accessToken) {
      chrome.identity.removeCachedAuthToken({ token: accessToken });
      accessToken = null;
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Lấy thông tin về Google Sheet (danh sách sheets)
 */
async function getSheetInfo(sheetId, sendResponse) {
  try {
    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    // Gọi Google Sheets API để lấy metadata
    const response = await fetch(
      `${GOOGLE_SHEETS_API_BASE}/${sheetId}?fields=sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    // Trích xuất thông tin các sheets
    const sheets =
      data.sheets?.map((sheet) => ({
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title,
        index: sheet.properties.index,
      })) || [];

    sendResponse({
      success: true,
      sheets: sheets,
    });
  } catch (error) {
    console.error("Error getting sheet info:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Export dữ liệu lên Google Sheets
 */
async function exportToGoogleSheets(request, sendResponse) {
  try {
    const { sheetId, sheetName, data, startRow, startColumn } = request;

    if (!accessToken) {
      throw new Error("Not authenticated");
    }

    if (!data || data.length === 0) {
      throw new Error("No data to export");
    }

    // Xác định range để ghi dữ liệu
    let range;
    const column = startColumn || "A"; // Default to column A if not specified

    if (startRow) {
      // Nếu có startRow, ghi từ hàng đó và cột được chỉ định
      range = `${sheetName}!${column}${startRow}`;
    } else {
      // Nếu không có startRow, tìm hàng trống tiếp theo
      const nextRow = await findNextEmptyRow(sheetId, sheetName);
      range = `${sheetName}!${column}${nextRow}`;
    }

    console.log("Export range:", range);

    // Prepare data for Google Sheets API
    const requestBody = {
      values: data,
      majorDimension: "ROWS",
    };

    // Gọi Google Sheets API để ghi dữ liệu
    const response = await fetch(
      `${GOOGLE_SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(
        range
      )}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();

    sendResponse({
      success: true,
      message: `Successfully exported ${data.length} rows to ${sheetName} starting at ${range}`,
      details: result,
    });
  } catch (error) {
    console.error("Error exporting to Google Sheets:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Tìm hàng trống tiếp theo trong sheet
 */
async function findNextEmptyRow(sheetId, sheetName) {
  try {
    // Lấy tất cả dữ liệu trong cột A để tìm hàng cuối cùng có dữ liệu
    const response = await fetch(
      `${GOOGLE_SHEETS_API_BASE}/${sheetId}/values/${encodeURIComponent(
        sheetName + "!A:A"
      )}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      // Nếu không lấy được dữ liệu, mặc định bắt đầu từ hàng 1
      return 1;
    }

    const data = await response.json();
    const values = data.values || [];

    // Trả về hàng tiếp theo sau hàng cuối cùng có dữ liệu
    return values.length + 1;
  } catch (error) {
    console.error("Error finding next empty row:", error);
    // Mặc định trả về hàng 1 nếu có lỗi
    return 1;
  }
}

/**
 * Utility function để làm mới token khi hết hạn
 */
async function refreshTokenIfNeeded() {
  try {
    const result = await chrome.storage.local.get(["tokenTimestamp"]);
    const tokenAge = Date.now() - (result.tokenTimestamp || 0);

    // Refresh token nếu sắp hết hạn (sau 45 phút)
    if (tokenAge > 45 * 60 * 1000) {
      const newToken = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
          {
            interactive: false,
          },
          (token) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(token);
            }
          }
        );
      });

      if (newToken) {
        accessToken = newToken;
        await chrome.storage.local.set({
          accessToken: newToken,
          tokenTimestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
  }
}

// Khởi tạo khi extension được load
chrome.runtime.onStartup.addListener(async () => {
  // Khôi phục token từ storage nếu có
  try {
    const result = await chrome.storage.local.get(["accessToken"]);
    if (result.accessToken) {
      accessToken = result.accessToken;
    }
  } catch (error) {
    console.error("Error restoring token:", error);
  }
});

// Refresh token định kỳ
setInterval(refreshTokenIfNeeded, 30 * 60 * 1000); // Mỗi 30 phút

// Xử lý khi extension được install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Web Table to Google Sheets Exporter installed");

    // Mở trang hướng dẫn setup (tùy chọn)
    // chrome.tabs.create({
    //     url: 'https://github.com/your-repo/setup-guide'
    // });
  }
});
