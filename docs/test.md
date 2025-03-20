### Create Client (Admin Only)

Creates a new client in the system.

**Endpoint:** `POST /admin/clients`  
**Authentication:** Admin token required  
**Content-Type:** application/json

**Sample Request:**

```bash
curl -X POST https://api.v1.affinitydesign.ca/admin/clients \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
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
  }'


```
