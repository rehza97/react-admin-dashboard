import * as XLSX from 'xlsx';

/**
 * Export data to Excel file
 * @param {Array} data - Array of objects to export
 * @param {String} fileName - Name of the file without extension
 * @param {String} sheetName - Name of the sheet
 */
export const exportToExcel = (data, fileName = 'export', sheetName = 'Sheet1') => {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    
    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return false;
  }
};

/**
 * Export data to CSV file
 * @param {Array} data - Array of objects to export
 * @param {String} fileName - Name of the file without extension
 */
export const exportToCSV = (data, fileName = 'export') => {
  try {
    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    
    // Generate CSV content
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    
    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Set link properties
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.style.visibility = 'hidden';
    
    // Add link to document, trigger click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return false;
  }
};

/**
 * Format data for export (optional utility function)
 * @param {Array} data - Raw data array
 * @param {Array} columns - Array of column definitions with field and header properties
 * @returns {Array} Formatted data for export
 */
export const formatDataForExport = (data, columns) => {
  return data.map(item => {
    const formattedItem = {};
    columns.forEach(column => {
      formattedItem[column.header || column.field] = item[column.field];
    });
    return formattedItem;
  });
};