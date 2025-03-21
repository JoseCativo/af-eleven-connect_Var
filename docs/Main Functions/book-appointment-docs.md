# Book Appointment

This document details how to use the `/book-appointment` endpoint to schedule appointments in a GoHighLevel calendar.

## Overview

The Book Appointment endpoint allows clients to schedule appointments in their GoHighLevel calendar. The endpoint automatically uses the calendar ID (calId) stored in your client account, finds the contact by phone number, and handles all authentication with GoHighLevel.

## Endpoint Details

**Endpoint:** `POST /book-appointment`  
**Authentication Required:** Yes (Client JWT token)  
**Method:** POST  
**Content-Type:** application/json

## Request Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `startTime` | String | Appointment start time (ISO 8601 format with timezone) | Yes |
| `endTime` | String | Appointment end time (ISO 8601 format with timezone) | Yes |
| `phone` | String | Phone number of the contact (E.164 format recommended) | Yes |
| `meeting_title` | String | Title component for the appointment | No (defaults to "Consultation") |

## Authentication

This endpoint requires authentication using a JWT token obtained through the client login process. The token must be included in the `Authorization` header:

```
Authorization: Bearer {your_jwt_token}
```

## Example Request

```bash
curl -X POST "https://api.v1.affinitydesign.ca/book-appointment" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2025-04-01T10:00:00-04:00",
    "endTime": "2025-04-01T11:00:00-04:00",
    "phone": "+15551234567",
    "meeting_title": "Strategy Session"
  }'
```

## Request Body Details

### startTime and endTime

The appointment start and end times must be provided in ISO 8601 format with timezone information. Examples:

- `"2025-04-01T10:00:00-04:00"` (Eastern Daylight Time)
- `"2025-04-01T09:00:00-05:00"` (Central Daylight Time)
- `"2025-04-01T14:00:00Z"` (UTC)

### phone

The phone number of the contact in GoHighLevel. This must be a phone number associated with an existing contact in your GoHighLevel account. The system will search for this contact to create the appointment.

E.164 format is recommended: country code + phone number without spaces or special characters (e.g., `+15551234567`).

### meeting_title

An optional title component for the appointment. This will be used to create the full title in the format:

```
{Contact First Name} x {Your Business Name} - {meeting_title}
```

If not provided, "Consultation" will be used as the default.

## Fixed Parameters

The following parameters are set automatically by the system:

- **calendarId**: Uses the calId from your client account
- **meetingLocationType**: Always set to "default"
- **appointmentStatus**: Always set to "new"
- **address**: Always set to "Google Meet"
- **ignoreDateRange**: Always set to false
- **toNotify**: Always set to true
- **ignoreFreeSlotValidation**: Always set to false

## Response Format

A successful request will return a JSON response with the following structure:

```json
{
  "requestId": "lqfvz0ywd3jp4ph46",
  "status": "success",
  "message": "Appointment booked successfully",
  "appointmentId": "CVokAlI8fgw4WYWoCtQz",
  "details": {
    "calendarId": "e0JBV5PARC9sbebxcYnY",
    "locationId": "5C3JSOVVFiVmBoh8mv3I",
    "contactId": "102goXVW3lIExEQPOnd3",
    "startTime": "2025-04-01T10:00:00-04:00",
    "endTime": "2025-04-01T11:00:00-04:00",
    "title": "John x Acme Corp - Strategy Session",
    "status": "new",
    "address": "Google Meet",
    "isRecurring": false
  },
  "contact": {
    "id": "102goXVW3lIExEQPOnd3",
    "name": "John Smith",
    "phone": "+15551234567",
    "email": "john@example.com"
  },
  "notification": {
    "message": "Contact has a phone number. You can use make-outbound-call to send a confirmation.",
    "phone": "+15551234567"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | String | Unique identifier for this request (useful for troubleshooting) |
| `status` | String | Status of the operation ("success") |
| `message` | String | Description of the result |
| `appointmentId` | String | Unique identifier for the created appointment in GHL |
| `details` | Object | Details of the created appointment |
| `details.calendarId` | String | Calendar ID used for the appointment |
| `details.locationId` | String | Location ID (same as your clientId) |
| `details.contactId` | String | Contact ID in GHL |
| `details.startTime` | String | Appointment start time |
| `details.endTime` | String | Appointment end time |
| `details.title` | String | Full title of the appointment |
| `details.status` | String | Appointment status ("new") |
| `details.address` | String | Meeting location ("Google Meet") |
| `details.isRecurring` | Boolean | Whether the appointment is recurring (always false) |
| `contact` | Object | Information about the contact |
| `contact.id` | String | Contact ID in GHL |
| `contact.name` | String | Contact's full name |
| `contact.phone` | String | Contact's phone number |
| `contact.email` | String | Contact's email (if available) |
| `notification` | Object | Optional notification information (present if Twilio is configured) |

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "No token provided"
}
```

