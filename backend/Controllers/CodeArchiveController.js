const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const Project = require("../Models/Project");

const ARCHIVE_ROOT = path.join("uploads", "code-archives");
const CLONE_TIMEOUT_MS = 2 * 60 * 1000; // a hung/oversized remote shouldn't tie up the request forever

// Only plain http(s) URLs are ever handed to git — deliberately excludes
// git's own "ext::" and "file://" transports (arbitrary local command/file
// access) and ssh:// (would touch the server's own SSH config/keys), since
// this URL is student-supplied, untrusted input.
const isSafeRepoUrl = (value) => {
  try {
    const u = new URL(value);
    return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
  } catch {
    return false;
  }
};

const runGit = (args, options = {}) =>
  new Promise((resolve, reject) => {
    execFile("git", args, { timeout: CLONE_TIMEOUT_MS, ...options }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString().trim() || err.message));
      resolve(stdout?.toString().trim() || "");
    });
  });

const rmDir = (dir) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.error("Failed to clean up archive directory:", dir, err.message);
  }
};

// POST /projects/:projectId/archive-code  (Admin)
// Best-effort, on-demand: mirrors the team's GitHub repo (full commit
// history, not just a snapshot) into local server storage so the code
// survives independently of the student's own GitHub account. Never throws
// past this handler — a failed clone (private/unreachable repo) is a normal,
// expected outcome that unlocks the student-side ZIP-upload fallback, not a
// server error.
exports.archiveProjectCode = async (req, res) => {
  const { projectId } = req.params;
  const targetDir = path.join(ARCHIVE_ROOT, String(projectId), "repo.git");

  try {
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const repoUrl = (project.githubRepository || "").trim();
    if (!repoUrl) {
      return res.status(400).json({ message: "This project has no GitHub repository link to archive." });
    }
    if (!isSafeRepoUrl(repoUrl)) {
      return res.status(400).json({ message: "The saved repository link isn't a valid http(s) URL — ask the team to correct it before archiving." });
    }

    rmDir(targetDir); // clear out any previous partial/failed attempt first
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });

    try {
      // "--" stops option parsing so the URL can never be read as a git flag,
      // regardless of what it starts with — the second layer of defense
      // alongside the protocol whitelist above.
      await runGit(["clone", "--mirror", "--", repoUrl, targetDir]);

      const commitCountRaw = await runGit(["--git-dir", targetDir, "rev-list", "--all", "--count"]);
      const headSha = await runGit(["--git-dir", targetDir, "rev-parse", "HEAD"]).catch(() => null);

      project.codeArchive = {
        method: "GIT_CLONE",
        status: "ARCHIVED",
        archivedAt: new Date(),
        commitCount: Number(commitCountRaw) || 0,
        checksum: headSha,
        filePath: targetDir.replace(/\\/g, "/"),
        failureReason: "",
      };
      await project.save();

      return res.json({ success: true, codeArchive: project.codeArchive });
    } catch (cloneErr) {
      rmDir(targetDir);
      const reason = /timed out|ETIMEDOUT/i.test(cloneErr.message)
        ? "The clone timed out — the repository may be very large or unreachable."
        : /could not read username|authentication|permission denied|not found/i.test(cloneErr.message)
        ? "The repository appears to be private or no longer accessible."
        : "Could not clone the repository.";

      project.codeArchive = {
        method: "GIT_CLONE",
        status: "FAILED",
        archivedAt: new Date(),
        commitCount: null,
        checksum: null,
        filePath: "",
        failureReason: reason,
      };
      await project.save();

      return res.status(200).json({
        success: false,
        message: `${reason} The team can upload a ZIP of their source code as a fallback.`,
        codeArchive: project.codeArchive,
      });
    }
  } catch (err) {
    console.error("archiveProjectCode error:", err);
    res.status(500).json({ message: "Server error while archiving project code" });
  }
};

// PUT /projects/:projectId/upload-code-zip  (Student — team leader)
// The fallback path: only reachable once an admin's clone attempt has
// actually failed, so this stays a genuine fallback rather than a parallel
// always-available option.
exports.uploadCodeZip = async (req, res) => {
  const { projectId } = req.params;
  try {
    const userId = req.user._id;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (String(project.teamLeaderId) !== String(userId)) {
      return res.status(403).json({ message: "Only the team leader can upload the source code archive" });
    }
    if (project.codeArchive?.status !== "FAILED") {
      return res.status(400).json({ message: "A ZIP upload is only needed if the automatic archive attempt failed." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No ZIP file uploaded" });
    }

    const checksum = crypto.createHash("sha256").update(fs.readFileSync(req.file.path)).digest("hex");

    project.codeArchive = {
      method: "ZIP_UPLOAD",
      status: "ARCHIVED",
      archivedAt: new Date(),
      commitCount: null,
      checksum,
      filePath: req.file.path.replace(/\\/g, "/"),
      failureReason: "",
    };
    await project.save();

    res.json({ success: true, codeArchive: project.codeArchive });
  } catch (err) {
    console.error("uploadCodeZip error:", err);
    res.status(500).json({ message: "Server error while uploading source code archive" });
  }
};
