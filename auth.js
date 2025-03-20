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
export function authenticateClient(request, reply) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("No token provided");
    }

    const token = authHeader.split(" ")[1];

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error("Invalid token");
    }

    // Check if it's a client token
    if (decoded.type !== "client") {
      throw new Error("Invalid token type");
    }

    // Add client info to request
    request.clientId = decoded.clientId;
  } catch (error) {
    reply.code(401).send({
      error: "Unauthorized",
      message: error.message,
    });
    return false;
  }

  return true;
}

// Middleware to authenticate admin requests
export function authenticateAdmin(request, reply) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("No token provided");
    }

    const token = authHeader.split(" ")[1];

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded) {
      throw new Error("Invalid token");
    }

    // Check if it's an admin token
    if (decoded.type !== "admin") {
      throw new Error("Insufficient permissions");
    }

    // Add admin info to request
    request.adminId = decoded.adminId;
  } catch (error) {
    reply.code(401).send({
      error: "Unauthorized",
      message: error.message,
    });
    return false;
  }

  return true;
}

// Login endpoint handler
export async function handleClientLogin(clientId, clientSecret) {
  try {
    // Find the client in the database
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

    // Generate a token
    const token = generateToken(clientId);

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
export async function verifyClientToken(token) {
  try {
    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== "client") {
      return {
        valid: false,
        error: "Invalid token",
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
      expiresAt: new Date(decoded.exp * 1000),
    };
  } catch (error) {
    console.error("Error verifying token:", error);
    return {
      valid: false,
      error: "Token verification failed",
    };
  }
}
