import { getPhaseDescription, getPhaseLabel } from './phase.js';
import { canAttackEnemy, canMoveTo, getMovementCost } from './player.js';
import { getEnemyByLevel } from './enemy.js';
import { getPlayerClassOption } from './constants.js';
function getStatIcon(stat) {
    switch (stat) {
        case 'vida':
            return '❤';
        case 'velocidad':
            return '🥾';
        case 'dano':
        case 'ataque':
            return '🗡';
        case 'defensa':
            return '🛡';
        case 'alcance':
            return '🎯';
        default:
            return '•';
    }
}
function createStatLabel(label, stat) {
    return `
    <span class="entity-stat-label">
      <span class="stat-icon" aria-hidden="true">${getStatIcon(stat)}</span>
      ${label}
    </span>
  `;
}
function findEnemyAtPosition(enemies, x, y) {
    return enemies.find(enemy => enemy.x === x && enemy.y === y);
}
function isPlayerAtPosition(player, x, y) {
    return !!player && player.x === x && player.y === y;
}
function getEnemyInitial(name) {
    return name.charAt(0).toUpperCase();
}
function getEnemyIdentityNumber(enemy, enemies) {
    let sameTypeCount = 0;
    for (const currentEnemy of enemies) {
        if (currentEnemy.nombre !== enemy.nombre) {
            continue;
        }
        sameTypeCount += 1;
        if (currentEnemy === enemy ||
            (currentEnemy.x === enemy.x &&
                currentEnemy.y === enemy.y &&
                currentEnemy.nivelOrigen === enemy.nivelOrigen)) {
            return sameTypeCount;
        }
    }
    return Math.max(1, sameTypeCount);
}
function getEnemyMarkerLabel(enemy, enemies) {
    return `${getEnemyInitial(enemy.nombre)}${getEnemyIdentityNumber(enemy, enemies)}`;
}
function getEnemyArtworkPath(enemy) {
    switch (enemy.id) {
        case 'spider':
            return './src/assets/enemies/spider.svg';
        case 'skeleton':
            return './src/assets/enemies/skeleton.svg';
        case 'ogre':
            return './src/assets/enemies/ogre.svg';
        case 'demon':
            return './src/assets/enemies/demon.svg';
        default:
            return './src/assets/enemies/generic.svg';
    }
}
function getPlayerArtworkPath() {
    return './src/assets/adventurer.svg';
}
function createTileElement(tile, player, enemy, enemyMarkerLabel) {
    const element = document.createElement('div');
    element.className = `tile ${tile.type}`;
    const hasPlayer = isPlayerAtPosition(player, tile.x, tile.y);
    if (tile.type === 'stairs') {
        element.classList.add(tile.y <= 2 ? 'stairs-top' : 'stairs_alreves');
    }
    if (enemy) {
        element.classList.add('tile-has-enemy');
    }
    if (hasPlayer) {
        element.classList.add('tile-has-player');
    }
    element.dataset.x = String(tile.x);
    element.dataset.y = String(tile.y);
    if (tile.code >= 1 && tile.code <= 12) {
        const value = document.createElement('span');
        value.className = 'tile-code';
        value.textContent = String(tile.code);
        element.appendChild(value);
    }
    if (enemy) {
        const enemyMarker = document.createElement('button');
        enemyMarker.className = 'enemy-marker board-token';
        enemyMarker.type = 'button';
        const label = enemyMarkerLabel ?? getEnemyInitial(enemy.nombre);
        enemyMarker.innerHTML = `<span class="token-text">${label}</span>`;
        enemyMarker.dataset.enemyX = String(enemy.x);
        enemyMarker.dataset.enemyY = String(enemy.y);
        enemyMarker.title = `${enemy.nombre} | Vida: ${enemy.vidaActual}/${enemy.stats.vida} | Velocidad: ${enemy.stats.velocidad} | Ataque: ${enemy.stats.ataque} | Defensa: ${enemy.stats.defensa} | Alcance: ${enemy.stats.alcance}`;
        element.appendChild(enemyMarker);
    }
    if (hasPlayer) {
        const playerMarker = document.createElement('div');
        playerMarker.className = 'player-marker board-token';
        playerMarker.innerHTML = '<span class="token-text">P</span>';
        playerMarker.title = `${player?.nombre} | Vida: ${player?.vidaActual}/${player?.stats.vida} | Velocidad: ${player?.stats.velocidad} | Daño: ${player?.stats.dano} | Defensa: ${player?.stats.defensa} | Alcance: ${player?.stats.alcance}`;
        element.appendChild(playerMarker);
    }
    return element;
}
function createStatRow(label, key, value, bonus = 0, remainingValue, canUpgrade = false) {
    const isLocked = key === 'alcance';
    const total = value + Math.max(0, bonus);
    const displayValue = typeof remainingValue === 'number'
        ? `${Math.max(0, remainingValue)} / ${total}`
        : `${total}`;
    const bonusMarkup = bonus > 0
        ? `<span class="entity-stat-bonus">+${bonus}</span>`
        : '';
    return `
    <div class="entity-stat">
      ${createStatLabel(label, key)}
      <div class="entity-stat-actions">
        <span class="entity-stat-value">${displayValue}</span>
        ${bonusMarkup}
        <button
          class="upgrade-btn ${isLocked ? 'locked' : ''}"
          data-stat="${key}"
          ${canUpgrade ? '' : 'disabled'}
          type="button"
        >
          ${isLocked ? 'Fijo' : '+1'}
        </button>
      </div>
    </div>
  `;
}
function createEnemyStatRow(label, stat, value) {
    return `
    <div class="entity-stat">
      ${createStatLabel(label, stat)}
      <span class="entity-stat-value">${value}</span>
    </div>
  `;
}
function createEnergyAssignmentBlock(_label, stat, assignedValue, canAssign) {
    const isAssigned = assignedValue !== null;
    const icon = getStatIcon(stat);
    const pipMap = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };
    const diePips = isAssigned
        ? (pipMap[assignedValue] ?? pipMap[1])
            .map(position => `<span class="assignment-die-pip assignment-die-pip-${position}"></span>`)
            .join('')
        : '';
    return `
    <div class="assignment-block">
      <div class="assignment-icon" aria-hidden="true">${icon}</div>
      <div class="assignment-die ${isAssigned ? 'assigned' : 'unassigned'}" aria-label="${isAssigned ? `Dado asignado: ${assignedValue}` : 'Sin dado asignado'}">
        ${isAssigned ? `<span class="assignment-die-pips" aria-hidden="true">${diePips}</span>` : '<span class="assignment-die-empty">-</span>'}
      </div>
      <button
        class="assign-btn"
        type="button"
        data-energy-stat="${stat}"
        ${isAssigned || !canAssign ? 'disabled' : ''}
      >
        Asignar
      </button>
    </div>
  `;
}
function createPlayerHealthBlock(player) {
    const healthPercent = Math.max(0, Math.min(100, (player.vidaActual / player.stats.vida) * 100));
    return `
    <section class="player-health-highlight" aria-label="Vida del aventurero">
      <div class="player-health-header">
        <span class="player-health-icon" aria-hidden="true">❤</span>
        <span class="player-health-label">Vida</span>
      </div>
      <div class="player-health-value">${player.vidaActual} / ${player.stats.vida}</div>
      <div class="player-health-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${player.stats.vida}" aria-valuenow="${player.vidaActual}">
        <span style="width: ${healthPercent}%;"></span>
      </div>
    </section>
  `;
}
function createPlayerReferenceBlock(player) {
    return `
    <section class="player-reference-artwork-shell" aria-label="Referencia del aventurero">
      <img
        class="player-reference-artwork"
        src="${getPlayerArtworkPath()}"
        alt="Referencia del aventurero"
      />
      <div class="player-reference-caption">
        ${player.nombre}
      </div>
    </section>
  `;
}
function createEnemyHealthBlock(enemy) {
    const healthPercent = Math.max(0, Math.min(100, (enemy.vidaActual / enemy.stats.vida) * 100));
    return `
    <section class="player-health-highlight enemy-health-highlight" aria-label="Vida del enemigo">
      <div class="player-health-header">
        <span class="player-health-icon" aria-hidden="true">❤</span>
        <span class="player-health-label">Vida restante</span>
      </div>
      <div class="player-health-value">${enemy.vidaActual} / ${enemy.stats.vida}</div>
      <div class="player-health-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${enemy.stats.vida}" aria-valuenow="${enemy.vidaActual}">
        <span style="width: ${healthPercent}%;"></span>
      </div>
    </section>
  `;
}
function renderDiceFaces(dice, selectedDieIndex) {
    if (!dice.length) {
        return '<div class="dice-empty">Aún no se han tirado los dados.</div>';
    }
    const pipMap = {
        1: [4],
        2: [0, 8],
        3: [0, 4, 8],
        4: [0, 2, 6, 8],
        5: [0, 2, 4, 6, 8],
        6: [0, 2, 3, 5, 6, 8]
    };
    function renderPips(value) {
        const positions = pipMap[value] ?? pipMap[1];
        return positions.map(position => `<span class="die-pip die-pip-${position}"></span>`).join('');
    }
    return `
    <div class="dice-list">
      ${dice
        .map((value, index) => `
            <button
              class="die-face ${selectedDieIndex === index ? 'selected' : ''}"
              type="button"
              data-die-index="${index}"
              title="Dado ${index + 1}: ${value}"
            >
              <span class="die-pips" aria-hidden="true">${renderPips(value)}</span>
            </button>
          `)
        .join('')}
    </div>
  `;
}
function renderPhasePanel(phasePanel, currentPhase, turnResources, showReachAssignment = false, classAbilityAction, onRollEnergyDice, onSelectEnergyDie, onAssignEnergyDie, onUseClassAbility) {
    phasePanel.innerHTML = '';
    const title = document.createElement('h2');
    title.className = 'panel-block-title';
    title.textContent = 'Fase y acciones';
    phasePanel.appendChild(title);
    if (currentPhase) {
        const phaseCard = document.createElement('section');
        phaseCard.className = 'entity-card phase-card';
        phaseCard.innerHTML = `
      <div class="entity-card-header">
        <span class="entity-badge player-badge">Turno</span>
        <h3>${getPhaseLabel(currentPhase)}</h3>
      </div>

      <div class="entity-position">${getPhaseDescription(currentPhase)}</div>

      ${currentPhase === 'energy'
            ? `
            <div class="phase-actions">
              <button class="phase-btn" id="roll-energy-dice" type="button">
                Tirar dados
              </button>
            </div>

            <div class="phase-dice-wrap">
              ${renderDiceFaces(turnResources?.energyDice ?? [], turnResources?.selectedDieIndex ?? null)}
            </div>

            ${classAbilityAction
                ? `
                  <div class="phase-actions">
                    <button class="phase-btn" id="use-class-ability" type="button">
                      ${classAbilityAction.label}
                    </button>
                    <p class="entity-position">${classAbilityAction.description}</p>
                  </div>
                `
                : ''}
          `
            : ''}

      ${currentPhase === 'game-over'
            ? `
            <div class="phase-actions">
              <button class="phase-btn phase-restart-btn" id="restart-game" type="button">
                Reiniciar partida (F5)
              </button>
            </div>
          `
            : ''}

      <div class="assignment-panel">
        ${createEnergyAssignmentBlock('Velocidad', 'velocidad', turnResources?.assignedEnergy.velocidad ?? null, currentPhase === 'energy')}
        ${showReachAssignment
            ? createEnergyAssignmentBlock('Alcance', 'alcance', turnResources?.assignedEnergy.alcance ?? null, currentPhase === 'energy')
            : ''}
        ${createEnergyAssignmentBlock('Ataque', 'ataque', turnResources?.assignedEnergy.ataque ?? null, currentPhase === 'energy')}
        ${createEnergyAssignmentBlock('Defensa', 'defensa', turnResources?.assignedEnergy.defensa ?? null, currentPhase === 'energy')}
      </div>
    `;
        phasePanel.appendChild(phaseCard);
        if (currentPhase === 'energy' && onRollEnergyDice) {
            const rollBtn = phaseCard.querySelector('#roll-energy-dice');
            rollBtn?.addEventListener('click', () => {
                onRollEnergyDice();
            });
        }
        if (currentPhase === 'energy' && onUseClassAbility) {
            const abilityBtn = phaseCard.querySelector('#use-class-ability');
            abilityBtn?.addEventListener('click', () => {
                onUseClassAbility();
            });
        }
        if (currentPhase === 'energy' && onSelectEnergyDie) {
            const dieButtons = phaseCard.querySelectorAll('[data-die-index]');
            dieButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const dieIndex = Number(button.dataset.dieIndex);
                    onSelectEnergyDie(dieIndex);
                });
            });
        }
        if (currentPhase === 'energy' && onAssignEnergyDie) {
            const assignButtons = phaseCard.querySelectorAll('[data-energy-stat]');
            assignButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const stat = button.dataset.energyStat;
                    onAssignEnergyDie(stat);
                });
            });
        }
        if (currentPhase === 'game-over') {
            const restartBtn = phaseCard.querySelector('#restart-game');
            restartBtn?.addEventListener('click', () => {
                window.location.reload();
            });
        }
    }
}
function renderPlayerPanel(playerPanel, player, turnResources, onUpgradeStat) {
    playerPanel.innerHTML = '';
    const title = document.createElement('h2');
    title.className = 'panel-block-title';
    title.textContent = 'Jugador';
    playerPanel.appendChild(title);
    if (player) {
        const canUseUpgrade = player.mejorasDisponibles > 0;
        const velocidadBonus = turnResources?.assignedEnergy.velocidad ?? 0;
        const ataqueBonus = turnResources?.assignedEnergy.ataque ?? 0;
        const defensaBonus = turnResources?.assignedEnergy.defensa ?? 0;
        const alcanceBonus = turnResources?.assignedEnergy.alcance ?? 0;
        const playerClass = getPlayerClassOption(player.clase);
        const playerCard = document.createElement('section');
        playerCard.className = 'entity-card player-card';
        playerCard.innerHTML = `
      <div class="entity-card-header">
        <span class="entity-badge player-badge">Jugador</span>
        <h3>${player.nombre}</h3>
        <p class="entity-position">Clase: ${playerClass.nombre}</p>
      </div>

      ${createPlayerReferenceBlock(player)}

      ${createPlayerHealthBlock(player)}

      <div class="entity-stats">
        ${createStatRow('Vida', 'vida', player.stats.vida, 0, undefined, canUseUpgrade && player.vidaActual < player.stats.vida)}
        ${createStatRow('Velocidad', 'velocidad', player.stats.velocidad, velocidadBonus, turnResources?.velocidadDisponible, canUseUpgrade && player.stats.velocidad < 6)}
        ${createStatRow('Daño', 'dano', player.stats.dano, ataqueBonus, turnResources?.ataqueDisponible, canUseUpgrade && player.stats.dano < 6)}
        ${createStatRow('Defensa', 'defensa', player.stats.defensa, defensaBonus, undefined, canUseUpgrade && player.stats.defensa < 6)}
        ${createStatRow('Alcance', 'alcance', player.stats.alcance, alcanceBonus, undefined, false)}
      </div>
    `;
        if (onUpgradeStat) {
            const buttons = playerCard.querySelectorAll('.upgrade-btn');
            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    const stat = button.dataset.stat;
                    onUpgradeStat(stat);
                });
            });
        }
        playerPanel.appendChild(playerCard);
    }
}
function renderEnemyReferencePanel(enemyPanel, baseEnemy) {
    enemyPanel.innerHTML = '';
    const title = document.createElement('h2');
    title.className = 'panel-block-title';
    title.textContent = 'Enemigos';
    enemyPanel.appendChild(title);
    if (!baseEnemy) {
        return;
    }
    const enemyBaseCard = document.createElement('section');
    enemyBaseCard.className = 'entity-card enemy-reference-card';
    enemyBaseCard.innerHTML = `
    <div class="entity-card-header">
      <span class="entity-badge enemy-badge">Referencia</span>
      <h3>Enemigo del nivel: ${baseEnemy.nombre}</h3>
    </div>

    <div class="enemy-artwork-shell enemy-artwork-shell-reference">
      <img
        class="enemy-artwork"
        src="${getEnemyArtworkPath(baseEnemy)}"
        alt="${baseEnemy.nombre}"
      />
    </div>

    <div class="entity-stats">
      ${createEnemyStatRow('Vida base', 'vida', baseEnemy.stats.vida)}
      ${createEnemyStatRow('Velocidad base', 'velocidad', baseEnemy.stats.velocidad)}
      ${createEnemyStatRow('Ataque base', 'ataque', baseEnemy.stats.ataque)}
      ${createEnemyStatRow('Defensa base', 'defensa', baseEnemy.stats.defensa)}
      ${createEnemyStatRow('Alcance base', 'alcance', baseEnemy.stats.alcance)}
    </div>
  `;
    enemyPanel.appendChild(enemyBaseCard);
}
function renderEnemyListSection(enemies) {
    const section = document.createElement('section');
    section.className = 'enemy-section';
    const listTitle = document.createElement('h2');
    listTitle.className = 'enemy-section-title';
    listTitle.textContent = 'Enemigos';
    section.appendChild(listTitle);
    const enemiesWrapper = document.createElement('div');
    enemiesWrapper.className = 'enemy-list';
    if (enemies.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'entity-empty';
        empty.textContent = 'No hay enemigos en este nivel.';
        enemiesWrapper.appendChild(empty);
    }
    else {
        enemies.forEach((enemy, index) => {
            const enemyCard = document.createElement('section');
            enemyCard.className = 'entity-card enemy-card';
            enemyCard.innerHTML = `
        <div class="entity-card-header">
          <span class="entity-badge enemy-badge">Enemigo ${index + 1}</span>
          <h3>${enemy.nombre}</h3>
        </div>

        ${createEnemyHealthBlock(enemy)}
      `;
            enemiesWrapper.appendChild(enemyCard);
        });
    }
    section.appendChild(enemiesWrapper);
    return section;
}
export function renderMap(map, container, enemies = [], player = null, onUpgradeStat, currentPhase, turnResources, showReachAssignment = false, classAbilityAction, onRollEnergyDice, onSelectEnergyDie, onAssignEnergyDie, onUseClassAbility, onMovePlayer, onAttackEnemy) {
    container.innerHTML = '';
    const boardGrid = document.createElement('div');
    boardGrid.className = 'board-grid';
    boardGrid.classList.add(map.level % 2 === 0 ? 'level-even' : 'level-odd');
    for (const row of map.tiles) {
        for (const tile of row) {
            const enemy = findEnemyAtPosition(enemies, tile.x, tile.y);
            const enemyMarkerLabel = enemy ? getEnemyMarkerLabel(enemy, enemies) : undefined;
            const tileElement = createTileElement(tile, player, enemy, enemyMarkerLabel);
            if (currentPhase === 'adventurer' &&
                player &&
                turnResources &&
                onMovePlayer &&
                canMoveTo(map, player, enemies, tile.x, tile.y, turnResources)) {
                tileElement.classList.add('tile-movable');
                const cost = getMovementCost(player.x, player.y, tile.x, tile.y);
                if (cost !== null) {
                    tileElement.title = `Mover cuesta ${cost} de velocidad`;
                }
                tileElement.addEventListener('click', () => {
                    onMovePlayer(tile.x, tile.y);
                });
            }
            if (currentPhase === 'adventurer' &&
                player &&
                enemy &&
                turnResources &&
                onAttackEnemy &&
                canAttackEnemy(map, player, enemy, enemies, turnResources)) {
                tileElement.classList.add('tile-attackable');
                const enemyButton = tileElement.querySelector('.enemy-marker');
                enemyButton?.addEventListener('click', event => {
                    event.stopPropagation();
                    onAttackEnemy(enemy.x, enemy.y);
                });
            }
            boardGrid.appendChild(tileElement);
        }
    }
    container.appendChild(boardGrid);
    const enemyPanel = document.getElementById('enemy-panel');
    if (enemyPanel instanceof HTMLElement) {
        const baseEnemy = getEnemyByLevel(map.level);
        renderEnemyReferencePanel(enemyPanel, baseEnemy);
    }
    const enemyListCenter = document.getElementById('enemy-list-center');
    if (enemyListCenter instanceof HTMLElement) {
        enemyListCenter.innerHTML = '';
        enemyListCenter.appendChild(renderEnemyListSection(enemies));
    }
    const playerPanel = document.getElementById('player-panel');
    if (playerPanel instanceof HTMLElement) {
        renderPlayerPanel(playerPanel, player, turnResources, onUpgradeStat);
    }
    const phasePanel = document.getElementById('phase-panel');
    if (phasePanel instanceof HTMLElement) {
        renderPhasePanel(phasePanel, currentPhase, turnResources, showReachAssignment, classAbilityAction, onRollEnergyDice, onSelectEnergyDie, onAssignEnergyDie, onUseClassAbility);
    }
}
