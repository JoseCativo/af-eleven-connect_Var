# CRUD Endpoints Documentation

## Overview

This document details the CRUD (Create, Read, Update, Delete) endpoints available in the Eleven Labs Outbound Caller system. The API is organized into two main access levels:

1. **Admin API** (`/admin/*`) - Secured endpoints for system administrators
2. **Client API** (`/secure/*`) - Secured endpoints for authenticated clients

All authenticated endpoints require a valid JWT token in the Authorization header using the Bearer scheme.

## Authentication Requirements

| Access Level | Header Format | Description |
|--------------|--------------|-------------|
| **Admin** | `Authorization: Bearer <admin_token>` | Requires an admin token generated via `/auth/admin/login` |
| **Client** | `Authorization: Bearer <client_token>` | Requires a client token generated via `/auth/login` |

## Client Management Endpoints

### Create Client (Admin Only)

Creates a new client in the system.

**Endpoint:** `POST /admin/clients`  
**Authentication:** Admin token required  
**Content-Type:** application/json

**Request Body:**

```json
{
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
}
```

**Required Fields:**
- `clientMeta.fullName`
- `clientMeta.email`
- `clientMeta.phone`
- `agentId`
- `twilioPhoneNumber`

**Response (201 Created):**

```json
{
  "message": "Client created successfully",
  "client": {
    "clientId": "generated_client_id",
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

**Error Responses:**

- **400 Bad Request** - Missing required fields
- **409 Conflict** - Client already exists with this ID or email
- **500 Internal Server Error** - Server-side error

### Get All Clients (Admin Only)

Retrieves a list of all clients in the system with optional filtering and pagination.

**Endpoint:** `GET /admin/clients`  
**Authentication:** Admin token required

**Query Parameters:**

- `limit` (optional) - Number of clients to return (default: 10)
- `offset` (optional) - Number of clients to skip (default: 0)
- `status` (optional) - Filter by client status (e.g., "Active", "Inactive")
- `search` (optional) - Search term for client name, email, or business name

**Response (200 OK):**

```json
{
  "total": 100,
  "count": 10,
  "clients": [
    {
      "clientId": "client_id_1",
      "status": "Active",
      "agentId": "agent_id_here",
      "twilioPhoneNumber": "+18001234567",
      "clientMeta": {
        "fullName": "John Doe",
        "email": "john@example.com",
        "phone": "+12125551234",
        "businessName": "Acme Corp",
        "city": "New York",
        "jobTitle": "CEO"
      },
      "createdAt": "2025-03-20T12:00:00.000Z",
      "updatedAt": "2025-03-20T12:00:00.000Z"
    },
    // Additional clients...
  ]
}
```

**Error Response:**

- **500 Internal Server Error** - Server-side error

### Get Client by ID (Admin/Client)

Retrieves a specific client by ID. Admin can access any client, while authenticated clients can only access their own information.

**Admin Endpoint:** `GET /admin/clients/:clientId`  
**Client Endpoint:** `GET /secure/client`  
**Authentication:** Admin token or Client token required

**URL Parameters (Admin only):**
- `clientId` - ID of the client to retrieve

**Response (200 OK):**

```json
{
  "clientId": "client_id_here",
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
  "updatedAt": "2025-03-20T12:00:00.000Z",
  "callHistory": [
    // Array of call history records (if included)
  ]
}
```

**Error Responses:**

- **404 Not Found** - Client not found
- **500 Internal Server Error** - Server-side error

### Update Client (Admin/Client)

Updates a client's information. Admin can update any client, while authenticated clients can only update their own information with limited fields.

**Admin Endpoint:** `PUT /admin/clients/:clientId`  
**Client Endpoint:** `PUT /secure/client`  
**Authentication:** Admin token or Client token required  
**Content-Type:** application/json

**URL Parameters (Admin only):**
- `clientId` - ID of the client to update

**Request Body (Admin - all fields optional):**

```json
{
  "status": "Active",
  "agentId": "new_agent_id",
  "twilioPhoneNumber": "+18009876543",
  "clientMeta": {
    "fullName": "John Doe Updated",
    "email": "john.updated@example.com",
    "phone": "+12125551234",
    "businessName": "Acme Corp Updated",
    "city": "Boston",
    "jobTitle": "CTO",
    "notes": "Updated notes"
  }
}
```

**Request Body (Client - limited fields):**

```json
{
  "clientMeta": {
    "fullName": "John Doe Updated",
    "phone": "+12125551234",
    "businessName": "Acme Corp Updated",
    "city": "Boston",
    "jobTitle": "CTO",
    "notes": "Updated notes"
  }
}
```

**Response (200 OK):**

```json
{
  "message": "Client updated successfully",
  "client": {
    "clientId": "client_id_here",
    "status": "Active",
    "updatedAt": "2025-03-20T12:30:00.000Z"
  }
}
```

**Error Responses:**

- **400 Bad Request** - Invalid update data
- **404 Not Found** - Client not found
- **500 Internal Server Error** - Server-side error

### Delete Client (Admin Only)

Deletes a client from the system.

**Endpoint:** `DELETE /admin/clients/:clientId`  
**Authentication:** Admin token required

**URL Parameters:**
- `clientId` - ID of the client to delete

**Response (200 OK):**

```json
{
  "message": "Client deleted successfully"
}
```

**Error Responses:**

- **404 Not Found** - Client not found
- **500 Internal Server Error** - Server-side error

### Reset Client Secret (Admin Only)

Resets a client's secret key used for authentication.

**Endpoint:** `POST /admin/clients/:clientId/reset-secret`  
**Authentication:** Admin token required

**URL Parameters:**
- `clientId` - ID of the client to reset secret

**Response (200 OK):**

```json
{
  "message": "Client secret reset successfully",
  "client": {
    "clientId": "client_id_here",
    "clientSecret": "new_generated_secret"
  }
}
```

**Error Responses:**

- **404 Not Found** - Client not found
- **500 Internal Server Error** - Server-side error

## Call History Endpoints

### Get Client Call History (Admin/Client)

Retrieves the call history for a specific client. Admin can access any client's history, while authenticated clients can only access their own history.

**Admin Endpoint:** `GET /admin/clients/:clientId/calls`  
**Client Endpoint:** `GET /secure/calls`  
**Authentication:** Admin token or Client token required

**URL Parameters (Admin only):**
- `clientId` - ID of the client

**Query Parameters:**
- `limit` (optional) - Number of calls to return (default: all)
- `offset` (optional) - Number of calls to skip (default: 0)
- `status` (optional) - Filter by call status

**Response (200 OK):**

```json
{
  "clientId": "client_id_here",
  "total": 50,
  "filtered": 10,
  "callHistory": [
    {
      "callId": "call_id_1",
      "callData": {
        "callSid": "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        "requestId": "request_id_here",
        "phone": "+12125551234",
        "from": "+18001234567",
        "agentId": "agent_id_here",
        "startTime": "2025-03-20T12:00:00.000Z",
        "endTime": "2025-03-20T12:15:00.000Z",
        "duration": 900,
        "status": "completed",
        "recordingUrl": "https://api.twilio.com/recordings/REXXXXXXXX"
      },
      "callDetails": {
        "callOutcome": "interested",
        "callSummary": "Client expressed interest in our premium plan",
        "callTranscript": "Agent: Hello, this is... Client: Hi, I'm interested in...",
        "callSentiment": "positive",
        "nextAction": "schedule_follow_up",
        "nextActionDate": "2025-03-27T12:00:00.000Z",
        "agentNotes": "Follow up with discount code"
      }
    },
    // Additional call records...
  ]
}
```

**Error Responses:**

- **404 Not Found** - Client not found
- **500 Internal Server Error** - Server-side error

### Get Specific Call Details (Admin/Client)

Retrieves details for a specific call. Admin can access any call, while authenticated clients can only access their own calls.

**Admin Endpoint:** (Not explicitly defined in provided code)  
**Client Endpoint:** `GET /secure/calls/:callId`  
**Authentication:** Admin token or Client token required

**URL Parameters:**
- `callId` - ID of the call to retrieve

**Response (200 OK):**

```json
{
  "callId": "call_id_here",
  "callData": {
    "callSid": "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "requestId": "request_id_here",
    "phone": "+12125551234",
    "from": "+18001234567",
    "agentId": "agent_id_here",
    "startTime": "2025-03-20T12:00:00.000Z",
    "endTime": "2025-03-20T12:15:00.000Z",
    "duration": 900,
    "status": "completed",
    "recordingUrl": "https://api.twilio.com/recordings/REXXXXXXXX"
  },
  "callDetails": {
    "callOutcome": "interested",
    "callSummary": "Client expressed interest in our premium plan",
    "callTranscript": "Agent: Hello, this is... Client: Hi, I'm interested in...",
    "callSentiment": "positive",
    "nextAction": "schedule_follow_up",
    "nextActionDate": "2025-03-27T12:00:00.000Z",
    "agentNotes": "Follow up with discount code"
  }
}
```

**Error Responses:**

- **404 Not Found** - Call not found
- **500 Internal Server Error** - Server-side error

### Add Call to Client History (Admin/Internal)

Adds a new call record to a client's history.

**Endpoint:** `POST /admin/clients/:clientId/calls`  
**Authentication:** Admin token required  
**Content-Type:** application/json

**URL Parameters:**
- `clientId` - ID of the client

**Request Body:**

```json
{
  "callData": {
    "callSid": "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "requestId": "request_id_here",
    "phone": "+12125551234",
    "from": "+18001234567",
    "agentId": "agent_id_here",
    "startTime": "2025-03-20T12:00:00.000Z",
    "status": "initiated",
    "callCount": 1
  },
  "callDetails": {
    "callOutcome": "",
    "callSummary": "",
    "callTranscript": ""
  }
}
```

**Response (200 OK):**

```json
{
  "message": "Call added to history successfully",
  "callId": "generated_call_id"
}
```

**Error Responses:**

- **404 Not Found** - Client not found
- **400 Bad Request** - Invalid call data
- **500 Internal Server Error** - Server-side error

### Update Call Details (Admin/Internal)

Updates the details of a specific call in a client's history.

**Endpoint:** `PUT /admin/clients/:clientId/calls/:callId`  
**Authentication:** Admin token required  
**Content-Type:** application/json

**URL Parameters:**
- `clientId` - ID of the client
- `callId` - ID of the call to update

**Request Body:**

```json
{
  "callDetails": {
    "callOutcome": "interested",
    "callSummary": "Client expressed interest in our premium plan",
    "callTranscript": "Agent: Hello, this is... Client: Hi, I'm interested in...",
    "callSentiment": "positive",
    "nextAction": "schedule_follow_up",
    "nextActionDate": "2025-03-27T12:00:00.000Z",
    "agentNotes": "Follow up with discount code"
  },
  "callData": {
    "endTime": "2025-03-20T12:15:00.000Z",
    "duration": 900,
    "status": "completed",
    "recordingUrl": "https://api.twilio.com/recordings/REXXXXXXXX"
  }
}
```

**Response (200 OK):**

```json
{
  "message": "Call details updated successfully"
}
```

**Error Responses:**

- **404 Not Found** - Client or call not found
- **400 Bad Request** - Invalid update data
- **500 Internal Server Error** - Server-side error

## Make Outbound Call Endpoints

### Initiate Outbound Call (Admin/Client)

Initiates an outbound call using the configured Twilio and ElevenLabs services.

**Admin Endpoint:** `POST /admin/clients/:clientId/make-call`  
**Client Endpoint:** `POST /secure/make-call`  
**Authentication:** Admin token or Client token required  
**Content-Type:** application/json

**URL Parameters (Admin only):**
- `clientId` - ID of the client to make call on behalf of

**Request Body:**

```json
{
  "phone": "+12125551234"
}
```

**Required Fields:**
- `phone` - Destination phone number in E.164 format

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Call initiated successfully",
  "callSid": "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "requestId": "request_id_here"
}
```

