import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const resolveCell = (col, row) =>
  typeof col.value === "function" ? col.value(row) : row[col.key];

const escapeCsvCell = (value) => {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const triggerDownload = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export an array of objects to a downloaded CSV file.
 * @param {string} filename - e.g. "projects.csv"
 * @param {{key:string,label:string,value?:(row:object)=>any}[]} columns
 * @param {object[]} rows
 */
export function exportToCSV(filename, columns, rows) {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvCell(resolveCell(c, row))).join(",")
  );
  const csvContent = [header, ...lines].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/**
 * Export an array of objects to a downloaded PDF table.
 * @param {string} filename - e.g. "projects.pdf"
 * @param {string} title - heading printed at the top of the PDF
 * @param {{key:string,label:string,value?:(row:object)=>any}[]} columns
 * @param {object[]} rows
 */
export function exportToPDF(filename, title, columns, rows) {
  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(16);
  doc.setTextColor(30, 64, 175); // #1e40af
  doc.text(title, 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // #6b7280
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) =>
      columns.map((c) => {
        const v = resolveCell(c, row);
        return v === null || v === undefined ? "" : String(v);
      })
    ),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" }, // #2563eb
    alternateRowStyles: { fillColor: [248, 250, 252] }, // #f8fafc
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
