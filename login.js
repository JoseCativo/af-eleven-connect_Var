// Auth routes ///////////////////////////////////////

// Client login route
fastify.post("/auth/login", async (request, reply) => {
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
    
    reply.send(result);
  } catch (error) {
    console.error('Error during login:', error);
    reply.code(500).send({
      error: "Login failed",
      details: error.message
    });
  }
});

// Verify token route
fastify.post("/auth/verify", async (request, reply) => {
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
    console.error('Error verifying token:', error);
    reply.code(500).send({
      error: "Token verification failed",
      details: error.message
    });
  }
});

// Admin login route (using a predefined admin account for simplicity)
fastify.post("/auth/admin/login", async (request, reply) => {
  const { username, password } = request.body;
  
  // In a real application, you'd validate against a database
  // For this example, we're using hardcoded credentials
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return reply.code(401).send({
      error: "Invalid credentials"
    });
  }
  
  try {
    // Generate admin token
    const token = generateAdminToken(username);
    
    reply.send({
      success: true,
      token,
      admin: {
        username
      }
    });
  } catch (error) {
    console.error('Error during admin login:', error);
    reply.code(500).send({
      error: "Login failed",
      details: error.message
    });
  }
});

// Refresh token route
fastify.post("/auth/refresh", async (request, reply) => {
  try {
    // Authenticate using the current token
    if (!authenticateClient(request, reply)) {
      return; // authenticateClient already sent the error response
    }
    
    // Generate a new token
    const newToken = generateToken(request.clientId);
    
    reply.send({
      success: true,
      token: newToken
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    reply.code(500).send({
      error: "Failed to refresh token",
      details: error.message
    });
  }
});
