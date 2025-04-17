import { player, boss, findPath, animateEntityPath as animateEntityPathEntities, bouftous } from './entities.js';
import { SPELLS, setSelectedSpell, getSelectedSpellIndex } from './spells.js';
import { mapGrid, TILE_W, TILE_H, GRID_COLS, GRID_ROWS, MAP_OFFSET_X, MAP_OFFSET_Y, MAX_MOVE_POINTS, MAX_ACTION_POINTS, PLAYER_MAX_HP, BOSS_MAX_HP, PLAYER_ATTACK_RANGE, BOSS_ATTACK_RANGE, BOSS_ATTACK_RANGE_SQ, PROJECTILE_SPEED, hasLineOfSight as hasLineOfSightRaw, getTilesInRangeBFS, isTileValidAndFree, isoToScreen, screenToIso, BOSS_ATTACK_DAMAGE } from './grid.js';
import { showMessage, updateAllUI, setupSpellBarListeners, playSound, updateTurnOrder, setupSpellTooltips, stopSound } from './ui.js';
import { bouftouAI } from './ai.js';

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
export let bouftousState = bouftous.map(b => ({ ...b }));

// Ajout : cases d'attaque accessibles pour le boss (cases bleues)
let attackableTilesBoss = [];

// Helper pour la LoS avec bouftous
function hasLineOfSightAllEntities(startX, startY, endX, endY) {
    return hasLineOfSightRaw(startX, startY, endX, endY, player, boss, bouftousState);
}

// Wrapper function for updateAllUI
function updateAllUIWrapper() {
    updateAllUI({
        turnIndicator: document.getElementById('turn-indicator'),
        playerApDisplay: document.getElementById('player-ap'),
        playerMpDisplay: document.getElementById('player-mp'),
        bossApDisplay: document.getElementById('boss-ap'),
        bossMpDisplay: document.getElementById('boss-mp'),
        player,
        boss,
        playerHealthBar: document.getElementById('player-health-bar'),
        bossHealthBar: document.getElementById('boss-health-bar'),
        currentTurn,
        isMoving,
        isBossActing,
        playerState,
        endTurnButton: document.getElementById('endTurnButton'),
        gameOver,
        bouftous: bouftousState
    });
}

function endTurn() {
    if (isMoving || isBossActing || gameOver || playerState !== 'idle') return;
    if (currentTurn === 'player') startBossTurn();
    else if (currentTurn === 'boss') startBouftouTurn();
    else startPlayerTurn();
}

function startPlayerTurn() {
    currentTurn = 'player';
    playerState = 'idle';
    player.mp = MAX_MOVE_POINTS;
    player.ap = MAX_ACTION_POINTS;
    reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss, bouftousState);
    attackableTiles = [];
    isBossActing = false;
    updateAllUIWrapper();
    updateTurnOrder(currentTurn);
    playSound('turn');
    showMessage('Tour du Joueur', 1500);
}

async function startBossTurn() {
    currentTurn = 'boss';
    playerState = 'idle';
    boss.mp = MAX_MOVE_POINTS;
    boss.ap = MAX_ACTION_POINTS;
    reachableTiles = [];
    attackableTiles = [];
    attackableTilesBoss = [];
    isBossActing = true;
    updateAllUIWrapper();
    updateTurnOrder(currentTurn);
    playSound('turn');
    showMessage('Tour du Boss', 1500);
    await executeBossAI();
    if (!gameOver) { endTurn(); } else { updateAllUIWrapper(); }
}

async function startBouftouTurn() {
    console.log('Début du tour des Bouftous');
    for (const b of bouftousState) {
        b.mp = 4;
        b.ap = 1;
    }
    for (const b of bouftousState) {
        if (b.hp <= 0) continue;
        console.log('Bouftou joue:', b);
        await new Promise(resolve => {
            bouftouAI(b, animateEntityMove, (bouftou, target) => {
                // Attaque CAC
                const dmg = 9 + Math.floor(Math.random() * 4); // 9-12
                target.hp -= dmg;
                showDamageAnimation(target.screenX, target.screenY - target.size / 2, dmg, '#bada55');
                showMessage('Bouftou attaque ! (-' + dmg + ' HP)', 900);
                if (target.hp <= 0) {
                    target.hp = 0;
                    showDeathAnimation(target, '#bada55');
                    showMessage('Joueur Vaincu ! GAME OVER', 5000);
                    gameOver = true;
                }
                updateAllUIWrapper();
            }, resolve);
        });
        if (gameOver) break;
    }
    if (!gameOver) startPlayerTurn();
    else updateAllUIWrapper();
}

