const Project = require('../Models/Project');
const Proposal = require('../Models/Proposal');
const Team = require('../Models/Team');
const Users = require('../Models/Users');
const Supervisor = require('../Models/supervisorModel');
const Notification = require('../Models/Notification');
const AssignedProject = require('../Models/SupervisorModels/AssignedProject');
const AcademicTerm = require('../Models/AcademicTerm');
const sendEmail = require('../utils/emailService');


const createNotification = async ({ userId, title, message, relatedType, relatedId }) => {
  try {
    await Notification.create({ userId, title, message, relatedType, relatedId });
  } catch (err) {
    console.error('Notification creation failed:', err);
  }
};

const emailTeamLeader = async (teamLeaderId, subject, bodyHtml) => {
  try {
    const leader = await Users.findById(teamLeaderId).select('email name');
    if (leader?.email) {
      await sendEmail(leader.email, subject, `<p>Hi ${leader.name || 'there'},</p>${bodyHtml}`);
    }
  } catch (err) {
    console.error('Failed to email team leader:', err);
  }
};

exports.submitProposal = async (req, res) => {
  try {
    const studentId = req.user._id;
    const {
      teamId,
      title,
      category,
      academicSession,
      abstract,
      objectives,
      technologies,
      preferredSupervisorId,
    } = req.body;

    if (!teamId || !title || !abstract || !objectives || !technologies) {
      return res.status(400).json({ message: 'Required proposal fields are missing' });
    }

    const activeTerm = await AcademicTerm.findOne({ isActive: true });
    if (activeTerm && new Date() > new Date(activeTerm.proposalDeadline)) {
      return res.status(400).json({
        message: `The proposal submission deadline for "${activeTerm.name}" (${new Date(activeTerm.proposalDeadline).toLocaleDateString()}) has passed. Contact your admin if you need an extension.`,
      });
    }
console.log("here>> after missing test");
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (String(team.createdBy) !== String(studentId)) {
      return res.status(403).json({ message: 'Only the team leader can submit a proposal' });
    }
console.log("here after tam check ");
    const requiredMembers = team.requiredMembers || 2;
    if (!team.members || team.members.length < requiredMembers) {
      return res.status(400).json({
        message: `Team is not complete. At least ${requiredMembers} members are required before submitting a proposal.`,
      });
    }

   const activeProposal = await Proposal.findOne({ teamId, status: { $in: [ 'PENDING_ADMIN_REVIEW', 'APPROVED_BY_ADMIN', 'SUPERVISOR_ASSIGNED', 'SUPERVISOR_ACCEPTED', 'REVISION_REQUESTED_BY_ADMIN', 'REVISION_REQUESTED_BY_SUPERVISOR', ], }, }); const activeProject = await Project.findOne({ teamId, status: { $ne: 'COMPLETED' }, }); if (activeProposal || activeProject) { return res.status(400).json({ message: 'A proposal or active project already exists for this team.', }); }

    const teamLeader = await Users.findById(studentId).populate('department');
    const departmentId = teamLeader?.department?._id || teamLeader?.department || null;

    let preferredSupervisor = null;
    if (preferredSupervisorId) {
      preferredSupervisor = await Supervisor.findById(preferredSupervisorId);
      if (!preferredSupervisor) {
        return res.status(400).json({ message: 'Preferred supervisor not found' });
      }
    }

    const proposalReportUrl = req.file ? req.file.path.replace(/\\/g, '/') : undefined;

    const newProposal = await Proposal.create({ teamId, teamLeaderId: studentId, departmentId, title, category, academicSession, abstract, objectives, technologies, preferredSupervisorId: preferredSupervisor ? preferredSupervisor._id : null, proposalReportUrl, status: 'PENDING_ADMIN_REVIEW', submittedAt: new Date(), });
    await createNotification({
      userId: null,
      title: 'New Project Proposal Submitted',
      message: `Proposal "${title}" was submitted by ${teamLeader.name}.`,
      relatedType: 'proposal',
      relatedId: newProposal._id,
    });

    res.status(201).json({ success: true, proposal: newProposal });
  } catch (error) {
    console.error('Error submitting proposal:', error);
    res.status(500).json({ message: 'Server error while submitting proposal' });
  }
};

