# Call Statistics Documentation

## Overview

This document details the call statistics functionality in the Eleven Labs Outbound Caller system. Call statistics provide clients and administrators with analytical insights into call performance, outcomes, and usage patterns. The system collects raw call data during call operations and processes this data to generate meaningful statistics when requested.

## Retrieving Call Statistics

### Client Statistics Endpoint

Clients can retrieve their own call statistics through the secure endpoint.

**Endpoint:** `GET /secure/call-stats`  
**Authentication:** Client JWT token required  
**Content-Type:** application/json

**Sample Request:**
```bash
curl -X GET "https://api.v1.affinitydesign.ca/secure/call-stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Sample Response:**
```json
{
  "clientId": "client_12345abcde",
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

### Admin Statistics Endpoint

Administrators can retrieve statistics for any client.

**Endpoint:** `GET /admin/clients/:clientId/call-stats`  
**Authentication:** Admin JWT token required  
**Content-Type:** application/json

**URL Parameters:**
- `clientId` - ID of the client whose statistics should be retrieved

**Sample Request:**
```bash
curl -X GET "https://api.v1.affinitydesign.ca/admin/clients/client_12345abcde/call-stats" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Sample Response:**
Same format as client statistics response.

## Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| totalCalls | Number | Total number of calls made by the client |
| callsByStatus | Object | Distribution of calls by their current status |
| callsByOutcome | Object | Distribution of calls by their outcome (agent assessment) |
| callsBySentiment | Object | Distribution of calls by sentiment analysis |
| totalDuration | Number | Total duration of all calls in seconds |
| averageDuration | Number | Average call duration in seconds |

### Call Status Categories

- **initiated** - Call has been requested but not yet connected
- **in-progress** - Call is currently active
- **completed** - Call ended normally
- **failed** - Call encountered a technical error
- **no-answer** - Call was not answered by the recipient

### Call Outcome Categories

- **interested** - Prospect showed interest in the offering
- **not-interested** - Prospect explicitly declined the offering
- **callback** - Prospect requested a follow-up call
- **unavailable** - Prospect was not available to complete the call
- **unknown** - Outcome could not be determined

### Call Sentiment Categories

- **positive** - Call had a positive tone and reception
- **neutral** - Call had a neutral tone
- **negative** - Call had a negative tone or reception
- **unknown** - Sentiment could not be determined

## Setting Call Statistics

Call statistics are not directly set through an API endpoint. Instead, they are derived from the raw call data that is updated throughout the call lifecycle. This data-driven approach ensures statistics accurately reflect actual call activity.

### Call Data Update Process

1. **Call Initiation:**  
   When a call is created, basic call data is stored:

   ```javascript
   // When creating a new call
   const callData = {
     callData: {
       callSid: call.sid,
       requestId: requestId,
       phone: phone,
       from: client.twilioPhoneNumber,
       agentId: client.agentId,
       startTime: new Date(),
       status: "initiated",
       callCount: 1
     },
     callDetails: {
       callOutcome: "",
       callSummary: "",
       callTranscript: ""
     }
   };
   
   // Add to client's call history
   await addCallToHistory(client.clientId, callData);
   ```

2. **Status Updates:**  
   The `/call-status` webhook receives updates from Twilio and updates the call record:

   ```bash
   curl -X POST "https://api.v1.affinitydesign.ca/call-status" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "CallSid=CAXXXXXXXXXXXXXXXX&CallStatus=completed&CallDuration=120"
   ```

   This updates the call record with status and duration information.

3. **Call Details Update:**  
   After a call completes, additional details can be updated:

   ```bash
   curl -X PUT "https://api.v1.affinitydesign.ca/admin/clients/client_12345abcde/calls/call_id_here" \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     -H "Content-Type: application/json" \
     -d '{
       "callDetails": {
         "callOutcome": "interested",
         "callSummary": "Customer expressed interest in premium plan",
         "callSentiment": "positive"
       }
     }'
   ```

## Implementation Details

### Database Schema

Call statistics rely on the following fields in the call history record:

```javascript
const callDataSchema = new mongoose.Schema({
  callSid: { type: String, required: true },
  requestId: { type: String },
  phone: { type: String, required: true },
  from: { type: String, required: true },
  agentId: { type: String, required: true },
  startTime: { type: Date },
  endTime: { type: Date },
  duration: { type: Number },
  callCount: { type: Number, default: 1 },
  status: { type: String, enum: ["initiated", "in-progress", "completed", "failed", "no-answer"], required: true },
  recordingUrl: { type: String }
});

