import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import {
  FaClipboardList,
  FaHourglassHalf,
  FaCheckCircle,
  FaHistory,
  FaSearch,
  FaTimes,
  FaUsers,
  FaBuilding,
  FaUserGraduate,
} from "react-icons/fa";

const STATUS_FILTER_LABEL = {
  SUPERVISOR_ASSIGNED: "Pending Your Decision",
  SUPERVISOR_ACCEPTED: "Accepted",
  REVISION_REQUESTED_BY_SUPERVISOR: "Revision Requested",
  REVISION_REQUESTED_BY_ADMIN: "Admin Requested Revision",
  REJECTED: "Rejected",
  PENDING_ADMIN_REVIEW: "Pending Admin Review",
  APPROVED_BY_ADMIN: "Approved by Admin",
};

const ProposalApprovals = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [supervisorRemarks, setSupervisorRemarks] = useState("");
  const [expandedProposalId, setExpandedProposalId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState(null); // `${proposalId}_accept` | `${proposalId}_revision`

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/proposals/supervisor`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setProposals(response.data.proposals || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (proposalId) => {
    setActionLoading(proposalId + "_accept");
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/proposals/${proposalId}/decision`,
        { decision: "SUPERVISOR_ACCEPTED", supervisorRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Proposal accepted successfully!");
      setSupervisorRemarks("");
      setExpandedProposalId(null);
      fetchProposals();
    } catch (error) {
      console.error("Error accepting proposal:", error);
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to accept proposal";
      alert(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestRevision = async (proposalId) => {
    setActionLoading(proposalId + "_revision");
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/proposals/${proposalId}/decision`,
        { decision: "REVISION_REQUESTED_BY_SUPERVISOR", supervisorRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Revision request sent!");
      setSupervisorRemarks("");
      setExpandedProposalId(null);
      fetchProposals();
    } catch (error) {
      console.error("Error requesting revision:", error);
      const message =
        error.response?.data?.message ||
        error.message ||
        "Failed to request revision";
      alert(message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "SUPERVISOR_ASSIGNED":
        return "badgeAssigned";
      case "SUPERVISOR_ACCEPTED":
        return "badgeAccepted";
      case "REVISION_REQUESTED_BY_SUPERVISOR":
        return "badgeRevision";
      default:
        return "badgeDefault";
    }
  };

  const formatStatus = (status) => {
    return (STATUS_FILTER_LABEL[status] || status || "").replace(/_/g, " ");
  };

  const stats = useMemo(() => {
    const counts = {
      total: proposals.length,
      pending: 0,
      accepted: 0,
      revision: 0,
    };
    proposals.forEach((p) => {
      if (p.status === "SUPERVISOR_ASSIGNED") counts.pending += 1;
      if (p.status === "SUPERVISOR_ACCEPTED") counts.accepted += 1;
      if (p.status === "REVISION_REQUESTED_BY_SUPERVISOR") counts.revision += 1;
    });
    return counts;
  }, [proposals]);

  const statusOptions = useMemo(() => {
    const present = new Set(proposals.map((p) => p.status).filter(Boolean));
    return Array.from(present).map((status) => ({
      value: status,
      label: STATUS_FILTER_LABEL[status] || formatStatus(status),
    }));
  }, [proposals]);

  const filteredProposals = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return proposals.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (!term) return true;
      return (
        p.title?.toLowerCase().includes(term) ||
        p.teamLeaderId?.name?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term) ||
        p.teamId?.subject?.toLowerCase().includes(term)
      );
    });
  }, [proposals, searchTerm, statusFilter]);

  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "ALL";
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        {/* Hero */}
        <div className={styles.hero}>
          <div className={styles.heroIcon}>
            <FaClipboardList />
          </div>
          <div className={styles.heroText}>
            <h2 className={styles.heading}>Project Proposals</h2>
            <p className={styles.subheading}>
              Review proposals assigned to you and respond with a decision.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#dbeafe", color: "#1e40af" }}>
              <FaClipboardList />
            </div>
            <div>
              <h4>Total Proposals</h4>
              <p>{stats.total}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#fef3c7", color: "#92400e" }}>
              <FaHourglassHalf />
            </div>
            <div>
              <h4>Pending Your Decision</h4>
              <p>{stats.pending}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
              <FaCheckCircle />
            </div>
            <div>
              <h4>Accepted</h4>
              <p>{stats.accepted}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
              <FaHistory />
            </div>
            <div>
              <h4>Revision Requested</h4>
              <p>{stats.revision}</p>
            </div>
          </div>
        </div>

        {/* Search + filter */}
        {proposals.length > 0 && (
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by title, team leader, category, or team..."
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
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        )}

        {loading ? (
          <Loader text="Loading proposals..." />
        ) : proposals.length === 0 ? (
          <div className={styles.message}>No proposals assigned yet.</div>
        ) : filteredProposals.length === 0 ? (
          <div className={styles.message}>
            No proposals match your search/filter.
            <div>
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters} style={{ marginTop: "12px" }}>
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.cardGrid}>
            {filteredProposals.map((proposal) => (
              <div key={proposal._id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.title}>{proposal.title}</h3>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                    {proposal.aiQualityCheck?.score != null && (
                      <span
                        className={styles.statusBadge}
                        style={{ background: "#ede9fe", color: "#6d28d9" }}
                        title={
                          proposal.aiQualityCheck.issues?.length
                            ? `AI flagged: ${proposal.aiQualityCheck.issues.join("; ")}`
                            : "AI proposal quality score"
                        }
                      >
                        🤖 {proposal.aiQualityCheck.score}/100
                      </span>
                    )}
                    <span
                      className={`${styles.statusBadge} ${styles[getStatusBadgeClass(proposal.status)]}`}
                    >
                      {formatStatus(proposal.status)}
                    </span>
                  </div>
                </div>

                <div className={styles.groupMeta}>
                  <span className={styles.groupMetaChip} title="Team / group name">
                    <FaUsers /> {proposal.teamId?.subject || "Unknown team"}
                  </span>
                  <span className={`${styles.groupMetaChip} ${styles.groupMetaChipDept}`} title="Department">
                    <FaBuilding /> {proposal.departmentId?.name || "No department"}
                  </span>
                  <span className={`${styles.groupMetaChip} ${styles.groupMetaChipMembers}`} title="Team leader">
                    <FaUserGraduate /> {proposal.teamLeaderId?.name || "Unknown leader"}
                  </span>
                </div>

                {expandedProposalId === proposal._id ? (
                  <div className={styles.cardDetails}>
                    <p>
                      <strong>Abstract:</strong> {proposal.abstract}
                    </p>
                    <p>
                      <strong>Objectives:</strong> {proposal.objectives}
                    </p>
                    <p>
                      <strong>Technologies:</strong> {proposal.technologies}
                    </p>
                    <p>
                      <strong>Team Members:</strong>{" "}
                      {proposal.teamId?.members?.length
                        ? proposal.teamId.members.map((m) => m.name).join(", ")
                        : "N/A"}
                    </p>
                    <p>
                      <strong>Category:</strong> {proposal.category || "N/A"}
                    </p>
                    <p>
                      <strong>Academic Session:</strong> {proposal.academicSession || "N/A"}
                    </p>

                    {proposal.adminRemarks && (
                      <div className={styles.remarksBox}>
                        <strong>Admin Remarks:</strong> {proposal.adminRemarks}
                      </div>
                    )}

                    {proposal.supervisorRemarks && (
                      <div className={styles.remarksBox}>
                        <strong>Your Remarks:</strong> {proposal.supervisorRemarks}
                      </div>
                    )}

                    {proposal.status === "SUPERVISOR_ASSIGNED" && (
                      <div className={styles.actionSection}>
                        <textarea
                          placeholder="Your remarks (optional)"
                          value={supervisorRemarks}
                          onChange={(e) => setSupervisorRemarks(e.target.value)}
                          className={styles.remarksTextarea}
                        />
                        <div className={styles.buttonGroup}>
                          <button
                            className={`${styles.btn} ${styles.btnAccept}`}
                            onClick={() => handleAccept(proposal._id)}
                            disabled={
                              actionLoading === proposal._id + "_accept" ||
                              actionLoading === proposal._id + "_revision"
                            }
                          >
                            {actionLoading === proposal._id + "_accept" ? "Accepting..." : "✅ Accept"}
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnRevision}`}
                            onClick={() => handleRequestRevision(proposal._id)}
                            disabled={
                              actionLoading === proposal._id + "_accept" ||
                              actionLoading === proposal._id + "_revision"
                            }
                          >
                            {actionLoading === proposal._id + "_revision" ? "Requesting..." : "📝 Request Revision"}
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      className={styles.collapseBtn}
                      onClick={() => setExpandedProposalId(null)}
                    >
                      ▲ Collapse
                    </button>
                  </div>
                ) : (
                  <div className={styles.cardPreview}>
                    <p>
                      <strong>Category:</strong> {proposal.category || "N/A"}
                    </p>
                    <p>
                      <strong>Status:</strong> {formatStatus(proposal.status)}
                    </p>
                    <button
                      className={styles.expandBtn}
                      onClick={() => setExpandedProposalId(proposal._id)}
                    >
                      ▼ View Details
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProposalApprovals;
