import fetch from "node-fetch";
import Client from "./client.js";

async function refreshGhlToken(clientId) {
  const client = await Client.findOne({ clientId });
  if (!client || !client.refreshToken) {
    throw new Error("Client or refresh token not found");
  }

  try {
    const response = await fetch("https://api.gohighlevel.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.GHL_CLIENT_ID, // Your app’s client ID from GHL
        client_secret: process.env.GHL_CLIENT_SECRET, // Your app’s client secret from GHL
        refresh_token: client.refreshToken,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
    }

    const { access_token, refresh_token, expires_in } = data;
    const expiresAt = new Date(Date.now() + expires_in * 1000); // Convert seconds to milliseconds

    // Update the client document
    client.clientSecret = access_token;
    client.refreshToken = refresh_token || client.refreshToken; // Use new refresh token if provided
    client.tokenExpiresAt = expiresAt;
    await client.save();

    return access_token;
  } catch (error) {
    console.error(`Error refreshing GHL token for client ${clientId}:`, error);
    throw error;
  }
}

async function makeGhlApiCall(clientId, endpoint, method = "GET", body = null) {
  let client = await Client.findOne({ clientId });
  if (!client) throw new Error("Client not found");

  // Check if token is expired or near expiry (within 5 minutes)
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
  if (
    !client.tokenExpiresAt ||
    new Date(client.tokenExpiresAt) < new Date(now.getTime() + bufferTime)
  ) {
    await refreshGhlToken(clientId);
    client = await Client.findOne({ clientId }); // Reload updated client
  }

  const url = `https://api.gohighlevel.com${endpoint}`;
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${client.clientSecret}`, // Use access token
      "Content-Type": "application/json",
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`GHL API call failed: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Search for a contact in GoHighLevel by phone number
 * @param {string} accessToken - GHL access token
 * @param {string} phoneNumber - Phone number to search for
 * @returns {Promise<Object|null>} - Contact information or null if not found
 */
async function searchGhlContactByPhone(accessToken, phoneNumber) {
  if (!accessToken || !phoneNumber) {
    console.error("Missing required parameters for GHL contact search");
    return null;
  }

  try {
    // Prepare the request according to GHL API specifications
    const response = await fetch(
      "https://services.gohighlevel.com/v2/contacts/search",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Version: "2021-07-28",
        },
        body: JSON.stringify({
          query: phoneNumber, // Search by phone number
          limit: 1, // Only need first match
        }),
      }
    );

    if (!response.ok) {
      console.error(`GHL API error: ${response.status} ${response.statusText}`);
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

// Add export to existing export
module.exports = { refreshGhlToken, makeGhlApiCall, searchGhlContactByPhone };
