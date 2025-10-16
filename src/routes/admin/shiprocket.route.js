import {Router} from 'express';
import { shiprocketMiddleware } from '../../middleware/shiprocketMiddleware.js';
import { loginToShiprocket, tokenLogoutFromShiprocket } from '../../controllers/shiprocket.controller.js';

const router = Router();

router.post('/generate-token',  loginToShiprocket);

router.post('/token-logout',  shiprocketMiddleware, tokenLogoutFromShiprocket);


export default router;