exports.updateProposal = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { proposalId } = req.params;
    const {
      title,
      category,
      academicSession,
      abstract,
      objectives,
      technologies,
      preferredSupervisorId,
    } = req.body;

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    if (String(proposal.teamLeaderId) !== String(studentId)) {
      return res.status(403).json({ message: 'Only the team leader can update this proposal' });
    }

    if (!['REVISION_REQUESTED_BY_ADMIN', 'REVISION_REQUESTED_BY_SUPERVISOR', 'REJECTED'].includes(proposal.status)) {
      return res.status(400).json({ message: 'Proposal cannot be updated in its current status' });
    }

    if (preferredSupervisorId) {
      const preferredSupervisor = await Supervisor.findById(preferredSupervisorId);
      if (!preferredSupervisor) {
        return res.status(400).json({ message: 'Preferred supervisor not found' });
      }
      proposal.preferredSupervisorId = preferredSupervisor._id;
    }

    if (req.file) {
      proposal.proposalReportUrl = req.file.path.replace(/\\/g, '/');
    }

    proposal.title = title || proposal.title;
    proposal.category = category || proposal.category;
    proposal.academicSession = academicSession || proposal.academicSession;
    proposal.abstract = abstract || proposal.abstract;
    proposal.objectives = objectives || proposal.objectives;
    proposal.technologies = technologies || proposal.technologies;
    proposal.status = 'PENDING_ADMIN_REVIEW';
    proposal.adminRemarks = undefined;
    proposal.supervisorRemarks = undefined;
    proposal.approvedAt = undefined;
    proposal.supervisorAcceptedAt = undefined;
    proposal.updatedAt = new Date();

    await proposal.save();

    await createNotification({
      userId: null,
      title: 'Proposal Resubmitted',
      message: `Proposal "${proposal.title}" was resubmitted by the team leader.`,
      relatedType: 'proposal',
      relatedId: proposal._id,
    });

    res.json({ success: true, proposal });
  } catch (error) {
    console.error('Error updating proposal:', error);
    res.status(500).json({ message: 'Server error while updating proposal' });
  }
};

exports.getStudentProposals = async (req, res) => {
  try {
    const userId = req.user._id;
    const teams = await Team.find({ $or: [{ members: userId }, { createdBy: userId }] }, '_id').lean();
    const teamIds = teams.map((t) => t._id);
    const proposals = await Proposal.find({ teamId: { $in: teamIds } })
      .populate('teamId', 'subject')
      .populate('teamLeaderId', 'name email')
      .populate('assignedSupervisorId', 'name email')
      .populate('preferredSupervisorId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ proposals });
  } catch (error) {
    console.error('Error fetching student proposals:', error);
    res.status(500).json({ message: 'Server error while fetching proposals' });
  }
};

exports.getTeamProposals = async (req, res) => {
  try {
    const userId = req.user._id;
    const { teamId } = req.params;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (!team.members.some((member) => String(member) === String(userId))) {
      return res.status(403).json({ message: 'Access denied to this team' });
    }

    const proposals = await Proposal.find({ teamId }).sort({ createdAt: -1 });
    res.json({ proposals });
  } catch (error) {
    console.error('Error fetching team proposals:', error);
    res.status(500).json({ message: 'Server error while fetching team proposals' });
  }
};

exports.getAdminProposals = async (req, res) => {
  try {
    const { status, category, departmentId, academicSession } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (departmentId) filter.departmentId = departmentId;
    if (academicSession) filter.academicSession = academicSession;

    const proposals = await Proposal.find(filter)
      .populate('teamId', 'subject members')
      .populate('teamLeaderId', 'name email')
      .populate('preferredSupervisorId', 'name email')
      .populate('assignedSupervisorId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ proposals });
  } catch (error) {
    console.error('Error fetching admin proposals:', error);
    res.status(500).json({ message: 'Server error while fetching admin proposals' });
  }
};

exports.getSupervisorProposals = async (req, res) => {
  try {
    const supervisorId = req.user._id;
    const proposals = await Proposal.find({ assignedSupervisorId: supervisorId })
      .populate('teamId', 'subject')
      .populate('teamLeaderId', 'name email')
      .populate('preferredSupervisorId', 'name email')
      .sort({ createdAt: -1 });

    res.json({ proposals });
  } catch (error) {
    console.error('Error fetching supervisor proposals:', error);
    res.status(500).json({ message: 'Server error while fetching proposals' });
  }
};

exports.updateProposalStatus = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { status, adminRemarks } = req.body;
    const allowed = ['APPROVED_BY_ADMIN', 'REJECTED', 'REVISION_REQUESTED_BY_ADMIN'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid admin status transition' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    proposal.status = status;
    proposal.adminRemarks = adminRemarks || proposal.adminRemarks;
    if (status === 'APPROVED_BY_ADMIN') {
      proposal.approvedAt = new Date();
    }
    if (status === 'REJECTED') {
      proposal.assignedSupervisorId = undefined;
      proposal.supervisorRemarks = undefined;
    }

    await proposal.save();

    await createNotification({
      userId: proposal.teamLeaderId,
      title: 'Proposal Review Update',
      message: `Your proposal "${proposal.title}" status is now ${status.replace(/_/g, ' ')}.`,
      relatedType: 'proposal',
      relatedId: proposal._id,
    });

    await emailTeamLeader(
      proposal.teamLeaderId,
      'Proposal Review Update',
      `<p>Your proposal "<strong>${proposal.title}</strong>" status is now <strong>${status.replace(/_/g, ' ')}</strong>.</p>${
        adminRemarks ? `<p><strong>Admin remarks:</strong> ${adminRemarks}</p>` : ''
      }`
    );

    res.json({ success: true, proposal });
  } catch (error) {
    console.error('Error updating proposal status:', error);
    res.status(500).json({ message: 'Server error while updating proposal status' });
  }
};

exports.assignSupervisor = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const { supervisorId } = req.body;
    if (!supervisorId) {
      return res.status(400).json({ message: 'Supervisor ID is required' });
    }

    const proposal = await Proposal.findById(proposalId);
    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    if (proposal.status !== 'APPROVED_BY_ADMIN') {
      return res.status(400).json({ message: 'Supervisor can only be assigned after admin approval' });
    }

    const supervisor = await Supervisor.findById(supervisorId);
    if (!supervisor) {
      return res.status(404).json({ message: 'Supervisor not found' });
    }

    proposal.assignedSupervisorId = supervisor._id;
    proposal.status = 'SUPERVISOR_ASSIGNED';
    proposal.updatedAt = new Date();

    await proposal.save();

    await createNotification({
      userId: supervisor._id,
      title: 'New Project Assignment',
      message: `A proposal "${proposal.title}" has been assigned to you for supervision.`,
      relatedType: 'proposal',
      relatedId: proposal._id,
    });

    await createNotification({
      userId: proposal.teamLeaderId,
      title: 'Supervisor Assigned',
      message: `Supervisor ${supervisor.name} has been assigned to your proposal "${proposal.title}".`,
      relatedType: 'proposal',
      relatedId: proposal._id,
    });

    if (supervisor.email) {
      await sendEmail(
        supervisor.email,
        'New Project Assignment',
        `<p>Hi ${supervisor.name},</p><p>A proposal "<strong>${proposal.title}</strong>" has been assigned to you for supervision. Please log in to review it.</p>`
      );
    }

    await emailTeamLeader(
      proposal.teamLeaderId,
      'Supervisor Assigned',
      `<p>Supervisor <strong>${supervisor.name}</strong> has been assigned to your proposal "<strong>${proposal.title}</strong>".</p>`
    );

    res.json({ success: true, proposal });
  } catch (error) {
    console.error('Error assigning supervisor:', error);
    res.status(500).json({ message: 'Server error while assigning supervisor' });
  }
};

// exports.supervisorDecision = async (req, res) => {
//   try {
//     const supervisorId = req.user._id;
//     const { proposalId } = req.params;
//     const { decision, supervisorRemarks } = req.body;

//     const allowed = ['SUPERVISOR_ACCEPTED', 'REVISION_REQUESTED_BY_SUPERVISOR'];
//     if (!allowed.includes(decision)) {
//       return res.status(400).json({ message: 'Invalid supervisor decision' });
//     }

//     const proposal = await Proposal.findById(proposalId);
//     if (!proposal) {
//       return res.status(404).json({ message: 'Proposal not found' });
//     }

//     if (String(proposal.assignedSupervisorId) !== String(supervisorId)) {
//       return res.status(403).json({ message: 'Only the assigned supervisor can update this proposal' });
//     }

//     if (proposal.status !== 'SUPERVISOR_ASSIGNED') {
//       return res.status(400).json({ message: 'Proposal is not in supervisor review state' });
//     }

//     proposal.status = decision;
//     proposal.supervisorRemarks = supervisorRemarks || proposal.supervisorRemarks;
//     if (decision === 'SUPERVISOR_ACCEPTED') {
//       proposal.supervisorAcceptedAt = new Date();
//       proposal.updatedAt = new Date();
//     }

//     await proposal.save();

//     await createNotification({
//       userId: proposal.teamLeaderId,
//       title: 'Supervisor Decision',
//       message: `Supervisor has ${decision === 'SUPERVISOR_ACCEPTED' ? 'accepted' : 'requested revisions for'} your proposal "${proposal.title}".`,
//       relatedType: 'proposal',
//       relatedId: proposal._id,
//     });

//     res.json({ success: true, proposal });
//   } catch (error) {
//     console.error('Error recording supervisor decision:', error);
//     res.status(500).json({ message: 'Server error while recording supervisor decision' });
//   }
// };




