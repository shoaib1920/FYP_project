import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../shared/phaseSystem.module.css";
import Loader from "../../Loader";
import { exportToCSV, exportToPDF } from "../../../utils/exportUtils";
import { FaChartBar, FaPrint, FaFileExcel } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;

const COLUMNS = [
  { key: "studentId", label: "Student ID" },
  { key: "studentName", label: "Name" },
  { key: "phase", label: "Phase" },
  { key: "marksObtained", label: "Marks" },
  { key: "maxMarks", label: "Total" },
  { key: "convertedMarks", label: "Converted" },
  { key: "evaluator", label: "Evaluator" },
  { key: "status", label: "Status" },
];

const MarksReport = () => {
  const [marks, setMarks] = useState([]);
  const [phases, setPhases] = useState([]);
  const [phaseId, setPhaseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = phaseId ? { phaseId } : {};
      const [res, phasesRes] = await Promise.all([
        axios.get(`${API_URL}/auth/admin/reports/marks`, { ...authHeader(), params }),
        axios.get(`${API_URL}/auth/phases`, authHeader()),
      ]);
      setMarks(res.data.marks || []);
      setPhases(phasesRes.data.phases || []);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to load report" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [phaseId]);

  if (loading) return <div className={styles.container}><Loader text="Building report..." /></div>;

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIconWrap}><FaChartBar /></div>
        <div className={styles.heroBody}>
          <h1 className={styles.heroTitle}>Marks Report</h1>
          <p className={styles.heroSub}>Phase-wise marks across all students</p>
        </div>
      </div>

      {message && <div className={`${styles.message} ${styles.error}`}>{message.text}</div>}

      <div className={styles.filterBar}>
        <div className={styles.formGroup}>
          <label>Phase</label>
          <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
            <option value="">All Phases</option>
            {phases.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </div>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => exportToPDF("marks-report", "Marks Report", COLUMNS, marks)}>
          <FaPrint /> Print / PDF
        </button>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => exportToCSV("marks-report", COLUMNS, marks)}>
          <FaFileExcel /> Export Excel
        </button>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Marks — {marks.length} records</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>{COLUMNS.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
            <tbody>
              {marks.map((m, i) => (
                <tr key={i}>
                  {COLUMNS.map((c) => <td key={c.key}>{m[c.key] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MarksReport;
