# Client Account Creation

## Overview

This document details the process of creating a new client account in the Eleven Labs Outbound Caller system. Client accounts represent businesses or individuals who will use the system to make outbound calls using the ElevenLabs Conversational AI technology.

Client accounts contain essential information such as contact details, assigned agent configurations, and Twilio phone number assignments. Each client receives unique authentication credentials to access the secure client API endpoints.

## Prerequisites

Before creating a client account, ensure you have:

1. Administrator access to the system (with a valid admin JWT token)
2. A valid ElevenLabs agent ID to assign to the client
3. A provisioned Twilio phone number to assign to the client
4. Accurate contact information for the client

## Client Creation Process

### API Endpoint Details

Creating a client account requires an authenticated request to the admin API endpoint.

**Endpoint:** `POST /admin/clients`  
**Authentication:** Admin token required  
**Content-Type:** application/json

### Request Format

Below is the API request to create a new client account:

```bash
curl -X POST https://api.v1.affinitydesign.ca/admin/clients \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "client_unique_id",
    "clientSecret": "client_secure_secret_key",
    "clientMeta": {
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "+12125551234",
      "businessName": "Acme Corp",
      "city": "New York",
      "jobTitle": "CEO",
      "notes": "Prefers morning calls"
    },
    "agentId": "agent_id_here",
    "twilioPhoneNumber": "+18001234567",
    "status": "Active"
  }'
```

### Request Field Descriptions

#### Required Fields

- **clientId**: Unique identifier for the client
- **clientSecret**: Secret key for client authentication
- **clientMeta.fullName**: The client's full name
- **clientMeta.email**: The client's email address (must be unique)
- **clientMeta.phone**: The client's phone number (in E.164 format, e.g., +12125551234)
- **agentId**: The ID of the ElevenLabs conversational agent assigned to this client
- **twilioPhoneNumber**: The Twilio phone number assigned to this client (in E.164 format)

#### Optional Fields

- **clientMeta.businessName**: The client's company or organization name
- **clientMeta.city**: The client's city location
- **clientMeta.jobTitle**: The client's professional title
- **clientMeta.notes**: Additional information about the client
- **status**: Client account status (defaults to "Active" if not specified; other values: "Inactive", "Suspended")

### Response Format

Upon successful creation, the system returns a response with the new client's details:

```json
{
  "message": "Client created successfully",
  "client": {
    "clientId": "client_12345abcde",
    "status": "Active",
    "agentId": "agent_id_here",
    "twilioPhoneNumber": "+18001234567",
    "clientMeta": {
      "fullName": "John Doe",
      "email": "john@example.com",
      "phone": "+12125551234",
      "businessName": "Acme Corp",
      "city": "New York",
      "jobTitle": "CEO",
      "notes": "Prefers morning calls"
    },
    "createdAt": "2025-03-20T12:00:00.000Z",
    "updatedAt": "2025-03-20T12:00:00.000Z"
  }
}
```

> **Important Security Note**: The response will include both the `clientId` and `clientSecret` in this API response, as they were provided in the request. For security purposes, the `clientSecret` will not be retrievable in subsequent API calls unless explicitly reset.

## Retrieving the Client Secret

If you need to view the client secret for initial setup, you must use the reset secret endpoint:

```bash
curl -X POST https://api.v1.affinitydesign.ca/admin/clients/client_12345abcde/reset-secret \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

Response:

```json
{
  "message": "Client secret reset successfully",
  "client": {
    "clientId": "client_12345abcde",
    "clientSecret": "newly_generated_client_secret"
  }
}
```

## Next Steps After Creating a Client

After creating a client account, you should:

1. Securely provide the client with their `clientId` and `clientSecret` for API authentication
2. Guide the client through the login process to obtain their JWT token
3. Ensure the client can access their secure endpoints
4. Set up any additional configurations specific to the client's needs

## Common Issues and Troubleshooting

### Duplicate Email Error

If you receive a 409 Conflict error, the client email address may already exist in the system:

```json
{
  "error": "Client already exists with this ID or email",
  "details": "E11000 duplicate key error collection: clients index: clientMeta.email_1 dup key: { clientMeta.email: \"john@example.com\" }"
}
```

**Resolution**: Use a different email address or update the existing client.

### Invalid Agent ID

If the agent ID doesn't exist in the ElevenLabs system, you may encounter errors when the client attempts to make calls.

**Resolution**: Verify the agent ID is valid by testing it with the ElevenLabs API before assigning it to a client.

### Invalid Twilio Phone Number

If the Twilio phone number is incorrectly formatted or not provisioned in your Twilio account:

```json
{
  "error": "Failed to create client",
  "details": "Invalid phone number format"
}
```

**Resolution**: Ensure the phone number is in E.164 format (+12125551234) and properly provisioned in your Twilio account.

## Client Account Statuses

A client account can have one of the following statuses:

- **Active**: The client can authenticate and use all client-specific endpoints
- **Inactive**: The client cannot authenticate (typically used for clients no longer using the service)
- **Suspended**: The client cannot authenticate (typically used for temporary suspension due to billing or other issues)
