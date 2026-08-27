const SystemSettings = require("../Models/SystemSettings");

async function getSingleton() {
  let settings = await SystemSettings.findById("singleton");
  if (!settings) settings = await SystemSettings.create({ _id: "singleton" });
  return settings;
}

// GET /settings — any authenticated role (student signup/group-creation flows read this too)
exports.getSettings = async (req, res) => {
  try {
    const settings = await getSingleton();
    res.json({ success: true, settings });
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ success: false, message: "Server error while fetching settings" });
  }
};

// PUT /admin/settings — admin only
exports.updateSettings = async (req, res) => {
  try {
    const { groupFormationOpen } = req.body;
    const settings = await getSingleton();
    if (groupFormationOpen !== undefined) settings.groupFormationOpen = groupFormationOpen;
    await settings.save();
    res.json({ success: true, settings });
  } catch (err) {
    console.error("Error updating settings:", err);
    res.status(500).json({ success: false, message: "Server error while updating settings" });
  }
};
