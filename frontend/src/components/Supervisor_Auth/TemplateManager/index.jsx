import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaTrash, FaUpload, FaFileAlt, FaFilePdf, FaFileWord,
  FaFilePowerpoint, FaFileArchive, FaCheckCircle, FaExclamationCircle,
  FaFolderOpen,
} from "react-icons/fa";
import styles from "./styles.module.css";
import { resolveFileUrl } from "../../../utils/resolveFileUrl";

const CATEGORIES = ["Proposal", "Progress Report", "Final Report", "Defense", "General"];

const CATEGORY_COLORS = {
  "Proposal":        { bg: "#eff6ff", color: "#1d4ed8" },
  "Progress Report": { bg: "#f0fdf4", color: "#166534" },
  "Final Report":    { bg: "#fdf4ff", color: "#7e22ce" },
  "Defense":         { bg: "#fff7ed", color: "#c2410c" },
  "General":         { bg: "#f9fafb", color: "#374151" },
};

const FileIcon = ({ type, size = 16 }) => {
  const s = { fontSize: size, flexShrink: 0 };
  if (type === "pdf")  return <FaFilePdf  style={{ ...s, color: "#dc2626" }} />;
  if (type === "docx") return <FaFileWord style={{ ...s, color: "#1d4ed8" }} />;
  if (type === "pptx") return <FaFilePowerpoint style={{ ...s, color: "#ea580c" }} />;
  if (type === "zip")  return <FaFileArchive style={{ ...s, color: "#92400e" }} />;
  return <FaFileAlt style={{ ...s, color: "#6b7280" }} />;
};

const SupervisorTemplateManager = () => {
  const [templates, setTemplates] = useState([]);
  const [projects,  setProjects]  = useState([]);
  const [title,       setTitle]     = useState("");
  const [description, setDesc]      = useState("");
  const [category,    setCategory]  = useState("");
  const [projectId,   setProjectId] = useState("");
  const [file,        setFile]      = useState(null);
  const [uploading,   setUploading] = useState(false);
  const [message,     setMessage]   = useState("");

  const token    = localStorage.getItem("token");
  const userData = JSON.parse(localStorage.getItem("user") || "{}");
  const apiBase  = process.env.REACT_APP_API_URL || "";
  const authHdr  = { headers: { Authorization: `Bearer ${token}` } };

  const showMsg = (msg, isErr = false) => {
    setMessage({ text: msg, error: isErr });
    setTimeout(() => setMessage(""), 4500);
  };

  const fetchData = async () => {
    try {
      const [tplRes, projRes] = await Promise.all([
        axios.get(`${apiBase}/auth/templates/supervisor`, authHdr),
        axios.get(`${apiBase}/auth/projects/supervisor`, authHdr),
      ]);
      setTemplates(tplRes.data.templates || []);
      setProjects(projRes.data.projects || []);
    } catch (err) {
      console.error("Fetch failed", err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title.trim() || !category || !projectId || !file) {
      showMsg("Please fill all required fields and choose a file.", true);
      return;
    }
    const formData = new FormData();
    formData.append("template",       file);
    formData.append("title",          title.trim());
    formData.append("description",    description.trim());
    formData.append("category",       category);
    formData.append("fypProjectId",   projectId);
    formData.append("uploadedByName", userData.name || "Supervisor");

    try {
      setUploading(true);
      await axios.post(`${apiBase}/auth/templates/project`, formData, {
        headers: { ...authHdr.headers, "Content-Type": "multipart/form-data" },
      });
      showMsg("Document uploaded successfully. Your team can now download it.");
      setTitle(""); setDesc(""); setCategory(""); setProjectId(""); setFile(null);
      fetchData();
    } catch (err) {
      showMsg(err.response?.data?.error || "Upload failed. Please try again.", true);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this document? Your team will no longer see it.")) return;
    try {
      await axios.delete(`${apiBase}/auth/templates/${id}`, authHdr);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
    } catch {
      showMsg("Delete failed. Please try again.", true);
    }
  };

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <FaFolderOpen />
        </div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Team Documents</h2>
          <p className={styles.subheading}>
            Upload reference materials, guidelines, and feedback documents for your project teams.
            Students in the selected project can view and download them.
          </p>
        </div>
        <div className={styles.heroBadge}>
          <strong>{templates.length}</strong>
          <span>Uploaded</span>
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div className={message.error ? styles.errorMsg : styles.successMsg}>
          {message.error ? <FaExclamationCircle /> : <FaCheckCircle />}
          {message.text}
        </div>
      )}

      {/* Upload Form */}
      <div className={styles.uploadCard}>
        <div className={styles.cardTitleRow}>
          <div className={styles.cardTitleIcon}><FaUpload /></div>
          <h3 className={styles.sectionTitle}>Upload New Document</h3>
        </div>
        <form onSubmit={handleUpload} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title *</label>
              <input
                className={styles.input}
                type="text"
                placeholder="e.g. Week 3 Feedback Notes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Category *</label>
              <select
                className={styles.select}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">— Select category —</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Project Team *</label>
            <select
              className={styles.select}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— Select your FYP project —</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.title}{p.teamId?.subject ? ` — ${p.teamId.subject}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description (optional)</label>
            <textarea
              className={styles.textarea}
              placeholder="Brief note about this document..."
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
            />
          </div>

          <div className={styles.fileRow}>
            <label className={styles.fileBtn}>
              <FaUpload /> Choose File
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ display: "none" }}
              />
            </label>
            {file && <span className={styles.fileName}>{file.name}</span>}
            <button type="submit" className={styles.uploadBtn} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        </form>
      </div>

      {/* Document list */}
      <div className={styles.listHeader}>
        <div className={styles.listTitle}>
          Uploaded Documents
          <span className={styles.listCount}>{templates.length}</span>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className={styles.emptyBox}>
          <div className={styles.emptyIconWrap}><FaFileAlt /></div>
          <h4>No documents uploaded yet</h4>
          <p>Use the form above to share materials with your project teams.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Project / Team</th>
                <th>File</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((tpl) => {
                const cc = CATEGORY_COLORS[tpl.category] || CATEGORY_COLORS.General;
                return (
                  <tr key={tpl._id}>
                    <td>
                      <div className={styles.titleCell}>
                        <span className={styles.templateTitle}>{tpl.title}</span>
                        {tpl.description && (
                          <span className={styles.templateDesc}>{tpl.description}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={styles.catBadge}
                        style={{ background: cc.bg, color: cc.color }}
                      >
                        {tpl.category}
                      </span>
                    </td>
                    <td>
                      <div className={styles.projectCell}>
                        <span className={styles.projectName}>{tpl.fypProjectId?.title || "—"}</span>
                        {tpl.teamId?.subject && (
                          <span className={styles.teamName}>{tpl.teamId.subject}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.fileCell}>
                        <span className={styles.fileIcon}>
                          <FileIcon type={tpl.fileType} size={15} />
                        </span>
                        <a
                          href={resolveFileUrl(tpl.fileUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fileLink}
                          title={tpl.originalName}
                        >
                          {tpl.originalName}
                        </a>
                      </div>
                    </td>
                    <td className={styles.dateCell}>
                      {new Date(tpl.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                    <td>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(tpl._id)}
                        title="Delete document"
                      >
                        <FaTrash /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SupervisorTemplateManager;
