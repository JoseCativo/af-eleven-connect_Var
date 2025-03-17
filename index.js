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

// Initialize config store with ElevenLabs API key
const configStore = {
  // Default values from environment variables - these should be strings, not arrays
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  TWILIO_PHONE_NUMBERS: process.env.TWILIO_PHONE_NUMBER
    ? [process.env.TWILIO_PHONE_NUMBER]
    : [],
  ELEVENLABS_AGENT_IDS: process.env.ELEVENLABS_AGENT_ID
    ? [process.env.ELEVENLABS_AGENT_ID]
    : [],

  GHL_API_KEY: process.env.GHL_API_KEY,
  // Active connections
  activeConnections: new Map(), // Map of streamSid to connection info
};

// Helper function to get signed URL for authenticated ElevenLabs conversations

async function getSignedUrl(agentId) {
  // If no agentId is provided, use the first one from the config store
  const effectiveAgentId = agentId || configStore.ELEVENLABS_AGENT_IDS[0];

  if (!effectiveAgentId) {
    throw new Error("No agent ID available");
  }

  try {
    console.log(
      `[ElevenLabs] Getting signed URL for agent: ${effectiveAgentId}`
    );
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${effectiveAgentId}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": configStore.ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    return data.signed_url;
  } catch (error) {
    console.error("Error getting signed URL:", error);
    throw error;
  }
}

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
const twilioClient = new Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const PORT = process.env.PORT || 8000;

// Config routes ///////////////////////////////////////

// Root route for health check
fastify.get("/", async (_, reply) => {
  reply.send({ message: "Server is running" });
});
// API to get all configuration
fastify.get("/config", async (request, reply) => {
  reply.send({
    twilioPhoneNumbers: configStore.TWILIO_PHONE_NUMBERS,
    elevenLabsAgentIds: configStore.ELEVENLABS_AGENT_IDS,
    activeConnections: Array.from(configStore.activeConnections.keys()).length,
  });
});
// Add a new API endpoint to configure the Go High Level API key
fastify.post("/config/ghl-api-key", async (request, reply) => {
  const { apiKey } = request.body;

  if (!apiKey) {
    return reply.status(400).send({
      error: "API key is required",
    });
  }

  try {
    // You might want to validate the API key by making a test request to GHL
    // For now, we'll just store it
    configStore.GHL_API_KEY = apiKey;

    reply.send({
      success: true,
      message: "Go High Level API key updated successfully",
    });
  } catch (error) {
    console.error("Error updating Go High Level API key:", error);
    reply.status(500).send({
      error: "Failed to update Go High Level API key",
      details: error.message,
    });
  }
});
// API to configure elevin labs agents credentials
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

// WebSocket routes ///////////////////////////////////////

// TODO WebSocket inbound route for handling media streams from Twilio
fastify.register(async (fastifyInstance) => {
  fastifyInstance.get(
    "/media-stream",
    { websocket: true },
    (connection, req) => {
      console.info("[Server] Twilio connected to media stream.");

      let streamSid = null;

      // Connect to ElevenLabs Conversational AI WebSocket
      const elevenLabsWs = new WebSocket(
        `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${configStore.ELEVENLABS_AGENT_IDS[0]}`
      );

      elevenLabsWs.on("open", () => {
        console.log("[II] Connected to Conversational AI.");
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
        console.log("[II] Disconnected.");
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
        elevenLabsWs.close();
        console.log("[Twilio] Client disconnected");
      });

      connection.on("error", (error) => {
        console.error("[Twilio] WebSocket error:", error);
        elevenLabsWs.close();
      });
    }
  );
});

