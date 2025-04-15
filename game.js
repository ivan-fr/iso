const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const endTurnButton = document.getElementById('endTurnButton');
const bossHealthBar = document.getElementById('boss-health-bar');
const playerHealthBar = document.getElementById('player-health-bar');
const messageBox = document.getElementById('messageBox');
const turnIndicator = document.getElementById('turn-indicator');
const playerApDisplay = document.getElementById('player-ap');
const playerMpDisplay = document.getElementById('player-mp');
const bossApDisplay = document.getElementById('boss-ap');
const bossMpDisplay = document.getElementById('boss-mp');

// --- Configuration ---
const TILE_W = 40; const TILE_H = TILE_W / 2;
const GRID_COLS = 14; const GRID_ROWS = 14;
const MAP_OFFSET_X = canvas.width / 2; const MAP_OFFSET_Y = TILE_H * 4;
const PROJECTILE_SPEED = 8;
const PLAYER_ATTACK_DAMAGE = 15; const BOSS_ATTACK_DAMAGE = 10;
const BOSS_MAX_HP = 150; const PLAYER_MAX_HP = 100;
const MAX_MOVE_POINTS = 6; const MAX_ACTION_POINTS = 2;
const PLAYER_ATTACK_RANGE = 7; const BOSS_ATTACK_RANGE = 5;
const BOSS_ATTACK_RANGE_SQ = BOSS_ATTACK_RANGE * BOSS_ATTACK_RANGE;

// --- MapGrid amélioré : obstacles symétriques en forme de L inversés ---
const mapGrid = Array.from({ length: GRID_ROWS }, (_, y) =>
    Array.from({ length: GRID_COLS }, (_, x) => {
        // Position des obstacles en L inversés
        const isTopLeftL = (x === 3 && y >= 3 && y <= 5) || (y === 3 && x >= 3 && x <= 5);
        const isTopRightL = (x === GRID_COLS-4 && y >= 3 && y <= 5) || (y === 3 && x >= GRID_COLS-6 && x <= GRID_COLS-4);
        const isBottomLeftL = (x === 3 && y >= GRID_ROWS-6 && y <= GRID_ROWS-4) || (y === GRID_ROWS-4 && x >= 3 && x <= 5);
        const isBottomRightL = (x === GRID_COLS-4 && y >= GRID_ROWS-6 && y <= GRID_ROWS-4) || (y === GRID_ROWS-4 && x >= GRID_COLS-6 && x <= GRID_COLS-4);
        
        return isTopLeftL || isTopRightL || isBottomLeftL || isBottomRightL ? 1 : 0;
    })
);

// --- Entités principales ---
const player = {
    gridX: 2,
    gridY: 2,
    size: 28,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    mp: MAX_MOVE_POINTS,
    ap: MAX_ACTION_POINTS,
    screenX: null,
    screenY: null
};

const boss = {
    gridX: GRID_COLS - 3,
    gridY: GRID_ROWS - 3,
    size: 36,
    hp: BOSS_MAX_HP,
    maxHp: BOSS_MAX_HP,
    mp: MAX_MOVE_POINTS,
    ap: MAX_ACTION_POINTS,
    screenX: null,
    screenY: null
};

// --- Variables d'état globales ---
let currentTurn = 'player';
let playerState = 'idle';
let reachableTiles = [];
let attackableTiles = [];
let isMoving = false;
let isBossActing = false;
let gameOver = false;
let projectiles = [];

// --- Sorts ---
const SPELLS = [
    {
        name: 'Mono-cible',
        key: '1',
        color: '#f1c40f',
        damage: () => 22 + Math.floor(Math.random() * 7), // 22-28
        range: PLAYER_ATTACK_RANGE,
        aoe: false,
        push: false
    },
    {
        name: 'Zone croix',
        key: '2',
        color: '#e67e22',
        damage: () => 10 + Math.floor(Math.random() * 6), // 10-15
        range: PLAYER_ATTACK_RANGE,
        aoe: true,
        push: false
    },
    {
        name: 'Poussée',
        key: '3',
        color: '#00b894',
        damage: () => 8 + Math.floor(Math.random() * 5), // 8-12
        range: PLAYER_ATTACK_RANGE,
        aoe: false,
        push: true
    }
];
let selectedSpell = 0;

// --- Sélection de sort via SVG ---
function updateSpellBarSelection() {
    for (let i = 0; i < 3; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (btn) {
            btn.style.outline = (i === selectedSpell) ? '3px solid #fff' : 'none';
            btn.style.background = (i === selectedSpell) ? 'rgba(255,255,255,0.12)' : 'none';
        }
    }
}
for (let i = 0; i < 3; i++) {
    const btn = document.getElementById('spell-btn-' + i);
    if (btn) {
        btn.addEventListener('click', function() {
            selectedSpell = i;
            updateSpellBarSelection();
            showMessage(`Sort sélectionné : ${SPELLS[selectedSpell].name}`);
            updateUI();
        });
    }
}
// Appel initial pour la surbrillance
updateSpellBarSelection();

// --- Image de tuile ---
const tileImage = new Image();
let damageAnimations = [];

// --- UI State for Hover ---
let hoveredTile = null;