**Error Responses:**

- **400 Bad Request** - Invalid phone number format
- **403 Forbidden** - Client is not active
- **404 Not Found** - Client not found
- **500 Internal Server Error** - Server-side error

## Dashboard and Statistics Endpoints

### Get Dashboard Statistics (Admin Only)

Retrieves dashboard statistics for administrative overview.

**Endpoint:** `GET /admin/dashboard`  
**Authentication:** Admin token required

**Response (200 OK):**

```json
{
  "clients": {
    "active": 120,
    "inactive": 30,
    "total": 150
  },
  "calls": {
    "recent": 45,
    "total": 1250,
    "byOutcome": {
      "interested": 350,
      "not-interested": 200,
      "callback": 400,
      "unavailable": 250,
      "unknown": 50
    },
    "byStatus": {
      "completed": 1000,
      "failed": 150,
      "no-answer": 100
    }
  }
}
```

**Error Response:**

- **500 Internal Server Error** - Server-side error

### Get Recent Activity (Admin Only)

Retrieves recent call activity across all clients.

**Endpoint:** `GET /admin/activity`  
**Authentication:** Admin token required

**Query Parameters:**
- `days` (optional) - Number of days to look back (default: 7)
- `limit` (optional) - Number of activities to return (default: 10)

**Response (200 OK):**

