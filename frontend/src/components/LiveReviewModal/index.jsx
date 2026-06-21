import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import {
  FaTimes,
  FaCamera,
  FaPlay,
  FaPlus,
  FaPaperPlane,
  FaTrash,
  FaExternalLinkAlt,
} from "react-icons/fa";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const normalizeUrl = (url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

const LiveReviewModal = ({ url, projectId, title, onClose, onSent }) => {
  const safeUrl = normalizeUrl(url);

  // start | browse | snipping | annotate | review | error
  const [mode, setMode] = useState("start");
  const [errorMsg, setErrorMsg] = useState("");

  const [collectedItems, setCollectedItems] = useState([]); // {id, dataUrl, canvas, pins}
  const [currentSnip, setCurrentSnip] = useState(null); // {dataUrl, pins}
  const [rawFrameDataUrl, setRawFrameDataUrl] = useState(null);
  const [selRect, setSelRect] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [sending, setSending] = useState(false);

  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const rawCanvasRef = useRef(null);
  const snipCanvasRef = useRef(null);
  const snipContainerRef = useRef(null);
  const annotateImgRef = useRef(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopStream(), []);

  const handleClose = () => {
    stopStream();
    onClose();
  };

  const handleStartReview = async () => {
    setErrorMsg("");
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMode("error");
      setErrorMsg("Screen capture isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        preferCurrentTab: true,
      });
      streamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      videoRef.current = video;

      setMode("browse");
    } catch (err) {
      console.error("Screen capture failed:", err);
      setMode("error");
      setErrorMsg(
        err.name === "NotAllowedError"
          ? "Screen-share permission was cancelled. Click below to try again."
          : "Couldn't start screen capture. Please try again."
      );
    }
  };

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    rawCanvasRef.current = canvas;
    setRawFrameDataUrl(canvas.toDataURL("image/png"));
    setSelRect(null);
    setMode("snipping");
  };

  const handleCancelSnip = () => {
    setRawFrameDataUrl(null);
    setSelRect(null);
    setMode("browse");
  };

  const handleSnipMouseDown = (e) => {
    const rect = snipContainerRef.current.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragStart(point);
    setSelRect({ x: point.x, y: point.y, w: 0, h: 0 });
  };

  const handleSnipMouseMove = (e) => {
    if (!dragStart) return;
    const rect = snipContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSelRect({
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      w: Math.abs(x - dragStart.x),
      h: Math.abs(y - dragStart.y),
    });
  };

  const cropToSnip = (displayRect) => {
    const containerRect = snipContainerRef.current.getBoundingClientRect();
    const rawCanvas = rawCanvasRef.current;
    const scaleX = rawCanvas.width / containerRect.width;
    const scaleY = rawCanvas.height / containerRect.height;

    const cropX = displayRect.x * scaleX;
    const cropY = displayRect.y * scaleY;
    const cropW = displayRect.w * scaleX;
    const cropH = displayRect.h * scaleY;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    cropCanvas.getContext("2d").drawImage(rawCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    snipCanvasRef.current = cropCanvas;
    setCurrentSnip({ dataUrl: cropCanvas.toDataURL("image/png"), pins: [] });
    setRawFrameDataUrl(null);
    setSelRect(null);
    setMode("annotate");
  };

  const handleSnipMouseUp = () => {
    if (!dragStart || !selRect || selRect.w < 8 || selRect.h < 8) {
      setDragStart(null);
      return;
    }
    cropToSnip(selRect);
    setDragStart(null);
  };

  const handleUseEntireFrame = () => {
    const rawCanvas = rawCanvasRef.current;
    snipCanvasRef.current = rawCanvas;
    setCurrentSnip({ dataUrl: rawCanvas.toDataURL("image/png"), pins: [] });
    setRawFrameDataUrl(null);
    setMode("annotate");
  };

  const handleSnipImageClick = (e) => {
    const rect = annotateImgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentSnip((prev) => ({ ...prev, pins: [...prev.pins, { x, y, text: "" }] }));
  };

  const updateCurrentPinText = (index, text) => {
    setCurrentSnip((prev) => ({
      ...prev,
      pins: prev.pins.map((p, i) => (i === index ? { ...p, text } : p)),
    }));
  };

  const removeCurrentPin = (index) => {
    setCurrentSnip((prev) => ({ ...prev, pins: prev.pins.filter((_, i) => i !== index) }));
  };

  const handleDiscardSnip = () => {
    setCurrentSnip(null);
    setMode("browse");
  };

  const handleAddToCollection = () => {
    if (currentSnip.pins.length === 0) {
      alert("Add at least one pin marking the issue before adding this to the collection.");
      return;
    }
    if (currentSnip.pins.some((p) => !p.text.trim())) {
      alert("Every pin needs a short comment — remove empty ones or fill them in.");
      return;
    }
    setCollectedItems((prev) => [
      ...prev,
      { id: Date.now(), dataUrl: currentSnip.dataUrl, canvas: snipCanvasRef.current, pins: currentSnip.pins },
    ]);
    setCurrentSnip(null);
    setMode("browse");
  };

  const removeCollectedItem = (id) => {
    setCollectedItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSendAll = async () => {
    if (collectedItems.length === 0) {
      alert("Collect at least one screenshot before sending.");
      return;
    }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("remarks", remarks.trim());

      const annotationsPerItem = [];
      for (const item of collectedItems) {
        const blob = await new Promise((resolve) => item.canvas.toBlob(resolve, "image/png"));
        formData.append("screenshots", blob, `issue-${item.id}.png`);
        annotationsPerItem.push(item.pins);
      }
      formData.append("annotations", JSON.stringify(annotationsPerItem));

      const token = localStorage.getItem("token");
      await axios.post(`${API}/auth/review-notes`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });

      stopStream();
      onSent && onSent();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send review.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.headerTitle}>{title || "Review Live Project"}</h3>
          <button className={styles.iconBtn} onClick={handleClose} title="Close">
            <FaTimes />
          </button>
        </div>

        {mode === "start" && (
          <div className={styles.centerState}>
            <p>
              Click below to start reviewing. Your browser will briefly confirm you're sharing
              this tab — after that you can browse the live project freely and capture as many
              issues as you find.
            </p>
            <button className={styles.primaryBtn} onClick={handleStartReview}>
              <FaPlay /> Start Reviewing
            </button>
          </div>
        )}

        {mode === "error" && (
          <div className={styles.centerState}>
            <p className={styles.errorText}>{errorMsg}</p>
            <button className={styles.primaryBtn} onClick={handleStartReview}>
              <FaPlay /> Try Again
            </button>
          </div>
        )}

        {mode === "browse" && (
          <>
            <div className={styles.frameWrap}>
              <iframe
                src={safeUrl}
                title="Live preview"
                className={styles.frame}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
            <div className={styles.footer}>
              <p className={styles.helpText}>
                {collectedItems.length === 0
                  ? "Browse the project above, then capture a screenshot whenever you spot an issue."
                  : `${collectedItems.length} issue${collectedItems.length !== 1 ? "s" : ""} collected so far — keep browsing or finish up.`}
              </p>
              <div className={styles.footerActions}>
                <a href={safeUrl} target="_blank" rel="noopener noreferrer" className={styles.secondaryBtn}>
                  <FaExternalLinkAlt /> Open in new tab
                </a>
                <button className={styles.primaryBtn} onClick={handleCaptureFrame}>
                  <FaCamera /> Capture Issue
                </button>
                {collectedItems.length > 0 && (
                  <button className={styles.finishBtn} onClick={() => setMode("review")}>
                    <FaPaperPlane /> Finish ({collectedItems.length})
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {mode === "snipping" && (
          <>
            <div className={styles.snipStage}>
              <div
                className={styles.snipContainer}
                ref={snipContainerRef}
                style={{
                  backgroundImage: `url(${rawFrameDataUrl})`,
                  aspectRatio: rawCanvasRef.current
                    ? `${rawCanvasRef.current.width} / ${rawCanvasRef.current.height}`
                    : "16 / 9",
                }}
                onMouseDown={handleSnipMouseDown}
                onMouseMove={handleSnipMouseMove}
                onMouseUp={handleSnipMouseUp}
              >
                {selRect && (
                  <div
                    className={styles.selRect}
                    style={{ left: selRect.x, top: selRect.y, width: selRect.w, height: selRect.h }}
                  />
                )}
              </div>
            </div>
            <div className={styles.footer}>
              <p className={styles.helpText}>Drag to select the area with the issue, or use the whole frame.</p>
              <div className={styles.footerActions}>
                <button className={styles.secondaryBtn} onClick={handleCancelSnip}>
                  Cancel
                </button>
                <button className={styles.secondaryBtn} onClick={handleUseEntireFrame}>
                  Use Entire Frame
                </button>
              </div>
            </div>
          </>
        )}

        {mode === "annotate" && currentSnip && (
          <div className={styles.annotateLayout}>
            <div className={styles.imageCol}>
              <div
                className={styles.imageWrap}
                ref={annotateImgRef}
                onClick={handleSnipImageClick}
                style={{
                  backgroundImage: `url(${currentSnip.dataUrl})`,
                  aspectRatio: snipCanvasRef.current
                    ? `${snipCanvasRef.current.width} / ${snipCanvasRef.current.height}`
                    : "16 / 9",
                }}
              >
                {currentSnip.pins.map((pin, i) => (
                  <div
                    key={i}
                    className={styles.pin}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <p className={styles.helpText}>Click anywhere on the screenshot to drop a numbered pin.</p>
            </div>

            <div className={styles.sidebar}>
              <button className={styles.retakeBtn} onClick={handleDiscardSnip}>
                <FaTimes /> Discard This Snip
              </button>

              <div className={styles.pinsList}>
                {currentSnip.pins.length === 0 ? (
                  <p className={styles.helpText}>No pins yet — click the screenshot to add one.</p>
                ) : (
                  currentSnip.pins.map((pin, i) => (
                    <div key={i} className={styles.pinRow}>
                      <span className={styles.pinNumber}>{i + 1}</span>
                      <textarea
                        value={pin.text}
                        onChange={(e) => updateCurrentPinText(i, e.target.value)}
                        placeholder="What's wrong here?"
                        className={styles.pinInput}
                      />
                      <button className={styles.pinRemoveBtn} onClick={() => removeCurrentPin(i)} title="Remove pin">
                        <FaTrash />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button className={styles.primaryBtn} onClick={handleAddToCollection}>
                <FaPlus /> Add to Collection
              </button>
            </div>
          </div>
        )}

        {mode === "review" && (
          <div className={styles.reviewStage}>
            <div className={styles.reviewList}>
              {collectedItems.map((item, idx) => (
                <div key={item.id} className={styles.reviewItem}>
                  <img src={item.dataUrl} alt={`Issue ${idx + 1}`} className={styles.reviewThumb} />
                  <div className={styles.reviewItemBody}>
                    <strong>Screenshot {idx + 1}</strong>
                    <ul className={styles.reviewItemList}>
                      {item.pins.map((p, i) => (
                        <li key={i}>{i + 1}. {p.text}</li>
                      ))}
                    </ul>
                  </div>
                  <button className={styles.pinRemoveBtn} onClick={() => removeCollectedItem(item.id)} title="Remove this screenshot">
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>

            <label className={styles.noteLabel}>Overall revision remarks (optional)</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Summarize what the team needs to fix..."
              className={styles.noteInput}
            />

            <div className={styles.footerActions}>
              <button className={styles.secondaryBtn} onClick={() => setMode("browse")}>
                Back, Keep Browsing
              </button>
              <button className={styles.primaryBtn} onClick={handleSendAll} disabled={sending}>
                <FaPaperPlane /> {sending ? "Sending..." : "Send All to Team"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveReviewModal;
