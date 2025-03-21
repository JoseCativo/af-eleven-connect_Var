import fetch from "node-fetch";
import Client from "../client.js";

async function integrationsRoutes(fastify, options) {
  // Endpoint to handle GHL OAuth callback
  fastify.get("/callback", async (request, reply) => {
    const { code, error, state } = request.query;

    // Check for errors from GHL
    if (error) {
      fastify.log.error(`GHL OAuth error: ${error}`);
      return reply
        .code(400)
        .send({ error: "Authorization failed", details: error });
    }

    if (!code) {
      return reply.code(400).send({ error: "No authorization code provided" });
    }

    try {
      // Exchange the authorization code for tokens
      const tokenResponse = await fetch(
        "https://services.leadconnectorhq.com/oauth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: process.env.GHL_CLIENT_ID,
            client_secret: process.env.GHL_CLIENT_SECRET,
            code: code,
            redirect_uri: process.env.GHL_REDIRECT_URI,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        fastify.log.error(
          `GHL token exchange failed: ${JSON.stringify(tokenData)}`
        );
        return reply
          .code(400)
          .send({ error: "Failed to obtain tokens", details: tokenData });
      }

      const { access_token, refresh_token, expires_in } = tokenData;

      // Calculate token expiration time
      const expiresAt = new Date(Date.now() + expires_in * 1000);

      // Use state parameter as clientId
      const clientId = state || request.query.clientId;
      if (!clientId) {
        fastify.log.error("No client identifier provided in callback");
        return reply
          .code(400)
          .send({ error: "Client identifier (state parameter) is required" });
      }

      // Check if client exists
      const existingClient = await Client.findOne({ clientId });

      if (!existingClient) {
        fastify.log.error(`Client not found with ID: ${clientId}`);
        return reply.code(404).send({
          error: "Client not found",
          details: `No client found with ID: ${clientId}`,
          recommendation: "Verify the client ID is correct",
        });
      }

      // Update the client document in MongoDB with explicit fields
      const updatedClient = await Client.findOneAndUpdate(
        { clientId },
        {
          // Store tokens in the correct fields
          $set: {
            accessToken: access_token,
            refreshToken: refresh_token,
            tokenExpiresAt: expiresAt,
          },
        },
        {
          new: true, // Return the updated document
        }
      );

      fastify.log.info(`GHL tokens stored for client ${clientId}`);

      // Log token details for verification (excluding sensitive parts)
      fastify.log.debug(
        `Token details: accessToken present: ${!!updatedClient.accessToken}, refreshToken present: ${!!updatedClient.refreshToken}, expires: ${
          updatedClient.tokenExpiresAt
        }`
      );

      return reply.send({
        message: "GHL integration successful",
        clientId: clientId,
        integration: {
          status: "success",
          expiresAt: expiresAt,
          hasAccessToken: !!updatedClient.accessToken,
          hasRefreshToken: !!updatedClient.refreshToken,
        },
      });
    } catch (err) {
      fastify.log.error(`Error in GHL callback: ${err.message}`);
      return reply
        .code(500)
        .send({ error: "Internal server error", details: err.message });
    }
  });

  // Add an endpoint to generate the authorization URL
  fastify.get("/authorize/:clientId", async (request, reply) => {
    const { clientId } = request.params;

    if (!clientId) {
      return reply.code(400).send({ error: "Client ID is required" });
    }

    // Validate that the client exists
    const client = await Client.findOne({ clientId });

    if (!client) {
      fastify.log.warn(`Client not found with ID: ${clientId}`);
      return reply.code(404).send({
        error: "Client not found",
        details: `No client found with ID: ${clientId}`,
      });
    }

    const authUrl = new URL(
      "https://marketplace.leadconnectorhq.com/oauth/chooselocation"
    );
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("client_id", process.env.GHL_CLIENT_ID);
    authUrl.searchParams.append("redirect_uri", process.env.GHL_REDIRECT_URI);
    authUrl.searchParams.append(
      "scope",
      "contacts.readonly contacts.write calendars/resources.write calendars/resources.readonly calendars/groups.write calendars/groups.readonly calendars/events.write calendars/events.readonly calendars.write calendars.readonly companies.readonly"
    );
    authUrl.searchParams.append("state", clientId);

    reply.send({
      authorizationUrl: authUrl.toString(),
      clientId: clientId,
      currentIntegrationStatus: {
        hasAccessToken: !!client.accessToken,
        hasRefreshToken: !!client.refreshToken,
        tokenExpiresAt: client.tokenExpiresAt,
      },
    });
  });
}

export default integrationsRoutes;
