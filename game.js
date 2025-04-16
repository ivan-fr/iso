import { player, boss } from './entities.js';
import { SPELLS, selectedSpell, setSelectedSpell } from './spells.js';
import { mapGrid, TILE_W, TILE_H, GRID_COLS, GRID_ROWS, MAP_OFFSET_X, MAP_OFFSET_Y, MAX_MOVE_POINTS, MAX_ACTION_POINTS, PLAYER_MAX_HP, BOSS_MAX_HP, PLAYER_ATTACK_RANGE, BOSS_ATTACK_RANGE, BOSS_ATTACK_RANGE_SQ, PROJECTILE_SPEED, hasLineOfSight, getTilesInRangeBFS, isTileValidAndFree, isoToScreen, screenToIso } from './grid.js';
import { showMessage, updateUI } from './ui.js';

// Variables d'état globales
export let currentTurn = 'player';
export let playerState = 'idle';
export let reachableTiles = [];
export let attackableTiles = [];
export let isMoving = false;
export let isBossActing = false;
export let gameOver = false;
export let projectiles = [];
export let hoveredTile = null;
export let damageAnimations = [];

// Helper: update spell bar selection UI
function updateSpellBarSelection() {
    for (let i = 0; i < 3; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (btn) {
            btn.style.outline = (i === selectedSpell) ? '3px solid #fff' : 'none';
            btn.style.background = (i === selectedSpell) ? 'rgba(255,255,255,0.12)' : 'none';
        }
    }
}

function setupSpellBarListeners() {
    for (let i = 0; i < 3; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (btn) {
            btn.addEventListener('click', function() {
                setSelectedSpell(i);
                updateSpellBarSelection();
                showMessage(`Sort sélectionné : ${SPELLS[selectedSpell].name}`);
                updateAllUI();
            });
        }
    }
    updateSpellBarSelection();
}

function updateAllUI() {
    const turnIndicator = document.getElementById('turn-indicator');
    const playerApDisplay = document.getElementById('player-ap');
    const playerMpDisplay = document.getElementById('player-mp');
    const bossApDisplay = document.getElementById('boss-ap');
    const bossMpDisplay = document.getElementById('boss-mp');
    const playerHealthBar = document.getElementById('player-health-bar');
    const bossHealthBar = document.getElementById('boss-health-bar');
    const endTurnButton = document.getElementById('endTurnButton');
    updateUI(
        turnIndicator,
        playerApDisplay,
        playerMpDisplay,
        bossApDisplay,
        bossMpDisplay,
        player,
        boss,
        playerHealthBar,
        bossHealthBar,
        currentTurn,
        isMoving,
        isBossActing,
        playerState,
        endTurnButton,
        gameOver
    );
}

function endTurn() {
    if (isMoving || isBossActing || gameOver || playerState !== 'idle') return;
    if (currentTurn === 'player') startBossTurn();
    else startPlayerTurn();
}

function startPlayerTurn() {
    currentTurn = 'player';
    playerState = 'idle';
    player.mp = MAX_MOVE_POINTS;
    player.ap = MAX_ACTION_POINTS;
    reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
    attackableTiles = [];
    isBossActing = false;
    updateAllUI();
    showMessage('Tour du Joueur', 1500);
}

async function startBossTurn() {
    currentTurn = 'boss';
    playerState = 'idle';
    boss.mp = MAX_MOVE_POINTS;
    boss.ap = MAX_ACTION_POINTS;
    reachableTiles = [];
    attackableTiles = [];
    isBossActing = true;
    updateAllUI();
    showMessage('Tour du Boss', 1500);
    setTimeout(() => { endTurn(); }, 1000); // Dummy boss turn
}

function handleKeyDown(e) {
    if (["1","2","3"].includes(e.key)) {
        setSelectedSpell(parseInt(e.key) - 1);
        updateSpellBarSelection();
        showMessage(`Sort sélectionné : ${SPELLS[selectedSpell].name}`);
        updateAllUI();
        return;
    }
    if (gameOver || currentTurn !== 'player' || isMoving || isBossActing) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (playerState === 'idle' && player.ap > 0) {
            playerState = 'aiming';
            const spell = SPELLS[selectedSpell];
            let allTiles = getTilesInRangeBFS(player.gridX, player.gridY, spell.range ?? PLAYER_ATTACK_RANGE, null, player, boss);
            attackableTiles = allTiles.filter(tile => hasLineOfSight(player.gridX, player.gridY, tile.x, tile.y));
            reachableTiles = [];
            showMessage('Mode Visée: Cliquez case bleue pour tirer (Echap pour annuler)', 3000);
        } else if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
            showMessage('Visée annulée', 1500);
        }
        updateAllUI();
    } else if (e.key === 'Escape') {
        if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
            showMessage('Visée annulée', 1500);
            updateAllUI();
        }
    } else if (e.key.toLowerCase() === 'f') {
        if (playerState === 'idle') {
            endTurn();
        }
    }
}

