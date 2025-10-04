import jwt from "jsonwebtoken";
import { _config } from "../config/config.js";

export const generateTokens = (user) => {
    const accessToken = jwt.sign({ id: user.id }, _config.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user.id }, _config.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    return { accessToken, refreshToken };
};