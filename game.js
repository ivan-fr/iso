import { player, boss, findPath, animateEntityPath as animateEntityPathEntities } from './entities.js';
import { SPELLS, selectedSpell, setSelectedSpell } from './spells.js';
import { mapGrid, TILE_W, TILE_H, GRID_COLS, GRID_ROWS, MAP_OFFSET_X, MAP_OFFSET_Y, MAX_MOVE_POINTS, MAX_ACTION_POINTS, PLAYER_MAX_HP, BOSS_MAX_HP, PLAYER_ATTACK_RANGE, BOSS_ATTACK_RANGE, BOSS_ATTACK_RANGE_SQ, PROJECTILE_SPEED, hasLineOfSight, getTilesInRangeBFS, isTileValidAndFree, isoToScreen, screenToIso, BOSS_ATTACK_DAMAGE } from './grid.js';
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
    // Cursor feedback like legacy
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    if (gameOver) canvas.style.cursor = 'default';
    else if (currentTurn !== 'player' || isBossActing) canvas.style.cursor = 'default';
    else if (playerState === 'aiming') canvas.style.cursor = 'crosshair';
    else if (playerState === 'idle') canvas.style.cursor = 'pointer';
    else canvas.style.cursor = 'default';
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
    await executeBossAI();
    if (!gameOver) { endTurn(); } else { updateAllUI(); }
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

