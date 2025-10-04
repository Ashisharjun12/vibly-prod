import jwt from "jsonwebtoken";
import { generateTokens } from "../utils/generateTokens.js";
import RefreshToken from "../models/refreshToken.model.js";
import { _config } from "../config/config.js";
import logger from "../utils/logger.js";


export const googleCallback = async (req, res) => {
    
    try {
        console.log("Google callback hit");

        const user = req.user;
        if (!user) {
            logger.error("User not found in request");
            throw new Error("User not found in request");
        }

        // Generate tokens
        const { accessToken, refreshToken } = generateTokens(req.user);

        console.log(`User ${user.id} successfully authenticated`);

        console.log("Access Token:", accessToken);
        console.log("Refresh Token:", refreshToken);

        await RefreshToken.create({
            userId: req.user._id,
            token: refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });


        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        res.redirect(`${_config.CLIENT_URL}/login/success?accessToken=${accessToken}`);


    } catch (error) {
        console.error("Error in Google callback:", error);
        res.redirect(`${_config.CLIENT_URL}/login?error=auth_failed`);
    }
    
};

export const logoutUser = async (req, res) => {
    try {
        // Clear cookies
        const token = req.cookies.refreshToken;
        if (token)
            await RefreshToken.deleteOne({ token });

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
        });

        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                return res.status(500).json({ error: "Failed to logout" });
            }

            // Logout passport
            req.logout(() => {
                console.log("User logged out successfully");
                res.redirect(_config.CLIENT_URL);
            });
        });
    } catch (error) {
        console.error("Error in logout:", error);
        return res.status(500).json({ error: "Failed to logout" });
    }
};

export const refreshToken = async (req, res) => {
    try {
        const oldRefreshToken = req.cookies.refreshToken;
        if (!oldRefreshToken) {
            console.error("No refresh token provided");
            return res.status(401).json({
                error: "No refresh token provided",
            });
        }

        const payload = jwt.verify(oldRefreshToken, _config.JWT_REFRESH_SECRET);

        if (!payload || !payload.id) {
            return res.status(403).json({
                error: "Invalid refresh token",
            });
        }

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(payload);

        await RefreshToken.updateOne(
            { token: oldRefreshToken },
            {
                token: newRefreshToken,
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            }
        );

        console.log(`Token refreshed for user ${payload.id}`);

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({ message: "Token refreshed successfully", data: { accessToken: newAccessToken } });
    } catch (error) {
        console.error("Error refreshing token:", error);

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                error: "Refresh token expired",
                redirect: true
            });
        }

        return res.status(403).json({
            error: "Invalid refresh token",
            redirect: true
        });
    }
};