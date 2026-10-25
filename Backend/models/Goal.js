const mongoose = require("mongoose");

const categoryTargetSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    limit: { type: Number, required: true }, // is category mein is hafte max kitna kharch
  },
  { _id: false }
);

const baselineSchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    weeklyAvg: { type: Number, required: true }, // goal banate waqt ka normal weekly kharch
  },
  { _id: false }
);

const weekPlanSchema = new mongoose.Schema(
  {
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    targetSpend: { type: Number, required: true }, // is hafte flexible kharch ki limit
    actualSpend: { type: Number, default: 0 },     // replan ke time fill hota hai
    categoryTargets: [categoryTargetSchema],
  },
  { _id: false }
);

const GoalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    targetAmount: { type: Number, required: true },
    savedSoFar: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    feasible: { type: Boolean, default: true },
    achievableTotal: { type: Number },
    fixedCategories: [{ type: String }],   // user ne jo extra fixed bataye
    baseline: [baselineSchema],            // sirf flexible categories
    weeklyPlan: [weekPlanSchema],
    lastReplannedAt: { type: Date },
    lastReport: {                           // UI ke liye: progress ka snapshot
      weeksDone: { type: Number },
      remainingWeeks: { type: Number },
      remainingAmount: { type: Number },
      neededPerWeek: { type: Number },
    },
    aiNote: { type: String },              // AI ka Hinglish explanation (optional)
    status: {
      type: String,
      enum: ["active", "completed", "failed"],
      default: "active",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Goal", GoalSchema);