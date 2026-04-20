const PLAYER_MAX_STAT = 6;
const BASE_PLAYER_STATS = {
    vida: 6,
    velocidad: 1,
    dano: 1,
    defensa: 1,
    alcance: 2
};
const EMPTY_UPGRADES = {
    vida: 0,
    velocidad: 0,
    dano: 0,
    defensa: 0,
    alcance: 0
};
function clampStat(value) {
    return Math.min(value, PLAYER_MAX_STAT);
}
export function getBasePlayerStats() {
    return { ...BASE_PLAYER_STATS };
}
export function createPlayer(map, clase) {
    const startX = map.side === 'A' ? 0 : map.width - 1;
    const startY = map.height - 1;
    return {
        nombre: 'Aventurero',
        clase,
        x: startX,
        y: startY,
        vidaActual: BASE_PLAYER_STATS.vida,
        stats: { ...BASE_PLAYER_STATS },
        mejorasDisponibles: 0,
        mejorasAplicadas: { ...EMPTY_UPGRADES },
        nivelesCompletados: 0
    };
}
export function movePlayerToMapStart(player, map) {
    return {
        ...player,
        x: map.side === 'A' ? 0 : map.width - 1,
        y: map.height - 1
    };
}
export function grantLevelCompletionUpgrade(player) {
    return {
        ...player,
        nivelesCompletados: player.nivelesCompletados + 1,
        mejorasDisponibles: player.mejorasDisponibles + 1
    };
}
export function canUpgradeStat(player, stat) {
    if (stat === 'alcance') {
        return false;
    }
    if (stat === 'vida') {
        return player.mejorasDisponibles > 0 && player.vidaActual < player.stats.vida;
    }
    return player.mejorasDisponibles > 0 && player.stats[stat] < PLAYER_MAX_STAT;
}
export function upgradePlayerStat(player, stat) {
    if (!canUpgradeStat(player, stat)) {
        return player;
    }
    if (stat === 'vida') {
        return {
            ...player,
            vidaActual: Math.min(player.stats.vida, player.vidaActual + 1),
            mejorasAplicadas: {
                ...player.mejorasAplicadas,
                vida: player.mejorasAplicadas.vida + 1
            },
            mejorasDisponibles: player.mejorasDisponibles - 1
        };
    }
    const upgradedStatValue = clampStat(player.stats[stat] + 1);
    return {
        ...player,
        vidaActual: player.vidaActual,
        stats: {
            ...player.stats,
            [stat]: upgradedStatValue
        },
        mejorasAplicadas: {
            ...player.mejorasAplicadas,
            [stat]: player.mejorasAplicadas[stat] + 1
        },
        mejorasDisponibles: player.mejorasDisponibles - 1
    };
}
function isWithinBounds(map, x, y) {
    return x >= 0 && y >= 0 && x < map.width && y < map.height;
}
function getTile(map, x, y) {
    if (!isWithinBounds(map, x, y)) {
        return null;
    }
    return map.tiles[y][x];
}
function hasEnemyAt(enemies, x, y) {
    return enemies.some(enemy => enemy.x === x && enemy.y === y);
}
export function getMovementCost(fromX, fromY, toX, toY) {
    const dx = Math.abs(toX - fromX);
    const dy = Math.abs(toY - fromY);
    if (dx === 0 && dy === 0) {
        return null;
    }
    if (dx > 1 || dy > 1) {
        return null;
    }
    if (dx === 1 && dy === 1) {
        return 3;
    }
    if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        return 2;
    }
    return null;
}
export function canMoveTo(map, player, enemies, targetX, targetY, turn) {
    if (!isWithinBounds(map, targetX, targetY)) {
        return false;
    }
    const movementCost = getMovementCost(player.x, player.y, targetX, targetY);
    if (movementCost === null) {
        return false;
    }
    const tile = getTile(map, targetX, targetY);
    if (!tile || tile.bloqueaMovimiento) {
        return false;
    }
    if (hasEnemyAt(enemies, targetX, targetY)) {
        return false;
    }
    if (movementCost > turn.velocidadDisponible) {
        return false;
    }
    return true;
}
export function movePlayer(map, player, enemies, turn, targetX, targetY) {
    const movementCost = getMovementCost(player.x, player.y, targetX, targetY);
    if (movementCost === null ||
        !canMoveTo(map, player, enemies, targetX, targetY, turn)) {
        return { player, turn };
    }
    return {
        player: {
            ...player,
            x: targetX,
            y: targetY
        },
        turn: {
            ...turn,
            velocidadDisponible: turn.velocidadDisponible - movementCost
        }
    };
}
export function getReachCostByMovement(ax, ay, bx, by) {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    const diagonalSteps = Math.min(dx, dy);
    const orthogonalSteps = Math.max(dx, dy) - diagonalSteps;
    return diagonalSteps * 3 + orthogonalSteps * 2;
}
function getTileCorners(x, y) {
    return [
        { x, y },
        { x: x + 1, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 }
    ];
}
function segmentIntersectsTileInterior(ax, ay, bx, by, tileX, tileY) {
    const epsilon = 1e-9;
    const minX = tileX + epsilon;
    const maxX = tileX + 1 - epsilon;
    const minY = tileY + epsilon;
    const maxY = tileY + 1 - epsilon;
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;
    const clip = (p, q) => {
        if (p === 0) {
            return q >= 0;
        }
        const t = q / p;
        if (p < 0) {
            if (t > t1) {
                return false;
            }
            if (t > t0) {
                t0 = t;
            }
        }
        else {
            if (t < t0) {
                return false;
            }
            if (t < t1) {
                t1 = t;
            }
        }
        return true;
    };
    return (clip(-dx, ax - minX) &&
        clip(dx, maxX - ax) &&
        clip(-dy, ay - minY) &&
        clip(dy, maxY - ay) &&
        t0 <= t1);
}
function isVisionBlockingTile(map, enemies, tileX, tileY, fromX, fromY, toX, toY) {
    if ((tileX === fromX && tileY === fromY) || (tileX === toX && tileY === toY)) {
        return false;
    }
    const tile = getTile(map, tileX, tileY);
    if (!tile) {
        return false;
    }
    if (tile.bloqueaVision) {
        return true;
    }
    return hasEnemyAt(enemies, tileX, tileY);
}
export function hasLineOfSight(map, enemies, fromX, fromY, toX, toY) {
    const sourceCorners = getTileCorners(fromX, fromY);
    const targetCorners = getTileCorners(toX, toY);
    for (const sourceCorner of sourceCorners) {
        for (const targetCorner of targetCorners) {
            let blocked = false;
            for (let y = 0; y < map.height && !blocked; y += 1) {
                for (let x = 0; x < map.width; x += 1) {
                    if (!isVisionBlockingTile(map, enemies, x, y, fromX, fromY, toX, toY)) {
                        continue;
                    }
                    if (segmentIntersectsTileInterior(sourceCorner.x, sourceCorner.y, targetCorner.x, targetCorner.y, x, y)) {
                        blocked = true;
                        break;
                    }
                }
            }
            if (!blocked) {
                return true;
            }
        }
    }
    return false;
}
export function canAttackEnemy(map, player, enemy, enemies, turn) {
    if (turn.ataqueDisponible <= 0) {
        return false;
    }
    if (turn.ataqueDisponible <= enemy.stats.defensa) {
        return false;
    }
    const reachCost = getReachCostByMovement(player.x, player.y, enemy.x, enemy.y);
    if (reachCost > turn.alcanceTotal) {
        return false;
    }
    return hasLineOfSight(map, enemies, player.x, player.y, enemy.x, enemy.y);
}
export function attackEnemy(enemies, enemyIndex, turn) {
    const target = enemies[enemyIndex];
    if (!target) {
        return { enemies, turn };
    }
    const attackCost = target.stats.defensa;
    const damage = turn.ataqueDisponible - target.stats.defensa;
    if (turn.ataqueDisponible <= attackCost || damage <= 0) {
        return { enemies, turn };
    }
    const nextTurn = {
        ...turn,
        ataqueDisponible: turn.ataqueDisponible - attackCost
    };
    const updatedEnemies = enemies
        .map((enemy, index) => index === enemyIndex
        ? { ...enemy, vidaActual: enemy.vidaActual - damage }
        : enemy)
        .filter(enemy => enemy.vidaActual > 0);
    return {
        enemies: updatedEnemies,
        turn: nextTurn
    };
}
