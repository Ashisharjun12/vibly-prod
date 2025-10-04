import PincodeService from '../services/pincodeService.js';

/**
 * Address Controller - Handles address-related operations
 */
export class AddressController {
  /**
   * Get address details by pincode
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async getPincodeDetails(req, res) {
    try {
      const { pincode } = req.params;
      
      const result = await PincodeService.getPincodeDetails(pincode);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(404).json(result);
      }
    } catch (error) {
      console.error('Pincode controller error:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Internal server error. Please try again later.'
      });
    }
  }
}
