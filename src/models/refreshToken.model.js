import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
});

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export default RefreshToken;