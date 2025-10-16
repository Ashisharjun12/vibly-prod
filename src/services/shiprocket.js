export const createReturnOrder = async (orderData, token) => {
    try {
        const response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/return", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error creating return order:", error);
        return {
            success: false,
            error: error.response?.data?.message || "Failed to create return order"
        };
    }
};

export const createAdhocOrder = async (orderData, token) => {
    try {
        const response = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error creating adhoc order:", error);
        return {
            success: false,
            error: error.response?.data?.message || "Failed to create order"
        };
    }
};

export const assignAWB = async (shipmentId, token) => {
    try {
        const response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/assign/awb`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ shipment_id: shipmentId }),
        });
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error assigning AWB:", error);
        return {
            success: false,
            error: error.response?.data?.message || "Failed to assign AWB"
        };
    }
};


export const generatePickup = async (shipmentId, token) => {
    try {
        const response = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/generate/pickup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ shipment_id: shipmentId })
        });
        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Error generating pickup:", error);
        return {
            success: false,
            error: error.response?.data?.message || "Failed to generate pickup"
        };
    }
};
