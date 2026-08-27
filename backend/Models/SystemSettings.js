const mongoose = require("mongoose");

// Singleton document — always upserted against a fixed _id so there's ever
// only one row, rather than a generic key/value table (this app only needs
// one setting today; add fields here directly if more show up later).
const systemSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "singleton" },
    groupFormationOpen: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
