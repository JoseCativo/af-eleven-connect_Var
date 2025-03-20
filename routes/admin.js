// routes/admin.js
import Client from '../client.js';
import { 
  createClient, 
  findClientById, 
  updateClient, 
  deleteClient, 
  findClientsWithRecentCalls, 
  findClientsByAgentAndOutcome 
} from '../crud.js';

/**
 * Admin routes - all require admin authentication
 * These routes are prefixed with /admin in the main app
 */
export default async function adminRoutes(fastify, options) {
  // Get all clients
  fastify.get("/clients", async (request, reply) => {
    try {
      const { limit, offset, status, search } = request.query;
      let query = {};
      
      // Filter by status if provided
      if (status) {
        query.status = status;
      }
      
      // Search by client name, email, or business name
      if (search) {
        query.$or = [
          { 'clientMeta.fullName': { $regex: search, $options: 'i' } },
          { 'clientMeta.email': { $regex: search, $options: 'i' } },
          { 'clientMeta.businessName': { $regex: search, $options: 'i' } }
        ];
      }
      
      // Create a base query that excludes the clientSecret
      let clientsQuery = Client.find(query).select('-clientSecret');
      
      // Get total count for pagination
      const totalCount = await Client.countDocuments(query);
      
      // Apply pagination if requested
      if (offset || limit) {
        const skip = parseInt(offset) || 0;
        const take = parseInt(limit) || 10;
        clientsQuery = clientsQuery.skip(skip).limit(take);
      }
      
      // Apply sorting - default to newest first
      clientsQuery = clientsQuery.sort({ createdAt: -1 });
      
      // Execute the query
      const clients = await clientsQuery;
      
      reply.send({
        total: totalCount,
        count: clients.length,
        clients
      });
    } catch (error) {
      fastify.log.error('Error fetching clients:', error);
      reply.code(500).send({
        error: "Failed to fetch clients",
        details: error.message
      });
    }
  });
  
  // Get client by ID
  fastify.get("/clients/:clientId", async (request, reply) => {
    try {
      const { clientId } = request.params;
      
      const client = await findClientById(clientId);
      
      if (!client) {
        return reply.code(404).send({
          error: "Client not found"
        });
      }
      
      // Admin can see all client data except clientSecret
      const clientData = client.toObject();
      delete clientData.clientSecret;
      
      reply.send(clientData);
    } catch (error) {
      fastify.log.error('Error fetching client:', error);
      reply.code(500).send({
        error: "Failed to fetch client",
        details: error.message
      });
    }
  });
  
  // Create a new client
  fastify.post("/clients", async (request, reply) => {
    try {
      const clientData = request.body;
      
      // Validate required fields
      if (!clientData.clientMeta || 
          !clientData.clientMeta.fullName || 
          !clientData.clientMeta.email || 
          !clientData.clientMeta.phone) {
        return reply.code(400).send({
          error: "Missing required client information",
          requiredFields: ["clientMeta.fullName", "clientMeta.email", "clientMeta.phone"]
        });
      }
      
      if (!clientData.agentId) {
        return reply.code(400).send({
          error: "Missing required agent ID"
        });
      }
      
      if (!clientData.twilioPhoneNumber) {
        return reply.code(400).send({
          error: "Missing required Twilio phone number"
        });
      }
      
      // Generate clientId if not provided
      if (!clientData.clientId) {
        clientData.clientId = generateUniqueId();
      }
      
      // Generate clientSecret if not provided
      if (!clientData.clientSecret) {
        clientData.clientSecret = generateUniqueId() + generateUniqueId();
      }
      
      // Set status to Active by default
      clientData.status = clientData.status || 'Active';
      
      const newClient = await createClient(clientData);
      
      // Don't return the clientSecret in the response
      const clientResponse = newClient.toObject();
      delete clientResponse.clientSecret;
      
      reply.code(201).send({
        message: "Client created successfully",
        client: clientResponse
      });
    } catch (error) {
      fastify.log.error('Error creating client:', error);
      
      // Handle duplicate key error
      if (error.code === 11000) {
        return reply.code(409).send({
          error: "Client already exists with this ID or email",
          details: error.message
        });
      }
      
      reply.code(500).send({
        error: "Failed to create client",
        details: error.message
      });
    }
  });
  
  // Update a client
  fastify.put("/clients/:clientId", async (request, reply) => {
    try {
      const { clientId } = request.params;
      const updateData = request.body;
      
      // Prevent changing the clientId
      if (updateData.clientId && updateData.clientId !== clientId) {
        return reply.code(400).send({
          error: "Cannot change client ID"
        });
      }
      
      const updatedClient = await updateClient(clientId, updateData);
      
      if (!updatedClient) {
        return reply.code(404).send({
          error: "Client not found"
        });
      }
      
      // Don't return the clientSecret in the response
      const clientResponse = updatedClient.toObject();
      delete clientResponse.clientSecret;
      
      reply.send({
        message: "Client updated successfully",
        client: clientResponse
      });
    } catch (error) {
      fastify.log.error('Error updating client:', error);
      reply.code(500).send({
        error: "Failed to update client",
        details: error.message
      });
    }
  });
  
  // Delete a client
  fastify.delete("/clients/:clientId", async (request, reply) => {
    try {
      const { clientId } = request.params;
      
      const deleted = await deleteClient(clientId);
      
      if (!deleted) {
        return reply.code(404).send({
          error: "Client not found"
        });
      }
      
      reply.send({
        message: "Client deleted successfully"
      });
    } catch (error) {
      fastify.log.error('Error deleting client:', error);
      reply.code(500).send({
        error: "Failed to delete client",
        details: error.message
      });
    }
  });
  
  // Reset client secret
  fastify.post("/clients/:clientId/reset-secret", async (request, reply) => {
    try {
      const { clientId } = request.params;
      
      // Generate a new client secret
      const clientSecret = generateUniqueId() + generateUniqueId();
      
      // Update the client with the new secret
      const updatedClient = await updateClient(clientId, { clientSecret });
      
      if (!updatedClient) {
        return reply.code(404).send({
          error: "Client not found"
        });
      }
      
      reply.send({
        message: "Client secret reset successfully",
        client: {
          clientId: updatedClient.clientId,
          clientSecret
        }
      });
    } catch (error) {
      fastify.log.error('Error resetting client secret:', error);
      reply.code(500).send({
        error: "Failed to reset client secret",
        details: error.message
      });
    }
  });
  
  // Get client call history
  fastify.get("/clients/:clientId/calls", async (request, reply) => {
    try {
      const { clientId } = request.params;
      const { limit, offset, status } = request.query;
      
      const client = await findClientById(clientId);
      
      if (!client) {
        return reply.code(404).send({
          error: "Client not found"
        });
      }
      
      let callHistory = client.callHistory || [];
      
      // Filter by status if requested
      if (status) {
        callHistory = callHistory.filter(call => 
          call.callData && call.callData.status === status
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
        callHistory: callHistory
      });
    } catch (error) {
      fastify.log.error('Error fetching client call history:', error);
      reply.code(500).send({
        error: "Failed to fetch client call history",
        details: error.message
      });
    }
  });
  
  // Get dashboard stats
  fastify.get("/dashboard", async (request, reply) => {
    try {
      // Get count of active clients
      const activeClientCount = await Client.countDocuments({ status: 'Active' });
      
      // Get count of inactive clients
      const inactiveClientCount = await Client.countDocuments({ status: { $ne: 'Active' } });
      
      // Get count of calls in the last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const recentCalls = await Client.aggregate([
        { $unwind: '$callHistory' },
        { $match: { 'callHistory.callData.startTime': { $gte: oneDayAgo } } },
        { $count: 'count' }
      ]);
      
      const recentCallCount = recentCalls.length > 0 ? recentCalls[0].count : 0;
      
      // Get total calls
      const totalCalls = await Client.aggregate([
        { $unwind: { path: '$callHistory', preserveNullAndEmptyArrays: true } },
        { $count: 'count' }
      ]);
      
      const totalCallCount = totalCalls.length > 0 ? totalCalls[0].count : 0;
      
      // Get calls by outcome
      const callsByOutcome = await Client.aggregate([
        { $unwind: '$callHistory' },
        { $group: { 
          _id: '$callHistory.callDetails.callOutcome', 
          count: { $sum: 1 } 
        }},
        { $sort: { count: -1 } }
      ]);
      
      // Get calls by status
      const callsByStatus = await Client.aggregate([
        { $unwind: '$callHistory' },
        { $group: { 
          _id: '$callHistory.callData.status', 
          count: { $sum: 1 } 
        }},
        { $sort: { count: -1 } }
      ]);
      
      // Format the outcome and status data
      const formattedOutcomes = {};
      callsByOutcome.forEach(item => {
        formattedOutcomes[item._id || 'unknown'] = item.count;
      });
      
      const formattedStatuses = {};
      callsByStatus.forEach(item => {
        formattedStatuses[item._id || 'unknown'] = item.count;
      });
      
      reply.send({
        clients: {
          active: activeClientCount,
          inactive: inactiveClientCount,
          total: activeClientCount + inactiveClientCount
        },
        calls: {
          recent: recentCallCount,
          total: totalCallCount,
          byOutcome: formattedOutcomes,
          byStatus: formattedStatuses
        }
      });
    } catch (error) {
      fastify.log.error('Error fetching dashboard stats:', error);
      reply.code(500).send({
        error: "Failed to fetch dashboard statistics",
        details: error.message
      });
    }
  });
  
  // Get recent activity
  fastify.get("/activity", async (request, reply) => {
    try {
      const { days = 7, limit = 10 } = request.query;
      
      // Get clients with recent calls
      const recentDays = parseInt(days);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - recentDays);
      
      // Find all calls within the time period
      const recentActivity = await Client.aggregate([
        { $unwind: '$callHistory' },
        { $match: { 'callHistory.callData.startTime': { $gte: cutoffDate } } },
        { $sort: { 'callHistory.callData.startTime': -1 } },
        { $limit: parseInt(limit) },
        { $project: {
          _id: 0,
          clientId: 1,
          clientName: '$clientMeta.fullName',
          businessName: '$clientMeta.businessName',
          callId: '$callHistory.callId',
          callSid: '$callHistory.callData.callSid',
          phone: '$callHistory.callData.phone',
          status: '$callHistory.callData.status',
          startTime: '$callHistory.callData.startTime',
          duration: '$callHistory.callData.duration',
          outcome: '$callHistory.callDetails.callOutcome'
        }}
      ]);
      
      reply.send({
        period: `${recentDays} days`,
        count: recentActivity.length,
        activities: recentActivity
      });
    } catch (error) {
      fastify.log.error('Error fetching recent activity:', error);
      reply.code(500).send({
        error: "Failed to fetch recent activity",
        details: error.message
      });
    }
  });
  
  // Make call on behalf of a client
  fastify.post("/clients/:clientId/make-call", async (request, reply) => {
    const { clientId } = request.params;
    const { phone } = request.body;
    
    // Generate a request ID for tracking
    const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    
    fastify.log.info(`[${requestId}] Admin initiated call for client: ${clientId}`);

    // Validate phone number
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phone) {
      fastify.log.warn(`[${requestId}] Error: Destination phone number missing`);
      return reply.code(400).send({
        error: "Destination phone number is required",
        requestId,
      });
    }
   
    if (!phoneRegex.test(phone)) {
      fastify.log.warn(`[${requestId}] Error: Invalid destination phone format: ${phone}`);
      return reply.code(400).send({
        error: "Phone number must be in E.164 format (e.g., +12125551234)",
        requestId,
      });
    }

    try {
      // Find the client
      const client = await findClientById(clientId);
      
      if (!client) {
        fastify.log.warn(`[${requestId}] Error: Client not found with ID: ${clientId}`);
        return reply.code(404).send({
          error: "Client not found",
          requestId,
        });
      }
      
      // Check if client is active
      if (client.status !== 'Active') {
        fastify.log.warn(`[${requestId}] Error: Client is not active: ${client.status}`);
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

      // Build the webhook URL with client parameters
      let webhookUrl = `https://${request.headers.host}/outbound-call-twiml?`;
      
      // Add parameters to the URL
      const params = {
        first_message: client.clientMeta.fullName.split(' ')[0] + '?',
        clientId: client.clientId,
        agentId: client.agentId,
        full_name: client.clientMeta.fullName,
        business_name: client.clientMeta.businessName,
        city: client.clientMeta.city,
        job_title: client.clientMeta.jobTitle,
        email: client.clientMeta.email,
        phone,
        requestId,
        admin_initiated: 'true'
      };
      
      // Build query string
      const queryParams = [];
      for (const [key, value] of Object.entries(params)) {
        if (value) {
          queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
      }
      
      webhookUrl += queryParams.join('&');

      // Create the call
      const call = await twilioClient.calls.create({
        url: webhookUrl,
        to: phone,
        from: client.twilioPhoneNumber,
        statusCallback: `https://${request.headers.host}/call-status?requestId=${requestId}&clientId=${client.clientId}&admin_initiated=true`,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        statusCallbackMethod: "POST",
      });

      fastify.log.info(`[${requestId}] Outbound call initiated successfully: ${call.sid}`);

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
          adminInitiated: true
        },
        callDetails: {
          callOutcome: "",
          callSummary: "",
          callTranscript: ""
        }
      };

      // Add call to client's call history
      await addCallToHistory(client.clientId, callData);

      reply.send({
        success: true,
        message: "Call initiated successfully",
        callSid: call.sid,
        clientId: client.clientId,
        requestId
      });
    } catch (error) {
      fastify.log.error(`[${requestId}] Error initiating call:`, error);

      // Handle Twilio errors
      let statusCode = 500;
      let errorMessage = "Failed to initiate call";
      let errorDetails = error.message;
      let resolution = null;

      if (error.code) {
        // Handle specific Twilio error codes
        switch (error.code) {
          case 21211:
            statusCode = 400;
            errorMessage = "Invalid 'To' phone number";
            resolution = "Check the phone number format and try again";
            break;
          case 21214:
            statusCode = 400;
            errorMessage = "Invalid 'From' phone number";
            resolution = "Verify the Twilio phone number is active and properly configured";
            break;
          // Add other Twilio error codes as needed
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
}

// Helper function to generate a unique ID
function generateUniqueId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}
