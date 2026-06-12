# Spitz Siege

Single-file HTML5/Canvas game at `spitz-siege.html`. No dependencies.

**Published:** https://charxiii.itch.io/spitz-siege

## What it is
Turn-based artillery siege game (Rampart × Worms × Advance Wars) starring dog commanders. Player builds a castle, picks a faction, then trades cannon fire with an enemy faction in Worms-style alternating turns. Goal: destroy the enemy king or castle.

## Tech
- 480×270 internal canvas, scaled with nearest-neighbor pixel art
- `TILE = 16`, `GROUND_Y = 192` (must stay a multiple of TILE)
- No build step — edit the HTML directly, open in browser to test

## Six factions (commanders)
| Key | Faction | Breed | Passive |
|-----|---------|-------|---------|
| corgi | Celtic Corgis | Corgi | +1 shot |
| bulldog | British Bulldogs | Bulldog | +30% wall HP |
| laika | Viking Yakutian Laikas | Laika | suppress enemy shots |
| pwd | Portuguese Water Dogs | PWD | speed bonus |
| shiba | Japanese Shiba Inu | Shiba Inu | bonus gold |
| chow | Chinese Chow Chows | Chow Chow | bonus unit dmg |

## Key state vars
- `battleTurn = 'player'|'enemy'` — whose turn it is
- `hitCombo` — consecutive hits this turn, multiplies cannon damage
- `divineWind` — shiba CO power (auto-aim)
- `enemyFaction` — which faction the AI plays

## Upgrades pool (14 cards)
iron_walls, veterans, ammo_cache, master_gunner, royal_guard, swift_march, barricade, berserker, ricochet, chain_shot, bounty, wolf_pack, cursed_stone, last_stand

## Controls
- Mouse aim + click to fire
- E key / END TURN button to end player turn
- Q to activate CO Power
- REMATCH button on game-over screen

## Git branch
Active dev branch: `claude/fervent-feynman-3prvdp`

## itch.io embed settings
- Viewport: 960×540
- Mobile friendly: yes
- Auto-start: yes
- Fullscreen button: yes
- Scrollbars: no
- SharedArrayBuffer: no
