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

    // 2. Phát hiện MuiDataGrid (Material-UI DataGrid)
    const muiDataGrids = document.querySelectorAll(
      '[class*="MuiDataGrid-main"], [class*="MuiDataGrid-root"], .MuiDataGrid-main, .MuiDataGrid-root'
    );
    muiDataGrids.forEach((dataGrid) => {
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
    console.log('Detecting MuiDataGrid:', dataGrid);
    
    // Thử nhiều cách khác nhau để tìm header container
    let headerContainer = null;
    
    // Cách 1: Tìm theo class MuiDataGrid-columnHeaders
    headerContainer = dataGrid.querySelector('[class*="MuiDataGrid-columnHeaders"], .MuiDataGrid-columnHeaders');
    
    // Cách 2: Tìm theo role="row" đầu tiên (thường là header)
    if (!headerContainer) {
      const firstRow = dataGrid.querySelector('[role="row"]');
      if (firstRow && firstRow.getAttribute('aria-rowindex') === '1') {
        headerContainer = firstRow;
      }
    }
    
    // Cách 3: Tìm theo structure thông thường của MUI DataGrid
    if (!headerContainer) {
      headerContainer = dataGrid.querySelector('[class*="MuiDataGrid-main"] > div:first-child, .MuiDataGrid-main > div:first-child');
    }
    
    if (!headerContainer) {
      console.log('No header container found');
      return null;
    }

    console.log('Header container found:', headerContainer);

    // Lấy tên các cột từ headers - thử nhiều cách
    const columns = [];
    let headerCells = [];
    
    // Cách 1: Tìm theo class MuiDataGrid-columnHeader
    headerCells = headerContainer.querySelectorAll('[class*="MuiDataGrid-columnHeader"], .MuiDataGrid-columnHeader');
    
    // Cách 2: Tìm theo role="columnheader"
    if (headerCells.length === 0) {
      headerCells = headerContainer.querySelectorAll('[role="columnheader"]');
    }
    
    // Cách 3: Tìm tất cả div con trong header container
    if (headerCells.length === 0) {
      headerCells = headerContainer.querySelectorAll('div[data-field], div[data-colindex]');
    }
    
    // Cách 4: Fallback - lấy tất cả div con
    if (headerCells.length === 0) {
      headerCells = headerContainer.children;
    }

    console.log('Found header cells:', headerCells.length);

    Array.from(headerCells).forEach((headerCell, cellIndex) => {
      let columnName = "";

      // Thử nhiều cách khác nhau để lấy tên cột
      
      // Cách 1: Tìm trong MuiDataGrid-columnHeaderTitle
      let titleElement = headerCell.querySelector('[class*="MuiDataGrid-columnHeaderTitle"], .MuiDataGrid-columnHeaderTitle');
      if (titleElement) {
        columnName = titleElement.textContent.trim();
      }
      
      // Cách 2: Tìm theo data-field attribute
      if (!columnName && headerCell.getAttribute) {
        const dataField = headerCell.getAttribute('data-field');
        if (dataField) {
          columnName = dataField;
        }
      }
      
      // Cách 3: Lấy text content trực tiếp nhưng lọc bỏ các icon/button
      if (!columnName) {
        let textContent = headerCell.textContent.trim();
        // Lọc bỏ các ký tự đặc biệt (arrow, sort icons)
        textContent = textContent.replace(/[↑↓▲▼⬆⬇]/g, '').trim();
        columnName = textContent;
      }
      
      // Cách 4: Fallback
      if (!columnName) {
        columnName = `Column ${cellIndex + 1}`;
      }
      
      console.log(`Column ${cellIndex}: ${columnName}`);
      columns.push(columnName);
    });

    if (columns.length === 0) {
      console.log('No columns found');
      return null;
    }

    // Đếm số hàng dữ liệu - cải thiện detection
    let dataRowCount = 0;
    
    // Cách 1: Tìm trong virtualScroller
    const virtualScroller = dataGrid.querySelector('[class*="MuiDataGrid-virtualScroller"], .MuiDataGrid-virtualScroller');
    if (virtualScroller) {
      const dataRows = virtualScroller.querySelectorAll('[class*="MuiDataGrid-row"], .MuiDataGrid-row');
      dataRowCount = dataRows.length;
      console.log('Data rows found in virtualScroller:', dataRowCount);
    }
    
    // Cách 2: Tìm tất cả rows và trừ đi header
    if (dataRowCount === 0) {
      const allRows = dataGrid.querySelectorAll('[role="row"]');
      const headerRows = dataGrid.querySelectorAll('[role="row"][aria-rowindex="1"], [class*="MuiDataGrid-columnHeaders"]');
      dataRowCount = Math.max(0, allRows.length - headerRows.length);
      console.log('Total rows:', allRows.length, 'Header rows:', headerRows.length, 'Data rows:', dataRowCount);
    }
    
    // Cách 3: Kiểm tra pagination info nếu có
    if (dataRowCount === 0) {
      const paginationInfo = dataGrid.querySelector('[class*="MuiTablePagination-displayedRows"], .MuiTablePagination-displayedRows');
      if (paginationInfo) {
        const match = paginationInfo.textContent.match(/(\d+)-(\d+) of (\d+)/);
        if (match) {
          dataRowCount = parseInt(match[3]); // Total count
        }
      }
    }
    
    // Nếu không có dữ liệu nhưng có headers, coi như table trống
    const hasValidStructure = columns.length > 0;
    
    console.log('Final detection result:', {
      columns: columns.length,
      rows: dataRowCount,
      hasValidStructure
    });

    if (hasValidStructure) {
      return {
        index: index,
        type: type,
        element: dataGrid,
        columns: columns,
        rows: Math.max(0, dataRowCount), // Đảm bảo không âm
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
    const { selectedColumns, includeHeaders } = request;
    const extractedData = [];

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
    console.log('Extracting MuiDataGrid data, selectedColumns:', selectedColumnIndices);
    
    // Trích xuất header nếu cần
    if (includeHeaders) {
      // Sử dụng cùng logic như trong detect function
      let headerContainer = dataGrid.querySelector('[class*="MuiDataGrid-columnHeaders"], .MuiDataGrid-columnHeaders');
      
      if (!headerContainer) {
        const firstRow = dataGrid.querySelector('[role="row"]');
        if (firstRow && firstRow.getAttribute('aria-rowindex') === '1') {
          headerContainer = firstRow;
        }
      }
      
      if (!headerContainer) {
        headerContainer = dataGrid.querySelector('[class*="MuiDataGrid-main"] > div:first-child, .MuiDataGrid-main > div:first-child');
      }
      
      if (headerContainer) {
        let headerCells = [];
        
        // Thử nhiều cách tìm header cells
        headerCells = headerContainer.querySelectorAll('[class*="MuiDataGrid-columnHeader"], .MuiDataGrid-columnHeader');
        if (headerCells.length === 0) {
          headerCells = headerContainer.querySelectorAll('[role="columnheader"]');
        }
        if (headerCells.length === 0) {
          headerCells = headerContainer.querySelectorAll('div[data-field], div[data-colindex]');
        }
        if (headerCells.length === 0) {
          headerCells = headerContainer.children;
        }
        
        const headerData = selectedColumnIndices.map(colIndex => {
          const cell = headerCells[colIndex];
          if (!cell) return '';
          
          // Tìm title element
          let titleElement = cell.querySelector('[class*="MuiDataGrid-columnHeaderTitle"], .MuiDataGrid-columnHeaderTitle');
          if (titleElement) {
            return cleanCellText(titleElement.textContent);
          }
          
          // Fallback: data-field attribute
          const dataField = cell.getAttribute('data-field');
          if (dataField) {
            return dataField;
          }
          
          // Fallback: text content
          let textContent = cell.textContent.trim();
          textContent = textContent.replace(/[↑↓▲▼⬆⬇]/g, '').trim();
          return cleanCellText(textContent);
        });
        
        console.log('Header data extracted:', headerData);
        extractedData.push(headerData);
      }
    }

    // Trích xuất dữ liệu từ các hàng
    let dataRows = [];
    
    // Cách 1: Tìm trong virtualScroller
    const virtualScroller = dataGrid.querySelector('[class*="MuiDataGrid-virtualScroller"], .MuiDataGrid-virtualScroller');
    if (virtualScroller) {
      dataRows = virtualScroller.querySelectorAll('[class*="MuiDataGrid-row"], .MuiDataGrid-row');
      console.log('Found data rows in virtualScroller:', dataRows.length);
    }
    
    // Cách 2: Tìm tất cả rows và lọc bỏ header
    if (dataRows.length === 0) {
      const allRows = dataGrid.querySelectorAll('[role="row"]');
      dataRows = Array.from(allRows).filter(row => {
        // Lọc bỏ header rows
        return !row.getAttribute('aria-rowindex') || row.getAttribute('aria-rowindex') !== '1';
      });
      console.log('Found data rows by filtering:', dataRows.length);
    }
    
    // Cách 3: Tìm theo class MuiDataGrid-row không nằm trong header
    if (dataRows.length === 0) {
      dataRows = dataGrid.querySelectorAll('[class*="MuiDataGrid-row"]:not([class*="MuiDataGrid-columnHeader"])');
      console.log('Found data rows by class filtering:', dataRows.length);
    }
    
    dataRows.forEach((row, rowIndex) => {
      console.log(`Processing row ${rowIndex}`);
      
      // Tìm cells trong row
      let cells = [];
      
      // Cách 1: Tìm theo class MuiDataGrid-cell
      cells = row.querySelectorAll('[class*="MuiDataGrid-cell"], .MuiDataGrid-cell');
      
      // Cách 2: Tìm theo role="gridcell"
      if (cells.length === 0) {
        cells = row.querySelectorAll('[role="gridcell"]');
      }
      
      // Cách 3: Tìm các div con có data-field
      if (cells.length === 0) {
        cells = row.querySelectorAll('div[data-field]');
      }
      
      // Cách 4: Fallback - tất cả div con
      if (cells.length === 0) {
        cells = row.children;
      }
      
      console.log(`Found ${cells.length} cells in row ${rowIndex}`);
      
      if (cells.length === 0) return;

      const rowData = selectedColumnIndices.map(colIndex => {
        const cell = cells[colIndex];
        if (!cell) {
          console.log(`No cell found at index ${colIndex}`);
          return '';
        }

        const cellData = extractCellData(cell);
        console.log(`Cell ${colIndex} data:`, cellData);
        return cellData;
      });

      // Chỉ thêm hàng nếu không phải toàn bộ rỗng
      if (rowData.some(cell => cell.trim() !== '')) {
        console.log('Adding row data:', rowData);
        extractedData.push(rowData);
      } else {
        console.log('Skipping empty row');
      }
    });

  } catch (error) {
    console.error('Error extracting MuiDataGrid data:', error);
  }

  console.log('Final extracted data:', extractedData);
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
function cleanCellText(text) {
  if (!text) return "";

  // Loại bỏ khoảng trắng thừa và ký tự xuống dòng
  return text
    .replace(/\s+/g, " ") // Thay thế nhiều khoảng trắng bằng 1 khoảng trắng
    .replace(/\n/g, " ") // Thay thế xuống dòng bằng khoảng trắng
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
    console.log('=== Testing MuiDataGrid Detection ===');
    
    const muiGrids = document.querySelectorAll('[class*="MuiDataGrid-main"], [class*="MuiDataGrid-root"], .MuiDataGrid-main, .MuiDataGrid-root');
    console.log('Found MuiDataGrids:', muiGrids.length);
    
    muiGrids.forEach((grid, index) => {
        console.log(`\n--- MuiDataGrid ${index} ---`);
        console.log('Element:', grid);
        console.log('Classes:', grid.className);
        
        // Test header detection với nhiều cách
        console.log('\n--- Header Detection ---');
        
        // Cách 1: columnHeaders class
        let headers1 = grid.querySelectorAll('[class*="MuiDataGrid-columnHeaders"], .MuiDataGrid-columnHeaders');
        console.log('Method 1 - columnHeaders class:', headers1.length);
        
        // Cách 2: role="row" đầu tiên
        let firstRow = grid.querySelector('[role="row"]');
        console.log('Method 2 - first row:', firstRow ? 1 : 0, firstRow ? firstRow.getAttribute('aria-rowindex') : 'N/A');
        
        // Cách 3: columnHeader cells
        let headerCells = grid.querySelectorAll('[class*="MuiDataGrid-columnHeader"], .MuiDataGrid-columnHeader');
        console.log('Method 3 - columnHeader cells:', headerCells.length);
        
        // Cách 4: role="columnheader"
        let roleHeaders = grid.querySelectorAll('[role="columnheader"]');
        console.log('Method 4 - role columnheader:', roleHeaders.length);
        
        // Test column name extraction
        console.log('\n--- Column Names ---');
        if (headerCells.length > 0) {
            Array.from(headerCells).slice(0, 5).forEach((cell, i) => {
                let name1 = cell.querySelector('[class*="MuiDataGrid-columnHeaderTitle"]');
                let name2 = cell.getAttribute('data-field');
                let name3 = cell.textContent.trim();
                console.log(`Column ${i}:`, {
                    titleElement: name1 ? name1.textContent : 'N/A',
                    dataField: name2 || 'N/A',
                    textContent: name3 || 'N/A'
                });
            });
        }
        
        // Test row detection
        console.log('\n--- Row Detection ---');
        
        // Cách 1: virtualScroller
        let virtualScroller = grid.querySelector('[class*="MuiDataGrid-virtualScroller"], .MuiDataGrid-virtualScroller');
        if (virtualScroller) {
            let dataRows1 = virtualScroller.querySelectorAll('[class*="MuiDataGrid-row"], .MuiDataGrid-row');
            console.log('Method 1 - virtualScroller rows:', dataRows1.length);
        } else {
            console.log('Method 1 - virtualScroller: not found');
        }
        
        // Cách 2: tất cả rows
        let allRows = grid.querySelectorAll('[role="row"]');
        console.log('Method 2 - all rows:', allRows.length);
        
        // Cách 3: MuiDataGrid-row class
        let rowsByClass = grid.querySelectorAll('[class*="MuiDataGrid-row"]');
        console.log('Method 3 - by class:', rowsByClass.length);
        
        // Test cell detection trong row đầu tiên
        if (allRows.length > 1) {
            console.log('\n--- Cell Detection in First Data Row ---');
            let testRow = allRows[1]; // Skip header row
            
            let cells1 = testRow.querySelectorAll('[class*="MuiDataGrid-cell"], .MuiDataGrid-cell');
            let cells2 = testRow.querySelectorAll('[role="gridcell"]');
            let cells3 = testRow.querySelectorAll('div[data-field]');
            
            console.log('Method 1 - MuiDataGrid-cell:', cells1.length);
            console.log('Method 2 - role gridcell:', cells2.length);
            console.log('Method 3 - data-field:', cells3.length);
            
            if (cells1.length > 0) {
                console.log('Sample cell content:', cells1[0].textContent.trim());
            }
        }
        
        // Show actual structure
        console.log('\n--- DOM Structure Sample ---');
        console.log('Grid HTML (first 500 chars):', grid.outerHTML.substring(0, 500) + '...');
    });
}

// Run test when page loads và cũng có thể gọi manual
setTimeout(testMuiDataGridDetection, 2000);

// Expose function globally để có thể test từ console
window.testMuiDataGridDetection = testMuiDataGridDetection;
