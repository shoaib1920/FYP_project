import React from "react";
import { useNavigate } from "react-router-dom";
import { FaGraduationCap, FaUserGraduate, FaUserTie, FaUserShield, FaArrowRight } from "react-icons/fa";
import styles from "./styles.module.css";

const ROLES = [
  {
    key: "student",
    label: "Student",
    icon: <FaUserGraduate />,
    description: "Submit proposals, track tasks, manage your team, and view your grades.",
  },
  {
    key: "supervisor",
    label: "Supervisor",
    icon: <FaUserTie />,
    description: "Review proposals, monitor projects, and grade your students' work.",
  },
  {
    key: "admin",
    label: "Admin",
    icon: <FaUserShield />,
    description: "Manage departments, supervisors, approvals, and release final grades.",
  },
];

export default function RoleSelector() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.bgShapeOne} />
      <div className={styles.bgShapeTwo} />

      <div className={styles.header}>
        <div className={styles.brandIcon}><FaGraduationCap /></div>
        <h1 className={styles.title}>FYP Management Portal</h1>
        <p className={styles.subtitle}>
          One platform for proposals, supervision, and grading — from kickoff to final defense.
        </p>
      </div>

      <div className={styles.cardGrid}>
        {ROLES.map((role) => (
          <div key={role.key} className={styles.card}>
            <div className={styles.cardIcon}>{role.icon}</div>
            <h2 className={styles.cardTitle}>{role.label}</h2>
            <p className={styles.cardDesc}>{role.description}</p>

            <div className={styles.cardActions}>
              <button
                className={styles.loginBtn}
                onClick={() => navigate(`/${role.key}/login`)}
              >
                Login <FaArrowRight />
              </button>
              <button
                className={styles.signupBtn}
                onClick={() => navigate(`/${role.key}/signup`)}
              >
                Sign Up
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className={styles.footer}>Choose your role above to get started.</p>
    </div>
  );
}
