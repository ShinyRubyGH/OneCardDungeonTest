import { getEnemiesForLevel, resolveMonsterAttackPhase, resolveMonsterMovementPhase, spawnEnemiesOnTiles } from './enemy.js';
import { buildMapForLevel, getSpawnTilesForLevel, getStartTiles } from './map.js';
import { createPlayer, grantLevelCompletionUpgrade, movePlayerToMapStart, upgradePlayerStat, attackEnemy, movePlayer, canMoveTo, canAttackEnemy } from './player.js';
import { assignSelectedDieToStat, getInitialTurnResources, getNextPhase, isEnergyAssignmentComplete, rollEnergyDice, selectEnergyDie, setRolledDice } from './phase.js';
import { renderMap } from './render.js';
import { PLAYER_CLASS_OPTIONS, getPlayerClassOption } from './constants.js';
const board = document.getElementById('game-board');
const nextLevelBtn = document.getElementById('next-level');
const nextPhaseBtn = document.getElementById('next-phase');
const levelIndicator = document.getElementById('level-indicator');
const characterModal = document.getElementById('character-modal');
const characterOptions = document.getElementById('character-options');
if (!(board instanceof HTMLElement)) {
    throw new Error('No se encontró el contenedor #game-board');
}
const boardElement = board;
let nivelActual = 1;
let currentMap = buildMapForLevel(nivelActual);
let currentEnemies = [];
let selectedClass = null;
let player = createPlayer(currentMap, 'paladin');
let currentPhase = 'energy';
let turnResources = getInitialTurnResources(player);
let classAbilityState = {
    paladinUsedInLevel: false,
    archerUsedInLevel: false,
    mageUsedInLevel: false,
    barbarianUsedInTurn: false,
    lastTurnAssignedDice: []
};
const TUTORIAL_STEPS = [
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
function initTutorial() {
    const openBtn = document.getElementById('tutorial-open');
    const modal = document.getElementById('tutorial-modal');
    const textEl = document.getElementById('tutorial-text');
    const visualEl = document.getElementById('tutorial-visual');
    const stepEl = document.getElementById('tutorial-step');
    const skipBtn = document.getElementById('tutorial-skip');
    const nextBtn = document.getElementById('tutorial-next');
    if (!(openBtn instanceof HTMLButtonElement) ||
        !(modal instanceof HTMLElement) ||
        !(textEl instanceof HTMLElement) ||
        !(visualEl instanceof HTMLElement) ||
        !(stepEl instanceof HTMLElement) ||
        !(skipBtn instanceof HTMLButtonElement) ||
        !(nextBtn instanceof HTMLButtonElement)) {
        return;
    }
    const renderTutorialStep = () => {
        const step = TUTORIAL_STEPS[tutorialIndex];
        textEl.textContent = step.text;
        visualEl.innerHTML = step.visual;
        stepEl.textContent = `Paso ${tutorialIndex + 1} / ${TUTORIAL_STEPS.length}`;
        skipBtn.disabled = tutorialIndex === 0;
        nextBtn.textContent = tutorialIndex === TUTORIAL_STEPS.length - 1 ? 'Listo' : 'Siguiente';
    };
    const openTutorial = () => {
        tutorialIndex = 0;
        renderTutorialStep();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    };
    const closeTutorial = () => {
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
function resetLevelAbilities() {
    classAbilityState = {
        ...classAbilityState,
        paladinUsedInLevel: false,
        archerUsedInLevel: false,
        mageUsedInLevel: false,
        barbarianUsedInTurn: false,
        lastTurnAssignedDice: []
    };
}
function resetTurnAbilities() {
    classAbilityState = {
        ...classAbilityState,
        barbarianUsedInTurn: false
    };
}
function isAnyEnergyAssigned(turn) {
    return (turn.assignedEnergy.velocidad !== null ||
        turn.assignedEnergy.alcance !== null ||
        turn.assignedEnergy.ataque !== null ||
        turn.assignedEnergy.defensa !== null);
}
function getAssignedDiceSnapshot(turn) {
    return [
        turn.assignedEnergy.velocidad,
        turn.assignedEnergy.alcance,
        turn.assignedEnergy.ataque,
        turn.assignedEnergy.defensa
    ].filter((die) => die !== null);
}
function canUsePaladinAbility() {
    return (player.clase === 'paladin' &&
        currentPhase === 'energy' &&
        !classAbilityState.paladinUsedInLevel &&
        classAbilityState.lastTurnAssignedDice.length > 0 &&
        turnResources.energyDice.length === 0 &&
        !isAnyEnergyAssigned(turnResources));
}
function canUseBarbarianAbility() {
    return (player.clase === 'barbaro' &&
        currentPhase === 'energy' &&
        player.vidaActual === 1 &&
        !classAbilityState.barbarianUsedInTurn &&
        turnResources.energyDice.length > 0 &&
        !isAnyEnergyAssigned(turnResources));
}
function canUseMageAbility() {
    return (player.clase === 'maga' &&
        currentPhase === 'energy' &&
        !classAbilityState.mageUsedInLevel &&
        turnResources.energyDice.length > 0 &&
        !isAnyEnergyAssigned(turnResources));
}
function getClassAbilityAction() {
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
function initCharacterSelection() {
    if (!(characterModal instanceof HTMLElement) || !(characterOptions instanceof HTMLElement)) {
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
      <span class="character-option-title">${option.titulo}</span>
      <span class="character-option-desc">${option.descripcion}</span>
    `;
        button.addEventListener('click', () => {
            selectedClass = option.id;
            player = createPlayer(currentMap, selectedClass);
            characterModal.classList.remove('open');
            characterModal.setAttribute('aria-hidden', 'true');
            loadLevel(1);
        });
        characterOptions.appendChild(button);
    }
    characterModal.classList.add('open');
    characterModal.setAttribute('aria-hidden', 'false');
}
function canAdvanceToNextLevel() {
    return (nivelActual < 12 &&
        currentPhase === 'level-complete' &&
        currentEnemies.length === 0 &&
        player.mejorasDisponibles === 0);
}
function updateNextLevelButtonState() {
    if (!(nextLevelBtn instanceof HTMLButtonElement)) {
        return;
    }
    nextLevelBtn.textContent = nivelActual >= 12 ? 'Nivel maximo' : 'Pasar nivel';
    nextLevelBtn.disabled = !canAdvanceToNextLevel();
}
function enterLevelCompletePhase() {
    if (currentPhase === 'level-complete') {
        return;
    }
    player = grantLevelCompletionUpgrade(player);
    currentPhase = 'level-complete';
    turnResources = getInitialTurnResources(player);
}
function updateNextPhaseButtonState() {
    if (!(nextPhaseBtn instanceof HTMLButtonElement)) {
        return;
    }
    nextPhaseBtn.style.display = currentPhase === 'energy' ? 'none' : '';
    let label = 'Finalizar turno';
    let disabled = false;
    if (currentPhase === 'energy') {
        label = 'Confirmar energia';
        disabled = true;
    }
    else if (currentPhase === 'adventurer') {
        label = 'Finalizar turno';
    }
    else if (currentPhase === 'monster-move') {
        label = 'Resolviendo movimiento...';
        disabled = true;
    }
    else if (currentPhase === 'monster-attack') {
        label = 'Resolver ataque enemigo';
    }
    else if (currentPhase === 'game-over') {
        label = 'Juego terminado';
        disabled = true;
    }
    else {
        disabled = true;
    }
    nextPhaseBtn.textContent = label;
    nextPhaseBtn.disabled = disabled;
}
function renderCurrentState() {
    if (levelIndicator instanceof HTMLElement) {
        const classLabel = getPlayerClassOption(player.clase).nombre;
        levelIndicator.textContent = `Nivel ${currentMap.level} | ${classLabel}`;
    }
    const showReachAssignment = player.clase === 'arquera' &&
        (!classAbilityState.archerUsedInLevel || turnResources.assignedEnergy.alcance !== null);
    renderMap(currentMap, boardElement, currentEnemies, player, handleUpgradeStat, currentPhase, turnResources, showReachAssignment, getClassAbilityAction(), handleRollEnergyDice, handleSelectEnergyDie, handleAssignEnergyDie, handleUseClassAbility, handleMovePlayer, handleAttackEnemy);
    updateNextPhaseButtonState();
    updateNextLevelButtonState();
}
function loadLevel(level) {
    nivelActual = level;
    currentMap = buildMapForLevel(nivelActual);
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
function handleUpgradeStat(stat) {
    const updatedPlayer = upgradePlayerStat(player, stat);
    if (updatedPlayer !== player) {
        player = updatedPlayer;
        turnResources = getInitialTurnResources(player);
        renderCurrentState();
    }
}
function handleRollEnergyDice() {
    if (currentPhase !== 'energy') {
        return;
    }
    if (turnResources.energyDice.length > 0 || isEnergyAssignmentComplete(turnResources)) {
        return;
    }
    turnResources = setRolledDice(player, rollEnergyDice());
    renderCurrentState();
}
function handleUseClassAbility() {
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
function handleSelectEnergyDie(dieIndex) {
    if (currentPhase !== 'energy') {
        return;
    }
    turnResources = selectEnergyDie(turnResources, dieIndex);
    renderCurrentState();
}
function handleAssignEnergyDie(stat) {
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
function handleMovePlayer(targetX, targetY) {
    if (currentPhase !== 'adventurer') {
        return;
    }
    if (!canMoveTo(currentMap, player, currentEnemies, targetX, targetY, turnResources)) {
        return;
    }
    const result = movePlayer(currentMap, player, currentEnemies, turnResources, targetX, targetY);
    player = result.player;
    turnResources = result.turn;
    renderCurrentState();
}
function handleAttackEnemy(enemyX, enemyY) {
    if (currentPhase !== 'adventurer') {
        return;
    }
    const enemyIndex = currentEnemies.findIndex(enemy => enemy.x === enemyX && enemy.y === enemyY);
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
function advancePhase() {
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
initTutorial();
initCharacterSelection();
