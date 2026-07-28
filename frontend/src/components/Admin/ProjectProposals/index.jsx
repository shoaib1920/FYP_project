import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import { resolveFileUrl } from "../../../utils/resolveFileUrl";
import {
  FaClipboardList,
  FaHourglassHalf,
  FaCheckCircle,
  FaTimesCircle,
  FaUsers,
  FaBuilding,
  FaUserGraduate,
} from "react-icons/fa";

const ProposalApprovals = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [supervisors, setSupervisors] = useState([]);
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedProposalId, setExpandedProposalId] = useState(null);
  const [actionLoading, setActionLoading] = useState("");

  const token = localStorage.getItem("adminToken");

  useEffect(() => {
    fetchProposals();
    fetchSupervisors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const url = `${process.env.REACT_APP_API_URL}/auth/proposals/admin`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProposals(response.data.proposals || []);
    } catch (error) {
      console.error("Error fetching proposals:", error);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const counts = { total: proposals.length, pending: 0, approved: 0, rejected: 0 };
    proposals.forEach((p) => {
      if (p.status === "PENDING_ADMIN_REVIEW") counts.pending += 1;
      if (["APPROVED_BY_ADMIN", "SUPERVISOR_ASSIGNED", "SUPERVISOR_ACCEPTED"].includes(p.status)) counts.approved += 1;
      if (p.status === "REJECTED") counts.rejected += 1;
    });
    return counts;
  }, [proposals]);

  const displayedProposals = filterStatus
    ? proposals.filter((p) => p.status === filterStatus)
    : proposals;

  const fetchSupervisors = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/supervisors`
      );
      setSupervisors(response.data.supervisors || []);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
    }
  };

  const handleApprove = async (proposalId) => {
    setActionLoading(proposalId + "_approve");
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/proposals/${proposalId}/status`,
        { status: "APPROVED_BY_ADMIN", adminRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Proposal approved successfully!");
      setSelectedProposal(null);
      setAdminRemarks("");
      fetchProposals();
    } catch (error) {
      console.error("Error approving proposal:", error);
      alert("Failed to approve proposal");
    } finally {
      setActionLoading("");
    }
  };

  const handleReject = async (proposalId) => {
    setActionLoading(proposalId + "_reject");
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/proposals/${proposalId}/status`,
        { status: "REJECTED", adminRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Proposal rejected!");
      setSelectedProposal(null);
      setAdminRemarks("");
      fetchProposals();
    } catch (error) {
      console.error("Error rejecting proposal:", error);
      alert("Failed to reject proposal");
    } finally {
      setActionLoading("");
    }
  };

  const handleRequestRevision = async (proposalId) => {
    setActionLoading(proposalId + "_revision");
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/proposals/${proposalId}/status`,
        { status: "REVISION_REQUESTED_BY_ADMIN", adminRemarks },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Revision request sent!");
      setSelectedProposal(null);
      setAdminRemarks("");
      fetchProposals();
    } catch (error) {
      console.error("Error requesting revision:", error);
      alert("Failed to request revision");
    } finally {
      setActionLoading("");
    }
  };

  const handleAssignSupervisor = async (proposalId) => {
    if (!selectedSupervisor) {
      alert("Please select a supervisor");
      return;
    }

    setActionLoading(proposalId + "_assign");
    try {
      await axios.put(
        `${process.env.REACT_APP_API_URL}/auth/proposals/${proposalId}/assign-supervisor`,
        { supervisorId: selectedSupervisor },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Supervisor assigned successfully!");
      setSelectedProposal(null);
      setSelectedSupervisor("");
      fetchProposals();
    } catch (error) {
      console.error("Error assigning supervisor:", error);
      alert("Failed to assign supervisor");
    } finally {
      setActionLoading("");
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "PENDING_ADMIN_REVIEW":
        return "badgePending";
      case "APPROVED_BY_ADMIN":
        return "badgeApproved";
      case "SUPERVISOR_ASSIGNED":
        return "badgeAssigned";
      case "SUPERVISOR_ACCEPTED":
        return "badgeAccepted";
      case "REVISION_REQUESTED_BY_ADMIN":
      case "REVISION_REQUESTED_BY_SUPERVISOR":
        return "badgeRevision";
      case "REJECTED":
        return "badgeRejected";
      default:
        return "badgeDefault";
    }
  };

  const formatStatus = (status) => {
    return status.replace(/_/g, " ");
  };

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaClipboardList /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Project Proposal Reviews</h2>
          <p className={styles.subheading}>Review, approve, and assign supervisors to submitted proposals.</p>
        </div>
      </div>

      {!loading && proposals.length > 0 && (
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
              <h4>Pending Review</h4>
              <p>{stats.pending}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
              <FaCheckCircle />
            </div>
            <div>
              <h4>Approved</h4>
              <p>{stats.approved}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
              <FaTimesCircle />
            </div>
            <div>
              <h4>Rejected</h4>
              <p>{stats.rejected}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className={styles.filterSection}>
        <label className={styles.filterLabel}>Filter by Status:</label>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">All Statuses</option>
          <option value="PENDING_ADMIN_REVIEW">Pending Review</option>
          <option value="APPROVED_BY_ADMIN">Approved</option>
          <option value="REVISION_REQUESTED_BY_ADMIN">Revision Requested</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {!loading && proposals.length > 0 && (
        <p className={styles.resultsCount}>
          Showing {displayedProposals.length} of {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
        </p>
      )}

      {loading ? (
        <Loader text="Loading proposals..." />
      ) : displayedProposals.length === 0 ? (
        <div className={styles.message}>No proposals found.</div>
      ) : (
        <div className={styles.cardGrid}>
          {displayedProposals.map((proposal) => (
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
                      <strong>Submitted:</strong>{" "}
                      {new Date(proposal.submittedAt).toLocaleDateString()}
                    </p>

                    {proposal.adminRemarks && (
                      <div className={styles.remarksBox}>
                        <strong>Admin Remarks:</strong> {proposal.adminRemarks}
                      </div>
                    )}
                    {proposal.proposalReportUrl && (
  <div className={styles.fileSection}>
    <strong>Proposal Report:</strong>

    <div className={styles.fileButtons}>
      <a
         href={resolveFileUrl(proposal.proposalReportUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.previewBtn}
      >
        👁️ Preview PDF
      </a>

      <a
        href={resolveFileUrl(proposal.proposalReportUrl)}
        download
        className={styles.downloadBtn}
      >
        ⬇️ Download PDF
      </a>
    </div>
  </div>
  )}




                    {proposal.status === "PENDING_ADMIN_REVIEW" && (
                      <div className={styles.actionSection}>
                        <textarea
                          placeholder="Admin remarks (optional)"
                          value={adminRemarks}
                          onChange={(e) => setAdminRemarks(e.target.value)}
                          className={styles.remarksTextarea}
                        />
                        <div className={styles.buttonGroup}>
                          <button
                            className={`${styles.btn} ${styles.btnApprove}`}
                            onClick={() => handleApprove(proposal._id)}
                            disabled={actionLoading === proposal._id + "_approve"}
                          >
                            {actionLoading === proposal._id + "_approve" ? "Approving..." : "✅ Approve"}
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnRevision}`}
                            onClick={() => handleRequestRevision(proposal._id)}
                            disabled={actionLoading === proposal._id + "_revision"}
                          >
                            {actionLoading === proposal._id + "_revision" ? "Sending..." : "📝 Request Revision"}
                          </button>
                          <button
                            className={`${styles.btn} ${styles.btnReject}`}
                            onClick={() => handleReject(proposal._id)}
                            disabled={actionLoading === proposal._id + "_reject"}
                          >
                            {actionLoading === proposal._id + "_reject" ? "Rejecting..." : "❌ Reject"}
                          </button>
                        </div>
                      </div>
                    )}

                    {proposal.status === "APPROVED_BY_ADMIN" && (
                      <div className={styles.actionSection}>
                        <label className={styles.supervisorLabel}>Assign Supervisor:</label>
                        <select
                          value={selectedSupervisor}
                          onChange={(e) => setSelectedSupervisor(e.target.value)}
                          className={styles.supervisorSelect}
                        >
                          <option value="">-- Select Supervisor --</option>
                          {supervisors.map((supervisor) => (
                            <option key={supervisor._id} value={supervisor._id}>
                              {supervisor.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className={`${styles.btn} ${styles.btnAssign}`}
                          onClick={() => handleAssignSupervisor(proposal._id)}
                          disabled={actionLoading === proposal._id + "_assign"}
                        >
                          {actionLoading === proposal._id + "_assign" ? "Assigning..." : "🔗 Assign Supervisor"}
                        </button>
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
  );
};

export default ProposalApprovals;
