# Eleven Labs Outbound Caller

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
fetch("http://localhost:8000/make-outbound-call", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    to: "+1234567890",
    phoneNumber: "+1987654321",
    agentId: "your-agent-id",
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((error) => console.error("Error:", error));
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

### 9. Monitor Active Calls

```bash
curl http://localhost:8000/active-calls
```

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

### Service Endpoints

- `GET /` - Health check endpoint
- `ALL /incoming-call-eleven` - Twilio webhook for call handling
- `WebSocket /media-stream` - Media stream for Twilio calls
