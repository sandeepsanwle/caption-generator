const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      required: true,
    },
    captionSource: { type: String, required: true }, // auto | srt | vtt | json
    inputVideoPath: { type: String, required: true },
    inputCaptionsPath: { type: String },
    generatedSrtPath: { type: String },
    outputVideoPath: { type: String },
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", JobSchema);

