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
import { PLAYER_CLASS_OPTIONS, getPlayerClassOption } from './constants.js';
import type {
  DungeonMap,
  EnergyStatKey,
  Player,
  PlayerClassId,
  PlayerStatKey,
  SpawnedEnemy,
  TurnPhase,
  TurnResources
} from './types.js';

const board = document.getElementById('game-board');
const nextLevelBtn = document.getElementById('next-level');
const nextPhaseBtn = document.getElementById('next-phase');
const levelIndicator = document.getElementById('level-indicator');
const characterModal = document.getElementById('character-modal');
const characterOptions = document.getElementById('character-options');
const titleScreen = document.getElementById('title-screen');
const titleStartBtn = document.getElementById('title-start');
const titleLoadBtn = document.getElementById('title-load');
const titleOptionsBtn = document.getElementById('title-options');
const titleTutorialBtn = document.getElementById('title-tutorial');
const titleOptionsPanel = document.getElementById('title-options-panel');
const titleVolumeInput = document.getElementById('title-volume');
const titleMutedInput = document.getElementById('title-muted');
const gameOptionsContainer = document.getElementById('in-game-options');
const gameOptionsOpenBtn = document.getElementById('game-options-open');
const gameOptionsPanel = document.getElementById('game-options-panel');
const gameVolumeInput = document.getElementById('game-volume');
const gameMutedInput = document.getElementById('game-muted');
const saveGameBtn = document.getElementById('save-game');

if (!(board instanceof HTMLElement)) {
  throw new Error('No se encontró el contenedor #game-board');
}

const boardElement: HTMLElement = board;

let nivelActual: number = 1;
let currentMap: DungeonMap = buildMapForLevel(nivelActual);
let currentEnemies: SpawnedEnemy[] = [];
let selectedClass: PlayerClassId | null = null;
let player: Player = createPlayer(currentMap, 'paladin');
let currentPhase: TurnPhase = 'energy';
let turnResources: TurnResources = getInitialTurnResources(player);

type ClassAbilityState = {
  paladinUsedInLevel: boolean;
  archerUsedInLevel: boolean;
  mageUsedInLevel: boolean;
  barbarianUsedInTurn: boolean;
  lastTurnAssignedDice: number[];
};

let classAbilityState: ClassAbilityState = {
  paladinUsedInLevel: false,
  archerUsedInLevel: false,
  mageUsedInLevel: false,
  barbarianUsedInTurn: false,
  lastTurnAssignedDice: []
};

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
    text: 'Sistema de defensa: suma todos los daños de los enemigos y divide por tu defensa. El resultado es tu reducción de vida. Ej: (10+8)÷2 = 9 daño.',
    visual: '<div class="tutorial-shape-row"><span class="tutorial-shape">A</span><span class="tutorial-shape">+</span><span class="tutorial-shape">B</span><span class="tutorial-shape">÷</span><span class="tutorial-shape">D</span></div>'
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
let gameStarted = false;

const TITLE_THEME_VOLUME_STORAGE_KEY = 'title-theme-volume';
const DEFAULT_TITLE_THEME_VOLUME = 0.55;
const TITLE_THEME_PATH = './src/Music/xDeviruchi - Title Theme .wav';
const CHARACTER_SELECTION_THEME_PATH = './src/Music/xDeviruchi - And The Journey Begins .wav';
const LEVEL_COMPLETE_THEME_PATH = './src/Music/xDeviruchi - Take some rest and eat some food!.wav';
const GAME_OVER_THEME_PATH = './src/Music/xDeviruchi - The Final of The Fantasy.wav';
const LEVEL_THEME_PATHS: string[] = [
  './src/Music/xDeviruchi - Exploring The Unknown.wav',
  './src/Music/xDeviruchi - Mysterious Dungeon.wav',
  './src/Music/xDeviruchi - Prepare for Battle! .wav',
  './src/Music/xDeviruchi - Decisive Battle.wav',
  './src/Music/xDeviruchi - Minigame .wav',
  './src/Music/xDeviruchi - The Icy Cave .wav'
];
const PLAYER_ATTACK_SFX_PATHS: Record<PlayerClassId, string> = {
  paladin: './src/assets/Sonidos/Paladin_Barbaro.wav',
  barbaro: './src/assets/Sonidos/Paladin_Barbaro.wav',
  arquera: './src/assets/Sonidos/Arquero.wav',
  maga: './src/assets/Sonidos/Mago.wav'
};
const ENEMY_ATTACK_SFX_PATH = './src/assets/Sonidos/Enemigos.wav';
const GAME_SAVE_STORAGE_KEY = 'one-card-dungeon-save-v1';
const ALL_BGM_PATHS: string[] = [
  TITLE_THEME_PATH,
  CHARACTER_SELECTION_THEME_PATH,
  LEVEL_COMPLETE_THEME_PATH,
  GAME_OVER_THEME_PATH,
  ...LEVEL_THEME_PATHS
];

