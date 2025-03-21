Pick 2 date/times returned by this function and convert date to human freindly 2025-04-02T10:00:00-05:00 eg: Wednesday, April 2, at 10:00 AM

will return object with times of available slots

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

startDate
todays date in the current format: 2025-04-01

endDate
should be 1 week from startDate (todays date) eg if start date is 2025-04-01 then correct value would be: 2025-04-07

timezone
Timezone of client eg: America/Chicago
