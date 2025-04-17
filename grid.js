// Fonctions liées à la grille, obstacles, conversions, BFS, LoS

/**
 * Crée une grille vide de dimensions spécifiées.
 * @param {number} rows - Nombre de lignes.
 * @param {number} cols - Nombre de colonnes.
 * @returns {Array<Array<number>>} - Grille initialisée.
 */
function createGrid(rows, cols) {
    const grid = [];
    for (let i = 0; i < rows; i++) {
        const row = new Array(cols).fill(0);
        grid.push(row);
    }
    return grid;
}

/**
 * Place un obstacle dans la grille.
 * @param {Array<Array<number>>} grid - La grille.
 * @param {number} x - Coordonnée x.
 * @param {number} y - Coordonnée y.
 */
function placeObstacle(grid, x, y) {
    if (grid[x] && grid[x][y] !== undefined) {
        grid[x][y] = 1;
    }
}

/**
 * Convertit des coordonnées en index de tableau.
 * @param {number} x - Coordonnée x.
 * @param {number} y - Coordonnée y.
 * @param {number} cols - Nombre de colonnes.
 * @returns {number} - Index correspondant.
 */
function coordsToIndex(x, y, cols) {
    return x * cols + y;
}

/**
 * Convertit un index de tableau en coordonnées.
 * @param {number} index - Index.
 * @param {number} cols - Nombre de colonnes.
 * @returns {Array<number>} - Coordonnées correspondantes.
 */
function indexToCoords(index, cols) {
    const x = Math.floor(index / cols);
    const y = index % cols;
    return [x, y];
}

/**
 * Renvoie les voisins 4-directions hors obstacles et entités.
 * @param {number} x
 * @param {number} y
 * @param {{gridX:number,gridY:number}[]} blockingEntities
 * @returns {{x:number,y:number}[]}
 */
function getNeighbors(x, y, blockingEntities = []) {
    const deltas = [{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1}];
    const out = [];
    for (const {dx,dy} of deltas) {
        const nx = x+dx, ny = y+dy;
        if (nx<0||nx>=GRID_COLS||ny<0||ny>=GRID_ROWS) continue;
        if (mapGrid[ny][nx]===1) continue;
        if (blockingEntities.some(e=>e.gridX===nx&&e.gridY===ny)) continue;
        out.push({x:nx,y:ny});
    }
    return out;
}

/**
 * Implémente l'algorithme de recherche en largeur (BFS).
 * @param {Array<Array<number>>} grid - La grille.
 * @param {Array<number>} start - Point de départ [x, y].
 * @param {Array<number>} end - Point d'arrivée [x, y].
 * @returns {Array<Array<number>>|null} - Chemin trouvé ou null.
 */
function bfs(grid, start, end, bouftousList = []) {
    const rows = grid.length;
    const cols = grid[0].length;
    const visited = new Set();
    const queue = [[start, [start]]];

    while (queue.length > 0) {
        const [current, path] = queue.shift();
        const [x, y] = current;

        if (x === end[0] && y === end[1]) {
            return path;
        }

        for (const { x: nx, y: ny } of getNeighbors(x, y, bouftousList)) {
            const neighbors = [nx, ny];
            if (!visited.has(coordsToIndex(nx, ny, cols))) {
                visited.add(coordsToIndex(nx, ny, cols));
                queue.push([[nx, ny], [...path, [nx, ny]]]);
            }
        }
    }

    return null;
}

/**
 * BFS pour tuiles accessibles.
 * @param {number} startX
 * @param {number} startY
 * @param {number} maxRange
 * @param {{gridX:number,gridY:number}[]} blockingEntities
 * @param {boolean} [includeOrigin=false]
 * @returns {{x:number,y:number,cost:number}[]}
 */
export function getTilesInRangeBFS(startX, startY, maxRange, blockingEntities = [], includeOrigin = false) {
    const visited = new Set();
    const queue = [{ x: startX, y: startY, cost: 0 }];
    const reachable = [];
    visited.add(coordsToIndex(startX, startY, GRID_COLS));
    if (includeOrigin) reachable.push({ x: startX, y: startY, cost: 0 });
    while (queue.length > 0) {
        const { x, y, cost } = queue.shift();
        if (cost >= maxRange) continue;
        for (const { x: nx, y: ny } of getNeighbors(x, y, blockingEntities)) {
            const idx = coordsToIndex(nx, ny, GRID_COLS);
            if (visited.has(idx)) continue;
            visited.add(idx);
            const nextCost = cost + 1;
            reachable.push({ x: nx, y: ny, cost: nextCost });
            queue.push({ x: nx, y: ny, cost: nextCost });
        }
    }
    return reachable;
}

/**
 * Bresenham LoS avec grille et entités en obstacles.
 * @param {number} startX
 * @param {number} startY
 * @param {number} endX
 * @param {number} endY
 * @param {...object[]} rest - soit tableau d'entités, soit liste d'args (player,boss,bouftous)
 * @returns {boolean}
 */
