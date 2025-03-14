import Fastify from "fastify";
import WebSocket from "ws";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import Twilio from "twilio";

// Load environment variables from .env file for default values
dotenv.config();

// Initialize config store for dynamic parameters
const configStore = {
  // Default values from environment variables
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBERS: process.env.TWILIO_PHONE_NUMBER
    ? [process.env.TWILIO_PHONE_NUMBER]
    : [],
  ELEVENLABS_AGENT_IDS: process.env.ELEVENLABS_AGENT_ID
    ? [process.env.ELEVENLABS_AGENT_ID]
    : [],

  // Active connections
  activeConnections: new Map(), // Map of streamSid to connection info
};

// Validate required environment variables
if (!configStore.TWILIO_ACCOUNT_SID || !configStore.TWILIO_AUTH_TOKEN) {
  console.error("Missing required Twilio credentials in environment variables");
  process.exit(1);
}

// Initialize Fastify server
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Initialize Twilio client
let twilioClient = Twilio(
  configStore.TWILIO_ACCOUNT_SID,
  configStore.TWILIO_AUTH_TOKEN
);

const PORT = process.env.PORT || 8000;

// Root route for health check
fastify.get("/", async (_, reply) => {
  reply.send({ message: "Server is running" });
});

// API to configure Twilio credentials
fastify.post("/config/twilio-credentials", async (request, reply) => {
  const { accountSid, authToken } = request.body;

  if (!accountSid || !authToken) {
    return reply.status(400).send({
      error: "Both accountSid and authToken are required",
    });
  }

  try {
    // Test the credentials by creating a new client
    const testClient = Twilio(accountSid, authToken);
    await testClient.api.accounts(accountSid).fetch();

    // If successful, update the config
    configStore.TWILIO_ACCOUNT_SID = accountSid;
    configStore.TWILIO_AUTH_TOKEN = authToken;

    // Update the Twilio client
    twilioClient = testClient;

    reply.send({
      success: true,
      message: "Twilio credentials updated successfully",
    });
  } catch (error) {
    console.error("Invalid Twilio credentials:", error);
    reply.status(400).send({
      error: "Invalid Twilio credentials",
      details: error.message,
    });
  }
});

// API to add a Twilio phone number
fastify.post("/config/twilio-phone-numbers", async (request, reply) => {
  const { phoneNumber } = request.body;

  if (!phoneNumber) {
    return reply.status(400).send({
      error: "Phone number is required",
    });
  }

  try {
    // Verify the phone number belongs to the account
    const numbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber,
    });

    if (numbers.length === 0) {
      return reply.status(400).send({
        error: "Phone number not found in your Twilio account",
      });
    }

    // Add the phone number if it doesn't already exist
    if (!configStore.TWILIO_PHONE_NUMBERS.includes(phoneNumber)) {
      configStore.TWILIO_PHONE_NUMBERS.push(phoneNumber);
    }

    reply.send({
      success: true,
      phoneNumbers: configStore.TWILIO_PHONE_NUMBERS,
    });
  } catch (error) {
    reply.status(500).send({
      error: "Failed to add phone number",
      details: error.message,
    });
  }
});

// API to remove a Twilio phone number
fastify.delete(
  "/config/twilio-phone-numbers/:phoneNumber",
  async (request, reply) => {
    const { phoneNumber } = request.params;

    const index = configStore.TWILIO_PHONE_NUMBERS.indexOf(phoneNumber);
    if (index > -1) {
      configStore.TWILIO_PHONE_NUMBERS.splice(index, 1);
      reply.send({
        success: true,
        phoneNumbers: configStore.TWILIO_PHONE_NUMBERS,
      });
    } else {
      reply.status(404).send({
        error: "Phone number not found",
      });
    }
  }
);

