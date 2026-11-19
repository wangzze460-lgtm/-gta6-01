# Solmar City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/wangzze460-lgtm/-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/wangzze460-lgtm/-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game in the spirit of GTA 6, built for the make.fun "Make GTA 6" bounty. Explore Solmar City on foot and by car, steal cars, outrun the police as your wanted level rises, and run four chained story missions across a sun-soaked modern city — all in the browser, no build step.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. Node 22 is the only requirement; there are no dependencies to install. `game/` is plain static files, so any static file server works too.

## How it works

- `game/src/main.js` — game loop and wiring
- `game/src/city.js` — the city: streets, buildings, props
- `game/src/player.js` — on-foot movement and camera
- `game/src/vehicles.js` — cars: stealing, driving, handling
- `game/src/traffic.js` — traffic cars on the roads
- `game/src/pedestrians.js` — pedestrians on the sidewalks
- `game/src/police.js` — police response and chases, wanted system
- `game/src/combat.js` — combat
- `game/src/missions.js` — four chained story missions
- `game/src/hud.js` — HUD
- `game/src/minimap.js` — live minimap
- `game/src/input.js` — keyboard and mouse input
- `game/src/audio.js` — sound
- `game/src/rng.js` — seeded random
- `game/src/save.js` — saves
- `game/vendor/` — three.js, vendored
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library

## Screenshots

`1-chase.jpg` (cover) — police chase with wanted level, minimap and mission objective on the HUD. `2-street.jpg`, `3-mission.jpg`, `4-start.jpg` — the city on foot and from a car, a mission in progress, the start screen.

---

Entered on [make.fun](https://make.fun/?ref={referral_code}&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards
