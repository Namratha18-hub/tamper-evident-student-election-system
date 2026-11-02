# Tamper-Evident Student Election System

A full-stack voting app where every vote is hash-chained to the previous one (SHA-256).
If anyone edits, inserts or deletes a vote in the database, **Verify chain** pinpoints where it broke.

**Stack:** Node.js · Express (sessions, auth middleware, REST) · React (Router, hooks) · MongoDB (unique index, aggregation)

## Run it

You need Node 18+ and MongoDB (local, or a free MongoDB Atlas cluster).

```bash
# 1. Backend
cd server
cp .env.example .env        # edit MONGO_URI if using Atlas
npm install
npm run seed                # creates admin (ID: ADMIN / admin123) + 3 sample candidates
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Run the hash-chain tests without a database: `cd server && npm run test:hash`

## Demo flow (for the viva)

1. Log in as **ADMIN / admin123** -> Admin -> **Open voting**.
2. Register 3-4 student accounts (new browser/incognito windows) and cast votes.
3. Admin -> **Close voting** -> Results become public.
4. Open **Verify chain** -> "Chain intact".
5. **Tamper:** in MongoDB Compass (or `mongosh`) open the `votes` collection and change one `candidateId`:
   ```js
   db.votes.updateOne({ index: 2 }, { $set: { candidateId: db.votes.findOne({ index: 1 }).candidateId } })
   ```
6. Click **Verify chain** again -> "Tampering detected" at Vote #2, and later blocks turn red.
   Also try deleting a vote (`db.votes.deleteOne({ index: 2 })`) to show deletion is caught.

## How the design answers viva questions

- **Hash:** `SHA256(index | voterToken | candidateId | timestamp | prevHash)`. First vote uses 64 zeros as `prevHash`.
- **Ballot secrecy:** the `users` collection only stores *whether* a student voted (`hasVoted`). The `votes` collection holds a random token and the candidate, never a user ID.
- **One vote per student:** atomic `findOneAndUpdate({hasVoted:false}, {hasVoted:true})`, so double clicks or parallel requests cannot double vote.
- **No duplicate chain slots:** unique index on `votes.index`; the server retries if two votes race.
- **Deleting the last votes:** a checkpoint (`headHash`, `voteCount`) is kept in the `elections` collection and compared during verification.
- **Honest limitation:** someone with full database access who recomputes *every* hash *and* edits the checkpoint could rewrite history. For production you would publish the head hash externally (printed, emailed, on a public board) so it can't be changed silently. That is why the system is tamper-**evident**, not tamper-**proof**.

## API

| Method | Route | Who |
|---|---|---|
| POST | /api/auth/register, /login, /logout | anyone |
| GET | /api/auth/me | logged in |
| GET | /api/election | logged in |
| POST | /api/election/status | admin |
| GET / POST / DELETE | /api/candidates | logged in / admin / admin |
| POST | /api/vote | voter |
| GET | /api/results | admin anytime, others after close |
| GET | /api/ledger, /api/verify | logged in |

## Folder structure

```
server/  models/ routes/ middleware/ utils/(hash.js) server.js seed.js
client/  src/pages/(Login Ballot Results Verify Admin) src/App.jsx src/api.js
```
