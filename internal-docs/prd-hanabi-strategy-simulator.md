# Product Requirements Document: Hanabi Strategy Simulator

## 1. Introduction/Overview

The **Hanabi Strategy Simulator** is a TypeScript-based simulator for the cooperative card game Hanabi. It enables plug-and-play strategy experimentation with deterministic multi-game simulation, fair comparison across strategies, and statistical significance testing.

**Problem:** Researchers, game theorists, and hobbyists lack a lightweight, extensible tool to experiment with Hanabi strategies in a controlled, reproducible environment.

**Goal:** Provide a simulator where users can easily create new strategies, run them on identical game seeds for fair comparison, and obtain statistically meaningful performance data—all with full trace debugging and a basic visualization UI. The simulator is designed for experimentation and fun, not for modeling human cognition.

---

## 2. Goals

### Primary Goals

| # | Goal | Success Metric |
|---|------|----------------|
| 1 | Easily create new strategies | New strategy can be added in under 5 minutes |
| 2 | Run multiple strategies on identical game seeds | Deterministic simulation with reusable seed list |
| 3 | Compare performance statistically | Two-sample t-test, p-value, confidence intervals |
| 4 | Track average score and % perfect games | Core metrics displayed in results |
| 5 | Allow deep debugging via full trace logs | Debug trace usable for single-game replay |
| 6 | Provide basic visualization UI | Results table, score histogram, comparison view |

### Secondary Goals

- Track additional metrics (lives remaining, hints remaining, misplay rate, etc.)
- Measure strategy execution time
- Store results automatically
- Provide simple visualization of results (charts, comparison table)

---

## 3. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|-------------|
| US-1 | Strategy developer | Implement a new strategy using a simple interface | I can experiment with new ideas without learning complex internals |
| US-2 | Researcher | Run the same seeds across multiple strategies | I can fairly compare strategies on identical game conditions |
| US-3 | Analyst | View statistical comparison (avg score, p-value, CI) | I can determine if performance differences are statistically significant |
| US-4 | Debugger | Export a full game trace (JSON) | I can replay and inspect every action in a single game |
| US-5 | Experimenter | Configure player count, game count, seeds, and variant rules | I can tailor simulations to my research or testing needs |
| US-6 | User | Run 10k games and see results quickly | I can iterate on strategies without long waits |
| US-7 | User | See a score histogram and results table in a simple UI | I can visually compare strategy performance |

---

## 4. Functional Requirements

### 4.1 Engine (Pure Rules Layer)

| ID | Requirement |
|----|-------------|
| FR-1 | The engine must create a standard Hanabi deck: 5 colors × (3×1, 2×2, 2×3, 2×4, 1×5) = 50 cards total |
| FR-2 | The engine must use a seeded RNG for deck shuffling; given a seed, output must be deterministic |
| FR-3 | The engine must manage game state (hands, stacks, discard, tokens) without strategy logic |
| FR-4 | The engine must validate all actions (play, discard, hint) before execution |
| FR-5 | The engine must enforce all rules: life tokens (start 3), info tokens (start 8), game end conditions |
| FR-6 | The engine must emit events for action resolution |
| FR-7 | The engine must calculate final score as sum of top card in each color stack (max 25) |
| FR-8 | The engine must assign stable, unique IDs to all cards |
| FR-9 | The engine must not leak hidden information to strategies |
| FR-10 | Deal rules: 5 cards for 2–3 players, 4 cards for 4–5 players |

### 4.2 Strategy System

| ID | Requirement |
|----|-------------|
| FR-11 | Strategies must implement: `initialize`, `onGameStart`, `getAction`, `onActionResolved`, `onGameEnd`, `clone` |
| FR-12 | One strategy implementation is cloned per seat; each seat maintains independent state |
| FR-13 | Strategies receive only legal information via an `Observation` object |
| FR-14 | The engine must deep-copy observations before passing to strategies |
| FR-15 | Strategies may have perfect memory and unlimited reasoning |
| FR-16 | Strategies must not access hidden information (own cards, deck order, etc.) |
| FR-17 | Strategies may use RNG only if explicitly seeded for reproducibility |

### 4.3 Observation Model

