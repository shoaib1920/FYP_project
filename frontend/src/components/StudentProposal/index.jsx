import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import DeadlineBanner from "../DeadlineBanner";
import {
  FaFileSignature,
  FaClipboardList,
  FaHourglassHalf,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

const StudentProposal = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("view");
  const [formData, setFormData] = useState({
    teamId: "",
    title: "",
    category: "",
    academicSession: "",
    abstract: "",
    objectives: "",
    technologies: "",
    preferredSupervisorId: "",
    proposalReport: null,
  });
  const [teams, setTeams] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [fetchError, setFetchError] = useState("");

  const token = localStorage.getItem("token");
  
  // Debug: Check if API URL is configured
  useEffect(() => {
    if (!process.env.REACT_APP_API_URL) {
      setFetchError("⚠️ API URL not configured. Check .env file.");
    }
    if (!token) {
      setFetchError("⚠️ No authentication token found. Please login first.");
    }
  }, [token]);

  useEffect(() => {
    fetchProposals();
    fetchTeams();
    fetchSupervisors();
  }, []);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      setFetchError("");
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/proposals/student`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProposals(response.data.proposals || []);
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Failed to fetch proposals";
      console.error("❌ Error fetching proposals:", error);
      setFetchError(`Failed to load proposals: ${errorMsg}`);
      setProposals([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const loggedInUser = JSON.parse(localStorage.getItem("user"));
      const userId = loggedInUser?.id;

      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/teams`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      let allTeams = response.data.teams || [];
      
      // Filter teams created by logged-in user
      if (userId) {
        allTeams = allTeams.filter(
          (team) => String(team.createdBy?._id || team.createdBy) === String(userId)
        );
      }
      
      setTeams(allTeams);
    } catch (error) {
      console.error("❌ Error fetching teams:", error);
      setFetchError(`Failed to load teams: ${error.message}`);
    }
  };

  const fetchSupervisors = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/supervisors`
      );
      setSupervisors(response.data.supervisors || []);
    } catch (error) {
      console.error("❌ Error fetching supervisors:", error);
      setFetchError(`Failed to load supervisors: ${error.message}`);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.includes('pdf')) {
        setSubmitError("❌ Please upload a PDF file only");
        return;
      }
      // Validate file size (max 10MB)
      if (file.size > 20 * 1024 * 1024) {
        setSubmitError("❌ File size must be less than 20MB");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        proposalReport: file,
      }));
      setSubmitError("");
    }
  };

  const handleRequestAgain = (proposal) => {
    const preferredSupervisorId = proposal.preferredSupervisorId?._id || proposal.preferredSupervisorId || "";

    setSelectedProposal(proposal);
    setFormData({
      teamId: proposal.teamId?._id || proposal.teamId || "",
      title: proposal.title || "",
      category: proposal.category || "",
      academicSession: proposal.academicSession || "",
      abstract: proposal.abstract || "",
      objectives: proposal.objectives || "",
      technologies: proposal.technologies || "",
      preferredSupervisorId,
      proposalReport: null,
    });
    setSubmitError("");
    setSubmitSuccess("");
    setActiveTab("create");
  };

  const handleSubmitProposal = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (!formData.teamId || !formData.title || !formData.abstract || !formData.objectives || !formData.technologies) {
      setSubmitError("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);
      // Use FormData for file upload
      const submitData = new FormData();
      submitData.append('teamId', formData.teamId);
      submitData.append('title', formData.title);
      submitData.append('category', formData.category);
      submitData.append('academicSession', formData.academicSession);
      submitData.append('abstract', formData.abstract);
      submitData.append('objectives', formData.objectives);
      submitData.append('technologies', formData.technologies);
      submitData.append('preferredSupervisorId', formData.preferredSupervisorId);
      if (formData.proposalReport) {
        submitData.append('proposalReport', formData.proposalReport);
      }

      const url = selectedProposal
        ? `${process.env.REACT_APP_API_URL}/auth/proposals/${selectedProposal._id}`
        : `${process.env.REACT_APP_API_URL}/auth/proposals/submit`;
      const request = selectedProposal
        ? axios.put(url, submitData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          })
        : axios.post(url, submitData, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          });

      const response = await request;

      if (response.data.success) {
        setSubmitSuccess(selectedProposal ? "Proposal resubmitted successfully!" : "Proposal submitted successfully!");
        setFormData({
          teamId: "",
          title: "",
          category: "",
          academicSession: "",
          abstract: "",
          objectives: "",
          technologies: "",
          preferredSupervisorId: "",
          proposalReport: null,
        });
        setSelectedProposal(null);
        fetchProposals();
        setTimeout(() => {
          setActiveTab("view");
          setSubmitSuccess("");
        }, 2000);
      }
    } catch (error) {
        console.log("error msgs is coming>>>>", error);
      const errorMsg = error.response?.data?.message || "Failed to submit proposal";
      setSubmitError(errorMsg);
      console.error("Error submitting proposal:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const counts = { total: proposals.length, pending: 0, inProgress: 0, needsAction: 0 };
    proposals.forEach((p) => {
      if (p.status === "PENDING_ADMIN_REVIEW") counts.pending += 1;
      if (["APPROVED_BY_ADMIN", "SUPERVISOR_ASSIGNED", "SUPERVISOR_ACCEPTED"].includes(p.status)) counts.inProgress += 1;
      if (["REVISION_REQUESTED_BY_ADMIN", "REVISION_REQUESTED_BY_SUPERVISOR"].includes(p.status)) counts.needsAction += 1;
    });
    return counts;
  }, [proposals]);

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
    <div className={styles.proposalContainer}>
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaFileSignature /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Project Proposal Management</h2>
          <p className={styles.subheading}>Submit your proposal, track its review status, and respond to revision requests.</p>
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
              <h4>In Progress</h4>
              <p>{stats.inProgress}</p>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
              <FaExclamationTriangle />
            </div>
            <div>
              <h4>Needs Action</h4>
              <p>{stats.needsAction}</p>
            </div>
          </div>
        </div>
      )}

      <DeadlineBanner type="proposal" tokenKey="token" />

      {/* Error Banner */}
      {fetchError && (
        <div className={styles.errorBanner}>
          <span>🔴</span>
          <div>
            <strong>Connection Error:</strong> {fetchError}
            <p style={{ fontSize: "0.9rem", marginTop: "5px" }}>
              Make sure your backend server is running at <code>http://localhost:8000</code>
            </p>
          </div>
          <button onClick={() => setFetchError("")} style={{ cursor: "pointer", background: "none", border: "none", color: "white", fontSize: "1.2rem" }}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tabButton} ${activeTab === "view" ? styles.active : ""}`}
          onClick={() => setActiveTab("view")}
        >
          📋 My Proposals ({proposals.length})
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === "create" ? styles.active : ""}`}
          onClick={() => {
            setActiveTab("create");
            setSelectedProposal(null);
            setSubmitError("");
            setSubmitSuccess("");
            setFormData({
              teamId: "",
              title: "",
              category: "",
              academicSession: "",
              abstract: "",
              objectives: "",
              technologies: "",
              preferredSupervisorId: "",
              proposalReport: null,
            });
          }}
        >
          ✏️ Create Proposal
        </button>
      </div>

      {/* View Proposals Tab */}
      {activeTab === "view" && (
        <div className={styles.viewTab}>
          {loading ? (
            <p className={styles.info}>Loading proposals...</p>
          ) : proposals.length === 0 ? (
            <div className={styles.alert}>
              No proposals found. 
              {/* <a href="#create">Create one now</a> */}
            </div>
          ) : (
            <div className={styles.proposalList}>
              {proposals.map((proposal) => (
                <div key={proposal._id} className={styles.proposalCard}>
                  <div className={styles.cardHeader}>
                    <h3>{proposal.title}</h3>
                    <span className={`${styles.statusBadge} ${styles[getStatusBadgeClass(proposal.status)]}`}>
                      {formatStatus(proposal.status)}
                    </span>
                  </div>

                  <div className={styles.proposalField}>
                    <strong>Category:</strong> {proposal.category || "N/A"}
                  </div>

                  <div className={styles.proposalField}>
                    <strong>Abstract:</strong> {proposal.abstract}
                  </div>

                  <div className={styles.proposalField}>
                    <strong>Objectives:</strong> {proposal.objectives}
                  </div>

                  <div className={styles.proposalField}>
                    <strong>Technologies:</strong> {proposal.technologies}
                  </div>

                  {proposal.adminRemarks && (
                    <div className={styles.remarksBox}>
                      <strong>Admin Remarks:</strong> {proposal.adminRemarks}
                    </div>
                  )}

                  {proposal.supervisorRemarks && (
                    <div className={styles.remarksBox}>
                      <strong>Supervisor Remarks:</strong> {proposal.supervisorRemarks}
                    </div>
                  )}

                  {proposal.assignedSupervisorId && (
                    <div className={styles.proposalField}>
                      <strong>Assigned Supervisor:</strong>{" "}
                      {proposal.assignedSupervisorId.name || "Unknown"}
                    </div>
                  )}

                  <div className={styles.proposalField}>
                    <strong>Submitted:</strong>{" "}
                    {new Date(proposal.submittedAt).toLocaleDateString()}
                  </div>

                  {proposal.approvedAt && (
                    <div className={styles.proposalField}>
                      <strong>Approved:</strong>{" "}
                      {new Date(proposal.approvedAt).toLocaleDateString()}
                    </div>
                  )}

                  {(proposal.status === "REVISION_REQUESTED_BY_ADMIN" || proposal.status === "REVISION_REQUESTED_BY_SUPERVISOR") && (
                    <div className={styles.cardActionRow}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => handleRequestAgain(proposal)}
                      >
                        Request Again
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Proposal Tab */}
      {activeTab === "create" && (
        <div className={styles.createTab}>
          {selectedProposal && (
            <div className={styles.alert} style={{ borderColor: "#93c5fd", backgroundColor: "#eff6ff", color: "#1d4ed8" }}>
              🔁 You are updating a revision request. Make changes below and submit again.
            </div>
          )}
          {submitError && (
            <div className={styles.alert} style={{ borderColor: "#f87171", backgroundColor: "#fee2e2", color: "#b91c1c" }}>
              ❌ {submitError}
            </div>
          )}

          {submitSuccess && (
            <div className={styles.alert} style={{ borderColor: "#86efac", backgroundColor: "#f0fdf4", color: "#166534" }}>
              ✅ {submitSuccess}
            </div>
          )}

          <form onSubmit={handleSubmitProposal} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Team *</label>
              <select
                name="teamId"
                value={formData.teamId}
                onChange={handleInputChange}
                className={styles.formSelect}
                required
              >
                <option value="">-- Select Team --</option>
                {teams.map((team) => (
                  <option key={team._id} value={team._id}>
                    {team.subject}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={styles.formInput}
                placeholder="Enter proposal title"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Category</label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={styles.formInput}
                placeholder="e.g., Web Development, Mobile App, etc."
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Academic Session</label>
              <input
                type="text"
                name="academicSession"
                value={formData.academicSession}
                onChange={handleInputChange}
                className={styles.formInput}
                placeholder="e.g., 2024-2025"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Abstract *</label>
              <textarea
                name="abstract"
                value={formData.abstract}
                onChange={handleInputChange}
                className={styles.formTextarea}
                placeholder="Brief overview of the project"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Objectives *</label>
              <textarea
                name="objectives"
                value={formData.objectives}
                onChange={handleInputChange}
                className={styles.formTextarea}
                placeholder="Project objectives and goals"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Technologies *</label>
              <textarea
                name="technologies"
                value={formData.technologies}
                onChange={handleInputChange}
                className={styles.formTextarea}
                placeholder="Technologies and tools to be used"
                required
              />
            </div>


             <div className={styles.formGroup}>
              <label className={styles.formLabel}>📄 Initial Proposal Report (PDF)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className={styles.formFile}
              />
              {formData.proposalReport && (
                <p className={styles.fileSelected}>
                  ✅ File selected: {formData.proposalReport.name}
                </p>
              )}
              <p className={styles.fileHelp}>Max file size: 10MB</p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Preferred Supervisor</label>
              <select
                name="preferredSupervisorId"
                value={formData.preferredSupervisorId}
                onChange={handleInputChange}
                className={styles.formSelect}
              >
                <option value="">-- No preference --</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor._id} value={supervisor._id}>
                    {supervisor.name}
                  </option>
                ))}
              </select>
            </div>

           

            <div className={styles.buttonRow}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={loading}
              >
                {loading ? "⏳ Submitting..." : selectedProposal ? "📤 Resubmit Proposal" : "📤 Submit Proposal"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default StudentProposal;