const callDetailsSchema = new mongoose.Schema({
  callOutcome: { type: String, enum: ["interested", "not-interested", "callback", "unavailable", "unknown"] },
  callSummary: { type: String },
  callTranscript: { type: String },
  callSentiment: { type: String, enum: ["positive", "neutral", "negative", "unknown"] },
  nextAction: { type: String },
  nextActionDate: { type: Date },
  agentNotes: { type: String }
});
```

### Statistics Calculation Function

The core statistics calculation happens when the client or admin requests statistics:

```javascript
// Calculate call statistics
const callHistory = client.callHistory || [];

const stats = {
  totalCalls: callHistory.length,
  callsByStatus: {
    initiated: 0,
    "in-progress": 0,
    completed: 0,
    failed: 0,
    "no-answer": 0
  },
  callsByOutcome: {
    interested: 0,
    "not-interested": 0,
    callback: 0,
    unavailable: 0,
    unknown: 0
  },
  callsBySentiment: {
    positive: 0,
    neutral: 0,
    negative: 0,
    unknown: 0
  },
  totalDuration: 0,
  averageDuration: 0
};

// Calculate stats
callHistory.forEach((call) => {
  // Status stats
  if (call.callData && call.callData.status) {
    const status = call.callData.status;
    if (stats.callsByStatus[status] !== undefined) {
      stats.callsByStatus[status]++;
    }
  }

  // Outcome stats
  if (call.callDetails && call.callDetails.callOutcome) {
    const outcome = call.callDetails.callOutcome;
    if (stats.callsByOutcome[outcome] !== undefined) {
      stats.callsByOutcome[outcome]++;
    }
  } else {
    stats.callsByOutcome.unknown++;
  }

  // Sentiment stats
  if (call.callDetails && call.callDetails.callSentiment) {
    const sentiment = call.callDetails.callSentiment;
    if (stats.callsBySentiment[sentiment] !== undefined) {
      stats.callsBySentiment[sentiment]++;
    }
  } else {
    stats.callsBySentiment.unknown++;
  }

  // Duration stats
  if (call.callData && call.callData.duration) {
    stats.totalDuration += call.callData.duration;
  }
});

// Calculate average duration
if (stats.totalCalls > 0) {
  stats.averageDuration = Math.round(stats.totalDuration / stats.totalCalls);
}
```

## Best Practices

1. **Regular Status Updates:**  
   Ensure that the Twilio webhook configuration includes the correct URL for the `/call-status` endpoint to receive timely call status updates.

2. **Complete Call Records:**  
   When a call completes, update the call details with outcome, sentiment, and summary information to enable accurate statistics.

3. **Periodic Audits:**  
   Regularly check for calls with missing data (e.g., those with "unknown" outcomes or sentiments) to ensure data quality.

4. **Statistics Interpretation:**  
   When analyzing call statistics, consider:
   - Trends over time rather than isolated data points
   - Correlation between call outcomes and other factors like time of day or call duration
   - Patterns in sentiment across different types of prospects

## Security Considerations

1. **Authentication:**  
   All call statistics access is protected by JWT authentication to ensure only authorized users can access this data.

2. **Data Segmentation:**  
   Clients can only access their own call statistics, while administrators can access statistics for any client.

3. **Sensitive Information:**  
   Call transcripts and detailed records should be handled with appropriate data protection measures, especially if they may contain personally identifiable information.