// --- Image Loading ---
const bossImage = new Image();
let bossImageLoaded = false;
const playerImage = new Image();
let playerImageLoaded = false;
bossImage.src = 'br.png'; // Remplacez par le chemin de votre image de boss
bossImage.onload = () => { bossImageLoaded = true; console.log("Image du boss chargée : " + bossImage.src); };
bossImage.onerror = () => { console.warn("ERREUR: Impossible de charger l'image du boss depuis : " + bossImage.src + ". Vérifiez le chemin/URL. Utilisation du cercle rouge par défaut."); };
playerImage.src = 'iop.png';
playerImage.onload = () => { playerImageLoaded = true; console.log("Image du joueur chargée : " + playerImage.src); };
playerImage.onerror = () => { console.warn("ERREUR: Impossible de charger l'image du joueur depuis : " + playerImage.src + ". Vérifiez le chemin/URL. Utilisation du cercle bleu par défaut."); }

// --- Utility Functions ---
function isoToScreen(gridX, gridY) { const screenX = MAP_OFFSET_X + (gridX - gridY) * (TILE_W / 2); const screenY = MAP_OFFSET_Y + (gridX + gridY) * (TILE_H / 2); return { x: screenX, y: screenY }; }
function screenToIso(screenX, screenY) { const adjustedX = screenX - MAP_OFFSET_X; const adjustedY = screenY - MAP_OFFSET_Y; const gridX = Math.round((adjustedX / (TILE_W / 2) + adjustedY / (TILE_H / 2)) / 2); const gridY = Math.round((adjustedY / (TILE_H / 2) - adjustedX / (TILE_W / 2)) / 2); return { x: Math.max(0, Math.min(GRID_COLS - 1, gridX)), y: Math.max(0, Math.min(GRID_ROWS - 1, gridY)) }; }
function showMessage(text, duration = 2000) { messageBox.textContent = text; messageBox.classList.add('show'); clearTimeout(messageBox.timer); messageBox.timer = setTimeout(() => { messageBox.classList.remove('show'); }, duration); }
function updateHealthBar(barElement, currentHp, maxHp) { const healthPercentage = Math.max(0, (currentHp / maxHp) * 100); barElement.style.width = `${healthPercentage}%`; if (healthPercentage < 30) barElement.style.backgroundColor = '#e74c3c'; else if (healthPercentage < 60) barElement.style.backgroundColor = '#f39c12'; else { if (barElement.id === 'player-health-bar') barElement.style.backgroundColor = '#3498db'; else barElement.style.backgroundColor = '#2ecc71'; } }
function updateUI() { turnIndicator.textContent = currentTurn === 'player' ? 'Joueur' : 'Boss'; playerApDisplay.textContent = player.ap; playerMpDisplay.textContent = player.mp; bossApDisplay.textContent = boss.ap; bossMpDisplay.textContent = boss.mp; updateHealthBar(playerHealthBar, player.hp, player.maxHp); updateHealthBar(bossHealthBar, boss.hp, boss.maxHp); endTurnButton.disabled = isMoving || isBossActing || currentTurn !== 'player' || playerState !== 'idle' || gameOver; if (gameOver) canvas.style.cursor = 'default'; else if (currentTurn !== 'player' || isBossActing) canvas.style.cursor = 'default'; else if (playerState === 'aiming') canvas.style.cursor = 'crosshair'; else if (playerState === 'idle') canvas.style.cursor = 'pointer'; else canvas.style.cursor = 'default'; }
function isTileValidAndFree(x, y, movingEntity) { if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return false; if (mapGrid[y][x] === 1) return false; if (movingEntity) { const otherEntity = movingEntity === player ? boss : player; if (x === otherEntity.gridX && y === otherEntity.gridY) return false; } return true; }
function getTilesInRangeBFS(startX, startY, maxRange, entityCheckBlocking = null) { let visited = new Set(); let queue = [{ x: startX, y: startY, cost: 0 }]; let reachable = []; visited.add(`${startX},${startY}`); if (!entityCheckBlocking) { reachable.push({ x: startX, y: startY, cost: 0 }); } while (queue.length > 0) { const current = queue.shift(); if (entityCheckBlocking && current.cost > 0) { reachable.push(current); } if (current.cost >= maxRange) continue; const neighbors = [{ x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y }, { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 }]; for (const neighbor of neighbors) { const key = `${neighbor.x},${neighbor.y}`; if (!visited.has(key) && isTileValidAndFree(neighbor.x, neighbor.y, entityCheckBlocking)) { visited.add(key); const nextCost = current.cost + 1; queue.push({ x: neighbor.x, y: neighbor.y, cost: nextCost }); if (!entityCheckBlocking) { reachable.push({ x: neighbor.x, y: neighbor.y, cost: nextCost }); } } } } return reachable; }

