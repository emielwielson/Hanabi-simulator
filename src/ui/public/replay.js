/**
 * Replay state builder: applies trace events to produce game state at each step.
 */
const COLOR_NAMES = ['Red', 'Yellow', 'Green', 'Blue', 'White'];
const CARD_COLORS = ['#dc2626', '#eab308', '#22c55e', '#3b82f6', '#f8fafc']; // R,Y,G,B,W

function cardsPerPlayer(playerCount) {
  return playerCount <= 3 ? 5 : 4;
}

function deal(deck, playerCount) {
  const cardsPer = cardsPerPlayer(playerCount);
  const hands = [];
  let idx = 0;
  for (let p = 0; p < playerCount; p++) {
    const hand = [];
    for (let i = 0; i < cardsPer; i++) {
      hand.push(deck[idx++]);
    }
    hands.push(hand);
  }
  return { hands, deck: deck.slice(idx) };
}

function advancePlayer(currentPlayer, playerCount) {
  return (currentPlayer + 1) % playerCount;
}

/**
 * Builds replay snapshots: array of states [state0, state1, ..., stateN].
 * state0 = initial deal. stateK = after applying events[0..K-1].
 */
function buildReplaySteps(trace, config) {
  const playerCount = config.playerCount ?? 2;
  const hintTokens = config.hintTokens ?? 8;
  const lifeTokens = config.lifeTokens ?? 3;

  const { hands, deck } = deal([...trace.initialDeckOrder], playerCount);
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
      for (const idx of ev.matchedCardIndices) {
        const card = targetHand[idx];
        if (!card) continue;
        const known = state.hintKnowledge.get(card.id) ?? {};
        if (ev.hintType === 'color') known.color = ev.hintValue;
        else known.value = ev.hintValue;
        state.hintKnowledge.set(card.id, known);
      }
    }
    state.currentPlayer = advancePlayer(state.currentPlayer, playerCount);
    steps.push(deepCopyState(state));
  }

  return steps;
}

function deepCopyState(s) {
  const hintKnowledge = new Map();
  for (const [k, v] of s.hintKnowledge) {
    hintKnowledge.set(k, { ...v });
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

/**
 * For a card and its hint knowledge, return which colors and numbers are still possible.
 * When we know color/value from a hint, only that one is possible; others disappear.
 */
function getPossibleHints(card, hintKnowledge) {
  const known = hintKnowledge.get(card.id) ?? {};
  const possibleColors = known.color !== undefined
    ? [known.color]
    : [0, 1, 2, 3, 4];
  const possibleValues = known.value !== undefined
    ? [known.value]
    : [1, 2, 3, 4, 5];
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

/** Renders a stack card (no hints, just face). For played stacks. */
function renderStackCard(color, value) {
  const bgColor = CARD_COLORS[color] ?? '#94a3b8';
  const textColor = color === 4 ? '#1e293b' : '#1e293b';
  return `
    <div class="hanabi-stack-card">
      <div class="hanabi-card-face" style="background:linear-gradient(180deg, ${bgColor} 0%, ${adjustBrightness(bgColor, -0.2)} 100%); color:${textColor}">
        <span class="hanabi-card-value">${value}</span>
      </div>
    </div>`;
}

/** Renders all 5 color stacks as columns, showing only the top card of each. */
function renderStacks(playedStacks) {
  let html = '<div class="stacks-row">';
  for (let color = 0; color < 5; color++) {
    const topValue = playedStacks[color] ?? 0;
    html += `<div class="stack-col"><div class="stack-label">${COLOR_NAMES[color]}</div>`;
    if (topValue > 0) {
      html += renderStackCard(color, topValue);
    } else {
      html += '<div class="stack-empty">—</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}
