import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FaBuilding, FaPlus, FaEdit, FaTrash, FaCopy, FaCheck, FaSyncAlt,
  FaUsers, FaUserTie, FaLayerGroup, FaProjectDiagram, FaBarcode,
  FaCalendarAlt, FaTimes, FaExclamationCircle, FaCheckCircle,
} from "react-icons/fa";
import styles from "./styles.module.css";
import Loader from "../../Loader";

/* ── Copy-to-clipboard icon button ── */
const CopyIconBtn = ({ text }) => {
  const [done, setDone] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  };
  return (
    <button
      className={`${styles.iconBtn} ${styles.copyIconBtn} ${done ? styles.copyIconSuccess : ""}`}
      onClick={handle}
      title="Copy code"
      type="button"
    >
      {done ? <FaCheck /> : <FaCopy />}
    </button>
  );
};

const DepartmentManagement = () => {
  const [departments, setDepartments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    academicSession: "",
    description: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL;
  const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
  });

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/auth/admin/department`, authHeader());
      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error("Error fetching departments:", error);
      setMessage("Error fetching departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(t);
  }, [message]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post(`${API_URL}/auth/admin/department`, formData, authHeader());
      setMessage("Department created successfully!");
      setFormData({ name: "", code: "", academicSession: "", description: "" });
      setShowModal(false);
      fetchDepartments();
    } catch (error) {
      console.error("Error creating department:", error);
      setMessage(error.response?.data?.message || "Error creating department");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDepartment = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.put(`${API_URL}/auth/admin/department/${selectedDept._id}`, formData, authHeader());
      setMessage("Department updated successfully!");
      setFormData({ name: "", code: "", academicSession: "", description: "" });
      setSelectedDept(null);
      setShowModal(false);
      fetchDepartments();
    } catch (error) {
      console.error("Error updating department:", error);
      setMessage(error.response?.data?.message || "Error updating department");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDepartment = async (id) => {
    if (!window.confirm("Delete this department? This cannot be undone.")) return;
    try {
      setLoading(true);
      await axios.delete(`${API_URL}/auth/admin/department/${id}`, authHeader());
      setMessage("Department deleted successfully!");
      fetchDepartments();
    } catch (error) {
      console.error("Error deleting department:", error);
      setMessage("Error deleting department");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (dept) => {
    setSelectedDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      academicSession: dept.academicSession,
      description: dept.description || "",
    });
    setShowModal(true);
  };

  const handleCreateClick = () => {
    setSelectedDept(null);
    setFormData({ name: "", code: "", academicSession: "", description: "" });
    setShowModal(true);
  };

  const handleRegenerateCode = async (id, type) => {
    if (!window.confirm(`Regenerate the ${type} join code? The old code will stop working immediately.`)) return;
    try {
      setRegeneratingId(`${id}_${type}`);
      const endpoint = type === "student" ? "regenerate-student-code" : "regenerate-supervisor-code";
      await axios.post(`${API_URL}/auth/admin/department/${id}/${endpoint}`, {}, authHeader());
      setMessage(`${type === "student" ? "Student" : "Supervisor"} join code regenerated!`);
      fetchDepartments();
    } catch (error) {
      console.error("Error regenerating code:", error);
      setMessage("Error regenerating code");
    } finally {
      setRegeneratingId(null);
    }
  };

  const totals = departments.reduce(
    (acc, d) => ({
      students: acc.students + (d.totalStudents || 0),
      supervisors: acc.supervisors + (d.totalSupervisors || 0),
      teams: acc.teams + (d.totalTeams || 0),
      projects: acc.projects + (d.totalProjects || 0),
    }),
    { students: 0, supervisors: 0, teams: 0, projects: 0 }
  );

  return (
    <div className={styles.container}>

      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaBuilding /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Department Management</h1>
          <p className={styles.heroSub}>Create departments and manage join codes for students and supervisors.</p>
        </div>
        <button className={styles.createBtn} onClick={handleCreateClick} disabled={loading}>
          <FaPlus /> Create Department
        </button>
      </div>

      {/* ── Feedback ── */}
      {message && (
        <div className={`${styles.message} ${/error/i.test(message) ? styles.error : styles.success}`}>
          {/error/i.test(message) ? <FaExclamationCircle /> : <FaCheckCircle />} {message}
        </div>
      )}

      {/* ── Stats ── */}
      <div className={styles.statsRow}>
        {[
          { label: "Departments", value: departments.length, icon: <FaBuilding />,       color: styles.indigo },
          { label: "Students",    value: totals.students,    icon: <FaUsers />,           color: styles.green  },
          { label: "Supervisors", value: totals.supervisors, icon: <FaUserTie />,         color: styles.blue   },
          { label: "Teams",       value: totals.teams,       icon: <FaLayerGroup />,      color: styles.purple },
          { label: "Projects",    value: totals.projects,    icon: <FaProjectDiagram />,  color: styles.orange },
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

      {/* ── Section ── */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <FaBuilding style={{ color: "#4338ca" }} />
          All Departments
          <span className={styles.countPill}>{departments.length}</span>
        </div>
      </div>

      {loading && departments.length === 0 ? (
        <Loader text="Loading departments..." />
      ) : departments.length === 0 ? (
        <div className={styles.emptyBox}>
          <div className={styles.emptyIconWrap}><FaBuilding /></div>
          <h4>No departments yet</h4>
          <p>Create your first department to generate join codes for students and supervisors.</p>
        </div>
      ) : (
        <div className={styles.deptGrid}>
          {departments.map((dept) => (
            <div key={dept._id} className={styles.deptCard}>

              {/* Header */}
              <div className={styles.deptCardHeader}>
                <div className={styles.deptCardTitleWrap}>
                  <div className={styles.deptCardIcon}><FaBuilding /></div>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.deptCardName} title={dept.name}>{dept.name}</div>
                    <div className={styles.deptCardPills}>
                      <span className={styles.deptPill}><FaBarcode /> {dept.code}</span>
                      <span className={styles.deptPill}><FaCalendarAlt /> {dept.academicSession}</span>
                    </div>
                  </div>
                </div>
                <span className={`${styles.statusBadge} ${dept.isActive ? styles.statusActive : styles.statusInactive}`}>
                  <span className={`${styles.heroDot} ${dept.isActive ? "" : styles.heroDotRed}`} />
                  {dept.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Body */}
              <div className={styles.deptCardBody}>
                {dept.description && <p className={styles.deptDesc}>{dept.description}</p>}

                <div className={styles.miniStats}>
                  <div className={styles.miniStat}><strong>{dept.totalStudents ?? 0}</strong><span>Students</span></div>
                  <div className={styles.miniStat}><strong>{dept.totalSupervisors ?? 0}</strong><span>Supervisors</span></div>
                  <div className={styles.miniStat}><strong>{dept.totalTeams ?? 0}</strong><span>Teams</span></div>
                  <div className={styles.miniStat}><strong>{dept.totalProjects ?? 0}</strong><span>Projects</span></div>
                </div>

                {/* Student join code */}
                <div className={styles.codeSection}>
                  <div className={styles.codeLabel}>Student Join Code</div>
                  <div className={styles.codeRow}>
                    <span className={styles.codeText}>{dept.studentJoinCode}</span>
                    <CopyIconBtn text={dept.studentJoinCode} />
                    <button
                      className={`${styles.iconBtn} ${styles.regenIconBtn}`}
                      onClick={() => handleRegenerateCode(dept._id, "student")}
                      disabled={regeneratingId === `${dept._id}_student`}
                      title="Regenerate student code"
                      type="button"
                    >
                      <FaSyncAlt />
                    </button>
                  </div>
                </div>

                {/* Supervisor join code */}
                <div className={styles.codeSection}>
                  <div className={styles.codeLabel}>Supervisor Join Code</div>
                  <div className={styles.codeRow}>
                    <span className={styles.codeText}>{dept.supervisorJoinCode}</span>
                    <CopyIconBtn text={dept.supervisorJoinCode} />
                    <button
                      className={`${styles.iconBtn} ${styles.regenIconBtn}`}
                      onClick={() => handleRegenerateCode(dept._id, "supervisor")}
                      disabled={regeneratingId === `${dept._id}_supervisor`}
                      title="Regenerate supervisor code"
                      type="button"
                    >
                      <FaSyncAlt />
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={styles.deptCardFooter}>
                <button className={`${styles.actionBtn} ${styles.editBtn}`} onClick={() => handleEditClick(dept)} disabled={loading}>
                  <FaEdit /> Edit
                </button>
                <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => handleDeleteDepartment(dept._id)} disabled={loading}>
                  <FaTrash /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.closeBtn} onClick={() => setShowModal(false)}>
              <FaTimes />
            </div>
            <div className={styles.modalTitleRow}>
              <div className={styles.modalTitleIcon}>
                {selectedDept ? <FaEdit /> : <FaPlus />}
              </div>
              <h2 className={styles.modalTitle}>
                {selectedDept ? "Edit Department" : "Create Department"}
              </h2>
            </div>

            <form onSubmit={selectedDept ? handleUpdateDepartment : handleCreateDepartment}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Department Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="e.g., Computer Science"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="code">Department Code</label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  placeholder="e.g., CS"
                  value={formData.code}
                  onChange={handleInputChange}
                  maxLength="5"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="academicSession">Academic Session</label>
                <input
                  type="text"
                  id="academicSession"
                  name="academicSession"
                  placeholder="e.g., Spring 2026"
                  value={formData.academicSession}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  placeholder="Department description (optional)"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? "Processing..." : selectedDept ? "Update Department" : "Create Department"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagement;
