import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaClock, FaExclamationTriangle } from "react-icons/fa";
import styles from "./styles.module.css";

const LABELS = {
  proposal: "Proposal submission deadline",
  final: "Final submission deadline",
};


/**
 * Shows the active academic term's relevant deadline (proposal or final submission).
 * Renders nothing if no active term is set, or if the term has no token for this role.
 */
const DeadlineBanner = ({ type, tokenKey = "token" }) => {
  const [term, setTerm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerm = async () => {
      const token = localStorage.getItem(tokenKey);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/academic-terms/current`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTerm(res.data.term || null);
      } catch (err) {
        console.error("Failed to fetch active academic term:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTerm();
  }, [tokenKey]);

  if (loading || !term) return null;

  const deadline = type === "final" ? term.finalSubmissionDeadline : term.proposalDeadline;
  const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const passed = daysLeft < 0;
  const urgent = !passed && daysLeft <= 7;

  const formattedDate = new Date(deadline).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const tone = passed ? styles.toneRed : urgent ? styles.toneAmber : styles.toneBlue;

  return (
    <div className={`${styles.banner} ${tone}`}>
      {passed ? <FaExclamationTriangle /> : <FaClock />}
      <div>
        <strong>{LABELS[type]} — {term.name}:</strong>{" "}
        {passed
          ? `${formattedDate} (deadline has passed)`
          : `${formattedDate} (${daysLeft} day${daysLeft !== 1 ? "s" : ""} left)`}
      </div>
    </div>
  );
};

export default DeadlineBanner;
