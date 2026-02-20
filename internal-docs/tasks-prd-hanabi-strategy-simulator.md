# Task List: Hanabi Strategy Simulator

Based on: [prd-hanabi-strategy-simulator.md](./prd-hanabi-strategy-simulator.md)

---

## Relevant Files

- `package.json` - TypeScript project setup and dependencies.
- `tsconfig.json` - TypeScript configuration.
- `src/config/index.ts` - Configuration types and defaults (`GameConfig`).
- `src/engine/seeded-rng.ts` - Seeded RNG utility (no `Math.random`).
- `src/engine/seeded-rng.test.ts` - Unit tests for seeded RNG determinism.
- `src/engine/types.ts` - Color, Card, deck composition constants.
- `src/engine/deck.ts` - Deck creation and shuffle.
- `src/engine/deck.test.ts` - Unit tests for deck creation and determinism.
- `src/engine/game-state.ts` - GameState type, deal logic, state transitions.
- `src/engine/actions.ts` - Action types and validation.
- `src/engine/game-engine.ts` - Main engine loop, action execution, event emission.
- `src/engine/observation.ts` - Build Observation from state, deep-copy.
- `src/engine/game-engine.test.ts` - Integration tests for engine.
- `src/strategies/types.ts` - HanabiStrategy interface, Observation, VisibleCard, GameEvent, FinalState.
- `src/strategies/example-strategy.ts` - Example baseline strategy.
- `src/strategies/registry.ts` - Strategy discovery/registration.
- `src/simulator/runner.ts` - Multi-game simulation runner.
- `src/simulator/runner.test.ts` - Tests for determinism and metrics.
- `src/statistics/metrics.ts` - Aggregate metrics, t-test, CI calculation.
- `src/statistics/metrics.test.ts` - Unit tests for t-test and metrics.
- `src/storage/results-writer.ts` - Save results to `results/{timestamp}/`.
- `src/ui/server.ts` - Express server and API routes.
- `src/ui/public/index.html` - Frontend entry.
- `src/ui/public/app.js` or `app.tsx` - UI logic (strategy/config selectors, results table, charts).
- `src/cli.ts` - CLI entry point for `npm run simulate`.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `deck.ts` and `deck.test.ts` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

---

## Tasks

- [ ] 1.0 Project setup & configuration
  - [ ] 1.1 Initialize npm project with `package.json`, add TypeScript, Jest, and build scripts
  - [ ] 1.2 Create `tsconfig.json` with strict mode and appropriate module settings
  - [ ] 1.3 Create directory structure: `src/engine`, `src/strategies`, `src/simulator`, `src/statistics`, `src/ui`, `src/storage`, `src/config`
  - [ ] 1.4 Implement seeded RNG utility (e.g. mulberry32 or similar); ensure no `Math.random` usage anywhere
  - [ ] 1.5 Create config module with `GameConfig` type: player count, hint tokens, life tokens, game count, seed list, logging mode (normal/debug)
  - [ ] 1.6 Add npm scripts: `build`, `test`, `start`, `simulate` (CLI entry for simulation)

- [ ] 2.0 Engine (pure rules layer)
  - [ ] 2.1 Define `Color` enum (5 colors), `Card` type with stable unique ID, and deck composition constants
  - [ ] 2.2 Implement `createDeck()`: 5 colors × (3×1, 2×2, 2×3, 2×4, 1×5) = 50 cards with unique IDs
  - [ ] 2.3 Implement `shuffleDeck(deck, seed)` using seeded RNG; must be deterministic
  - [ ] 2.4 Define `GameState` type: hands, played stacks, discard pile, hint/life tokens, current player, deck, action history
  - [ ] 2.5 Implement `deal(deck, playerCount)`: 5 cards each for 2–3 players, 4 cards for 4–5 players
  - [ ] 2.6 Define `Action` union type: `Play`, `Discard`, `Hint` with required fields
  - [ ] 2.7 Implement `validateAction(state, action)`: ensure play index in range, discard legal, hint has tokens and valid target
  - [ ] 2.8 Implement action execution: Play (correct/incorrect), Discard, Hint; update tokens, stacks, discard; handle game end
  - [ ] 2.9 Implement game end detection: lives = 0 (immediate), score = 25, deck empty + final round complete
  - [ ] 2.10 Define and emit `GameEvent` for each resolved action
  - [ ] 2.11 Implement `calculateScore(playedStacks)`: sum of top card per color (max 25)
  - [ ] 2.12 Implement `buildObservation(state, seatIndex)`: deep-copy only legal info; no own cards, no deck order

