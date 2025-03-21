import fetch from "node-fetch";
import Client from "../client.js";

/**
 * Checks if a token is expired or about to expire
 * @param {Date} tokenExpiresAt - Token expiration date
 * @param {number} [bufferTimeMS=300000] - Buffer time in milliseconds (default: 5 minutes)
 * @returns {boolean} - True if token is valid, false if expired or about to expire
 */
function isTokenValid(tokenExpiresAt, bufferTimeMS = 5 * 60 * 1000) {
  if (!tokenExpiresAt) return false;

  const now = new Date();
  const expiryDate = new Date(tokenExpiresAt);

  return expiryDate > new Date(now.getTime() + bufferTimeMS);
}

/**
 * Checks and refreshes a GHL access token if needed
 * @param {string} clientId - Client ID in our system
 * @returns {Promise<{accessToken: string, locationId: string}>} - Valid access token and location ID
 */
async function checkAndRefreshToken(clientId) {
  let client = await Client.findOne({ clientId });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  if (!client.refreshToken) {
    throw new Error(`No refresh token available for client: ${clientId}`);
  }

  // Check if token is expired or near expiry
  if (!isTokenValid(client.tokenExpiresAt)) {
    console.log(
      `Token expired or about to expire for client ${clientId}, refreshing...`
    );
    await refreshGhlToken(clientId);
    // Reload client to get the updated token
    client = await Client.findOne({ clientId });
  }

  return {
    accessToken: client.accessToken || client.clientSecret, // Handle both storage locations
    locationId: clientId, // In your system, the clientId is the GHL location ID
  };
}

/**
 * Refreshes a GHL access token using the refresh token
 * @param {string} clientId - Client ID in our system
 * @returns {Promise<string>} - New access token
 */
async function refreshGhlToken(clientId) {
  const client = await Client.findOne({ clientId });
  if (!client || !client.refreshToken) {
    throw new Error("Client or refresh token not found");
  }

  try {
    console.log(`Refreshing GHL token for client ${clientId}`);

    const response = await fetch(
      "https://services.leadconnectorhq.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: client.refreshToken,
          client_id: process.env.GHL_CLIENT_ID,
          client_secret: process.env.GHL_CLIENT_SECRET,
          redirect_uri: process.env.GHL_REDIRECT_URI,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error(`Token refresh failed for client ${clientId}:`, data);
      throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
    }

    const { access_token, refresh_token, expires_in } = data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    // Update the client document - support both storage methods
    const updateData = {
      accessToken: access_token,
      tokenExpiresAt: expiresAt,
    };

    // Only update refresh token if a new one was provided
    if (refresh_token) {
      updateData.refreshToken = refresh_token;
    }

    await Client.findOneAndUpdate(
      { clientId },
      { $set: updateData },
      { new: true }
    );

    console.log(`GHL token refreshed successfully for client ${clientId}`);
    return access_token;
  } catch (error) {
    console.error(`Error refreshing GHL token for client ${clientId}:`, error);
    throw error;
  }
}

/**
 * Makes an authenticated API call to the GHL API
 * @param {string} clientId - Client ID in our system
 * @param {string} endpoint - API endpoint path
 * @param {string} method - HTTP method
 * @param {Object} body - Request body (for POST/PUT)
 * @returns {Promise<Object>} - API response
 */
async function makeGhlApiCall(clientId, endpoint, method = "GET", body = null) {
  const { accessToken } = await checkAndRefreshToken(clientId);

  const url = `https://services.leadconnectorhq.com${endpoint}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `GHL API call failed: ${response.status} ${response.statusText}`,
      errorText
    );
    throw new Error(`GHL API call failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search for a contact in GoHighLevel by phone number
 * @param {string} accessToken - GHL access token (will be validated)
 * @param {string} phoneNumber - Phone number to search
 * @param {string} locationId - GHL location ID (optional, defaults to client ID)
 * @param {number} pageLimit - Maximum number of results per page
 * @returns {Promise<Object|null>} - First matching contact or null if not found
 */
async function searchGhlContactByPhone(
  accessToken,
  phoneNumber,
  locationId = null,
  pageLimit = 10
) {
  try {
    // If locationId is not provided, we'll assume it's stored along with the token
    // We need to extract the client ID from the database based on the access token
    if (!locationId) {
      // Find the client with this access token
      const client = await Client.findOne({
        $or: [{ accessToken: accessToken }, { clientSecret: accessToken }],
      });

      if (!client) {
        console.error("No client found with the provided access token");
        return null;
      }

      locationId = client.clientId;
    }

    // Validate token if needed - if locationId is provided, we can check
    if (locationId) {
      // This is a clientId in our system, so we can check and refresh the token
      const { accessToken: validToken } = await checkAndRefreshToken(
        locationId
      );
      accessToken = validToken; // Use the valid token
    }

    if (!accessToken || !phoneNumber) {
      console.error("Missing required parameters for GHL contact search");
      return null;
    }

    // Normalize phone number format - remove any non-digit characters
    const normalizedPhone = phoneNumber.replace(/\D/g, "");

    // Construct request body according to API specifications
    const requestBody = {
      locationId: locationId,
      page: 1,
      pageLimit: pageLimit,
      filters: [
        {
          field: "phone",
          operator: "contains",
          value: normalizedPhone,
        },
      ],
      sort: [
        {
          field: "dateAdded",
          direction: "desc",
        },
      ],
    };

    // Make the API request
    const response = await fetch(
      "https://services.gohighlevel.com/v2/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      console.error(`GHL API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`Error details: ${errorText}`);
      return null;
    }

    const data = await response.json();

    // Return first matching contact or null
    return data.contacts && data.contacts.length > 0 ? data.contacts[0] : null;
  } catch (error) {
    console.error("Error searching GHL contact:", error);
    return null;
  }
}

export {
  refreshGhlToken,
  makeGhlApiCall,
  searchGhlContactByPhone,
  checkAndRefreshToken,
  isTokenValid,
};
