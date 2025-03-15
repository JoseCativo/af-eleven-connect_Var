// Code for the server-side application
import Fastify from "fastify";
import WebSocket from "ws";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import Twilio from "twilio";
import fetch from "node-fetch";

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

/**
 * Query Go High Level calendar for a rep's availability
 * @param {string} calendarId - The calendar ID (e.g., 'e0JBV5PARC9sbebxcYnY')
 * @param {string} apiKey - Your Go High Level API key
 * @param {string} startDate - Optional start date (YYYY-MM-DD format)
 * @param {string} endDate - Optional end date (YYYY-MM-DD format)
 * @param {string} timezone - Optional timezone
 * @returns {Promise<Object>} - Available time slots for the specified date range
 */
async function getRepAvailability(
  calendarId,
  apiKey,
  startDate,
  endDate,
  timezone
) {
  // Calculate today's date and date one week from now if not provided
  if (!startDate) {
    const today = new Date();
    startDate = today.toISOString().split("T")[0];
  }

  if (!endDate) {
    const nextWeek = new Date();
    nextWeek.setDate(new Date().getDate() + 7);
    endDate = nextWeek.toISOString().split("T")[0];
  }

  // Use provided timezone or default to system timezone
  if (!timezone) {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  // API endpoint from official documentation
  const endpoint = `https://services.leadconnectorhq.com/calendars/availability`;

  try {
    // Build the request body per the documentation
    const requestBody = {
      calendarId: calendarId,
      startDate: startDate,
      endDate: endDate,
      timezone: timezone,
    };

    // Make the HTTP request with the updated approach
    const response = await fetch(endpoint, {
      method: "POST", // Note: Using POST instead of GET based on docs
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! Status: ${response.status}, Details: ${errorText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching calendar availability:", error);
    throw error;
  }
}

/**
 * Book an appointment in Go High Level calendar
 * @param {string} calendarId - The calendar ID
 * @param {string} apiKey - Your Go High Level API key
 * @param {string} startTime - Appointment start time (ISO format)
 * @param {string} endTime - Appointment end time (ISO format)
 * @param {object} contactInfo - Contact information for the appointment
 * @param {string} timezone - Timezone for the appointment
 * @returns {Promise<Object>} - Booking confirmation details
 */
async function bookGHLAppointment(
  calendarId,
  apiKey,
  startTime,
  endTime,
  contactInfo,
  timezone
) {
  // API endpoint per documentation
  const endpoint = `https://services.leadconnectorhq.com/appointments/`;

  try {
    // Prepare request body
    const appointmentData = {
      calendarId: calendarId,
      startTime: startTime,
      endTime: endTime,
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      contact: {
        ...contactInfo,
      },
    };

    // Make the HTTP request
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify(appointmentData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! Status: ${response.status}, Details: ${errorText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error booking appointment:", error);
    throw error;
  }
}

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
  // Generate TwiML response to connect the call to a WebSocket stream
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${request.headers.host}/media-stream" />
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
      const url = new URL(req.url, `https://${req.headers.host}`);
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
    const webhookUrl = `https://${request.headers.host}/incoming-call-eleven`;

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

    // Create the call
    const call = await twilioClient.calls.create({
      url: webhookUrl,
      to: to,
      from: fromNumber,
    });

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

// Route to get a representative's availability
fastify.get("/get-availability", async (request, reply) => {
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`[${requestId}] Get availability request received`);

  // Extract the calendar ID from query parameters
  const { calendarId, startDate, endDate, timezone } = request.query;

  // Extract API key from authorization header
  const apiKey = request.headers.authorization?.replace("Bearer ", "");

  // Validate required parameters
  if (!calendarId) {
    console.log(`[${requestId}] Error: Missing calendar ID parameter`);
    return reply.status(400).send({
      error: "Calendar ID is required",
      requestId,
    });
  }

  if (!apiKey) {
    console.log(`[${requestId}] Error: Missing authorization header`);
    return reply.status(401).send({
      error: "Authorization header with Bearer token is required",
      requestId,
    });
  }

  try {
    console.log(
      `[${requestId}] Fetching availability for calendar: ${calendarId}`
    );

    // Call the function to get availability
    const availability = await getRepAvailability(
      calendarId,
      apiKey,
      startDate,
      endDate,
      timezone
    );

    // Format and return the availability data
    const formattedAvailability = {
      requestId,
      calendarId,
      dateRange: {
        start: startDate || new Date().toISOString().split("T")[0],
        end:
          endDate ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
      },
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      availability: availability,
    };

    console.log(`[${requestId}] Successfully retrieved availability`);
    reply.send(formattedAvailability);
  } catch (error) {
    console.error(`[${requestId}] Error getting availability:`, error);

    // Handle different types of errors
    if (error.message.includes("HTTP error!")) {
      // Extract status code if present in the error message
      const statusMatch = error.message.match(/Status: (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 500;

      return reply.status(status).send({
        error: "Failed to fetch availability from Go High Level",
        details: error.message,
        requestId,
      });
    }

    reply.status(500).send({
      error: "Failed to get availability",
      details: error.message,
      requestId,
    });
  }
});

// Route to book an appointment
fastify.post("/book-appointment", async (request, reply) => {
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`[${requestId}] Book appointment request received`);

  // Extract API key from authorization header
  const apiKey = request.headers.authorization?.replace("Bearer ", "");

  // Extract appointment details from request body
  const { calendarId, startTime, endTime, contactInfo, timezone, notes } =
    request.body;

  // Validate required parameters
  if (!calendarId) {
    console.log(`[${requestId}] Error: Missing calendar ID parameter`);
    return reply.status(400).send({
      error: "Calendar ID is required",
      requestId,
    });
  }

  if (!startTime || !endTime) {
    console.log(`[${requestId}] Error: Missing start or end time`);
    return reply.status(400).send({
      error: "Both startTime and endTime are required",
      requestId,
    });
  }

  if (!contactInfo || !contactInfo.email) {
    console.log(`[${requestId}] Error: Missing contact information`);
    return reply.status(400).send({
      error: "Contact information with at least an email is required",
      requestId,
    });
  }

  if (!apiKey) {
    console.log(`[${requestId}] Error: Missing authorization header`);
    return reply.status(401).send({
      error: "Authorization header with Bearer token is required",
      requestId,
    });
  }

  try {
    console.log(
      `[${requestId}] Booking appointment for calendar: ${calendarId}`
    );

    // Enhance contact info with notes if provided
    const enhancedContactInfo = {
      ...contactInfo,
    };

    if (notes) {
      enhancedContactInfo.notes = notes;
    }

    // Add caller ID for later reference
    enhancedContactInfo.externalId = requestId;

    // Book the appointment
    const appointmentResult = await bookGHLAppointment(
      calendarId,
      apiKey,
      startTime,
      endTime,
      enhancedContactInfo,
      timezone
    );

    // Format and return the booking data
    const bookingResponse = {
      requestId,
      status: "success",
      message: "Appointment booked successfully",
      appointmentId: appointmentResult.id || appointmentResult.appointmentId,
      details: {
        calendarId,
        startTime,
        endTime,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        contact: {
          email: contactInfo.email,
          name:
            contactInfo.name ||
            contactInfo.firstName + " " + (contactInfo.lastName || ""),
        },
      },
    };

    // If we have a phone integration configured, we could trigger a call to confirm
    if (
      configStore.TWILIO_PHONE_NUMBERS.length > 0 &&
      configStore.ELEVENLABS_AGENT_IDS.length > 0 &&
      contactInfo.phone
    ) {
      // Log that we could make a confirmation call
      console.log(
        `[${requestId}] Could notify ${contactInfo.phone} about appointment confirmation`
      );

      // Add notification info to response
      bookingResponse.notification = {
        message:
          "Contact has a phone number. You can use make-outbound-call to send a confirmation.",
        phone: contactInfo.phone,
      };
    }

    console.log(`[${requestId}] Successfully booked appointment`);
    reply.send(bookingResponse);
  } catch (error) {
    console.error(`[${requestId}] Error booking appointment:`, error);

    // Handle different types of errors
    if (error.message.includes("HTTP error!")) {
      // Extract status code if present in the error message
      const statusMatch = error.message.match(/Status: (\d+)/);
      const status = statusMatch ? parseInt(statusMatch[1]) : 500;

      // Common booking errors
      if (
        error.message.includes("already booked") ||
        error.message.includes("unavailable")
      ) {
        return reply.status(409).send({
          error: "Time slot is no longer available",
          details: error.message,
          requestId,
        });
      }

      if (
        error.message.includes("invalid calendar") ||
        error.message.includes("not found")
      ) {
        return reply.status(404).send({
          error: "Calendar not found or invalid",
          details: error.message,
          requestId,
        });
      }

      return reply.status(status).send({
        error: "Failed to book appointment in Go High Level",
        details: error.message,
        requestId,
      });
    }

    reply.status(500).send({
      error: "Failed to book appointment",
      details: error.message,
      requestId,
    });
  }
});

// Endpoint to handle Twilio status callbacks
fastify.post("/call-status", async (request, reply) => {
  const { CallSid, CallStatus, CallDuration } = request.body;
  const requestId = request.query.requestId || "unknown";

  console.log(`[${requestId}] Call status update: ${CallSid} -> ${CallStatus}`);

  // Update call data if we're tracking it
  if (configStore.callHistory && configStore.callHistory.has(CallSid)) {
    const callData = configStore.callHistory.get(CallSid);
    callData.status = CallStatus;
    if (CallDuration) {
      callData.duration = parseInt(CallDuration);
    }
    configStore.callHistory.set(CallSid, callData);
  }

  reply.send({ success: true });
});

// Start the Fastify server
fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`[Server] Listening on port ${PORT}`);
});
