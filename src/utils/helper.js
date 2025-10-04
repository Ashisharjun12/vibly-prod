import crypto from 'crypto';

const getRandomHex = (length = 3) => crypto.randomBytes(length).toString('hex').toUpperCase();
const getDateStamp = () => {
    const now = new Date();
    return `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
};

export const generateOrderId = () => `ORD-${getDateStamp()}-${getRandomHex()}`;
export const generateItemId = () => `ITEM-${getDateStamp(4)}-${getRandomHex()}`;
export const generateCancelId = () => `CNCL-${getDateStamp()}-${getRandomHex()}`;
export const generateReturnId = () => `RETN-${getDateStamp()}-${getRandomHex()}`;
