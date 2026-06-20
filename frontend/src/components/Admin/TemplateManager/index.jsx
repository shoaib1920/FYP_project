import React, { useState, useEffect } from "react";
import axios from "axios";
import { FaTrash, FaUpload, FaFileAlt, FaFilePdf, FaFileWord, FaFilePowerpoint, FaFileArchive, FaFolderOpen, FaSearch, FaTimes } from "react-icons/fa";
import styles from "./styles.module.css";

const CATEGORIES = ["Proposal", "Progress Report", "Final Report", "Defense", "General"];

const CATEGORY_COLORS = {
  "Proposal":        { bg: "#eff6ff", color: "#1d4ed8" },
  "Progress Report": { bg: "#f0fdf4", color: "#166534" },
  "Final Report":    { bg: "#fdf4ff", color: "#7e22ce" },
  "Defense":         { bg: "#fff7ed", color: "#c2410c" },
  "General":         { bg: "#f9fafb", color: "#374151" },
};

const FileIcon = ({ type }) => {
  if (type === "pdf")  return <FaFilePdf  style={{ color: "#dc2626" }} />;
  if (type === "docx") return <FaFileWord style={{ color: "#1d4ed8" }} />;
  if (type === "pptx") return <FaFilePowerpoint style={{ color: "#ea580c" }} />;
  if (type === "zip")  return <FaFileArchive style={{ color: "#92400e" }} />;
  return <FaFileAlt style={{ color: "#6b7280" }} />;
};

const AdminTemplateManager = () => {
  const [templates, setTemplates]   = useState([]);
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [category, setCategory]     = useState("");
  const [file, setFile]             = useState(null);
  const [uploading, setUploading]   = useState(false);
  const [message, setMessage]       = useState("");
  const [activeFilter, setFilter]   = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const adminToken = localStorage.getItem("adminToken");
  const adminData  = JSON.parse(localStorage.getItem("adminData") || "{}");
  const apiBase    = process.env.REACT_APP_API_URL || "";
  const authHdr    = { headers: { Authorization: `Bearer ${adminToken}` } };

  const showMsg = (msg, isErr = false) => {
    setMessage({ text: msg, error: isErr });
    setTimeout(() => setMessage(""), 4000);
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${apiBase}/auth/templates/admin`, authHdr);
      setTemplates(res.data.templates || []);
    } catch (err) {
      console.error("Fetch templates failed", err);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title.trim() || !category || !file) {
      showMsg("Please fill title, category, and choose a file.", true);
      return;
    }
    const formData = new FormData();
    formData.append("template",       file);
    formData.append("title",          title.trim());
    formData.append("description",    description.trim());
    formData.append("category",       category);
    formData.append("uploadedByName", adminData.name || "Admin");

    try {
      setUploading(true);
      await axios.post(`${apiBase}/auth/templates/global`, formData, {
        headers: { ...authHdr.headers, "Content-Type": "multipart/form-data" },
      });
      showMsg("Template uploaded successfully.");
      setTitle(""); setDesc(""); setCategory(""); setFile(null);
      fetchTemplates();
    } catch (err) {
      showMsg(err.response?.data?.error || "Upload failed.", true);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this template? Students will no longer see it.")) return;
    try {
      await axios.delete(`${apiBase}/auth/templates/${id}`, authHdr);
      setTemplates((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      showMsg("Delete failed.", true);
    }
  };

  const filtered = templates.filter((t) => {
    if (activeFilter !== "All" && t.category !== activeFilter) return false;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      t.title?.toLowerCase().includes(term) ||
      t.description?.toLowerCase().includes(term) ||
      t.originalName?.toLowerCase().includes(term)
    );
  });

  const hasActiveFilters = activeFilter !== "All" || searchTerm.trim() !== "";
  const clearFilters = () => { setFilter("All"); setSearchTerm(""); };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaFolderOpen /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Template Manager</h2>
          <p className={styles.subheading}>
            Upload global templates visible to all students across all departments.
          </p>
        </div>
      </div>

      {message && (
        <div className={message.error ? styles.errorMsg : styles.successMsg}>
          {message.text}
        </div>
      )}

      {/* Upload Form */}
      <div className={styles.uploadCard}>
        <h3 className={styles.sectionTitle}>Upload New Template</h3>
        <form onSubmit={handleUpload} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title *</label>
              <input
                className={styles.input}
                type="text"
                placeholder="e.g. Final Report Template 2024"
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
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Description (optional)</label>
            <textarea
              className={styles.textarea}
              placeholder="Briefly describe this template..."
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
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* Search + Filter Tabs */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by title, description, or file name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          {searchTerm && (
            <button
              type="button"
              className={styles.searchClearBtn}
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
            >
              <FaTimes />
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      <div className={styles.filterRow}>
        {["All", ...CATEGORIES].map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${activeFilter === f ? styles.filterActive : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
            {f !== "All" && (
              <span className={styles.filterCount}>
                {templates.filter((t) => t.category === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {templates.length > 0 && (
        <p className={styles.resultsCount}>
          Showing {filtered.length} of {templates.length} template{templates.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Template List */}
      {filtered.length === 0 ? (
        <div className={styles.emptyBox}>
          <FaFileAlt className={styles.emptyIcon} />
          <p>
            {templates.length === 0
              ? "No templates uploaded yet."
              : "No templates match your search/filter."}
          </p>
          {hasActiveFilters && templates.length > 0 && (
            <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>File</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tpl) => {
                const cc = CATEGORY_COLORS[tpl.category] || CATEGORY_COLORS.General;
                return (
                  <tr key={tpl._id}>
                    <td>
                      <div className={styles.templateTitle}>{tpl.title}</div>
                      {tpl.description && (
                        <div className={styles.templateDesc}>{tpl.description}</div>
                      )}
                    </td>
                    <td>
                      <span className={styles.catBadge} style={{ background: cc.bg, color: cc.color }}>
                        {tpl.category}
                      </span>
                    </td>
                    <td>
                      <div className={styles.fileCell}>
                        <FileIcon type={tpl.fileType} />
                        <a
                          href={`${apiBase}${tpl.fileUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.fileLink}
                        >
                          {tpl.originalName}
                        </a>
                      </div>
                    </td>
                    <td className={styles.dateCell}>
                      {new Date(tpl.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(tpl._id)}
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

export default AdminTemplateManager;
