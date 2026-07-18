const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    // Reference to original proposal
    proposalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Proposal",
      required: true,
      unique: true,
    },

    // Team Information
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },

    teamLeaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },

    // Supervisor
    supervisorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supervisor",
      required: true,
    },

    // Project Details
    title: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      default: "",
    },

    abstract: {
      type: String,
      default: "",
    },

    objectives: {
      type: String,
      default: "",
    },

    technologies: {
      type: String,
      default: "",
    },

    academicSession: {
      type: String,
      default: "",
    },

    proposalReportUrl: {
      type: String,
      default: "",
    },

    // Project Progress
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Project Status
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "IN_PROGRESS",
        "ON_HOLD",
        "UNDER_REVIEW",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "ACTIVE",
    },

    // Optional Information
    githubRepository: {
      type: String,
      default: "",
    },

    deploymentLink: {
      type: String,
      default: "",
    },

    finalReportUrl: {
      type: String,
      default: "",
    },

    // AI content-quality signal on the final report (same OpenRouter model
    // used for the proposal quality check), shown to the supervisor as a
    // second opinion before they grade — not a plagiarism-database match.
    reportQualityCheck: {
      score: { type: Number, default: null },
      issues: { type: [String], default: [] },
      suggestions: { type: [String], default: [] },
      originalityConcerns: { type: [String], default: [] },
      checkedAt: { type: Date, default: null },
    },

    evaluationMarks: {
      type: Number,
      default: 0,
    },

    memberGrades: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        name: { type: String },
        marks: { type: Number, min: 0, max: 100, default: 0 },
        rubricScores: [
          {
            criterionName: { type: String },
            weight: { type: Number },
            score: { type: Number, min: 0, max: 100 },
          },
        ],
      },
    ],

    // Grade approval flow
    gradesStatus: {
      type: String,
      enum: ["PENDING_RELEASE", "RELEASED", "FLAGGED"],
      default: "PENDING_RELEASE",
    },

    adminRemarks: { type: String, default: "" },
    flaggedReason: { type: String, default: "" },

    // Student-initiated appeal on an already-RELEASED grade — the only path
    // to revisit a grade after release, since flagGrades only works pre-
    // release. Accepting an appeal reopens grading via the existing
    // FLAGGED status/re-grade flow rather than a separate mechanism.
    gradeAppeal: {
      status:          { type: String, enum: ["NONE", "REQUESTED", "ACCEPTED", "REJECTED"], default: "NONE" },
      reason:          { type: String, default: "" },
      requestedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
      requestedByName: { type: String, default: "" },
      requestedAt:     { type: Date, default: null },
      adminResponse:   { type: String, default: "" },
      respondedAt:     { type: Date, default: null },
    },

    remarks: {
      type: String,
      default: "",
    },

    // Weighted evaluation phases
    evaluationPhases: [
      {
        phase:            { type: String, enum: ["INTERNAL", "MIDTERM", "FINAL"] },
        label:            { type: String },
        weight:           { type: Number },
        status:           { type: String, enum: ["PENDING", "SUBMITTED"], default: "PENDING" },
        submittedAt:      { type: Date },
        evaluationMarks:  { type: Number, default: 0 },
        memberGrades: [
          {
            userId:      { type: mongoose.Schema.Types.ObjectId, ref: "users" },
            name:        { type: String },
            marks:       { type: Number, min: 0, max: 100 },
            rubricScores: [
              {
                criterionName: { type: String },
                weight:        { type: Number },
                score:         { type: Number, min: 0, max: 100 },
              },
            ],
          },
        ],
        remarks: { type: String, default: "" },
      },
    ],

    // Immutable grade history
    gradeHistory: [
      {
        phase:          { type: String },
        action:         { type: String },   // "SUBMITTED" or "REVISED"
        actorId:        { type: mongoose.Schema.Types.ObjectId },
        actorName:      { type: String },
        timestamp:      { type: Date, default: Date.now },
        evaluationMarks:{ type: Number },
        memberGrades: [
          {
            userId: { type: mongoose.Schema.Types.ObjectId },
            name:   { type: String },
            marks:  { type: Number },
          },
        ],
        remarks:        { type: String, default: "" },
        revisionReason: { type: String, default: "" },
      },
    ],

    // Viva / Defense details
    vivaDetails: {
      status:        { type: String, enum: ["SCHEDULED", "GRADED"] },
      scheduledAt:   { type: Date },
      mode:          { type: String, enum: ["IN_PERSON", "ONLINE"], default: "IN_PERSON" },
      venue:         { type: String, default: "" },   // room/building, when mode is IN_PERSON
      meetingLink:   { type: String, default: "" },   // join URL, when mode is ONLINE
      durationMinutes: { type: Number, default: 30 },
      instructions:  { type: String, default: "" },   // what to bring / prepare
      // examinerName is kept for backward compatibility with vivas scheduled
      // before the panel feature existed; new schedules populate `examiners`
      // and derive examinerName from it for any old consumer still reading it.
      examinerName:  { type: String, default: "" },
      examiners: [
        {
          name: { type: String },
          role: { type: String, default: "" }, // e.g. "Internal Examiner", "External Examiner", "Panel Chair"
        },
      ],
      // Which reminder thresholds (days-before, e.g. 3 and 1) have already
      // been sent, so the lazy check-on-load doesn't re-notify.
      remindersSent: [{ type: Number }],
      vivaMarks:     { type: Number, default: 0 },
      memberVivaGrades: [
        {
          userId:      { type: mongoose.Schema.Types.ObjectId, ref: "users" },
          name:        { type: String },
          marks:       { type: Number, min: 0, max: 100 },
          rubricScores: [
            {
              criterionName: { type: String },
              weight:        { type: Number },
              score:         { type: Number, min: 0, max: 100 },
            },
          ],
        },
      ],
      gradedAt: { type: Date },
      remarks:  { type: String, default: "" },
    },

    // Combined supervisor + viva final mark
    overallFinalMarks: { type: Number, default: null },

    // In-progress grading a supervisor hasn't submitted yet — lets them save
    // partial rubric scores and come back later instead of losing everything
    // by closing the modal. Cleared implicitly once that phase is submitted
    // for real (the submitted phase data then takes priority when reopened).
    gradingDraft: {
      phase:        { type: String, default: null },
      rubricScores: { type: mongoose.Schema.Types.Mixed, default: null },
      remarks:      { type: String, default: "" },
      savedAt:      { type: Date, default: null },
    },

    // Dates
    startDate: {
      type: Date,
      default: Date.now,
    },

    completionDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.Project || mongoose.model("Project", projectSchema);