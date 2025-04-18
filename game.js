import { bossAI, bouftouAI } from './ai.js';
import { bouftonNoirAI, chefAI } from './ai_extra.js';
import { animateEntityPath as animateEntityPathEntities, boss, createEnemy, player, findPath } from './entities.js';
import { ROOMS } from './rooms.js';
import { ENEMY_TYPES } from './enemyTypes.js';
import { BOSS_ATTACK_DAMAGE, MAX_ACTION_POINTS, MAX_MOVE_POINTS, PLAYER_ATTACK_RANGE, PROJECTILE_SPEED, getTilesInRangeBFS, hasLineOfSight as hasLineOfSightRaw, isTileValidAndFree, isoToScreen, screenToIso, createGrid } from './grid.js';
import { SPELLS, getSelectedSpellIndex, setSelectedSpell } from './spells.js';
import { playSound, setupSpellBarListeners, setupSpellTooltips, showMessage, stopSound, updateAllUI, updateTurnOrder } from './ui.js';

// Variables d'état globales
export let currentRoom = 1;
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
export let bouftousState = [];

// Taille dynamique de la grille
export let GRID_COLS = 16;
export let GRID_ROWS = 16;
export let mapGrid = createGrid(GRID_ROWS, GRID_COLS);

// Ajout : cases d'attaque accessibles pour le boss (cases bleues)
let attackableTilesBoss = [];

// Helper pour la LoS avec bouftous
function hasLineOfSightAllEntities(startX, startY, endX, endY) {
    return hasLineOfSightRaw(startX, startY, endX, endY, [player, boss, ...bouftousState]);
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
    reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, [player, boss, ...bouftousState]);
    attackableTiles = [];
    isBossActing = false;
    updateAllUIWrapper();
    updateTurnOrder(currentTurn);
    playSound('turn');
    showMessage('Tour du Joueur', 1500);
}

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
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, [player, boss, ...bouftousState]);
            updateAllUIWrapper();
        } else if (targetTile) {
            showMessage('Obstacle bloque la vue !');
        } else {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, [player, boss, ...bouftousState]);
            showMessage('Visée annulée (clic hors portée)', 1500);
        }
        updateAllUIWrapper();
    }
}

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

async function startBossTurn() {
    // Si le boss est mort, on le skip et on passe aux bouftous
    if (boss.hp <= 0) {
        startBouftouTurn();
        return;
    }
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
    // Orchestration via bossAI
    await new Promise(resolve => {
        bossAI(boss, animateEntityMove,
            async (entity, target) => {
                return new Promise(resolve => {
                    // Coût 1 PA pour attaque mêlée
                    entity.ap--;
                    const spellM = SPELLS.find(s => s.bossOnly && s.range === 1);
                    if (spellM) {
                        const dmg = spellM.damage();
                        target.hp -= dmg;
                        showDamageAnimation(target.screenX, target.screenY - target.size / 2, dmg, spellM.color);
                        showMessage(`Le Boss frappe au corps à corps ! (-${dmg} HP)`, 1000);
                        if (target.hp <= 0) {
                            target.hp = 0;
                            showDeathAnimation(target, spellM.color);
                            showMessage('Joueur Vaincu ! GAME OVER', 5000);
                            gameOver = true;
                        }
                        updateAllUIWrapper();
                        setTimeout(resolve, 700);
                    } else {
                        resolve();
                    }
                });
            },
            async target => {
                return new Promise(resolve => {
                    console.log('[Boss] Attaque à distance lancée, PA restants:', boss.ap);
                    bossAttackPlayer();
                    updateAllUIWrapper();
                    setTimeout(resolve, 1300); // délai augmenté pour voir chaque tir
                });
            },
            resolve,
            bouftousState
        );
        // Marque fin de l'action du boss
        isBossActing = false;
    });
    if (!gameOver) endTurn();
    else updateAllUIWrapper();
}

