# Retrieving Active Client Data (Admin)

## Overview

This document details the process for retrieving information about active clients in the Eleven Labs Outbound Caller system. This functionality is restricted to administrative users only and provides comprehensive data about clients with an active status in the system.

The endpoint allows administrators to obtain important client information including contact details, assigned agent configurations, Twilio phone number assignments, and other essential account metadata. This information is valuable for monitoring client accounts, providing support, and performing account management tasks.

## Authentication Requirements

This endpoint requires administrative authentication. Ensure you have a valid admin JWT token provided in the Authorization header.

**Authorization Header Format:**
```
Authorization: Bearer <admin_jwt_token>
```

## Endpoint Details

**Endpoint:** `GET /admin/clients`  
**Method:** GET  
**Authentication:** Admin JWT token required

## Query Parameters

The endpoint supports several query parameters to filter and customize the results:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| status | String | Filter clients by status (e.g., "Active") | None (returns all statuses) |
| limit | Number | Maximum number of clients to return | 10 |
| offset | Number | Number of clients to skip (for pagination) | 0 |
| search | String | Search term for client name, email, or business name | None |

## Sample Request

### Retrieving All Active Clients

```bash
curl -X GET "https://api.v1.affinitydesign.ca/admin/clients?status=Active" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Retrieving Active Clients with Pagination

```bash
curl -X GET "https://api.v1.affinitydesign.ca/admin/clients?status=Active&limit=5&offset=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Searching for Active Clients

```bash
curl -X GET "https://api.v1.affinitydesign.ca/admin/clients?status=Active&search=Acme" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Response Format

A successful request will return a JSON response with the following structure:

```json
{
  "total": 25,
  "count": 10,
  "clients": [
    {
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
    },
    // Additional client records...
  ]
}
```

## Response Field Descriptions

### Top-Level Fields

| Field | Type | Description |
|-------|------|-------------|
| total | Number | Total number of clients matching the query (before pagination) |
| count | Number | Number of clients in the current response |
| clients | Array | List of client objects matching the query parameters |

### Client Object Fields

| Field | Type | Description |
|-------|------|-------------|
| clientId | String | Unique identifier for the client |
| status | String | Client account status (e.g., "Active", "Inactive", "Suspended") |
| agentId | String | ID of the ElevenLabs conversational agent assigned to this client |
| twilioPhoneNumber | String | Twilio phone number assigned to this client (in E.164 format) |
| clientMeta | Object | Client metadata including contact information and business details |
| createdAt | String | ISO 8601 timestamp of when the client was created |
| updatedAt | String | ISO 8601 timestamp of when the client was last updated |

### Client Metadata Fields

| Field | Type | Description |
|-------|------|-------------|
| fullName | String | Client's full name |
| email | String | Client's email address |
| phone | String | Client's phone number (in E.164 format) |
| businessName | String | Client's company or organization name (if provided) |
| city | String | Client's city location (if provided) |
| jobTitle | String | Client's professional title (if provided) |
| notes | String | Additional notes about the client (if provided) |

## Common Error Responses

### Unauthorized Access

```json
{
  "error": "Unauthorized",
  "message": "Invalid token"
}
```

### Server Error

```json
{
  "error": "Failed to fetch clients",
  "details": "Database connection error"
}
```

## Troubleshooting

### Token Validation Issues

If you receive a 401 Unauthorized response:
- Verify that your admin token is valid and has not expired
- Ensure the token is correctly formatted in the Authorization header
- Confirm that you are using an admin token, not a client token

### No Results Returned

If your query returns an empty list of clients:
- Check that the filter parameters are correctly specified
- Verify that there are clients matching your search criteria
- Confirm that clients have the "Active" status if filtering by status

### Pagination Issues

If you're not seeing expected results with pagination:
- Verify the `limit` and `offset` parameters are correct
- Remember that `offset` is zero-indexed (the first page starts at offset 0)
- Consider that the total number of results may be less than expected
