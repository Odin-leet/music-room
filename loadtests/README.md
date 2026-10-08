# Load tests (brief V.7)

**How many people can use Music Room at the same time, on a stated machine, before it gets too slow?**

> **Answer: about 200 concurrent users** on the machine below, with every limit met in every run (3 out of 3). Between **200 and 350** users the 95th percentile hovers around the 300 ms limit (it passes in some runs and fails in others), and from **400** it's always over. **No request ever failed and no data was ever corrupted**, even at 800 users: under overload Music Room gets slow, it doesn't break.

## 1. The machine (stated before measuring)

| | |
|---|---|
| Computer | MacBook Pro 16" 2019 (MacBookPro16,1), macOS 15.7.3 |
| CPU | Intel Core i7-9750H, 2.6 GHz, **6 cores / 12 threads** |
| Memory | 16 GB |
| API | **one** Node 22.23 process (NestJS production build, no cluster) |
| Database | PostgreSQL 16.10 in Docker Desktop (VM: 12 CPUs, 8 GB), default pool of 10 connections |
| Load generator | k6 2.3.0, **on the same laptop** |

**Read the results as a lower bound.** The phones (k6) run on the same CPU as the server: at 400 users k6 alone uses **~3.3 cores**, at 800 **~5.5**. A real deployment would have its own server.

## 2. What is measured

Each **virtual user** (VU) is one phone with its own account and its own socket:

| Role | Share | What it does |
|---|---|---|
| **Voter** (Track Vote) | 80% | Connects to `/events`, joins the shared party; every ~2 s alternately reads the queue or votes / un-votes a random track. **Measures how long its vote takes to reach the phones**: from sending the vote to the next `queue:updated` on its socket |
| **Editor** (Playlist Editor) | 20% | Connects to `/playlists`, joins the shared playlist; every ~5 s reads the tracks and moves a random one (many moves land in the same gaps, exercising the collision retries) |

Each phone stays connected for a **random 45–75 s**, then reconnects. A fixed length made every phone that started together reconnect together, a storm real users don't produce (see [§5](#5-what-went-wrong-while-measuring)).

**Thresholds, fixed before measuring** (`lib/profiles.js`). A step **passes** when all three hold:

| | Limit |
|---|---|
| REST requests, 95th percentile | **< 300 ms** |
| a vote reaching the other phones, 95th percentile | **< 500 ms** (includes the server's 100 ms batching on purpose) |
| failed requests | **< 1%** |

**Deliberately not loaded:**
- **Logging in.** bcrypt costs ~0.2 s of CPU *by design*, so it would only measure bcrypt. Users are created in SQL and their tokens signed beforehand.
- **Deezer.** It's external and has its own rate limit. Tracks are added once, during setup.

**After every run, a check that the data is still correct**: each track's score = its number of vote rows, and every playlist position is unique.

## 3. Results

All runs: 0% errors · 0 socket errors · integrity OK. Times in ms.

### Baseline (50 users, 2 min, steady)

| users | requests | HTTP p50 | HTTP p95 | HTTP p99 | broadcast p50 | broadcast p95 | result |
|---|---|---|---|---|---|---|---|
| 50 | 2,648 | 13 | **23** | 75 | 119 | **235** | ✅ |

### Capacity ramp (50 → 800 users, 1 min per step): two runs

| users | run 1 HTTP p95 | run 1 broadcast p95 | run 2 HTTP p95 | run 2 broadcast p95 | result |
|---|---|---|---|---|---|
| 50 | 42 | 175 | 22 | 130 | ✅ ✅ |
| 100 | 26 | 143 | 27 | 162 | ✅ ✅ |
| **200** | **58** | **174** | **101** | **259** | ✅ ✅ |
| 400 | 2,723 | 2,834 | 6,332 | 4,000 | ❌ ❌ |
| 800 | 9,250 | 6,266 | 11,208 | 8,629 | ❌ ❌ (slow, nothing failed) |

The median stays low up to 200 (15–19 ms) and then jumps: at 400 it's 344–460 ms, at 800 5.6–6.2 s.

### Finer steps between 200 and 350: two runs

This profile **starts straight at 200 users** (0 → 200 in 15 s), which is itself a small spike.

| users | run 1 HTTP p95 / broadcast p95 | run 2 HTTP p95 / broadcast p95 | result |
|---|---|---|---|
| 200 | 290 / 377 | 336 / 390 | ✅ ❌ |
| 250 | 434 / 472 | 82 / 184 | ❌ ✅ |
| 300 | 194 / 262 | 239 / 351 | ✅ ✅ |
| 350 | 152 / 247 | 360 / 417 | ✅ ❌ |

**In this range, the median stays fast (16–45 ms) while the slowest 5% cross the limit or not depending on the run.** That's the "knee": the server is close to saturation, and bursts decide the tail.

### Spike (0 → 500 users in 10 s, 1 min, then 20 users)

| phase | requests | HTTP p50 | HTTP p95 | max | broadcast p95 | result |
|---|---|---|---|---|---|---|
| 500 users | 8,805 | 853 | 3,178 | 5,772 | 2,815 | ❌ |
| back to 20 users | 533 | 14 | **24** | — | 209 | ✅ |

**"Voting just opened" for 500 people at once is too much for this laptop.** Requests wait up to ~6 s, but none fails, and **it recovers immediately**: as soon as the burst is over, latency is back to normal.

### Server side (average CPU, % of one core)

| users | API (Node) | Postgres | k6 (the phones) |
|---|---|---|---|
| 50 | 16–20 | 11–15 | 28–33 |
| 200 | 43–46 | 45–48 | 146–159 |
| 400 | 63–70 (peaks 115–146) | 93–100 | 320–333 |
| 800 | 57–60 | 62–69 | 511–571 |

API memory: 155–230 MB up to 200 users, ~460 MB at 800. Raw data per step: `results/*-server.json`.

## 4. What limits it

1. **The vote broadcast fans out to every phone.** Each `queue:updated` carries the **whole ranked queue** (~11.5 KB with 30 tracks) to **every** phone at the party. In one 6.5-minute ramp the phones received **~800,000 messages, ~9 GB**. The work therefore grows like *users × updates*: the server serializes and writes, and every phone receives and parses. The 100 ms batching already caps updates at 10 per second per party; without it, this would be far worse.
2. **One Node process = one core.** At 400 users the API averages ~0.7 core with peaks over 1, and Postgres ~1 core. Both saturate, and requests start queueing (the median jumps from 19 ms to 400 ms).
3. **At 800, the laptop itself is the limit.** k6 takes ~5.5 of the 12 threads to play 800 phones, which is why the API's CPU even *drops* while latency explodes. That part isn't the API's limit.

**What would raise the number** (not done; listed for the defense):

| Change | Why it helps |
|---|---|
| Send Track Vote **changes** instead of the whole queue (as the Playlist Editor already does) | Divides the broadcast volume by ~30 |
| Several API processes (Node cluster) + the Socket.IO **Redis adapter** | Uses all the cores; rooms shared across processes |
| A **separate load-generator machine** | Measures the server alone (today k6 takes up to half the CPU) |
| A larger Postgres pool, Postgres outside Docker Desktop's VM | Less queueing on the database |

## 5. What went wrong while measuring

Kept here because each one changed the result:

- **Synchronized reconnections.** In the first version, every phone stayed connected exactly 60 s. Phones that started together reconnected together, so the "200 users" step failed in one run and passed in another, and 300 users did better than 250. Fix: **random 45–75 s sessions**. The finer-step runs and the second ramp use it.
- **The Mac fell asleep.** One spike "lasted 19 minutes": the API completed **no request for 17 minutes**, then about 3,000 at once, all **status 200**. macOS's power log showed *"Wake from Deep Idle… due to UserActivity"* at the exact second they finished. The laptop had slept during the run, freezing k6, the API and Docker together. **Not a server bug**: a database deadlock wouldn't end by itself with 200s. Fix: `run.mjs` keeps the Mac awake with `caffeinate`, and that run was discarded.
- **The load generator on the same machine** (see §1 and §4): a known limit, stated rather than hidden.

## 6. Running it

```bash
make load-test                          # = node loadtests/run.mjs ramp
node loadtests/run.mjs smoke            # 10 users, 20 s: checks the pipeline (~1 min)
node loadtests/run.mjs baseline|ramp|knee|spike|all [--keep]
```

Needs Docker running and k6 (`brew install k6`). Your dev API and database aren't touched:
1. it builds the API into `apps/api/dist-load`, creates a separate database `music_room_load`, and starts a **second API on port 3100** with rate limits raised (all the phones share one IP);
2. it seeds 1,000 users, a party with 30 tracks and a playlist with 50;
3. it runs k6 while sampling the CPU and memory of the API, Postgres and k6 every 2 s;
4. it checks the data is still correct, stops the API and drops the database (`--keep` keeps it).

| File | What |
|---|---|
| `load.js` | the k6 test (voters, editors, metrics per step, summary table) |
| `lib/socketio.js` | a minimal Socket.IO client for k6 (k6 has none) |
| `lib/profiles.js` | the profiles, the thresholds, the step boundaries |
| `run.mjs` | the runner described above |
| `results/` | `*-k6.json` (all k6 metrics) and `*-server.json` (CPU / memory samples, integrity check) for the runs above; `run1/`, `run2/` = the two repeated ramp + finer-step runs |