// --- Line of Sight Function (Corrected Structure) ---
function hasLineOfSight(startX, startY, endX, endY) {
    let x1 = startX;
    let y1 = startY;
    const x2 = endX;
    const y2 = endY;
    const dx = Math.abs(x2 - x1);
    const dy = -Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx + dy; // error value e_xy

    while (true) {
        // Check intermediate cell (x1, y1) - skip start, allow end
        if (x1 !== startX || y1 !== startY) { // Don't check the start cell itself
            if (x1 === endX && y1 === endY) break; // Reached end cell, stop checking

            // Check current cell for obstacle
            if (x1 >= 0 && x1 < GRID_COLS && y1 >= 0 && y1 < GRID_ROWS) {
                if (mapGrid[y1][x1] === 1) {
                    return false; // Obstacle found in path
                }
            } else {
                return false; // Path goes out of bounds
            }
        }

        // Check if we somehow passed the end point (shouldn't happen with break condition)
        // This check might be redundant with the initial break but adds safety
        if (x1 === endX && y1 === endY) break;


        const e2 = 2 * err;
        if (e2 >= dy) { // e_xy+e_x > 0
            if (x1 === endX) break; // Prevent overshooting on X axis if already at Y target
            err += dy;
            x1 += sx;
        }
        if (e2 <= dx) { // e_xy+e_y < 0
            if (y1 === endY) break; // Prevent overshooting on Y axis if already at X target
            err += dx;
            y1 += sy;
        }
    }
    return true; // No obstacles found between start (exclusive) and end (inclusive)
}

// --- Pathfinding (A*) ---
function findPath(startX, startY, endX, endY, entity) {
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
            // Reconstituer le chemin
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
            if (!isTileValidAndFree(n.x, n.y, entity)) continue;
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
    return null; // Pas de chemin trouvé
}

// --- Animation de déplacement sur chemin ---
function animateEntityPath(entity, path, onComplete) {
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

// --- Damage Animation ---
function showDamageAnimation(x, y, value, color = '#ffec3d') {
    damageAnimations.push({
        x,
        y,
        value,
        color,
        alpha: 1,
        time: 0,
        duration: 900 // ms
    });
}

function drawDamageAnimations() {
    for (let i = damageAnimations.length - 1; i >= 0; i--) {
        const anim = damageAnimations[i];
        const t = anim.time / anim.duration;
        const yOffset = -30 - 30 * t;
        ctx.save();
        ctx.globalAlpha = anim.alpha * (1 - t);
        ctx.font = 'bold 20px "Press Start 2P", Arial';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.strokeText(`-${anim.value}`, anim.x, anim.y + yOffset);
        ctx.fillStyle = anim.color;
        ctx.fillText(`-${anim.value}`, anim.x, anim.y + yOffset);
        ctx.restore();
        anim.time += 16;
        if (anim.time > anim.duration) damageAnimations.splice(i, 1);
    }
}

// --- Drawing ---
function drawTile(gridX, gridY, type, highlightColor = null) {
    const pos = isoToScreen(gridX, gridY);
    ctx.save();
    ctx.translate(Math.round(pos.x), Math.round(pos.y));

    // --- Effet 3D : base et "sous la terre" ---
    if (type !== 1) {
        const depth = 12; // profondeur de l'effet 3D
        // Détermine si la case est en bordure ou voisine d'un obstacle
        const isBottomEdge = gridY === GRID_ROWS - 1 || mapGrid[gridY + 1]?.[gridX] === 1;
        const isLeftEdge = gridX === 0 || mapGrid[gridY][gridX - 1] === 1;
        const isRightEdge = gridX === GRID_COLS - 1 || mapGrid[gridY][gridX + 1] === 1;

        // Dessine d'abord les faces latérales
        if (isLeftEdge) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(-TILE_W / 2, 0);
            ctx.lineTo(-TILE_W / 2, depth);
            ctx.lineTo(0, TILE_H / 2 + depth);
            ctx.lineTo(0, TILE_H / 2);
            ctx.closePath();
            ctx.fillStyle = '#8B4513'; // marron plus foncé pour la face gauche
            ctx.globalAlpha = 0.6;
            ctx.fill();
            ctx.restore();
        }

        if (isRightEdge) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(TILE_W / 2, 0);
            ctx.lineTo(TILE_W / 2, depth);
            ctx.lineTo(0, TILE_H / 2 + depth);
            ctx.lineTo(0, TILE_H / 2);
            ctx.closePath();
            ctx.fillStyle = '#8B4513'; // marron plus foncé pour la face droite
            ctx.globalAlpha = 0.5;
            ctx.fill();
            ctx.restore();
        }

        if (isBottomEdge) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(-TILE_W / 2, 0);
            ctx.lineTo(0, TILE_H / 2);
            ctx.lineTo(TILE_W / 2, 0);
            ctx.lineTo(TILE_W / 2, depth);
            ctx.lineTo(0, TILE_H / 2 + depth);
            ctx.lineTo(-TILE_W / 2, depth);
            ctx.closePath();
            ctx.fillStyle = '#8B4513'; // marron plus foncé pour la base
            ctx.globalAlpha = 0.7;
            ctx.fill();
            ctx.restore();
        }
    }

    // Surface de la case
    ctx.beginPath();
    ctx.moveTo(0, -TILE_H / 2);
    ctx.lineTo(TILE_W / 2, 0);
    ctx.lineTo(0, TILE_H / 2);
    ctx.lineTo(-TILE_W / 2, 0);
    ctx.closePath();

    if (type === 1) {
        ctx.fillStyle = '#7f8c8d';
        ctx.shadowColor = '#222';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#434c55';
        ctx.stroke();
    } else {
        ctx.fillStyle = (gridX + gridY) % 2 === 0 ? '#b2f7ef' : '#f7d6e0';
        ctx.shadowColor = '#222';
        ctx.shadowBlur = 2;
        ctx.fill();
    }

    if (highlightColor) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = highlightColor;
        ctx.fill();
    }

    ctx.restore();
}

