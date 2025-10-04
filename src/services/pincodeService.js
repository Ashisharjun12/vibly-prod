import axios from 'axios';


/**
 * Pincode Service - Handles pincode lookup functionality
 */
class PincodeService {
  /**
   * Get address details by pincode using India Post API
   * @param {string} pincode - 6-digit pincode
   * @returns {Promise<Object>} Address details
   */
  static async getPincodeDetails(pincode) {
    if (!pincode || !/^\d{6}$/.test(pincode)) {
      throw new CustomError('Invalid pincode format. Pincode must be 6 digits.', 400);
    }

    try {
      // Using India Post API
      const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, {
        timeout: 10000
      });

      console.log("Pincode API Response:", response.data[0]?.PostOffice?.[0]); // Debug log

      if (response.data && response.data[0] && response.data[0].Status === 'Success') {
        const data = response.data[0].PostOffice[0];
        
        return {
          success: true,
          data: {
            pincode: pincode,
            state: data.State,
            city: data.Block, // Use Block field for city
            district: data.District,
            country: 'India',
            block: data.Block,
            division: data.Division,
            region: data.Region,
            circle: data.Circle
          }
        };
      } else {
        throw new CustomError('Pincode not found. Please check the pincode and try again.', 404);
      }
    } catch (error) {
      console.error('Error fetching pincode details from India Post API:', error.message);
      
      // Fallback to Zippopotam API if India Post fails
      try {
        const zippoResponse = await axios.get(`https://api.zippopotam.us/in/${pincode}`, {
          timeout: 10000
        });
        
        const zippoData = zippoResponse.data;
        if (zippoData && zippoData.places && zippoData.places.length > 0) {
          const place = zippoData.places[0];
          return {
            success: true,
            data: {
              pincode: pincode,
              state: place['state'],
              city: place['place name'],
              district: place['state'], // Zippopotam doesn't always have district, using state as fallback
              country: zippoData['country'],
              block: null,
              division: null,
              region: null,
              circle: null
            }
          };
        } else {
          throw new CustomError('Pincode not found via Zippopotam. Please check the pincode and try again.', 404);
        }
      } catch (zippoError) {
        console.error('Error fetching pincode details from Zippopotam API:', zippoError.message);
        throw new CustomError('Unable to fetch pincode details. Please try again later.', 500);
      }
    }
  }

  /**
   * Validate pincode format
   * @param {string} pincode - Pincode to validate
   * @returns {boolean} Is valid pincode
   */
  static validatePincode(pincode) {
    return /^\d{6}$/.test(pincode);
  }
}

export default PincodeService;