function handleKeyDown(e) {
    if (["1","2","3"].includes(e.key)) {
        setSelectedSpell(parseInt(e.key) - 1);
        updateAllUIWrapper();
        return;
    }
    if (gameOver || currentTurn !== 'player' || isMoving || isBossActing) return;
    if (e.key === ' ' || e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (playerState === 'idle' && player.ap > 0) {
            playerState = 'aiming';
            const spell = SPELLS[getSelectedSpellIndex()];
            let allTiles = getTilesInRangeBFS(player.gridX, player.gridY, spell.range ?? PLAYER_ATTACK_RANGE, null, player, boss, bouftousState);
            attackableTiles = allTiles.filter(tile => hasLineOfSightAllEntities(player.gridX, player.gridY, tile.x, tile.y));
            reachableTiles = [];
            showMessage('Mode Visée: Cliquez case bleue pour tirer (Echap pour annuler)', 3000);
        } else if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss, bouftousState);
            showMessage('Visée annulée', 1500);
        }
        updateAllUIWrapper();
    } else if (e.key === 'Escape') {
        if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss, bouftousState);
            showMessage('Visée annulée', 1500);
            updateAllUIWrapper();
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
    playSound('move'); // Joue le son de déplacement
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
            stopSound('move'); // Arrête le son de déplacement
            if (onComplete) onComplete();
        }
    }
    requestAnimationFrame(step);
}

function moveEntityTo(entity, targetGridX, targetGridY, cost, forceMove = false) {
    // Empêche d'aller sur la case d'une autre entité (sauf si forceMove pour poussée)
    if (!forceMove) {
        // Vérifie joueur
        if (entity !== player && player.gridX === targetGridX && player.gridY === targetGridY) return;
        // Vérifie boss
        if (entity !== boss && boss.gridX === targetGridX && boss.gridY === targetGridY) return;
        // Vérifie bouftous
        for (const b of bouftousState) {
            if (b !== entity && b.hp > 0 && b.gridX === targetGridX && b.gridY === targetGridY) return;
        }
    }
    if (isMoving || cost > entity.mp || gameOver || (entity === player && playerState !== 'idle' && !forceMove)) return;
    entity.mp -= cost;
    // Use A* pathfinding from entities.js for correct movement
    const path = findPath(entity.gridX, entity.gridY, targetGridX, targetGridY, entity, (x, y, ent, p, b) => isTileValidAndFree(x, y, ent, player, boss, bouftousState), player, boss);
    if (path && path.length > 1) {
        isMoving = true;
        animateEntityPathEntities(entity, path, animateEntityMove, () => {
            if (entity === player) {
                reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss, bouftousState);
            }
            isMoving = false;
            updateAllUIWrapper();
        });
    } else {
        // No path, instant move (safety)
        entity.gridX = targetGridX;
        entity.gridY = targetGridY;
        const final = isoToScreen(targetGridX, targetGridY);
        entity.screenX = final.x;
        entity.screenY = final.y;
        if (entity === player) {
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss, bouftousState);
        }
        updateAllUIWrapper();
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
    playSound('damage');
}

// Animation de disparition d'entité (fade out + scale)
function showDeathAnimation(entity, color = '#fff') {
    let alpha = 1;
    let scale = 1;
    const duration = 900;
    const start = performance.now();
    function step(now) {
        const t = Math.min(1, (now - start) / duration);
        alpha = 1 - t;
        scale = 1 + 0.5 * t;
        entity._deathAlpha = alpha;
        entity._deathScale = scale;
        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            entity._deathAlpha = 0;
            entity._deathScale = 1.5;
            // Pour les bouftous, on les "retire" du jeu
            if (entity !== player && entity !== boss) {
                entity.hp = 0;
                entity._removed = true;
            }
        }
    }
    requestAnimationFrame(step);
}

