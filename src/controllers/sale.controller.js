import Sale from "../models/sale.model.js";
import Product from "../models/product.model.js";

/**
 * @route   POST /
 * @desc    Create new sale
 * @access  Private (Admin)
 */
export const createSale = async (req, res) => {
    try {
        const {
            name,
            description,
            products,
            startDate,
            endDate
        } = req.body;

        if (!name || !products || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing",
                data: null,
                error: "Missing name, products, startDate, or endDate",
            });
        }

        // Validate products exist
        const productIds = Array.isArray(products) ? products : [];
        const existingProducts = await Product.find({ _id: { $in: productIds } });
        
        if (existingProducts.length !== productIds.length) {
            return res.status(400).json({
                success: false,
                message: "Some products not found",
                data: null,
                error: "Invalid product IDs provided",
            });
        }

        // Create sale
        const sale = await Sale.create({
            name,
            description: description || '',
            products: productIds,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isActive: true
        });

        // Update products to be on sale
        await Product.updateMany(
            { _id: { $in: productIds } },
            { isOnSale: true }
        );

        return res.status(201).json({
            success: true,
            message: "Sale created successfully",
            data: sale,
            error: null,
        });
    } catch (err) {
        console.error("Error in createSale:", err);
        return res.status(500).json({
            success: false,
            message: "Error creating sale",
            error: err.message,
        });
    }
};

/**
 * @route   GET /
 * @desc    Get all sales for admin
 * @access  Private (Admin)
 */
export const getSalesForAdmin = async (req, res) => {
    try {
        const sales = await Sale.find()
            .populate({
                path: 'products',
                select: 'name variants nonSalePrice',
                populate: {
                    path: 'variants',
                    select: 'orderImage'
                }
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Sales fetched successfully",
            data: sales,
            error: null,
        });
    } catch (err) {
        console.error("Error in getSalesForAdmin:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch sales",
            error: err.message,
        });
    }
};

/**
 * @route   GET /:id
 * @desc    Get sale by ID
 * @access  Private (Admin)
 */
export const getSaleByIdForAdmin = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id)
            .populate('products');

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: "Sale not found",
                data: null,
                error: "No sale found with the provided ID",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Sale fetched successfully",
            data: sale,
            error: null,
        });
    } catch (err) {
        console.error("Error in getSaleByIdForAdmin:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch sale",
            error: err.message,
        });
    }
};

/**
 * @route   PUT /:id
 * @desc    Update sale details
 * @access  Private (Admin)
 */
export const updateSale = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            description,
            products,
            startDate,
            endDate
        } = req.body;

        const sale = await Sale.findById(id);
        if (!sale) {
            return res.status(404).json({
                success: false,
                message: "Sale not found",
                data: null,
                error: `No sale found with ID: ${id}`,
            });
        }

        // Update basic info
        if (name) sale.name = name;
        if (description !== undefined) sale.description = description;
        if (startDate) sale.startDate = new Date(startDate);
        if (endDate) sale.endDate = new Date(endDate);

        // Handle products update
        if (products) {
            const productIds = Array.isArray(products) ? products : [];
            const existingProducts = await Product.find({ _id: { $in: productIds } });
            
            if (existingProducts.length !== productIds.length) {
                return res.status(400).json({
                    success: false,
                    message: "Some products not found",
                    data: null,
                    error: "Invalid product IDs provided",
                });
            }

            // Remove old products from sale status
            await Product.updateMany(
                { _id: { $in: sale.products } },
                { isOnSale: false }
            );

            // Add new products to sale status
            await Product.updateMany(
                { _id: { $in: productIds } },
                { isOnSale: true }
            );

            sale.products = productIds;
        }

        await sale.save();

        return res.status(200).json({
            success: true,
            message: "Sale updated successfully",
            data: sale,
            error: null,
        });
    } catch (err) {
        console.error("Error in updateSale:", err);
        return res.status(500).json({
            success: false,
            message: "Error updating sale",
            error: err.message,
        });
    }
};

/**
 * @route   DELETE /:id
 * @desc    Delete a sale
 * @access  Private (Admin)
 */
export const deleteSale = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);

        if (!sale) {
            return res.status(404).json({
                success: false,
                message: "Sale not found",
                data: null,
                error: "No sale found with the provided ID",
            });
        }

        // Remove products from sale status
        await Product.updateMany(
            { _id: { $in: sale.products } },
            { isOnSale: false }
        );

        // Delete sale
        await sale.deleteOne();

        return res.status(200).json({
            success: true,
            message: "Sale deleted successfully",
            data: null,
            error: null,
        });
    } catch (err) {
        console.error("Error in deleteSale:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete sale",
            error: err.message,
        });
    }
};

/**
 * @route   PATCH /:id/toggle
 * @desc    Toggle sale status (active/inactive)
 * @access  Private (Admin)
 */
export const toggleSaleStatus = async (req, res) => {
    try {
        const sale = await Sale.findById(req.params.id);
        if (!sale) {
            return res.status(404).json({
                success: false,
                message: "Sale not found",
                data: null,
                error: "No sale found with the provided ID",
            });
        }

        sale.isActive = !sale.isActive;

        // Update products sale status based on sale status
        if (sale.isActive) {
            await Product.updateMany(
                { _id: { $in: sale.products } },
                { isOnSale: true }
            );
        } else {
            await Product.updateMany(
                { _id: { $in: sale.products } },
                { isOnSale: false }
            );
        }

        await sale.save();

        return res.status(200).json({
            success: true,
            message: `Sale ${sale.isActive ? 'activated' : 'deactivated'} successfully`,
            data: sale,
            error: null,
        });
    } catch (err) {
        console.error("Error in toggleSaleStatus:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to toggle sale status",
            error: err.message,
        });
    }
};

/**
 * @route   GET /
 * @desc    Get active sale for users
 * @access  Public
 */
export const getActiveSale = async (req, res) => {
    try {
        const now = new Date();
        
        const activeSale = await Sale.findOne({
            isActive: true,
            startDate: { $lte: now },
            endDate: { $gte: now }
        })
        .populate('products', 'name nonSalePrice salePrice variants orderImage')
        .sort({ createdAt: -1 });

        if (!activeSale) {
            return res.status(404).json({
                success: false,
                message: "No active sale found",
                data: null,
                error: "No sale is currently active",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Active sale retrieved successfully",
            data: activeSale,
            error: null,
        });
    } catch (err) {
        console.error("Error in getActiveSale:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch active sale",
            error: err.message,
        });
    }
};