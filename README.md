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

````bash
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
````
