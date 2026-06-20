import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  FaBuilding, FaUsers, FaUserTie, FaLayerGroup, FaProjectDiagram,
  FaCalendarAlt, FaBarcode, FaInfoCircle, FaCopy, FaCheck,
  FaExclamationCircle, FaClipboardList, FaChevronDown,
  FaSearch, FaTimes,
} from "react-icons/fa";
import styles from "./styles.module.css";

const STATUS_CHIP = {
  ACTIVE:       styles.chipActive,
  IN_PROGRESS:  styles.chipProgress,
  UNDER_REVIEW: styles.chipReview,
  COMPLETED:    styles.chipCompleted,
  ON_HOLD:      styles.chipOnHold,
  CANCELLED:    styles.chipCompleted,
};

const STATUS_LABEL = {
  ACTIVE: "Active", IN_PROGRESS: "In Progress", UNDER_REVIEW: "Under Review",
  COMPLETED: "Completed", ON_HOLD: "On Hold", CANCELLED: "Cancelled",
};

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
];

/* ── Expandable supervised-department card ── */
const SupervisedDeptCard = ({ item, index }) => {
  const [open, setOpen] = useState(index === 0);
  const { department: dept, projects } = item;

  return (
    <div className={styles.deptCard}>
      <div className={styles.deptCardHeader} onClick={() => setOpen((o) => !o)}>
        <div className={styles.deptCardIcon}><FaBuilding /></div>
        <div className={styles.deptCardMeta}>
          <div className={styles.deptCardName}>{dept.name}</div>
          <div className={styles.deptCardPills}>
            {dept.code && (
              <span className={styles.deptPill}><FaBarcode /> {dept.code}</span>
            )}
            {dept.academicSession && dept.academicSession !== "—" && (
              <span className={styles.deptPill}><FaCalendarAlt /> {dept.academicSession}</span>
            )}
          </div>
        </div>
        <div className={styles.deptCardRight}>
          <span className={styles.projCountBadge}>
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </span>
          <FaChevronDown className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
        </div>
      </div>

      {open && (
        <div className={styles.deptCardBody}>
          {projects.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No projects yet.</p>
          ) : (
            <div className={styles.projectList}>
              {projects.map((p, idx) => (
                <div key={p._id} className={styles.projectRow}>
                  <div className={styles.projectNum}>{idx + 1}</div>
                  <div className={styles.projectInfo}>
                    <div className={styles.projectTitle}>{p.title}</div>
                    {p.teamSubject && (
                      <div className={styles.projectTeam}>{p.teamSubject}</div>
                    )}
                  </div>
                  <span className={styles.projectDate}>
                    {new Date(p.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short", year: "numeric",
                    })}
                  </span>
                  <span className={`${styles.statusChip} ${STATUS_CHIP[p.status] || styles.chipCompleted}`}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── CopyButton with per-code state ── */
const CopyButton = ({ text }) => {
  const [done, setDone] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    });
  };
  return (
    <button
      className={`${styles.copyBtn} ${done ? styles.copySuccess : ""}`}
      onClick={handle}
    >
      {done ? <><FaCheck /> Copied!</> : <><FaCopy /> Copy</>}
    </button>
  );
};

/* ── Main component ── */
const SupervisorDepartments = () => {
  const [homeDept,    setHomeDept]    = useState(null);
  const [supervised,  setSupervised]  = useState([]);
  const [supInfo,     setSupInfo]     = useState(null);
  const [totalProj,   setTotalProj]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [searchTerm,  setSearchTerm]  = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const apiBase = process.env.REACT_APP_API_URL || "";
  const token   = localStorage.getItem("token");
  const authHdr = { headers: { Authorization: `Bearer ${token}` } };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${apiBase}/auth/supervisor/my-department`, authHdr);
      setHomeDept(data.homeDepartment || null);
      setSupervised(data.supervisedDepartments || []);
      setSupInfo(data.supervisor || null);
      setTotalProj(data.totalProjects || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load department data.");
    } finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Filter + search supervised departments/projects ── */
  const filteredSupervised = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return supervised
      .map((item) => {
        const deptNameMatches = term && item.department.name?.toLowerCase().includes(term);

        const projects = item.projects.filter((p) => {
          const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
          if (!matchesStatus) return false;
          if (!term || deptNameMatches) return true;
          return (
            p.title?.toLowerCase().includes(term) ||
            p.teamSubject?.toLowerCase().includes(term)
          );
        });

        return { ...item, projects };
      })
      .filter((item) => item.projects.length > 0);
  }, [supervised, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "ALL";
  const clearFilters = () => { setSearchTerm(""); setStatusFilter("ALL"); };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        <p>Loading department overview...</p>
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBox}>
          <FaExclamationCircle /> {error}
        </div>
      </div>
    );
  }

  /* ── No home department ── */
  if (!homeDept) {
    return (
      <div className={styles.container}>
        <div className={styles.noDeptWrap}>
          <div className={styles.noDeptIcon}><FaBuilding /></div>
          <h3>No Home Department Assigned</h3>
          <p>
            You are not assigned to any department. Ask your admin to share a
            supervisor join code and re-register, or contact support.
          </p>
        </div>
      </div>
    );
  }

  /* ── derive total supervised depts (exclude home if same) ── */
  const totalDepts = supervised.length;

  return (
    <div className={styles.container}>

      {/* ── Hero: home department ── */}
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaBuilding /></div>
        <div className={styles.heroBody}>
          <div className={styles.heroTitle}>{homeDept.name}</div>
          <div className={styles.heroSub}>
            <span className={styles.heroPill}><FaBarcode /> {homeDept.code}</span>
            <span className={styles.heroPill}><FaCalendarAlt /> {homeDept.academicSession}</span>
            {supInfo?.designation && (
              <span className={styles.heroPill}><FaUserTie /> {supInfo.designation}</span>
            )}
          </div>
        </div>
        <div className={styles.heroRight}>
          <div className={`${styles.statusBadge} ${homeDept.isActive ? styles.statusActive : styles.statusInactive}`}>
            <span className={`${styles.heroDot} ${homeDept.isActive ? "" : styles.heroDotRed}`} />
            {homeDept.isActive ? "Active" : "Inactive"}
          </div>
        </div>
      </div>

      {/* ── Overview stats ── */}
      <div className={styles.statsRow}>
        {[
          { label: "Dept Students",    value: homeDept.totalStudents    ?? 0, icon: <FaUsers />,         color: styles.green  },
          { label: "Dept Supervisors", value: homeDept.totalSupervisors ?? 0, icon: <FaUserTie />,        color: styles.blue   },
          { label: "Dept Teams",       value: homeDept.totalTeams       ?? 0, icon: <FaLayerGroup />,     color: styles.purple },
          { label: "My FYP Projects",  value: totalProj,                      icon: <FaProjectDiagram />, color: styles.orange },
        ].map((s) => (
          <div key={s.label} className={styles.statCard}>
            <div className={`${styles.statIconWrap} ${s.color}`}>{s.icon}</div>
            <div className={styles.statBody}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Home dept info + join codes ── */}
      <div className={styles.grid2}>

        {/* Department Details */}
        <div className={styles.infoCard}>
          <div className={styles.cardTitleRow}>
            <div className={styles.cardTitleIcon}><FaInfoCircle /></div>
            <h3 className={styles.cardTitle}>Home Department Details</h3>
          </div>

          {[
            ["Department Code", homeDept.code],
            ["Academic Session", homeDept.academicSession],
            ["Status", homeDept.isActive ? "Active" : "Inactive"],
            supInfo?.employeeId  ? ["Employee ID",  supInfo.employeeId]  : null,
            supInfo?.designation ? ["Designation",  supInfo.designation] : null,
          ].filter(Boolean).map(([label, value]) => (
            <div key={label} className={styles.infoRow}>
              <span className={styles.infoLabel}>{label}</span>
              <span className={styles.infoValue}>{value}</span>
            </div>
          ))}

          {homeDept.description && (
            <p className={styles.descText}>{homeDept.description}</p>
          )}
        </div>

        {/* Join Codes */}
        <div className={styles.infoCard}>
          <div className={styles.cardTitleRow}>
            <div className={styles.cardTitleIcon}><FaClipboardList /></div>
            <h3 className={styles.cardTitle}>Department Join Codes</h3>
          </div>

          {[
            {
              label: "Supervisor Join Code",
              code: homeDept.supervisorJoinCode,
              note: "Share with colleagues to invite them as supervisors.",
            },
            {
              label: "Student Join Code",
              code: homeDept.studentJoinCode,
              note: "Students use this code to register and join the department.",
            },
          ].map(({ label, code, note }) => (
            <div key={label} className={styles.joinCodeSection}>
              <div className={styles.infoLabel}>{label}</div>
              <div className={styles.joinCodeBox}>
                <span className={styles.joinCode}>{code}</span>
                <CopyButton text={code} />
              </div>
              <p className={styles.joinCodeNote}>{note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Supervised Departments ── */}
      <div className={styles.sectionBlock}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>
            <FaProjectDiagram style={{ color: "#1e40af" }} />
            Departments I'm Supervising
            <span className={styles.countPill}>{filteredSupervised.length}</span>
          </div>
        </div>

        {totalDepts > 0 && (
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by project, team, or department..."
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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.statusSelect}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        )}

        {totalDepts === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyIconWrap}><FaLayerGroup /></div>
            <h4>No active supervised teams yet</h4>
            <p>
              Once student proposals are approved and projects are created, the
              departments of those teams will appear here.
            </p>
          </div>
        ) : filteredSupervised.length === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyIconWrap}><FaSearch /></div>
            <h4>No matching projects</h4>
            <p>Try a different search term or status filter.</p>
            <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters} style={{ marginTop: "12px" }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className={styles.deptCardList}>
            {filteredSupervised.map((item, idx) => (
              <SupervisedDeptCard key={item.department._id || idx} item={item} index={idx} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default SupervisorDepartments;
