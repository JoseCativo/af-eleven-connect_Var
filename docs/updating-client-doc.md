# Updating Client Information (Admin)

## Overview

This document outlines the process for updating existing client information in the Eleven Labs Outbound Caller system. This administrative functionality allows system administrators to modify client account details, update contact information, change assigned resources, and adjust client status. The ability to update client information enables effective account management and ensures client records remain accurate and current.

## Authentication Requirements

This endpoint requires administrative authentication. Ensure you have a valid admin JWT token provided in the Authorization header.

**Authorization Header Format:**
```
Authorization: Bearer <admin_jwt_token>
```

## Endpoint Details

**Endpoint:** `PUT /admin/clients/:clientId`  
**Method:** PUT  
**Authentication:** Admin JWT token required  
**Content-Type:** application/json

## URL Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| clientId | String | Unique identifier of the client to update | Yes |

## Request Format

The request body should contain the fields you wish to update. All fields are optional, and only the provided fields will be updated.

```json
{
  "status": "Active",
  "agentId": "updated_agent_id",
  "twilioPhoneNumber": "+18005559876",
  "clientMeta": {
    "fullName": "John Smith",
    "email": "john.smith@example.com",
    "phone": "+12125551234",
    "businessName": "Acme Corporation",
    "city": "Chicago",
    "jobTitle": "CTO",
    "notes": "Updated account information"
  }
}
```

## Sample Request

```bash
curl -X PUT "https://api.v1.affinitydesign.ca/admin/clients/client_12345abcde" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Active",
    "agentId": "updated_agent_id",
    "twilioPhoneNumber": "+18005559876",
    "clientMeta": {
      "fullName": "John Smith",
      "email": "john.smith@example.com",
      "phone": "+12125551234",
      "businessName": "Acme Corporation",
      "city": "Chicago",
      "jobTitle": "CTO",
      "notes": "Updated account information"
    }
  }'
```

## Updatable Fields

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| status | String | Client account status ("Active", "Inactive", or "Suspended") |
| agentId | String | ID of the ElevenLabs conversational agent to assign to this client |
| twilioPhoneNumber | String | Twilio phone number to assign to this client (in E.164 format) |
| clientMeta | Object | Client metadata including contact information and business details |

### Client Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| fullName | String | Client's full name |
| email | String | Client's email address |
| phone | String | Client's phone number (in E.164 format) |
| businessName | String | Client's company or organization name |
| city | String | Client's city location |
| jobTitle | String | Client's professional title |
| notes | String | Additional notes about the client |

## Response Format

A successful update request will return a JSON response with the following structure:

```json
{
  "message": "Client updated successfully",
  "client": {
    "clientId": "client_12345abcde",
    "status": "Active",
    "updatedAt": "2025-03-20T14:30:00.000Z"
  }
}
```

## Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| message | String | Success message indicating the update was completed |
| client.clientId | String | Unique identifier of the updated client |
| client.status | String | Current status of the client account after update |
| client.updatedAt | String | ISO 8601 timestamp of when the client was last updated |

## Common Error Responses

### Client Not Found

```json
{
  "error": "Client not found",
  "statusCode": 404
}
```

### Unauthorized Access

```json
{
  "error": "Unauthorized",
  "message": "Invalid token",
  "statusCode": 401
}
```

### Invalid Request Data

```json
{
  "error": "Invalid update data",
  "details": "Email format is invalid",
  "statusCode": 400
}
```

### Duplicate Email

```json
{
  "error": "Failed to update client",
  "details": "E11000 duplicate key error collection: clients index: clientMeta.email_1 dup key",
  "statusCode": 409
}
```

### Server Error

```json
{
  "error": "Failed to update client",
  "details": "Database connection error",
  "statusCode": 500
}
```

## Important Update Considerations

1. **Partial Updates**: The API supports partial updates. Only include the fields you wish to modify.

2. **Client ID Immutability**: The `clientId` field cannot be modified. If included in the request body, it will be ignored.

3. **Client Secret**: The client secret cannot be updated via this endpoint. To reset a client's secret, use the dedicated `/admin/clients/:clientId/reset-secret` endpoint.

4. **Email Uniqueness**: If you update the client's email address, ensure it is not already in use by another client.

5. **Status Changes**: When changing a client's status to "Inactive" or "Suspended", the client will no longer be able to authenticate.

## Practical Update Scenarios

### Updating Contact Information Only

```bash
curl -X PUT "https://api.v1.affinitydesign.ca/admin/clients/client_12345abcde" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "clientMeta": {
      "fullName": "John Smith",
      "email": "john.smith@example.com",
      "phone": "+12125551234"
    }
  }'
```

### Changing Client Status

```bash
curl -X PUT "https://api.v1.affinitydesign.ca/admin/clients/client_12345abcde" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "Inactive"
  }'
```

### Updating Assigned Resources

```bash
curl -X PUT "https://api.v1.affinitydesign.ca/admin/clients/client_12345abcde" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "new_agent_id",
    "twilioPhoneNumber": "+18005559876"
  }'
```

## Troubleshooting

### Token Validation Issues

If you receive a 401 Unauthorized response:
- Verify that your admin token is valid and has not expired
- Ensure the token is correctly formatted in the Authorization header
- Confirm that you are using an admin token, not a client token

### Client Not Found

If you receive a 404 Not Found response:
- Verify that the clientId in the URL is correct
- Check that the client exists in the system
- Ensure there are no typos in the clientId

### Validation Errors

If you receive a 400 Bad Request response:
- Check that all field values are in the correct format
- Ensure phone numbers are in E.164 format (+12125551234)
- Verify that email addresses are correctly formatted
