# ChainVote — Simplified User & Developer Guide

Welcome to **ChainVote**! This guide is designed to help you run, use, test, and demonstrate the entire platform in a few simple steps.

---

## 1. Quick Start: How to Run ChainVote Locally

To run the full platform on your machine, open **3 separate terminal windows** in your project folder:

### Terminal 1: Start the Local Blockchain Node
```bash
cd backend
npx hardhat node --port 8546
```
> **What this does:** Starts your personal Ethereum blockchain test network at `http://127.0.0.1:8546`. Keep this window open.

---

### Terminal 2: Deploy Contract & Start Backend API
*(If starting fresh, deploy the contract once):*
```bash
cd backend
npx hardhat run scripts/deploy-voting-system.js --network localhost
```
*Then start the backend server:*
```bash
node server/index.js
```
> **What this does:** Initializes the relational database, synchronizes the blockchain relayer, and starts the real-time Event Indexer at `http://localhost:5000`.

---

### Terminal 3: Start the Next.js Frontend
```bash
cd frontend
npm run dev
```
> **What this does:** Launches the web portal at **[http://localhost:3000](http://localhost:3000)**.

---

## 2. Portal Directory & Default Credentials

| Portal | URL | Credentials | Purpose |
| :--- | :--- | :--- | :--- |
| **Public Landing Page** | [http://localhost:3000](http://localhost:3000) | Public Access | Overview, quick links, system status |
| **Voter Login** | [http://localhost:3000/login](http://localhost:3000/login) | **ID:** `123456789012`<br>**Token:** `123456` | Citizen authentication & ballot casting |
| **Admin Terminal** | [http://localhost:3000/admin/login](http://localhost:3000/admin/login) | **User:** `admin`<br>**Password:** `admin123` | Create elections, add candidates, open/close polls |
| **Public Results** | [http://localhost:3000/results](http://localhost:3000/results) | Public Access | Live candidate tallies, turnout %, winner banner |
| **Public Audit Explorer** | [http://localhost:3000/audit](http://localhost:3000/audit) | Public Access | Live block stream, event inspector & ballot verifier |

---

## 3. Step-by-Step User Walkthroughs

### Walkthrough A: How to Run an Election as an Administrator

1. Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) in your browser.
2. Enter the administrator credentials:
   - **Username:** `admin`
   - **Password:** `admin123`
3. Click **Sign In to Terminal**.
4. In the Admin Dashboard:
   - **Add Candidates:** Type a candidate name (e.g., *"Sarah Connor"*, *"John Doe"*) and click **Add Candidate**. You need at least 2 candidates to start.
   - **Register Voters:** Under *Voter Registration*, enter a 12-digit Digital ID (e.g., `123456789012`) and click **Register Voter**. This generates their unique on-chain nullifier.
   - **Start the Election:** Click **Start Election**. The smart contract transitions to `OPEN` and voting is officially active!
   - **End the Election:** When voting concludes, click **End Election**. The polls close permanently, and the winner is officially proclaimed.

---

### Walkthrough B: How to Cast a Vote as a Citizen

1. Open [http://localhost:3000/login](http://localhost:3000/login).
2. Enter your registered credentials:
   - **Digital ID:** `123456789012`
   - **Verification Token:** `123456`
3. Click **Verify & Proceed**.
4. On your **Voter Dashboard**:
   - You will see the live election candidates.
   - Click on your preferred candidate card (e.g., *"Candidate Alpha"*).
   - Click **Cast Official Ballot**.
5. Once confirmed by the blockchain node:
   - You will see your verified **Transaction Hash** and **Cryptographic Nullifier**.
   - Click **Download Digital Ballot Receipt** to save your text receipt.
6. **Try Voting Again:** Attempting to vote a second time will be strictly blocked with:  
   `"Integrity Violation: You have already cast your ballot in this election."`

---

### Walkthrough C: How to Monitor & Verify as an Observer / Journalist

1. Open the **Public Audit Explorer** at [http://localhost:3000/audit](http://localhost:3000/audit) (or click **Public Audit** in the top navigation bar).
2. **Inspect Real-Time Consensus:**
   - View the live block height (e.g., `#14`) and total indexed events.
   - Watch new events stream in real-time as votes are cast.
3. **Inspect Raw Blockchain Logs:**
   - Click **Inspect Log** on any event card to view the raw JSON payload recorded by the smart contract.
   - Click the copy icon next to any Transaction Hash or Nullifier to copy it with one click.
4. **Verify a Ballot:**
   - Scroll to the **Public Ballot Inclusion Verifier** box.
   - Paste a Transaction Hash (e.g., from your receipt) or a Nullifier Hash.
   - Click **Verify**.
   - The tool instantly queries the decentralized index and confirms:  
     `"Ballot Verified On-Chain: Cryptographically Proven on Public Ledger in Block #X"`.
5. **Export Audit Trail:** Click **Export Audit Log (JSON)** to download the entire ledger for offline analysis.

---

### Walkthrough D: Emergency Annulment & Linked Re-Election Protocol

If voter credentials or a voting machine are compromised during an active election, ChainVote provides a cryptographic recovery mechanism without tampering with historical logs:

1. **Why We Do NOT Reset History:**
   - In a legally binding election, resetting or deleting votes destroys forensic evidence.
   - Instead, ChainVote places the session into an on-chain **`ANNULLED`** state with a mandatory incident justification.
2. **Execute Emergency Annulment:**
   - In the **Admin Dashboard** (`/admin`), click the red **Emergency Annul** button.
   - Enter a documented justification (e.g., *"Credential compromise detected in precinct cohort B"*).
   - The smart contract immediately locks the election into `ANNULLED` state. All future ballot submissions are rejected, and the incident is immutably indexed.
3. **Deploy Linked Re-Election:**
   - Once annulled, click **Deploy Linked Re-Election**.
   - Enter the re-election justification (e.g., *"Rotated credentials distributed to verified voters"*).
   - The protocol automatically spawns a new election session (`parent_election_id` pointing to the compromised session), clones the candidate roster, and resets the nullifier space so voters can cast new ballots securely.

---

## 4. Useful Developer Commands

All tests and automated verification scripts can be executed with single commands:

### Run Smart Contract Unit Tests (42 Tests)
```bash
cd backend
npx hardhat test test/VotingSystem.test.js
```
*(Tests role-based access control, double-voting rejection, multi-election isolation, and emergency annulment/re-election protocol. 100% pass rate).*

### Run Full End-to-End System Integration Test (16 Tests)
```bash
cd backend
node scripts/test-complete-system.js
```
*(Tests health checks, bcrypt login, election creation, candidate registration, voting, double-vote rejection, audit matching, emergency annulment, and linked re-election).*

### Run Real Performance Benchmark Suite
```bash
cd backend
node scripts/benchmark.js
```
*(Measures API health latency, election list query speed, bcrypt CPU compute time, and audit query latency).*

---

## 5. Troubleshooting & FAQ

* **Q: I get "Failed to fetch" or "Network Error" on the frontend.**
  - **Fix:** Ensure both the blockchain node (port 8546) and backend server (port 5000) are running.
* **Q: "VotingSystem: Invalid election state for operation" error when voting.**
  - **Fix:** The election must be started before votes can be accepted. Log in as admin at `/admin/login` and click **Start Election**.
* **Q: "VotingSystem: Double voting rejected - nullifier already spent".**
  - **Fix:** This is the smart contract doing its job! Each registered voter can only cast one ballot per election session. Use a new 12-digit number to test another voter.
* **Q: Can I run this with Docker?**
  - **Yes:** Run `docker compose up` to start PostgreSQL, the backend relayer, and frontend in containerized environments.
