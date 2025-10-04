import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import { _config } from "../config/config.js";

cloudinary.config({
    cloud_name: _config.CLOUDINARY_NAME,
    api_key: _config.CLOUDINARY_API_KEY,
    api_secret: _config.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (localFilePath, folder, shouldDelete = true) => {
    try {
        if (!localFilePath) return null;
        
        // Check if file exists before uploading
        if (!fs.existsSync(localFilePath)) {
            console.error(`File does not exist: ${localFilePath}`);
            return null;
        }
        
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder,
        });

        // Only delete file if it exists and shouldDelete is true
        if (shouldDelete && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        console.log("File uploaded successfully:", response.public_id);
        return response;
    } catch (error) {
        console.error("Error uploading file to Cloudinary:", error);
        // Only try to delete file if it exists and shouldDelete is true
        if (shouldDelete && fs.existsSync(localFilePath)) {
            try {
                fs.unlinkSync(localFilePath);
            } catch (deleteError) {
                console.error("Error deleting temp file:", deleteError);
            }
        }
        return null;
    }
};

const deleteFromCloudinary = async (imageId) => {
    try {
        if (!imageId) {
            console.warn('No image ID provided for deletion');
            return null;
        }
        const response = await cloudinary.uploader.destroy(imageId);
        return response;
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        throw error;
    }
};

export { uploadToCloudinary, deleteFromCloudinary };