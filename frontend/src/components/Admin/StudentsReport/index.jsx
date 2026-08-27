import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { exportToCSV, exportToPDF } from "../../../utils/exportUtils";
import { FaFileAlt, FaPrint, FaFileExcel } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const COLUMNS = [
  { key: "studentId", label: "Student ID" },
  { key: "name", label: "Name" },
  { key: "department", label: "Department" },
  { key: "academicSession", label: "Session" },
  { key: "groupCode", label: "Group" },
  { key: "supervisorName", label: "Supervisor" },
  { key: "status", label: "Status" },
];

const StudentsReport = () => {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = departmentId ? { departmentId } : {};
      const [res, deptRes] = await Promise.all([
        axios.get(`${API_URL}/auth/admin/reports/students`, { ...authHeader(), params }),
        axios.get(`${API_URL}/auth/admin/department`, authHeader()),
      ]);
      setStudents(res.data.students || []);
      setDepartments(deptRes.data.departments || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load report" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [departmentId]);

  if (loading) return <div className={styles.container}><Loader text="Building report..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaFileAlt /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Students Report</h1>
          <p className={styles.heroSub}>Department-wise student list with group/supervisor status</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles.error}`}>{message.text}</div>}

      <div className={styles.filterBar}>
        <div className={styles.formGroup}>
          <label>Department</label>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </div>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => exportToPDF("students-report", "Students Report", COLUMNS, students)}>
          <FaPrint /> Print / PDF
        </button>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => exportToCSV("students-report", COLUMNS, students)}>
          <FaFileExcel /> Export Excel
        </button>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Students — {students.length}</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>{COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={i}>
                  {COLUMNS.map((c) => <td key={c.key}>{s[c.key] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentsReport;