export function hasLineOfSight(startX, startY, endX, endY, ...rest) {
    const blockingEntities = rest.length === 1 && Array.isArray(rest[0]) ? rest[0] : rest;
    let x1 = startX, y1 = startY;
    const dx = Math.abs(endX - x1), dy = -Math.abs(endY - y1);
    const sx = x1 < endX ? 1 : -1, sy = y1 < endY ? 1 : -1;
    let err = dx + dy;
    while (true) {
        if (!(x1===startX && y1===startY) && !(x1===endX && y1===endY)) {
            if (mapGrid[y1] && mapGrid[y1][x1] === 1) return false;
            if (blockingEntities.some(e => e.gridX===x1 && e.gridY===y1)) return false;
        }
        if (x1===endX && y1===endY) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x1 += sx; }
        if (e2 <= dx) { err += dx; y1 += sy; }
    }
    return true;
}

/**
 * Vérifie la ligne de vue (Line of Sight - LoS) entre deux points.
 * @param {Array<Array<number>>} grid - La grille.
 * @param {Array<number>} start - Point de départ [x, y].
 * @param {Array<number>} end - Point d'arrivée [x, y].
 * @returns {boolean} - True si la ligne de vue est dégagée, sinon false.
 */

// --- Configuration ---
export const TILE_W = 40;
export const TILE_H = TILE_W / 2;
export const GRID_COLS = 14;
export const GRID_ROWS = 14;
export const MAP_OFFSET_X = 600 / 2; // canvas width / 2
export const MAP_OFFSET_Y = TILE_H * 4;
export const PROJECTILE_SPEED = 8;
export const PLAYER_ATTACK_DAMAGE = 15;
export const BOSS_ATTACK_DAMAGE = 10;
export const BOSS_MAX_HP = 150;
export const PLAYER_MAX_HP = 100;
export const MAX_MOVE_POINTS = 6;
export const MAX_ACTION_POINTS = 2;
export const PLAYER_ATTACK_RANGE = 7;
export const BOSS_ATTACK_RANGE = 5;
export const BOSS_ATTACK_RANGE_SQ = BOSS_ATTACK_RANGE * BOSS_ATTACK_RANGE;

// --- MapGrid amélioré : obstacles symétriques en forme de L inversés ---
export const mapGrid = Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => {
        const isTopLeftL = (x === 3 && y >= 3 && y <= 5) || (y === 3 && x >= 3 && x <= 5);
        const isTopRightL = (x === GRID_COLS-4 && y >= 3 && y <= 5) || (y === 3 && x >= GRID_COLS-6 && x <= GRID_COLS-4);
        const isBottomLeftL = (x === 3 && y >= GRID_ROWS-6 && y <= GRID_ROWS-4) || (y === GRID_ROWS-4 && x >= 3 && x <= 5);
        const isBottomRightL = (x === GRID_COLS-4 && y >= GRID_ROWS-6 && y <= GRID_ROWS-4) || (y === GRID_ROWS-4 && x >= GRID_COLS-6 && x <= GRID_COLS-4);
        return isTopLeftL || isTopRightL || isBottomLeftL || isBottomRightL ? 1 : 0;
    })
);

export function isoToScreen(gridX, gridY) {
    const screenX = MAP_OFFSET_X + (gridX - gridY) * (TILE_W / 2);
    const screenY = MAP_OFFSET_Y + (gridX + gridY) * (TILE_H / 2);
    return { x: screenX, y: screenY };
}

export function screenToIso(screenX, screenY) {
    const adjustedX = screenX - MAP_OFFSET_X;
    const adjustedY = screenY - MAP_OFFSET_Y;
    const gridX = Math.round((adjustedX / (TILE_W / 2) + adjustedY / (TILE_H / 2)) / 2);
    const gridY = Math.round((adjustedY / (TILE_H / 2) - adjustedX / (TILE_W / 2)) / 2);
    return { x: Math.max(0, Math.min(GRID_COLS - 1, gridX)), y: Math.max(0, Math.min(GRID_ROWS - 1, gridY)) };
}

// Nouvelle version : prend en compte toutes les entités comme obstacles
export function isTileValidAndFree(x, y, movingEntity, player, boss, bouftousList = []) {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false;
    if (mapGrid[y][x] === 1) return false;
    // Empêche de marcher sur le joueur
    if (player && movingEntity !== player && x === player.gridX && y === player.gridY) return false;
    // Empêche de marcher sur le boss
    if (boss && movingEntity !== boss && x === boss.gridX && y === boss.gridY) return false;
    // Empêche de marcher sur un bouftou vivant (hors soi-même)
    if (bouftousList && Array.isArray(bouftousList)) {
        for (const b of bouftousList) {
            if (b !== movingEntity && b.hp > 0 && x === b.gridX && y === b.gridY) return false;
        }
    }
    return true;
}

export { createGrid, placeObstacle, coordsToIndex, indexToCoords, bfs };