| ID | Requirement |
|----|-------------|
| FR-18 | Observation must include: `visibleHands`, `ownHandSize`, `hintsRemaining`, `livesRemaining`, `discardPile`, `playedStacks`, `deckCount`, `actionHistory`. The observer's seat ("self") is derived via `getSelfSeat(observation)` (the seat whose hand is omitted from `visibleHands`). Observation does not include legal actions; strategies are responsible for returning a valid action. The engine throws when an invalid action is returned. Strategies can call `validateActionForObservation(observation, action)` to check validity and `getLegalActionsFromObservation(observation)` to obtain the legal action list. |
| FR-19 | `visibleHands` must show all other players' cards (color/number where hinted) |
| FR-20 | `ownHandSize` is the count only; strategies never see their own cards |

### 4.4 Simulator

| ID | Requirement |
|----|-------------|
| FR-21 | The simulator must generate or accept a deterministic seed list |
| FR-22 | The simulator must run N games per strategy, reusing identical seeds across strategies |
| FR-23 | The simulator must collect metrics per game and aggregate across strategies |
| FR-24 | The simulator must measure execution time (total, per-game, per-decision) |
| FR-25 | The simulator must produce structured result objects for storage and display |

### 4.5 Metrics

| ID | Requirement |
|----|-------------|
| FR-26 | Required metrics: average score, % perfect games (max 25 reached) |
| FR-27 | Additional metrics: standard deviation, standard error, 95% CI |
| FR-28 | Additional metrics: lives remaining (avg), hints remaining (avg), misplay rate |
| FR-29 | Additional metrics: game end reason distribution, score histogram |

### 4.6 Statistical Testing

| ID | Requirement |
|----|-------------|
| FR-30 | Implement two-sample t-test between any two strategies |
| FR-31 | Report p-value and confidence interval for score difference |
| FR-32 | Output example format: `Strategy A avg: 23.12 ± 0.08`, `Strategy B avg: 23.34 ± 0.07`, `p-value: 0.013`, conclusion |

### 4.7 Logging & Debugging

| ID | Requirement |
|----|-------------|
| FR-33 | Support Normal mode (metrics only) and Debug mode (full game traces) |
| FR-34 | Game trace must include: seed, initial deck order, all actions, all hints, all resolved plays, final state |
| FR-35 | Traces stored as JSON |

### 4.8 Storage

| ID | Requirement |
|----|-------------|
| FR-36 | Automatically save to `/results/{timestamp}/` |
| FR-37 | Save `summary.json`, `raw_scores.json`, `stats.json` |
| FR-38 | Optionally save `traces/` directory with game trace JSONs |

### 4.9 UI

| ID | Requirement |
|----|-------------|
| FR-39 | Simple web-based UI with strategy selector |
| FR-40 | Config selector (player count, game count, seeds, etc.) |
| FR-41 | Run simulation button |
| FR-42 | Results table showing metrics per strategy |
| FR-43 | Score histogram chart |
| FR-44 | Comparison table with p-value display |
| FR-45 | No real-time animation required |
| FR-46 | UI reads from result files or triggers simulation via API |

### 4.10 Configuration

| ID | Requirement |
|----|-------------|
| FR-47 | Configurable: player count, variant rules, hint tokens, life tokens |
| FR-48 | Configurable: game count, seed list |
| FR-49 | Configurable: logging mode (normal vs debug) |

### 4.11 Determinism

| ID | Requirement |
|----|-------------|
| FR-50 | Single seeded RNG source; no `Math.random` allowed |
| FR-51 | Pre-generated seed list for reproducible runs |
| FR-52 | Strategy RNG must be seeded if used |

### 4.12 Game Rules (Standard Hanabi)

| ID | Requirement |
|----|-------------|
| FR-53 | Turn actions: Play, Discard, Give hint (one per turn) |
| FR-54 | Play correct → add to stack; play 5 → gain 1 info token (max 8) |
| FR-55 | Play incorrect → lose 1 life; game ends if lives = 0 |
| FR-56 | Discard → gain 1 info token (max 8) |
| FR-57 | Hint costs 1 info token; must specify all cards of a color OR all cards of a number |
| FR-58 | Game ends when: lives = 0, score = 25, or deck empty + final round complete |

---

## 5. Non-Goals (Out of Scope)

- **Online multiplayer** — local/offline simulation only
- **Human gameplay UI** — no interactive card playing for humans
- **Real-time animations** — static displays only
- **ML training infrastructure** — no built-in reinforcement learning pipeline
- **Large-scale distributed simulation** — single-machine execution

