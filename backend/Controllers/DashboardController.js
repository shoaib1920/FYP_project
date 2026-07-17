    const Task = require("../Models/Task.js");
    const Team = require("../Models/Team.js");
    const User = require("../Models/Users.js");
    const TaskAssignment = require("../Models/TaskAssignment.js");
    const UserProjectSummary = require("../Models/UserProjectSummary.js");
    // ✅ Get Task Summary
    const getTaskSummary = async (req, res) => {
        const { userId } = req.query;
        
        if (!userId) {
            return res.status(400).json({ message: "User ID is missing in headers" });
        }
        
        try {
            const totalTasks = await TaskAssignment.countDocuments({ user_id: userId });
            // console.log(`totaltasks>>${totalTasks}`)
            // Count completed as either 'Completed' or 'Approved' to be resilient
            const completedTasks = await TaskAssignment.countDocuments({
                user_id: userId,
                status: { $in: ["Completed", "Approved"] },
            });
            const pendingTasks = await TaskAssignment.countDocuments({ user_id: userId, status: "Pending" });

            // console.log(`Total Tasks: ${totalTasks}, Completed Tasks: ${completedTasks}, Pending Tasks: ${pendingTasks}`);

            res.json({ totalTasks, completedTasks, pendingTasks });
        } catch (error) {
            console.error("Error fetching task summary:", error);
            res.status(500).json({ message: "Error fetching task summary", error });
        }
    };



    // ✅ Get Task Progress Over Time (filtered by userId)
    const getTaskProgress = async (req, res) => {
        try {
            const { userId } = req.query;
            
            // Build match stage: if userId provided, filter by user_id; otherwise all tasks
            const matchStage = userId ? { $match: { user_id: userId } } : { $match: {} };
            
            // Aggregate assignment progress by week from TaskAssignment (status tracked here)
            const weeklyProgress = await TaskAssignment.aggregate([
                matchStage,
                {
                    $group: {
                        _id: { $week: "$assignedAt" },
                        completed: {
                            $sum: {
                                $cond: [
                                    { $in: ["$status", ["Completed", "Approved"]] },
                                    1,
                                    0,
                                ],
                            },
                        },
                        pending: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "Pending"] }, 1, 0],
                            },
                        },
                    },
                },
                { $sort: { "_id": 1 } },
            ]);

            // Normalize into arrays for the frontend chart
            const labels = weeklyProgress.map((data) => `Week ${data._id}`);
            const completedData = weeklyProgress.map((data) => data.completed || 0);
            const pendingData = weeklyProgress.map((data) => data.pending || 0);

            return res.json({ labels, completedData, pendingData });
        } catch (error) {
            res.status(500).json({ message: "Error fetching task progress", error });
        }
    };

    // ✅ Get Leaderboard — scoped to the requesting student's own team/group only
    const getLeaderboard = async (req, res) => {
        try {
            const { userId } = req.query;

            if (!userId) {
                return res.json([]);
            }

            const teams = await Team.find({ members: userId }, "members").lean();
            const groupMemberIds = teams.reduce((ids, team) => {
                team.members.forEach((member) => ids.add(String(member)));
                return ids;
            }, new Set());

            if (groupMemberIds.size === 0) {
                return res.json([]);
            }

            const leaderboard = await UserProjectSummary.find({ userId: { $in: Array.from(groupMemberIds) } })
                .sort({ completedProjects: -1 })
                .limit(10);
            res.json(leaderboard);
        } catch (error) {
            res.status(500).json({ message: "Error fetching leaderboard", error });
        }
    };

    // ✅ Get Recent Tasks
    const getRecentTasks = async (req, res) => {
        try {
            const { userId } = req.query;
            let recentTasks;

            if (userId) {
                const teams = await Team.find({ members: userId }, "members").lean();
                const groupMemberIds = teams.reduce((ids, team) => {
                    team.members.forEach((member) => ids.add(String(member)));
                    return ids;
                }, new Set());

                const filterIds = groupMemberIds.size > 0 ? Array.from(groupMemberIds) : [userId];
                recentTasks = await Task.find({ createdBy: { $in: filterIds } })
                    .sort({ createdAt: -1 })
                    .limit(5)
                    .lean();
            } else {
                recentTasks = await Task.find().sort({ createdAt: -1 }).limit(5).lean();
            }

            res.json(recentTasks);
        } catch (error) {
            res.status(500).json({ message: "Error fetching recent tasks", error });
        }
    };

    module.exports = {
        getTaskSummary,
        getTaskProgress,
        getLeaderboard,
        getRecentTasks
    };
