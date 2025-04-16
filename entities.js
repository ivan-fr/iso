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

export const player = {
    gridX: 2,
    gridY: 2,
    size: 28,
    hp: 100,
    maxHp: 100,
    mp: 6,
    ap: 2,
    screenX: null,
    screenY: null
};

export const boss = {
    gridX: GRID_COLS - 3,
    gridY: GRID_ROWS - 3,
    size: 36,
    hp: 150,
    maxHp: 150,
    mp: 6,
    ap: 2,
    screenX: null,
    screenY: null
};

// --- Bouftou mobs ---
export const bouftous = [
    {
        id: 1,
        gridX: 4,
        gridY: 11,
        size: 26,
        hp: 40,
        maxHp: 40,
        mp: 4,
        ap: 1,
        screenX: null,
        screenY: null,
        image: 'bouftou.png',
        aiType: 'bouftou',
    },
    {
        id: 2,
        gridX: 11,
        gridY: 4,
        size: 26,
        hp: 40,
        maxHp: 40,
        mp: 4,
        ap: 1,
        screenX: null,
        screenY: null,
        image: 'bouftou.png',
        aiType: 'bouftou',
    }
];

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