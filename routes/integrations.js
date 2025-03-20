import fetch from "node-fetch";
import Client from "../client.js"; // Direct import of the Mongoose model

async function integrationsRoutes(fastify, options) {
  // Endpoint to handle GHL OAuth callback
  fastify.get("/callback", async (request, reply) => {
    const { code, error } = request.query;

    // Check for errors from GHL
    if (error) {
      fastify.log.error(`GHL OAuth error: ${error}`);
      return reply
        .status(400)
        .send({ error: "Authorization failed", details: error });
    }

    if (!code) {
      return reply
        .status(400)
        .send({ error: "No authorization code provided" });
    }

    try {
      // Exchange the authorization code for tokens
      const tokenResponse = await fetch(
        "https://api.gohighlevel.com/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.GHL_CLIENT_ID, // Your app’s Client ID from GHL Marketplace
            client_secret: process.env.GHL_CLIENT_SECRET, // Your app’s Client Secret from GHL Marketplace
            code: code,
            redirect_uri: process.env.GHL_REDIRECT_URI, // e.g., https://api.v1.affinitydesign.ca/integrations/callback
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        fastify.log.error(
          `GHL token exchange failed: ${JSON.stringify(tokenData)}`
        );
        return reply
          .status(400)
          .send({ error: "Failed to obtain tokens", details: tokenData });
      }

      const { access_token, refresh_token, expires_in } = tokenData;

      // Calculate token expiration time
      const expiresAt = new Date(Date.now() + expires_in * 1000); // Convert seconds to milliseconds

      // Determine the clientId (GHL sub-account ID)
      // For now, assume it’s passed as a query param (e.g., ?clientId=ghl-subaccount-id)
      // You may need to adjust this based on how you associate GHL sub-accounts with your clients
      const clientId = request.query.clientId;
      if (!clientId) {
        fastify.log.error("No clientId provided in callback");
        return reply
          .status(400)
          .send({ error: "clientId query parameter is required" });
      }

      // Update or create the client document in MongoDB
      const updatedClient = await Client.findOneAndUpdate(
        { clientId }, // Match by GHL sub-account ID
        {
          clientSecret: access_token, // GHL access token
          refreshToken: refresh_token, // GHL refresh token
          tokenExpiresAt: expiresAt, // When the access token expires
          // Only update these fields; don’t overwrite others like clientMeta if they exist
        },
        {
          upsert: true, // Create a new document if it doesn’t exist
          new: true, // Return the updated document
          setDefaultsOnInsert: true, // Apply schema defaults if creating a new document
        }
      );

      fastify.log.info(`GHL tokens stored for client ${clientId}`);
      return reply.send({
        message: "GHL integration successful",
        clientId: clientId,
        accessToken: access_token, // Optional: return for immediate use or debugging
      });
    } catch (err) {
      fastify.log.error(`Error in GHL callback: ${err.message}`);
      return reply
        .status(500)
        .send({ error: "Internal server error", details: err.message });
    }
  });
}

export default integrationsRoutes;