// API to add an ElevenLabs agent
fastify.post("/config/elevenlabs-agents", async (request, reply) => {
  const { agentId, description } = request.body;

  if (!agentId) {
    return reply.status(400).send({
      error: "Agent ID is required",
    });
  }

  try {
    // We'd ideally validate the agent ID with ElevenLabs API
    // For now, just add it to our config
    if (!configStore.ELEVENLABS_AGENT_IDS.includes(agentId)) {
      configStore.ELEVENLABS_AGENT_IDS.push(agentId);
    }

    reply.send({
      success: true,
      agentIds: configStore.ELEVENLABS_AGENT_IDS,
    });
  } catch (error) {
    reply.status(500).send({
      error: "Failed to add agent ID",
      details: error.message,
    });
  }
});

// API to remove an ElevenLabs agent
fastify.delete("/config/elevenlabs-agents/:agentId", async (request, reply) => {
  const { agentId } = request.params;

  const index = configStore.ELEVENLABS_AGENT_IDS.indexOf(agentId);
  if (index > -1) {
    configStore.ELEVENLABS_AGENT_IDS.splice(index, 1);
    reply.send({
      success: true,
      agentIds: configStore.ELEVENLABS_AGENT_IDS,
    });
  } else {
    reply.status(404).send({
      error: "Agent ID not found",
    });
  }
});

// API to get all configuration
fastify.get("/config", async (request, reply) => {
  reply.send({
    twilioPhoneNumbers: configStore.TWILIO_PHONE_NUMBERS,
    elevenLabsAgentIds: configStore.ELEVENLABS_AGENT_IDS,
    activeConnections: Array.from(configStore.activeConnections.keys()).length,
  });
});

