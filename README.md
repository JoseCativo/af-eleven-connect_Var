### 11. Book an Appointment
After checking availability, you can book an appointment using the booking endpoint:

#### Using cURL

```bash
curl -X POST http://localhost:8000/book-appointment \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_GHL_API_KEY" \
-d '{
  "calendarId": "YOUR_CALENDAR_ID",
  "startTime": "2025-03-15T10:00:00.000Z",
  "endTime": "2025-03-15T11:00:00.000Z",
  "contactInfo": {
    "email": "client@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+12125551234"
  },
  "timezone": "America/New_York",
  "notes": "Client is interested in discussing product options"
}'
```

#### Using JavaScript/Fetch API

```javascript
fetch('http://localhost:8000/book-appointment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_GHL_API_KEY'
  },
  body: JSON.stringify({
    calendarId: 'YOUR_CALENDAR_ID',
    startTime: '2025-03-15T10:00:00.000Z',
    endTime: '2025-03-15T11:00:00.000Z',
    contactInfo: {
      email: 'client@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+12125551234'
    },
    timezone: 'America/New_York',
    notes: 'Client is interested in discussing product options'
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

#### Using Python/Requests

```python
import requests
import json

url = "http://localhost:8000/book-appointment"
headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_GHL_API_KEY"
}
payload = {
    "calendarId": "YOUR_CALENDAR_ID",
    "startTime": "2025-03-15T10:00:00.000Z",
    "endTime": "2025-03-15T11:00:00.000Z",
    "contactInfo": {
        "email": "client@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+12125551234"
    },
    "timezone": "America/New_York",
    "notes": "Client is interested in discussing product options"
}

response = requests.post(url, headers=headers, data=json.dumps(payload))
print(response.json())
```

#### Parameters

1. **Required Parameters**:
   - `calendarId`: The Go High Level calendar ID
   - `startTime`: Appointment start time in ISO format
   - `endTime`: Appointment end time in ISO format
   - `contactInfo`: Object containing at least an email address
   - `Authorization`: Bearer token with your Go High Level API key (header)

2. **Optional Parameters**:
   - `timezone`: Timezone for the appointment (defaults to system timezone)
   - `notes`: Additional notes for the appointment
   - Additional contact fields in the `contactInfo` object (firstName, lastName, phone, etc.)

#### Response Example

```json
{
  "requestId": "lq1ab3c7de",
  "status": "success",
  "message": "Appointment booked successfully",
  "appointmentId": "app_12345678",
  "details": {
    "calendarId": "YOUR_CALENDAR_ID",
    "startTime": "2025-03-15T10:00:00.000Z",
    "endTime": "2025-03-15T11:00:00.000Z",
    "timezone": "America/New_York",
    "contact": {
      "email": "client@example.com",
      "name": "John Doe"
    }
  },
  "notification": {
    "message": "Contact has a phone number. You can use make-outbound-call to send a confirmation.",
    "phone": "+12125551234"
  }
}### 9. Monitor Active Calls
```bash
curl http://localhost:8000/active-calls
```# Eleven Labs Outbound Caller  

This project demonstrates the integration of **Eleven Labs Conversational AI** with **Twilio** to enable seamless real-time interactions during outbound and inbound phone calls. The system leverages WebSockets for media streaming and integrates Eleven Labs' advanced conversational AI capabilities for human-like interactions.

---

## Features  
- **Outbound Call Integration**: Programmatically initiate outbound calls using Twilio's API.  
- **Real-Time Media Streaming**: Connect calls to Eleven Labs via WebSockets for audio input and output.  
- **AI-Powered Conversations**: Use Eleven Labs Conversational AI to create dynamic, human-like dialogues.  
- **Dynamic Configuration API**: Configure Twilio credentials, phone numbers, and AI agents via API endpoints.
- **Multiple Agent Support**: Use different AI agents for different calls.
- **Call Monitoring**: Track active calls and their statistics.

---

## Getting Started  

Follow these steps to set up and run the project:  

### 1. Clone the Repository  
```bash
git clone https://github.com/esplanadeai/11labs_Outbound.git
```

