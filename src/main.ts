import {
  getEnemiesForLevel,
  resolveMonsterAttackPhase,
  resolveMonsterMovementPhase,
  spawnEnemiesOnTiles
} from './enemy.js';
import { buildMapForLevel, getSpawnTilesForLevel, getStartTiles } from './map.js';
import {
  createPlayer,
  grantLevelCompletionUpgrade,
  movePlayerToMapStart,
  upgradePlayerStat,
  attackEnemy,
  movePlayer,
  canMoveTo,
  canAttackEnemy
} from './player.js';
import {
  assignSelectedDieToStat,
  getInitialTurnResources,
  getNextPhase,
  isEnergyAssignmentComplete,
  rollEnergyDice,
  selectEnergyDie,
  setRolledDice
} from './phase.js';
import { renderMap } from './render.js';
import type {
  DungeonMap,
  EnergyStatKey,
  Player,
  PlayerStatKey,
  SpawnedEnemy,
  TurnPhase,
  TurnResources
} from './types.js';

const board = document.getElementById('game-board');
const nextLevelBtn = document.getElementById('next-level');
const nextPhaseBtn = document.getElementById('next-phase');
const levelIndicator = document.getElementById('level-indicator');

if (!(board instanceof HTMLElement)) {
  throw new Error('No se encontró el contenedor #game-board');
}

const boardElement: HTMLElement = board;

let nivelActual: number = 1;
let currentMap: DungeonMap = buildMapForLevel(nivelActual);
let currentEnemies: SpawnedEnemy[] = [];
let player: Player = createPlayer(currentMap);
let currentPhase: TurnPhase = 'energy';
let turnResources: TurnResources = getInitialTurnResources(player);

type TutorialStep = {
  text: string;
  visual: string;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    text: 'Objetivo: limpia el nivel derrotando todos los enemigos para poder pasar al siguiente.',
    visual: '<div class="tutorial-shape-row"><span class="tutorial-shape">P</span><span class="tutorial-shape">→</span><span class="tutorial-shape">A1</span><span class="tutorial-shape">A2</span></div>'
  },
  {
    text: 'Fase de energía: tira 3 dados y asigna uno a velocidad, uno a daño y uno a defensa.',
    visual: '<div class="tutorial-shape-row"><span class="tutorial-shape">⚀</span><span class="tutorial-shape">⚃</span><span class="tutorial-shape">⚅</span></div>'
  },
  {
    text: 'Moverse cuesta energía de velocidad: 2 puntos si te mueves en línea recta (arriba, abajo, izquierda o derecha) y 3 puntos si te mueves en diagonal.',
    visual: '<div class="tutorial-shape-row"><span class="tutorial-shape">2</span><span class="tutorial-shape">↔</span><span class="tutorial-shape">3</span><span class="tutorial-shape">↘</span></div>'
  },
  {
    text: 'Ataca enemigos en alcance y con línea de visión. El daño se reduce por su defensa.',
    visual: '<div class="tutorial-shape-row"><span class="tutorial-shape">🗡</span><span class="tutorial-shape">-</span><span class="tutorial-shape">🛡</span><span class="tutorial-shape">=</span><span class="tutorial-shape">❤</span></div>'
  },
  {
    text: 'Si terminas el nivel recibes una mejora. Vida cura +1 hasta su tope.',
    visual: '<div class="tutorial-shape-row"><span class="tutorial-shape">+1</span><span class="tutorial-shape">❤</span><span class="tutorial-shape">MAX 6</span></div>'
  },
  {
    text: 'Si tu vida llega a 0, pierdes. Usa defensa y alcance para sobrevivir.',
    visual: '<div class="tutorial-shape-row"><span class="tutorial-shape">❤0</span><span class="tutorial-shape">=</span><span class="tutorial-shape">FIN</span></div>'
  },
  {
    text: 'Nota final: actualmente el juego cuenta con 12 niveles (del 1 al 12).',
    visual: '<div class="tutorial-shape-row"><span class="tutorial-shape">N</span><span class="tutorial-shape">1</span><span class="tutorial-shape">…</span><span class="tutorial-shape">12</span></div>'
  }
];

let tutorialIndex = 0;

