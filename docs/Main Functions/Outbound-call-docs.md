# Making Outbound Calls API Documentation

## Overview

The Outbound Call API enables authenticated clients to initiate automated calls using the ElevenLabs Conversational AI system. This endpoint handles all aspects of call initiation, including Twilio integration, dynamic variable passing, and call history tracking.

## Endpoint Details

**Endpoint:** `POST /secure/make-call`  
**Authentication Required:** Yes (Client JWT token)  
**Method:** POST  
**Content-Type:** application/json

## Authentication Requirements

This endpoint requires a valid client authentication token to be included in the request headers. The token must be obtained through the `/auth/login` endpoint.

**Authorization Header Format:**

```
Authorization: Bearer <client_jwt_token>
```

## Request Format

The request body should contain the destination phone number in E.164 format.

```json
{
  "phone": "+12125551234"
}
```

### Required Fields

- **phone**: The destination phone number in E.164 format (e.g., +12125551234)

## Response Format

A successful request will return a JSON response with the following structure:

```json
{
  "success": true,
  "message": "Call initiated successfully",
  "callSid": "CA9c5c476e1d4e4fb3b8c6f93e46f1039c",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

### Response Fields

| Field     | Type    | Description                                      |
| --------- | ------- | ------------------------------------------------ |
| success   | Boolean | Indicates if the call was successfully initiated |
| message   | String  | A status message describing the result           |
| callSid   | String  | The unique Twilio Call SID for tracking the call |
| requestId | String  | A unique identifier for this specific request    |

## Call Flow Process

When a call is initiated:

1. The system validates the destination phone number
2. Client information is retrieved from the database
3. A webhook URL is constructed with dynamic variables from the client profile
4. A Twilio call is created with the specified parameters
5. Call metadata is stored in the client's call history
6. The call connects the recipient with the AI agent

## Error Responses

### 400 Bad Request - Missing Phone Number

```json
{
  "error": "Destination phone number is required",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

### 400 Bad Request - Invalid Phone Format

```json
{
  "error": "Phone number must be in E.164 format (e.g., +12125551234)",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

### 404 Not Found - Client Not Found

```json
{
  "error": "Client not found",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

### 403 Forbidden - Inactive Client

```json
{
  "error": "Client is not active (status: Inactive)",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

### 500 Internal Server Error - Twilio Service Unavailable

```json
{
  "error": "Twilio service unavailable",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

### Twilio-Specific Errors

For Twilio-specific errors, the system returns appropriate status codes and resolution suggestions:

```json
{
  "error": "Invalid 'To' phone number",
  "details": "The requested resource was not found",
  "resolution": "Check the phone number format and try again",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

## Example Usage

### cURL

```bash
curl -X POST https://api.v1.affinitydesign.ca/secure/make-call \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+12125551234"
  }'
```

### JavaScript

```javascript
const response = await fetch(
  "https://api.v1.affinitydesign.ca/secure/make-call",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + clientToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: "+12125551234",
    }),
  }
);

const data = await response.json();
console.log("Call initiated:", data);
```

## Best Practices

1. **Phone Number Validation**: Always ensure phone numbers are in valid E.164 format (+[country code][number]) before making requests.

2. **Error Handling**: Implement robust error handling to manage failed call attempts gracefully, particularly focusing on Twilio-specific error codes.

3. **Call Tracking**: Store the `requestId` and `callSid` values to track call status and for troubleshooting purposes.

4. **Rate Limiting**: Avoid initiating too many calls simultaneously to prevent rate limiting by Twilio or system overloading.

5. **Testing**: Test with verified phone numbers during development to avoid unnecessary charges.

## Limitations

- The destination phone number must be a valid phone capable of receiving voice calls.
- Call quality and connectivity depend on both the destination network and Twilio's service.
- Each client has a predefined Twilio phone number that will be used as the caller ID.

## Related Endpoints

- **GET /secure/calls** - Retrieve call history for the authenticated client
- **GET /secure/calls/:callId** - Get detailed information about a specific call
- **GET /secure/call-stats** - Get statistical information about calls made by the client
