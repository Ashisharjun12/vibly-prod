import jwt from 'jsonwebtoken';
import { _config } from '../config/config.js';
import User from '../models/user.model.js';

export const adminMiddleware = async (req, res, next) => {

    const authHeader = req.headers.authorization;
    console.log('Authorization Header: in Admin Middleware', authHeader);

    if (!authHeader) return res.status(401).json({ message: 'Unauthorized' });


    const accessToken = authHeader.split(" ")[1];
    console.log('Access Token in Admin Middleware:', accessToken);

    if (!accessToken) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const payload = jwt.verify(accessToken, _config.JWT_ACCESS_SECRET);
        console.log('Payload in Admin Middleware:', payload);

        req.user = payload.id;
        const user = await User.findById(payload.id);
        console.log('User in Admin Middleware:', user);

        if (user.role !== 'Admin') {
            console.log('Unauthorized: User is not Admin');
            return res.status(403).json({ message: 'Unauthorized' });
        }
        next();
    } catch (error) {
        console.log('Error in Admin Middleware:', error);
        return res.status(403).json({ message: 'Invalid token' });
    }
};