function updateProjectiles() {
    // Suppression effective des entités disparues (_removed)
    for (let i = bouftousState.length - 1; i >= 0; i--) {
        if (bouftousState[i]._removed) {
            bouftousState.splice(i, 1);
        }
    }
    if (boss._removed && !gameOver) {
        // Boss vaincu, ne plus l'afficher
        boss.hp = 0;
    }
    if (player._removed && !gameOver) {
        player.hp = 0;
    }
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
                // --- Mono-cible ---
                if (p.spellIndex === 0) {
                    // Bouftou touché ?
                    let hit = false;
                    for (const b of bouftousState) {
                        if (b.hp > 0 && b.gridX === p.targetGridX && b.gridY === p.targetGridY) {
                            const dmg = spell.damage();
                            b.hp -= dmg;
                            showDamageAnimation(b.screenX, b.screenY - b.size / 2, dmg, spell.color);
                            showMessage(`Bouftou touché ! (-${dmg} HP)`, 1000);
                            if (b.hp <= 0) {
                                b.hp = 0;
                                showDeathAnimation(b, spell.color);
                            }
                            updateAllUIWrapper();
                            hit = true;
                        }
                    }
                    // Boss touché ?
                    if (boss.gridX === p.targetGridX && boss.gridY === p.targetGridY) {
                        const dmg = spell.damage();
                        boss.hp -= dmg;
                        showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                        showMessage(`Boss touché ! (-${dmg} HP)`, 1000);
                        if (boss.hp <= 0) {
                            boss.hp = 0;
                            showDeathAnimation(boss, spell.color);
                            showMessage('Boss Vaincu ! VICTOIRE !', 5000);
                            gameOver = true;
                        }
                        updateAllUIWrapper();
                        hit = true;
                    }
                    // Si rien touché, on ne fait rien
                }
                // --- Zone croix ---
                else if (p.spellIndex === 1) {
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
                        for (const b of bouftousState) {
                            if (b.hp > 0 && b.gridX === tile.x && b.gridY === tile.y) {
                                const dmg = spell.damage();
                                b.hp -= dmg;
                                totalDmg += dmg;
                                showDamageAnimation(b.screenX, b.screenY - b.size / 2, dmg, spell.color);
                                hitCount++;
                                if (b.hp <= 0) {
                                    b.hp = 0;
                                    showDeathAnimation(b, spell.color);
                                }
                            }
                        }
                        if (boss.gridX === tile.x && boss.gridY === tile.y) {
                            const dmg = spell.damage();
                            boss.hp -= dmg;
                            totalDmg += dmg;
                            showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                            hitCount++;
                            if (boss.hp <= 0) {
                                boss.hp = 0;
                                showDeathAnimation(boss, spell.color);
                                showMessage('Boss Vaincu ! VICTOIRE !', 5000);
                                gameOver = true;
                            }
                        }
                    }
                    if (hitCount > 0) {
                        showMessage(`Cible(s) touchée(s) ! (-${totalDmg} HP total)`, 1000);
                        updateAllUIWrapper();
                    }
                }
                // --- Poussée ---
                else if (p.spellIndex === 2) {
                    // Bouftou ?
                    for (const b of bouftousState) {
                        if (b.hp > 0 && b.gridX === p.targetGridX && b.gridY === p.targetGridY) {
                            const dmg = spell.damage();
                            b.hp -= dmg;
                            showDamageAnimation(b.screenX, b.screenY - b.size / 2, dmg, spell.color);
                            // Calcul poussée
                            let dx = p.targetGridX - player.gridX;
                            let dy = p.targetGridY - player.gridY;
                            if (dx === 0 && dy === 0) {
                                dx = b.gridX - player.gridX;
                                dy = b.gridY - player.gridY;
                            }
                            if (dx === 0 && dy === 0) dx = 1;
                            if (Math.abs(dx) > Math.abs(dy)) { dx = Math.sign(dx); dy = 0; }
                            else if (Math.abs(dy) > Math.abs(dx)) { dy = Math.sign(dy); dx = 0; }
                            else if (dx !== 0) { dx = Math.sign(dx); dy = 0; }
                            else if (dy !== 0) { dy = Math.sign(dy); dx = 0; }
                            let pushX = b.gridX;
                            let pushY = b.gridY;
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
                                    (player.gridX === nextPushX && player.gridY === nextPushY) ||
                                    (boss.gridX === nextPushX && boss.gridY === nextPushY) ||
                                    bouftousState.some(other => other !== b && other.hp > 0 && other.gridX === nextPushX && other.gridY === nextPushY)
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
                                b.mp += 1;
                                moveEntityTo(b, pushX, pushY, 0, true);
                                setTimeout(() => {
                                    const bonus = 10 + Math.floor(Math.random() * 6); // 10-15
                                    b.hp -= bonus;
                                    showDamageAnimation(b.screenX, b.screenY - b.size / 2, bonus, '#d63031');
                                    showMessage(`Dégâts de collision ! (-${bonus} HP)`, 1000);
                                    updateAllUIWrapper();
                                }, 120);
                            } else if (pushed && !collision && (pushX !== b.gridX || pushY !== b.gridY)) {
                                b.mp += 1;
                                moveEntityTo(b, pushX, pushY, 0, true);
                            } else if (collision) {
                                const bonus = 10 + Math.floor(Math.random() * 6); // 10-15
                                b.hp -= bonus;
                                showDamageAnimation(b.screenX, b.screenY - b.size / 2, bonus, '#d63031');
                                showMessage(`Dégâts de collision ! (-${bonus} HP)`, 1000);
                            }
                            if (b.hp <= 0) {
                                b.hp = 0;
                                showDeathAnimation(b, spell.color);
                            }
                            updateAllUIWrapper();
                        }
                    }
                    // Boss ?
                    if (boss.gridX === p.targetGridX && boss.gridY === p.targetGridY) {
                        const dmg = spell.damage();
                        boss.hp -= dmg;
                        showDamageAnimation(boss.screenX, boss.screenY - boss.size / 2, dmg, spell.color);
                        // Calcul poussée boss (identique à avant)
                        let dx = p.targetGridX - player.gridX;
                        let dy = p.targetGridY - player.gridY;
                        if (dx === 0 && dy === 0) {
                            dx = boss.gridX - player.gridX;
                            dy = boss.gridY - player.gridY;
                        }
                        if (dx === 0 && dy === 0) dx = 1;
                        if (Math.abs(dx) > Math.abs(dy)) { dx = Math.sign(dx); dy = 0; }
                        else if (Math.abs(dy) > Math.abs(dx)) { dy = Math.sign(dy); dx = 0; }
                        else if (dx !== 0) { dx = Math.sign(dx); dy = 0; }
                        else if (dy !== 0) { dy = Math.sign(dy); dx = 0; }
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
                                (player.gridX === nextPushX && player.gridY === nextPushY) ||
                                bouftousState.some(other => other.hp > 0 && other.gridX === nextPushX && other.gridY === nextPushY)
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
                                updateAllUIWrapper();
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
                        if (boss.hp <= 0) {
                            boss.hp = 0;
                            showDeathAnimation(boss, spell.color);
                            showMessage('Boss Vaincu ! VICTOIRE !', 5000);
                            gameOver = true;
                        }
                        updateAllUIWrapper();
                    }
                }
                projectiles.splice(i, 1);
                continue;
            }
            p.x = nextX;
            p.y = nextY;
            continue;
        }
        // Correction : attaque à distance du boss
        if (p.owner === 'boss') {
            // Collision avec le joueur
            let targetEntity = player;
            const targetScreenPos = isoToScreen(targetEntity.gridX, targetEntity.gridY);
            let collisionCheckX = (typeof targetEntity.screenX === 'number') ? targetEntity.screenX : targetScreenPos.x;
            let collisionCheckY = (typeof targetEntity.screenY === 'number') ? targetEntity.screenY : targetScreenPos.y - targetEntity.size / 2;
            const distToTarget = Math.sqrt(Math.pow(p.x - collisionCheckX, 2) + Math.pow(p.y - (collisionCheckY - targetEntity.size / 2), 2));
            if (distToTarget < targetEntity.size * 0.7) {
                const dmg = BOSS_ATTACK_DAMAGE;
                targetEntity.hp -= dmg;
                showDamageAnimation(collisionCheckX, collisionCheckY - targetEntity.size / 2, dmg, '#e74c3c');
                projectiles.splice(i, 1);
                showMessage('Joueur touché !', 1000);
                if (player.hp <= 0) {
                    player.hp = 0;
                    showDeathAnimation(player, '#e74c3c');
                    showMessage('Joueur Vaincu ! GAME OVER', 5000);
                    gameOver = true;
                }
                updateAllUIWrapper();
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
    [player, boss, ...bouftousState].forEach(entity => {
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
        // Correction : si on clique sur une entité, on force l'ajout de la case dans attackableTiles si elle est à portée et LoS
        let targetTile = attackableTiles.find(tile => tile.x === clickedGrid.x && tile.y === clickedGrid.y);
        if (!targetTile && foundEntity) {
            const spell = SPELLS[getSelectedSpellIndex()];
            const dist = Math.abs(player.gridX - foundEntity.gridX) + Math.abs(player.gridY - foundEntity.gridY);
            if (dist <= (spell.range ?? PLAYER_ATTACK_RANGE) && hasLineOfSightAllEntities(player.gridX, player.gridY, foundEntity.gridX, foundEntity.gridY)) {
                targetTile = { x: foundEntity.gridX, y: foundEntity.gridY };
            }
        }
        if (targetTile && hasLineOfSightAllEntities(player.gridX, player.gridY, targetTile.x, targetTile.y)) {
            playerAttack(targetTile.x, targetTile.y);
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss, bouftousState);
            updateAllUIWrapper();
        } else if (targetTile) {
            showMessage('Obstacle bloque la vue !');
        } else {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss, bouftousState);
            showMessage('Visée annulée (clic hors portée)', 1500);
        }
        updateAllUIWrapper();
    }
}

