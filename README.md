# Eleven Labs Outbound Caller

This project demonstrates the integration of **Eleven Labs Conversational AI** with **Twilio** to enable seamless real-time interactions during outbound and inbound phone calls. The system leverages WebSockets for media streaming and integrates Eleven Labs' advanced conversational AI capabilities for human-like interactions.

## Features

- **Outbound Call Integration**: Programmatically initiate outbound calls using Twilio's API.
- **Real-Time Media Streaming**: Connect calls to Eleven Labs via WebSockets for audio input and output.
- **AI-Powered Conversations**: Use Eleven Labs Conversational AI to create dynamic, human-like dialogues.
- **Dynamic Configuration API**: Configure Twilio credentials, phone numbers, and AI agents via API endpoints.
- **Multiple Agent Support**: Use different AI agents for different calls.
- **Dynamic Variables**: Personalize conversations with customer-specific information.
- **Call Monitoring**: Track active calls and their statistics.
- **Calendar Integration**: Check availability and book appointments via Go High Level.

## Getting Started

Follow these steps to set up and run the project:

### 1. Clone the Repository

```bash
git clone https://github.com/Affinity-Design/af-eleven-connect
```

### 2. Navigate to the Project Directory

```bash
cd ad-eleven-connect
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
ELEVENLABS_API_KEY=your-eleven-labs-api-key
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

## Configuration

You can configure the system dynamically via API endpoints:

### Set Twilio Credentials

```bash
curl -X POST http://localhost:8000/config/twilio-credentials \
-H "Content-Type: application/json" \
-d '{"accountSid": "YOUR_ACCOUNT_SID", "authToken": "YOUR_AUTH_TOKEN"}'
```

### Add a Twilio Phone Number

```bash
curl -X POST http://localhost:8000/config/twilio-phone-numbers \
-H "Content-Type: application/json" \
-d '{"phoneNumber": "+1234567890"}'
```

### Add an ElevenLabs Agent

```bash
curl -X POST http://localhost:8000/config/elevenlabs-agents \
-H "Content-Type: application/json" \
-d '{"agentId": "your-agent-id"}'
```

### View Current Configuration

```bash
curl http://localhost:8000/config
```

## API Reference

### Make Outbound Calls

```bash
curl -X POST http://localhost:8000/make-outbound-call \
-H "Content-Type: application/json" \
-d '{
  "to": "+1234567890",
  "phoneNumber": "+1987654321",
  "agentId": "your-agent-id",
  "prompt": "You are a sales representative calling about our services.",
  "first_message": "Hello, this is Alex from EsplanadeAI. How are you today?",
  "fullName": "John Smith",
  "email": "john@example.com",
  "company": "Acme Corp",
  "jobTitle": "CTO",
  "city": "San Francisco"
}'
```

#### Parameters

1. **Required Parameters**:

   - `to`: The destination phone number in E.164 format (e.g., +12125551234)

2. **Optional Parameters**:
   - `phoneNumber`: Which of your Twilio phone numbers to use for the call
   - `agentId`: Which ElevenLabs agent should handle the conversation
   - `prompt`: Custom system prompt for the AI agent (overrides default prompt)
   - `first_message`: Custom initial message from the AI agent (overrides default greeting)
   - `fullName`: Customer's full name for personalized conversation
   - `email`: Customer's email address
   - `company`: Customer's company or organization name
   - `jobTitle`: Customer's job title or position
   - `city`: Customer's city or location

If optional parameters are not provided, the system will use the first configured values for phone number and agent ID. For personal details, the system will use a generic approach if they're not provided.

### Monitor Active Calls

```bash
curl http://localhost:8000/active-calls
```

### Check Representative Availability

```bash
curl -X POST http://localhost:8000/get-availability \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_GHL_API_KEY" \
-d '{
  "calendarId": "YOUR_CALENDAR_ID",
  "startDate": "2025-03-15",
  "endDate": "2025-03-22",
  "timezone": "America/New_York"
}'
```

#### Parameters

1. **Required Parameters**:

   - `calendarId`: The Go High Level calendar ID
   - `Authorization`: Bearer token with your Go High Level API key (header)

2. **Optional Parameters**:
   - `startDate`: Start date for availability search (YYYY-MM-DD format, defaults to today)
   - `endDate`: End date for availability search (YYYY-MM-DD format, defaults to 7 days from today)
   - `timezone`: Timezone for the availability slots (defaults to system timezone)

### Book an Appointment

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

## Dynamic Variables in Outbound Calling

The outbound calling system supports dynamic variables, allowing you to personalize AI agent interactions based on customer information. This enables more natural, context-aware conversations that improve engagement and effectiveness.

### Smart Default Prompts

If no custom prompt or first message is provided, the system generates personalized versions based on available customer information:

1. **Default Prompt Template**: Incorporates the customer's name, job title, company, and city to create a context-aware prompt for the AI agent.

2. **Default First Message**: Creates a personalized greeting using the customer's name while maintaining a professional introduction.

Example of an automatically generated prompt:

```
You are a professional sales representative for EsplanadeAI.

You're speaking with John Smith who works as a CTO at Acme Corp from San Francisco.

Follow these guidelines during the call:
1. Be warm, professional, and conversational
...
```

Example of an automatically generated first message:

```
Hello John Smith! This is Alex from EsplanadeAI. I hope I caught you at a good time...
```

## Troubleshooting

### Connection Issues

If the WebSocket connection fails:

- Verify your ngrok URL is correct in Twilio settings
- Check that your server is running and accessible
- Ensure your firewall isn't blocking WebSocket connections

### Audio Problems

If there's no audio output:

- Confirm your ElevenLabs API key is valid
- Verify the AGENT_ID is correct
- Check audio format settings match Twilio's requirements (μ-law 8kHz)
- In your ElevenLabs agent settings, navigate to the Voice section and select "μ-law 8000 Hz" for both input and output formats

### Agent Configuration

For optimal performance with Twilio:

1. Navigate to your agent settings in ElevenLabs
2. Go to the Voice section and select "μ-law 8000 Hz" from the dropdown
3. Go to the Advanced section and select "μ-law 8000 Hz" for the input format
4. In the security section, toggle on "Enable authentication"
5. Toggle on "Enable overrides" for "First message" and "System prompt"