// WebSocket outbound route for handling media streams from Twilio
fastify.register(async (fastifyInstance) => {
  fastifyInstance.get(
    "/outbound-media-stream",
    { websocket: true },
    (ws, req) => {
      console.info("[Server] Twilio connected to outbound media stream");
      console.log("[Server] Query parameters:", req.query);
      console.log("[Server] Query req body:", req.requestBody);
      console.log("[Server] Query body:", req.body);

      // Variables to track the call
      let streamSid = null;
      let callSid = null;
      let elevenLabsWs = null;
      let customParameters = null;
      let isElevenLabsReady = false;
      let messageQueue = []; // Queue to store messages until ElevenLabs is ready
      let clientInfo = null; // Store client information from get-info API

      // Handle WebSocket errors
      ws.on("error", (error) => {
        console.error("[Twilio WebSocket] Error:", error);
      });

      // Process any queued messages
      const processQueuedMessages = () => {
        if (!isElevenLabsReady || !elevenLabsWs || messageQueue.length === 0)
          return;

        console.log(
          `[ElevenLabs] Processing ${messageQueue.length} queued messages`
        );

        while (messageQueue.length > 0) {
          const msg = messageQueue.shift();
          try {
            if (elevenLabsWs.readyState === WebSocket.OPEN) {
              elevenLabsWs.send(JSON.stringify(msg));
            }
          } catch (error) {
            console.error("[ElevenLabs] Error sending queued message:", error);
          }
        }
      };

      // Set up ElevenLabs connection - but we'll call this after receiving start event
      const setupElevenLabs = async () => {
        try {
          // Use the agent ID from parameters or default
          const agentId =
            customParameters?.agentId ||
            req.query.agentId ||
            configStore.ELEVENLABS_AGENT_IDS[0];

          if (!agentId) {
            throw new Error("No agent ID available");
          }

          console.log(
            `[ElevenLabs] Setting up connection with agent ID: ${agentId}`
          );
          const signedUrl = await getSignedUrl(agentId);

          elevenLabsWs = new WebSocket(signedUrl);

          elevenLabsWs.on("error", (error) => {
            console.error("[ElevenLabs] WebSocket error:", error);
          });

          elevenLabsWs.on("open", () => {
            console.log("[ElevenLabs] Connected to Conversational AI");

            try {
              // Create the config with proper format TODO test

              const initialConfig = {
                type: "conversation_initiation_client_data",
                conversation_config_override: {
                  agent: {
                    prompt: {
                      prompt:
                        customParameters?.prompt ||
                        "You are affinity design sales agent",
                    },
                    first_message: customParameters?.first_message || "hello?!",
                  },
                },
              };

              console.log(
                "[ElevenLabs] Sending initial config with dynamic variables:",
                JSON.stringify(initialConfig)
              );

              // Send the configuration to ElevenLabs
              elevenLabsWs.send(JSON.stringify(initialConfig));

              // Mark as ready and process any queued messages
              isElevenLabsReady = true;
              processQueuedMessages();
            } catch (configError) {
              console.error(
                "[ElevenLabs] Error preparing configuration:",
                configError
              );
            }
          });

          elevenLabsWs.on("message", (data) => {
            try {
              const message = JSON.parse(data);

              switch (message.type) {
                case "conversation_initiation_metadata":
                  console.log("[ElevenLabs] Received initiation metadata");
                  break;

                case "audio":
                  if (message.audio_event?.audio_base_64) {
                    if (streamSid) {
                      console.log("[ElevenLabs] Sending audio to Twilio");
                      ws.send(
                        JSON.stringify({
                          event: "media",
                          streamSid,
                          media: {
                            payload: message.audio_event.audio_base_64,
                          },
                        })
                      );
                    } else {
                      console.log(
                        "[ElevenLabs] Have audio but no StreamSid yet"
                      );
                    }
                  }
                  break;

                case "ping":
                  if (message.ping_event?.event_id) {
                    console.log("[ElevenLabs] Received ping, sending pong");
                    elevenLabsWs.send(
                      JSON.stringify({
                        type: "pong",
                        event_id: message.ping_event.event_id,
                      })
                    );
                  }
                  break;

                case "agent_response":
                  console.log(
                    `[Twilio] Agent response: ${message.agent_response_event?.agent_response}`
                  );
                  break;

                case "user_transcript":
                  console.log(
                    `[Twilio] User transcript: ${message.user_transcription_event?.user_transcript}`
                  );
                  break;

                case "interruption":
                  if (streamSid) {
                    console.log("[ElevenLabs] Sending clear event to Twilio");
                    ws.send(
                      JSON.stringify({
                        event: "clear",
                        streamSid,
                      })
                    );
                  }
                  break;

                default:
                  console.log(
                    `[ElevenLabs] Unhandled message type: ${message.type}`
                  );
              }
            } catch (error) {
              console.error("[ElevenLabs] Error processing message:", error);
            }
          });

          elevenLabsWs.on("close", (code, reason) => {
            console.log(
              `[ElevenLabs] Disconnected: Code: ${code}, Reason: ${
                reason || "No reason provided"
              }`
            );
            isElevenLabsReady = false;
          });
        } catch (error) {
          console.error("[ElevenLabs] Setup error:", error);
        }
      };

      // Handle messages from Twilio
      ws.on("message", async (message) => {
        try {
          const msg = JSON.parse(message);

          switch (msg.event) {
            case "start":
              streamSid = msg.start.streamSid;
              callSid = msg.start.callSid;
              customParameters = msg.start.customParameters || {};

              console.log(
                `[Twilio] Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`
              );
              console.log(
                "[Twilio] Start parameters:",
                JSON.stringify(customParameters || {})
              );

              // Now that we have the parameters, set up ElevenLabs
              await setupElevenLabs();
              break;

            case "media":
              if (
                isElevenLabsReady &&
                elevenLabsWs &&
                elevenLabsWs.readyState === WebSocket.OPEN
              ) {
                // Connection is ready, send immediately
                const audioMessage = {
                  user_audio_chunk: Buffer.from(
                    msg.media.payload,
                    "base64"
                  ).toString("base64"),
                };
                elevenLabsWs.send(JSON.stringify(audioMessage));
              } else if (elevenLabsWs) {
                // Connection exists but not ready, queue the message
                console.log(
                  "[Twilio] Queueing audio message until ElevenLabs is ready"
                );
                messageQueue.push({
                  user_audio_chunk: Buffer.from(
                    msg.media.payload,
                    "base64"
                  ).toString("base64"),
                });
              } else {
                // No connection yet, just log
                console.log(
                  "[Twilio] Received audio but ElevenLabs connection not initialized yet"
                );
              }
              break;

            case "stop":
              console.log(`[Twilio] Stream ${streamSid} ended`);
              if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
                elevenLabsWs.close(1000, "Call completed");
              }
              break;

            default:
              console.log(`[Twilio] Unhandled event: ${msg.event}`);
          }
        } catch (error) {
          console.error("[Twilio] Error processing message:", error);
        }
      });

      // Handle WebSocket closure
      ws.on("close", () => {
        console.log("[Twilio] Client disconnected");
        if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
          elevenLabsWs.close(1000, "Twilio disconnected");
        }
      });
    }
  );
});