### 2. Navigate to the Project Directory
```bash
cd 11labs_Outbound
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure the Environment (Optional)
Create a .env file in the root directory to provide default credentials. All values can also be configured via API after startup:
```
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
ELEVENLABS_AGENT_ID=your-eleven-labs-agent-id
PORT=8000
```

### 5. Start the Server
```bash
node index.js
```

### 6. Start Ngrok
Expose your local server to the internet using Ngrok. Run the following command in a new terminal:
```bash
ngrok http 8000
```

### 7. Configure via API
You can configure the system dynamically via API endpoints:

#### Set Twilio Credentials
```bash
curl -X POST http://localhost:8000/config/twilio-credentials \
-H "Content-Type: application/json" \
-d '{"accountSid": "YOUR_ACCOUNT_SID", "authToken": "YOUR_AUTH_TOKEN"}'
```

#### Add a Twilio Phone Number
```bash
curl -X POST http://localhost:8000/config/twilio-phone-numbers \
-H "Content-Type: application/json" \
-d '{"phoneNumber": "+1234567890"}'
```

#### Add an ElevenLabs Agent
```bash
curl -X POST http://localhost:8000/config/elevenlabs-agents \
-H "Content-Type: application/json" \
-d '{"agentId": "your-agent-id"}'
```

#### View Current Configuration
```bash
curl http://localhost:8000/config
```

### 8. Make Outbound Calls
You can now initiate calls with specific phone numbers and agents:

#### Using cURL

```bash
curl -X POST http://localhost:8000/make-outbound-call \
-H "Content-Type: application/json" \
-d '{
  "to": "+1234567890",
  "phoneNumber": "+1987654321",
  "agentId": "your-agent-id"
}'
```

#### Using JavaScript/Fetch API

```javascript
fetch('http://localhost:8000/make-outbound-call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: '+1234567890',
    phoneNumber: '+1987654321',
    agentId: 'your-agent-id'
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

#### Using Python/Requests

```python
import requests

url = "http://localhost:8000/make-outbound-call"
payload = {
    "to": "+1234567890",
    "phoneNumber": "+1987654321",
    "agentId": "your-agent-id"
}
headers = {"Content-Type": "application/json"}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

#### Parameters

1. **Required Parameters**:
   - `to`: The destination phone number in E.164 format (e.g., +12125551234)

2. **Optional Parameters**:
   - `phoneNumber`: Which of your Twilio phone numbers to use for the call
   - `agentId`: Which ElevenLabs agent should handle the conversation

If optional parameters are not provided, the system will use the first configured values.

### 10. Check Representative Availability
You can check a Go High Level calendar for a representative's availability:

#### Using cURL

```bash
curl "http://localhost:8000/get-availability?calendarId=YOUR_CALENDAR_ID" \
-H "Authorization: Bearer YOUR_GHL_API_KEY"
```

With optional parameters:

```bash
curl "http://localhost:8000/get-availability?calendarId=YOUR_CALENDAR_ID&startDate=2025-03-15&endDate=2025-03-22&timezone=America/New_York" \
-H "Authorization: Bearer YOUR_GHL_API_KEY"
```

#### Using JavaScript/Fetch API

```javascript
fetch('http://localhost:8000/get-availability?calendarId=YOUR_CALENDAR_ID', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_GHL_API_KEY'
  }
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
```

#### Using Python/Requests

```python
import requests

url = "http://localhost:8000/get-availability"
params = {
    "calendarId": "YOUR_CALENDAR_ID",
    # Optional parameters
    # "startDate": "2025-03-15",
    # "endDate": "2025-03-22",
    # "timezone": "America/New_York"
}
headers = {"Authorization": "Bearer YOUR_GHL_API_KEY"}

response = requests.get(url, params=params, headers=headers)
print(response.json())
```

#### Parameters

1. **Required Parameters**:
   - `calendarId`: The Go High Level calendar ID to check for availability (query parameter)
   - `Authorization`: Bearer token with your Go High Level API key (header)

2. **Optional Parameters** (all as query parameters):
   - `startDate`: Start date for availability search (YYYY-MM-DD format, defaults to today)
   - `endDate`: End date for availability search (YYYY-MM-DD format, defaults to 7 days from today)
   - `timezone`: Timezone for the availability slots (defaults to system timezone)

---

## API Reference

### Configuration Endpoints
- `GET /config` - Get current configuration
- `POST /config/twilio-credentials` - Set Twilio credentials
- `POST /config/twilio-phone-numbers` - Add a Twilio phone number
- `DELETE /config/twilio-phone-numbers/:phoneNumber` - Remove a phone number
- `POST /config/elevenlabs-agents` - Add an ElevenLabs agent ID
- `DELETE /config/elevenlabs-agents/:agentId` - Remove an agent ID

### Call Management
- `POST /make-outbound-call` - Initiate an outbound call
- `GET /active-calls` - Get list of active calls
- `POST /call-status` - Handle Twilio call status callbacks

### Calendar Management
- `GET /get-availability` - Check Go High Level calendar availability
- `POST /book-appointment` - Book an appointment in Go High Level calendar

### Service Endpoints
- `GET /` - Health check endpoint
- `ALL /incoming-call-eleven` - Twilio webhook for call handling
- `WebSocket /media-stream` - Media stream for Twilio calls
