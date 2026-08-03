import React, { useEffect, useState } from "react";
import axios from "axios";
import { resolveFileUrl } from "../../utils/resolveFileUrl";
import {
  FaTimes, FaFileSignature, FaCalendarWeek, FaFileAlt, FaCamera,
  FaHandshake, FaFileUpload, FaExclamationTriangle, FaCheckCircle,
} from "react-icons/fa";
import styles from "./styles.module.css";

/**
 * Read-only, consolidated view of every document/record tied to one project —
 * proposal (+ revision history), weekly progress logs, final report (+ AI
 * quality check + rejection history), live-review batches, meeting minutes,
 * and project-specific templates. Previously these only existed scattered
 * one-at-a-time across five separate modules with no single place to see
 * "everything submitted for this project." Shared across all three roles
 * (student/supervisor/admin) via the `tokenKey` prop, same convention as
 * the shared Notifications component.
 */
const ProjectDocumentsModal = ({ projectId, tokenKey = "token", onClose }) => {
  const [documents, setDocuments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDocuments = async () => {
      const token = localStorage.getItem(tokenKey);
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_API_URL}/auth/projects/${projectId}/documents`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setDocuments(res.data.documents);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load project documents.");
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, [projectId, tokenKey]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Project Documents</h3>
          <button className={styles.closeBtn} onClick={onClose}><FaTimes /></button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <p className={styles.note}>Loading...</p>
          ) : error ? (
            <p className={styles.errorNote}>{error}</p>
          ) : (
            <>
              <section className={styles.section}>
                <h4 className={styles.sectionTitle}><FaFileSignature /> Proposal</h4>
                {documents.proposal?.currentUrl ? (
                  <a href={resolveFileUrl(documents.proposal.currentUrl)} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                    Current proposal report
                  </a>
                ) : (
                  <p className={styles.note}>No proposal report on file.</p>
                )}
                {documents.proposal?.revisions?.length > 0 && (
                  <ul className={styles.list}>
                    {documents.proposal.revisions.map((r, i) => (
                      <li key={i}>
                        <a href={resolveFileUrl(r.proposalReportUrl)} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                          Revision from {new Date(r.revisedAt).toLocaleDateString()}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}><FaCalendarWeek /> Weekly Progress Logs ({documents.progressLogs.length})</h4>
                {documents.progressLogs.length === 0 ? (
                  <p className={styles.note}>No progress logs submitted yet.</p>
                ) : (
                  <ul className={styles.list}>
                    {documents.progressLogs.map((p) => (
                      <li key={p.weekNumber}>
                        <strong>Week {p.weekNumber}</strong> — {p.status}
                        {p.submittedAt && <span className={styles.dateNote}> ({new Date(p.submittedAt).toLocaleDateString()})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}><FaFileAlt /> Final Report</h4>
                {documents.finalReport.status === "NOT_SUBMITTED" ? (
                  <p className={styles.note}>Not submitted yet.</p>
                ) : (
                  <>
                    {documents.finalReport.url && (
                      <a href={resolveFileUrl(documents.finalReport.url)} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                        View submitted report
                      </a>
                    )}
                    {documents.finalReport.reportQualityCheck?.score != null && (
                      <p className={styles.note}>
                        AI quality score: <strong>{documents.finalReport.reportQualityCheck.score}/100</strong>
                        {documents.finalReport.reportQualityCheck.aiGenerated?.likelihoodScore != null && (
                          <> · AI-generated likelihood: <strong>{documents.finalReport.reportQualityCheck.aiGenerated.likelihoodScore}%</strong></>
                        )}
                      </p>
                    )}
                    {documents.finalReport.copyleaksCheck?.aiPercentage != null && (
                      <p className={styles.note}>
                        Copyleaks AI-generated: <strong>{documents.finalReport.copyleaksCheck.aiPercentage}%</strong>
                        {" "}· Human-written: <strong>{documents.finalReport.copyleaksCheck.humanPercentage}%</strong>
                      </p>
                    )}
                    {documents.finalReport.rejection && (
                      <p className={styles.warnNote}>
                        <FaExclamationTriangle /> Previously rejected ({new Date(documents.finalReport.rejection.rejectedAt).toLocaleDateString()}): {documents.finalReport.rejection.reason}
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}><FaCamera /> Live Review Batches ({documents.reviewNotes.length})</h4>
                {documents.reviewNotes.length === 0 ? (
                  <p className={styles.note}>No live-review sessions yet.</p>
                ) : (
                  <ul className={styles.list}>
                    {documents.reviewNotes.map((n) => (
                      <li key={n._id}>
                        {n.items.length} screenshot{n.items.length !== 1 ? "s" : ""} — {new Date(n.createdAt).toLocaleDateString()}
                        {" "}
                        {n.status === "RESOLVED" ? (
                          <span className={styles.resolvedTag}><FaCheckCircle /> Resolved</span>
                        ) : (
                          <span className={styles.openTag}>Open</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}><FaHandshake /> Meetings ({documents.meetings.length})</h4>
                {documents.meetings.length === 0 ? (
                  <p className={styles.note}>No meetings scheduled yet.</p>
                ) : (
                  <ul className={styles.list}>
                    {documents.meetings.map((m) => (
                      <li key={m._id}>
                        {new Date(m.scheduledAt).toLocaleDateString()} — {m.status}
                        {m.minutesOfMeeting && <span className={styles.dateNote}> (minutes recorded)</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.section}>
                <h4 className={styles.sectionTitle}><FaFileUpload /> Project Templates ({documents.templates.length})</h4>
                {documents.templates.length === 0 ? (
                  <p className={styles.note}>No project-specific templates uploaded.</p>
                ) : (
                  <ul className={styles.list}>
                    {documents.templates.map((t) => (
                      <li key={t._id}>
                        <a href={resolveFileUrl(t.fileUrl)} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                          {t.title}
                        </a> — {t.category}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDocumentsModal;
