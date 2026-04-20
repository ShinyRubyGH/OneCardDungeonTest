import { getEnemiesForLevel, resolveMonsterAttackPhase, resolveMonsterMovementPhase, spawnEnemiesOnTiles } from './enemy.js';
import { buildMapForLevel, getSpawnTilesForLevel, getStartTiles } from './map.js';
import { createPlayer, grantLevelCompletionUpgrade, movePlayerToMapStart, upgradePlayerStat, attackEnemy, movePlayer, canMoveTo, canAttackEnemy } from './player.js';
import { assignSelectedDieToStat, getInitialTurnResources, getNextPhase, isEnergyAssignmentComplete, rollEnergyDice, selectEnergyDie, setRolledDice } from './phase.js';
import { renderMap } from './render.js';
const board = document.getElementById('game-board');
const nextLevelBtn = document.getElementById('next-level');
const nextPhaseBtn = document.getElementById('next-phase');
const levelIndicator = document.getElementById('level-indicator');
if (!(board instanceof HTMLElement)) {
    throw new Error('No se encontró el contenedor #game-board');
}
const boardElement = board;
let nivelActual = 1;
let currentMap = buildMapForLevel(nivelActual);
let currentEnemies = [];
let player = createPlayer(currentMap);
let currentPhase = 'energy';
let turnResources = getInitialTurnResources(player);
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
        levelIndicator.textContent = `Nivel ${currentMap.level}`;
    }
    renderMap(currentMap, boardElement, currentEnemies, player, handleUpgradeStat, currentPhase, turnResources, handleRollEnergyDice, handleSelectEnergyDie, handleAssignEnergyDie, handleMovePlayer, handleAttackEnemy);
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
    turnResources = assignSelectedDieToStat(player, turnResources, stat);
    if (isEnergyAssignmentComplete(turnResources)) {
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
loadLevel(1);
