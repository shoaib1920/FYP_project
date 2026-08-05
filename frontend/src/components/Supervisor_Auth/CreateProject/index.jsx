import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";
import { showToast } from "../../../utils/toastStore";

const CreateProject = () => {
  const [projects, setProjects] = useState([]);
  const [project, setProject] = useState({
    title: "",
    description: "",
    deadline: "",
  });
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const storedSupervisor = localStorage.getItem("supervisorData");
  const parsedSupervisor = JSON.parse(storedSupervisor);
  const supervisorId = parsedSupervisor._id;
  const supervisorName =  parsedSupervisor.name;


  // Fetch projects from backend
 const fetchProjects = async () => {
  try {
    setLoading(true);

    const supData = localStorage.getItem("supervisorData");
    if (!supData) return showToast("Supervisor not logged in", "error");

    const supervisor = JSON.parse(supData);
    const supervisorId = supervisor._id;

    // 1. Fetch all projects
    const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/projects`);
    const allProjects = response.data;

    // 2. Filter only projects created by the logged-in supervisor
    const supervisorProjects = allProjects.filter((project) => {
      // Handles both raw ID and populated object
      const projectSupervisorId =
        typeof project.supervisorId === "object"
          ? project.supervisorId._id
          : project.supervisorId;

      return projectSupervisorId === supervisorId;
    });

    // 3. Set filtered projects in state
    setProjects(supervisorProjects);
    setLoading(false);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    setLoading(false);
  }
};


useEffect(() => {
  fetchProjects();
}, []);

  const handleChange = (e) => {
    setProject({ ...project, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {


                //   const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/create-project`, project);
                  const response = await axios.post(`${process.env.REACT_APP_API_URL}/auth/create-project`, {
                    title: project.title,
                    description: project.description,
                    deadline: project.deadline,
                    supervisorId,
                    supervisorName,
                  });
      console.log("Project Created:", response.data);
      setProject({ title: "", description: "", deadline: "" });
      setShowModal(false);
      fetchProjects(); // Refresh list
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Projects</h2>
        <button className={styles.createButton} onClick={() => setShowModal(true)}>
          + New Project
        </button>
      </div>

    {/* Projects Table */}
<div className={styles.tableWrapper}>
  {loading ? (
    <Loader text="Loading projects..." />
  ) : (
    <div className={styles.tableContainer}>
      <table className={styles.styledTable}>
        <thead>
          <tr>
            <th>#</th>
            <th>📌 Title</th>
            <th>📝 Description</th>
            <th>📅 Deadline</th>
            <th>👨‍🏫 Supervisor</th>
            <th>⏰ Created At</th>
          </tr>
        </thead>
        <tbody>
          {projects.length > 0 ? (
            projects.map((proj, index) => (
              <tr key={proj._id}>
                <td>{index + 1}</td>
                <td>{proj.title}</td>
                <td>{proj.description}</td>
                <td>{new Date(proj.deadline).toLocaleDateString()}</td>
                <td>{proj.supervisorName || "N/A"}</td>
                <td>{new Date(proj.createdAt).toLocaleDateString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className={styles.noData}>
                No projects found 🚀
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )}
</div>


      {/* Modal for Create Project */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalHeading}>Create New Project</h3>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <input
                  type="text"
                  name="title"
                  value={project.title}
                  onChange={handleChange}
                  required
                  className={styles.input}
                  placeholder="Project Title"
                />
              </div>

              <div className={styles.formGroup}>
                <textarea
                  name="description"
                  value={project.description}
                  onChange={handleChange}
                  required
                  className={styles.input}
                  placeholder="Project Description"
                  rows="3"
                ></textarea>
              </div>

              <div className={styles.formGroup}>
                <input
                  type="date"
                  name="deadline"
                  value={project.deadline}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton} disabled={creating}>
                  {creating ? "🚀 Creating..." : "🚀 Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateProject;
