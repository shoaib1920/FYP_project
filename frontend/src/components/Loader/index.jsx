import styles from "./styles.module.css";

const Loader = ({ text = "Loading..." }) => (
  <div className={styles.wrap}>
    <div className={styles.ring} />
    <div className={styles.dots}>
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </div>
    <p className={styles.text}>{text}</p>
  </div>
);

export default Loader;