type SavedGameState = {
  version: 1;
  nivelActual: number;
  selectedClass: PlayerClassId;
  player: Player;
  currentEnemies: SpawnedEnemy[];
  currentPhase: TurnPhase;
  turnResources: TurnResources;
  classAbilityState: ClassAbilityState;
  unusedLevelThemePaths: string[];
  currentBgmPath: string;
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_TITLE_THEME_VOLUME;
  }

  return Math.max(0, Math.min(1, value));
}

function loadSavedTitleThemeVolume(): number {
  try {
    const savedValue = window.localStorage.getItem(TITLE_THEME_VOLUME_STORAGE_KEY);
    if (savedValue === null) {
      return DEFAULT_TITLE_THEME_VOLUME;
    }

    return clampVolume(Number(savedValue));
  } catch {
    return DEFAULT_TITLE_THEME_VOLUME;
  }
}

function saveTitleThemeVolume(volume: number): void {
  try {
    window.localStorage.setItem(TITLE_THEME_VOLUME_STORAGE_KEY, String(clampVolume(volume)));
  } catch {
    // Ignorado: localStorage puede estar bloqueado por el navegador.
  }
}

const bgmAudio = new Audio(TITLE_THEME_PATH);
bgmAudio.loop = true;
bgmAudio.volume = loadSavedTitleThemeVolume();

let currentBgmPath = TITLE_THEME_PATH;
let unusedLevelThemePaths: string[] = [...LEVEL_THEME_PATHS];

function playBgm(trackPath: string): void {
  if (currentBgmPath !== trackPath) {
    currentBgmPath = trackPath;
    bgmAudio.src = trackPath;
    bgmAudio.currentTime = 0;
  }

  void bgmAudio.play().catch(() => {
    // Ignorado: algunos navegadores bloquean autoplay hasta la primera interaccion.
  });
}

function playPlayerAttackSfx(playerClass: PlayerClassId): void {
  const sfxPath = PLAYER_ATTACK_SFX_PATHS[playerClass];
  if (!sfxPath) {
    return;
  }

  const attackSfx = new Audio(sfxPath);
  attackSfx.volume = clampVolume(bgmAudio.volume);
  attackSfx.muted = bgmAudio.muted;

  void attackSfx.play().catch(() => {
    // Ignorado: algunos navegadores bloquean audio hasta primera interaccion.
  });
}

function playEnemyAttackSfx(): void {
  const attackSfx = new Audio(ENEMY_ATTACK_SFX_PATH);
  attackSfx.volume = clampVolume(bgmAudio.volume);
  attackSfx.muted = bgmAudio.muted;

  void attackSfx.play().catch(() => {
    // Ignorado: algunos navegadores bloquean audio hasta primera interaccion.
  });
}

function pickRandomLevelThemePath(): string {
  if (unusedLevelThemePaths.length === 0) {
    unusedLevelThemePaths = [...LEVEL_THEME_PATHS];
  }

  const randomIndex = Math.floor(Math.random() * unusedLevelThemePaths.length);
  const selected = unusedLevelThemePaths[randomIndex];
  unusedLevelThemePaths.splice(randomIndex, 1);
  return selected;
}

function syncMusicControlValues(): void {
  const volumeValue = String(bgmAudio.volume);

  if (titleVolumeInput instanceof HTMLInputElement) {
    titleVolumeInput.value = volumeValue;
  }

  if (gameVolumeInput instanceof HTMLInputElement) {
    gameVolumeInput.value = volumeValue;
  }

  if (titleMutedInput instanceof HTMLInputElement) {
    titleMutedInput.checked = bgmAudio.muted;
  }

  if (gameMutedInput instanceof HTMLInputElement) {
    gameMutedInput.checked = bgmAudio.muted;
  }
}

