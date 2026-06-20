import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Star, MessageSquareText, Search, X, AlertTriangle } from "lucide-react";
import dayjs from "dayjs";
import styles from "./styles.module.css";

const initials = (name) =>
  name ? name.split(" ").filter(Boolean).map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";

const FeedbackList = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [ratingFilter, setRatingFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/auth/Feedback/list`)
      .then((res) => setFeedbacks(res.data || []))
      .catch((err) => console.error("Failed to load feedbacks", err))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const total = feedbacks.length;
    const avg = total ? feedbacks.reduce((s, f) => s + (f.rating || 0), 0) / total : 0;
    const fiveStar = feedbacks.filter((f) => f.rating === 5).length;
    const needsAttention = feedbacks.filter((f) => f.rating <= 2).length;
    return { total, avg, fiveStar, needsAttention };
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = feedbacks.filter((f) => {
      if (ratingFilter !== "ALL" && f.rating !== Number(ratingFilter)) return false;
      if (!term) return true;
      return (
        f.name?.toLowerCase().includes(term) ||
        f.comment?.toLowerCase().includes(term)
      );
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "highest") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "lowest") return (a.rating || 0) - (b.rating || 0);
      if (sortBy === "oldest") return new Date(a.date) - new Date(b.date);
      return new Date(b.date) - new Date(a.date); // newest
    });

    return list;
  }, [feedbacks, searchTerm, ratingFilter, sortBy]);

  const hasActiveFilters = searchTerm.trim() !== "" || ratingFilter !== "ALL" || sortBy !== "newest";
  const clearFilters = () => {
    setSearchTerm("");
    setRatingFilter("ALL");
    setSortBy("newest");
  };

  const noDataYet = !loading && feedbacks.length === 0;
  const noResults = !loading && !noDataYet && filteredFeedbacks.length === 0;

  return (
    <div className={styles.container}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}><MessageSquareText size={24} /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Feedback</h2>
          <p className={styles.subheading}>What students are saying about their experience.</p>
        </div>
      </div>

      {!loading && !noDataYet && (
        <>
          {/* Stats */}
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dbeafe", color: "#1e40af" }}>
                <MessageSquareText size={18} />
              </div>
              <div>
                <h4>Total Feedback</h4>
                <p>{stats.total}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#fef9c3", color: "#92400e" }}>
                <Star size={18} fill="#92400e" />
              </div>
              <div>
                <h4>Average Rating</h4>
                <p>{stats.avg.toFixed(1)}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
                <Star size={18} fill="#15803d" />
              </div>
              <div>
                <h4>5-Star Reviews</h4>
                <p>{stats.fiveStar}</p>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4>Needs Attention</h4>
                <p>{stats.needsAttention}</p>
              </div>
            </div>
          </div>

          {/* Search + filter */}
          <div className={styles.filterBar}>
            <div className={styles.searchBox}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search by name or comment..."
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
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className={styles.statusSelect}
            >
              <option value="ALL">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.statusSelect}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Rated</option>
              <option value="lowest">Lowest Rated</option>
            </select>

            {hasActiveFilters && (
              <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          <p className={styles.resultsCount}>
            Showing {filteredFeedbacks.length} of {feedbacks.length} feedback{feedbacks.length !== 1 ? "s" : ""}
          </p>
        </>
      )}

      {loading ? (
        <p className={styles.emptyMsg}>Loading feedback...</p>
      ) : noDataYet ? (
        <div className={styles.noResultsBox}>
          <div className={styles.emptyIconWrap}><MessageSquareText size={26} /></div>
          <h4>No feedback yet</h4>
          <p>Student feedback will show up here as it comes in.</p>
        </div>
      ) : noResults ? (
        <div className={styles.noResultsBox}>
          <p className={styles.emptyMsg}>No feedback matches your search/filter.</p>
          <button type="button" className={styles.clearFiltersBtn} onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredFeedbacks.map((fb, i) => (
            <div key={fb._id || i} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.nameRow}>
                  <span className={styles.avatar}>{initials(fb.name)}</span>
                  <h4 className={styles.name}>{fb.name || "Anonymous User"}</h4>
                </div>
                <span className={styles.date}>
                  {dayjs(fb.date).format("MMM D, YYYY")}
                </span>
              </div>
              <div className={styles.rating}>
                {[...Array(5)].map((_, index) => (
                  <Star
                    key={index}
                    size={16}
                    fill={index < fb.rating ? "#facc15" : "none"}
                    color={index < fb.rating ? "#facc15" : "#d1d5db"}
                  />
                ))}
              </div>
              <p className={styles.comment}>&ldquo;{fb.comment}&rdquo;</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FeedbackList;