**Resolution**: Ensure you are providing a valid JWT token in the Authorization header.

### 400 Bad Request - Missing Required Parameters

```json
{
  "error": "Both startTime and endTime are required",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Make sure to include all required parameters (startTime, endTime, phone) in your request.

### 400 Bad Request - No Calendar ID

```json
{
  "error": "Client does not have a calendar ID configured",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Contact support to have a calendar ID (calId) configured for your account.

### 400 Bad Request - No GHL Integration

```json
{
  "error": "Client does not have GHL integration set up",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Complete the GoHighLevel integration process for your account.

### 404 Not Found - Contact Not Found

```json
{
  "error": "Contact not found in GoHighLevel",
  "details": "No contact exists with the provided phone number",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Ensure the contact exists in your GoHighLevel account with the exact phone number provided.

### 409 Conflict - Time Slot Unavailable

```json
{
  "error": "Time slot is no longer available",
  "details": "GHL appointment API error: 409 - The slot is already booked",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Check availability using the `/get-availability` endpoint and select a different time slot.

### 403 Forbidden - GHL Authentication Failed

```json
{
  "error": "GHL authentication failed",
  "details": "The GHL integration may need to be re-authorized",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: Your GHL integration token may have expired. Contact support to re-authorize the integration.

### 404 Not Found - Invalid Calendar

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
  "error": "Failed to book appointment",
  "details": "Error message details",
  "requestId": "lqfvz0ywd3jp4ph46"
}
```

**Resolution**: An unexpected error occurred. If the issue persists, contact support with the requestId for assistance.

## Best Practices

### 1. Check Availability First

Always use the `/get-availability` endpoint to check for available time slots before attempting to book an appointment. This reduces the likelihood of booking conflicts.

### 2. Use Proper Time Formats

Make sure to include timezone information in your startTime and endTime values to avoid timezone confusion.

### 3. Confirm Contact Exists

Ensure the contact exists in your GoHighLevel account before attempting to book an appointment. The endpoint requires an existing contact.

### 4. Handle Errors Gracefully

Be prepared to handle error responses, especially 409 Conflict errors, which indicate that the requested time slot is no longer available.

### 5. Use Descriptive Meeting Titles

Provide a clear and descriptive meeting_title to help identify the purpose of the appointment in your calendar.

## Related Endpoints

- **GET /get-availability**: Use this endpoint to check for available time slots before booking an appointment.

## Appointment Title Format

The appointment title is automatically generated using the following format:

```
{Contact First Name} x {Your Business Name} - {meeting_title}
```

For example, if:
- The contact's first name is "John"
- Your business name (from your client record) is "Acme Corp"
- The meeting_title is "Strategy Session"

The resulting title would be:
```
John x Acme Corp - Strategy Session
```

## Appointment Location

All appointments are set with "Google Meet" as the location. This is a fixed setting and cannot be changed through the API.

## Appointment Notifications

By default, all appointments will trigger notifications in GoHighLevel based on your calendar settings. The toNotify parameter is always set to true.