```json
{
  "period": "7 days",
  "count": 10,
  "activities": [
    {
      "clientId": "client_id_1",
      "clientName": "John Doe",
      "businessName": "Acme Corp",
      "callId": "call_id_1",
      "callSid": "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "phone": "+12125551234",
      "status": "completed",
      "startTime": "2025-03-20T12:00:00.000Z",
      "duration": 900,
      "outcome": "interested"
    },
    // Additional activity records...
  ]
}
```

**Error Response:**

- **500 Internal Server Error** - Server-side error

### Get Client Call Statistics (Client Only)

Retrieves call statistics for an authenticated client.

**Endpoint:** `GET /secure/call-stats`  
**Authentication:** Client token required

**Response (200 OK):**

```json
{
  "clientId": "client_id_here",
  "stats": {
    "totalCalls": 50,
    "callsByStatus": {
      "initiated": 5,
      "in-progress": 2,
      "completed": 40,
      "failed": 2,
      "no-answer": 1
    },
    "callsByOutcome": {
      "interested": 20,
      "not-interested": 10,
      "callback": 15,
      "unavailable": 3,
      "unknown": 2
    },
    "callsBySentiment": {
      "positive": 25,
      "neutral": 15,
      "negative": 5,
      "unknown": 5
    },
    "totalDuration": 25000,
    "averageDuration": 500
  }
}
```

**Error Responses:**

- **404 Not Found** - Client not found
- **500 Internal Server Error** - Server-side error