---

## 6. Design Considerations

### 6.1 Directory Structure

```
/engine          # Pure rules layer
/strategies      # Strategy implementations
/simulator       # Multi-game runner
/statistics      # Metrics and statistical tests
/ui              # Web UI
/storage         # Result persistence
/config          # Configuration management
```

### 6.2 UI Wireframe (Conceptual)

- **Top:** Strategy selector (dropdown), Config selector (dropdown), Run button
- **Middle:** Results table (strategy name, avg score, std dev, % perfect, etc.)
- **Bottom:** Score histogram (Chart.js), Comparison table (Strategy A vs B with p-value)
- **Optional:** Debug trace download link for selected game

### 6.3 Tech Recommendation

- Express server for API and static serving
- Minimal React or vanilla frontend
- Chart.js for histograms

---

## 7. Technical Considerations

### 7.1 Architecture Principles

- **Strict separation of concerns** between engine, strategies, simulator, statistics, UI, storage
- **Determinism first:** seeded RNG everywhere; no non-deterministic APIs
- **Strategy interface:** symmetric, cloneable, observation-only access

### 7.2 Performance Expectations

- 10k games should complete within **seconds**
- Memory footprint must remain manageable
- Debug mode may be slower but acceptable

### 7.3 Future Extensibility (Not in Scope, but Architecture Should Allow)

- Add variants (e.g., rainbow suit)
- Add mixed-strategy tables
- Add reinforcement learning hooks
- Add parallel simulation
- Add advanced belief modeling

---

## 8. Success Criteria

The system is complete when:

1. ✅ New strategy can be added in under 5 minutes  
2. ✅ 10k games can be run deterministically  
3. ✅ Statistical comparison (t-test, p-value, CI) works  
4. ✅ Results stored automatically to `/results/{timestamp}/`  
5. ✅ Debug trace usable for single-game replay  
6. ✅ Simple UI displays results (table, histogram, comparison)

---

## 9. Open Questions

| # | Question | Notes |
|---|----------|-------|
| OQ-1 | **Variant rules:** Which variants should be supported in v1 besides standard Hanabi? | Rainbow suit, multicolor, etc. mentioned for future extensibility |
| OQ-2 | **Strategy registration:** How should strategies be registered/discovered? | Auto-scan `/strategies` folder vs manual config? |
| OQ-3 | **API format:** Should the UI trigger simulation via REST, or only read pre-generated result files? | Spec says "or" — preference? |
| OQ-4 | **Invalid actions:** What should happen if a strategy returns an invalid action? | Fail fast, retry, or substitute with discard? |
| OQ-5 | **Result retention:** How long should results be kept? Any cleanup policy? | |

---

## Appendix A: Game Rules Reference (Standard Hanabi)

**Objective:** Build five color stacks from 1 to 5. Maximum score: 25.

**Deck:** 5 colors × (3×1, 2×2, 2×3, 2×4, 1×5) = 50 cards.

**Setup:** Shuffle (seeded), deal 5 cards (2–3 players) or 4 cards (4–5 players). Players see others' hands, not their own. Start: 8 info tokens, 3 life tokens.

**Actions:** Play | Discard | Give hint. One per turn.

**Game End:** Lives = 0 (loss) | Score = 25 (win) | Deck empty + final round complete.

---

## Appendix B: Strategy Interface (TypeScript)

```typescript
interface HanabiStrategy {
  initialize(config: GameConfig, seatIndex: number): void
  onGameStart(observation: Observation): void
  getAction(observation: Observation): Action
  onActionResolved(event: GameEvent): void
  onGameEnd(result: FinalState): void
  clone(): HanabiStrategy
}
```

---

## Appendix C: Observation Model (TypeScript)

```typescript
type Observation = {
  visibleHands: Record<number, VisibleCard[]>
  ownHandSize: number
  hintsRemaining: number
  livesRemaining: number
  discardPile: Card[]
  playedStacks: Record<Color, number>
  deckCount: number
  actionHistory: GameEvent[]
  // optional: gameSeed
}
// Observer's seat: getSelfSeat(observation). Legal actions: getLegalActionsFromObservation(obs); validate: validateActionForObservation(obs, action).
```
