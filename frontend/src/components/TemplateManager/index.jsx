import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./TemplateManager.module.css";
import Loader from "../Loader";
import { resolveFileUrl } from "../../utils/resolveFileUrl";
import {
  FaDownload, FaFilePdf, FaFileWord, FaFilePowerpoint,
  FaFileArchive, FaFileAlt, FaEye, FaUniversity, FaChalkboardTeacher,
} from "react-icons/fa";

const CATEGORY_COLORS = {
  "Proposal":        { bg: "#eff6ff", color: "#1d4ed8" },
  "Progress Report": { bg: "#f0fdf4", color: "#166534" },
  "Final Report":    { bg: "#fdf4ff", color: "#7e22ce" },
  "Defense":         { bg: "#fff7ed", color: "#c2410c" },
  "General":         { bg: "#f9fafb", color: "#374151" },
};

const FileIcon = ({ type, size = 22 }) => {
  const s = { fontSize: size };
  if (type === "pdf")  return <FaFilePdf  style={{ ...s, color: "#dc2626" }} />;
  if (type === "docx") return <FaFileWord style={{ ...s, color: "#1d4ed8" }} />;
  if (type === "pptx") return <FaFilePowerpoint style={{ ...s, color: "#ea580c" }} />;
  if (type === "zip")  return <FaFileArchive style={{ ...s, color: "#92400e" }} />;
  return <FaFileAlt style={{ ...s, color: "#6b7280" }} />;
};

const iconBgClass = (type, s) => {
  if (type === "pdf")  return s.iconPdf;
  if (type === "docx") return s.iconDocx;
  if (type === "pptx") return s.iconPptx;
  if (type === "zip")  return s.iconZip;
  return s.iconFile;
};

const TemplateCard = ({ tpl, apiBase }) => {
  const cc = CATEGORY_COLORS[tpl.category] || CATEGORY_COLORS.General;
  return (
    <div className={styles.card}>
      <div className={`${styles.cardIconWrap} ${iconBgClass(tpl.fileType, styles)}`}>
        <FileIcon type={tpl.fileType} size={22} />
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardTitle} title={tpl.title}>{tpl.title}</div>
        {tpl.description && <div className={styles.cardDesc}>{tpl.description}</div>}
        <div className={styles.cardMeta}>
          <span className={styles.catBadge} style={{ background: cc.bg, color: cc.color }}>
            {tpl.category}
          </span>
          <span className={styles.fileNameSmall}>{tpl.originalName}</span>
        </div>
        <div className={styles.cardFooter}>
          {tpl.fileType === "pdf" && (
            <a
              href={resolveFileUrl(tpl.fileUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.previewBtn}
              title="Preview PDF"
            >
              <FaEye />
            </a>
          )}
          <a
            href={resolveFileUrl(tpl.fileUrl)}
            download={tpl.originalName}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.downloadBtn}
          >
            <FaDownload /> Download
          </a>
        </div>
      </div>
    </div>
  );
};

export default function TemplateManager() {
  const [globalTemplates,  setGlobal]   = useState([]);
  const [projectTemplates, setProject]  = useState([]);
  const [projects,         setProjects] = useState([]);
  const [loading,          setLoading]  = useState(true);
  const [activeCategory,   setCategory] = useState("All");

  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const userId  = loggedInUser.id;
  const token   = localStorage.getItem("token");
  const apiBase = process.env.REACT_APP_API_URL || "";
  const authHdr = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    const load = async () => {
      try {
        const projRes = await axios
          .get(`${apiBase}/auth/student-project/${userId}`)
          .catch(() => ({ data: [] }));
        const myProjects = Array.isArray(projRes.data) ? projRes.data : [];
        setProjects(myProjects);

        const globalRes = await axios.get(`${apiBase}/auth/templates/global`, authHdr);
        setGlobal(globalRes.data.templates || []);

        if (myProjects.length > 0) {
          const arrays = await Promise.all(
            myProjects.map((p) =>
              axios
                .get(`${apiBase}/auth/templates/project/${p._id}`, authHdr)
                .then((r) => r.data.templates || [])
                .catch(() => [])
            )
          );
          setProject(arrays.flat());
        }
      } catch (err) {
        console.error("Template load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  const allCategories = [
    ...new Set([
      ...globalTemplates.map((t) => t.category),
      ...projectTemplates.map((t) => t.category),
    ]),
  ].sort();

  const filterFn = (list) =>
    activeCategory === "All" ? list : list.filter((t) => t.category === activeCategory);

  const filteredGlobal  = filterFn(globalTemplates);
  const filteredProject = filterFn(projectTemplates);
  const totalDocs = globalTemplates.length + projectTemplates.length;

  if (loading) return <Loader text="Loading templates..." />;

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          <FaFileAlt />
        </div>
        <div className={styles.heroText}>
          <h1 className={styles.heading}>Templates & Documents</h1>
          <p className={styles.subheading}>
            Download official university templates and supervisor-shared materials for your FYP.
          </p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.statChip}>
            <strong>{globalTemplates.length}</strong>
            <span>University</span>
          </div>
          <div className={styles.statChip}>
            <strong>{projectTemplates.length}</strong>
            <span>Supervisor</span>
          </div>
        </div>
      </div>

      {/* Category filter */}
      {allCategories.length > 0 && (
        <div className={styles.filterBar}>
          {["All", ...allCategories].map((cat) => (
            <button
              key={cat}
              className={`${styles.filterBtn} ${activeCategory === cat ? styles.filterActive : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Section 1: University Templates */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLeft}>
            <div className={`${styles.sectionIconWrap} ${styles.global}`}>
              <FaUniversity />
            </div>
            <div>
              <h3 className={styles.sectionTitle}>University Templates</h3>
              <p className={styles.sectionSubtitle}>Official templates uploaded by the administration — available to all students.</p>
            </div>
          </div>
          <span className={styles.countBadge}>
            {filteredGlobal.length} doc{filteredGlobal.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filteredGlobal.length === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyIconWrap}><FaUniversity /></div>
            <h4>No university templates yet</h4>
            <p>
              {activeCategory !== "All"
                ? `No templates in "${activeCategory}" category yet.`
                : "The administration hasn't uploaded any templates yet."}
            </p>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {filteredGlobal.map((tpl) => (
              <TemplateCard key={tpl._id} tpl={tpl} apiBase={apiBase} />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Supervisor Materials */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLeft}>
            <div className={`${styles.sectionIconWrap} ${styles.project}`}>
              <FaChalkboardTeacher />
            </div>
            <div>
              <h3 className={styles.sectionTitle}>My Supervisor's Materials</h3>
              <p className={styles.sectionSubtitle}>Documents and resources shared by your supervisor for your project team.</p>
            </div>
          </div>
          <span className={styles.countBadge}>
            {filteredProject.length} doc{filteredProject.length !== 1 ? "s" : ""}
          </span>
        </div>

        {projects.length === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyIconWrap}><FaChalkboardTeacher /></div>
            <h4>No active FYP project</h4>
            <p>Supervisor materials will appear here once your proposal is approved and a project is created.</p>
          </div>
        ) : filteredProject.length === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyIconWrap}><FaFileAlt /></div>
            <h4>No supervisor documents yet</h4>
            <p>
              {activeCategory !== "All"
                ? `No supervisor documents in "${activeCategory}" category yet.`
                : "Your supervisor hasn't shared any documents yet."}
            </p>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {filteredProject.map((tpl) => (
              <TemplateCard key={tpl._id} tpl={tpl} apiBase={apiBase} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
