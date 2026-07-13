import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import {
  FaCheckCircle,
  FaHourglassHalf,
  FaSearch,
  FaTimesCircle,
  FaChartPie,
  FaClipboardList,
  FaUsers,
  FaRedo,
  FaEye,
  FaCheck,
  FaTimes,
  FaPaperPlane,
} from "react-icons/fa";
import { resolveFileUrl } from "../../utils/resolveFileUrl";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

const STATUS_CLASS = {
  Completed: styles.statusCompleted,
  Approved: styles.statusApproved,
  Rejected: styles.statusRejected,
  Pending: styles.statusPending,
};

const STATUS_ICON = {
  Completed: <FaCheckCircle />,
  Approved: <FaCheckCircle />,
  Rejected: <FaTimesCircle />,
  Pending: <FaHourglassHalf />,
};

const ROLE_CLASS = {
  Developer: styles.roleDeveloper,
  Moderator: styles.roleModerator,
  Admin: styles.roleAdmin,
  Tester: styles.roleTester,
  Designer: styles.roleDesigner,
};

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [otherTasks, setOtherTasks] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const loggedInUser = JSON.parse(localStorage.getItem("user"));
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submissionNote, setSubmissionNote] = useState("");
  const [submissionFile, setSubmissionFile] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const handleSubmitProject = (task) => {
    setSelectedTask(task);
    setSubmissionNote("");
    setSubmissionFile(null);
    setSubmitError("");
    setIsModalOpen(true);
  };

  const submitProject = async () => {
    if (!submissionNote.trim()) {
      setSubmitError("Please describe the work you completed before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("taskId", selectedTask._id);
      formData.append("userId", loggedInUser.id);
      formData.append("note", submissionNote.trim());
      if (submissionFile) {
        formData.append("submissionFile", submissionFile);
      }

      await axios.post(`${process.env.REACT_APP_API_URL}/auth/submit-project`, formData);

      fetchTasks();
      setIsModalOpen(false);
      setSubmissionNote("");
      setSubmissionFile(null);
      setSubmitError("");
    } catch (error) {
      console.error("Submission failed:", error);
      setSubmitError(error.response?.data?.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  if (!loggedInUser || !loggedInUser.id) {
    alert("User not found. Please log in again!");
    return null;
  }

  const userId = loggedInUser.id;

  const fetchTasks = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/Myassigned-tasks?userId=${userId}`
      );
      const otherTasksRes = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/Otherassigned-tasks?userId=${userId}`
      );
      setOtherTasks(otherTasksRes.data);
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const handleRejectProject = async (task, note = "") => {
    setReviewing(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/reject-task/${task._id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: task.user_id, note }),
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchTasks();
        setShowModal(false);
      } else {
        alert(data.message || "❌ Rejection failed");
      }
    } catch (error) {
      console.error("Error rejecting task:", error);
    } finally {
      setReviewing(false);
    }
  };

  const handleApprovProject = async (task, note = "") => {
    setReviewing(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/auth/approve-task/${task._id}`,
        {
          method: "post",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: task.user_id, note }),
        }
      );

      const data = await response.json();
      if (data.success) {
        fetchTasks();
        setShowModal(false);
      } else {
        alert(data.message || "❌ Approval failed");
      }
    } catch (error) {
      console.error("Error approving task:", error);
    } finally {
      setReviewing(false);
    }
  };

  const handleinspect = (task, review = false) => {
    setSelectedTask(task);
    setReviewMode(review);
    setReviewNote("");
    setShowModal(true);
  };

  const filteredTasks = tasks
    .filter((task) => (filter === "All" ? true : task.status === filter))
    .filter((task) =>
      `${task.projectTitle || task.project} ${task.user} ${task.role}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  const filteredOtherTasks = otherTasks
    .filter(
      (task) =>
        (filter === "All" ? true : task.status === filter) &&
        task.assignedBy === userId
    )
    .filter((task) =>
      `${task.projectTitle || task.project} ${task.user} ${task.role}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  const Mystatuses = [...new Set(filteredTasks.map((task) => task.status))];
  const Otherstatuses = [...new Set(filteredOtherTasks.map((task) => task.status))];

  const MystatusCounts = Mystatuses.map(
    (status) => filteredTasks.filter((task) => task.status === status).length
  );
  const OtherstatusCounts = Otherstatuses.map(
    (status) => filteredOtherTasks.filter((task) => task.status === status).length
  );

  const MypieData = {
    labels: Mystatuses,
    datasets: [{ data: MystatusCounts, backgroundColor: ["#2563eb", "#f59e0b", "#16a34a", "#dc2626"] }],
  };

  const OtherpieData = {
    labels: Otherstatuses,
    datasets: [{ data: OtherstatusCounts, backgroundColor: ["#2563eb", "#f59e0b", "#16a34a", "#dc2626"] }],
  };

  const pieOptions = { responsive: true, maintainAspectRatio: false };

  const totalCount = tasks.length;
  const pendingCount = tasks.filter((t) => t.status === "Pending").length;
  const doneCount = tasks.filter((t) => t.status === "Completed" || t.status === "Approved").length;
  const rejectedCount = tasks.filter((t) => t.status === "Rejected").length;

  return (
    <div className={styles.container}>
      {showModal && selectedTask && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            {/* Modal header */}
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderIcon}>
                {reviewMode ? <FaCheck /> : <FaEye />}
              </div>
              <div>
                <h2 className={styles.modalTitle}>
                  {reviewMode ? "Review Submission" : "Task Details"}
                </h2>
                <p className={styles.modalSubtitle}>
                  {selectedTask.projectTitle || selectedTask.project || "Unknown Project"}
                </p>
              </div>
              <button className={styles.modalCloseX} onClick={() => setShowModal(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              {/* Status + role badges */}
              <div className={styles.modalBadgeRow}>
                <span className={`${styles.statusBadge} ${STATUS_CLASS[selectedTask.status] || ""}`}>
                  {STATUS_ICON[selectedTask.status]} {selectedTask.status}
                </span>
                <span className={`${styles.roleBadge} ${ROLE_CLASS[selectedTask.role] || ""}`}>
                  {selectedTask.role}
                </span>
              </div>

              {/* Info grid */}
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Assigned To</span>
                  <span className={styles.infoValue}>{selectedTask.user || "N/A"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Task Code</span>
                  <span className={styles.infoValue}>{selectedTask.taskCode || "N/A"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Priority</span>
                  <span className={styles.infoValue}>{selectedTask.priority || "N/A"}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Start Date</span>
                  <span className={styles.infoValue}>
                    {selectedTask.startDate ? new Date(selectedTask.startDate).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Due Date</span>
                  <span className={styles.infoValue}>
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                {selectedTask.submittedAt && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Submitted At</span>
                    <span className={styles.infoValue}>
                      {new Date(selectedTask.submittedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div className={styles.descSection}>
                  <span className={styles.infoLabel}>Description</span>
                  <p className={styles.descText}>{selectedTask.description}</p>
                </div>
              )}

              {/* Task file */}
              {selectedTask.taskFile && (
                <a
                  className={styles.fileBtn}
                  href={resolveFileUrl(selectedTask.taskFile)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  📎 Download Task File
                </a>
              )}

              {/* Submission section */}
              {(selectedTask.submissionNote || selectedTask.submissionFile) && (
                <div className={styles.submissionCard}>
                  <div className={styles.submissionCardHeader}>Submission</div>
                  {selectedTask.submissionNote && (
                    <p className={styles.submissionNote}>{selectedTask.submissionNote}</p>
                  )}
                  {selectedTask.submissionFile && (
                    <a
                      className={styles.fileBtn}
                      href={resolveFileUrl(selectedTask.submissionFile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      📥 Download Submitted File
                    </a>
                  )}
                </div>
              )}

              {/* Rejection note */}
              {selectedTask.status === "Rejected" && selectedTask.reviewNote && (
                <div className={styles.rejectionCard}>
                  <span className={styles.rejectionLabel}>Rejection Reason</span>
                  <p className={styles.rejectionText}>{selectedTask.reviewNote}</p>
                </div>
              )}

              {/* Review input (leader only, review mode) */}
              {reviewMode && (
                <div style={{ marginTop: "16px" }}>
                  <label className={styles.reviewNoteLabel}>Feedback to student (optional)</label>
                  <textarea
                    placeholder="Add a comment, e.g. reason for rejection or approval note..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className={styles.submitNoteInput}
                  />
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              {reviewMode ? (
                <>
                  <button
                    className={styles.approveBtn}
                    disabled={reviewing}
                    onClick={() => handleApprovProject(selectedTask, reviewNote.trim())}
                  >
                    <FaCheck /> {reviewing ? "Approving..." : "Approve"}
                  </button>
                  <button
                    className={styles.rejectBtn}
                    disabled={reviewing}
                    onClick={() => handleRejectProject(selectedTask, reviewNote.trim())}
                  >
                    <FaTimes /> {reviewing ? "Rejecting..." : "Reject"}
                  </button>
                  <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className={styles.closeBtn} onClick={() => setShowModal(false)}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.submitModalOverlay}>
          <div className={styles.submitModal}>
            <h3 className={styles.submitModalTitle}>
              🚀 Submit: {selectedTask?.projectTitle || selectedTask?.project}
            </h3>

            <label className={styles.reviewNoteLabel}>Submission note (required)</label>
            <textarea
              placeholder="Describe the work you completed..."
              value={submissionNote}
              onChange={(e) => {
                setSubmissionNote(e.target.value);
                if (submitError) setSubmitError("");
              }}
              className={styles.submitNoteInput}
            />

            <label className={styles.reviewNoteLabel}>Attach deliverable file (optional)</label>
            <input
              type="file"
              onChange={(e) => setSubmissionFile(e.target.files[0] || null)}
              className={styles.fileInput}
            />

            {submitError && <p className={styles.submitErrorMsg}>{submitError}</p>}

            <div className={styles.submitModalActions}>
              <button onClick={submitProject} className={styles.submitConfirmBtn} disabled={submitting}>
                {submitting ? "Submitting..." : "✅ Submit"}
              </button>
              <button onClick={() => setIsModalOpen(false)} className={styles.submitCancelBtn} disabled={submitting}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaChartPie /></div>
        <div className={styles.heroText}>
          <h1 className={styles.heading}>My Progress</h1>
          <p className={styles.subheading}>
            Track your assigned work, submit completed tasks, and review what you've handed out.
          </p>
        </div>
        <div className={styles.heroStats}>
          <div className={styles.statChip}><strong>{totalCount}</strong><span>Total</span></div>
          <div className={styles.statChip}><strong>{pendingCount}</strong><span>Pending</span></div>
          <div className={styles.statChip}><strong>{doneCount}</strong><span>Done</span></div>
          <div className={styles.statChip}><strong>{rejectedCount}</strong><span>Rejected</span></div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <FaSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <select
          className={styles.taskFilter}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* ── Charts ── */}
      <div className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>My Task Distribution</h4>
          <div className={styles.chartBody}>
            {filteredTasks.length > 0 ? (
              <Pie data={MypieData} options={{ ...pieOptions, cutout: "55%" }} />
            ) : (
              <div className={styles.chartEmpty}>
                <FaChartPie className={styles.chartEmptyIcon} />
                <p className={styles.chartEmptyTitle}>No data yet</p>
                <span className={styles.chartEmptyText}>Your task breakdown will appear here once tasks are assigned to you.</span>
              </div>
            )}
          </div>
        </div>
        <div className={styles.chartCard}>
          <h4 className={styles.chartTitle}>Others Task Distribution</h4>
          <div className={styles.chartBody}>
            {filteredOtherTasks.length > 0 ? (
              <Pie data={OtherpieData} options={{ ...pieOptions, cutout: "55%" }} />
            ) : (
              <div className={styles.chartEmpty}>
                <FaChartPie className={styles.chartEmptyIcon} />
                <p className={styles.chartEmptyTitle}>No data yet</p>
                <span className={styles.chartEmptyText}>Tasks you assign to team members will appear here once created.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── My Tasks ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLeft}>
          <div className={styles.sectionIconWrap}><FaClipboardList /></div>
          <div>
            <div className={styles.sectionTitle}>My Assigned Tasks</div>
            <div className={styles.sectionSubtitle}>Work assigned to you — submit when finished</div>
          </div>
        </div>
        <span className={styles.countBadge}>{filteredTasks.length}</span>
      </div>

      {filteredTasks.length === 0 ? (
        <div className={styles.emptyBox}>
          <div className={styles.emptyIconWrap}><FaClipboardList /></div>
          <h4>No tasks found</h4>
          <p>Tasks assigned to you by your team leader will show up here.</p>
        </div>
      ) : (
        <div className={styles.taskList}>
          {filteredTasks.map((task) => (
            <div key={task._id} className={styles.taskCard}>
              <div className={styles.taskMain}>
                <h3 className={styles.taskTitle}>{task.projectTitle || "Unknown Project"}</h3>
                <div className={styles.taskMetaRow}>
                  <span className={`${styles.roleBadge} ${ROLE_CLASS[task.role] || ""}`}>{task.role}</span>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[task.status] || ""}`}>
                    {STATUS_ICON[task.status]} {task.status}
                  </span>
                </div>
              </div>

              <div className={styles.taskActionsRow}>
                <button className={styles.inspectBtn} onClick={() => handleinspect(task)}>
                  <FaEye /> Inspect
                </button>

                {task.status === "Approved" && (
                  <span className={styles.donePill}><FaCheckCircle /> Approved</span>
                )}
                {task.status === "Completed" && (
                  <span className={styles.waitingPill}><FaHourglassHalf /> Awaiting Approval</span>
                )}
                {task.status === "Rejected" && (
                  <button className={styles.primaryBtn} onClick={() => handleSubmitProject(task)}>
                    <FaRedo /> Resubmit
                  </button>
                )}
                {task.status === "Pending" && (
                  <button className={styles.primaryBtn} onClick={() => handleSubmitProject(task)}>
                    <FaPaperPlane /> Submit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tasks I've Assigned ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLeft}>
          <div className={styles.sectionIconWrap}><FaUsers /></div>
          <div>
            <div className={styles.sectionTitle}>Tasks I've Assigned</div>
            <div className={styles.sectionSubtitle}>Review submissions from your team members</div>
          </div>
        </div>
        <span className={styles.countBadge}>{filteredOtherTasks.length}</span>
      </div>

      {filteredOtherTasks.length === 0 ? (
        <div className={styles.emptyBox}>
          <div className={styles.emptyIconWrap}><FaUsers /></div>
          <h4>No tasks found</h4>
          <p>Tasks you assign to your team members will show up here for review.</p>
        </div>
      ) : (
        <div className={styles.taskList}>
          {filteredOtherTasks.map((task) => (
            <div key={task._id} className={styles.taskCard}>
              <div className={styles.taskMain}>
                <h3 className={styles.taskTitle}>{task.projectTitle || "Unknown Project"}</h3>
                <div className={styles.taskMetaRow}>
                  <span className={styles.assigneeName}>👤 {task.user}</span>
                  <span className={`${styles.roleBadge} ${ROLE_CLASS[task.role] || ""}`}>{task.role}</span>
                  <span className={`${styles.statusBadge} ${STATUS_CLASS[task.status] || ""}`}>
                    {STATUS_ICON[task.status]} {task.status}
                  </span>
                </div>
              </div>

              <div className={styles.taskActionsRow}>
                {task.status === "Pending" ? (
                  <span className={styles.waitingPill}><FaHourglassHalf /> Not Submitted Yet</span>
                ) : task.status === "Completed" ? (
                  <button className={styles.primaryBtn} onClick={() => handleinspect(task, true)}>
                    <FaEye /> Review Submission
                  </button>
                ) : (
                  <button className={styles.inspectBtn} onClick={() => handleinspect(task)}>
                    <FaEye /> View Details
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyTasks;
