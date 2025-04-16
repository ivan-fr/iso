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
 * Implémente l'algorithme de recherche en largeur (BFS).
 * @param {Array<Array<number>>} grid - La grille.
 * @param {Array<number>} start - Point de départ [x, y].
 * @param {Array<number>} end - Point d'arrivée [x, y].
 * @returns {Array<Array<number>>|null} - Chemin trouvé ou null.
 */
function bfs(grid, start, end) {
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

        const neighbors = [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1],
        ];

        for (const [nx, ny] of neighbors) {
            if (
                nx >= 0 &&
                ny >= 0 &&
                nx < rows &&
                ny < cols &&
                grid[nx][ny] === 0 &&
                !visited.has(coordsToIndex(nx, ny, cols))
            ) {
                visited.add(coordsToIndex(nx, ny, cols));
                queue.push([[nx, ny], [...path, [nx, ny]]]);
            }
        }
    }

    return null;
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

export function isTileValidAndFree(x, y, movingEntity, player, boss) {
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false;
    if (mapGrid[y][x] === 1) return false;
    if (movingEntity) {
        const otherEntity = movingEntity === player ? boss : player;
        if (otherEntity && x === otherEntity.gridX && y === otherEntity.gridY) return false;
    }
    return true;
}

export function getTilesInRangeBFS(startX, startY, maxRange, entityCheckBlocking, player, boss) {
    let visited = new Set();
    let queue = [{ x: startX, y: startY, cost: 0 }];
    let reachable = [];
    visited.add(`${startX},${startY}`);
    if (!entityCheckBlocking) {
        reachable.push({ x: startX, y: startY, cost: 0 });
    }
    while (queue.length > 0) {
        const current = queue.shift();
        if (entityCheckBlocking && current.cost > 0) {
            reachable.push(current);
        }
        if (current.cost >= maxRange) continue;
        const neighbors = [
            { x: current.x + 1, y: current.y },
            { x: current.x - 1, y: current.y },
            { x: current.x, y: current.y + 1 },
            { x: current.x, y: current.y - 1 }
        ];
        for (const neighbor of neighbors) {
            const key = `${neighbor.x},${neighbor.y}`;
            if (!visited.has(key) && isTileValidAndFree(neighbor.x, neighbor.y, entityCheckBlocking, player, boss)) {
                visited.add(key);
                const nextCost = current.cost + 1;
                queue.push({ x: neighbor.x, y: neighbor.y, cost: nextCost });
                if (!entityCheckBlocking) {
                    reachable.push({ x: neighbor.x, y: neighbor.y, cost: nextCost });
                }
            }
        }
    }
    return reachable;
}

export function hasLineOfSight(startX, startY, endX, endY) {
    let x1 = startX;
    let y1 = startY;
    const x2 = endX;
    const y2 = endY;
    const dx = Math.abs(x2 - x1);
    const dy = -Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx + dy;
    while (true) {
        if (x1 !== startX || y1 !== startY) {
            if (x1 === endX && y1 === endY) break;
            if (x1 >= 0 && x1 < GRID_COLS && y1 >= 0 && y1 < GRID_ROWS) {
                if (mapGrid[y1][x1] === 1) {
                    return false;
                }
            } else {
                return false;
            }
        }
        if (x1 === endX && y1 === endY) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
            if (x1 === endX) break;
            err += dy;
            x1 += sx;
        }
        if (e2 <= dx) {
            if (y1 === endY) break;
            err += dx;
            y1 += sy;
        }
    }
    return true;
}

export { createGrid, placeObstacle, coordsToIndex, indexToCoords, bfs };