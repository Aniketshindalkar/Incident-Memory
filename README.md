<img width="852" height="620" alt="image" src="https://github.com/user-attachments/assets/10d1a479-1f8c-494f-b81c-f0a48b7331bb" /># Incident-Memory
A searchable memory for ops and engineering teams. Log an incident's symptoms and instantly see past incidents that match, with the exact reasons why, plus what fixed them and how long they took.

Built solo for the Appwrite Databases Hackathon (October 2026), on Appwrite TablesDB.

Live demo: YET_TODO
Demo video: YET_TODO

The problem

Teams keep re-solving the same outages. Past fixes are buried in chat threads, tickets, and postmortems nobody rereads. Black-box "similar item" suggestions don't help much either, because engineers can't tell why something was matched and so don't trust it.

What it does
You describe a new incident and tag its symptoms (for example: 502 errors, Redis timeout, high latency).
The app finds past incidents that share those symptoms, ranked by overlap.
Every match is explained: "Matched because it shares 3 symptoms: ..., and it was fixed last time by ...".
During an incident, the timeline updates live for everyone watching.
Resolving an incident records the fix and closes it in one atomic step, so the next team benefits.

Architecture:
<img width="852" height="620" alt="image" src="https://github.com/user-attachments/assets/ec2578fb-038e-4cd7-a6a6-bf06cf43767e" />

TablesDB feature                         	How the project uses it
Many-to-many relationships	              Incidents link to symptoms and fixes. Matching counts shared symptoms between incidents.
Fulltext index + search	                  Search incident summaries by text.
Composite indexes              	          Fast filtering by service, severity, and status.
Transactions	                           "Resolve incident" updates status, sets the resolved time, and links the fix atomically.
Realtime	                               The incident timeline updates live across open windows.
Permissions	                             Controls who can read and write incident data.