function setBgmVolume(volume: number): void {
  const nextVolume = clampVolume(volume);
  bgmAudio.volume = nextVolume;
  saveTitleThemeVolume(nextVolume);

  if (nextVolume > 0) {
    bgmAudio.muted = false;
  }

  syncMusicControlValues();
}

function setBgmMuted(muted: boolean): void {
  bgmAudio.muted = muted;
  syncMusicControlValues();
}

function initInGameOptions(): void {
  if (
    !(gameOptionsContainer instanceof HTMLElement) ||
    !(gameOptionsOpenBtn instanceof HTMLButtonElement) ||
    !(gameOptionsPanel instanceof HTMLElement)
  ) {
    return;
  }

  const setPanelOpen = (open: boolean): void => {
    gameOptionsPanel.classList.toggle('open', open);
    gameOptionsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  setPanelOpen(false);
  syncMusicControlValues();

  gameOptionsOpenBtn.addEventListener('click', () => {
    const isOpen = gameOptionsPanel.classList.contains('open');
    setPanelOpen(!isOpen);
  });

  if (gameVolumeInput instanceof HTMLInputElement) {
    gameVolumeInput.addEventListener('input', () => {
      setBgmVolume(Number(gameVolumeInput.value));
    });
  }

  if (gameMutedInput instanceof HTMLInputElement) {
    gameMutedInput.addEventListener('change', () => {
      setBgmMuted(gameMutedInput.checked);
    });
  }

  document.addEventListener('click', event => {
    if (!gameOptionsPanel.classList.contains('open')) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (!gameOptionsContainer.contains(target)) {
      setPanelOpen(false);
    }
  });
}

function showTransientButtonText(button: HTMLButtonElement, text: string): void {
  const baseText = button.textContent ?? '';
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = baseText;
  }, 1200);
}

