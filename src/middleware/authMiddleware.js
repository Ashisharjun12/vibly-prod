import jwt from 'jsonwebtoken';
import { _config } from '../config/config.js';
import User from '../models/user.model.js';

export const authMiddleware = async (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });


    const accessToken = authHeader.split(" ")[1];

    if (!accessToken) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const payload = jwt.verify(accessToken, _config.JWT_ACCESS_SECRET);

        // Fetch full user data from database
        const user = await User.findById(payload.id);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user._id;
        next();
    } catch (error) {
        console.log('Error in Auth Middleware:', error);
        return res.status(403).json({ message: 'Invalid token' });
    }
};

