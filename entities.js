// --- Entités principales ---
import { GRID_COLS, GRID_ROWS } from './grid.js';

export class Entity {
    constructor(gridX, gridY, size, hp, maxHp, mp, ap) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.size = size;
        this.hp = hp;
        this.maxHp = maxHp;
        this.mp = mp;
        this.ap = ap;
        this.screenX = null;
        this.screenY = null;
    }
}

export class Player extends Entity {
    constructor(gridX, gridY, size, hp, maxHp, mp, ap) {
        super(gridX, gridY, size, hp, maxHp, mp, ap);
    }
}

export class Boss extends Entity {
    constructor(gridX, gridY, size, hp, maxHp, mp, ap) {
        super(gridX, gridY, size, hp, maxHp, mp, ap);
    }
}

import { ENEMY_TYPES } from './enemyTypes.js';

export const player = {
    gridX: 2,
    gridY: 2,
    size: 28,
    hp: 100, // Could be ENEMY_TYPES.player.hp if you want to unify
    maxHp: 100,
    mp: 6,
    ap: 2,
    screenX: null,
    screenY: null
};

export const boss = {
    gridX: GRID_COLS - 3,
    gridY: GRID_ROWS - 3,
    size: ENEMY_TYPES.boss.size || 36,
    hp: ENEMY_TYPES.boss.hp,
    maxHp: ENEMY_TYPES.boss.maxHp,
    mp: ENEMY_TYPES.boss.mp,
    ap: ENEMY_TYPES.boss.ap,
    screenX: null,
    screenY: null
};

// --- Génération dynamique des ennemis selon la salle ---

export function createEnemy(type, gridX, gridY) {
    const base = ENEMY_TYPES[type];
    if (!base) throw new Error('Type ennemi inconnu: ' + type);
    return {
        id: Math.random().toString(36).slice(2),
        gridX,
        gridY,
        size: base.size || 26,
        hp: base.hp,
        maxHp: base.maxHp,
        mp: base.mp,
        ap: base.ap,
        screenX: null,
        screenY: null,
        image: base.image || (type === 'boufton_noir' ? 'boufton_noir.png' : undefined),
        aiType: base.aiType,
        type
    };
}
// Plus de tableau bouftous statique : tout est généré dynamiquement par salle.

// Pathfinding (A*)
export function findPath(startX, startY, endX, endY, entity, isTileValidAndFree, player, boss) {
    if (startX === endX && startY === endY) return [{x: startX, y: startY}];
    const open = [];
    const closed = new Set();
    const cameFrom = {};
    const gScore = {};
    const fScore = {};
    function key(x, y) { return `${x},${y}`; }
    gScore[key(startX, startY)] = 0;
    fScore[key(startX, startY)] = Math.abs(endX - startX) + Math.abs(endY - startY);
    open.push({ x: startX, y: startY, f: fScore[key(startX, startY)] });
    while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);
        const current = open.shift();
        if (current.x === endX && current.y === endY) {
            let path = [{x: endX, y: endY}];
            let currKey = key(endX, endY);
            while (cameFrom[currKey]) {
                path.push(cameFrom[currKey]);
                currKey = key(cameFrom[currKey].x, cameFrom[currKey].y);
            }
            return path.reverse();
        }
        closed.add(key(current.x, current.y));
        const neighbors = [
            {x: current.x + 1, y: current.y},
            {x: current.x - 1, y: current.y},
            {x: current.x, y: current.y + 1},
            {x: current.x, y: current.y - 1}
        ];
        for (const n of neighbors) {
            if (!isTileValidAndFree(n.x, n.y, entity, player, boss)) continue;
            const nKey = key(n.x, n.y);
            if (closed.has(nKey)) continue;
            const tentativeG = gScore[key(current.x, current.y)] + 1;
            if (gScore[nKey] === undefined || tentativeG < gScore[nKey]) {
                cameFrom[nKey] = {x: current.x, y: current.y};
                gScore[nKey] = tentativeG;
                fScore[nKey] = tentativeG + Math.abs(endX - n.x) + Math.abs(endY - n.y);
                if (!open.some(o => o.x === n.x && o.y === n.y)) {
                    open.push({x: n.x, y: n.y, f: fScore[nKey]});
                }
            }
        }
    }
    return null;
}

// Animation de déplacement sur chemin
export function animateEntityPath(entity, path, animateEntityMove, onComplete) {
    if (!path || path.length < 2) { if (onComplete) onComplete(); return; }
    let i = 1;
    function stepToNext() {
        if (i >= path.length) { if (onComplete) onComplete(); return; }
        animateEntityMove(entity, path[i].x, path[i].y, 1, () => {
            i++;
            stepToNext();
        });
    }
    stepToNext();
}