// --- Boss AI and Turn Logic ---
async function executeBossAI() {
    let usedActionPoints = 0;
    // Génère les cases bleues d'attaque pour le boss (comme pour le joueur)
    // Utilise le sort à distance du boss (bossOnly: true, range > 1)
    const spell = SPELLS.find(s => s.bossOnly && s.range > 1);
    if (spell) {
        // Correction : entityCheckBlocking=null pour ne pas bloquer la portée sur les entités
let allTiles = getTilesInRangeBFS(boss.gridX, boss.gridY, spell.range, null, player, boss, bouftousState);
        attackableTilesBoss = allTiles.filter(tile => hasLineOfSightAllEntities(boss.gridX, boss.gridY, tile.x, tile.y));
// Ajoute explicitement la case du joueur si elle est à portée et en ligne de vue
const distToPlayer = Math.abs(boss.gridX - player.gridX) + Math.abs(boss.gridY - player.gridY);
if (
    distToPlayer <= spell.range &&
    hasLineOfSightAllEntities(boss.gridX, boss.gridY, player.gridX, player.gridY)
) {
    if (!attackableTilesBoss.some(tile => tile.x === player.gridX && tile.y === player.gridY)) {
        attackableTilesBoss.push({ x: player.gridX, y: player.gridY });
    }
}
    } else {
        attackableTilesBoss = [];
    }
    // 1. Essayer d'attaquer au CAC si possible
    async function tryMeleeAttack() {
        if (boss.ap <= 0) return false;
        const dx = Math.abs(boss.gridX - player.gridX);
        const dy = Math.abs(boss.gridY - player.gridY);
        if ((dx + dy) === 1) { // Adjacent (portée 1)
            boss.ap--;
            const spell = SPELLS.find(s => s.bossOnly && s.range === 1);
            if (spell) {
                const dmg = spell.damage();
                player.hp -= dmg;
                showDamageAnimation(player.screenX, player.screenY - player.size / 2, dmg, spell.color);
                showMessage(`Le Boss frappe au corps à corps ! (-${dmg} HP)`, 1000);
                if (player.hp <= 0) {
                    player.hp = 0;
                    showDeathAnimation(player, spell.color);
                    showMessage('Joueur Vaincu ! GAME OVER', 5000);
                    gameOver = true;
                }
                updateAllUIWrapper();
                await delay(700);
                return true;
            }
        }
        return false;
    }
    // 2. Chercher à se déplacer vers une case adjacente au joueur si ce n'est pas déjà le cas
    let isAdjacent = Math.abs(boss.gridX - player.gridX) + Math.abs(boss.gridY - player.gridY) === 1;
    if (!isAdjacent && boss.mp > 0) {
        const bossReachable = getTilesInRangeBFS(boss.gridX, boss.gridY, boss.mp, boss, player, boss, bouftousState);
        let foundAdj = null;
        for (const tile of bossReachable) {
            const distToPlayer = Math.abs(tile.x - player.gridX) + Math.abs(tile.y - player.gridY);
            if (distToPlayer === 1) {
                foundAdj = tile;
                break;
            }
        }
        if (foundAdj) {
            await new Promise(resolve => {
                moveEntityTo(boss, foundAdj.x, foundAdj.y, foundAdj.cost, true);
                function waitMove() {
                    if (!isMoving) resolve();
                    else setTimeout(waitMove, 10);
                }
                waitMove();
            });
            await delay(500);
            // Après déplacement, retenter le CAC
            while (usedActionPoints < MAX_ACTION_POINTS) {
                const melee = await tryMeleeAttack();
                if (melee) { usedActionPoints++; continue; }
                break;
            }
            isBossActing = false;
            return;
        }
    }
    // 3. Si pas de CAC possible, attaquer à distance si possible
    async function tryRangedAttack() {
        if (boss.ap <= 0) return false;
        // Regénère les cases bleues à chaque tentative (le joueur peut avoir bougé)
        // Utilise le sort à distance du boss (bossOnly: true, range > 1)
        const spell = SPELLS.find(s => s.bossOnly && s.range > 1);
        if (spell) {
            console.log('[BossAI] Sort distance choisi:', spell.name, 'Portée:', spell.range);
            // Correction : entityCheckBlocking=null pour ne pas bloquer la portée sur les entités
let allTiles = getTilesInRangeBFS(boss.gridX, boss.gridY, spell.range, null, player, boss, bouftousState);
            attackableTilesBoss = allTiles.filter(tile => hasLineOfSightAllEntities(boss.gridX, boss.gridY, tile.x, tile.y));
// Ajoute explicitement la case du joueur si elle est à portée et en ligne de vue
const distToPlayer = Math.abs(boss.gridX - player.gridX) + Math.abs(boss.gridY - player.gridY);
if (
    distToPlayer <= spell.range &&
    hasLineOfSightAllEntities(boss.gridX, boss.gridY, player.gridX, player.gridY)
) {
    if (!attackableTilesBoss.some(tile => tile.x === player.gridX && tile.y === player.gridY)) {
        attackableTilesBoss.push({ x: player.gridX, y: player.gridY });
    }
}
        } else {
            attackableTilesBoss = [];
        }
        console.log('[BossAI] attackableTilesBoss:', attackableTilesBoss.map(t => `(${t.x},${t.y})`).join(' '), '| player:', player.gridX, player.gridY);
        const canAttack = attackableTilesBoss.some(tile => tile.x === player.gridX && tile.y === player.gridY);
        console.log('[BossAI] canAttack:', canAttack);
        if (canAttack) {
            bossAttackPlayer();
            updateAllUIWrapper();
            await delay(800);
            usedActionPoints++;
            return true;
        }
        return false;
    }
    // 4. Attaque à distance si possible
    while (usedActionPoints < MAX_ACTION_POINTS) {
        const melee = await tryMeleeAttack();
        if (melee) { usedActionPoints++; continue; }
        const ranged = await tryRangedAttack();
        if (ranged) continue;
        break;
    }
    // 5. Sinon, se rapprocher du joueur (comportement normal)
    if (usedActionPoints < MAX_ACTION_POINTS && boss.mp > 0) {
        const bossReachable = getTilesInRangeBFS(boss.gridX, boss.gridY, boss.mp, boss, player, boss, bouftousState);
        let bestTile = null;
        let bestScore = -Infinity;
        for (const tile of bossReachable) {
            const distToPlayer = Math.abs(tile.x - player.gridX) + Math.abs(tile.y - player.gridY);
            const inAttackRange = Math.pow(tile.x - player.gridX, 2) + Math.pow(tile.y - player.gridY, 2) <= BOSS_ATTACK_RANGE_SQ;
            const hasLoS = hasLineOfSightAllEntities(tile.x, tile.y, player.gridX, player.gridY);
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
            // Réessayer d'attaquer après déplacement
            while (usedActionPoints < MAX_ACTION_POINTS) {
                const melee = await tryMeleeAttack();
                if (melee) { usedActionPoints++; continue; }
                const ranged = await tryRangedAttack();
                if (ranged) continue;
                break;
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
    updateAllUIWrapper();
    const spell = SPELLS[getSelectedSpellIndex()];
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
        spellIndex: getSelectedSpellIndex(),
        spellData: spell
    });
    playSound('spell');
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
    setupSpellBarListeners(setSelectedSpell, getSelectedSpellIndex, SPELLS, showMessage, updateAllUIWrapper);
    setupSpellTooltips(SPELLS);
    setupInputHandlers();
    player.screenX = isoToScreen(player.gridX, player.gridY).x;
    player.screenY = isoToScreen(player.gridX, player.gridY).y;
    boss.screenX = isoToScreen(boss.gridX, boss.gridY).x;
    boss.screenY = isoToScreen(boss.gridX, boss.gridY).y;
    bouftousState.forEach(b => {
        b.screenX = isoToScreen(b.gridX, b.gridY).x;
        b.screenY = isoToScreen(b.gridX, b.gridY).y;
    });
    reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, player, player, boss, bouftousState);
    attackableTiles = [];
    updateAllUIWrapper();
    updateTurnOrder(currentTurn);
    playSound('turn'); // Play turn sound on initial game start
    showMessage('Bienvenue ! Combattez le boss.', 3000);
}
