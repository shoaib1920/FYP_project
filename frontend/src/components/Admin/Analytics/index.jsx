import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  FaChartLine,
  FaHourglassHalf,
  FaStar,
  FaFileSignature,
  FaProjectDiagram,
} from "react-icons/fa";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const STATUS_LABEL = (s) => s.replace(/_/g, " ");

const Analytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apiBase = process.env.REACT_APP_API_URL || "";
  const token = localStorage.getItem("adminToken");

  useEffect(() => {
    axios
      .get(`${apiBase}/auth/admin/analytics`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error("Error fetching analytics:", err);
        setError(err.response?.data?.message || "Failed to load analytics.");
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className={styles.container}>
        <p className={styles.emptyMsg}>Loading analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <p className={styles.emptyMsg}>{error || "No analytics available."}</p>
      </div>
    );
  }

  const funnelLabels = Object.keys(data.proposalFunnel);
  const funnelData = {
    labels: funnelLabels.map(STATUS_LABEL),
    datasets: [
      {
        label: "Proposals",
        data: funnelLabels.map((k) => data.proposalFunnel[k]),
        backgroundColor: "#3b82f6",
        borderRadius: 6,
      },
    ],
  };

  const statusLabels = Object.keys(data.projectStatusBreakdown);
  const statusData = {
    labels: statusLabels.map(STATUS_LABEL),
    datasets: [
      {
        data: statusLabels.map((k) => data.projectStatusBreakdown[k]),
        backgroundColor: ["#2563eb", "#0ea5e9", "#f59e0b", "#8b5cf6", "#22c55e", "#ef4444"],
      },
    ],
  };

  const gradeLabels = ["A", "B", "C", "D", "F"];
  const gradeData = {
    labels: gradeLabels,
    datasets: [
      {
        label: "Students",
        data: gradeLabels.map((g) => data.gradeDistribution[g] || 0),
        backgroundColor: ["#22c55e", "#3b82f6", "#f59e0b", "#fb923c", "#ef4444"],
        borderRadius: 6,
      },
    ],
  };

  const deptData = {
    labels: data.departmentPerformance.map((d) => d.name),
    datasets: [
      {
        label: "Average Marks",
        data: data.departmentPerformance.map((d) => d.averageMarks),
        backgroundColor: "#1e40af",
        borderRadius: 6,
      },
    ],
  };

  const workloadTop = data.supervisorWorkload.slice(0, 8);
  const workloadData = {
    labels: workloadTop.map((s) => s.name),
    datasets: [
      {
        label: "Assigned Projects",
        data: workloadTop.map((s) => s.count),
        backgroundColor: "#7c3aed",
        borderRadius: 6,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };

  const horizontalBarOptions = {
    ...barOptions,
    indexAxis: "y",
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIcon}><FaChartLine /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Analytics Dashboard</h2>
          <p className={styles.subheading}>System-wide insight into proposals, grading, and supervisor workload.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#dbeafe", color: "#1e40af" }}>
            <FaFileSignature />
          </div>
          <div>
            <h4>Total Proposals</h4>
            <p>{data.totals.proposals}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#e0e7ff", color: "#4338ca" }}>
            <FaProjectDiagram />
          </div>
          <div>
            <h4>Total Projects</h4>
            <p>{data.totals.projects}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#fef3c7", color: "#92400e" }}>
            <FaHourglassHalf />
          </div>
          <div>
            <h4>Avg Admin Turnaround</h4>
            <p>{data.avgTurnaroundDays != null ? `${data.avgTurnaroundDays}d` : "—"}</p>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
            <FaStar />
          </div>
          <div>
            <h4>Overall Average Marks</h4>
            <p>{data.overallAverageMarks != null ? `${data.overallAverageMarks}/100` : "—"}</p>
          </div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartPanel}>
          <h3 className={styles.panelTitle}>Proposal Funnel</h3>
          {funnelLabels.length ? <Bar data={funnelData} options={barOptions} /> : <p className={styles.emptyMsg}>No proposals yet.</p>}
        </div>

        <div className={styles.chartPanel}>
          <h3 className={styles.panelTitle}>Project Status Breakdown</h3>
          {statusLabels.length ? <Doughnut data={statusData} /> : <p className={styles.emptyMsg}>No projects yet.</p>}
        </div>

        <div className={styles.chartPanel}>
          <h3 className={styles.panelTitle}>Grade Distribution</h3>
          {data.totalGradedStudents > 0 ? <Bar data={gradeData} options={barOptions} /> : <p className={styles.emptyMsg}>No released grades yet.</p>}
        </div>

        <div className={styles.chartPanel}>
          <h3 className={styles.panelTitle}>Department Performance (Avg Marks)</h3>
          {data.departmentPerformance.length ? <Bar data={deptData} options={barOptions} /> : <p className={styles.emptyMsg}>No released grades yet.</p>}
        </div>

        <div className={`${styles.chartPanel} ${styles.chartPanelWide}`}>
          <h3 className={styles.panelTitle}>Supervisor Workload (Top 8)</h3>
          {workloadTop.length ? <Bar data={workloadData} options={horizontalBarOptions} /> : <p className={styles.emptyMsg}>No supervisors assigned yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
