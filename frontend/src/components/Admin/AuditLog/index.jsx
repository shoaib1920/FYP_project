import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import {
  FaHistory,
  FaSearch,
  FaTimes,
  FaUserGraduate,
  FaUserTie,
  FaShieldAlt,
} from "react-icons/fa";

const ACTOR_ICON = {
  student: FaUserGraduate,
  supervisor: FaUserTie,
  admin: FaShieldAlt,
};

const ACTOR_COLOR = {
  student: { bg: "#dbeafe", color: "#1e40af" },
  supervisor: { bg: "#fef3c7", color: "#92400e" },
  admin: { bg: "#fce7f3", color: "#9d174d" },
};

const formatAction = (action) => action.replace(/_/g, " ");

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [actionTypes, setActionTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const apiBase = process.env.REACT_APP_API_URL || "";
  const token = localStorage.getItem("adminToken");

  const fetchLogs = async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = { page: targetPage, limit };
      if (actionFilter !== "ALL") params.action = actionFilter;
      const res = await axios.get(`${apiBase}/auth/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPage(targetPage);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(`${apiBase}/auth/admin/audit-logs/actions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setActionTypes(res.data.actions || []))
      .catch((err) => console.error("Error fetching action types:", err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLogs(1);
  }, [actionFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const term = searchTerm.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!term) return logs;
    return logs.filter(
      (l) =>
        l.details?.toLowerCase().includes(term) ||
        l.action?.toLowerCase().includes(term) ||
        l.targetType?.toLowerCase().includes(term)
    );
  }, [logs, term]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasActiveFilters = searchTerm.trim() !== "" || actionFilter !== "ALL";
  const clearFilters = () => {
    setSearchTerm("");
    setActionFilter("ALL");
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaHistory /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Audit Trail</h2>
          <p className={styles.subheading}>A complete record of every grade and status-changing action in the system.</p>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by detail, action, or target type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          {searchTerm && (
            <button type="button" className={styles.searchClearBtn} onClick={() => setSearchTerm("")} aria-label="Clear search">
              <FaTimes />
            </button>
          )}
        </div>

        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className={styles.statusSelect}>
          <option value="ALL">All Actions</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>{formatAction(a)}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
            Clear
          </button>
        )}
      </div>

      <p className={styles.resultsCount}>
        Showing {filtered.length} of {total} log{total !== 1 ? "s" : ""} (page {page} of {totalPages})
      </p>

      {loading ? (
        <Loader text="Loading audit logs..." />
      ) : filtered.length === 0 ? (
        <div className={styles.noResultsBox}>
          <p className={styles.emptyMsg}>No matching audit log entries.</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((log) => {
            const Icon = ACTOR_ICON[log.actorRole] || FaShieldAlt;
            const colors = ACTOR_COLOR[log.actorRole] || ACTOR_COLOR.admin;
            return (
              <div key={log._id} className={styles.logRow}>
                <div className={styles.logIcon} style={{ background: colors.bg, color: colors.color }}>
                  <Icon />
                </div>
                <div className={styles.logBody}>
                  <div className={styles.logHeader}>
                    <span className={styles.logAction}>{formatAction(log.action)}</span>
                    <span className={styles.logTime}>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <p className={styles.logDetails}>{log.details || "—"}</p>
                  <span className={styles.logMeta}>
                    {log.actorRole} &middot; {log.targetType} &middot; {String(log.targetId)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page <= 1} onClick={() => fetchLogs(page - 1)} className={styles.pageBtn}>Previous</button>
          <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)} className={styles.pageBtn}>Next</button>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