function drawGrid() {
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            let highlight = null;
            // Highlight portée déplacement
            if (playerState === 'idle' && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                highlight = 'rgba(46,204,113,0.18)';
            } else if (playerState === 'aiming' && attackableTiles.some(t => t.x === x && t.y === y)) {
                highlight = 'rgba(52,152,219,0.18)';
            }
            // Effet hover déplacement
            if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
                if (playerState === 'idle' && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                    highlight = 'rgba(46,204,113,0.45)';
                } else if (playerState === 'aiming' && attackableTiles.some(t => t.x === x && t.y === y)) {
                    highlight = 'rgba(52,152,219,0.45)';
                } else {
                    highlight = 'rgba(255,255,255,0.25)';
                }
            }
            // Effet zone d'effet du sort si hover en mode visée
            if (playerState === 'aiming' && hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
                const spell = SPELLS[selectedSpell];
                if (spell.aoe) {
                    // Zone croix
                    const aoeTiles = [
                        {x: x, y: y},
                        {x: x+1, y: y},
                        {x: x-1, y: y},
                        {x: x, y: y+1},
                        {x: x, y: y-1}
                    ];
                    for (const tile of aoeTiles) {
                        if (tile.x >= 0 && tile.x < GRID_COLS && tile.y >= 0 && tile.y < GRID_ROWS) {
                            drawTile(tile.x, tile.y, mapGrid[tile.y][tile.x], 'rgba(230, 126, 34, 0.35)');
                        }
                    }
                } else if (spell.push) {
                    // Affiche la case cible et la trajectoire de poussée
                    let dx = x - player.gridX;
                    let dy = y - player.gridY;
                    if (dx === 0 && dy === 0) { dx = 1; dy = 0; }
                    if (Math.abs(dx) > Math.abs(dy)) { dx = Math.sign(dx); dy = 0; }
                    else if (Math.abs(dy) > Math.abs(dx)) { dy = Math.sign(dy); dx = 0; }
                    else if (dx !== 0) { dx = Math.sign(dx); dy = 0; }
                    else if (dy !== 0) { dy = Math.sign(dy); dx = 0; }
                    let pushX = x, pushY = y;
                    for (let step = 0; step < 2; step++) {
                        const nextPushX = pushX + dx;
                        const nextPushY = pushY + dy;
                        if (
                            nextPushX < 0 || nextPushX >= GRID_COLS ||
                            nextPushY < 0 || nextPushY >= GRID_ROWS ||
                            mapGrid[nextPushY]?.[nextPushX] === 1
                        ) break;
                        drawTile(nextPushX, nextPushY, mapGrid[nextPushY][nextPushX], 'rgba(0,184,148,0.35)');
                        pushX = nextPushX; pushY = nextPushY;
                    }
                }
            }
            drawTile(x, y, mapGrid[y][x], highlight);
        }
    }
}

