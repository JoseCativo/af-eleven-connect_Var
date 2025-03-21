// Mongoose Schema Definition
import mongoose from "mongoose";

// Define the nested schemas first
const clientMetaSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    businessName: { type: String },
    city: { type: String },
    jobTitle: { type: String },
    email: { type: String, required: true },
    notes: { type: String },
  },
  { _id: false }
); // Prevents creating an _id for this subdocument

const callDataSchema = new mongoose.Schema(
  {
    callSid: { type: String, required: true },
    requestId: { type: String },
    phone: { type: String, required: true },
    from: { type: String, required: true },
    agentId: { type: String, required: true },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number }, // in seconds
    callCount: { type: Number, default: 1 },
    status: {
      type: String,
      enum: [
        "booked_appointment",
        "follow_up",
        "hang_up",
        "dnc",
        "no_call_match",
      ],
    },
    recordingUrl: { type: String },
  },
  { _id: false }
);

const callDetailsSchema = new mongoose.Schema(
  {
    callSummary: { type: String },
    callTranscript: { type: String },
    callSentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
    },
    nextAction: { type: String },
    nextActionDate: { type: Date },
    agentNotes: { type: String },
  },
  { _id: false }
);

const callHistorySchema = new mongoose.Schema({
  callId: {
    type: String,
    required: true,
    default: () => `call_${new mongoose.Types.ObjectId().toString()}`,
  },
  callData: callDataSchema,
  callDetails: callDetailsSchema,
}); // Adds createdAt and updatedAt fields

// Main Client Schema
const clientSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true, // Creates an index for faster lookups
    },
    calId: { type: String, required: true },
    clientToken: { type: String }, // Internal client token used as bearer token for all client restricted access points
    clientSecret: { type: String }, // Internal client secret used to verify/generate jwt client token
    accessToken: { type: String }, // GHL access token (separate from clientSecret)
    refreshToken: { type: String }, // GHL refresh token
    tokenExpiresAt: { type: Date }, // When the access token expires
    agentId: { type: String, required: true },
    twilioPhoneNumber: { type: String, required: true },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
    clientMeta: clientMetaSchema,
    callHistory: [callHistorySchema],
  },
  {
    timestamps: true, // Adds and manages createdAt and updatedAt automatically
    collection: "clients", // Explicitly name the collection
  }
);

// Create additional indexes for common query patterns
clientSchema.index({ "clientMeta.phone": 1 });
clientSchema.index({ "clientMeta.email": 1 });
clientSchema.index({ agentId: 1 });
clientSchema.index({ "callHistory.callData.callSid": 1 });
clientSchema.index({ twilioPhoneNumber: 1 });
clientSchema.index({ accessToken: 1 }); // Index for accessToken lookups

// Compiling the schema into a model
const Client = mongoose.model("Client", clientSchema);

export default Client;

// Example document in MongoDB would look like:
/*
{
  "_id": "6450a47c9c4a7e001d123456",
  "clientId": "5C3JSOVVFiVmBoh8mv3I",
  "clientSecret": "5C3JSBoh8mv3IOVVFim",
  "refreshToken": "5C3JSOVVFiVmBoh8mv3I",
  "tokenExpiresAt": "2025-03-19T10:00:00.000Z",
  "calId": "e0JBV5PARC9sbebxcYnY",
  "agentId": "qvu7240QhEUKLultBI7i",
  "twilioPhoneNumber": "+18632704910",
  "status": "Active",
  "clientMeta": {
    "fullName": "Paul Giovanatto",
    "phone": "+19058363456",
    "businessName": "Affinity Design",        
    "city": "Bradford",
    "jobTitle": "CEO",        
    "email": "paul@affinitydesign.ca",
    "notes": "Prefers morning calls"
  },
  "callHistory": [
    {
      "callId": "call_6450b123b6a89e002a789abc",
      "callData": {
        "callSid": "CA123456789",
        "requestId": "REQ123456",
        "phone": "+19058363456",
        "from": "+18632704910",
        "agentId": "qvu7240QhEUKLultBI7i",
        "startTime": "2025-03-19T12:00:00.000Z",
        "endTime": "2025-03-19T12:15:32.000Z",
        "duration": 932,
        "callCount": 2,
        "status": "completed",
        "recordingUrl": "https://api.twilio.com/recordings/RE123456789"
      },
      "callDetails": {
        "callOutcome": "interested",
        "callSummary": "Client expressed interest in our premium plan, wants a follow-up next week",
        "callTranscript": "Agent: Hello, this is... Client: Hi, I'm interested in...",
        "callSentiment": "positive",
        "nextAction": "schedule_follow_up",
        "nextActionDate": "2025-03-26T12:00:00.000Z",
        "agentNotes": "Be sure to mention the discount code when following up"
      }
    },
    {
      "callId": "call_6450d456b6a89e002a789def",
      "callData": {
        "callSid": "CA987654321",
        "requestId": "REQ654321",
        "phone": "+19058363456",
        "from": "+18632704910",
        "agentId": "qvu7240QhEUKLultBI7i",
        "startTime": "2025-03-20T10:30:00.000Z",
        "endTime": "2025-03-20T10:44:15.000Z",
        "duration": 855,
        "callCount": 3,
        "status": "completed",
        "recordingUrl": "https://api.twilio.com/recordings/RE987654321"
      },
      "callDetails": {
        "callOutcome": "callback",
        "callSummary": "Client asked for more information about implementation timeline. Wants to be called next week after internal discussion.",
        "callTranscript": "Agent: Hello Paul, following up from our last conversation... Client: Thanks for calling back, I've been thinking about...",
        "callSentiment": "positive",
        "nextAction": "schedule_follow_up",
        "nextActionDate": "2025-03-27T10:00:00.000Z",
        "agentNotes": "Paul mentioned they might need additional user accounts. Be prepared to discuss pricing for added seats."
      }
    }
  ],
  "createdAt": "2025-03-19T10:00:00.000Z",
  "updatedAt": "2025-03-20T10:45:00.000Z"
}
*/
