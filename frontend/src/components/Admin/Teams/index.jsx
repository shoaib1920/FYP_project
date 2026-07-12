import React, { useState, useEffect } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../../Loader";

const ManageTeams = () => {
  const [teamName, setTeamName] = useState("");
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamSubject, setTeamSubject] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [teamDescription, setTeamDescription] = useState("");

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const loggedInUser = JSON.parse(localStorage.getItem("adminData"));
  const userId = loggedInUser._id;
  const userName = loggedInUser.name; // Assuming you have the user's name in <localStorage></localStorage>

  // Fetch teams that the student has created

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/teams/${userId}`
      );
      setTeams(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching teams:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleCreateTeam = async () => {
    try {
      console.log("selectedUsr>>>>", selectedUsers);

      // Assuming `userId` and `userName` are available from the logged-in user data
      const payload = {
        subject: teamSubject,
        memberIds: selectedUsers.map((user) => user.id), // Only passing IDs of selected members
        memberNames: selectedUsers.map((user) => user.name), // Include names of selected members
        createdBy: userId, // Logged-in user ID
        creatorName: userName, // Logged-in user Name
      };

      // Send request to backend
      const response = await axios.post(
       `${process.env.REACT_APP_API_URL}/auth/create-team`,
        payload
      );

      if (response.data.success) {
        alert("Team created successfully!");
        setShowTeamModal(false);
        setTeamSubject("");
        setSelectedUsers([]); // Clear selected users after creating the team
      }
    } catch (error) {
      console.error("Error creating team:", error);
    }
  };

  return (
    <div className={styles.manage_teams_container}>
      <h2>Manage Your Teams</h2>

      {/* Create Team Form */}
      <div className={styles.create_team_form}>
        <input
          type="text"
          placeholder="Enter Team Name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <textarea
          placeholder="Enter Team Description"
          value={teamDescription}
          onChange={(e) => setTeamDescription(e.target.value)}
        />
        <button onClick={alert("teams managing")}>Create Team</button>
      </div>

      {/* Display Created Teams */}
      <div className={styles.teams_list}>
        {loading ? (
          <Loader text="Loading teams..." />
        ) : (
          <ul>
            {teams.length > 0 ? (
              teams.map((team, index) => (
                <li key={team._id}>
                  <h3>{team.teamName}</h3>
                  <p>{team.teamDescription}</p>
                  <button
                    onClick={() =>
                      alert(`Managing members for team ${team.teamName}`)
                    }
                  >
                    Manage Members
                  </button>
                </li>
              ))
            ) : (
              <p>You haven't created any teams yet.</p>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ManageTeams;
