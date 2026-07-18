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
      department: department || "",
      creatorJoinCode: creatorJoinCode || "",
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
    res.status(500).json({ message: error.message || "Server Error" });
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

// If a team is left with no accepted members besides the leader and no
// invites still pending, it never really formed — delete it so the leader
// isn't stuck (createTeam blocks anyone already listed as a member
// elsewhere). Returns true if the team was disbanded.
const disbandIfDeadOnArrival = async (team, reasonMessage) => {
  const isDeadOnArrival = team.members.length <= 1 && team.pendingInvites.length === 0;
  if (!isDeadOnArrival) return false;

  await Team.findByIdAndDelete(team._id);
  await Users.findByIdAndUpdate(team.createdBy, { designation: "Student" });

  await Notification.create({
    userId: team.createdBy,
    title: "Team Disbanded",
    message: reasonMessage,
    relatedType: "TeamInvite",
    relatedId: team._id,
  });

  return true;
};

// Leader invites additional students to an existing team (e.g. to replace
// someone who declined, or to top up after losing a member).
exports.inviteMoreMembers = async (req, res) => {
  try {
    const userId = req.user._id;
    const { teamId } = req.params;
    const { memberIds } = req.body;

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: "At least one student to invite is required" });
    }

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (String(team.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Only the team leader can invite more members" });
    }

    const invitees = await Users.find({ _id: { $in: memberIds } });
    if (invitees.length !== memberIds.length) {
      return res.status(400).json({ message: "Some invited users are not valid students" });
    }

    const alreadyInvolved = new Set([
      ...team.members.map(String),
      ...team.pendingInvites.map((inv) => String(inv.student)),
    ]);
    const duplicate = invitees.find((u) => alreadyInvolved.has(String(u._id)));
    if (duplicate) {
      return res.status(409).json({ message: `${duplicate.name} is already on this team or already invited.` });
    }

    const busyTeams = await Team.find({ members: { $in: memberIds } }).select("members");
    if (busyTeams.length > 0) {
      const busyIds = new Set(busyTeams.flatMap((t) => t.members.map(String)));
      const busyNames = invitees.filter((u) => busyIds.has(String(u._id))).map((u) => u.name);
      return res.status(409).json({
        message: `These students are already on a team and can't be invited: ${busyNames.join(", ")}`,
      });
    }

    team.pendingInvites.push(
      ...invitees.map((u) => ({ student: u._id, name: u.name, invitedAt: new Date() }))
    );
    await team.save();

    await Notification.insertMany(
      invitees.map((u) => ({
        userId: u._id,
        title: "Team Invite",
        message: `${team.creatorName} invited you to join the team "${team.subject}".`,
        relatedType: "TeamInvite",
        relatedId: team._id,
      }))
    );

    res.status(200).json({ success: true, message: "Invites sent", team });
  } catch (error) {
    console.error("Error inviting more members:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// Leader revokes a not-yet-answered invite
exports.cancelInvite = async (req, res) => {
  try {
    const userId = req.user._id;
    const { teamId, studentId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (String(team.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Only the team leader can cancel an invite" });
    }

    const invite = team.pendingInvites.find((inv) => String(inv.student) === String(studentId));
    if (!invite) {
      return res.status(404).json({ message: "No pending invite found for that student" });
    }

    team.pendingInvites = team.pendingInvites.filter((inv) => String(inv.student) !== String(studentId));

    const disbanded = await disbandIfDeadOnArrival(
      team,
      `You cancelled the invite to ${invite.name} on "${team.subject}", and no one else accepted — the team has been disbanded so you can start a new one.`
    );
    if (!disbanded) await team.save();

    res.status(200).json({ success: true, message: "Invite cancelled", teamDisbanded: disbanded });
  } catch (error) {
    console.error("Error cancelling invite:", error);
    res.status(500).json({ message: error.message || "Server Error" });
  }
};

// Leader removes an already-joined member (e.g. the member wants to switch
// teams, or the leader wants to make room for someone else).
exports.removeMember = async (req, res) => {
  try {
    const userId = req.user._id;
    const { teamId, memberId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Team not found" });

    if (String(team.createdBy) !== String(userId)) {
      return res.status(403).json({ message: "Only the team leader can remove a member" });
    }

    if (String(memberId) === String(team.createdBy)) {
      return res.status(400).json({ message: "The team leader can't be removed. Disband the team instead." });
    }

    const memberIndex = team.members.findIndex((m) => String(m) === String(memberId));
    if (memberIndex === -1) {
      return res.status(404).json({ message: "That student isn't a member of this team" });
    }

    const removedName = team.memberNames[memberIndex] || "A member";
    team.members.splice(memberIndex, 1);
    team.memberNames.splice(memberIndex, 1);

    const disbanded = await disbandIfDeadOnArrival(
      team,
      `You removed ${removedName} from "${team.subject}", leaving no other members — the team has been disbanded so you can start a new one.`
    );
    if (!disbanded) await team.save();

    await Notification.create({
      userId: memberId,
      title: "Removed From Team",
      message: `You've been removed from the team "${team.subject}" and are free to join another team.`,
      relatedType: "TeamInvite",
      relatedId: team._id,
    });

    res.status(200).json({ success: true, message: "Member removed", teamDisbanded: disbanded });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ message: error.message || "Server Error" });
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

      const disbanded = await disbandIfDeadOnArrival(
        team,
        `${invite.name} declined your invite to "${team.subject}", and no one else accepted — the team has been disbanded so you can start a new one.`
      );
      if (disbanded) {
        return res.status(200).json({ success: true, message: "Invite declined", teamDisbanded: true });
      }

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