// API routes ///////////////////////////////////////

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

// Route to initiate an outbound call
fastify.post("/make-outbound-call", async (request, reply) => {
  const { business_name, city, job_title } = request.body;
  const { to, from, email } = request.query;

  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  console.log(`[${requestId}] Outbound call request received`);

  // Get TODO build prompt & first message
  const prompt = null;
  const first_message = null;

  // Input validation
  if (!to) {
    console.log(`[${requestId}] Error: Destination phone number missing`);
    return reply.status(400).send({
      error: "Destination phone number is required",
      requestId,
    });
  }
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

  // Make the call

  try {
    console.log(
      `[${requestId}] Initiating call from ${phoneNumber} to ${to} using agent ${agentId}`
    );

    const webhookUrl = `https://${
      request.headers.host
    }/outbound-call-twiml?prompt=${encodeURIComponent(
      prompt
    )}&first_message=${encodeURIComponent(first_message)}`;

    // Create the call
    const call = await twilioClient.calls.create({
      url: webhookUrl,
      to: to,
      from: from,
      statusCallback: `https://${request.headers.host}/call-status?requestId=${requestId}`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
    });

    console.log(
      `[${requestId}] Outbound call initiated successfully: ${call.sid}`
    );

    // Track the call in our application
    const callData = {
      callSid: call.sid,
      requestId,
      to,
      from,
      agentId: agentId,
      startTime: new Date(),
      status: "initiated",
    };

    // Store call data (could be expanded to a proper database)
    if (!configStore.callHistory) {
      configStore.callHistory = new Map();
    }
    configStore.callHistory.set(call.sid, callData);

    reply.send({
      success: true,
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

// Route to handle outbound calls from Twilio
fastify.all("/outbound-call-twiml", async (request, reply) => {
  const prompt = request.query.prompt || "";
  const first_message = request.query.first_message || "";

  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="wss://${request.headers.host}/outbound-media-stream">
            <Parameter name="prompt" value="${prompt}" />
            <Parameter name="first_message" value="${first_message}" />
          </Stream>
        </Connect>
      </Response>`;

  reply.type("text/xml").send(twimlResponse);
});

// New endpoint to serve personalized data for inbound calls TODO test
fastify.post("/get-info", async (request, reply) => {
  const { caller_id, agent_id, called_number, call_sid } = request.body;

  // Generate a request ID for tracking
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  console.log(`get info endpoint:`, { body: request.body });

  // TODO: In the future, you could perform a lookup here based on caller_id
  // For example, query a CRM to get customer information

  const dynamic_variables = {
    customer_name: "Paul Giovanatto",
    email: "paulgiovanatto@gmail.com",
    company: "Affinity Design",
    jobTitle: "CEO",
    city: "Toronto",
  };
  // For now, return placeholder data
  const response = {
    dynamic_variables: dynamic_variables,
    conversation_config_override: {
      agent: {
        first_message: `Hi ${dynamic_variables.customer_name}?`,
        //   prompt: {
        //     prompt:
        //       "You are speaking with John Doe, CEO of Affinity Design based in Toronto. Be friendly, professional, and conversational. Address the customer by their first name when appropriate.",
        //   },
      },
    },
  };

  // Log the response for debugging
  console.log(`[${requestId}] Returning personalization data`);

  reply.send(response);
});

fastify.post("/get-ghl-info", async (request, reply) => {
  // Generate a request ID for tracking
  const requestId =
    Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  // Extract parameters from request body
  const { email, phone } = request.body;

  // Extract API key from authorization header
  const apiKey = request.headers.authorization?.replace("Bearer ", "");

  // Validate required parameters - we need either email or phone
  if (!email && !phone) {
    console.log(`[${requestId}] Error: Missing search parameters`);
    return reply.status(400).send({
      error: "Either email, phone, or caller_id parameter is required",
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

  // Determine which parameter to use for searching
  let searchParam = {};
  let searchValue = "";

  if (email) {
    searchParam = { email };
    searchValue = email;
  } else if (phone) {
    searchParam = { phone };
    searchValue = phone;
  }

  try {
    console.log(
      `[${requestId}] Querying Go High Level for contact info: ${searchValue}`
    );

    // API endpoint for searching contacts
    const endpoint = "https://services.leadconnectorhq.com/contacts/search";

    // Make the HTTP request to search for the contact
    const searchResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        Version: "2021-07-28",
      },
      body: JSON.stringify({
        ...searchParam,
        limit: 1, // We only need the first matching contact
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      throw new Error(
        `HTTP error! Status: ${searchResponse.status}, Details: ${errorText}`
      );
    }

    const searchResult = await searchResponse.json();

    // Check if we found any matching contacts
    if (!searchResult.contacts || searchResult.contacts.length === 0) {
      console.log(
        `[${requestId}] No contact found with search param: ${searchValue}`
      );

      // Return default data since we couldn't find a match
      const defaultResponse = {
        dynamic_variables: {
          user_name: "Customer",
          email: email || "",
          phone: phone || caller_id || "",
          company: "",
          first_name: "",
          last_name: "",
        },
        conversation_config_override: {
          agent: {
            first_message:
              "Hello! Thanks for taking my call today. How are you doing?",
          },
        },
      };

      return reply.send(defaultResponse);
    }

    // Get the first matching contact
    const contact = searchResult.contacts[0];

    console.log(
      `[${requestId}] Found contact: ${contact.firstName} ${contact.lastName}`
    );

    // Map Go High Level contact fields to our dynamic variables
    const dynamic_variables = {
      // Name fields - we need to ensure user_name is properly set
      user_name: `${contact.firstName || ""} ${contact.lastName || ""}`.trim(),
      first_name: contact.firstName || "",
      last_name: contact.lastName || "",

      // Contact information
      email: contact.email || email || "",
      phone: contact.phone || phone || "",

      // Company information
      company: contact.companyName || "",
      website: contact.website || "",

      // Address information
      address: contact.address1 || "",
      city: contact.city || "",
      state: contact.state || "",
      postal_code: contact.postalCode || "",
      country: contact.country || "",

      // Additional fields
      tags: contact.tags || [],
      customFields: contact.customFields || {},
    };

    // Create a personalized first message based on the contact's name
    const firstName = contact.firstName || "there";
    const firstMessage = `Hi ${firstName}, this is Alex from Affinity Design. How are you doing today?`;

    // Create a personalized prompt with context about the customer
    const promptBase = `You are speaking with ${dynamic_variables.user_name}`;
    const companyContext = dynamic_variables.company
      ? ` who works at ${dynamic_variables.company}`
      : "";
    const locationContext = dynamic_variables.city
      ? ` based in ${dynamic_variables.city}${
          dynamic_variables.state ? ", " + dynamic_variables.state : ""
        }`
      : "";
    const promptSuffix = `. Be friendly, professional, and conversational. Address the customer by their first name (${firstName}) when appropriate.`;

    const prompt = promptBase + companyContext + locationContext + promptSuffix;

    // const response = {
    //   dynamic_variables: dynamic_variables,
    //   conversation_config_override: {
    //     agent: {
    //       first_message: firstMessage,
    //     }
    //   }
    // };

    // Prepare the response object
    const response = {
      dynamic_variables: dynamic_variables,
    };

    // Log the response for debugging (limited to avoid exposing sensitive information)
    console.log(
      `[${requestId}] Returning Go High Level contact data for ${dynamic_variables.user_name}`
    );

    reply.send(response);
  } catch (error) {
    console.error(
      `[${requestId}] Error fetching contact from Go High Level:`,
      error
    );

    // Return a default response even if there was an error
    const defaultResponse = {
      dynamic_variables: {
        user_name: "Customer",
        email: email || "",
        phone: phone || "",
        company: "",
        first_name: "",
        last_name: "",
      },
    };

    // Log the error but still return a valid response to prevent call failures
    console.log(`[${requestId}] Returning default values due to error`);
    reply.send(defaultResponse);
  }
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
fastify.listen({ port: PORT, host: "0.0.0.0" }, (err) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`[Server] Listening on port ${PORT} on all interfaces`);
});
