export const MAP_CODES = {
    EMPTY: 0,
    START: 13,
    WALL: 14
};
export const MAP_A = [
    [9, 5, 0, 1, 13],
    [7, 0, 0, 14, 5],
    [11, 0, 9, 0, 1],
    [3, 14, 7, 14, 9],
    [13, 11, 9, 11, 5]
];
export const MAP_B = [
    [13, 6, 2, 8, 10],
    [2, 6, 10, 0, 12],
    [14, 10, 0, 14, 0],
    [10, 0, 12, 14, 12],
    [6, 8, 0, 4, 13]
];
function isWall(code) {
    return code === MAP_CODES.WALL;
}
function isStart(code) {
    return code === MAP_CODES.START;
}
function isEmpty(code) {
    return code === MAP_CODES.EMPTY;
}
function isEnemySpawn(code) {
    return code >= 1 && code <= 12;
}
function cloneLayout(layout) {
    return layout.map(row => [...row]);
}
function invertLayout180(layout) {
    return cloneLayout(layout)
        .reverse()
        .map(row => [...row].reverse());
}
function getBaseLayoutForLevel(level) {
    return level % 2 === 1 ? MAP_A : MAP_B;
}
function isInvertedForLevel(level) {
    const phase = Math.ceil(level / 2);
    return phase % 2 === 0;
}
export function getLayoutForLevel(level) {
    const baseLayout = getBaseLayoutForLevel(level);
    return isInvertedForLevel(level) ? invertLayout180(baseLayout) : cloneLayout(baseLayout);
}
function createTile(x, y, code) {
    if (isWall(code)) {
        return {
            x,
            y,
            code,
            nivel: null,
            spawnNivel: null,
            type: 'wall',
            bloqueaMovimiento: true,
            bloqueaVision: true,
            esInicio: false
        };
    }
    if (isStart(code)) {
        return {
            x,
            y,
            code,
            nivel: null,
            spawnNivel: null,
            type: 'stairs',
            bloqueaMovimiento: false,
            bloqueaVision: false,
            esInicio: true
        };
    }
    if (isEmpty(code)) {
        return {
            x,
            y,
            code,
            nivel: null,
            spawnNivel: null,
            type: 'floor',
            bloqueaMovimiento: false,
            bloqueaVision: false,
            esInicio: false
        };
    }
    if (isEnemySpawn(code)) {
        return {
            x,
            y,
            code,
            nivel: code,
            spawnNivel: code,
            type: 'floor',
            bloqueaMovimiento: false,
            bloqueaVision: false,
            esInicio: false
        };
    }
    return {
        x,
        y,
        code,
        nivel: null,
        spawnNivel: null,
        type: 'floor',
        bloqueaMovimiento: false,
        bloqueaVision: false,
        esInicio: false
    };
}
export function buildMapForLevel(level) {
    const layout = getLayoutForLevel(level);
    const tiles = layout.map((row, y) => row.map((code, x) => createTile(x, y, code)));
    return {
        width: 5,
        height: 5,
        tiles,
        level,
        phase: Math.ceil(level / 2),
        side: level % 2 === 1 ? 'A' : 'B',
        inverted: isInvertedForLevel(level)
    };
}
export function getSpawnTilesForLevel(map, nivelActual) {
    return map.tiles
        .flat()
        .filter(tile => tile.spawnNivel === nivelActual);
}
export function getStartTiles(map) {
    return map.tiles
        .flat()
        .filter(tile => tile.esInicio);
}