function initTutorial(): void {
  const openBtn = document.getElementById('tutorial-open');
  const modal = document.getElementById('tutorial-modal');
  const textEl = document.getElementById('tutorial-text');
  const visualEl = document.getElementById('tutorial-visual');
  const stepEl = document.getElementById('tutorial-step');
  const skipBtn = document.getElementById('tutorial-skip');
  const nextBtn = document.getElementById('tutorial-next');

  if (
    !(openBtn instanceof HTMLButtonElement) ||
    !(modal instanceof HTMLElement) ||
    !(textEl instanceof HTMLElement) ||
    !(visualEl instanceof HTMLElement) ||
    !(stepEl instanceof HTMLElement) ||
    !(skipBtn instanceof HTMLButtonElement) ||
    !(nextBtn instanceof HTMLButtonElement)
  ) {
    return;
  }

  const renderTutorialStep = (): void => {
    const step = TUTORIAL_STEPS[tutorialIndex];
    textEl.textContent = step.text;
    visualEl.innerHTML = step.visual;
    stepEl.textContent = `Paso ${tutorialIndex + 1} / ${TUTORIAL_STEPS.length}`;
    skipBtn.disabled = tutorialIndex === 0;
    nextBtn.textContent = tutorialIndex === TUTORIAL_STEPS.length - 1 ? 'Listo' : 'Siguiente';
  };

  const openTutorial = (): void => {
    tutorialIndex = 0;
    renderTutorialStep();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  };

  const closeTutorial = (): void => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  };

  openBtn.addEventListener('click', () => {
    openTutorial();
  });

  skipBtn.addEventListener('click', () => {
    if (tutorialIndex === 0) {
      return;
    }

    tutorialIndex -= 1;
    renderTutorialStep();
  });

  nextBtn.addEventListener('click', () => {
    if (tutorialIndex >= TUTORIAL_STEPS.length - 1) {
      closeTutorial();
      return;
    }

    tutorialIndex += 1;
    renderTutorialStep();
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) {
      closeTutorial();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) {
      closeTutorial();
    }
  });
}

function canAdvanceToNextLevel(): boolean {
  return (
    nivelActual < 12 &&
    currentPhase === 'level-complete' &&
    currentEnemies.length === 0 &&
    player.mejorasDisponibles === 0
  );
}

function updateNextLevelButtonState(): void {
  if (!(nextLevelBtn instanceof HTMLButtonElement)) {
    return;
  }

  nextLevelBtn.textContent = nivelActual >= 12 ? 'Nivel maximo' : 'Pasar nivel';
  nextLevelBtn.disabled = !canAdvanceToNextLevel();
}

function enterLevelCompletePhase(): void {
  if (currentPhase === 'level-complete') {
    return;
  }

  player = grantLevelCompletionUpgrade(player);
  currentPhase = 'level-complete';
  turnResources = getInitialTurnResources(player);
}

function updateNextPhaseButtonState(): void {
  if (!(nextPhaseBtn instanceof HTMLButtonElement)) {
    return;
  }

  nextPhaseBtn.style.display = currentPhase === 'energy' ? 'none' : '';

  let label = 'Finalizar turno';
  let disabled = false;

  if (currentPhase === 'energy') {
    label = 'Confirmar energia';
    disabled = true;
  } else if (currentPhase === 'adventurer') {
    label = 'Finalizar turno';
  } else if (currentPhase === 'monster-move') {
    label = 'Resolviendo movimiento...';
    disabled = true;
  } else if (currentPhase === 'monster-attack') {
    label = 'Resolver ataque enemigo';
  } else if (currentPhase === 'game-over') {
    label = 'Juego terminado';
    disabled = true;
  } else {
    disabled = true;
  }

  nextPhaseBtn.textContent = label;
  nextPhaseBtn.disabled = disabled;
}

function renderCurrentState(): void {
  if (levelIndicator instanceof HTMLElement) {
    levelIndicator.textContent = `Nivel ${currentMap.level}`;
  }

  renderMap(
    currentMap,
    boardElement,
    currentEnemies,
    player,
    handleUpgradeStat,
    currentPhase,
    turnResources,
    handleRollEnergyDice,
    handleSelectEnergyDie,
    handleAssignEnergyDie,
    handleMovePlayer,
    handleAttackEnemy
  );

  updateNextPhaseButtonState();
  updateNextLevelButtonState();
}

function loadLevel(level: number): void {
  nivelActual = level;
  currentMap = buildMapForLevel(nivelActual);

  const spawnTiles = getSpawnTilesForLevel(currentMap, nivelActual);
  currentEnemies = spawnEnemiesOnTiles(nivelActual, spawnTiles);

  player = movePlayerToMapStart(player, currentMap);
  currentPhase = 'energy';
  turnResources = getInitialTurnResources(player);

  renderCurrentState();

  console.log('Nivel actual:', nivelActual);
  console.log('Fase:', currentPhase);
  console.log('Cara activa:', currentMap.side);
  console.log('Invertido:', currentMap.inverted);
  console.log('Casillas de inicio:', getStartTiles(currentMap));
  console.log('Tipos de enemigos del nivel:', getEnemiesForLevel(nivelActual));
  console.log('Enemigos generados:', currentEnemies);
  console.log('Jugador:', player);
  console.log('Recursos del turno:', turnResources);
}