function hasSavedGame(): boolean {
  try {
    return window.localStorage.getItem(GAME_SAVE_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function updateTitleLoadButtonState(): void {
  if (titleLoadBtn instanceof HTMLButtonElement) {
    titleLoadBtn.disabled = !hasSavedGame();
  }
}

function updateSaveButtonState(): void {
  if (saveGameBtn instanceof HTMLButtonElement) {
    saveGameBtn.disabled = !gameStarted;
  }
}

function saveCurrentGame(): boolean {
  if (!gameStarted || selectedClass === null) {
    return false;
  }

  const saveData: SavedGameState = {
    version: 1,
    nivelActual,
    selectedClass,
    player,
    currentEnemies,
    currentPhase,
    turnResources,
    classAbilityState,
    unusedLevelThemePaths,
    currentBgmPath
  };

  try {
    window.localStorage.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(saveData));
    return true;
  } catch {
    return false;
  }
}

function loadSavedGameState(): SavedGameState | null {
  try {
    const rawSave = window.localStorage.getItem(GAME_SAVE_STORAGE_KEY);
    if (!rawSave) {
      return null;
    }

    const parsed = JSON.parse(rawSave) as Partial<SavedGameState>;
    if (
      parsed.version !== 1 ||
      typeof parsed.nivelActual !== 'number' ||
      typeof parsed.selectedClass !== 'string' ||
      !parsed.player ||
      !parsed.currentEnemies ||
      typeof parsed.currentPhase !== 'string' ||
      !parsed.turnResources ||
      !parsed.classAbilityState
    ) {
      return null;
    }

    return {
      version: 1,
      nivelActual: parsed.nivelActual,
      selectedClass: parsed.selectedClass as PlayerClassId,
      player: parsed.player,
      currentEnemies: parsed.currentEnemies,
      currentPhase: parsed.currentPhase as TurnPhase,
      turnResources: parsed.turnResources,
      classAbilityState: parsed.classAbilityState,
      unusedLevelThemePaths: Array.isArray(parsed.unusedLevelThemePaths)
        ? parsed.unusedLevelThemePaths.filter(path => LEVEL_THEME_PATHS.includes(path))
        : [],
      currentBgmPath:
        typeof parsed.currentBgmPath === 'string' && ALL_BGM_PATHS.includes(parsed.currentBgmPath)
          ? parsed.currentBgmPath
          : LEVEL_THEME_PATHS[0]
    };
  } catch {
    return null;
  }
}

function applySavedGameState(saveData: SavedGameState): void {
  nivelActual = saveData.nivelActual;
  currentMap = buildMapForLevel(nivelActual);
  selectedClass = saveData.selectedClass;
  player = saveData.player;
  currentEnemies = saveData.currentEnemies;
  currentPhase = saveData.currentPhase;
  turnResources = saveData.turnResources;
  classAbilityState = saveData.classAbilityState;
  unusedLevelThemePaths =
    saveData.unusedLevelThemePaths.length > 0
      ? [...saveData.unusedLevelThemePaths]
      : [...LEVEL_THEME_PATHS];

  if (characterModal instanceof HTMLElement) {
    characterModal.classList.remove('open');
    characterModal.setAttribute('aria-hidden', 'true');
  }
  document.body.classList.remove('is-character-select-open');

  renderCurrentState();
  playBgm(saveData.currentBgmPath);
}

function initTutorial(): void {
  const openBtn = document.getElementById('tutorial-open');
  const titleTutorialButton = document.getElementById('title-tutorial');
  const modal = document.getElementById('tutorial-modal');
  const textEl = document.getElementById('tutorial-text');
  const visualEl = document.getElementById('tutorial-visual');
  const stepEl = document.getElementById('tutorial-step');
  const skipBtn = document.getElementById('tutorial-skip');
  const nextBtn = document.getElementById('tutorial-next');
  const openButtons: HTMLButtonElement[] = [openBtn, titleTutorialButton].filter(
    (button): button is HTMLButtonElement => button instanceof HTMLButtonElement
  );

  if (
    openButtons.length === 0 ||
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

  openButtons.forEach(button => {
    button.addEventListener('click', () => {
      openTutorial();
    });
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

function resetLevelAbilities(): void {
  classAbilityState = {
    ...classAbilityState,
    paladinUsedInLevel: false,
    archerUsedInLevel: false,
    mageUsedInLevel: false,
    barbarianUsedInTurn: false,
    lastTurnAssignedDice: []
  };
}

function resetTurnAbilities(): void {
  classAbilityState = {
    ...classAbilityState,
    barbarianUsedInTurn: false
  };
}

function isAnyEnergyAssigned(turn: TurnResources): boolean {
  return (
    turn.assignedEnergy.velocidad !== null ||
    turn.assignedEnergy.alcance !== null ||
    turn.assignedEnergy.ataque !== null ||
    turn.assignedEnergy.defensa !== null
  );
}

function getAssignedDiceSnapshot(turn: TurnResources): number[] {
  return [
    turn.assignedEnergy.velocidad,
    turn.assignedEnergy.alcance,
    turn.assignedEnergy.ataque,
    turn.assignedEnergy.defensa
  ].filter((die): die is number => die !== null);
}

function canUsePaladinAbility(): boolean {
  return (
    player.clase === 'paladin' &&
    currentPhase === 'energy' &&
    !classAbilityState.paladinUsedInLevel &&
    classAbilityState.lastTurnAssignedDice.length > 0 &&
    turnResources.energyDice.length === 0 &&
    !isAnyEnergyAssigned(turnResources)
  );
}

function canUseBarbarianAbility(): boolean {
  return (
    player.clase === 'barbaro' &&
    currentPhase === 'energy' &&
    player.vidaActual === 1 &&
    !classAbilityState.barbarianUsedInTurn &&
    turnResources.energyDice.length > 0 &&
    !isAnyEnergyAssigned(turnResources)
  );
}

function canUseMageAbility(): boolean {
  return (
    player.clase === 'maga' &&
    currentPhase === 'energy' &&
    !classAbilityState.mageUsedInLevel &&
    turnResources.energyDice.length > 0 &&
    !isAnyEnergyAssigned(turnResources)
  );
}

function getClassAbilityAction(): { label: string; description: string } | undefined {
  if (canUsePaladinAbility()) {
    return {
      label: 'Consagracion: conservar dado',
      description: 'Paladin: conserva automaticamente el dado mas alto del turno anterior.'
    };
  }

  if (canUseBarbarianAbility()) {
    return {
      label: 'Furia: volver a tirar',
      description: 'Barbaro: con 1 de vida, puedes relanzar los dados una vez en este turno.'
    };
  }

  if (canUseMageAbility()) {
    return {
      label: 'Hechizo: volver a tirar',
      description: 'Maga: vuelve a tirar todos los dados de energia (una vez por nivel).'
    };
  }

  return undefined;
}

function getCharacterArtworkPath(classId: PlayerClassId): string {
  switch (classId) {
    case 'paladin':
      return './src/assets/paladin.svg';
    case 'barbaro':
      return './src/assets/barbarian.svg';
    case 'arquera':
      return './src/assets/ranger.svg';
    case 'maga':
      return './src/assets/mage.svg';
    default:
      return './src/assets/paladin.svg';
  }
}

function initCharacterSelection(): void {
  if (gameStarted) {
    return;
  }

  gameStarted = true;
  playBgm(CHARACTER_SELECTION_THEME_PATH);

  if (!(characterModal instanceof HTMLElement) || !(characterOptions instanceof HTMLElement)) {
    document.body.classList.remove('is-character-select-open');
    selectedClass = 'paladin';
    player = createPlayer(currentMap, selectedClass);
    loadLevel(1);
    return;
  }

  characterOptions.innerHTML = '';

  for (const option of PLAYER_CLASS_OPTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-option-btn';
    button.innerHTML = `
      <div class="character-option-media">
        <img class="character-option-art" src="${getCharacterArtworkPath(option.id)}" alt="${option.titulo}" />
      </div>
      <div class="character-option-info">
        <span class="character-option-title">${option.titulo}</span>
        <span class="character-option-desc">${option.descripcion}</span>
      </div>
    `;

    button.addEventListener('click', () => {
      selectedClass = option.id;
      player = createPlayer(currentMap, selectedClass);
      characterModal.classList.remove('open');
      characterModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-character-select-open');
      loadLevel(1);
    });

    characterOptions.appendChild(button);
  }

  characterModal.classList.add('open');
  characterModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-character-select-open');
}

function initTitleScreen(): void {
  playBgm(TITLE_THEME_PATH);

  document.addEventListener(
    'pointerdown',
    () => {
      playBgm(currentBgmPath);
    },
    { once: true }
  );

  if (
    !(titleScreen instanceof HTMLElement) ||
    !(titleStartBtn instanceof HTMLButtonElement) ||
    !(titleOptionsBtn instanceof HTMLButtonElement)
  ) {
    document.body.classList.remove('is-on-title');
    initCharacterSelection();
    return;
  }

  const setOptionsOpen = (open: boolean): void => {
    if (!(titleOptionsPanel instanceof HTMLElement)) {
      return;
    }

    titleOptionsPanel.classList.toggle('open', open);
    titleOptionsPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  };

  setOptionsOpen(false);
  updateTitleLoadButtonState();
  syncMusicControlValues();

  if (titleVolumeInput instanceof HTMLInputElement) {
    titleVolumeInput.addEventListener('input', () => {
      setBgmVolume(Number(titleVolumeInput.value));
    });
  }

  if (titleMutedInput instanceof HTMLInputElement) {
    titleMutedInput.addEventListener('change', () => {
      setBgmMuted(titleMutedInput.checked);
    });
  }

  titleOptionsBtn.addEventListener('click', () => {
    const isOpen = titleOptionsPanel instanceof HTMLElement && titleOptionsPanel.classList.contains('open');
    setOptionsOpen(!isOpen);
    playBgm(currentBgmPath);
  });

  if (titleTutorialBtn instanceof HTMLButtonElement) {
    titleTutorialBtn.addEventListener('click', () => {
      playBgm(currentBgmPath);
    });
  }

  if (titleLoadBtn instanceof HTMLButtonElement) {
    titleLoadBtn.addEventListener('click', () => {
      const saveData = loadSavedGameState();
      if (!saveData) {
        updateTitleLoadButtonState();
        showTransientButtonText(titleLoadBtn, 'Sin guardado');
        return;
      }

      gameStarted = true;
      titleScreen.classList.add('hidden');
      document.body.classList.remove('is-on-title');
      applySavedGameState(saveData);
    });
  }

  titleStartBtn.addEventListener('click', () => {
    titleScreen.classList.add('hidden');
    document.body.classList.remove('is-on-title');
    initCharacterSelection();
    playBgm(currentBgmPath);
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
  playBgm(LEVEL_COMPLETE_THEME_PATH);
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
    const classLabel = getPlayerClassOption(player.clase).nombre;
    levelIndicator.textContent = `Nivel ${currentMap.level} | ${classLabel}`;
  }

  const showReachAssignment =
    player.clase === 'arquera' &&
    (!classAbilityState.archerUsedInLevel || turnResources.assignedEnergy.alcance !== null);

  renderMap(
    currentMap,
    boardElement,
    currentEnemies,
    player,
    handleUpgradeStat,
    currentPhase,
    turnResources,
    showReachAssignment,
    getClassAbilityAction(),
    handleRollEnergyDice,
    handleSelectEnergyDie,
    handleAssignEnergyDie,
    handleUseClassAbility,
    handleMovePlayer,
    handleAttackEnemy
  );

  updateNextPhaseButtonState();
  updateNextLevelButtonState();
  updateSaveButtonState();
}

function loadLevel(level: number): void {
  nivelActual = level;
  currentMap = buildMapForLevel(nivelActual);
  playBgm(pickRandomLevelThemePath());

  const spawnTiles = getSpawnTilesForLevel(currentMap, nivelActual);
  currentEnemies = spawnEnemiesOnTiles(nivelActual, spawnTiles);

  player = movePlayerToMapStart(player, currentMap);
  currentPhase = 'energy';
  turnResources = getInitialTurnResources(player);
  resetTurnAbilities();
  resetLevelAbilities();

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

function handleUseClassAbility(): void {
  if (currentPhase !== 'energy') {
    return;
  }

  if (canUsePaladinAbility()) {
    const conserved = Math.max(...classAbilityState.lastTurnAssignedDice);
    const rerolled = rollEnergyDice();
    turnResources = setRolledDice(player, [conserved, rerolled[1], rerolled[2]]);
    classAbilityState = {
      ...classAbilityState,
      paladinUsedInLevel: true
    };
    renderCurrentState();
    return;
  }

  if (canUseBarbarianAbility()) {
    turnResources = setRolledDice(player, rollEnergyDice());
    classAbilityState = {
      ...classAbilityState,
      barbarianUsedInTurn: true
    };
    renderCurrentState();
    return;
  }

  if (canUseMageAbility()) {
    turnResources = setRolledDice(player, rollEnergyDice());
    classAbilityState = {
      ...classAbilityState,
      mageUsedInLevel: true
    };
    renderCurrentState();
  }
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

  if (stat === 'alcance') {
    if (player.clase !== 'arquera') {
      return;
    }

    if (classAbilityState.archerUsedInLevel && turnResources.assignedEnergy.alcance === null) {
      return;
    }
  }

  turnResources = assignSelectedDieToStat(player, turnResources, stat);

  if (stat === 'alcance' && turnResources.assignedEnergy.alcance !== null) {
    classAbilityState = {
      ...classAbilityState,
      archerUsedInLevel: true
    };
  }

  if (isEnergyAssignmentComplete(turnResources)) {
    classAbilityState = {
      ...classAbilityState,
      lastTurnAssignedDice: getAssignedDiceSnapshot(turnResources)
    };
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
  playPlayerAttackSfx(player.clase);
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

    if (result.totalAttack > 0) {
      playEnemyAttackSfx();
    }

    if (player.vidaActual <= 0) {
      currentPhase = 'game-over';
      playBgm(GAME_OVER_THEME_PATH);
      renderCurrentState();
      return;
    }

    currentPhase = getNextPhase(currentPhase);
    if (currentPhase === 'energy') {
      turnResources = getInitialTurnResources(player);
      resetTurnAbilities();
    }

    renderCurrentState();
    return;
  }

  currentPhase = getNextPhase(currentPhase);

  if (currentPhase === 'energy') {
    turnResources = getInitialTurnResources(player);
    resetTurnAbilities();
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

if (saveGameBtn instanceof HTMLButtonElement) {
  saveGameBtn.addEventListener('click', () => {
    const saved = saveCurrentGame();
    showTransientButtonText(saveGameBtn, saved ? 'Guardado' : 'Error al guardar');
    if (saved) {
      updateTitleLoadButtonState();
    }
  });
}

initTutorial();
initInGameOptions();
initTitleScreen();