- [ ] 3.0 Strategy system & observation model
  - [ ] 3.1 Define `HanabiStrategy` interface: `initialize`, `onGameStart`, `getAction`, `onActionResolved`, `onGameEnd`, `clone`
  - [ ] 3.2 Define `Observation` type with all required fields (visibleCards, observerSeat, ownHandSize, ownCardIds, hintsRemaining, livesRemaining, discardPile, playedStacks, deckCount, actionHistory); no legalActions; getSelfSeat(observation) returns observerSeat; partner seat = 1 - observerSeat (2-player); provide validateActionForObservation(obs, action), getLegalActionsFromObservation(obs), getOwnHintKnowledge/getKnownToHolder from observation-knowledge
  - [ ] 3.3 Define `VisibleCard` type: cards in other hands with color/number only where hinted
  - [ ] 3.4 Define `GameEvent`, `FinalState` types for strategy callbacks
  - [ ] 3.5 Implement deep-copy of Observation before passing to `getAction` (no mutation leakage)
  - [ ] 3.6 Create example strategy (e.g. random legal action) implementing full interface
  - [ ] 3.7 Implement strategy cloning: clone one instance per seat, each with independent state
  - [ ] 3.8 Add strategy registry: manual list or auto-scan of `src/strategies/` for discoverable strategies

- [ ] 4.0 Simulator
  - [ ] 4.1 Implement `generateSeedList(count)` or accept pre-generated seed list for deterministic runs
  - [ ] 4.2 Create simulation runner: for each strategy, for each seed, run one game (same seeds across strategies)
  - [ ] 4.3 Implement single-game loop: get action from current player's strategy → validate → execute → notify strategies → repeat until end
  - [ ] 4.4 Collect per-game metrics: score, isPerfect, livesRemaining, hintsRemaining, misplayCount, endReason
  - [ ] 4.5 Measure execution time: total sim time, avg time per game, avg/max strategy decision time
  - [ ] 4.6 Produce structured `StrategyResult` object: name, scores array, aggregate metrics, timing
  - [ ] 4.7 Support debug mode: collect full trace (seed, initial deck, all actions, all events, final state) per game

- [ ] 5.0 Statistics & storage
  - [ ] 5.1 Compute aggregate metrics: avg score, std dev, std error, 95% CI, % perfect games
  - [ ] 5.2 Compute additional metrics: avg lives remaining, avg hints remaining, misplay rate, end reason distribution
  - [ ] 5.3 Implement two-sample t-test between any two strategy score arrays
  - [ ] 5.4 Implement formatted comparison output: "Strategy A avg: X ± Y", p-value, conclusion (A better / B better / no significant difference)
  - [ ] 5.5 Create `results/{timestamp}/` directory; write `summary.json`, `raw_scores.json`, `stats.json`
  - [ ] 5.6 In debug mode, write `traces/` subfolder with one JSON file per game (trace format per FR-34)
  - [ ] 5.7 Define score histogram data structure (e.g. bins 0–25 with counts)

- [ ] 6.0 Web UI
  - [ ] 6.1 Create Express server: serve static files from `src/ui/public`, API routes under `/api`
  - [ ] 6.2 API: `GET /api/strategies` (list), `GET /api/configs` (list), `POST /api/run` (run simulation, return or stream results)
  - [ ] 6.3 API: `GET /api/results/:timestamp` to fetch stored result (summary, raw_scores, stats)
  - [ ] 6.4 HTML page: strategy selector (dropdown), config selector (dropdown), Run button
  - [ ] 6.5 Results section: table with columns (strategy, avg score, std dev, % perfect, games, timing)
  - [ ] 6.6 Add Chart.js; render score histogram from results data
  - [ ] 6.7 Add comparison table: select two strategies, show p-value and conclusion
  - [ ] 6.8 Optional: link to download debug trace for a specific game
