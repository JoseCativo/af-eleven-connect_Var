// routes/auth.js
import {
  handleClientLogin,
  verifyClientToken,
  generateToken,
  generateAdminToken,
  authenticateClient,
  verifyToken
} from '../auth.js';

import Client from '../client.js';

/**
 * Authentication routes
 * These routes are prefixed with /auth in the main app
 */
export default async function authRoutes(fastify, options) {
  // Client login route
  fastify.post("/login", async (request, reply) => {
    const { clientId, clientSecret } = request.body;
    
    // Validate required fields
    if (!clientId || !clientSecret) {
      return reply.code(400).send({
        error: "Missing required fields",
        requiredFields: ["clientId", "clientSecret"]
      });
    }
    
    try {
      // Attempt login
      const result = await handleClientLogin(clientId, clientSecret);
      
      if (!result.success) {
        return reply.code(401).send({
          error: result.error
        });
      }
      
      // Log successful login
      fastify.log.info(`Client login successful: ${clientId}`);
      
      reply.send(result);
    } catch (error) {
      fastify.log.error('Error during login:', error);
      reply.code(500).send({
        error: "Login failed",
        details: error.message
      });
    }
  });

  // Verify token route
  fastify.post("/verify", async (request, reply) => {
    const { token } = request.body;
    
    if (!token) {
      return reply.code(400).send({
        error: "Token is required"
      });
    }
    
    try {
      const result = await verifyClientToken(token);
      reply.send(result);
    } catch (error) {
      fastify.log.error('Error verifying token:', error);
      reply.code(500).send({
        error: "Token verification failed",
        details: error.message
      });
    }
  });

  // Admin login route (using a predefined admin account for simplicity)
  fastify.post("/admin/login", async (request, reply) => {
    const { username, password } = request.body;
    
    // Validate required fields
    if (!username || !password) {
      return reply.code(400).send({
        error: "Missing required fields",
        requiredFields: ["username", "password"]
      });
    }
    
    // In a real application, you'd validate against a database
    // For this example, we're using hardcoded credentials or environment variables
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      fastify.log.warn(`Failed admin login attempt for username: ${username}`);
      return reply.code(401).send({
        error: "Invalid credentials"
      });
    }
    
    try {
      // Generate admin token - we set it to never expire for simplicity
      // In production, you might want to use a reasonable expiration time
      const token = generateAdminToken(username);
      
      fastify.log.info(`Admin login successful: ${username}`);
      
      reply.send({
        success: true,
        token,
        admin: {
          username
        }
      });
    } catch (error) {
      fastify.log.error('Error during admin login:', error);
      reply.code(500).send({
        error: "Login failed",
        details: error.message
      });
    }
  });

  // Refresh token route
  fastify.post("/refresh", async (request, reply) => {
    try {
      // Get the current token from headers
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: "No token provided"
        });
      }
      
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      
      if (!decoded || decoded.type !== 'client') {
        return reply.code(401).send({
          error: "Invalid token"
        });
      }
      
      // Check if client exists and is active
      const client = await Client.findOne({ 
        clientId: decoded.clientId,
        status: 'Active'
      });
      
      if (!client) {
        return reply.code(401).send({
          error: "Client not found or inactive"
        });
      }
      
      // Generate a new token
      const newToken = generateToken(decoded.clientId);
      
      reply.send({
        success: true,
        token: newToken,
        clientId: decoded.clientId
      });
    } catch (error) {
      fastify.log.error('Error refreshing token:', error);
      reply.code(500).send({
        error: "Failed to refresh token",
        details: error.message
      });
    }
  });
  
  // Validate a client token route
  fastify.get("/validate", {
    preHandler: authenticateClient
  }, async (request, reply) => {
    // The preHandler already validated the token, so if we get here,
    // the token is valid and we can return the client ID
    reply.send({
      valid: true,
      clientId: request.clientId
    });
  });
  
  // Change client password route
  fastify.post("/change-secret", {
    preHandler: authenticateClient
  }, async (request, reply) => {
    const { currentSecret, newSecret } = request.body;
    
    if (!currentSecret || !newSecret) {
      return reply.code(400).send({
        error: "Both current and new secrets are required"
      });
    }
    
    try {
      // Verify current password
      const client = await Client.findOne({
        clientId: request.clientId,
        clientSecret: currentSecret
      });
      
      if (!client) {
        return reply.code(401).send({
          error: "Current secret is incorrect"
        });
      }
      
      // Update with new password
      client.clientSecret = newSecret;
      await client.save();
      
      // Generate a new token with the updated credentials
      const newToken = generateToken(request.clientId);
      
      fastify.log.info(`Client secret changed: ${request.clientId}`);
      
      reply.send({
        success: true,
        message: "Client secret changed successfully",
        token: newToken
      });
    } catch (error) {
      fastify.log.error('Error changing client secret:', error);
      reply.code(500).send({
        error: "Failed to change client secret",
        details: error.message
      });
    }
  });

  // Logout route (client side)
  fastify.post("/logout", {
    preHandler: authenticateClient
  }, async (request, reply) => {
    // Note: Since JWT is stateless, we can't actually invalidate the token on the server
    // without implementing a token blacklist. This endpoint is mainly for client tracking.
    
    fastify.log.info(`Client logout: ${request.clientId}`);
    
    reply.send({
      success: true,
      message: "Logged out successfully"
    });
  });
  
  // Admin logout route
  fastify.post("/admin/logout", async (request, reply) => {
    // Similar to client logout, this is mainly for client tracking
    reply.send({
      success: true,
      message: "Admin logged out successfully"
    });
  });
}
