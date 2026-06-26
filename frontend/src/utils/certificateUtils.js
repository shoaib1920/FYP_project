import jsPDF from "jspdf";

const letterGrade = (marks) =>
  marks >= 80 ? "A" : marks >= 70 ? "B" : marks >= 60 ? "C" : marks >= 50 ? "D" : "F";

/**
 * Generates and downloads a "Certificate of Completion" PDF for a finished,
 * grade-released FYP project. One certificate per project, listing every
 * team member with their individual mark.
 * @param {object} project - must have title, supervisorId.name, teamId.subject,
 *   evaluationMarks, memberGrades, completionDate
 */
export function generateCompletionCertificate(project) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const centerX = pageW / 2;

  // ── Decorative border ──
  doc.setDrawColor(30, 64, 175); // #1e40af
  doc.setLineWidth(1.2);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, pageW - 24, pageH - 24);

  // ── Header ──
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text("FYP MANAGEMENT PORTAL", centerX, 26, { align: "center" });

  doc.setFontSize(30);
  doc.setTextColor(30, 64, 175); // #1e40af
  doc.text("Certificate of Completion", centerX, 40, { align: "center" });

  doc.setDrawColor(59, 130, 246); // #3b82f6
  doc.setLineWidth(0.6);
  doc.line(centerX - 50, 45, centerX + 50, 45);

  // ── Body ──
  doc.setFont("times", "normal");
  doc.setFontSize(13);
  doc.setTextColor(55, 65, 81); // #374151
  doc.text("This is to certify that the following team has successfully completed", centerX, 58, { align: "center" });
  doc.text("their Final Year Project:", centerX, 65, { align: "center" });

  doc.setFont("times", "bolditalic");
  doc.setFontSize(20);
  doc.setTextColor(17, 24, 39); // #111827
  const titleLines = doc.splitTextToSize(`"${project.title}"`, pageW - 80);
  doc.text(titleLines, centerX, 78, { align: "center" });

  let y = 78 + titleLines.length * 8 + 6;

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.setTextColor(55, 65, 81);
  doc.text(`Team: ${project.teamId?.subject || "N/A"}`, centerX, y, { align: "center" });
  y += 7;
  doc.text(`Supervised by: ${project.supervisorId?.name || "N/A"}`, centerX, y, { align: "center" });
  y += 12;

  // ── Member grades table ──
  const grades = project.memberGrades?.length
    ? project.memberGrades
    : [{ name: "Team Average", marks: project.evaluationMarks ?? 0 }];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.setFillColor(37, 99, 235); // #2563eb
  const tableX = centerX - 70;
  const tableW = 140;
  doc.rect(tableX, y, tableW, 8, "F");
  doc.text("Team Member", tableX + 6, y + 5.5);
  doc.text("Marks", tableX + tableW - 30, y + 5.5);
  doc.text("Grade", tableX + tableW - 12, y + 5.5);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(31, 41, 55);
  grades.forEach((g, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(tableX, y, tableW, 7, "F");
    }
    doc.text(String(g.name), tableX + 6, y + 5);
    doc.text(`${g.marks}/100`, tableX + tableW - 32, y + 5);
    doc.text(letterGrade(g.marks), tableX + tableW - 12, y + 5);
    y += 7;
  });

  y += 12;

  // ── Footer ──
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  const dateStr = project.completionDate ? new Date(project.completionDate).toLocaleDateString() : new Date().toLocaleDateString();
  doc.text(`Awarded on ${dateStr}`, centerX, y, { align: "center" });

  doc.save(`${project.title.replace(/\s+/g, "-").toLowerCase()}-certificate.pdf`);
}