async function startBouftouTurn() {
    console.log('Début du tour des ennemis');
    // Reset PA/PM pour chaque ennemi selon son type
    for (const b of bouftousState) {
        const base = ENEMY_TYPES[b.type];
        b.mp = base ? base.mp : 4;
        b.ap = base ? base.ap : 1;
        b._specialUsed = false;
        b._supportUsed = false;
    }
    for (const b of bouftousState) {
        if (b.hp <= 0) continue;
        console.log('Ennemi joue:', b);
        await new Promise(resolve => {
            if (b.type === 'bouftou') {
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
                }, resolve, bouftousState);
            } else if (b.type === 'boufton_noir') {
                bouftonNoirAI(b, animateEntityMove,
                    (entity, target) => new Promise(res => {
                        // Attaque à distance
                        const spell = SPELLS.find(s => s.bouftonNoirOnly && !s.special);
                        if (spell && b.ap >= 2) {
                            const dmg = spell.damage();
                            target.hp -= dmg;
                            showDamageAnimation(target.screenX, target.screenY - target.size / 2, dmg, spell.color);
                            showMessage('Boufton noir lance Boulance noire ! (-' + dmg + ' PM)', 1000);
                            if (target.hp <= 0) {
                                target.hp = 0;
                                showDeathAnimation(target, spell.color);
                                showMessage('Joueur Vaincu ! GAME OVER', 5000);
                                gameOver = true;
                            }
                            updateAllUIWrapper();
                            setTimeout(res, 700);
                        } else { res(); }
                    }),
                    (entity, target) => new Promise(res => {
                        // Sort spécial -2 PM
                        const spell = SPELLS.find(s => s.bouftonNoirOnly && s.special === 'remove_mp');
                        if (spell && b.ap >= 1) {
                            target.mp = Math.max(0, target.mp - 2);
                            showMessage('Boufton noir retire 2 PM au joueur !', 1000);
                            updateAllUIWrapper();
                            setTimeout(res, 700);
                        } else { res(); }
                    }),
                    resolve, bouftousState);
            } else if (b.type === 'chef') {
                chefAI(b, animateEntityMove,
                    (entity, target) => new Promise(res => {
                        // Attaque puissante CAC
                        const spell = SPELLS.find(s => s.chefOnly && !s.special);
                        if (spell && b.ap >= 2) {
                            const dmg = spell.damage();
                            target.hp -= dmg;
                            showDamageAnimation(target.screenX, target.screenY - target.size / 2, dmg, spell.color);
                            showMessage('Chef de guerre frappe ! (-' + dmg + ' HP)', 1000);
                            if (target.hp <= 0) {
                                target.hp = 0;
                                showDeathAnimation(target, spell.color);
                                showMessage('Joueur Vaincu ! GAME OVER', 5000);
                                gameOver = true;
                            }
                            updateAllUIWrapper();
                            setTimeout(res, 700);
                        } else { res(); }
                    }),
                    (entity, ally) => new Promise(res => {
                        // Sort soutien +2 PM
                        const spell = SPELLS.find(s => s.chefOnly && s.special === 'give_mp');
                        if (spell && b.ap >= 1) {
                            ally.mp += 2;
                            showMessage('Chef de guerre donne 2 PM à un allié !', 1000);
                            updateAllUIWrapper();
                            setTimeout(res, 700);
                        } else { res(); }
                    }),
                    resolve, bouftousState);
            }
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
            let allTiles = getTilesInRangeBFS(player.gridX, player.gridY, spell.range ?? PLAYER_ATTACK_RANGE, [], true);
            attackableTiles = allTiles.filter(tile => hasLineOfSightAllEntities(player.gridX, player.gridY, tile.x, tile.y));
            reachableTiles = [];
            showMessage('Mode Visée: Cliquez case bleue pour tirer (Echap pour annuler)', 3000);
        } else if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, [player, boss, ...bouftousState]);
            showMessage('Visée annulée', 1500);
        }
        updateAllUIWrapper();
    } else if (e.key === 'Escape') {
        if (playerState === 'aiming') {
            playerState = 'idle';
            attackableTiles = [];
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, [player, boss, ...bouftousState]);
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
                reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, [player, boss, ...bouftousState]);
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
            reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, [player, boss, ...bouftousState]);
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
            if (entity !== player) {
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
                                checkVictory();
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
                            checkVictory();
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
                                    checkVictory();
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
                                checkVictory();
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
                                checkVictory();
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
                            checkVictory();
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

// Vérifie la victoire : boss ET tous les bouftous morts
function checkVictory() {
    const anyBouftouAlive = bouftousState.some(b => b.hp > 0);
    const bossAlive = boss && boss.hp > 0 && !boss._removed;
    if (!anyBouftouAlive && !bossAlive) {
        if (currentRoom < ROOMS.length) {
            showMessage('Salle terminée ! Passage à la salle suivante...', 2500);
            setTimeout(() => loadRoom(currentRoom + 1), 2500);
        } else {
            gameOver = true;
            showMessage('VICTOIRE FINALE ! Tous les ennemis sont vaincus !', 5000);
            updateAllUIWrapper();
        }
    }
}

function bossAttackPlayer() {
    if (boss.ap <= 0 || gameOver) return;
    boss.ap--; // PA réduit ici, pour chaque attaque à distance
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
    const projectileDx = (dx / dist) * (PROJECTILE_SPEED * 0.5); // projectile plus lent
    const projectileDy = (dy / dist) * (PROJECTILE_SPEED * 0.5);
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
    loadRoom(1);
}

export function loadRoom(roomIndex) {
    // Reset état
    gameOver = false;
    currentRoom = roomIndex;
    currentTurn = 'player';
    playerState = 'idle';
    reachableTiles = [];
    attackableTiles = [];
    isMoving = false;
    isBossActing = false;
    projectiles = [];
    hoveredTile = null;
    damageAnimations = [];
    attackableTilesBoss = [];
    // Map et obstacles
    const room = ROOMS[roomIndex - 1];
    // Adapter la taille de la map (GRID_COLS/ROWS dynamiques)
    GRID_COLS = room.gridCols;
    GRID_ROWS = room.gridRows;
    mapGrid = createGrid(GRID_ROWS, GRID_COLS);
    // Place obstacles
    for (const obs of room.obstacles) {
      if (mapGrid[obs.y] && mapGrid[obs.y][obs.x] !== undefined) {
        mapGrid[obs.y][obs.x] = 1;
      }
    }
    // Position du joueur
    player.gridX = 2;
    player.gridY = 2;
    player.mp = MAX_MOVE_POINTS;
    player.ap = MAX_ACTION_POINTS;
    player.hp = player.maxHp = 100;
    player.screenX = isoToScreen(player.gridX, player.gridY).x;
    player.screenY = isoToScreen(player.gridX, player.gridY).y;
    // Boss (salle 3 sinon hors-jeu)
    if (room.enemies.some(e => e.type === 'boss')) {
      boss.gridX = room.enemies.find(e => e.type === 'boss').gridX;
      boss.gridY = room.enemies.find(e => e.type === 'boss').gridY;
      boss.hp = boss.maxHp = ENEMY_TYPES.boss.hp;
      boss.mp = ENEMY_TYPES.boss.mp;
      boss.ap = ENEMY_TYPES.boss.ap;
      boss.screenX = isoToScreen(boss.gridX, boss.gridY).x;
      boss.screenY = isoToScreen(boss.gridX, boss.gridY).y;
      boss._removed = false;
    } else {
      boss._removed = true;
      boss.hp = 0;
    }
    // Génération dynamique des ennemis
    bouftousState = room.enemies.filter(e => e.type !== 'boss').map(e => createEnemy(e.type, e.gridX, e.gridY));
    bouftousState.forEach(b => {
      b.screenX = isoToScreen(b.gridX, b.gridY).x;
      b.screenY = isoToScreen(b.gridX, b.gridY).y;
      b._removed = false;
    });
    // Reset visuel complet
    if (window.ctx && window.canvas) {
      window.ctx.clearRect(0, 0, window.canvas.width, window.canvas.height);
    }
    // Calcul de la grille de mouvement du joueur
    reachableTiles = getTilesInRangeBFS(player.gridX, player.gridY, player.mp, [player, boss, ...bouftousState]);
    // Réinitialise toute UI si besoin (barres, overlays, etc.)
    if (typeof updateAllUIWrapper === 'function') updateAllUIWrapper();
    updateTurnOrder(currentTurn);
    playSound('turn');
    showMessage(room.name + ' : Combattez les ennemis !', 3000);
    // Indique la salle dans l'UI (si tu as une div #room-indicator ou sinon dans le message)
    const indicator = document.getElementById('room-indicator');
    if (indicator) indicator.textContent = 'Salle actuelle : ' + room.name;

}

