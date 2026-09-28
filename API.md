# ChainVote — REST API Specification

**Base URL:** `http://localhost:5000/api`

---

## 1. System & Authentication Endpoints

### `GET /health`
* **Description:** Health check and live connectivity telemetry.
* **Response (200):**
  ```json
  {
    "status": "HEALTHY",
    "blockchain": { "connected": true, "latestBlock": 4, "contractAddress": "0x5FbD..." },
    "database": { "engine": "SQLite Relational" }
  }
  ```

### `POST /api/auth/admin-login`
* **Description:** Authenticates administrator via bcrypt against the database.
* **Body:**
  ```json
  { "username": "admin", "password": "admin123" }
  ```
* **Response (200):** `{ "token": "JWT_STRING", "role": "ADMIN" }`

### `POST /api/auth/verify`
* **Description:** National ID Demo Protocol verification.
* **Body:**
  ```json
  { "aadhar_number": "123456789012", "otp": "123456" }
  ```
* **Response (200):** `{ "token": "JWT_STRING", "hashedAadhar": "HEX_STRING" }`

---

## 2. Multi-Election Management Endpoints

### `GET /api/elections`
* **Description:** Lists all elections with candidate counts and states.

### `POST /api/elections`
* **Header:** `Authorization: Bearer <AdminToken>`
* **Body:** `{ "name": "Faculty Board 2026", "description": "Election description" }`

### `GET /api/elections/:id/candidates`
* **Description:** Retrieves on-chain candidate list and live tallies for election `:id`.

### `POST /api/elections/:id/candidates`
* **Header:** `Authorization: Bearer <AdminToken>`
* **Body:** `{ "name": "Dr. Smith" }`

### `POST /api/elections/:id/open`
* **Header:** `Authorization: Bearer <AdminToken>`
* **Description:** Transitions election to `OPEN` state on-chain (requires $\ge 2$ candidates).

### `POST /api/elections/:id/close`
* **Header:** `Authorization: Bearer <AdminToken>`
* **Description:** Closes election voting window on-chain.

### `POST /api/elections/:id/finalize`
* **Header:** `Authorization: Bearer <AdminToken>`
* **Description:** Permanently finalizes the election tally.

---

## 3. Voter Authorization & Ballot Casting

### `POST /api/elections/:id/voters`
* **Header:** `Authorization: Bearer <AdminToken>`
* **Body:** `{ "aadhar_number": "123456789012" }`
* **Description:** Generates pseudonymous nullifier commitment and whitelists voter.

### `POST /api/elections/:id/vote`
* **Header:** `Authorization: Bearer <VoterToken>`
* **Body:** `{ "candidateId": 0 }`
* **Description:** Submits ballot via serialized NonceManager relayer on-chain.
* **Response (200):**
  ```json
  {
    "message": "Ballot successfully recorded and verified on the blockchain",
    "txHash": "0x1234...",
    "blockNumber": 5,
    "nullifier": "0x5678..."
  }
  ```

---

## 4. Transparency & Auditing

### `GET /api/elections/:id/audit`
* **Description:** Retrieves indexed blockchain events from the database (fast, non-blocking).
* **Response (200):**
  ```json
  [
    {
      "eventName": "VoteCast",
      "blockNumber": 5,
      "transactionHash": "0x...",
      "nullifier": "0x...",
      "indexedAt": "2026-09-27T07:15:00Z"
    }
  ]
  ```