function drawHighlightTiles() { if (currentTurn !== 'player' || isMoving || isBossActing || gameOver) return; const highlightLayer = (tileX, tileY, color) => { const pos = isoToScreen(tileX, tileY); ctx.save(); ctx.translate(pos.x, pos.y); ctx.beginPath(); ctx.moveTo(0, -TILE_H / 2); ctx.lineTo(TILE_W / 2, 0); ctx.lineTo(0, TILE_H / 2); ctx.lineTo(-TILE_W / 2, 0); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore(); }; if (playerState === 'idle') { reachableTiles.forEach(tile => { if (tile.cost <= player.mp) { highlightLayer(tile.x, tile.y, 'rgba(46, 204, 113, 0.5)'); } }); } else if (playerState === 'aiming') { attackableTiles.forEach(tile => { highlightLayer(tile.x, tile.y, 'rgba(52, 152, 219, 0.5)'); }); } } 
function drawEntity(entity, color) {
    let screenX = (typeof entity.screenX === 'number') ? entity.screenX : isoToScreen(entity.gridX, entity.gridY).x;
    let screenY = (typeof entity.screenY === 'number') ? entity.screenY : isoToScreen(entity.gridX, entity.gridY).y;
    entity.screenX = screenX;
    entity.screenY = screenY;

    // Ombre améliorée - plus proche des pieds et plus naturelle
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    const shadowOffsetY = 6; // Réduit l'offset vertical de l'ombre
    const shadowScaleX = 0.8; // Élargit légèrement l'ombre
    const shadowScaleY = 0.3; // Aplatit l'ombre pour la perspective
    ctx.ellipse(
        screenX,
        screenY + shadowOffsetY,
        entity.size * shadowScaleX,
        entity.size * shadowScaleY,
        0,
        0,
        Math.PI * 2
    );
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    // Dessine l'entité
    if (entity === boss && bossImageLoaded) {
        const imgWidth = TILE_W * 1.2;
        const imgHeight = bossImage.height * (imgWidth / bossImage.width);
        const drawX = screenX - imgWidth / 2;
        const drawY = screenY - imgHeight + (TILE_H / 2);
        ctx.drawImage(bossImage, drawX, drawY, imgWidth, imgHeight);
    } else if (entity === player && playerImageLoaded) {
        const imgWidth = TILE_W * 0.9;
        const imgHeight = playerImage.height * (imgWidth / playerImage.width);
        const drawX = screenX - imgWidth / 2;
        const drawY = screenY - imgHeight + (TILE_H / 2);
        ctx.drawImage(playerImage, drawX, drawY, imgWidth, imgHeight);
    } else {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(screenX, screenY - entity.size / 2, entity.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // Effet de surbrillance pour le tour actuel
    if ((entity === player && currentTurn === 'player') || (entity === boss && currentTurn === 'boss')) {
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.12 * Math.abs(Math.sin(Date.now() / 300));
        ctx.beginPath();
        ctx.arc(screenX, screenY - entity.size / 2, entity.size * 0.9, 0, Math.PI * 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    // Effet pulse sur le joueur actif
    if (entity === player && currentTurn === 'player') {
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.12 * Math.abs(Math.sin(Date.now() / 300));
        ctx.beginPath();
        ctx.arc(screenX, screenY - entity.size / 2, entity.size * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
        ctx.restore();
    }
}
function drawProjectiles() { projectiles.forEach(p => { ctx.fillStyle = p.owner === 'player' ? '#f1c40f' : '#e74c3c'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill(); }); }

// --- UI Sorts ---
function drawSpellUI() {
    ctx.save();
    ctx.font = 'bold 13px "Press Start 2P", Arial';
    ctx.textAlign = 'left';
    ctx.globalAlpha = 0.92;
    for (let i = 0; i < SPELLS.length; i++) {
        const spell = SPELLS[i];
        ctx.fillStyle = i === selectedSpell ? spell.color : '#888';
        ctx.fillRect(12 + i * 120, 8, 110, 32);
        ctx.fillStyle = '#222';
        ctx.fillText(`${spell.key}: ${spell.name}`, 20 + i * 120, 30);
    }
    ctx.restore();
}

// --- Game Logic ---
function startPlayerTurn() { currentTurn = 'player'; playerState = 'idle'; player.mp = MAX_MOVE_POINTS; player.ap = MAX_ACTION_POINTS; reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player); attackableTiles = []; isBossActing = false; updateUI(); showMessage("Tour du Joueur", 1500); }
async function startBossTurn() { currentTurn = 'boss'; playerState = 'idle'; boss.mp = MAX_MOVE_POINTS; boss.ap = MAX_ACTION_POINTS; reachableTiles = []; attackableTiles = []; isBossActing = true; updateUI(); showMessage("Tour du Boss", 1500); await executeBossAI(); if (!gameOver) { endTurn(); } else { updateUI(); } }
async function executeBossAI() {
    // Attaque (si possible)
    for (let i = 0; i < MAX_ACTION_POINTS; i++) {
        if (gameOver || boss.ap <= 0) break;
        const dx = boss.gridX - player.gridX;
        const dy = boss.gridY - player.gridY;
        const distToPlayerSq = dx * dx + dy * dy;
        if (distToPlayerSq <= BOSS_ATTACK_RANGE_SQ) {
            if (hasLineOfSight(boss.gridX, boss.gridY, player.gridX, player.gridY)) {
                bossAttackPlayer();
                updateUI();
                await delay(800);
            } else {
                showMessage("Le boss ne vous voit pas !", 1500);
                break;
            }
        } else {
            break;
        }
    }
    // Déplacement (si possible)
    const currentDistToPlayer = Math.abs(boss.gridX - player.gridX) + Math.abs(boss.gridY - player.gridY);
    if (!gameOver && boss.mp > 0 && currentDistToPlayer > 1) {
        const bossReachable = getTilesInRangeBFS(boss.gridX, boss.gridY, boss.mp, boss);
        let bestTile = null;
        let minCost = Infinity;
        let minDistToPlayerHeuristic = Infinity;
        for (const tile of bossReachable) {
            const dHeuristic = Math.abs(tile.x - player.gridX) + Math.abs(tile.y - player.gridY);
            if (dHeuristic < minDistToPlayerHeuristic) {
                minDistToPlayerHeuristic = dHeuristic;
                bestTile = tile;
                minCost = tile.cost;
            } else if (dHeuristic === minDistToPlayerHeuristic && tile.cost < minCost) {
                bestTile = tile;
                minCost = tile.cost;
            }
        }
        if (bestTile) {
            // Attendre la fin de l'animation de déplacement
            await new Promise(resolve => {
                moveEntityTo(boss, bestTile.x, bestTile.y, minCost);
                // Vérifier périodiquement si l'animation est terminée
                function waitMove() {
                    if (!isMoving) resolve();
                    else setTimeout(waitMove, 10);
                }
                waitMove();
            });
            showMessage(`Boss se déplace vers (${bestTile.x}, ${bestTile.y})`, 1500);
            updateUI();
            await delay(800);
        }
    }
    isBossActing = false;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function endTurn() {
    if (isMoving || isBossActing || gameOver || playerState !== 'idle') return; if (currentTurn === 'player') startBossTurn(); else startPlayerTurn();
}

// Ajout d'une fonction pour animer le déplacement d'une entité
function animateEntityMove(entity, targetGridX, targetGridY, cost, onComplete) {
    isMoving = true;
    const start = isoToScreen(entity.gridX, entity.gridY);
    const end = isoToScreen(targetGridX, targetGridY);
    const duration = 250 + 100 * cost; // durée en ms selon la distance
    const startTime = performance.now();
    function step(now) {
        const t = Math.min(1, (now - startTime) / duration);
        entity.screenX = start.x + (end.x - start.x) * t;
        entity.screenY = start.y + (end.y - start.y) * t;
        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            entity.gridX = targetGridX;
            entity.gridY = targetGridY;
            const final = isoToScreen(targetGridX, targetGridY);
            entity.screenX = final.x;
            entity.screenY = final.y;
            isMoving = false;
            if (onComplete) onComplete();
        }
    }
    requestAnimationFrame(step);
}

// Correction de moveEntityTo pour autoriser la poussée du boss même si le joueur n'est pas en idle
function moveEntityTo(entity, targetGridX, targetGridY, cost, forceMove = false) {
    if (isMoving || cost > entity.mp || gameOver || (entity === player && playerState !== 'idle' && !forceMove)) return;
    entity.mp -= cost;
    const path = findPath(entity.gridX, entity.gridY, targetGridX, targetGridY, entity);
    if (path && path.length > 1) {
        isMoving = true;
        animateEntityPath(entity, path, () => {
            if (entity === player) {
                reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player);
            }
            isMoving = false;
            updateUI();
        });
    } else {
        // Pas de chemin, déplacement instantané (sécurité)
        entity.gridX = targetGridX;
        entity.gridY = targetGridY;
        const final = isoToScreen(targetGridX, targetGridY);
        entity.screenX = final.x;
        entity.screenY = final.y;
        if (entity === player) {
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player);
        }
        updateUI();
    }
}

function playerAttack(targetGridX, targetGridY) {
    player.ap--;
    updateUI();
    const spell = SPELLS[selectedSpell];
    const startX = player.screenX;
    const startY = player.screenY - player.size / 2;
    const targetPos = isoToScreen(targetGridX, targetGridY);
    const targetX = targetPos.x;
    const targetY = targetPos.y;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const projectileDx = (dx / dist) * PROJECTILE_SPEED;
    const projectileDy = (dy / dist) * PROJECTILE_SPEED;
    // Ajoute le type de sort et ses infos au projectile
    projectiles.push({
        x: startX,
        y: startY,
        dx: projectileDx,
        dy: projectileDy,
        owner: 'player',
        targetScreenX: targetX,
        targetScreenY: targetY,
        targetGridX,
        targetGridY,
        spellIndex: selectedSpell,
        spellData: spell
    });
    showMessage(`Sort lancé : ${spell.name}`, 1000);
}

function bossAttackPlayer() {
    if (boss.ap <= 0 || gameOver) return; boss.ap--; const startX = boss.screenX; const startY = boss.screenY - boss.size / 2; const playerScreenPos = isoToScreen(player.gridX, player.gridY); player.screenX = playerScreenPos.x; player.screenY = playerScreenPos.y; const targetX = player.screenX; const targetY = player.screenY - player.size / 2; const dx = targetX - startX; const dy = targetY - startY; const dist = Math.sqrt(dx * dx + dy * dy); if (dist === 0) return; const projectileDx = (dx / dist) * PROJECTILE_SPEED; const projectileDy = (dy / dist) * PROJECTILE_SPEED; projectiles.push({ x: startX, y: startY, dx: projectileDx, dy: projectileDy, owner: 'boss', targetScreenX: targetX, targetScreenY: targetY }); showMessage("Le Boss attaque !", 1000);
}

function updateProjectiles() {
    if (gameOver) return;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        const nextX = p.x + p.dx;
        const nextY = p.y + p.dy;
        // Sorts du joueur
        if (p.owner === 'player' && p.targetGridX !== undefined && p.targetGridY !== undefined) {
            const remainingDistX = p.targetScreenX - p.x;
            const remainingDistY = p.targetScreenY - p.y;
            const dotProduct = remainingDistX * p.dx + remainingDistY * p.dy;
            const remainingDist = Math.sqrt(remainingDistX ** 2 + remainingDistY ** 2);
            const moveDist = Math.sqrt(p.dx ** 2 + p.dy ** 2);
            if (dotProduct < 0 || remainingDist <= moveDist + 1) {
                const spell = p.spellData;
                // --- Sort mono-cible ---
                if (p.spellIndex === 0) {
                    if (boss.gridX === p.targetGridX && boss.gridY === p.targetGridY) {
                        const dmg = spell.damage();
                        boss.hp -= dmg;
                        showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                        showMessage(`Boss touché ! (-${dmg} HP)`, 1000);
                        if (boss.hp <= 0) { boss.hp = 0; showMessage("Boss Vaincu ! VICTOIRE !", 5000); gameOver = true; }
                        updateUI();
                    }
                }
                // --- Sort zone croix ---
                else if (p.spellIndex === 1) {
                    const affected = [
                        {x: p.targetGridX, y: p.targetGridY},
                        {x: p.targetGridX+1, y: p.targetGridX},
                        {x: p.targetGridX-1, y: p.targetGridX},
                        {x: p.targetGridX, y: p.targetGridY+1},
                        {x: p.targetGridX, y: p.targetGridY-1}
                    ];
                    for (const tile of affected) {
                        if (boss.gridX === tile.x && boss.gridY === tile.y) {
                            const dmg = spell.damage();
                            boss.hp -= dmg;
                            showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                            showMessage(`Boss touché (zone) ! (-${dmg} HP)`, 1000);
                            if (boss.hp <= 0) { boss.hp = 0; showMessage("Boss Vaincu ! VICTOIRE !", 5000); gameOver = true; }
                            updateUI();
                        }
                    }
                }
                // --- Sort poussée (pousse de 2 cases) ---
                else if (p.spellIndex === 2) {
                    // Mono-cible strict : ne pousse que si le boss est exactement sur la case ciblée
                    if (boss.gridX === p.targetGridX && boss.gridY === p.targetGridY) {
                        const dmg = spell.damage();
                        boss.hp -= dmg;
                        showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                        // Calcul direction de poussée consolidé
                        let dx = p.targetGridX - player.gridX;
                        let dy = p.targetGridY - player.gridY;
                        // Si le joueur vise la case du boss ou une case adjacente sans direction claire
                        if (dx === 0 && dy === 0) {
                            // Prend la direction boss -> joueur si possible
                            dx = boss.gridX - player.gridX;
                            dy = boss.gridY - player.gridY;
                        }
                        // Si toujours pas de direction, pousse à droite par défaut
                        if (dx === 0 && dy === 0) dx = 1;
                        // Privilégie la direction dominante (axe principal)
                        if (Math.abs(dx) > Math.abs(dy)) {
                            dx = Math.sign(dx);
                            dy = 0;
                        } else if (Math.abs(dy) > Math.abs(dx)) {
                            dy = Math.sign(dy);
                            dx = 0;
                        } else if (dx !== 0) {
                            dx = Math.sign(dx);
                            dy = 0;
                        } else if (dy !== 0) {
                            dy = Math.sign(dy);
                            dx = 0;
                        }
                        let pushX = boss.gridX;
                        let pushY = boss.gridY;
                        let collision = false;
                        let pushed = false;
                        for (let step = 0; step < 2; step++) {
                            const nextPushX = pushX + dx;
                            const nextPushY = pushY + dy;
                            // Vérifie si la case suivante est libre (pas d'obstacle, pas hors map, pas sur le joueur)
                            if (
                                nextPushX < 0 || nextPushX >= GRID_COLS ||
                                nextPushY < 0 || nextPushY >= GRID_ROWS ||
                                mapGrid[nextPushY]?.[nextPushX] === 1 ||
                                (player.gridX === nextPushX && player.gridY === nextPushY)
                            ) {
                                collision = true;
                                break;
                            }
                            pushX = nextPushX;
                            pushY = nextPushY;
                            pushed = true;
                        }
                        if (pushed && !collision && (pushX !== boss.gridX || pushY !== boss.gridY)) {
                            // On pousse le boss (ne pas décrémenter mp du boss)
                            boss.mp += 1; // pour éviter la décrémentation dans moveEntityTo
                            moveEntityTo(boss, pushX, pushY, 0, true);
                        } else if (collision) {
                            // Dégâts de collision
                            const bonus = 10 + Math.floor(Math.random() * 6); // 10-15
                            boss.hp -= bonus;
                            showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, bonus, '#d63031');
                            showMessage(`Dégâts de collision ! (-${bonus} HP)`, 1000);
                        }
                        if (boss.hp <= 0) { boss.hp = 0; showMessage("Boss Vaincu ! VICTOIRE !", 5000); gameOver = true; }
                        updateUI();
                    }
                }
                projectiles.splice(i, 1);
                continue;
            }
            p.x = nextX;
            p.y = nextY;
            continue;
        }
        // Gestion correcte des projectiles du boss (suppression à l'arrivée, détection robuste)
        if (p.owner === 'boss') {
            let targetEntity = player;
            // Utilise la position réelle ET la position grille pour la collision
            const targetScreenPos = isoToScreen(targetEntity.gridX, targetEntity.gridY);
            let collisionCheckX = (typeof targetEntity.screenX === 'number') ? targetEntity.screenX : targetScreenPos.x;
            let collisionCheckY = (typeof targetEntity.screenY === 'number') ? targetEntity.screenY : targetScreenPos.y - targetEntity.size / 2;
            const distToTarget = Math.sqrt(Math.pow(p.x - collisionCheckX, 2) + Math.pow(p.y - (collisionCheckY - targetEntity.size / 2), 2));
            // Collision si très proche de la position réelle OU de la position grille
            if (distToTarget < targetEntity.size * 0.7) {
                targetEntity.hp -= BOSS_ATTACK_DAMAGE;
                showDamageAnimation(collisionCheckX, collisionCheckY - targetEntity.size / 2, BOSS_ATTACK_DAMAGE, '#e74c3c');
                projectiles.splice(i, 1);
                showMessage(`Joueur touché ! (-${BOSS_ATTACK_DAMAGE} HP)`, 1000);
                if (player.hp <= 0) {
                    player.hp = 0;
                    showMessage("Joueur Vaincu ! GAME OVER", 5000);
                    gameOver = true;
                }
                updateUI();
                continue;
            }
            const remainingDistX = p.targetScreenX - p.x;
            const remainingDistY = p.targetScreenY - p.y;
            const dotProduct = remainingDistX * p.dx + remainingDistY * p.dy;
            const remainingDist = Math.sqrt(remainingDistX ** 2 + remainingDistY ** 2);
            const moveDist = Math.sqrt(p.dx ** 2 + p.dy ** 2);
            if (dotProduct < 0 || remainingDist <= moveDist + 1) {
                projectiles.splice(i, 1);
                continue;
            }
            p.x = nextX;
            p.y = nextY;
        }
    }
}

