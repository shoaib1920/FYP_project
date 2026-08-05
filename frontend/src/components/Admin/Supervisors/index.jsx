import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import { showToast } from "../../../utils/toastStore";
import {
  FaUserTie,
  FaUserCheck,
  FaUserSlash,
  FaBuilding,
  FaProjectDiagram,
  FaSearch,
  FaTimes,
  FaEnvelope,
} from "react-icons/fa";

const initials = (name) =>
  name ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

const Supervisors = () => {
  const [supervisors, setSupervisors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState("");

  const apiBase = process.env.REACT_APP_API_URL || "";
  const adminToken = localStorage.getItem("adminToken");
  const authHeader = { headers: { Authorization: `Bearer ${adminToken}` } };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [supRes, deptRes, projRes, propRes] = await Promise.all([
        axios.get(`${apiBase}/auth/admin/supervisors`, authHeader),
        axios.get(`${apiBase}/auth/admin/department`, authHeader),
        axios.get(`${apiBase}/auth/admin/projects`, authHeader),
        axios.get(`${apiBase}/auth/proposals/admin`, authHeader),
      ]);
      setSupervisors(supRes.data.supervisors || []);
      setDepartments(deptRes.data.departments || []);
      setProjects(projRes.data.projects || []);
      setProposals(propRes.data.proposals || []);
    } catch (err) {
      console.error("Error fetching supervisors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enriched = useMemo(() => {
    return supervisors.map((sup) => {
      const supId = String(sup._id);
      const supProjects = projects.filter(
        (p) => String(p.supervisorId?._id || p.supervisorId) === supId
      );
      const activeProjects = supProjects.filter(
        (p) => !["COMPLETED", "CANCELLED"].includes(p.status)
      ).length;
      const pendingProposals = proposals.filter(
        (p) =>
          String(p.assignedSupervisorId?._id || p.assignedSupervisorId) === supId &&
          p.status === "SUPERVISOR_ASSIGNED"
      ).length;

      return {
        ...sup,
        departmentName: sup.department?.name || "—",
        totalProjects: supProjects.length,
        activeProjects,
        pendingProposals,
      };
    });
  }, [supervisors, projects, proposals]);

  const stats = useMemo(
    () => ({
      total: enriched.length,
      active: enriched.filter((s) => s.status === "Active").length,
      inactive: enriched.filter((s) => s.status === "Inactive").length,
      withActiveProjects: enriched.filter((s) => s.activeProjects > 0).length,
    }),
    [enriched]
  );

  const deptOptions = useMemo(() => departments.map((d) => d.name).sort(), [departments]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return enriched.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (deptFilter !== "ALL" && s.departmentName !== deptFilter) return false;
      if (!term) return true;
      return (
        s.name?.toLowerCase().includes(term) ||
        s.email?.toLowerCase().includes(term) ||
        s.employeeId?.toLowerCase().includes(term) ||
        s.departmentName.toLowerCase().includes(term)
      );
    });
  }, [enriched, searchTerm, statusFilter, deptFilter]);

  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "ALL" || deptFilter !== "ALL";
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setDeptFilter("ALL");
  };

  const handleToggleStatus = async (sup) => {
    const newStatus = sup.status === "Active" ? "Inactive" : "Active";
    if (
      newStatus === "Inactive" &&
      !window.confirm(`Deactivate ${sup.name}? They won't be able to log in until reactivated.`)
    ) {
      return;
    }
    setActionLoading(sup._id + "_status");
    try {
      await axios.put(
        `${apiBase}/auth/admin/supervisors/${sup._id}/status`,
        { status: newStatus },
        authHeader
      );
      setSupervisors((prev) =>
        prev.map((s) => (s._id === sup._id ? { ...s, status: newStatus } : s))
      );
      showToast(`${sup.name} ${newStatus === "Active" ? "activated" : "deactivated"} successfully.`, "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update status.", "error");
    } finally {
      setActionLoading("");
    }
  };

  const handleDepartmentChange = async (sup, departmentId) => {
    if (!departmentId || departmentId === String(sup.department?._id || "")) return;
    setActionLoading(sup._id + "_dept");
    try {
      const res = await axios.put(
        `${apiBase}/auth/admin/supervisors/${sup._id}/department`,
        { departmentId },
        authHeader
      );
      setSupervisors((prev) =>
        prev.map((s) => (s._id === sup._id ? res.data.supervisor : s))
      );
      showToast(`${sup.name}'s department updated.`, "success");
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to update department.", "error");
    } finally {
      setActionLoading("");
    }
  };

  const noDataYet = !loading && supervisors.length === 0;
  const noResults = !loading && !noDataYet && filtered.length === 0;

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaUserTie /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Supervisors</h2>
          <p className={styles.subheading}>Manage supervisor accounts, departments, and access.</p>
        </div>
      </div>

      {!loading && !noDataYet && (
        <>
          {/* Stats */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dbeafe", color: "#1e40af" }}>
                <FaUserTie />
              </div>
              <div>
                <h4>Total Supervisors</h4>
                <p>{stats.total}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
                <FaUserCheck />
              </div>
              <div>
                <h4>Active</h4>
                <p>{stats.active}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <FaUserSlash />
              </div>
              <div>
                <h4>Inactive</h4>
                <p>{stats.inactive}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#ede9fe", color: "#6d28d9" }}>
                <FaProjectDiagram />
              </div>
              <div>
                <h4>Currently Supervising</h4>
                <p>{stats.withActiveProjects}</p>
              </div>
            </div>
          </div>

          {/* Search + filter */}
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by name, email, employee ID, or department..."
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
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className={styles.statusSelect}
            >
              <option value="ALL">All Departments</option>
              {deptOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          <p className={styles.resultsCount}>
            Showing {filtered.length} of {enriched.length} supervisor{enriched.length !== 1 ? "s" : ""}
          </p>
        </>
      )}

      {loading ? (
        <Loader text="Loading supervisors..." />
      ) : noDataYet ? (
        <div className={styles.noResultsBox}>
          <div className={styles.emptyIconWrap}><FaUserTie /></div>
          <h4>No supervisors yet</h4>
          <p>Supervisors who sign up with a department join code will show up here.</p>
        </div>
      ) : noResults ? (
        <div className={styles.noResultsBox}>
          <p className={styles.emptyMsg}>No supervisors match your search/filter.</p>
          <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Supervisor</th>
                <th>Email</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Status</th>
                <th>Workload</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sup) => (
                <tr key={sup._id}>
                  <td>
                    <div className={styles.nameCell}>
                      <span className={styles.avatar}>{initials(sup.name)}</span>
                      {sup.name}
                    </div>
                  </td>
                  <td>
                    <span className={styles.emailCell}><FaEnvelope /> {sup.email}</span>
                  </td>
                  <td>{sup.employeeId || "—"}</td>
                  <td>
                    <select
                      className={styles.deptSelect}
                      value={sup.department?._id || ""}
                      onChange={(e) => handleDepartmentChange(sup, e.target.value)}
                      disabled={actionLoading === sup._id + "_dept"}
                    >
                      <option value="" disabled>Unassigned</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span
                      className={styles.badge}
                      style={
                        sup.status === "Active"
                          ? { background: "#dcfce7", color: "#15803d" }
                          : { background: "#fee2e2", color: "#b91c1c" }
                      }
                    >
                      {sup.status}
                    </span>
                  </td>
                  <td>
                    <div className={styles.workloadCell}>
                      <span><FaBuilding /> {sup.departmentName}</span>
                      <span>{sup.activeProjects} active project{sup.activeProjects !== 1 ? "s" : ""}</span>
                      {sup.pendingProposals > 0 && (
                        <span className={styles.workloadHighlight}>
                          {sup.pendingProposals} pending proposal{sup.pendingProposals !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className={sup.status === "Active" ? styles.deactivateBtn : styles.activateBtn}
                      onClick={() => handleToggleStatus(sup)}
                      disabled={actionLoading === sup._id + "_status"}
                    >
                      {actionLoading === sup._id + "_status"
                        ? "..."
                        : sup.status === "Active"
                        ? "Deactivate"
                        : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Supervisors;
