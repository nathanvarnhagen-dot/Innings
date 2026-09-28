# Innings

Every moment deserves a home. A static web app (Vercel) with a few serverless API routes.

## Layout

```
index.html        every screen's markup, plus the <link>/<script> tags that load everything below
css/              styles, loaded in order (later files can override earlier ones)
js/               app code, loaded in order — see below
  core/           Firebase + login, navigation, shared helpers, desktop layout, build stamp
  games/          games list, live game pages (baseball, football, other sports), replays, postseason
  moments/        creating a memory: the three choices, happening now, ticket stubs
  memories/       the archive, memory screen, photos, calendar
  plans/          the plan builder and plan chat
  chat/           chat tools shared by every chat, game chat, link previews
  social/         friends, profiles, groups, notifications, invites
  teams/ players/ team page, player sheet
  events/         Outside Lands 2026
img/              images
api/              serverless routes (mlb.js, espn.js, nhl.js, …) — unchanged by the split
```

## How the scripts work

Plain `<script>` tags, no build step and no bundler. Every function is a global
function, so the `onclick="…"` handlers in `index.html` can call them.

**Load order matters.** The tags in `index.html` load the files in the same order
the code ran in when it was one file. A file may call functions from a file that
loads *later* only inside functions that run later (after the page has loaded) —
never in code that runs the moment the file loads. The login callback in
`js/core/firebase-and-auth.js` waits for the whole page to load
(`_afterAppLoaded`) for the same reason.

**Cache busting.** Every tag ends in `?v=<version>`. Bump it on each deploy so
phones fetch the new files instead of an old copy. The build stamp lives in
`js/core/build.js`.

## Files

### CSS (in load order)
| File | Size |
|---|---|
| `css/base.css` | 7 KB |
| `css/immersive.css` | 38 KB |
| `css/games.css` | 23 KB |
| `css/moments-and-plans.css` | 25 KB |
| `css/games-live.css` | 27 KB |
| `css/layout-and-flourishes.css` | 47 KB |
| `css/rulebooks.css` | 7 KB |
| `css/memory-ticket.css` | 4 KB |
| `css/on-this-day-and-desktop.css` | 7 KB |
| `css/at-bat.css` | 2 KB |
| `css/statcast.css` | 4 KB |

### JavaScript (in load order)
| File | Size |
|---|---|
| `js/events/osl-lineup-and-rsvp.js` | 125 KB |
| `js/events/osl-songs-and-map.js` | 52 KB |
| `js/events/osl-music-and-reveals.js` | 38 KB |
| `js/core/build.js` | 0 KB |
| `js/core/navigation.js` | 8 KB |
| `js/core/welcome-canvas.js` | 2 KB |
| `js/moments/create-and-happening-now.js` | 44 KB |
| `js/moments/stops-location-and-games.js` | 26 KB |
| `js/games/strike-zone-and-box-score.js` | 38 KB |
| `js/core/firebase-and-auth.js` | 13 KB |
| `js/social/invite-text.js` | 1 KB |
| `js/core/utils.js` | 14 KB |
| `js/memories/memories-and-feed.js` | 29 KB |
| `js/core/hero-zoom.js` | 21 KB |
| `js/plans/plan-chat.js` | 33 KB |
| `js/memories/memory-detail.js` | 21 KB |
| `js/memories/photos-and-people.js` | 52 KB |
| `js/memories/calendar.js` | 14 KB |
| `js/chat/chat-tools.js` | 36 KB |
| `js/social/groups.js` | 51 KB |
| `js/chat/link-previews.js` | 9 KB |
| `js/games/games-list.js` | 27 KB |
| `js/games/breaks-weeks-and-flourishes.js` | 51 KB |
| `js/games/playoffs-and-favorite-teams.js` | 32 KB |
| `js/games/football-field.js` | 19 KB |
| `js/games/baseball-live.js` | 12 KB |
| `js/games/football-scoring-replay.js` | 7 KB |
| `js/games/watching-attending.js` | 26 KB |
| `js/teams/team-page.js` | 20 KB |
| `js/games/baseball-hero.js` | 81 KB |
| `js/games/game-hero-other-sports.js` | 81 KB |
| `js/games/live-feed.js` | 20 KB |
| `js/chat/game-chat.js` | 10 KB |
| `js/events/osl-photos.js` | 11 KB |
| `js/social/notifications.js` | 13 KB |
| `js/social/friends-and-profiles.js` | 47 KB |
| `js/games/rulebooks.js` | 52 KB |
| `js/games/memory-ticket.js` | 23 KB |
| `js/core/desktop-layout.js` | 17 KB |
| `js/games/highlight-reel.js` | 14 KB |
| `js/games/baseball-play-animation.js` | 50 KB |
| `js/games/football-broadcast.js` | 9 KB |
| `js/moments/new-moment.js` | 18 KB |
| `js/plans/plan-builder.js` | 65 KB |
| `js/games/postseason.js` | 20 KB |
| `js/games/game-winner.js` | 6 KB |
| `js/games/score-bar.js` | 6 KB |
| `js/games/abs-and-inline-replays.js` | 12 KB |
| `js/core/resume-refresh.js` | 1 KB |
| `js/games/statcast.js` | 28 KB |
| `js/players/player-sheet-drag.js` | 2 KB |
