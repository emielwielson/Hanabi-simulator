/**
 * Replay state builder: applies trace events to produce game state at each step.
 */
const COLOR_NAMES = ['Red', 'Yellow', 'Green', 'Blue', 'White'];
const CARD_COLORS = ['#dc2626', '#eab308', '#22c55e', '#3b82f6', '#f8fafc']; // R,Y,G,B,W

const PLAYER_COUNT = 2;
const CARDS_PER_PLAYER = 5;

function deal(deck) {
  const hands = [];
  let idx = 0;
  for (let p = 0; p < PLAYER_COUNT; p++) {
    const hand = [];
    for (let i = 0; i < CARDS_PER_PLAYER; i++) {
      hand.push(deck[idx++]);
    }
    hands.push(hand);
  }
  return { hands, deck: deck.slice(idx) };
}

function advancePlayer(currentPlayer) {
  return (currentPlayer + 1) % PLAYER_COUNT;
}

/**
 * Builds replay snapshots: array of states [state0, state1, ..., stateN].
 * state0 = initial deal. stateK = after applying events[0..K-1].
 */
function buildReplaySteps(trace, config) {
  const hintTokens = config.hintTokens ?? 8;
  const lifeTokens = config.lifeTokens ?? 3;

  const { hands, deck } = deal([...trace.initialDeckOrder]);
  const steps = [];
  const hintKnowledge = new Map();

  let state = {
    hands: hands.map((h) => [...h]),
    deck: [...deck],
    playedStacks: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
    discardPile: [],
    hintTokens,
    lifeTokens,
    currentPlayer: 0,
    hintKnowledge: new Map(),
  };

  steps.push(deepCopyState(state));

  for (const ev of trace.events) {
    if (ev.type === 'play') {
      const hand = state.hands[ev.playerIndex];
      const card = hand.splice(ev.cardIndex, 1)[0];
      if (ev.success) {
        state.playedStacks[card.color] = card.value;
        if (card.value === 5 && state.hintTokens < 8) state.hintTokens++;
      } else {
        state.discardPile.push(card);
        state.lifeTokens--;
      }
      if (state.deck.length > 0) {
        state.hands[ev.playerIndex].push(state.deck.shift());
      }
    } else if (ev.type === 'discard') {
      const hand = state.hands[ev.playerIndex];
      const card = hand.splice(ev.cardIndex, 1)[0];
      state.discardPile.push(card);
      if (state.hintTokens < 8) state.hintTokens++;
      if (state.deck.length > 0) {
        state.hands[ev.playerIndex].push(state.deck.shift());
      }
    } else if (ev.type === 'hint') {
      state.hintTokens--;
      const targetHand = state.hands[ev.targetPlayer];
      const matchedSet = new Set(ev.matchedCardIndices ?? []);
      for (let idx = 0; idx < targetHand.length; idx++) {
        const card = targetHand[idx];
        if (!card) continue;
        const known = state.hintKnowledge.get(card.id) ?? {};
        if (matchedSet.has(idx)) {
          if (ev.hintType === 'color') known.color = ev.hintValue;
          else known.value = ev.hintValue;
          state.hintKnowledge.set(card.id, known);
        } else {
          // Option removal: cards that don't match can no longer be that color/number
          if (ev.hintType === 'color') {
            if (known.color === undefined) {
              const excluded = known.excludedColors ?? [];
              if (!excluded.includes(ev.hintValue)) {
                known.excludedColors = [...excluded, ev.hintValue];
                state.hintKnowledge.set(card.id, known);
              }
            }
          } else {
            if (known.value === undefined) {
              const excluded = known.excludedValues ?? [];
              if (!excluded.includes(ev.hintValue)) {
                known.excludedValues = [...excluded, ev.hintValue];
                state.hintKnowledge.set(card.id, known);
              }
            }
          }
        }
      }
    }
    state.currentPlayer = advancePlayer(state.currentPlayer);
    steps.push(deepCopyState(state));
  }

  return steps;
}

