// clientService.js
import Client from ".client.js";

// Create a new client
export async function createClient(clientData) {
  try {
    const client = new Client(clientData);
    await client.save();
    return client;
  } catch (error) {
    console.error("Error creating client:", error);
    throw error;
  }
}

// Find client by internal clientId
export async function findClientById(clientId) {
  try {
    // This uses the index we created on clientId
    const client = await Client.findOne({ clientId });
    return client;
  } catch (error) {
    console.error("Error finding client:", error);
    throw error;
  }
}

// Find client by other fields
export async function findClientByPhone(phone) {
  try {
    // This uses the index we created on clientMeta.phone
    const client = await Client.findOne({ "clientMeta.phone": phone });
    return client;
  } catch (error) {
    console.error("Error finding client:", error);
    throw error;
  }
}

// Update client information
export async function updateClient(clientId, updateData) {
  try {
    const updatedClient = await Client.findOneAndUpdate(
      { clientId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    return updatedClient;
  } catch (error) {
    console.error("Error updating client:", error);
    throw error;
  }
}

// Add a new call to call history
export async function addCallToHistory(clientId, callData) {
  try {
    const client = await Client.findOneAndUpdate(
      { clientId },
      {
        $push: {
          callHistory: {
            callId: `call_${new Date().getTime()}`, // Simple way to generate a unique ID
            callData: callData.callData,
            callDetails: callData.callDetails,
          },
        },
      },
      { new: true, runValidators: true }
    );
    return client;
  } catch (error) {
    console.error("Error adding call to history:", error);
    throw error;
  }
}

// Update call details for a specific call
export async function updateCallDetails(clientId, callId, callDetails) {
  try {
    const client = await Client.findOneAndUpdate(
      {
        clientId,
        "callHistory.callId": callId,
      },
      {
        $set: {
          "callHistory.$.callDetails": callDetails,
        },
      },
      { new: true, runValidators: true }
    );
    return client;
  } catch (error) {
    console.error("Error updating call details:", error);
    throw error;
  }
}

// Delete a client
export async function deleteClient(clientId) {
  try {
    const result = await Client.deleteOne({ clientId });
    return result.deletedCount > 0;
  } catch (error) {
    console.error("Error deleting client:", error);
    throw error;
  }
}

// Advanced queries examples

// Find clients with recent calls
export async function findClientsWithRecentCalls(daysAgo = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

  try {
    const clients = await Client.find({
      "callHistory.callData.startTime": { $gte: cutoffDate },
    });
    return clients;
  } catch (error) {
    console.error("Error finding clients with recent calls:", error);
    throw error;
  }
}

// Find clients by agent with positive call outcomes
export async function findClientsByAgentAndOutcome(
  agentId,
  outcome = "interested"
) {
  try {
    const clients = await Client.find({
      agentId,
      "callHistory.callDetails.callOutcome": outcome,
    });
    return clients;
  } catch (error) {
    console.error("Error finding clients by agent and outcome:", error);
    throw error;
  }
}

// Example usage with Fastify routes
export function registerClientRoutes(fastify) {
  // Get a client by ID
  fastify.get("/api/clients/:clientId", async (request, reply) => {
    try {
      const client = await findClientById(request.params.clientId);
      if (!client) {
        return reply.code(404).send({ error: "Client not found" });
      }
      return client;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "Server error" });
    }
  });

  // Add more routes here...
}
