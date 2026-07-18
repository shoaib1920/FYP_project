import React, { useEffect, useState } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import "bootstrap/dist/css/bootstrap.min.css";

const AssignProjectForm = () => {
  const [projects, setProjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [assignedProjects, setAssignedProjects] = useState([]);

  const [selectedProject, setSelectedProject] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [assigning, setAssigning] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState(null);
  const [matchedGroup, setMatchedGroup] = useState(null);

  const user = JSON.parse(localStorage.getItem("supervisorData"));
  const supervisorId = user?._id;

  useEffect(() => {
    fetchData();
    fetchAssignedProjects();
  }, []);

  const fetchData = async () => {
    try {
      const projectRes = await axios.get(`${process.env.REACT_APP_API_URL}/auth/projects`);
      const groupRes = await axios.get(`${process.env.REACT_APP_API_URL}/auth/teams`);

      setProjects(projectRes.data);
      setGroups(groupRes.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAssignedProjects = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/assigned-projects`);
      const allAssignedProjects = res.data;

      const filtered = allAssignedProjects.filter(project => {
        return project.supervisorId && project.supervisorId._id === supervisorId;
      });

      setAssignedProjects(filtered);
    } catch (error) {
      console.error("Error fetching assigned projects:", error);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setSuccessMessage("");
    setErrorMessage("");

    setAssigning(true);
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/auth/assign-project`, {
        projectId: selectedProject,
        groupId: selectedGroup,
        supervisorId,
      });

      setSuccessMessage("Project assigned successfully!");
      setSelectedProject("");
      setSelectedGroup("");
      fetchAssignedProjects();
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Error assigning project");
    } finally {
      setAssigning(false);
    }
  };

  const openModal = (item) => {
    setSelectedProjectDetails(item);
    const matched = groups.teams?.find((g) => g._id === item.groupId._id);
    setMatchedGroup(matched);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedProjectDetails(null);
    setMatchedGroup(null);
  };

  return (
    <>
      <form className={styles.formContainer} onSubmit={handleAssign}>
        <h2>Assign Project</h2>

        <label className={styles.label}>Select Project:</label>
        <select
          className={styles.select}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          required
        >
          <option value="">-- Select Project --</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.title}
            </option>
          ))}
        </select>

        <label className={styles.label}>Select Group:</label>
        <select
          className={styles.select}
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          required
        >
          <option value="">-- Select Group --</option>
          {groups.teams?.map((team) => (
            <option key={team._id} value={team._id}>
              {team.subject}
            </option>
          ))}
        </select>

        <button className={styles.button} type="submit" disabled={assigning}>
          {assigning ? "Assigning..." : "Assign Project"}
        </button>

        {successMessage && (
          <div className={styles.successMessage}>{successMessage}</div>
        )}
        {errorMessage && (
          <div className={styles.errorMessage}>{errorMessage}</div>
        )}
      </form>

      {/* Assigned Projects Section */}
      <div className={styles.projectListSection}>
        <h2 className={styles.heading}>Assigned Projects Overview</h2>
        {assignedProjects.length === 0 ? (
          <p className={styles.noProjects}>No assigned projects yet.</p>
        ) : (
          <ul className={styles.projectList}>
            {assignedProjects.map((item) => (
              <li
                className={styles.projectRow}
                key={item._id}
                onClick={() => openModal(item)}
                style={{ cursor: "pointer" }}
              >
                <div className={styles.rowLeft}>
                  <h3 className={styles.projectTitle}>
                    {item.projectId?.title}
                  </h3>
                  <p className={styles.groupName}>
                    <span>📘 Group:</span> {item.groupId?.subject}
                  </p>
                </div>
                <div className={styles.rowRight}>
                  <p className={styles.supervisorName}>
                    <span>👨‍🏫 Supervisor:</span> {item.supervisorId?.name}
                  </p>
                  <p className={styles.date}>
                    <span>📅 Date:</span>{" "}
                    {new Date(item.assignedDate).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal Section */}
      <Modal show={showModal} onHide={closeModal} centered >
        <Modal.Header closeButton>
          <Modal.Title>📋 Assigned Project Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedProjectDetails && (
            <>
              <h5>📌 Project Title:</h5>
              <p>{selectedProjectDetails.projectId?.title}</p>

              <h5>📚 Group Subject:</h5>
              <p>{selectedProjectDetails.groupId?.subject}</p>

              <h5>👨‍🏫 Assigned By:</h5>
              <p>{selectedProjectDetails.supervisorId?.name}</p>

              <h5>📅 Assigned Date:</h5>
              <p>
                {new Date(
                  selectedProjectDetails.assignedDate
                ).toLocaleDateString()}
              </p>

              <h5>👨‍👩‍👧‍👦 Group Members:</h5>
              <ul>
                {matchedGroup?.members?.length > 0 ? (
                  matchedGroup.members.map((member, idx) => (
                    <li key={idx}>
                      {member.name} ({member.email})
                    </li>
                  ))
                ) : (
                  <li>No members found</li>
                )}
              </ul>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AssignProjectForm;