function deepCopyState(s) {
  const hintKnowledge = new Map();
  for (const [k, v] of s.hintKnowledge) {
    hintKnowledge.set(k, {
      ...v,
      excludedColors: v.excludedColors ? [...v.excludedColors] : undefined,
      excludedValues: v.excludedValues ? [...v.excludedValues] : undefined,
    });
  }
  return {
    hands: s.hands.map((h) => h.map((c) => ({ ...c }))),
    deck: [...s.deck],
    playedStacks: { ...s.playedStacks },
    discardPile: s.discardPile.map((c) => ({ ...c })),
    hintTokens: s.hintTokens,
    lifeTokens: s.lifeTokens,
    currentPlayer: s.currentPlayer,
    hintKnowledge,
  };
}

function formatCard(card) {
  return `${COLOR_NAMES[card.color] ?? '?'} ${card.value}`;
}

function formatEvent(ev) {
  if (ev.type === 'play') {
    const cardStr = ev.card ? formatCard(ev.card) : 'card';
    return `Player ${ev.playerIndex} played ${cardStr} (${ev.success ? 'success' : 'misfire'})`;
  }
  if (ev.type === 'discard') {
    return `Player ${ev.playerIndex} discarded ${formatCard(ev.card)}`;
  }
  if (ev.type === 'hint') {
    const val = ev.hintType === 'color' ? (COLOR_NAMES[ev.hintValue] ?? ev.hintValue) : ev.hintValue;
    return `Player ${ev.playerIndex} hinted Player ${ev.targetPlayer}: ${ev.hintType} ${val}`;
  }
  return '?';
}

/** Renders the "last turn" hint card for top-right (only when last event is a hint). */
function renderLastTurnHintCard(ev) {
  if (!ev || ev.type !== 'hint') return '';
  const isColor = ev.hintType === 'color';
  const bgColor = isColor ? (CARD_COLORS[ev.hintValue] ?? '#94a3b8') : '';
  const textColor = ev.hintValue === 4 ? '#1e293b' : '#1e293b';
  const style = isColor
    ? `background:linear-gradient(180deg, ${bgColor} 0%, ${adjustBrightness(bgColor, -0.2)} 100%); color:${textColor}`
    : '';
  const cls = isColor ? 'hint-card-mini hint-color' : 'hint-card-mini hint-number';
  const content = isColor ? '' : String(ev.hintValue);
  return `<div class="replay-last-turn"><span class="replay-last-turn-label">Last hint</span><div class="${cls}" style="${style}">${content}</div></div>`;
}

/** Renders visual lives and hints tokens (to the right of hands). */
function renderReplayTokens(hintTokens, lifeTokens, maxHints, maxLives) {
  let html = '<div class="replay-tokens">';
  html += '<div class="replay-tokens-group"><span class="replay-tokens-label">Hints</span><div class="replay-token-hints">';
  for (let i = 0; i < maxHints; i++) {
    html += `<span class="token-hint ${i < hintTokens ? 'token-available' : 'token-used'}" title="Hint ${i + 1} of ${maxHints}"></span>`;
  }
  html += '</div></div>';
  html += '<div class="replay-tokens-group"><span class="replay-tokens-label">Lives</span><div class="replay-token-lives">';
  for (let i = 0; i < maxLives; i++) {
    html += `<span class="token-life ${i < lifeTokens ? 'token-available' : 'token-used'}" title="Life ${i + 1} of ${maxLives}">♥</span>`;
  }
  html += '</div></div></div>';
  return html;
}

const ALL_COLORS = [0, 1, 2, 3, 4];
const ALL_VALUES = [1, 2, 3, 4, 5];

/**
 * For a card and its hint knowledge, return which colors and numbers are still possible.
 * Known color/value from a hint: only that one is possible.
 * Option removal: excluded colors/values (from non-matching cards when a hint was given) are removed.
 */
function getPossibleHints(card, hintKnowledge) {
  const known = hintKnowledge.get(card.id) ?? {};
  const possibleColors = known.color !== undefined
    ? [known.color]
    : ALL_COLORS.filter((c) => !(known.excludedColors || []).includes(c));
  const possibleValues = known.value !== undefined
    ? [known.value]
    : ALL_VALUES.filter((v) => !(known.excludedValues || []).includes(v));
  return { possibleColors, possibleValues };
}

