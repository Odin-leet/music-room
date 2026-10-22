# User testing

The marking sheet asks: *"You have put yourself in a situation of using your own product to question your interface choices. You have confronted your product with people outside the project for feedback and criticism."*

This page is the record of that. **Fill it in with real sessions**: the evaluator may ask who tested, what they said, and what changed because of it.

---

## 1. How to run a session (about 20 minutes per person)

**Who:** people **outside the project**, ideally 3 to 5, with different profiles. For example:
- someone who isn't technical;
- someone who uses Spotify / Deezer every day;
- someone who has organised a party;
- an iPhone user and an Android user.

**Setup:** `make start` on your laptop, the tester on their own phone with Expo Go (same Wi-Fi), or in a browser at http://<your laptop>:5173 … or the web app on your laptop.

**Rules for you, the observer:**
- Give the **task**, not the steps ("vote for a song you like", not "tap the arrow on the right").
- **Don't help** unless they're stuck for more than a minute. Where they hesitate is the result.
- Ask them to **think aloud** ("I'm looking for… I expected…").
- Write down **what they do and say**, not what you think of it.
- At the end, ask the 4 questions in §3.

## 2. Tasks to give

Two testers at once is best: Track Vote and the Playlist Editor are about doing things *together*.

| # | Task | What it checks |
|---|---|---|
| T1 | Create an account and get into the app | Register, the email code, the first screen |
| T2 | Fill in your profile so only your friends see your city | The visibility tiers are understandable |
| T3 | Find the other tester and become friends | Search, request, accept, the badge |
| T4 | Create a party where everyone can vote, invite the other tester | Creating an event, the invite code / email |
| T5 | (both) Suggest two songs each, vote for the other person's | Search, suggest, vote, the live reordering |
| T6 | (organiser) Start the music and skip a song | The speaker controls |
| T7 | Make a private playlist only you two can edit, add 4 songs | Playlist settings, adding tracks |
| T8 | (both at once) Reorder the playlist while it's playing | Drag / arrows, live changes, listening while it changes |
| T9 | Sign in with Google instead of your password (if keys are set) | Social login, or linking it from Profile |
| T10 | Log out and back in | Session, remembered email |

## 3. Questions at the end

1. What was the **hardest** or most confusing moment?
2. Was anything **missing** that you expected to find?
3. What did you **like**?
4. Would you use it at a party? Why / why not?

## 4. Sessions

Copy this block for each tester.

### Session N — <first name or "Tester N">, <date>

| | |
|---|---|
| Profile | e.g. 24, not technical, uses Spotify daily |
| Device | e.g. Android, Expo Go / web on a laptop |
| Tasks done | T1–T10 (note which ones they couldn't finish) |

**What happened** (what they did and said; quote them when you can):

| Task | Observation | Severity (blocking / annoying / cosmetic) |
|---|---|---|
| T… | | |

**Their answers:**
1. Hardest:
2. Missing:
3. Liked:
4. Would use it:

## 5. What we changed because of it

The most important section for the evaluator: feedback → decision → change.

| Feedback (who, which task) | Decision | Change (commit) |
|---|---|---|
| | fixed / not fixed + why | |

## 6. What we already changed by using it ourselves

Changes that came from using the app ourselves during development, before outside testing. They're all in the git history:

| Problem found by using it | Change |
|---|---|
| The music stopped when you left the party or playlist screen (*"the music should keep playing even if we change the screen"*) | One app-wide player with a mini-player above the tabs |
| Home was a list of developer buttons, and you had to go back through it to change area | Five tabs: Home · Events · Playlists · Friends · Profile |
| Pressing a playlist track to drag it did nothing: no feedback, no drag | A visible handle and our own drag list (`fix/playlist-drag`), plus up / down arrows |
| Google sign-in on the emulator tried to reach `10.0.2.2:3000` and failed | `adb reverse tcp:3000 tcp:3000`, now in the README and `docs/technical/01-running.md` |
| Google / Facebook sign-in on a real phone couldn't come back (`localhost` is the phone) | An optional public HTTPS tunnel (ngrok) for testing on a real phone |
| Long party names were cut off in the header | Detail screens use a smaller title on two lines |
| On a phone browser, the web party page overflowed to the side | Fixed grid sizing; every page checked at phone and tablet width |
