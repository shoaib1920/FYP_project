// controllers/teamController.js
const Team = require("../Models/Team");
const Users = require("../Models/Users");
const Notification = require("../Models/Notification");

// Create a new team. The creator joins immediately; everyone else is invited
// and only becomes a member once they accept via respondToInvite.
exports.createTeam = async (req, res) => {
  try {
    const createdBy = req.user._id;
    const { subject, memberIds, memberNames, creatorJoinCode, department, creatorName } = req.body;

    if (!subject || !memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: "Subject and at least one invited member are required" });
    }

    const creator = await Users.findById(createdBy);
    if (!creator) {
      return res.status(404).json({ message: "Creator account not found" });
    }

    const alreadyOnTeam = await Team.findOne({ members: createdBy });
    if (alreadyOnTeam) {
      return res.status(409).json({ message: "You're already a member of another team." });
    }

    const invitees = await Users.find({ _id: { $in: memberIds } });
    if (invitees.length !== memberIds.length) {
      return res.status(400).json({ message: "Some invited users are not valid students" });
    }

    const busyTeams = await Team.find({ members: { $in: memberIds } }).select("members");
    if (busyTeams.length > 0) {
      const busyIds = new Set(busyTeams.flatMap((t) => t.members.map(String)));
      const busyNames = invitees.filter((u) => busyIds.has(String(u._id))).map((u) => u.name);
      return res.status(409).json({
        message: `These students are already on a team and can't be invited: ${busyNames.join(", ")}`,
      });
    }

    const newTeam = new Team({
      subject,
      members: [createdBy],
      memberNames: [creatorName || creator.name],
      department,
      creatorJoinCode,
      createdBy,
      creatorName: creatorName || creator.name,
      pendingInvites: invitees.map((u) => ({ student: u._id, name: u.name, invitedAt: new Date() })),
    });

    await newTeam.save();

    await Users.findByIdAndUpdate(createdBy, { designation: "TeamLeader" });

    await Notification.insertMany(
      invitees.map((u) => ({
        userId: u._id,
        title: "Team Invite",
        message: `${creatorName || creator.name} invited you to join the team "${subject}".`,
        relatedType: "TeamInvite",
        relatedId: newTeam._id,
      }))
    );

    res.status(201).json({
      success: true,
      message: "Team created — invites sent to the selected students",
      team: newTeam,
    });
  } catch (error) {
    console.error("Error creating team:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// Fetch all teams (used for browsing "other teams" in the department)
exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find().populate("members", "name email");

    res.status(200).json({ teams: teams || [] });
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Teams the logged-in user belongs to (member or creator), plus any invites
// awaiting their response. Scoped to req.user._id instead of shipping every
// team/user in the system for the client to filter.
exports.getMyTeams = async (req, res) => {
  try {
    const userId = req.user._id;

    const teams = await Team.find({ $or: [{ members: userId }, { createdBy: userId }] })
      .populate("members", "name email")
      .lean();

    const invitedTeams = await Team.find({ "pendingInvites.student": userId })
      .select("subject creatorName department pendingInvites")
      .lean();

    const invites = invitedTeams.map((t) => {
      const invite = t.pendingInvites.find((inv) => String(inv.student) === String(userId));
      return {
        teamId: t._id,
        subject: t.subject,
        creatorName: t.creatorName,
        department: t.department,
        invitedAt: invite?.invitedAt,
      };
    });

    res.status(200).json({ success: true, teams, invites });
  } catch (error) {
    console.error("Error fetching my teams:", error);
    res.status(500).json({ success: false, message: error.message || "Server Error" });
  }
};

// Accept or decline a pending team invite
exports.respondToInvite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { teamId } = req.params;
    const { action } = req.body; // "accept" | "decline"

    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "action must be 'accept' or 'decline'" });
    }

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    const invite = team.pendingInvites.find((inv) => String(inv.student) === String(userId));
    if (!invite) {
      return res.status(404).json({ message: "No pending invite found for you on this team" });
    }

    if (action === "decline") {
      team.pendingInvites = team.pendingInvites.filter((inv) => String(inv.student) !== String(userId));
      await team.save();

      await Notification.create({
        userId: team.createdBy,
        title: "Invite Declined",
        message: `${invite.name} declined your invite to "${team.subject}".`,
        relatedType: "TeamInvite",
        relatedId: team._id,
      });

      return res.status(200).json({ success: true, message: "Invite declined" });
    }

    // action === "accept" — re-check integrity in case they joined elsewhere
    // in the meantime (e.g. accepted a different invite first).
    const alreadyOnTeam = await Team.findOne({ members: userId });
    if (alreadyOnTeam) {
      team.pendingInvites = team.pendingInvites.filter((inv) => String(inv.student) !== String(userId));
      await team.save();
      return res.status(409).json({ message: "You've already joined another team." });
    }

    team.pendingInvites = team.pendingInvites.filter((inv) => String(inv.student) !== String(userId));
    team.members.push(userId);
    team.memberNames.push(invite.name);
    await team.save();

    // A student can only be on one team — withdraw their other pending invites.
    await Team.updateMany(
      { _id: { $ne: team._id }, "pendingInvites.student": userId },
      { $pull: { pendingInvites: { student: userId } } }
    );

    await Notification.create({
      userId: team.createdBy,
      title: "Invite Accepted",
      message: `${invite.name} joined your team "${team.subject}".`,
      relatedType: "TeamInvite",
      relatedId: team._id,
    });

    res.status(200).json({ success: true, message: "You've joined the team", team });
  } catch (error) {
    console.error("Error responding to invite:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};
