import express from "express";
import passport from "passport";
import { googleCallback, logoutUser, refreshToken } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import User from "../models/user.model.js";

const router = express.Router();

// Test route to verify server is working
router.get("/test", (req, res) => {
    res.json({ message: "Auth routes are working!" });
});

// @route   GET /api/auth/google
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"], accessType: "offline", prompt: "consent" })
);

// @route   GET /api/auth/google/callback
router.get(
    "/google/callback",
    passport.authenticate("google", {
        // successRedirect: "/",
        failureRedirect: "/login",
        session: true,
    }),
    googleCallback
);

// @route   GET /api/auth/logout
router.get("/logout", authMiddleware, logoutUser);

// @route   POST /api/auth/refresh-token
router.post("/refresh-token", refreshToken);

// @route   GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => { 
    try {
        const user = await User.findById(req.user).select('-password -refreshToken');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ message: 'Error fetching user data' });
    }
});

// @route   GET /api/auth/user-details
router.get("/user-details/:id", authMiddleware, async (req, res) => { 
    try {
        const { id } = req.params;
        const userdetails = await User.findById(id)
        if (!userdetails) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json({
            success: true,
            data:userdetails
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        return res.status(500).json({ message: 'Error fetching user details' });
    }
});

export default router;