exports.supervisorDecision = async (req, res) => {
  try {
    const supervisorId = req.user._id;
    const { proposalId } = req.params;
    const { decision, supervisorRemarks } = req.body;

    const allowed = [
      'SUPERVISOR_ACCEPTED',
      'REVISION_REQUESTED_BY_SUPERVISOR'
    ];

    if (!allowed.includes(decision)) {
      return res.status(400).json({
        message: 'Invalid supervisor decision'
      });
    }

    const proposal = await Proposal.findById(proposalId);

    if (!proposal) {
      return res.status(404).json({
        message: 'Proposal not found'
      });
    }

    if (
      String(proposal.assignedSupervisorId) !==
      String(supervisorId)
    ) {
      return res.status(403).json({
        message:
          'Only the assigned supervisor can update this proposal'
      });
    }

    if (proposal.status !== 'SUPERVISOR_ASSIGNED') {
      return res.status(400).json({
        message: 'Proposal is not in supervisor review state'
      });
    }

    proposal.status = decision;
    proposal.supervisorRemarks =
      supervisorRemarks || proposal.supervisorRemarks;

    let createdProject = null;

    if (decision === 'SUPERVISOR_ACCEPTED') {
      proposal.supervisorAcceptedAt = new Date();
      proposal.updatedAt = new Date();

      if (!proposal.teamId) {
        return res.status(400).json({
          message: 'Cannot create project: proposal missing team reference',
        });
      }

      let teamLeaderId = proposal.teamLeaderId;
      if (!teamLeaderId) {
        const team = await Team.findById(proposal.teamId);
        teamLeaderId = team?.createdBy;
      }

      if (!teamLeaderId) {
        return res.status(400).json({
          message: 'Cannot create project: team leader is missing from proposal',
        });
      }

      let departmentId = proposal.departmentId;
      if (!departmentId) {
        const leader = await Users.findById(teamLeaderId);
        departmentId = leader?.department || null;
      }

      const supervisorIdToUse = proposal.assignedSupervisorId || supervisorId;

      // Create project only if it doesn't exist yet
      let existingProject = await Project.findOne({ proposalId: proposal._id });
      if (!existingProject) {
        createdProject = await Project.create({
          proposalId:       proposal._id,
          teamId:           proposal.teamId,
          teamLeaderId,
          departmentId,
          supervisorId:     supervisorIdToUse,
          title:            proposal.title,
          category:         proposal.category,
          abstract:         proposal.abstract,
          objectives:       proposal.objectives,
          technologies:     proposal.technologies,
          academicSession:  proposal.academicSession,
          proposalReportUrl: proposal.proposalReportUrl,
          status:           'ACTIVE',
          progress:         0,
          startDate:        new Date(),
        });
        existingProject = createdProject;
      }

      // Create assignment only if it doesn't exist yet (independent of project creation)
      const existingAssignment = await AssignedProject.findOne({ projectId: existingProject._id });
      if (!existingAssignment) {
        await AssignedProject.create({
          projectId:    existingProject._id,
          proposalId:   proposal._id,
          teamId:       proposal.teamId,
          teamLeaderId,
          supervisorId: supervisorIdToUse,
          departmentId: departmentId || null,
          assignedAt:   new Date(),
          status:       'ACTIVE',
        });
      }
    }

    await proposal.save();

    await createNotification({
      userId: proposal.teamLeaderId,
      title: 'Supervisor Decision',
      message: `Supervisor has ${
        decision === 'SUPERVISOR_ACCEPTED'
          ? 'accepted'
          : 'requested revisions for'
      } your proposal "${proposal.title}".`,
      relatedType: 'proposal',
      relatedId: proposal._id,
    });

    await emailTeamLeader(
      proposal.teamLeaderId,
      'Supervisor Decision',
      `<p>Supervisor has ${
        decision === 'SUPERVISOR_ACCEPTED' ? 'accepted' : 'requested revisions for'
      } your proposal "<strong>${proposal.title}</strong>".</p>${
        supervisorRemarks ? `<p><strong>Remarks:</strong> ${supervisorRemarks}</p>` : ''
      }`
    );

    res.json({
      success: true,
      proposal,
      project: createdProject,
    });
  } catch (error) {
    console.error('Error recording supervisor decision:', error);
    res.status(500).json({
      message:
        error.message ||
        'Server error while recording supervisor decision',
    });
  }
};

exports.getProposalById = async (req, res) => {
  try {
    const { proposalId } = req.params;
    const proposal = await Proposal.findById(proposalId)
      .populate('teamId', 'subject members')
      .populate('teamLeaderId', 'name email')
      .populate('preferredSupervisorId', 'name email')
      .populate('assignedSupervisorId', 'name email');

    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found' });
    }

    res.json({ proposal });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({ message: 'Server error while fetching proposal' });
  }
};
