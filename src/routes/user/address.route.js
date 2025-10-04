import express from 'express';
import { AddressController} from '../../controllers/address.controller.js';

const router = express.Router();

// Get address details by pincode
router.get('/pincode/:pincode', AddressController.getPincodeDetails);

export default router;
