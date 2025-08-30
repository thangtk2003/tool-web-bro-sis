// content.js - Script chạy trên trang web để phát hiện và trích xuất dữ liệu từ bảng

// Lắng nghe message từ popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "detectTables") {
    detectTables(sendResponse);
    return true; // Giữ kết nối để response async
  } else if (request.action === "extractTableData") {
    extractTableData(request, sendResponse);
    return true;
  }
});

/**
 * Phát hiện các bảng HTML trên trang (bao gồm cả MuiDataGrid)
 */
function detectTables(sendResponse) {
  try {
    const tableData = [];
    let tableIndex = 0;

    // 1. Phát hiện HTML tables truyền thống
    const htmlTables = document.querySelectorAll("table");
    htmlTables.forEach((table) => {
      const tableInfo = detectHtmlTable(table, tableIndex, "HTML Table");
      if (tableInfo) {
        tableData.push(tableInfo);
        tableIndex++;
      }
    });

    // 2. Phát hiện MuiDataGrid (Material-UI DataGrid) - CHỈ LẤY ROOT ELEMENTS
    const muiDataGrids = document.querySelectorAll(
      '.MuiDataGrid-root, [class*="MuiDataGrid-root"]'
    );
    muiDataGrids.forEach((dataGrid) => {
      // Skip nếu đây là nested DataGrid
      const hasParentDataGrid = dataGrid.parentElement?.closest(
        '.MuiDataGrid-root, [class*="MuiDataGrid-root"]'
      );
      if (hasParentDataGrid) {
        console.log("Skipping nested MuiDataGrid:", dataGrid);
        return;
      }

      const tableInfo = detectMuiDataGrid(dataGrid, tableIndex, "MUI DataGrid");
      if (tableInfo) {
        tableData.push(tableInfo);
        tableIndex++;
      }
    });

    // 3. Phát hiện các dạng table khác (ag-grid, react-table, etc.)
    const agGrids = document.querySelectorAll(
      '[class*="ag-grid"], .ag-grid-root, [class*="ag-root"]'
    );
    agGrids.forEach((agGrid) => {
      const tableInfo = detectAgGrid(agGrid, tableIndex, "AG Grid");
      if (tableInfo) {
        tableData.push(tableInfo);
        tableIndex++;
      }
    });

    // 4. Phát hiện generic data tables
    const genericTables = document.querySelectorAll(
      '[role="grid"], [role="table"], [class*="data-grid"], [class*="datatable"], [class*="data-table"]'
    );
    genericTables.forEach((table) => {
      // Skip nếu đây là MuiDataGrid hoặc AgGrid đã được detect
      if (
        table.classList.contains("MuiDataGrid-root") ||
        table.className.includes("MuiDataGrid-root") ||
        table.className.includes("MuiDataGrid-main") ||
        table.className.includes("ag-grid") ||
        table.closest(".MuiDataGrid-root") ||
        table.closest('[class*="MuiDataGrid-root"]') ||
        table.closest('[class*="ag-grid"]')
      ) {
        console.log("Skipping already detected table:", table);
        return;
      }

      // Kiểm tra xem đã được phát hiện chưa
      const alreadyDetected = tableData.some((t) => t.element === table);
      if (!alreadyDetected) {
        const tableInfo = detectGenericDataTable(
          table,
          tableIndex,
          "Data Table"
        );
        if (tableInfo) {
          tableData.push(tableInfo);
          tableIndex++;
        }
      }
    });

    // Lưu reference đến các bảng đã phát hiện
    window.detectedTables = tableData.map((t) => t.element);

    // Trả về dữ liệu bảng (không bao gồm element reference)
    const responseData = tableData.map((t) => ({
      index: t.index,
      type: t.type,
      columns: t.columns,
      rows: t.rows,
      hasHeader: t.hasHeader,
    }));

    sendResponse({
      success: true,
      tables: responseData,
    });
  } catch (error) {
    console.error("Error detecting tables:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Phát hiện HTML table truyền thống
 */
function detectHtmlTable(table, index, type) {
  // Kiểm tra xem bảng có dữ liệu không
  const rows = table.querySelectorAll("tr");
  if (rows.length < 2) return null; // Bỏ qua bảng có ít hơn 2 hàng

  // Tìm header row (thường là hàng đầu tiên hoặc trong thead)
  let headerRow = null;
  const thead = table.querySelector("thead tr");
  if (thead) {
    headerRow = thead;
  } else {
    // Nếu không có thead, lấy hàng đầu tiên
    headerRow = rows[0];
  }

  // Lấy tên các cột
  const columns = [];
  const headerCells = headerRow.querySelectorAll("th, td");

  headerCells.forEach((cell, cellIndex) => {
    let columnName = cell.textContent.trim();
    if (!columnName) {
      columnName = `Column ${cellIndex + 1}`;
    }
    columns.push(columnName);
  });

  // Đếm số hàng dữ liệu (bỏ qua header)
  let dataRowCount = rows.length - 1;
  if (thead) {
    // Nếu có thead, đếm tất cả hàng trong tbody
    const tbody = table.querySelector("tbody");
    if (tbody) {
      dataRowCount = tbody.querySelectorAll("tr").length;
    } else {
      dataRowCount = rows.length - 1;
    }
  }

  // Chỉ thêm bảng nếu có ít nhất 1 cột và 1 hàng dữ liệu
  if (columns.length > 0 && dataRowCount > 0) {
    return {
      index: index,
      type: type,
      element: table,
      columns: columns,
      rows: dataRowCount,
      hasHeader: true,
    };
  }
  return null;
}

/**
 * Phát hiện MuiDataGrid (Material-UI DataGrid)
 */
function detectMuiDataGrid(dataGrid, index, type) {
  try {
    console.log("Detecting MuiDataGrid:", dataGrid);
    console.log("DataGrid classes:", dataGrid.className);

    // Debug structure
    debugMuiDataGridStructure(dataGrid);

    // Tìm main container nếu dataGrid là root
    let mainContainer = dataGrid;
    if (
      dataGrid.classList.contains("MuiDataGrid-root") ||
      dataGrid.className.includes("MuiDataGrid-root")
    ) {
      const main = dataGrid.querySelector(
        '.MuiDataGrid-main, [class*="MuiDataGrid-main"]'
      );
      if (main) {
        mainContainer = main;
        console.log("Using main container:", mainContainer);
      }
    }

    let headerCells = [];

    // Strategy 1: Tìm columnHeaders container trong main
    const headerContainer = mainContainer.querySelector(
      '[class*="MuiDataGrid-columnHeaders"], .MuiDataGrid-columnHeaders'
    );

    if (headerContainer) {
      console.log("Found headerContainer:", headerContainer);

      // Lấy tất cả columnheader cells từ container
      headerCells = headerContainer.querySelectorAll('[role="columnheader"]');
      console.log("Header cells from columnheader role:", headerCells.length);

      // Nếu không có, thử với class
      if (headerCells.length === 0) {
        headerCells = headerContainer.querySelectorAll(
          '[class*="MuiDataGrid-columnHeader"]'
        );
        console.log("Header cells from class:", headerCells.length);
      }
    }

    // Strategy 2: Fallback - tìm trực tiếp trong main container
    if (headerCells.length === 0) {
      headerCells = mainContainer.querySelectorAll('[role="columnheader"]');
      console.log("Header cells from main container:", headerCells.length);
    }

    if (headerCells.length === 0) {
      console.log("No header cells found");
      return null;
    }

    // Strategy 5: Tìm row đầu tiên và lấy cells
    if (headerCells.length === 0) {
      const firstRow = dataGrid.querySelector(
        '[role="row"][aria-rowindex="1"]'
      );
      if (firstRow) {
        headerCells = firstRow.querySelectorAll(
          '[role="gridcell"], [role="columnheader"], div[data-field]'
        );
        console.log("Header cells from first row:", headerCells.length);
      }
    }

    if (headerCells.length === 0) {
      console.log("No header cells found");
      return null;
    }

    // Extract column names với logic cải thiện
    const columns = [];
    const seenColumns = new Set();

    Array.from(headerCells).forEach((headerCell, cellIndex) => {
      let columnName = "";

      console.log(`\n=== Processing header cell ${cellIndex} ===`);
      console.log("Cell element:", headerCell);
      console.log("Cell classes:", headerCell.className);
      console.log("Cell data-field:", headerCell.getAttribute("data-field"));

      // Skip nếu cell này là hidden
      const cellStyle = window.getComputedStyle(headerCell);
      if (cellStyle.display === "none" || cellStyle.visibility === "hidden") {
        console.log(`Skipping hidden cell ${cellIndex}`);
        return;
      }

      // Method 1: data-field attribute (most reliable)
      const dataField = headerCell.getAttribute("data-field");
      if (
        dataField &&
        dataField !== "__check__" &&
        dataField !== "__actions__" &&
        dataField !== "actions"
      ) {
        columnName = dataField;
        console.log(`✓ Column ${cellIndex} from data-field: "${columnName}"`);
      }

      // Method 2: MuiDataGrid-columnHeaderTitle (most specific)
      if (!columnName) {
        const titleElement = headerCell.querySelector(
          '[class*="MuiDataGrid-columnHeaderTitle"], .MuiDataGrid-columnHeaderTitle'
        );
        if (titleElement) {
          const titleText = titleElement.textContent.trim();
          if (titleText && titleText.length < 100) {
            // Reasonable length check
            columnName = titleText;
            console.log(
              `✓ Column ${cellIndex} from titleElement: "${columnName}"`
            );
          }
        }
      }

      // Method 3: aria-label (cleaned)
      if (!columnName) {
        const ariaLabel = headerCell.getAttribute("aria-label");
        if (
          ariaLabel &&
          !ariaLabel.includes("Sort") &&
          !ariaLabel.includes("Menu") &&
          !ariaLabel.includes("Actions")
        ) {
          const cleanedLabel = ariaLabel
            .replace(/^(Sort by|Column|Header) /, "")
            .trim();
          if (cleanedLabel && cleanedLabel.length < 100) {
            columnName = cleanedLabel;
            console.log(
              `✓ Column ${cellIndex} from aria-label: "${columnName}"`
            );
          }
        }
      }

      // Method 4: Direct text content (với filtering nghiêm ngặt)
      if (!columnName) {
        // Lấy chỉ text trực tiếp từ cell, không từ children
        let directText = "";
        for (let node of headerCell.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            directText += node.textContent;
          }
        }

        if (directText.trim()) {
          let textContent = directText.trim();
          // Clean text
          textContent = textContent
            .replace(/[↑↓▲▼⬆⬇]/g, "")
            .replace(/\s*(asc|desc|sort|sorted|ascending|descending)\s*/gi, "")
            .replace(/\s*(menu|actions)\s*/gi, "")
            .trim();

          if (
            textContent &&
            textContent.length > 0 &&
            textContent.length < 50
          ) {
            columnName = textContent;
            console.log(
              `✓ Column ${cellIndex} from direct text: "${columnName}"`
            );
          }
        }
      }

      // Method 5: Single child span/div (not container elements)
      if (!columnName) {
        const singleTextElements = headerCell.querySelectorAll(
          'span:not([class*="sort"]):not([class*="icon"]), div:not([class*="sort"]):not([class*="icon"]):not([class*="container"])'
        );
        for (let elem of singleTextElements) {
          const text = elem.textContent.trim();
          // Chỉ lấy nếu text không quá dài (không phải combined text từ nhiều cột)
          if (
            text &&
            !text.match(/[↑↓▲▼⬆⬇]/) &&
            text.length > 0 &&
            text.length < 50 &&
            !text.includes(" ")
          ) {
            columnName = text;
            console.log(
              `✓ Column ${cellIndex} from single child: "${columnName}"`
            );
            break;
          }
        }
      }

      // Fallback: Use index-based name
      if (!columnName) {
        columnName = `Column ${cellIndex + 1}`;
        console.log(`✓ Column ${cellIndex} fallback: "${columnName}"`);
      }

      // Clean column name
      const cleanedColumnName = cleanCellText(columnName);

      // Add to columns (allow some duplicates with suffix for different data-fields)
      if (!seenColumns.has(cleanedColumnName)) {
        columns.push(cleanedColumnName);
        seenColumns.add(cleanedColumnName);
        console.log(`✅ Added unique column: "${cleanedColumnName}"`);
      } else {
        // Allow duplicate with suffix if it has different data-field
        if (dataField && dataField !== cleanedColumnName) {
          const uniqueName = `${cleanedColumnName}_${dataField}`;
          columns.push(uniqueName);
          console.log(`✅ Added unique column with suffix: "${uniqueName}"`);
        } else {
          console.log(`❌ Skipped duplicate column: "${cleanedColumnName}"`);
        }
      }
    });

    console.log("Final column names:", columns);

    if (columns.length === 0) {
      console.log("No columns extracted");
      return null;
    }

    // Đếm số hàng dữ liệu - sử dụng main container
    let dataRowCount = 0;

    // Cách 1: Tìm trong virtualScroller của main container
    const virtualScroller = mainContainer.querySelector(
      '[class*="MuiDataGrid-virtualScroller"], .MuiDataGrid-virtualScroller'
    );
    if (virtualScroller) {
      const dataRows = virtualScroller.querySelectorAll(
        '[class*="MuiDataGrid-row"], .MuiDataGrid-row, [role="row"]'
      );
      dataRowCount = dataRows.length;
      console.log("Data rows found in virtualScroller:", dataRowCount);
    }

    // Cách 2: Tìm tất cả rows trong main và trừ đi header
    if (dataRowCount === 0) {
      const allRows = mainContainer.querySelectorAll('[role="row"]');
      // Header row thường có aria-rowindex="1" hoặc nằm trong columnHeaders
      const headerRows = mainContainer.querySelectorAll(
        '[role="row"][aria-rowindex="1"], [class*="MuiDataGrid-columnHeaders"] [role="row"]'
      );
      dataRowCount = Math.max(0, allRows.length - headerRows.length);
      console.log(
        "Total rows:",
        allRows.length,
        "Header rows:",
        headerRows.length,
        "Data rows:",
        dataRowCount
      );
    }

    // Cách 3: Kiểm tra pagination info nếu có
    if (dataRowCount === 0) {
      const paginationInfo = dataGrid.querySelector(
        '[class*="MuiTablePagination-displayedRows"], .MuiTablePagination-displayedRows'
      );
      if (paginationInfo) {
        const match = paginationInfo.textContent.match(/(\d+)-(\d+) of (\d+)/);
        if (match) {
          dataRowCount = parseInt(match[3]); // Total count
        }
      }
    }

    // Nếu không có dữ liệu nhưng có headers, coi như table trống
    const hasValidStructure = columns.length > 0;

    console.log("Final detection result:", {
      columns: columns.length,
      rows: dataRowCount,
      hasValidStructure,
      finalColumns: columns.slice(0, 10), // Show first 10 columns for debugging
    });

    if (hasValidStructure) {
      return {
        index: index,
        type: type,
        element: dataGrid, // Return root element
        columns: columns,
        rows: Math.max(0, dataRowCount),
        hasHeader: true,
      };
    }

    return null;
  } catch (error) {
    console.error("Error detecting MuiDataGrid:", error);
    return null;
  }
}

/**
 * Phát hiện AG Grid
 */
function detectAgGrid(agGrid, index, type) {
  try {
    // Tìm header container
    const headerContainer = agGrid.querySelector(
      '.ag-header, [class*="ag-header"]'
    );
    if (!headerContainer) return null;

    // Lấy tên các cột
    const columns = [];
    const headerCells = headerContainer.querySelectorAll(
      '.ag-header-cell, [class*="ag-header-cell"]'
    );

    headerCells.forEach((headerCell, cellIndex) => {
      let columnName = "";
      const labelElement = headerCell.querySelector(
        '.ag-header-cell-label, [class*="ag-header-cell-label"]'
      );
      if (labelElement) {
        columnName = labelElement.textContent.trim();
      } else {
        columnName = headerCell.textContent.trim();
      }

      if (!columnName) {
        columnName = `Column ${cellIndex + 1}`;
      }
      columns.push(columnName);
    });

    if (columns.length === 0) return null;

    // Đếm số hàng dữ liệu
    const bodyContainer = agGrid.querySelector('.ag-body, [class*="ag-body"]');
    let dataRowCount = 0;

    if (bodyContainer) {
      const dataRows = bodyContainer.querySelectorAll(
        '.ag-row, [class*="ag-row"]'
      );
      dataRowCount = dataRows.length;
    }

    if (dataRowCount > 0) {
      return {
        index: index,
        type: type,
        element: agGrid,
        columns: columns,
        rows: dataRowCount,
        hasHeader: true,
      };
    }

    return null;
  } catch (error) {
    console.error("Error detecting AG Grid:", error);
    return null;
  }
}

/**
 * Phát hiện generic data tables
 */
function detectGenericDataTable(table, index, type) {
  try {
    // Tìm headers - thử nhiều cách khác nhau
    let headerElements = [];

    // Thử tìm elements có role="columnheader"
    headerElements = table.querySelectorAll('[role="columnheader"]');

    // Nếu không tìm thấy, thử tìm trong hàng đầu tiên
    if (headerElements.length === 0) {
      const firstRow = table.querySelector('[role="row"]');
      if (firstRow) {
        headerElements = firstRow.querySelectorAll("*");
      }
    }

    // Nếu vẫn không tìm thấy, thử các class thông dụng
    if (headerElements.length === 0) {
      headerElements = table.querySelectorAll(
        '[class*="header"], [class*="Header"], thead *, th'
      );
    }

    const columns = [];
    headerElements.forEach((headerElement, cellIndex) => {
      let columnName = headerElement.textContent.trim();
      if (!columnName) {
        columnName = `Column ${cellIndex + 1}`;
      }
      columns.push(columnName);
    });

    if (columns.length === 0) return null;

    // Đếm số hàng dữ liệu
    let dataRowCount = 0;
    const dataRows = table.querySelectorAll(
      '[role="row"]:not([role="columnheader"]), tbody tr, [class*="row"]:not([class*="header"])'
    );
    dataRowCount = dataRows.length;

    if (dataRowCount > 0) {
      return {
        index: index,
        type: type,
        element: table,
        columns: columns,
        rows: dataRowCount,
        hasHeader: true,
      };
    }

    return null;
  } catch (error) {
    console.error("Error detecting generic data table:", error);
    return null;
  }
}

/**
 * Trích xuất dữ liệu từ bảng theo cột đã chọn
 */
function extractTableData(request, sendResponse) {
  try {
    const { selectedColumns, includeHeaders, skipFirstDataRow } = request;
    const extractedData = [];

    console.log("Extract options:", { includeHeaders, skipFirstDataRow });

    // Lấy các bảng đã được phát hiện trước đó
    const tables = window.detectedTables || [];

    Object.keys(selectedColumns).forEach((tableIndex) => {
      const table = tables[parseInt(tableIndex)];
      if (!table) return;

      const selectedCols = selectedColumns[tableIndex];
      const selectedColumnIndices = Object.keys(selectedCols)
        .filter((colIndex) => selectedCols[colIndex])
        .map((colIndex) => parseInt(colIndex));

      if (selectedColumnIndices.length === 0) return;

      // Xác định loại bảng và trích xuất dữ liệu tương ứng
      const tableType = getTableType(table);

      let extractedRows = [];
      switch (tableType) {
        case "mui-datagrid":
          extractedRows = extractMuiDataGridData(
            table,
            selectedColumnIndices,
            includeHeaders
          );
          break;
        case "ag-grid":
          extractedRows = extractAgGridData(
            table,
            selectedColumnIndices,
            includeHeaders
          );
          break;
        case "html-table":
          extractedRows = extractHtmlTableData(
            table,
            selectedColumnIndices,
            includeHeaders
          );
          break;
        default:
          extractedRows = extractGenericTableData(
            table,
            selectedColumnIndices,
            includeHeaders
          );
          break;
      }

      // Xử lý skipFirstDataRow nếu được yêu cầu
      if (skipFirstDataRow && extractedRows.length > 0) {
        console.log(
          "Before skipping first data row:",
          extractedRows.length,
          "rows"
        );

        // Nếu có header, giữ header và bỏ dòng data đầu tiên
        if (includeHeaders && extractedRows.length > 1) {
          extractedRows = [extractedRows[0], ...extractedRows.slice(2)];
        }
        // Nếu không có header, bỏ dòng đầu tiên
        else if (!includeHeaders && extractedRows.length > 0) {
          extractedRows = extractedRows.slice(1);
        }

        console.log(
          "After skipping first data row:",
          extractedRows.length,
          "rows"
        );
      }

      extractedData.push(...extractedRows);
    });

    sendResponse({
      success: true,
      data: extractedData,
    });
  } catch (error) {
    console.error("Error extracting table data:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Xác định loại bảng
 */
function getTableType(table) {
  if (
    table.classList.contains("MuiDataGrid-main") ||
    table.querySelector('[class*="MuiDataGrid"]')
  ) {
    return "mui-datagrid";
  }
  if (
    table.classList.contains("ag-grid-root") ||
    table.querySelector('[class*="ag-grid"]')
  ) {
    return "ag-grid";
  }
  if (table.tagName === "TABLE") {
    return "html-table";
  }
  return "generic";
}

/**
 * Trích xuất dữ liệu từ MuiDataGrid
 */
function extractMuiDataGridData(
  dataGrid,
  selectedColumnIndices,
  includeHeaders
) {
  const extractedData = [];

  try {
    console.log(
      "Extracting MuiDataGrid data, selectedColumns:",
      selectedColumnIndices
    );

    // Tìm main container giống như trong detectMuiDataGrid
    let mainContainer = dataGrid;
    if (
      dataGrid.classList.contains("MuiDataGrid-root") ||
      dataGrid.className.includes("MuiDataGrid-root")
    ) {
      const main = dataGrid.querySelector(
        '.MuiDataGrid-main, [class*="MuiDataGrid-main"]'
      );
      if (main) {
        mainContainer = main;
        console.log("Using main container for extraction:", mainContainer);
      }
    }

    // Trích xuất header nếu cần - sử dụng CÙNG logic như detectMuiDataGrid
    if (includeHeaders) {
      let headerCells = [];

      // Strategy 1: Tìm columnHeaders container trong main
      const headerContainer = mainContainer.querySelector(
        '[class*="MuiDataGrid-columnHeaders"], .MuiDataGrid-columnHeaders'
      );

      if (headerContainer) {
        console.log("Found headerContainer for extraction:", headerContainer);

        // Lấy tất cả columnheader cells từ container
        headerCells = headerContainer.querySelectorAll('[role="columnheader"]');
        console.log("Header cells from columnheader role:", headerCells.length);

        // Nếu không có, thử với class
        if (headerCells.length === 0) {
          headerCells = headerContainer.querySelectorAll(
            '[class*="MuiDataGrid-columnHeader"]'
          );
          console.log("Header cells from class:", headerCells.length);
        }
      }

      // Strategy 2: Fallback - tìm trực tiếp trong main container
      if (headerCells.length === 0) {
        headerCells = mainContainer.querySelectorAll('[role="columnheader"]');
        console.log("Header cells from main container:", headerCells.length);
      }

      if (headerCells.length > 0) {
        const headerData = selectedColumnIndices.map((colIndex) => {
          const cell = headerCells[colIndex];
          if (!cell) {
            console.log(`No header cell found at index ${colIndex}`);
            return "";
          }

          // Sử dụng CÙNG logic extract tên cột như trong detectMuiDataGrid
          let columnName = "";

          // Method 1: data-field attribute (most reliable)
          const dataField = cell.getAttribute("data-field");
          if (
            dataField &&
            dataField !== "__check__" &&
            dataField !== "__actions__" &&
            dataField !== "actions"
          ) {
            columnName = dataField;
            console.log(
              `✓ Header ${colIndex} from data-field: "${columnName}"`
            );
          }

          // Method 2: MuiDataGrid-columnHeaderTitle (most specific)
          if (!columnName) {
            const titleElement = cell.querySelector(
              '[class*="MuiDataGrid-columnHeaderTitle"], .MuiDataGrid-columnHeaderTitle'
            );
            if (titleElement) {
              const titleText = titleElement.textContent.trim();
              if (titleText && titleText.length < 100) {
                columnName = titleText;
                console.log(
                  `✓ Header ${colIndex} from titleElement: "${columnName}"`
                );
              }
            }
          }

          // Method 3: aria-label (cleaned)
          if (!columnName) {
            const ariaLabel = cell.getAttribute("aria-label");
            if (
              ariaLabel &&
              !ariaLabel.includes("Sort") &&
              !ariaLabel.includes("Menu") &&
              !ariaLabel.includes("Actions")
            ) {
              const cleanedLabel = ariaLabel
                .replace(/^(Sort by|Column|Header) /, "")
                .trim();
              if (cleanedLabel && cleanedLabel.length < 100) {
                columnName = cleanedLabel;
                console.log(
                  `✓ Header ${colIndex} from aria-label: "${columnName}"`
                );
              }
            }
          }

          return cleanCellText(columnName || `Column ${colIndex + 1}`);
        });

        console.log("Header data extracted:", headerData);
        extractedData.push(headerData);
      }
    }

    // Trích xuất dữ liệu từ các hàng - sử dụng mainContainer
    let dataRows = [];

    // Cách 1: Tìm trong virtualScroller của main container
    const virtualScroller = mainContainer.querySelector(
      '[class*="MuiDataGrid-virtualScroller"], .MuiDataGrid-virtualScroller'
    );
    if (virtualScroller) {
      dataRows = virtualScroller.querySelectorAll(
        '[class*="MuiDataGrid-row"], .MuiDataGrid-row, [role="row"]'
      );
      console.log("Found data rows in virtualScroller:", dataRows.length);
    }

    // Cách 2: Tìm tất cả rows trong main và lọc bỏ header
    if (dataRows.length === 0) {
      const allRows = mainContainer.querySelectorAll('[role="row"]');
      dataRows = Array.from(allRows).filter((row) => {
        // Lọ
        const rowIndex = row.getAttribute("aria-rowindex");
        const isInHeader = row.closest('[class*="MuiDataGrid-columnHeaders"]');
        return rowIndex !== "1" && !isInHeader;
      });
      console.log("Found data rows by filtering:", dataRows.length);
    }

    // Cách 3: Tìm theo class MuiDataGrid-row không nằm trong header
    if (dataRows.length === 0) {
      dataRows = mainContainer.querySelectorAll(
        '[class*="MuiDataGrid-row"]:not([class*="MuiDataGrid-columnHeader"])'
      );
      console.log("Found data rows by class filtering:", dataRows.length);
    }

    dataRows.forEach((row, rowIndex) => {
      console.log(`Processing data row ${rowIndex + 1}`);

      // Tìm cells trong row - cải thiện detection
      let cells = [];

      // Cách 1: Tìm theo role="gridcell" (most reliable)
      cells = row.querySelectorAll('[role="gridcell"]');
      console.log(`Method 1 - gridcell role: ${cells.length} cells`);

      // Cách 2: Tìm theo class MuiDataGrid-cell
      if (cells.length === 0) {
        cells = row.querySelectorAll(
          '[class*="MuiDataGrid-cell"], .MuiDataGrid-cell'
        );
        console.log(`Method 2 - MuiDataGrid-cell class: ${cells.length} cells`);
      }

      // Cách 3: Tìm các div con có data-field
      if (cells.length === 0) {
        cells = row.querySelectorAll("div[data-field]");
        console.log(`Method 3 - data-field: ${cells.length} cells`);
      }

      // Cách 4: Fallback - tất cả div con
      if (cells.length === 0) {
        cells = row.children;
        console.log(`Method 4 - all children: ${cells.length} cells`);
      }

      if (cells.length === 0) {
        console.log(`No cells found in row ${rowIndex + 1}, skipping`);
        return;
      }

      console.log(
        `Row ${rowIndex + 1}: Processing ${cells.length} cells with indices:`,
        selectedColumnIndices
      );

      const rowData = selectedColumnIndices.map((colIndex) => {
        const cell = cells[colIndex];
        if (!cell) {
          console.log(
            `❌ No cell found at index ${colIndex} in row ${rowIndex + 1}`
          );
          return "";
        }

        console.log(`Processing cell [${rowIndex + 1}, ${colIndex}]:`, cell);

        // Improved cell data extraction with multiple strategies
        let cellText = "";

        // Strategy 1: Look for nested text elements first
        const textElements = cell.querySelectorAll(
          'span, div:not([class*="MuiDataGrid"]), p, a, strong, em'
        );
        if (textElements.length > 0) {
          const texts = Array.from(textElements)
            .map((el) => el.textContent.trim())
            .filter((text) => text && text.length > 0);
          if (texts.length > 0) {
            cellText = texts.join(" ");
          }
        }

        // Strategy 2: Direct text content
        if (!cellText) {
          cellText = cell.textContent.trim();
        }

        // Strategy 3: title attribute
        if (!cellText) {
          cellText = cell.getAttribute("title") || "";
        }

        // Strategy 4: aria-label
        if (!cellText) {
          cellText = cell.getAttribute("aria-label") || "";
        }

        const cleanedData = cleanCellText(cellText);
        console.log(
          `✓ Cell [${rowIndex + 1}, ${colIndex}] data: "${cleanedData}"`
        );
        return cleanedData;
      });

      // Chỉ thêm hàng nếu không phải toàn bộ rỗng
      if (rowData.some((cell) => cell.trim() !== "")) {
        console.log(`✅ Adding row ${rowIndex + 1} data:`, rowData);
        extractedData.push(rowData);
      } else {
        console.log(`❌ Skipping empty row ${rowIndex + 1}`);
      }
    });
  } catch (error) {
    console.error("Error extracting MuiDataGrid data:", error);
  }

  console.log(
    `Final extraction result: ${extractedData.length} rows extracted`
  );

  // Debug: Show column mapping
  if (extractedData.length > 0) {
    console.log("=== COLUMN MAPPING DEBUG ===");
    console.log("Selected column indices:", selectedColumnIndices);
    if (includeHeaders && extractedData[0]) {
      console.log("Header row:", extractedData[0]);
    }
    if (extractedData.length > 1) {
      console.log("First data row:", extractedData[1]);
    }
    console.log("=== END DEBUG ===");
  }

  return extractedData;
}

/**
 * Trích xuất dữ liệu từ AG Grid
 */
function extractAgGridData(agGrid, selectedColumnIndices, includeHeaders) {
  const extractedData = [];

  try {
    // Trích xuất header nếu cần
    if (includeHeaders) {
      const headerContainer = agGrid.querySelector(
        '.ag-header, [class*="ag-header"]'
      );
      if (headerContainer) {
        const headerCells = headerContainer.querySelectorAll(
          '.ag-header-cell, [class*="ag-header-cell"]'
        );
        const headerData = selectedColumnIndices.map((colIndex) => {
          const cell = headerCells[colIndex];
          if (!cell) return "";

          const labelElement = cell.querySelector(
            '.ag-header-cell-label, [class*="ag-header-cell-label"]'
          );
          return labelElement
            ? cleanCellText(labelElement.textContent)
            : cleanCellText(cell.textContent);
        });
        extractedData.push(headerData);
      }
    }

    // Trích xuất dữ liệu từ các hàng
    const bodyContainer = agGrid.querySelector('.ag-body, [class*="ag-body"]');
    if (bodyContainer) {
      const dataRows = bodyContainer.querySelectorAll(
        '.ag-row, [class*="ag-row"]'
      );

      dataRows.forEach((row) => {
        const cells = row.querySelectorAll('.ag-cell, [class*="ag-cell"]');

        if (cells.length === 0) return;

        const rowData = selectedColumnIndices.map((colIndex) => {
          const cell = cells[colIndex];
          if (!cell) return "";

          return extractCellData(cell);
        });

        if (rowData.some((cell) => cell.trim() !== "")) {
          extractedData.push(rowData);
        }
      });
    }
  } catch (error) {
    console.error("Error extracting AG Grid data:", error);
  }

  return extractedData;
}

/**
 * Trích xuất dữ liệu từ HTML table truyền thống
 */
function extractHtmlTableData(table, selectedColumnIndices, includeHeaders) {
  const extractedData = [];

  try {
    // Lấy tất cả các hàng
    const rows = table.querySelectorAll("tr");

    // Tìm hàng header
    let startRowIndex = 0;
    const thead = table.querySelector("thead tr");
    if (thead) {
      startRowIndex = 0; // Bắt đầu từ hàng đầu tiên trong tbody
      const tbody = table.querySelector("tbody");
      if (tbody) {
        rows = tbody.querySelectorAll("tr");
      } else {
        // Nếu có thead nhưng không có tbody, bỏ qua hàng đầu tiên
        startRowIndex = 1;
      }
    } else {
      // Nếu không có thead, giả sử hàng đầu tiên là header
      startRowIndex = includeHeaders ? 0 : 1;
    }

    // Trích xuất header nếu cần
    if (includeHeaders) {
      const headerRow = thead || rows[0];
      const headerCells = headerRow.querySelectorAll("th, td");
      const headerData = selectedColumnIndices.map((colIndex) => {
        const cell = headerCells[colIndex];
        return cell ? cleanCellText(cell.textContent) : "";
      });
      extractedData.push(headerData);
    }

    // Trích xuất dữ liệu từ các hàng
    for (let i = startRowIndex; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll("td, th");

      // Bỏ qua hàng trống
      if (cells.length === 0) continue;

      const rowData = selectedColumnIndices.map((colIndex) => {
        const cell = cells[colIndex];
        if (!cell) return "";

        return extractCellData(cell);
      });

      // Chỉ thêm hàng nếu không phải toàn bộ rỗng
      if (rowData.some((cell) => cell.trim() !== "")) {
        extractedData.push(rowData);
      }
    }
  } catch (error) {
    console.error("Error extracting HTML table data:", error);
  }

  return extractedData;
}

/**
 * Trích xuất dữ liệu từ generic table
 */
function extractGenericTableData(table, selectedColumnIndices, includeHeaders) {
  const extractedData = [];

  try {
    // Trích xuất header nếu cần
    if (includeHeaders) {
      const headerElements = table.querySelectorAll(
        '[role="columnheader"], [class*="header"], [class*="Header"]'
      );
      if (headerElements.length > 0) {
        const headerData = selectedColumnIndices.map((colIndex) => {
          const cell = headerElements[colIndex];
          return cell ? cleanCellText(cell.textContent) : "";
        });
        extractedData.push(headerData);
      }
    }

    // Trích xuất dữ liệu từ các hàng
    const dataRows = table.querySelectorAll(
      '[role="row"]:not([role="columnheader"]), [class*="row"]:not([class*="header"])'
    );

    dataRows.forEach((row) => {
      const cells = row.querySelectorAll(
        '[role="gridcell"], [role="cell"], [class*="cell"], td, th'
      );

      if (cells.length === 0) return;

      const rowData = selectedColumnIndices.map((colIndex) => {
        const cell = cells[colIndex];
        if (!cell) return "";

        return extractCellData(cell);
      });

      if (rowData.some((cell) => cell.trim() !== "")) {
        extractedData.push(rowData);
      }
    });
  } catch (error) {
    console.error("Error extracting generic table data:", error);
  }

  return extractedData;
}

/**
 * Trích xuất dữ liệu từ một cell (hỗ trợ nhiều loại content)
 */
function extractCellData(cell) {
  if (!cell) return "";

  // Trích xuất text, bao gồm cả text từ các element con
  let cellText = cell.textContent || cell.innerText || "";

  // Xử lý các trường hợp đặc biệt
  // Kiểm tra xem có link không
  const link = cell.querySelector("a");
  if (link && link.href) {
    cellText += ` (${link.href})`;
  }

  // Kiểm tra xem có image không
  const img = cell.querySelector("img");
  if (img && img.src) {
    cellText += cellText ? ` [Image: ${img.src}]` : `[Image: ${img.src}]`;
  }

  // Kiểm tra input values
  const input = cell.querySelector("input");
  if (input && input.value) {
    cellText = input.value;
  }

  return cleanCellText(cellText);
}

/**
 * Làm sạch text từ cell
 */
/**
 * Debug helper - log MuiDataGrid structure
 */
function debugMuiDataGridStructure(dataGrid) {
  console.log("=== MUI DataGrid Structure Debug ===");
  console.log("DataGrid element:", dataGrid);
  console.log("DataGrid classes:", dataGrid.className);

  // Check for header container
  const headerContainers = dataGrid.querySelectorAll(
    '[class*="MuiDataGrid-columnHeaders"], .MuiDataGrid-columnHeaders'
  );
  console.log("Header containers found:", headerContainers.length);

  // Check for header cells
  const headerCells = dataGrid.querySelectorAll(
    '[class*="MuiDataGrid-columnHeader"], .MuiDataGrid-columnHeader'
  );
  console.log("Header cells found:", headerCells.length);

  if (headerCells.length > 0) {
    console.log("Sample header cell structure:");
    const sampleHeader = headerCells[0];
    console.log("- Element:", sampleHeader);
    console.log("- Classes:", sampleHeader.className);
    console.log("- data-field:", sampleHeader.getAttribute("data-field"));
    console.log("- Text content:", sampleHeader.textContent);
    console.log(
      "- Children:",
      Array.from(sampleHeader.children).map((child) => ({
        tag: child.tagName,
        classes: child.className,
        text: child.textContent.substring(0, 50),
      }))
    );
  }

  // Check for data rows
  const dataRows = dataGrid.querySelectorAll(
    '[role="row"]:not([aria-rowindex="1"])'
  );
  console.log("Data rows found:", dataRows.length);

  if (dataRows.length > 0) {
    console.log("Sample data row structure:");
    const sampleRow = dataRows[0];
    console.log("- Element:", sampleRow);
    console.log("- Classes:", sampleRow.className);
    const cells = sampleRow.querySelectorAll(
      '[role="gridcell"], [class*="MuiDataGrid-cell"]'
    );
    console.log("- Cells in row:", cells.length);
    if (cells.length > 0) {
      console.log("- Sample cell:", {
        element: cells[0],
        classes: cells[0].className,
        text: cells[0].textContent.substring(0, 50),
      });
    }
  }

  console.log("=== End Debug ===");
}

function cleanCellText(text) {
  if (!text) return "";

  return text
    .replace(/\s+/g, " ") // Thay thế nhiều khoảng trắng bằng 1 khoảng trắng
    .replace(/\n/g, " ") // Thay thế xuống dòng bằng khoảng trắng
    .replace(/\t/g, " ") // Thay thế tab bằng khoảng trắng
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "") // Loại bỏ invisible characters
    .replace(/[↑↓▲▼⬆⬇]/g, "") // Loại bỏ arrow symbols (sort indicators)
    .replace(/\s*(asc|desc|ascending|descending)\s*/gi, "") // Loại bỏ sort text
    .trim(); // Loại bỏ khoảng trắng đầu cuối
}

/**
 * Highlight bảng được chọn (tùy chọn - để debug)
 */
function highlightTable(tableIndex) {
  // Xóa highlight cũ
  document.querySelectorAll("table").forEach((table) => {
    table.style.border = "";
    table.style.boxShadow = "";
  });

  // Highlight bảng mới
  const tables = document.querySelectorAll("table");
  if (tables[tableIndex]) {
    tables[tableIndex].style.border = "3px solid #4285f4";
    tables[tableIndex].style.boxShadow = "0 0 10px rgba(66, 133, 244, 0.3)";
  }
}

// Auto-detect tables when content script loads (optional)
document.addEventListener("DOMContentLoaded", function () {
  // Có thể tự động phát hiện bảng khi trang load xong
  // Hiện tại để trống, chỉ phát hiện khi user click vào popup
});

// Listen for dynamic content changes
const observer = new MutationObserver(function (mutations) {
  // Reset detected tables when page content changes
  if (window.detectedTables) {
    // Kiểm tra xem các bảng cũ còn tồn tại không
    const stillExists = window.detectedTables.filter((table) =>
      document.contains(table)
    );

    if (stillExists.length !== window.detectedTables.length) {
      // Có bảng bị xóa, reset
      window.detectedTables = null;
    }
  }
});

// Observe changes to document body
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Inject some CSS to help with table detection and highlighting
const style = document.createElement("style");
style.textContent = `
    .web-to-sheets-highlight {
        border: 2px solid #4285f4 !important;
        box-shadow: 0 0 10px rgba(66, 133, 244, 0.3) !important;
    }
    
    /* Debug styles for MuiDataGrid detection */
    [class*="MuiDataGrid-main"]:after {
        content: "MUI DataGrid Detected";
        position: absolute;
        top: -20px;
        left: 0;
        background: #4285f4;
        color: white;
        padding: 2px 6px;
        font-size: 10px;
        border-radius: 3px;
        z-index: 9999;
        pointer-events: none;
    }
    
    /* Make sure MuiDataGrid is properly positioned for the after element */
    [class*="MuiDataGrid-main"] {
        position: relative;
    }
`;
document.head.appendChild(style);

// Console log để debug
console.log("Web Table to Google Sheets Exporter: Content script loaded");

// Function để test MuiDataGrid detection với thông tin chi tiết
function testMuiDataGridDetection() {
  console.log("=== Testing MuiDataGrid Detection ===");

  const muiGrids = document.querySelectorAll(
    '[class*="MuiDataGrid-main"], [class*="MuiDataGrid-root"], .MuiDataGrid-main, .MuiDataGrid-root'
  );
  console.log("Found MuiDataGrids:", muiGrids.length);

  muiGrids.forEach((grid, index) => {
    console.log(`\n--- MuiDataGrid ${index} ---`);
    console.log("Element:", grid);
    console.log("Classes:", grid.className);

    // Test header detection với nhiều cách
    console.log("\n--- Header Detection ---");

    // Cách 1: columnHeaders class
    let headers1 = grid.querySelectorAll(
      '[class*="MuiDataGrid-columnHeaders"], .MuiDataGrid-columnHeaders'
    );
    console.log("Method 1 - columnHeaders class:", headers1.length);

    // Cách 2: role="row" đầu tiên
    let firstRow = grid.querySelector('[role="row"]');
    console.log(
      "Method 2 - first row:",
      firstRow ? 1 : 0,
      firstRow ? firstRow.getAttribute("aria-rowindex") : "N/A"
    );

    // Cách 3: columnHeader cells
    let headerCells = grid.querySelectorAll(
      '[class*="MuiDataGrid-columnHeader"], .MuiDataGrid-columnHeader'
    );
    console.log("Method 3 - columnHeader cells:", headerCells.length);

    // Cách 4: role="columnheader"
    let roleHeaders = grid.querySelectorAll('[role="columnheader"]');
    console.log("Method 4 - role columnheader:", roleHeaders.length);

    // Test column name extraction
    console.log("\n--- Column Names ---");
    if (headerCells.length > 0) {
      Array.from(headerCells)
        .slice(0, 5)
        .forEach((cell, i) => {
          let name1 = cell.querySelector(
            '[class*="MuiDataGrid-columnHeaderTitle"]'
          );
          let name2 = cell.getAttribute("data-field");
          let name3 = cell.textContent.trim();
          console.log(`Column ${i}:`, {
            titleElement: name1 ? name1.textContent : "N/A",
            dataField: name2 || "N/A",
            textContent: name3 || "N/A",
          });
        });
    }

    // Test row detection
    console.log("\n--- Row Detection ---");

    // Cách 1: virtualScroller
    let virtualScroller = grid.querySelector(
      '[class*="MuiDataGrid-virtualScroller"], .MuiDataGrid-virtualScroller'
    );
    if (virtualScroller) {
      let dataRows1 = virtualScroller.querySelectorAll(
        '[class*="MuiDataGrid-row"], .MuiDataGrid-row'
      );
      console.log("Method 1 - virtualScroller rows:", dataRows1.length);
    } else {
      console.log("Method 1 - virtualScroller: not found");
    }

    // Cách 2: tất cả rows
    let allRows = grid.querySelectorAll('[role="row"]');
    console.log("Method 2 - all rows:", allRows.length);

    // Cách 3: MuiDataGrid-row class
    let rowsByClass = grid.querySelectorAll('[class*="MuiDataGrid-row"]');
    console.log("Method 3 - by class:", rowsByClass.length);

    // Test cell detection trong row đầu tiên
    if (allRows.length > 1) {
      console.log("\n--- Cell Detection in First Data Row ---");
      let testRow = allRows[1]; // Skip header row

      let cells1 = testRow.querySelectorAll(
        '[class*="MuiDataGrid-cell"], .MuiDataGrid-cell'
      );
      let cells2 = testRow.querySelectorAll('[role="gridcell"]');
      let cells3 = testRow.querySelectorAll("div[data-field]");

      console.log("Method 1 - MuiDataGrid-cell:", cells1.length);
      console.log("Method 2 - role gridcell:", cells2.length);
      console.log("Method 3 - data-field:", cells3.length);

      if (cells1.length > 0) {
        console.log("Sample cell content:", cells1[0].textContent.trim());
      }
    }

    // Show actual structure
    console.log("\n--- DOM Structure Sample ---");
    console.log(
      "Grid HTML (first 500 chars):",
      grid.outerHTML.substring(0, 500) + "..."
    );
  });
}

// Run test when page loads và cũng có thể gọi manual
setTimeout(testMuiDataGridDetection, 2000);

// Expose function globally để có thể test từ console
window.testMuiDataGridDetection = testMuiDataGridDetection;