function moveEntityTo(entity, targetGridX, targetGridY, cost, forceMove = false) {
    if (isMoving || cost > entity.mp || gameOver || (entity === player && playerState !== 'idle' && !forceMove)) return;
    entity.mp -= cost;
    // Use A* pathfinding from entities.js for correct movement
    const path = findPath(entity.gridX, entity.gridY, targetGridX, targetGridY, entity, isTileValidAndFree, player, boss);
    if (path && path.length > 1) {
        isMoving = true;
        animateEntityPathEntities(entity, path, animateEntityMove, () => {
            if (entity === player) {
                reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
            }
            isMoving = false;
            updateAllUI();
        });
    } else {
        // No path, instant move (safety)
        entity.gridX = targetGridX;
        entity.gridY = targetGridY;
        const final = isoToScreen(targetGridX, targetGridY);
        entity.screenX = final.x;
        entity.screenY = final.y;
        if (entity === player) {
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss);
        }
        updateAllUI();
    }
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
        const nextX = p.x + p.dx;
        const nextY = p.y + p.dy;
        if (p.owner === 'player' && p.targetGridX !== undefined && p.targetGridY !== undefined) {
            const remainingDistX = p.targetScreenX - p.x;
            const remainingDistY = p.targetScreenY - p.y;
            const dotProduct = remainingDistX * p.dx + remainingDistY * p.dy;
            const remainingDist = Math.sqrt(remainingDistX ** 2 + remainingDistY ** 2);
            const moveDist = Math.sqrt(p.dx ** 2 + p.dy ** 2);
            if (dotProduct < 0 || remainingDist <= moveDist + 1) {
                const spell = p.spellData;
                if (p.spellIndex === 0) {
                    if (boss.gridX === p.targetGridX && boss.gridY === p.targetGridY) {
                        const dmg = spell.damage();
                        boss.hp -= dmg;
                        showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                        showMessage(`Boss touché ! (-${dmg} HP)`, 1000);
                        if (boss.hp <= 0) { boss.hp = 0; showMessage('Boss Vaincu ! VICTOIRE !', 5000); gameOver = true; }
                        updateAllUI();
                    }
                } else if (p.spellIndex === 1) {
                    const affected = [
                        {x: p.targetGridX, y: p.targetGridY},
                        {x: p.targetGridX + 1, y: p.targetGridY},
                        {x: p.targetGridX - 1, y: p.targetGridY},
                        {x: p.targetGridX, y: p.targetGridY + 1},
                        {x: p.targetGridX, y: p.targetGridY - 1}
                    ];
                    let hitCount = 0;
                    let totalDmg = 0;
                    for (const tile of affected) {
                        if (boss.gridX === tile.x && boss.gridY === tile.y) {
                            const dmg = spell.damage();
                            boss.hp -= dmg;
                            totalDmg += dmg;
                            showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                            hitCount++;
                        }
                    }
                    if (hitCount > 0) {
                        showMessage(`Boss touché ${hitCount} fois ! (-${totalDmg} HP total)`, 1000);
                        if (boss.hp <= 0) {
                            boss.hp = 0;
                            showMessage('Boss Vaincu ! VICTOIRE !', 5000);
                            gameOver = true;
                        }
                        updateAllUI();
                    }
                } else if (p.spellIndex === 2) {
                    // Only push if boss is exactly on the targeted tile (legacy behavior)
                    if (boss.gridX === p.targetGridX && boss.gridY === p.targetGridY) {
                        const dmg = spell.damage();
                        boss.hp -= dmg;
                        showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                        // Calculate push direction
                        let dx = p.targetGridX - player.gridX;
                        let dy = p.targetGridY - player.gridY;
                        if (dx === 0 && dy === 0) {
                            dx = boss.gridX - player.gridX;
                            dy = boss.gridY - player.gridY;
                        }
                        if (dx === 0 && dy === 0) dx = 1;
                        if (Math.abs(dx) > Math.abs(dy)) {
                            dx = Math.sign(dx); dy = 0;
                        } else if (Math.abs(dy) > Math.abs(dx)) {
                            dy = Math.sign(dy); dx = 0;
                        } else if (dx !== 0) {
                            dx = Math.sign(dx); dy = 0;
                        } else if (dy !== 0) {
                            dy = Math.sign(dy); dx = 0;
                        }
                        let pushX = boss.gridX;
                        let pushY = boss.gridY;
                        let collision = false;
                        let pushed = false;
                        let steps = 0;
                        for (let step = 0; step < 2; step++) {
                            const nextPushX = pushX + dx;
                            const nextPushY = pushY + dy;
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
                            steps++;
                        }
                        if (steps === 1 && collision) {
                            boss.mp += 1;
                            moveEntityTo(boss, pushX, pushY, 0, true);
                            setTimeout(() => {
                                const bonus = 10 + Math.floor(Math.random() * 6); // 10-15
                                boss.hp -= bonus;
                                showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, bonus, '#d63031');
                                showMessage(`Dégâts de collision ! (-${bonus} HP)`, 1000);
                                updateAllUI();
                            }, 120);
                        } else if (pushed && !collision && (pushX !== boss.gridX || pushY !== boss.gridY)) {
                            boss.mp += 1;
                            moveEntityTo(boss, pushX, pushY, 0, true);
                        } else if (collision) {
                            const bonus = 10 + Math.floor(Math.random() * 6); // 10-15
                            boss.hp -= bonus;
                            showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, bonus, '#d63031');
                            showMessage(`Dégâts de collision ! (-${bonus} HP)`, 1000);
                        }
                        if (boss.hp <= 0) { boss.hp = 0; showMessage('Boss Vaincu ! VICTOIRE !', 5000); gameOver = true; }
                        updateAllUI();
                    }
                }
                projectiles.splice(i, 1);
                continue;
            }
            p.x = nextX;
            p.y = nextY;
            continue;
        }
        if (p.owner === 'boss') {
            let targetEntity = player;
            const targetScreenPos = isoToScreen(targetEntity.gridX, targetEntity.gridY);
            let collisionCheckX = (typeof targetEntity.screenX === 'number') ? targetEntity.screenX : targetScreenPos.x;
            let collisionCheckY = (typeof targetEntity.screenY === 'number') ? targetEntity.screenY : targetScreenPos.y - targetEntity.size / 2;
            const distToTarget = Math.sqrt(Math.pow(p.x - collisionCheckX, 2) + Math.pow(p.y - (collisionCheckY - targetEntity.size / 2), 2));
            if (distToTarget < targetEntity.size * 0.7) {
                targetEntity.hp -= BOSS_ATTACK_DAMAGE;
                showDamageAnimation(collisionCheckX, collisionCheckY - targetEntity.size / 2, BOSS_ATTACK_DAMAGE, '#e74c3c');
                projectiles.splice(i, 1);
                showMessage('Joueur touché !', 1000);
                if (player.hp <= 0) {
                    player.hp = 0;
                    showMessage('Joueur Vaincu ! GAME OVER', 5000);
                    gameOver = true;
                }
                updateAllUI();
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
            playerAttack(targetTile.x, targetTile.y);
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

// --- Boss AI and Turn Logic ---
async function executeBossAI() {
    let usedActionPoints = 0;
    async function tryAttack() {
        if (boss.ap <= 0) return false;
        const dx = boss.gridX - player.gridX;
        const dy = boss.gridY - player.gridY;
        const distToPlayerSq = dx * dx + dy * dy;
        if (distToPlayerSq <= BOSS_ATTACK_RANGE_SQ && hasLineOfSight(boss.gridX, boss.gridY, player.gridX, player.gridY)) {
            bossAttackPlayer();
            updateAllUI();
            await delay(800);
            usedActionPoints++;
            return true;
        }
        return false;
    }
    // Try to attack as much as possible
    while (usedActionPoints < MAX_ACTION_POINTS) {
        const attacked = await tryAttack();
        if (!attacked) break;
    }
    // If not all AP used, move and try to attack again
    if (usedActionPoints < MAX_ACTION_POINTS && boss.mp > 0) {
        const bossReachable = getTilesInRangeBFS(boss.gridX, boss.gridY, boss.mp, boss, player, boss);
        let bestTile = null;
        let bestScore = -Infinity;
        for (const tile of bossReachable) {
            const distToPlayer = Math.abs(tile.x - player.gridX) + Math.abs(tile.y - player.gridY);
            const inAttackRange = Math.pow(tile.x - player.gridX, 2) + Math.pow(tile.y - player.gridY, 2) <= BOSS_ATTACK_RANGE_SQ;
            const hasLoS = hasLineOfSight(tile.x, tile.y, player.gridX, player.gridY);
            let score = -distToPlayer * 10;
            if (inAttackRange && hasLoS) score += 1000;
            score -= tile.cost * 5;
            if (score > bestScore) {
                bestScore = score;
                bestTile = tile;
            }
        }
        if (bestTile && (bestScore > -Infinity)) {
            await new Promise(resolve => {
                moveEntityTo(boss, bestTile.x, bestTile.y, bestTile.cost, true);
                function waitMove() {
                    if (!isMoving) resolve();
                    else setTimeout(waitMove, 10);
                }
                waitMove();
            });
            await delay(500);
            // Try to attack again after moving
            while (usedActionPoints < MAX_ACTION_POINTS) {
                const attacked = await tryAttack();
                if (!attacked) break;
            }
        }
    }
    isBossActing = false;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function bossAttackPlayer() {
    if (boss.ap <= 0 || gameOver) return;
    boss.ap--;
    const startX = boss.screenX;
    const startY = boss.screenY - boss.size / 2;
    const playerScreenPos = isoToScreen(player.gridX, player.gridY);
    player.screenX = playerScreenPos.x;
    player.screenY = playerScreenPos.y;
    const targetX = player.screenX;
    const targetY = player.screenY - player.size / 2;
    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const projectileDx = (dx / dist) * PROJECTILE_SPEED;
    const projectileDy = (dy / dist) * PROJECTILE_SPEED;
    projectiles.push({
        x: startX,
        y: startY,
        dx: projectileDx,
        dy: projectileDy,
        owner: 'boss',
        targetScreenX: targetX,
        targetScreenY: targetY
    });
    showMessage('Le Boss attaque !', 1000);
}

// --- Player Spell/Projectile Logic ---
function playerAttack(targetGridX, targetGridY) {
    player.ap--;
    updateAllUI();
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
    const speed = spell.push ? PROJECTILE_SPEED * 1.5 : PROJECTILE_SPEED;
    projectiles.push({
        x: startX,
        y: startY,
        dx: (dx / dist) * speed,
        dy: (dy / dist) * speed,
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

// Game loop hook for projectiles and damage animations
export function gameTick() {
    updateProjectiles();
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
        // Mouse hover for hoveredTile
        canvas.addEventListener('mousemove', function(event) {
            if (gameOver) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            let foundEntity = null;
            [player, boss].forEach(entity => {
                const sx = (typeof entity.screenX === 'number') ? entity.screenX : isoToScreen(entity.gridX, entity.gridY).x;
                const sy = (typeof entity.screenY === 'number') ? entity.screenY : isoToScreen(entity.gridX, entity.gridY).y;
                const radius = entity.size * 0.6;
                if (Math.pow(mouseX - sx, 2) + Math.pow(mouseY - (sy - entity.size / 2), 2) < radius * radius) {
                    foundEntity = entity;
                }
            });
            if (foundEntity) {
                hoveredTile = { x: foundEntity.gridX, y: foundEntity.gridY };
            } else {
                const grid = screenToIso(mouseX, mouseY);
                hoveredTile = { x: grid.x, y: grid.y };
            }
        });
        canvas.addEventListener('mouseleave', function() {
            hoveredTile = null;
        });
    }
    // End turn button handler
    const endTurnButton = document.getElementById('endTurnButton');
    if (endTurnButton) {
        endTurnButton.addEventListener('click', () => { if (playerState === 'idle') endTurn(); });
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
