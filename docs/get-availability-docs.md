# Get Calendar Availability

This document details how to use the `/get-availability` endpoint to retrieve available time slots from a GoHighLevel calendar.

## Overview

The Get Calendar Availability endpoint allows clients to retrieve free time slots for a specified date range. It uses the calendar ID (calId) stored in the client's account and handles all authentication with GoHighLevel automatically.

## Endpoint Details

**Endpoint:** `GET /get-availability`  
**Authentication Required:** Yes (Client JWT token)  
**Method:** GET

## Request Parameters

All parameters are optional as the endpoint uses sensible defaults.

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `startDate` | String | Start date to check availability (YYYY-MM-DD or ISO 8601 format) | Current date |
| `endDate` | String | End date to check availability (YYYY-MM-DD or ISO 8601 format) | 7 days from now |
| `timezone` | String | Timezone for returned slots (IANA timezone format) | "America/New_York" |
| `enableLookBusy` | Boolean | Whether to apply "look busy" setting from GHL | false |

## Authentication

This endpoint requires authentication using a JWT token obtained through the client login process. The token must be included in the `Authorization` header:

```
Authorization: Bearer {your_jwt_token}
```

## Example Request

### Minimal Request (Using Defaults)

```bash
curl -X GET "https://api.v1.affinitydesign.ca/get-availability" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Complete Request (With All Parameters)

```bash
curl -X GET "https://api.v1.affinitydesign.ca/get-availability?startDate=2025-04-01&endDate=2025-04-07&timezone=America/Chicago&enableLookBusy=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## Response Format

A successful request will return a JSON response with the following structure:

```json
{
  "requestId": "lqfvz0ywd3jp4ph46",
  "dateRange": {
    "start": "2025-04-01T00:00:00.000Z",
    "end": "2025-04-07T23:59:59.999Z"
  },
  "timezone": "America/Chicago",
  "availability": {
    "_dates_": {
      "slots": [
        "2025-04-01T09:00:00-05:00",
        "2025-04-01T10:00:00-05:00",
        "2025-04-01T11:00:00-05:00",
        "2025-04-01T13:00:00-05:00",
        "2025-04-01T14:00:00-05:00",
        "2025-04-01T15:00:00-05:00",
        "2025-04-01T16:00:00-05:00",
        "2025-04-02T09:00:00-05:00",
        "2025-04-02T10:00:00-05:00",
        "2025-04-02T11:00:00-05:00",
        "2025-04-02T13:00:00-05:00",
        "2025-04-02T14:00:00-05:00",
        "2025-04-02T15:00:00-05:00",
        "2025-04-02T16:00:00-05:00"
        // ... more available time slots
      ]
    }
  },
  "slots": [
    "2025-04-01T09:00:00-05:00",
    "2025-04-01T10:00:00-05:00",
    "2025-04-01T11:00:00-05:00",
    "2025-04-01T13:00:00-05:00",
    "2025-04-01T14:00:00-05:00",
    "2025-04-01T15:00:00-05:00",
    "2025-04-01T16:00:00-05:00",
    "2025-04-02T09:00:00-05:00",
    "2025-04-02T10:00:00-05:00",
    "2025-04-02T11:00:00-05:00",
    "2025-04-02T13:00:00-05:00",
    "2025-04-02T14:00:00-05:00",
    "2025-04-02T15:00:00-05:00",
    "2025-04-02T16:00:00-05:00"
    // ... more available time slots
  ]
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | String | Unique identifier for this request (useful for troubleshooting) |
| `dateRange` | Object | Start and end dates used for the query (in ISO 8601 format) |
| `timezone` | String | Timezone used for the returned slots |
| `availability` | Object | Raw response from the GoHighLevel API |
| `slots` | Array | Convenient array of available time slots (same as `availability._dates_.slots`) |

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "No token provided"
}
```

**Resolution**: Ensure you are providing a valid JWT token in the Authorization header.

### 400 Bad Request

```json
{
  "error": "Client does not have a calendar ID configured",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Contact support to have a calendar ID (calId) configured for your account.

### 400 Bad Request

```json
{
  "error": "Client does not have GHL integration set up",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Complete the GoHighLevel integration process for your account.

### 403 Forbidden

```json
{
  "error": "GHL authentication failed",
  "details": "The GHL integration may need to be re-authorized",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Your GHL integration token may have expired. Contact support to re-authorize the integration.

### 404 Not Found

```json
{
  "error": "Calendar not found or invalid",
  "details": "GHL API error: 404 Not Found",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: The calendar ID stored in your account may be invalid. Contact support to update your calendar ID.

### 500 Internal Server Error

```json
{
  "error": "Failed to get availability",
  "details": "Error message details",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: An unexpected error occurred. If the issue persists, contact support with the requestId for assistance.

## Timezone Format

The timezone parameter must use the IANA timezone database format. Some common timezone values include:

- "America/New_York" (Eastern Time)
- "America/Chicago" (Central Time)
- "America/Denver" (Mountain Time)
- "America/Los_Angeles" (Pacific Time)
- "Europe/London" (GMT/BST)
- "Europe/Paris" (Central European Time)
- "Asia/Tokyo" (Japan Standard Time)
- "Australia/Sydney" (Australian Eastern Time)

For a complete list, see the [IANA Time Zone Database](https://www.iana.org/time-zones).

## Date Format

When specifying dates, you can use these formats:

- **ISO 8601**: "2025-04-01T00:00:00Z" (most precise)
- **Simple date**: "2025-04-01" (will use 00:00:00 as the time)
- **Unix timestamp**: 1743667200000 (milliseconds since epoch)

## Usage Tips

1. **Start Small**: Begin by requesting a short date range (e.g., 1-2 days) to ensure faster response times.

2. **Cache Results**: Consider caching the results for a reasonable period (e.g., 5-15 minutes) to reduce API calls, especially if you're building a booking interface.

3. **Handle Timezones Properly**: The slots returned will be in the requested timezone. Make sure to display this to users clearly.

4. **Slot Duration**: The slots returned typically represent the start times of available appointments. The duration of each slot depends on your calendar settings in GoHighLevel.

## Next Steps

After retrieving available slots, you can use the `/book-appointment` endpoint to schedule an appointment in one of the available slots.
