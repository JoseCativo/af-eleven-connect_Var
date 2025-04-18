// auth.js
import jwt from "jsonwebtoken";
import Client from "./client.js";

// Secret key for JWT (using the SERVER_SECRET from environment)
const JWT_SECRET = process.env.SERVER_SECRET;

// Generate a JWT token for a client that never expires
export function generateToken(clientId) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  return jwt.sign(
    {
      clientId,
      type: "client",
    },
    JWT_SECRET
    // No expiresIn parameter means the token never expires
  );
}

// Generate an admin token that never expires
export function generateAdminToken(adminId) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  return jwt.sign(
    {
      adminId,
      type: "admin",
    },
    JWT_SECRET
    // No expiresIn parameter
  );
}

// Verify a JWT token
export function verifyToken(token) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Middleware to authenticate client requests
export async function authenticateClient(request, reply) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("No token provided");
    }

    const token = authHeader.split(" ")[1];

    // First try to verify token as JWT
    const decoded = verifyToken(token);
    if (decoded && decoded.type === "client") {
      request.clientId = decoded.clientId;
      return;
    }

    // If JWT verification fails, check if it matches a stored token
    const client = await Client.findOne({
      clientToken: token,
      status: "Active",
    });

    if (client) {
      request.clientId = client.clientId;
      return;
    }

    // If we get here, authentication has failed
    throw new Error("Invalid token");
  } catch (error) {
    reply.code(401).send({
      error: "Unauthorized",
      message: error.message,
    });
    return reply.code(401);
  }
}

// Middleware to authenticate admin requests
// Middleware to authenticate admin requests
export async function authenticateAdmin(request, reply) {
  console.log("Admin authentication middleware called:", request.headers);
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("No token provided");
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      throw new Error("Invalid token");
    }

    if (decoded.type !== "admin") {
      throw new Error("Insufficient permissions");
    }

    // Set admin info
    request.adminId = decoded.adminId;
    // Success case continues to route handler
  } catch (error) {
    reply.code(401).send({
      error: "Unauthorized",
      message: error.message,
    });
    return reply.send(); // This ensures Fastify stops processing
  }
}
// Login endpoint handler
export async function handleClientLogin(clientId, clientSecret) {
  try {
    const client = await Client.findOne({
      clientId,
      clientSecret,
      status: "Active",
    });

    if (!client) {
      return {
        success: false,
        error: "Invalid credentials or inactive client",
      };
    }

    // Use existing token or generate a new one if it doesn't exist
    let token = client.clientToken;
    if (!token) {
      token = generateToken(clientId);
      // Store the token for future use
      await Client.findOneAndUpdate(
        { clientId },
        { $set: { clientToken: token } }
      );
    }

    return {
      success: true,
      token,
      client: {
        clientId: client.clientId,
        status: client.status,
        twilioPhoneNumber: client.twilioPhoneNumber,
        agentId: client.agentId,
        clientMeta: {
          fullName: client.clientMeta.fullName,
          businessName: client.clientMeta.businessName,
          email: client.clientMeta.email,
        },
      },
    };
  } catch (error) {
    console.error("Error during login:", error);
    return {
      success: false,
      error: "Login failed",
    };
  }
}

// Check if a client token is valid
// In auth.js, modify verifyClientToken
export async function verifyClientToken(token) {
  try {
    // First try the standard JWT verification
    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== "client") {
      // If standard verification fails, check if it matches a stored token
      const client = await Client.findOne({
        clientToken: token,
        status: "Active",
      });

      if (!client) {
        return {
          valid: false,
          error: "Invalid token",
        };
      }

      return {
        valid: true,
        clientId: client.clientId,
        directMatch: true,
      };
    }

    // Check if client exists and is active
    const client = await Client.findOne({
      clientId: decoded.clientId,
      status: "Active",
    });

    if (!client) {
      return {
        valid: false,
        error: "Client not found or inactive",
      };
    }

    return {
      valid: true,
      clientId: decoded.clientId,
      expiresAt: decoded.exp ? new Date(decoded.exp * 1000) : null,
    };
  } catch (error) {
    console.error("Error verifying token:", error);
    return {
      valid: false,
      error: "Token verification failed",
    };
  }
}
