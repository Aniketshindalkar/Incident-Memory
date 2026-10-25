# Incident-Memory
A searchable memory for ops and engineering teams. Paste a new incident and instantly see the past incidents that look like it, what fixed them, and how long they took.

Built solo for the Appwrite Databases Hackathon.

Live demo: YET_TODO
Demo video: YET_TODO

The problem

Teams keep re-solving the same outages. Past fixes are buried in chat threads, tickets, and postmortems nobody rereads, and keyword search fails when the same problem is described in different words.

What it does
You paste a new incident (error text, symptoms).
The app embeds it and searches for similar past incidents by meaning.
It shows the matches with their root cause, the fix, severity, and time to resolve, plus the original logs and postmortem.
Architecture: why three databases

Each kind of data lives in the Appwrite database type that fits it best.

1. embed + similarity search
2. matching incident IDs
3. structured details
4. raw logs + postmortems
User pastes new incident
App
VectorsDBincident embeddings +incident ID
TablesDBservices, incidents, tags
DocumentsDBlogs, traces, timelines
Results: similar incidents,fix, severity, time to resolve
Database	Stores	Why this one
TablesDB	Services, incidents (title, severity, status, timestamps, root-cause category), tags	Structured, typed, relational data that we filter and aggregate (e.g. time to resolve)
DocumentsDB	Raw logs, stack traces, postmortem text, timeline events	Messy, variable-shaped data that doesn't fit a fixed schema
VectorsDB	One embedding per incident, with a reference to the incident ID	Similarity search by meaning, which is the core feature

The source records stay in TablesDB and DocumentsDB. VectorsDB only holds the embedding and a reference back to them.

Tech stack
Database: Appwrite TablesDB, DocumentsDB, VectorsDB
Frontend: TODO
Backend / functions: TODO
Embeddings: TODO
Appwrite Databases Hackathon: rules and compliance
Rule	How this project complies
Build from scratch. Entirely new, built during the hackathon; nothing written before October 19 (open-source libraries and frameworks are fine).	First commit made October 25, 2026. See the commit history.
Solo only. Designed, built, and submitted by one person.	Built by a single developer.
Build on Appwrite Databases. Must use one of TablesDB, DocumentsDB, VectorsDB, Managed PostgreSQL, or Managed MySQL.	Uses TablesDB, DocumentsDB, and VectorsDB.
Submission deadline: 11:59 PM PT, October 31, 2026. No late submissions.	Submitting ahead of the deadline.