// --- Amélioration du design général ---
// Ajout d'un fond dégradé dynamique
function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#a8edea');
    grad.addColorStop(1, '#fed6e3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Ajout d'une animation de victoire/défaite
function drawEndGame() {
    if (gameOver) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = player.hp > 0 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
        ctx.font = '32px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#222';
        ctx.shadowBlur = 12;
        ctx.fillText(player.hp > 0 ? "VICTOIRE !" : "GAME OVER", canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }
}

// Ajout d'une bordure arrondie et ombre portée sur le canvas
canvas.style.borderRadius = '18px';
canvas.style.boxShadow = '0 8px 32px 0 rgba(31, 38, 135, 0.37)';
canvas.style.border = '3px solid #fff';

// --- Boucle de rendu améliorée ---
function gameLoop() {
    drawBackground();
    drawGrid();
    drawHighlightTiles();
    const entitiesToDraw = [{ entity: player, color: '#3498db' }, { entity: boss, color: '#c0392b' }];
    entitiesToDraw.sort((a, b) => a.entity.screenY - b.entity.screenY);
    entitiesToDraw.forEach(item => drawEntity(item.entity, item.color));
    drawProjectiles();
    drawDamageAnimations();
    drawSpellUI();
    drawEndGame();
    updateProjectiles();
    requestAnimationFrame(gameLoop);
}

// --- Input Handling ---
function handleKeyDown(e) {
    if (['1','2','3'].includes(e.key)) {
        selectedSpell = parseInt(e.key) - 1;
        showMessage(`Sort sélectionné : ${SPELLS[selectedSpell].name}`);
        updateUI();
        return;
    }
    if (gameOver || currentTurn !== 'player' || isMoving || isBossActing) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (playerState === 'idle' && player.ap > 0) {
            playerState = 'aiming';
            attackableTiles = getTilesInRangeBFS(player.gridX, player.gridY, PLAYER_ATTACK_RANGE, null);
            reachableTiles = [];
            showMessage("Mode Visée: Cliquez case bleue pour tirer (Echap pour annuler)", 3000);
        } else if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player);
            showMessage("Visée annulée", 1500);
        }
        updateUI();
    } else if (e.key === 'Escape') {
        if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player);
            showMessage("Visée annulée", 1500);
            updateUI();
        }
    } else if (e.key.toLowerCase() === 'f') {
        if (playerState === 'idle') {
            endTurn();
        }
    }
}
// Updated handleCanvasClick to include LoS check
function handleCanvasClick(event) {
    if (gameOver || currentTurn !== 'player' || isMoving || isBossActing) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const clickedGrid = screenToIso(clickX, clickY);
    if (playerState === 'idle') {
        const targetTile = reachableTiles.find(tile => tile.x === clickedGrid.x && tile.y === clickedGrid.y && tile.cost <= player.mp);
        if (targetTile) {
            moveEntityTo(player, targetTile.x, targetTile.y, targetTile.cost);
        } else {
            showMessage("Case invalide ou hors de portée.");
        }
    } else if (playerState === 'aiming') {
        const targetTile = attackableTiles.find(tile => tile.x === clickedGrid.x && tile.y === clickedGrid.y);
        if (targetTile) {
            // Check Line of Sight before attacking
            if (hasLineOfSight(player.gridX, player.gridY, targetTile.x, targetTile.y)) {
                playerAttack(targetTile.x, targetTile.y);
            } else {
                showMessage("Obstacle bloque la vue !");
            }
            // Always exit aiming mode after click, whether attack succeeded or not
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player);
        } else {
            // Clicked outside blue tiles - cancel aiming
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player);
            showMessage("Visée annulée (clic hors portée)", 1500);
        }
        updateUI();
    }
}

// Ajout du survol de la souris sur le canvas
canvas.addEventListener('mousemove', function(event) {
    if (gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const grid = screenToIso(mouseX, mouseY);
    hoveredTile = { x: grid.x, y: grid.y };
});
canvas.addEventListener('mouseleave', function() {
    hoveredTile = null;
});

// --- Initialization ---
function init() {
    // Initialisation correcte des positions animées
    const playerPos = isoToScreen(player.gridX, player.gridY);
    player.screenX = playerPos.x;
    player.screenY = playerPos.y;
    const bossPos = isoToScreen(boss.gridX, boss.gridY);
    boss.screenX = bossPos.x;
    boss.screenY = bossPos.y;
    window.addEventListener('keydown', handleKeyDown);
    endTurnButton.addEventListener('click', () => { if (playerState === 'idle') endTurn(); });
    canvas.addEventListener('click', handleCanvasClick);
    updateUI();
    startPlayerTurn();
    showMessage("Bienvenue ! Combattez le boss.", 3000);
    gameLoop();
}

window.addEventListener('DOMContentLoaded', init)