// Animate entity movement
function animateEntityMove(entity, targetGridX, targetGridY, cost, onComplete) {
    isMoving = true;
    const start = isoToScreen(entity.gridX, entity.gridY);
    const end = isoToScreen(targetGridX, targetGridY);
    const duration = 80 + 40 * cost;
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

function moveEntityTo(entity, targetGridX, targetGridY, cost) {
    if (isMoving || cost > entity.mp || gameOver || (entity === player && playerState !== 'idle')) return;
    entity.mp -= cost;
    // Simple BFS path for now
    const path = [ {x: entity.gridX, y: entity.gridY}, {x: targetGridX, y: targetGridY} ];
    isMoving = true;
    animateEntityPath(entity, path, () => {
        if (entity === player) {
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
        }
        isMoving = false;
        updateAllUI();
    });
}

function showDamageAnimation(x, y, value, color = '#ffec3d') {
    damageAnimations.push({
        x,
        y,
        value,
        color,
        alpha: 1,
        time: 0,
        duration: 900
    });
}

function updateProjectiles() {
    if (gameOver) return;
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.dx;
        p.y += p.dy;
        // Simple collision with boss
        if (p.owner === 'player') {
            const bossScreen = isoToScreen(boss.gridX, boss.gridY);
            const dist = Math.sqrt((p.x - bossScreen.x) ** 2 + (p.y - (bossScreen.y - boss.size / 2)) ** 2);
            if (dist < boss.size * 0.7) {
                boss.hp -= 20; // Dummy damage
                showDamageAnimation(bossScreen.x, bossScreen.y - boss.size / 2, 20, '#f1c40f');
                projectiles.splice(i, 1);
                updateAllUI();
                continue;
            }
        }
        // Remove projectile if out of bounds
        if (p.x < 0 || p.x > 600 || p.y < 0 || p.y > 450) {
            projectiles.splice(i, 1);
        }
    }
}

// Override handleCanvasClick to use animated movement and projectiles
function handleCanvasClick(event) {
    if (gameOver || currentTurn !== 'player' || isMoving || isBossActing) return;
    const canvas = document.getElementById('gameCanvas');
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    let foundEntity = null;
    [player, boss].forEach(entity => {
        const sx = (typeof entity.screenX === 'number') ? entity.screenX : isoToScreen(entity.gridX, entity.gridY).x;
        const sy = (typeof entity.screenY === 'number') ? entity.screenY : isoToScreen(entity.gridX, entity.gridY).y;
        const radius = entity.size * 0.6;
        if (Math.pow(clickX - sx, 2) + Math.pow(clickY - (sy - entity.size / 2), 2) < radius * radius) {
            foundEntity = entity;
        }
    });
    let clickedGrid;
    if (foundEntity) {
        clickedGrid = { x: foundEntity.gridX, y: foundEntity.gridY };
    } else {
        clickedGrid = screenToIso(clickX, clickY);
    }
    if (playerState === 'idle') {
        const targetTile = reachableTiles.find(tile => tile.x === clickedGrid.x && tile.y === clickedGrid.y && tile.cost <= player.mp);
        if (targetTile) {
            moveEntityTo(player, targetTile.x, targetTile.y, targetTile.cost);
        } else {
            showMessage('Case invalide ou hors de portée.');
        }
    } else if (playerState === 'aiming') {
        const targetTile = attackableTiles.find(tile => tile.x === clickedGrid.x && tile.y === clickedGrid.y);
        if (targetTile && hasLineOfSight(player.gridX, player.gridY, targetTile.x, targetTile.y)) {
            player.ap--;
            // Launch projectile
            const start = isoToScreen(player.gridX, player.gridY);
            const end = isoToScreen(targetTile.x, targetTile.y);
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const speed = 8;
            projectiles.push({
                x: start.x,
                y: start.y - player.size / 2,
                dx: (dx / dist) * speed,
                dy: (dy / dist) * speed,
                owner: 'player',
                targetGridX: targetTile.x,
                targetGridY: targetTile.y
            });
            showMessage(`Sort lancé : ${SPELLS[selectedSpell].name}`);
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
            updateAllUI();
        } else if (targetTile) {
            showMessage('Obstacle bloque la vue !');
        } else {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
            showMessage('Visée annulée (clic hors portée)', 1500);
        }
        updateAllUI();
    }
}

// Game loop hook for projectiles and damage animations
export function gameTick() {
    updateProjectiles();
    // Animate damage numbers
    for (let i = damageAnimations.length - 1; i >= 0; i--) {
        const anim = damageAnimations[i];
        anim.time += 16;
        if (anim.time > anim.duration) damageAnimations.splice(i, 1);
    }
}

function setupInputHandlers() {
    window.addEventListener('keydown', handleKeyDown);
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.addEventListener('click', handleCanvasClick);
    }
}

export function initGame() {
    setupSpellBarListeners();
    setupInputHandlers();
    player.screenX = isoToScreen(player.gridX, player.gridY).x;
    player.screenY = isoToScreen(player.gridX, player.gridY).y;
    boss.screenX = isoToScreen(boss.gridX, boss.gridY).x;
    boss.screenY = isoToScreen(boss.gridX, boss.gridY).y;
    reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
    attackableTiles = [];
    updateAllUI();
    showMessage('Bienvenue ! Combattez le boss.', 3000);
}