// Route to handle incoming calls from Twilio
fastify.all("/incoming-call-eleven", async (request, reply) => {
  // Check if we have the configuration
  if (configStore.ELEVENLABS_AGENT_IDS.length === 0) {
    return reply.status(500).send("No ElevenLabs agents configured");
  }

  // Extract the agent ID from the request or use the first one
  const agentId = request.query.agentId || configStore.ELEVENLABS_AGENT_IDS[0];

  // Generate TwiML response to connect the call to a WebSocket stream
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${request.headers.host}/media-stream?agentId=${agentId}" />
      </Connect>
    </Response>`;

  reply.type("text/xml").send(twimlResponse);
});

// WebSocket route for handling media streams from Twilio
fastify.register(async (fastifyInstance) => {
  fastifyInstance.get(
    "/media-stream",
    { websocket: true },
    (connection, req) => {
      // Parse the agent ID from the query parameters
      const url = new URL(req.url, `http://${req.headers.host}`);
      const agentId =
        url.searchParams.get("agentId") || configStore.ELEVENLABS_AGENT_IDS[0];

      if (!configStore.ELEVENLABS_AGENT_IDS.includes(agentId)) {
        console.error(`[Server] Invalid agent ID: ${agentId}`);
        connection.socket.close(1008, "Invalid agent ID");
        return;
      }

      console.info(
        `[Server] Twilio connected to media stream using agent: ${agentId}`
      );

      let streamSid = null;

      // Connect to ElevenLabs Conversational AI WebSocket
      const elevenLabsWs = new WebSocket(
        `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`
      );

      elevenLabsWs.on("open", () => {
        console.log(
          `[II] Connected to Conversational AI with agent: ${agentId}`
        );
      });

      elevenLabsWs.on("message", (data) => {
        try {
          const message = JSON.parse(data);
          handleElevenLabsMessage(message, connection);
        } catch (error) {
          console.error("[II] Error parsing message:", error);
        }
      });

      elevenLabsWs.on("error", (error) => {
        console.error("[II] WebSocket error:", error);
      });

      elevenLabsWs.on("close", () => {
        console.log("[II] Disconnected from ElevenLabs.");
        // Remove from active connections if present
        if (streamSid && configStore.activeConnections.has(streamSid)) {
          configStore.activeConnections.delete(streamSid);
        }
      });

      const handleElevenLabsMessage = (message, connection) => {
        switch (message.type) {
          case "conversation_initiation_metadata":
            console.info("[II] Received conversation initiation metadata.");
            break;
          case "audio":
            if (message.audio_event?.audio_base_64) {
              const audioData = {
                event: "media",
                streamSid,
                media: {
                  payload: message.audio_event.audio_base_64,
                },
              };
              connection.send(JSON.stringify(audioData));
            }
            break;
          case "interruption":
            connection.send(JSON.stringify({ event: "clear", streamSid }));
            break;
          case "ping":
            if (message.ping_event?.event_id) {
              const pongResponse = {
                type: "pong",
                event_id: message.ping_event.event_id,
              };
              elevenLabsWs.send(JSON.stringify(pongResponse));
            }
            break;
        }
      };

      connection.on("message", async (message) => {
        try {
          const data = JSON.parse(message);
          switch (data.event) {
            case "start":
              streamSid = data.start.streamSid;
              console.log(`[Twilio] Stream started with ID: ${streamSid}`);

              // Add to active connections
              configStore.activeConnections.set(streamSid, {
                agentId,
                startTime: new Date(),
                callSid: data.start.callSid,
              });
              break;
            case "media":
              if (elevenLabsWs.readyState === WebSocket.OPEN) {
                const audioMessage = {
                  user_audio_chunk: Buffer.from(
                    data.media.payload,
                    "base64"
                  ).toString("base64"),
                };
                elevenLabsWs.send(JSON.stringify(audioMessage));
              }
              break;
            case "stop":
              if (streamSid && configStore.activeConnections.has(streamSid)) {
                configStore.activeConnections.delete(streamSid);
              }
              elevenLabsWs.close();
              break;
            default:
              console.log(`[Twilio] Received unhandled event: ${data.event}`);
          }
        } catch (error) {
          console.error("[Twilio] Error processing message:", error);
        }
      });

      connection.on("close", () => {
        if (streamSid && configStore.activeConnections.has(streamSid)) {
          configStore.activeConnections.delete(streamSid);
        }
        elevenLabsWs.close();
        console.log("[Twilio] Client disconnected");
      });

      connection.on("error", (error) => {
        console.error("[Twilio] WebSocket error:", error);
        if (streamSid && configStore.activeConnections.has(streamSid)) {
          configStore.activeConnections.delete(streamSid);
        }
        elevenLabsWs.close();
      });
    }
  );
});

