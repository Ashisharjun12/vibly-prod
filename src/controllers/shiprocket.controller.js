export const loginToShiprocket = async (req, res) => {
    try {
        const { email, password } = req.body;
        const response = await fetch('https://apiv2.shiprocket.in/v1/external/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });
        const data = await response.json();
        console.log("[DEBUG] Login to Shiprocket successful", data);
        return res.status(200).json({ message: 'Login successful', data });
    } catch (error) {
        console.error('Error logging to Shiprocket:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export const tokenLogoutFromShiprocket = async (req, res) => {
    try {
        const token = req.shiprocketToken;
        const response = await fetch('https://apiv2.shiprocket.in/v1/external/auth/logout', {
            method: 'POST',
            headers: {
                'Authorization': token
            }
        });
        const data = await response.json();
        console.log("[DEBUG] Logout from Shiprocket successful", data);
        return res.status(200).json({ message: 'Logout successful', data });
    } catch (error) {
        console.error('Error logging out from Shiprocket:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}