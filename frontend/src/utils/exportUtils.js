import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { UNIVERSITY_LOGO_DATA_URL } from "../assets/universityLogo";

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

// Letterhead shown at the top of every generated report.
const UNIVERSITY_NAME = "Baba Guru Nanak University, Nankana Sahib";

/**
 * Groups rows by a key function, preserving group-appearance order, and
 * returns [{ heading, rows }]. Shared by the CSV/PDF grouped exporters and
 * by the on-screen table so what's viewed matches what's exported.
 * @param {object[]} rows
 * @param {(row:object)=>string} groupBy
 */
export function groupRows(rows, groupBy) {
  const order = [];
  const map = new Map();
  rows.forEach((row) => {
    const key = groupBy(row) || "Unspecified";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(row);
  });
  return order.map((heading) => ({ heading, rows: map.get(heading) }));
}

/**
 * Export an array of objects to a downloaded CSV file. When `groupBy` is
 * given, rows are broken into labeled blocks (blank line + heading line)
 * instead of one flat list — e.g. separate "Computer Science — Morning" /
 * "Information Technology — Evening" sections in the same file.
 * @param {string} filename - e.g. "projects.csv"
 * @param {{key:string,label:string,value?:(row:object)=>any}[]} columns
 * @param {object[]} rows
 * @param {(row:object)=>string} [groupBy]
 */
export function exportToCSV(filename, columns, rows, groupBy = null) {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const rowLine = (row) => columns.map((c) => escapeCsvCell(resolveCell(c, row))).join(",");

  let lines;
  if (groupBy) {
    lines = [`"${UNIVERSITY_NAME}"`, ""];
    groupRows(rows, groupBy).forEach(({ heading, rows: groupRowsList }) => {
      lines.push(`"${heading} (${groupRowsList.length})"`);
      lines.push(header);
      groupRowsList.forEach((row) => lines.push(rowLine(row)));
      lines.push("");
    });
  } else {
    lines = [header, ...rows.map(rowLine)];
  }

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/**
 * Export an array of objects to a downloaded PDF table.
 * @param {string} filename - e.g. "projects.pdf"
 * @param {string} title - heading printed at the top of the PDF
 * @param {{key:string,label:string,value?:(row:object)=>any}[]} columns
 * @param {object[]} rows
 * @param {string[]} [summaryLines] - optional summary text printed between the
 *   title and the table, e.g. totals/averages for a report-style export.
 * @param {{groupBy?:(row:object)=>string, logoDataUrl?:string}} [options] -
 *   `groupBy` splits the table into labeled sections (one autoTable per
 *   group) instead of one flat table; `logoDataUrl` overrides the default
 *   university crest (pass `null` explicitly to omit the logo entirely).
 */
export function exportToPDF(filename, title, columns, rows, summaryLines = [], options = {}) {
  const doc = new jsPDF({ orientation: "landscape" });
  const { groupBy } = options;
  const logoDataUrl = options.logoDataUrl !== undefined ? options.logoDataUrl : UNIVERSITY_LOGO_DATA_URL;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", 14, 6, 16, 16);
  }
  const textX = logoDataUrl ? 34 : 14;

  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55); // #1f2937
  doc.text(UNIVERSITY_NAME, textX, 13);

  doc.setFontSize(15);
  doc.setTextColor(30, 64, 175); // #1e40af
  doc.text(title, textX, 21);

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // #6b7280
  doc.text(`Generated: ${new Date().toLocaleString()}`, textX, 27);

  let startY = 33;
  if (summaryLines.length) {
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    summaryLines.forEach((line, i) => {
      doc.text(line, 14, startY + i * 6);
    });
    startY += summaryLines.length * 6 + 6;
  }

  const bodyOf = (rowList) =>
    rowList.map((row) =>
      columns.map((c) => {
        const v = resolveCell(c, row);
        return v === null || v === undefined ? "" : String(v);
      })
    );

  const tableStyle = {
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" }, // #2563eb
    alternateRowStyles: { fillColor: [248, 250, 252] }, // #f8fafc
  };

  if (groupBy) {
    groupRows(rows, groupBy).forEach(({ heading, rows: groupRowsList }) => {
      doc.setFontSize(10.5);
      doc.setTextColor(31, 41, 55);
      doc.text(`${heading}  (${groupRowsList.length})`, 14, startY);
      autoTable(doc, {
        startY: startY + 4,
        head: [columns.map((c) => c.label)],
        body: bodyOf(groupRowsList),
        ...tableStyle,
      });
      startY = doc.lastAutoTable.finalY + 12;
    });
  } else {
    autoTable(doc, { startY, head: [columns.map((c) => c.label)], body: bodyOf(rows), ...tableStyle });
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
