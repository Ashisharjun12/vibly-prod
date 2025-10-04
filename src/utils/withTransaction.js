import mongoose from "mongoose";

export async function withTransaction(callback) {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        // pass the session to the callback
        const result = await callback(session);

        await session.commitTransaction();
        return result;
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }
}