// Route to initiate an outbound call
fastify.post("/make-outbound-call", async (request, reply) => {
  const { to, phoneNumber, agentId } = request.body;
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  console.log(`[${requestId}] Outbound call request received`);

  // Input validation
  if (!to) {
    console.log(`[${requestId}] Error: Destination phone number missing`);
    return reply.status(400).send({
      error: "Destination phone number is required",
      requestId,
    });
  }

  // Validate phone number format (basic E.164 check)
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  if (!phoneRegex.test(to)) {
    console.log(
      `[${requestId}] Error: Invalid destination phone format: ${to}`
    );
    return reply.status(400).send({
      error: "Phone number must be in E.164 format (e.g., +12125551234)",
      requestId,
    });
  }

  // Configuration validation
  if (configStore.TWILIO_PHONE_NUMBERS.length === 0) {
    console.log(`[${requestId}] Error: No Twilio phone numbers configured`);
    return reply.status(500).send({
      error: "No Twilio phone numbers have been configured",
      requestId,
      resolution:
        "Add a phone number using the /config/twilio-phone-numbers endpoint",
    });
  }

  if (configStore.ELEVENLABS_AGENT_IDS.length === 0) {
    console.log(`[${requestId}] Error: No ElevenLabs agents configured`);
    return reply.status(500).send({
      error: "No ElevenLabs agents have been configured",
      requestId,
      resolution: "Add an agent using the /config/elevenlabs-agents endpoint",
    });
  }

  // Use provided phone number or default to first in the list
  const fromNumber = phoneNumber || configStore.TWILIO_PHONE_NUMBERS[0];

  // Use provided agent ID or default to first in the list
  const selectedAgentId = agentId || configStore.ELEVENLABS_AGENT_IDS[0];

  // Verify the provided phone number is in our configured list
  if (phoneNumber && !configStore.TWILIO_PHONE_NUMBERS.includes(phoneNumber)) {
    console.log(
      `[${requestId}] Error: Requested phone number not found: ${phoneNumber}`
    );
    return reply.status(400).send({
      error: "The requested phone number is not configured",
      requestId,
      availableNumbers: configStore.TWILIO_PHONE_NUMBERS,
    });
  }

  // Verify the provided agent ID is in our configured list
  if (agentId && !configStore.ELEVENLABS_AGENT_IDS.includes(agentId)) {
    console.log(
      `[${requestId}] Error: Requested agent ID not found: ${agentId}`
    );
    return reply.status(400).send({
      error: "The requested agent ID is not configured",
      requestId,
      availableAgents: configStore.ELEVENLABS_AGENT_IDS,
    });
  }

  try {
    console.log(
      `[${requestId}] Initiating call from ${fromNumber} to ${to} using agent ${selectedAgentId}`
    );

    // Build the webhook URL with the agent ID as a query parameter
    const webhookUrl = `https://${request.headers.host}/incoming-call-eleven?agentId=${selectedAgentId}`;

    // Check Twilio client validity
    if (!twilioClient) {
      console.error(`[${requestId}] Twilio client is not initialized`);
      return reply.status(500).send({
        error: "Twilio client is not properly configured",
        requestId,
        resolution:
          "Update Twilio credentials using the /config/twilio-credentials endpoint",
      });
    }

    // Create the call with a timeout
    const callPromise = twilioClient.calls.create({
      url: webhookUrl,
      to: to,
      from: fromNumber,
      statusCallback: `https://${request.headers.host}/call-status?requestId=${requestId}`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      timeout: 15, // 15 second timeout for ringing
    });

    // Add a timeout to the promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Call request timed out after 10 seconds")),
        10000
      );
    });

    // Race the call promise against the timeout
    const call = await Promise.race([callPromise, timeoutPromise]);

    console.log(
      `[${requestId}] Outbound call initiated successfully: ${call.sid}`
    );

    // Track the call in our application
    const callData = {
      callSid: call.sid,
      requestId,
      to,
      fromNumber,
      agentId: selectedAgentId,
      startTime: new Date(),
      status: "initiated",
    };

    // Store call data (could be expanded to a proper database)
    if (!configStore.callHistory) {
      configStore.callHistory = new Map();
    }
    configStore.callHistory.set(call.sid, callData);

    reply.send({
      message: "Call initiated successfully",
      callSid: call.sid,
      agentId: selectedAgentId,
      fromNumber,
      requestId,
    });
  } catch (error) {
    // Detailed error handling based on the type of error
    console.error(`[${requestId}] Error initiating call:`, error);

    let statusCode = 500;
    let errorMessage = "Failed to initiate call";
    let errorDetails = error.message;
    let resolution = null;

    // Handle specific Twilio error codes
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
    } else if (error.message.includes("timed out")) {
      statusCode = 504;
      errorMessage = "Request timed out";
      resolution = "Try again or check Twilio service status";
    }

    reply.status(statusCode).send({
      error: errorMessage,
      details: errorDetails,
      resolution,
      requestId,
    });
  }
});

// Get active calls
fastify.get("/active-calls", async (request, reply) => {
  reply.send({
    activeCalls: Array.from(configStore.activeConnections.entries()).map(
      ([streamSid, info]) => ({
        streamSid,
        ...info,
        duration: Math.floor((new Date() - info.startTime) / 1000), // Duration in seconds
      })
    ),
  });
});

// Start the Fastify server
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`[Server] Listening on port ${PORT}`);
});
