# Admin User Setup Documentation

## Overview

This document outlines the process for setting up and managing administrative access to the Eleven Labs Outbound Caller system. The system uses a JWT-based authentication mechanism with environment variables to configure the initial admin credentials.

## Initial Admin Configuration

The Eleven Labs Outbound Caller system uses environment variables to define the initial administrator account. No database setup is required for the first admin user, making the system immediately accessible after deployment.

### Setting Environment Variables

Add the following variables to your environment configuration:

```
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
SERVER_SECRET=your_jwt_secret_key
```

These can be set in multiple ways:

1. In a `.env` file in the project root directory
2. As system environment variables
3. As deployment environment variables (in cloud hosting platforms)

### Security Requirements

For production environments, please adhere to these security requirements:

- **ADMIN_PASSWORD**: Use a strong password with at least 12 characters, including uppercase letters, lowercase letters, numbers, and special characters.
- **SERVER_SECRET**: Generate a cryptographically secure random string of at least 32 characters. This key is used to sign and verify JWT tokens.

Example of generating a secure SERVER_SECRET using Node.js:

```javascript
const crypto = require("crypto");
const serverSecret = crypto.randomBytes(32).toString("hex");
console.log(serverSecret);
```

## Admin Authentication Process

### Logging In as Admin

To obtain an admin authentication token:

1. Make a POST request to the `/auth/admin/login` endpoint with the following payload:

```
curl -X POST https://api.v1.affinitydesign.ca/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_secure_password"
  }'
```

````

2. The server will respond with a JWT token if the credentials match the configured environment variables:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "username": "your_admin_username"
  }
}
````

3. This token should be included in subsequent requests to admin endpoints using the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Characteristics

- Admin tokens do not expire by default (unlike client tokens)
- Tokens contain the admin username and a type claim set to "admin"
- Tokens are verified using the SERVER_SECRET environment variable

## Adding Additional Administrators

The current implementation does not include a database-backed admin user management system. To add or modify admin credentials:

1. Update the environment variables with the new credentials
2. Restart the application to apply the changes

For production systems requiring multiple administrators, consider implementing one of these approaches:

1. Create a database-backed admin user management system
2. Use multiple sets of environment variables for different admin accounts
3. Implement a role-based access control system

## Security Considerations

### Password Management

- Store admin credentials securely
- Rotate the admin password regularly
- Never share admin credentials among multiple users
- Consider implementing multi-factor authentication for production environments

### Token Security

- Keep the SERVER_SECRET confidential
- Consider implementing token expiration for production environments
- Implement a token revocation mechanism if needed
- Ensure all admin API access occurs over HTTPS

### Access Logging

For regulatory compliance and security monitoring, implement comprehensive access logging:

1. Log all admin authentication attempts (successful and failed)
2. Log all administrative actions with the admin username
3. Implement IP-based restrictions for admin access if possible

## Troubleshooting

### Invalid Credentials Error

If you receive a 401 Unauthorized response with the message "Invalid credentials":

1. Verify that the ADMIN_USERNAME and ADMIN_PASSWORD environment variables are set correctly
2. Check for whitespace or special characters that might not be properly escaped
3. Verify that the environment variables are accessible to the application

### Token Verification Failure

If admin endpoints return 401 Unauthorized after successful login:

1. Verify that the SERVER_SECRET environment variable is consistent
2. Check that the token is correctly included in the Authorization header
3. Verify that the token hasn't been modified or corrupted

## Next Steps

For a more robust admin user management system, consider implementing:

1. Database-backed admin user records
2. Role-based access control for different administrative functions
3. Password policies and rotation requirements
4. Audit logging for all administrative actions
5. IP-based access restrictions
