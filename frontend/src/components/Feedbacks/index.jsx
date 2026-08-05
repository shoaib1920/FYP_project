import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { MessageSquareText, Star, Send, Quote } from 'lucide-react';
import styles from './styles.module.css';
import { showToast } from '../../utils/toastStore';

dayjs.extend(relativeTime);

const initials = (name) =>
  name ? name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2) : '?';

const StarRow = ({ value, size = 14 }) => (
  <div className={styles.starRow}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} size={size} fill={n <= value ? "#f1c40f" : "none"} color={n <= value ? "#f1c40f" : "#d1d5db"} />
    ))}
  </div>
);

const toneColor = (rating) => {
  if (rating >= 5) return "#22c55e";
  if (rating === 4) return "#3b82f6";
  if (rating === 3) return "#f59e0b";
  return "#ef4444";
};

const Feedback = () => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [reviews, setReviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0 || comment.trim() === '') {
      showToast("Missing rating or comment", "warning");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/Feedback/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "Anonymous User",
          rating,
          comment
        })
      });

      if (response.ok) {
        fetchReviews();
        setRating(0);
        setComment('');
      } else {
        console.log("Server rejected the request");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/Feedback/list`);
      const data = await response.json();
      setReviews(data);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const summary = useMemo(() => {
    const total = reviews.length;
    const avg = total ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / total : 0;
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      if (counts[r.rating] !== undefined) counts[r.rating] += 1;
    });
    return { total, avg, counts };
  }, [reviews]);

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.heroIcon}><MessageSquareText size={24} /></div>
        <div className={styles.heroText}>
          <h2 className={styles.heading}>Give Your Feedback</h2>
          <p className={styles.subheading}>Share your experience and see what others are saying.</p>
        </div>
      </div>

      {summary.total > 0 && (
        <div className={styles.summaryPanel}>
          <div className={styles.summaryScore}>
            <span className={styles.summaryNumber}>{summary.avg.toFixed(1)}</span>
            <StarRow value={Math.round(summary.avg)} size={16} />
            <span className={styles.summaryCount}>
              {summary.total} review{summary.total !== 1 ? "s" : ""}
            </span>
          </div>
          <div className={styles.summaryBreakdown}>
            {[5, 4, 3, 2, 1].map((n) => {
              const count = summary.counts[n];
              const pct = summary.total ? (count / summary.total) * 100 : 0;
              return (
                <div className={styles.breakdownRow} key={n}>
                  <span className={styles.breakdownLabel}>{n}★</span>
                  <div className={styles.breakdownTrack}>
                    <div className={styles.breakdownFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.breakdownCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.composer}>
        <h3 className={styles.composerHeading}>Share Your Experience</h3>
        <form onSubmit={handleSubmit} className={styles.composerForm}>
          <div className={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`${styles.star} ${star <= (hoveredStar || rating) ? styles.filled : ''}`}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating(star)}
              >
                ★
              </span>
            ))}
          </div>

          <div className={styles.composerInputRow}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write your feedback here..."
              className={styles.textarea}
              rows={1}
            />
            <button type="submit" className={styles.submitBtn} disabled={submitting} title="Submit feedback">
              {submitting ? "⏳" : <Send size={17} />}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.feed}>
        <h3 className={styles.subHeading}>Recent Reviews</h3>
        {reviews.length === 0 ? (
          <p className={styles.noReviews}>No reviews yet.</p>
        ) : (
          <div className={styles.feedList}>
            {reviews.map((review, index) => (
              <div key={index} className={styles.testimonial}>
                <div className={styles.testimonialAvatar}>{initials(review.name)}</div>
                <div
                  className={styles.testimonialBubble}
                  style={{ borderLeftColor: toneColor(review.rating) }}
                >
                  <Quote size={28} className={styles.testimonialQuoteIcon} />
                  <div className={styles.testimonialHeader}>
                    <span className={styles.testimonialName}>{review.name || "Anonymous User"}</span>
                    <span
                      className={styles.testimonialDate}
                      title={review.date ? dayjs(review.date).format("MMM D, YYYY [at] h:mm A") : ""}
                    >
                      {review.date ? dayjs(review.date).fromNow() : ""}
                    </span>
                  </div>
                  <StarRow value={review.rating} />
                  <p className={styles.testimonialText}>{review.comment}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feedback;
