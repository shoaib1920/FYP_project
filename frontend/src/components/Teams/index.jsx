/* eslint-disable */
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Loader from "../Loader";

const ManageTeams = () => {
  const [teamName, setTeamName] = useState("");
  const [teamSubject, setTeamSubject] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [teamDescription, setTeamDescription] = useState("");
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const loggedInUser = JSON.parse(localStorage.getItem("user"));
  const userId = loggedInUser.id;
  const userName = loggedInUser.name;

  const fetchTeams = useCallback(async () => {
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
  }, [userId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleCreateTeam = async () => {
    try {
      const payload = {
        subject: teamSubject,
        memberIds: selectedUsers.map((user) => user.id),
        memberNames: selectedUsers.map((user) => user.name),
        createdBy: userId,
        creatorName: userName,
      };

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/auth/create-team`,
        payload
      );

      if (response.data.success) {
        alert("Team created successfully!");
        setTeamSubject("");
        setSelectedUsers([]);
      }
    } catch (error) {
      console.error("Error creating team:", error);
    }
  };

  return (
    <div className={styles.manage_teams_container}>
      <h2>Manage Your Teams</h2>

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
        <button onClick={handleCreateTeam}>Create Team</button>
      </div>

      <div className={styles.teams_list}>
        {loading ? (
          <Loader text="Loading teams..." />
        ) : (
          <ul>
            {teams.length > 0 ? (
              teams.map((team) => (
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