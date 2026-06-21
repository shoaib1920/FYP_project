// Files are now stored on Cloudinary as absolute URLs, but older records
// (or anything still served locally) store a path relative to the API server.
// This normalizes both so callers don't need to know which one they have.
export const resolveFileUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const base = process.env.REACT_APP_API_URL || "";
  return value.startsWith("/") ? `${base}${value}` : `${base}/${value}`;
};