function handleUpgradeStat(stat: PlayerStatKey): void {
  const updatedPlayer = upgradePlayerStat(player, stat);

  if (updatedPlayer !== player) {
    player = updatedPlayer;
    turnResources = getInitialTurnResources(player);
    renderCurrentState();
  }
}

function handleRollEnergyDice(): void {
  if (currentPhase !== 'energy') {
    return;
  }

  if (turnResources.energyDice.length > 0 || isEnergyAssignmentComplete(turnResources)) {
    return;
  }

  turnResources = setRolledDice(player, rollEnergyDice());
  renderCurrentState();
}

function handleSelectEnergyDie(dieIndex: number): void {
  if (currentPhase !== 'energy') {
    return;
  }

  turnResources = selectEnergyDie(turnResources, dieIndex);
  renderCurrentState();
}

function handleAssignEnergyDie(stat: EnergyStatKey): void {
  if (currentPhase !== 'energy') {
    return;
  }

  turnResources = assignSelectedDieToStat(player, turnResources, stat);

  if (isEnergyAssignmentComplete(turnResources)) {
    currentPhase = getNextPhase(currentPhase);
  }

  renderCurrentState();
}

function handleMovePlayer(targetX: number, targetY: number): void {
  if (currentPhase !== 'adventurer') {
    return;
  }

  if (!canMoveTo(currentMap, player, currentEnemies, targetX, targetY, turnResources)) {
    return;
  }

  const result = movePlayer(
    currentMap,
    player,
    currentEnemies,
    turnResources,
    targetX,
    targetY
  );

  player = result.player;
  turnResources = result.turn;
  renderCurrentState();
}

function handleAttackEnemy(enemyX: number, enemyY: number): void {
  if (currentPhase !== 'adventurer') {
    return;
  }

  const enemyIndex = currentEnemies.findIndex(
    enemy => enemy.x === enemyX && enemy.y === enemyY
  );

  if (enemyIndex < 0) {
    return;
  }

  const enemy = currentEnemies[enemyIndex];
  if (!canAttackEnemy(currentMap, player, enemy, currentEnemies, turnResources)) {
    return;
  }

  const result = attackEnemy(currentEnemies, enemyIndex, turnResources);
  currentEnemies = result.enemies;
  turnResources = result.turn;
  renderCurrentState();
}

function advancePhase(): void {
  if (currentPhase === 'game-over' || currentPhase === 'level-complete') {
    return;
  }

  if (currentEnemies.length === 0) {
    enterLevelCompletePhase();
    renderCurrentState();
    return;
  }

  if (currentPhase === 'energy') {
    if (!isEnergyAssignmentComplete(turnResources)) {
      return;
    }

    currentPhase = getNextPhase(currentPhase);
    renderCurrentState();
    return;
  }

  if (currentPhase === 'adventurer') {
    currentPhase = getNextPhase(currentPhase);
    currentEnemies = resolveMonsterMovementPhase(currentMap, player, currentEnemies);
    currentPhase = getNextPhase(currentPhase);
    renderCurrentState();
    return;
  }

  if (currentPhase === 'monster-attack') {
    const result = resolveMonsterAttackPhase(currentMap, player, currentEnemies, turnResources);
    player = result.player;

    if (player.vidaActual <= 0) {
      currentPhase = 'game-over';
      renderCurrentState();
      return;
    }

    currentPhase = getNextPhase(currentPhase);
    if (currentPhase === 'energy') {
      turnResources = getInitialTurnResources(player);
    }

    renderCurrentState();
    return;
  }

  currentPhase = getNextPhase(currentPhase);

  if (currentPhase === 'energy') {
    turnResources = getInitialTurnResources(player);
  }

  renderCurrentState();
}

if (nextLevelBtn instanceof HTMLButtonElement) {
  nextLevelBtn.addEventListener('click', () => {
    if (canAdvanceToNextLevel()) {
      loadLevel(nivelActual + 1);
    }
  });
}

if (nextPhaseBtn instanceof HTMLButtonElement) {
  nextPhaseBtn.addEventListener('click', () => {
    advancePhase();
  });
}

initTutorial();
loadLevel(1);