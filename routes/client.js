// routes/client.js
import { findClientById, updateClient, addCallToHistory } from "../crud.js";

/**
 * Client routes - all require client authentication
 * These routes are prefixed with /secure in the main app
 */
export default async function clientRoutes(fastify, options) {
  // Get authenticated client data
  fastify.get("/client", async (request, reply) => {
    try {
      const client = await findClientById(request.clientId);

      if (!client) {
        return reply.code(404).send({
          error: "Client not found",
        });
      }

      // Remove sensitive information
      const safeClient = {
        clientId: client.clientId,
        status: client.status,
        agentId: client.agentId,
        twilioPhoneNumber: client.twilioPhoneNumber,
        clientMeta: client.clientMeta,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        callHistory: client.callHistory,
      };

      reply.send(safeClient);
    } catch (error) {
      fastify.log.error("Error fetching client:", error);
      reply.code(500).send({
        error: "Failed to fetch client",
        details: error.message,
      });
    }
  });

  // Update authenticated client
  fastify.put("/client", async (request, reply) => {
    try {
      const updateData = request.body;

      // Prevent changing the clientId or clientSecret
      if (updateData.clientId) delete updateData.clientId;
      if (updateData.clientSecret) delete updateData.clientSecret;

      // Only allow updating certain fields
      const allowedUpdates = {};

      // Allow updating client metadata
      if (updateData.clientMeta) {
        allowedUpdates.clientMeta = updateData.clientMeta;
      }

      const updatedClient = await updateClient(
        request.clientId,
        allowedUpdates
      );

      if (!updatedClient) {
        return reply.code(404).send({
          error: "Client not found",
        });
      }

      reply.send({
        message: "Client updated successfully",
        client: {
          clientId: updatedClient.clientId,
          status: updatedClient.status,
          updatedAt: updatedClient.updatedAt,
        },
      });
    } catch (error) {
      fastify.log.error("Error updating client:", error);
      reply.code(500).send({
        error: "Failed to update client",
        details: error.message,
      });
    }
  });

  // Get call history for authenticated client
  fastify.get("/calls", async (request, reply) => {
    try {
      const client = await findClientById(request.clientId);

      if (!client) {
        return reply.code(404).send({
          error: "Client not found",
        });
      }

      // Add query parameter support for filtering calls
      const { limit, offset, status } = request.query;

      let callHistory = client.callHistory || [];

      // Filter by status if requested
      if (status) {
        callHistory = callHistory.filter(
          (call) => call.callData && call.callData.status === status
        );
      }

      // Apply pagination if requested
      if (offset || limit) {
        const startIndex = parseInt(offset) || 0;
        const endIndex = limit ? startIndex + parseInt(limit) : undefined;
        callHistory = callHistory.slice(startIndex, endIndex);
      }

      reply.send({
        clientId: client.clientId,
        total: client.callHistory ? client.callHistory.length : 0,
        filtered: callHistory.length,
        callHistory: callHistory,
      });
    } catch (error) {
      fastify.log.error("Error fetching call history:", error);
      reply.code(500).send({
        error: "Failed to fetch call history",
        details: error.message,
      });
    }
  });

  // Get specific call details
  fastify.get("/calls/:callId", async (request, reply) => {
    try {
      const { callId } = request.params;
      const client = await findClientById(request.clientId);

      if (!client) {
        return reply.code(404).send({
          error: "Client not found",
        });
      }

      // Find the specific call
      const call = client.callHistory.find((call) => call.callId === callId);

      if (!call) {
        return reply.code(404).send({
          error: "Call not found",
        });
      }

      reply.send(call);
    } catch (error) {
      fastify.log.error("Error fetching call details:", error);
      reply.code(500).send({
        error: "Failed to fetch call details",
        details: error.message,
      });
    }
  });

  // Make an outbound call using authenticated client's configuration TODO
  fastify.post("/make-call", async (request, reply) => {
    const { phone } = request.body;

    // Generate a request ID for tracking
    const requestId =
      Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    fastify.log.info(`[${requestId}] Secure outbound call request received`);

    // Validate phone number
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phone) {
      fastify.log.warn(
        `[${requestId}] Error: Destination phone number missing`
      );
      return reply.code(400).send({
        error: "Destination phone number is required",
        requestId,
      });
    }

    if (!phoneRegex.test(phone)) {
      fastify.log.warn(
        `[${requestId}] Error: Invalid destination phone format: ${phone}`
      );
      return reply.code(400).send({
        error: "Phone number must be in E.164 format (e.g., +12125551234)",
        requestId,
      });
    }

    try {
      // Find the client in the database using the authenticated clientId
      const client = await findClientById(request.clientId);

      if (!client) {
        fastify.log.warn(
          `[${requestId}] Error: Client not found with ID: ${request.clientId}`
        );
        return reply.code(404).send({
          error: "Client not found",
          requestId,
        });
      }

      // Check if client is active
      if (client.status !== "Active") {
        fastify.log.warn(
          `[${requestId}] Error: Client is not active: ${client.status}`
        );
        return reply.code(403).send({
          error: `Client is not active (status: ${client.status})`,
          requestId,
        });
      }

      // Access the Twilio client from the parent scope
      const twilioClient = fastify.twilioClient;

      if (!twilioClient) {
        fastify.log.error(`[${requestId}] Twilio client not available`);
        return reply.code(500).send({
          error: "Twilio service unavailable",
          requestId,
        });
      }

      // Build the webhook URL with all dynamic variables
      let webhookUrl = `https://${request.headers.host}/outbound-call-twiml?`;

      // Add parameters to the URL
      const params = {
        first_message: client.clientMeta.fullName.split(" ")[0] + "?",
        clientId: client.clientId,
        agentId: client.agentId,
        full_name: client.clientMeta.fullName,
        business_name: client.clientMeta.businessName,
        city: client.clientMeta.city,
        job_title: client.clientMeta.jobTitle,
        email: client.clientMeta.email,
        phone,
        requestId,
      };

      // Convert parameters to URL query string
      const queryParams = [];
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          queryParams.push(
            `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
          );
        }
      }

      webhookUrl += queryParams.join("&");

      fastify.log.info(
        `[${requestId}] Using webhook URL with dynamic variables`
      );

      // Create the call
      const call = await twilioClient.calls.create({
        url: webhookUrl,
        to: phone,
        from: client.twilioPhoneNumber,
        statusCallback: `https://${request.headers.host}/call-status?requestId=${requestId}&clientId=${client.clientId}`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: "POST",
      });

      fastify.log.info(
        `[${requestId}] Outbound call initiated successfully: ${call.sid}`
      );

      // Create call data object
      const callData = {
        callData: {
          callSid: call.sid,
          requestId,
          phone,
          from: client.twilioPhoneNumber,
          agentId: client.agentId,
          startTime: new Date(),
          status: "initiated",
          callCount: 1,
        },
        callDetails: {
          callOutcome: "",
          callSummary: "",
          callTranscript: "",
        },
      };

      // Add call to client's call history in the database
      await addCallToHistory(client.clientId, callData);

      reply.send({
        success: true,
        message: "Call initiated successfully",
        callSid: call.sid,
        requestId,
      });
    } catch (error) {
      fastify.log.error(`[${requestId}] Error initiating call:`, error);

      // Handle Twilio errors
      let statusCode = 500;
      let errorMessage = "Failed to initiate call";
      let errorDetails = error.message;
      let resolution = null;

      if (error.code) {
        switch (error.code) {
          case 21211:
            statusCode = 400;
            errorMessage = "Invalid 'To' phone number";
            resolution = "Check the phone number format and try again";
            break;
          case 21214:
            statusCode = 400;
            errorMessage = "Invalid 'From' phone number";
            resolution =
              "Verify the Twilio phone number is active and properly configured";
            break;
          case 20404:
            statusCode = 404;
            errorMessage = "Twilio account not found or unauthorized";
            resolution = "Check your Twilio account credentials";
            break;
          case 20003:
            statusCode = 403;
            errorMessage = "Permission denied";
            resolution =
              "Verify that your Twilio account has voice capabilities enabled";
            break;
          case 13223:
            statusCode = 402;
            errorMessage = "Insufficient funds";
            resolution = "Add funds to your Twilio account";
            break;
          case 13224:
            statusCode = 429;
            errorMessage = "Rate limit exceeded";
            resolution = "Try again after some time";
            break;
        }
      }

      reply.code(statusCode).send({
        error: errorMessage,
        details: errorDetails,
        resolution,
        requestId,
      });
    }
  });

  // Get call statistics for authenticated client TODO
  fastify.get("/call-stats", async (request, reply) => {
    try {
      const client = await findClientById(request.clientId);

      if (!client) {
        return reply.code(404).send({
          error: "Client not found",
        });
      }

      // Calculate call statistics
      const callHistory = client.callHistory || [];

      const stats = {
        totalCalls: callHistory.length,
        callsByStatus: {
          initiated: 0,
          "in-progress": 0,
          completed: 0,
          failed: 0,
          "no-answer": 0,
        },
        callsByOutcome: {
          interested: 0,
          "not-interested": 0,
          callback: 0,
          unavailable: 0,
          unknown: 0,
        },
        callsBySentiment: {
          positive: 0,
          neutral: 0,
          negative: 0,
          unknown: 0,
        },
        totalDuration: 0,
        averageDuration: 0,
      };

      // Calculate stats
      callHistory.forEach((call) => {
        // Status stats
        if (call.callData && call.callData.status) {
          const status = call.callData.status;
          if (stats.callsByStatus[status] !== undefined) {
            stats.callsByStatus[status]++;
          }
        }

        // Outcome stats
        if (call.callDetails && call.callDetails.callOutcome) {
          const outcome = call.callDetails.callOutcome;
          if (stats.callsByOutcome[outcome] !== undefined) {
            stats.callsByOutcome[outcome]++;
          }
        } else {
          stats.callsByOutcome.unknown++;
        }

        // Sentiment stats
        if (call.callDetails && call.callDetails.callSentiment) {
          const sentiment = call.callDetails.callSentiment;
          if (stats.callsBySentiment[sentiment] !== undefined) {
            stats.callsBySentiment[sentiment]++;
          }
        } else {
          stats.callsBySentiment.unknown++;
        }

        // Duration stats
        if (call.callData && call.callData.duration) {
          stats.totalDuration += call.callData.duration;
        }
      });

      // Calculate average duration
      if (stats.totalCalls > 0) {
        stats.averageDuration = Math.round(
          stats.totalDuration / stats.totalCalls
        );
      }

      reply.send({
        clientId: client.clientId,
        stats,
      });
    } catch (error) {
      fastify.log.error("Error calculating call statistics:", error);
      reply.code(500).send({
        error: "Failed to calculate call statistics",
        details: error.message,
      });
    }
  });
}