function renderCard(card, hintKnowledge, cardIndex) {
  const { possibleColors, possibleValues } = getPossibleHints(card, hintKnowledge);
  const bgColor = CARD_COLORS[card.color] ?? '#94a3b8';
  const textColor = card.color === 4 ? '#1e293b' : '#1e293b'; // White card needs dark text
  const colorsHtml = possibleColors
    .map((c) => `<span class="hint-dot" style="background:${CARD_COLORS[c]}"></span>`)
    .join('');
  const numbersHtml = possibleValues
    .map((v) => `<span class="hint-num">${v}</span>`)
    .join(' ');

  return `
    <div class="hanabi-card" data-index="${cardIndex}">
      <div class="hanabi-card-face" style="background:linear-gradient(180deg, ${bgColor} 0%, ${adjustBrightness(bgColor, -0.2)} 100%); color:${textColor}">
        <span class="hanabi-card-index">${String.fromCharCode(65 + cardIndex)}</span>
        <span class="hanabi-card-value">${card.value}</span>
      </div>
      <div class="hanabi-card-hints">
        <div class="hint-colors">${colorsHtml}</div>
        <div class="hint-numbers">${numbersHtml}</div>
      </div>
    </div>`;
}

function adjustBrightness(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round(amount * 255)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(amount * 255)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(amount * 255)));
  return `rgb(${r},${g},${b})`;
}

/** Renders a stack card (no hints, just face). For played stacks. highlight: optional bool for last-moved border. */
function renderStackCard(color, value, options = {}) {
  const highlight = options.highlight ? ' last-moved-card' : '';
  const bgColor = CARD_COLORS[color] ?? '#94a3b8';
  const textColor = color === 4 ? '#1e293b' : '#1e293b';
  return `
    <div class="hanabi-stack-card${highlight}">
      <div class="hanabi-card-face" style="background:linear-gradient(180deg, ${bgColor} 0%, ${adjustBrightness(bgColor, -0.2)} 100%); color:${textColor}">
        <span class="hanabi-card-value">${value}</span>
      </div>
    </div>`;
}

/** Renders all 5 color stacks as columns, showing only the top card of each. lastEvent: optional, to highlight last played card. */
function renderStacks(playedStacks, lastEvent) {
  const highlightTopOfColor = lastEvent?.type === 'play' && lastEvent.success && lastEvent.card
    ? lastEvent.card.color
    : null;
  let html = '<div class="stacks-row">';
  for (let color = 0; color < 5; color++) {
    const topValue = playedStacks[color] ?? 0;
    const isLastPlayed = highlightTopOfColor === color && topValue === lastEvent?.card?.value;
    html += `<div class="stack-col"><div class="stack-label">${COLOR_NAMES[color]}</div>`;
    if (topValue > 0) {
      html += renderStackCard(color, topValue, { highlight: isLastPlayed });
    } else {
      html += '<div class="stack-empty">—</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

/** Renders discard pile at bottom, grouped by color and sorted by value. lastEvent: optional, to highlight last discarded/misplayed card. */
function renderDiscardPile(discardPile, lastEvent) {
  const lastCardId = (lastEvent?.type === 'discard' || (lastEvent?.type === 'play' && !lastEvent?.success)) && lastEvent?.card
    ? lastEvent.card.id
    : null;
  const byColor = [[], [], [], [], []];
  for (const card of discardPile) {
    if (card.color >= 0 && card.color <= 4) {
      byColor[card.color].push(card);
    }
  }
  for (let c = 0; c < 5; c++) {
    byColor[c].sort((a, b) => a.value - b.value);
  }

  let html = '<div class="discard-pile-section"><div class="discard-pile-label">Discard pile</div><div class="discard-pile-by-color">';
  for (let color = 0; color < 5; color++) {
    html += `<div class="discard-color-row"><div class="stack-label">${COLOR_NAMES[color]}</div><div class="discard-cards-row">`;
    if (byColor[color].length > 0) {
      for (const card of byColor[color]) {
        html += renderStackCard(card.color, card.value, { highlight: lastCardId != null && card.id === lastCardId });
      }
    } else {
      html += '<div class="stack-empty">—</div>';
    }
    html += '</div></div>';
  }
  html += '</div></div>';
  return html;
}
