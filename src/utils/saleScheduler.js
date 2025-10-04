import cron from "node-cron";
import Sale from "../models/sale.model.js";
import Product from "../models/product.model.js";
import { withTransaction } from "./withTransaction.js";

// Registry of active cron jobs { saleId: { activateJob, deactivateJob } }
const saleJobs = new Map();

/**
 * Schedule activation and deactivation of a sale
 */
export const scheduleSaleJobs = (sale) => {
    const { _id, name, products, startDate, endDate } = sale;

    // If jobs already exist for this sale, cancel them before re-scheduling
    cancelSaleJobs(_id);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // --- Activation Job ---
    const activateJob = cron.schedule(getCronExpression(start), async () => {
        try {
            await withTransaction(async (session) => {
                const foundSale = await Sale.findById(_id).session(session);
                if (foundSale && !foundSale.isActive) {
                    foundSale.isActive = true;
                    await foundSale.save({ session });

                    await Product.updateMany(
                        { _id: { $in: products } },
                        { $set: { isOnSale: true } },
                        { session }
                    );

                    console.log(`✅ Sale "${name}" activated`);
                }
            });
        } catch (err) {
            console.error(`⚠️ Failed to activate sale "${name}":`, err.message);
        }
    });

    // --- Deactivation Job ---
    const deactivateJob = cron.schedule(getCronExpression(end), async () => {
        try {
            await withTransaction(async (session) => {
                const foundSale = await Sale.findById(_id).session(session);
                if (foundSale && foundSale.isActive) {
                    foundSale.isActive = false;
                    await foundSale.save({ session });

                    await Product.updateMany(
                        { _id: { $in: products } },
                        { $set: { isOnSale: false } },
                        { session }
                    );

                    console.log(`❌ Sale "${name}" deactivated`);
                }
            });
        } catch (err) {
            console.error(`⚠️ Failed to deactivate sale "${name}":`, err.message);
        }
    });

    // Save jobs in registry
    saleJobs.set(_id.toString(), { activateJob, deactivateJob });
};

/**
 * Cancel scheduled jobs for a given sale
 */
export const cancelSaleJobs = (saleId) => {
    const jobs = saleJobs.get(saleId.toString());
    if (jobs) {
        if (jobs.activateJob) jobs.activateJob.stop();
        if (jobs.deactivateJob) jobs.deactivateJob.stop();
        saleJobs.delete(saleId.toString());
        console.log(`🛑 Cancelled cron jobs for sale ${saleId}`);
    }
};

/**
 * Helper: Convert a JS Date into a cron expression
 */
function getCronExpression(date) {
    return `${date.getMinutes()} ${date.getHours()} ${date.getDate()} ${date.getMonth() + 1
        } *`;
}
