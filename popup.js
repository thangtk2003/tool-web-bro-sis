// popup.js - Xử lý giao diện popup của extension

document.addEventListener("DOMContentLoaded", function () {
  // Khởi tạo các element
  const sheetUrlInput = document.getElementById("sheetUrl");
  const saveSheetUrlBtn = document.getElementById("saveSheetUrl");
  const openSheetBtn = document.getElementById("openSheet");
  const sheetInfo = document.getElementById("sheetInfo");

  const authenticateBtn = document.getElementById("authenticate");
  const logoutBtn = document.getElementById("logout");
  const authStatus = document.getElementById("authStatus");

  const detectTablesBtn = document.getElementById("detectTables");
  const tableStatus = document.getElementById("tableStatus");
  const columnSelection = document.getElementById("columnSelection");
  const columnList = document.getElementById("columnList");

  const exportSection = document.getElementById("exportSection");
  const targetSheetSelect = document.getElementById("targetSheet");
  const startRowInput = document.getElementById("startRow");
  const includeHeadersCheckbox = document.getElementById("includeHeaders");
  const exportDataBtn = document.getElementById("exportData");
  const exportStatus = document.getElementById("exportStatus");

  let detectedTables = [];
  let selectedColumns = {};

  // Khởi tạo khi popup mở
  initialize();

  async function initialize() {
    await loadSavedSheetUrl();
    await checkAuthStatus();
  }

  // ===========================================
  // GOOGLE SHEET URL MANAGEMENT
  // ===========================================

  // Lưu URL Google Sheet
  saveSheetUrlBtn.addEventListener("click", async function () {
    const url = sheetUrlInput.value.trim();

    if (!url) {
      showStatus(sheetInfo, "Please enter a Google Sheet URL", "error");
      return;
    }

    // Validate Google Sheets URL
    if (!isValidGoogleSheetUrl(url)) {
      showStatus(sheetInfo, "Please enter a valid Google Sheets URL", "error");
      return;
    }

    try {
      // Extract sheet ID from URL
      const sheetId = extractSheetId(url);

      // Save to storage
      await chrome.storage.sync.set({
        sheetUrl: url,
        sheetId: sheetId,
      });

      openSheetBtn.disabled = false;
      showStatus(
        sheetInfo,
        `Sheet saved successfully! ID: ${sheetId}`,
        "success"
      );

      // Load sheet information if authenticated
      if (await isAuthenticated()) {
        await loadSheetInfo(sheetId);
      }
    } catch (error) {
      console.error("Error saving sheet URL:", error);
      showStatus(sheetInfo, "Error saving sheet URL", "error");
    }
  });

  // Mở Google Sheet trong tab mới
  openSheetBtn.addEventListener("click", async function () {
    try {
      const result = await chrome.storage.sync.get(["sheetUrl"]);
      if (result.sheetUrl) {
        chrome.tabs.create({ url: result.sheetUrl });
      }
    } catch (error) {
      console.error("Error opening sheet:", error);
    }
  });

  // Load saved sheet URL
  async function loadSavedSheetUrl() {
    try {
      const result = await chrome.storage.sync.get(["sheetUrl", "sheetId"]);
      if (result.sheetUrl) {
        sheetUrlInput.value = result.sheetUrl;
        openSheetBtn.disabled = false;
        showStatus(
          sheetInfo,
          `Loaded saved sheet: ${result.sheetId}`,
          "success"
        );
      }
    } catch (error) {
      console.error("Error loading saved sheet URL:", error);
    }
  }

  // ===========================================
  // AUTHENTICATION
  // ===========================================

  // Authenticate with Google
  authenticateBtn.addEventListener("click", async function () {
    try {
      showStatus(authStatus, "Authenticating...", "");
      authenticateBtn.disabled = true;

      const response = await chrome.runtime.sendMessage({
        action: "authenticate",
      });

      if (response.success) {
        showStatus(authStatus, "Successfully authenticated!", "success");
        authenticateBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";

        // Load sheet info if URL is available
        const result = await chrome.storage.sync.get(["sheetId"]);
        if (result.sheetId) {
          await loadSheetInfo(result.sheetId);
        }
      } else {
        throw new Error(response.error || "Authentication failed");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      
      // Hiển thị error message với formatting tốt hơn
      let errorMessage = error.message;
      
      // Nếu là lỗi về testing mode, hiển thị HTML formatting
      if (errorMessage.includes('testing mode') || errorMessage.includes('PUBLISH APP')) {
        showDetailedError(authStatus, errorMessage);
      } else {
        showStatus(authStatus, "Authentication failed: " + errorMessage, "error");
      }
    } finally {
      authenticateBtn.disabled = false;
    }
  });

  // Logout
  logoutBtn.addEventListener("click", async function () {
    try {
      await chrome.runtime.sendMessage({ action: "logout" });

      authenticateBtn.style.display = "inline-block";
      logoutBtn.style.display = "none";
      showStatus(authStatus, "Logged out successfully", "success");

      // Clear sheet info
      targetSheetSelect.innerHTML =
        '<option value="">Select a sheet...</option>';
    } catch (error) {
      console.error("Logout error:", error);
    }
  });

  // Check authentication status
  async function checkAuthStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "checkAuth",
      });

      if (response.authenticated) {
        authenticateBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        showStatus(authStatus, "Already authenticated", "success");
      } else {
        authenticateBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        showStatus(authStatus, "Not authenticated", "");
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    }
  }

  // ===========================================
  // TABLE DETECTION
  // ===========================================

  // Detect tables on current page
  detectTablesBtn.addEventListener("click", async function () {
    try {
      showStatus(tableStatus, "Scanning page for tables...", "");
      detectTablesBtn.disabled = true;

      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Send message to content script to detect tables
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "detectTables",
      });

      if (response.success && response.tables.length > 0) {
        detectedTables = response.tables;
        displayTableOptions(response.tables);
        showStatus(
          tableStatus,
          `Found ${response.tables.length} table(s)`,
          "success"
        );
        exportSection.style.display = "block";
      } else {
        showStatus(tableStatus, "No tables found on this page", "error");
        columnSelection.style.display = "none";
        exportSection.style.display = "none";
      }
    } catch (error) {
      console.error("Error detecting tables:", error);
      showStatus(
        tableStatus,
        "Error scanning page. Please refresh the page and try again.",
        "error"
      );
    } finally {
      detectTablesBtn.disabled = false;
    }
  });

  // Display table options for column selection
  function displayTableOptions(tables) {
    columnList.innerHTML = "";
    selectedColumns = {};

    tables.forEach((table, tableIndex) => {
      // Table header
      const tableHeader = document.createElement("div");
      tableHeader.innerHTML = `<strong>Table ${tableIndex + 1} (${
        table.type || "Unknown"
      } - ${table.rows} rows, ${table.columns.length} columns):</strong>`;
      tableHeader.style.marginBottom = "10px";
      tableHeader.style.marginTop = tableIndex > 0 ? "15px" : "0";
      columnList.appendChild(tableHeader);

      // Column checkboxes
      table.columns.forEach((column, columnIndex) => {
        const columnItem = document.createElement("div");
        columnItem.className = "column-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `table_${tableIndex}_col_${columnIndex}`;
        checkbox.checked = true; // Default to selected

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.textContent = `${column} (${columnIndex + 1})`;

        checkbox.addEventListener("change", function () {
          if (!selectedColumns[tableIndex]) {
            selectedColumns[tableIndex] = {};
          }
          selectedColumns[tableIndex][columnIndex] = checkbox.checked;
        });

        // Initialize selected columns
        if (!selectedColumns[tableIndex]) {
          selectedColumns[tableIndex] = {};
        }
        selectedColumns[tableIndex][columnIndex] = true;

        columnItem.appendChild(checkbox);
        columnItem.appendChild(label);
        columnList.appendChild(columnItem);
      });
    });

    columnSelection.style.display = "block";
  }

  // ===========================================
  // EXPORT FUNCTIONALITY
  // ===========================================

  // Export data to Google Sheets
  exportDataBtn.addEventListener("click", async function () {
    try {
      if (!(await isAuthenticated())) {
        showStatus(exportStatus, "Please authenticate first", "error");
        return;
      }

      const targetSheet = targetSheetSelect.value;
      if (!targetSheet) {
        showStatus(exportStatus, "Please select a target sheet", "error");
        return;
      }

      showStatus(exportStatus, "Exporting data...", "");
      exportDataBtn.disabled = true;

      // Get current active tab
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // Get selected table data
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "extractTableData",
        selectedColumns: selectedColumns,
        includeHeaders: includeHeadersCheckbox.checked,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to extract table data");
      }

      // Send data to background script for Google Sheets export
      const result = await chrome.storage.sync.get(["sheetId"]);
      const exportResponse = await chrome.runtime.sendMessage({
        action: "exportToSheets",
        sheetId: result.sheetId,
        sheetName: targetSheet,
        data: response.data,
        startRow: parseInt(startRowInput.value) || null,
      });

      if (exportResponse.success) {
        showStatus(exportStatus, "Data exported successfully!", "success");
      } else {
        throw new Error(exportResponse.error || "Export failed");
      }
    } catch (error) {
      console.error("Export error:", error);
      showStatus(exportStatus, "Export failed: " + error.message, "error");
    } finally {
      exportDataBtn.disabled = false;
    }
  });

  // ===========================================
  // UTILITY FUNCTIONS
  // ===========================================

  // Load sheet information and populate sheet selector
  async function loadSheetInfo(sheetId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getSheetInfo",
        sheetId: sheetId,
      });

      if (response.success && response.sheets) {
        targetSheetSelect.innerHTML =
          '<option value="">Select a sheet...</option>';

        response.sheets.forEach((sheet) => {
          const option = document.createElement("option");
          option.value = sheet.title;
          option.textContent = sheet.title;
          targetSheetSelect.appendChild(option);
        });

        showStatus(
          sheetInfo,
          `Loaded ${response.sheets.length} sheet(s)`,
          "success"
        );
      }
    } catch (error) {
      console.error("Error loading sheet info:", error);
    }
  }

  // Check if user is authenticated
  async function isAuthenticated() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "checkAuth",
      });
      return response.authenticated;
    } catch (error) {
      return false;
    }
  }

  // Validate Google Sheets URL
  function isValidGoogleSheetUrl(url) {
    const googleSheetsRegex =
      /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    return googleSheetsRegex.test(url);
  }

  // Extract Sheet ID from URL
  function extractSheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  // Show status message
  function showStatus(element, message, type) {
    element.textContent = message;
    element.className = "status " + type;

    if (type === "success" || type === "error") {
      setTimeout(() => {
        element.textContent = "";
        element.className = "status";
      }, 5000);
    }
  }

  // Show detailed error with HTML formatting
  function showDetailedError(element, message) {
    // Convert line breaks to HTML
    const htmlMessage = message
      .replace(/\n/g, '<br>')
      .replace(/1\./g, '<strong>1.</strong>')
      .replace(/2\./g, '<strong>2.</strong>')
      .replace(/3\./g, '<strong>3.</strong>')
      .replace(/4\./g, '<strong>4.</strong>')
      .replace(/Quick fix:/g, '<strong style="color: #e74c3c;">Quick fix:</strong>')
      .replace(/PUBLISH APP/g, '<strong style="color: #27ae60;">PUBLISH APP</strong>');
    
    element.innerHTML = htmlMessage;
    element.className = 'status error';
    element.style.whiteSpace = 'normal';
    element.style.lineHeight = '1.4';
    
    // Auto clear after 15 seconds for detailed errors
    setTimeout(() => {
      element.innerHTML = '';
      element.className = 'status';
    }, 15000);
  }
});
