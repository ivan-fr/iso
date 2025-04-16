// draw.js

// Fonction pour dessiner une tuile isométrique
export function drawTile(ctx, gridX, gridY, type, highlightColor, tileImage, tileImageLoaded, mapGrid, TILE_W, TILE_H, GRID_COLS, GRID_ROWS) {
    // Calculate position with proper centering
    const pos = { 
        x: (ctx.canvas.width / 2) + (gridX - gridY) * (TILE_W / 2),
        y: (TILE_H * 4) + (gridX + gridY) * (TILE_H / 2)
    };
    ctx.save();
    ctx.translate(Math.round(pos.x), Math.round(pos.y));
    // Gestion des obstacles avec images
    if (type === 1) {
        // D'abord, dessiner la tuile de sol sous l'obstacle
        if (tileImageLoaded) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, -TILE_H / 2);
            ctx.lineTo(TILE_W / 2, 0);
            ctx.lineTo(0, TILE_H / 2);
            ctx.lineTo(-TILE_W / 2, 0);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(tileImage, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
            ctx.restore();
        }
        // Ensuite, dessiner l'obstacle (arbre/caisse)
        const useArbre = (gridX + gridY) % 2 === 0;
        let img = null;
        if (useArbre && window.arbreImage && window.arbreImage.complete) img = window.arbreImage;
        if (!useArbre && window.caisseImage && window.caisseImage.complete) img = window.caisseImage;
        if (img) {
            ctx.save();
            ctx.shadowColor = '#222';
            ctx.shadowBlur = 8;
            ctx.drawImage(img, -TILE_W/2, -TILE_H - 18, TILE_W, TILE_W * (img.height/img.width));
            ctx.restore();
        } else {
            ctx.fillStyle = '#7f8c8d';
            ctx.shadowColor = '#222';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(0, -TILE_H / 2);
            ctx.lineTo(TILE_W / 2, 0);
            ctx.lineTo(0, TILE_H / 2);
            ctx.lineTo(-TILE_W / 2, 0);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#434c55';
            ctx.stroke();
        }
    } else {
        if (type !== 1) {
            const depth = 12;
            const isBottomEdge = gridY === GRID_ROWS - 1 || mapGrid[gridY + 1]?.[gridX] === 1;
            const isLeftEdge = gridX === 0 || mapGrid[gridY][gridX - 1] === 1;
            const isRightEdge = gridX === GRID_COLS - 1 || mapGrid[gridY][gridX + 1] === 1;
            if (isLeftEdge) {
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(-TILE_W / 2, 0);
                ctx.lineTo(-TILE_W / 2, depth);
                ctx.lineTo(0, TILE_H / 2 + depth);
                ctx.lineTo(0, TILE_H / 2);
                ctx.closePath();
                ctx.fillStyle = '#8B4513';
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
                ctx.fillStyle = '#8B4513';
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
                ctx.fillStyle = '#8B4513';
                ctx.globalAlpha = 0.7;
                ctx.fill();
                ctx.restore();
            }
        }
        ctx.beginPath();
        ctx.moveTo(0, -TILE_H / 2);
        ctx.lineTo(TILE_W / 2, 0);
        ctx.lineTo(0, TILE_H / 2);
        ctx.lineTo(-TILE_W / 2, 0);
        ctx.closePath();
        if (tileImageLoaded) {
            ctx.save();
            ctx.clip();
            ctx.drawImage(tileImage, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
            ctx.restore();
        } else {
            ctx.fillStyle = (gridX + gridY) % 2 === 0 ? '#b2f7ef' : '#f7d6e0';
            ctx.shadowColor = '#222';
            ctx.shadowBlur = 2;
            ctx.fill();
        }
    }
    if (highlightColor) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = highlightColor;
        ctx.fill();
    }
    ctx.restore();
}

// Fonction pour dessiner la grille
export function drawGrid(ctx, mapGrid, playerState, reachableTiles, attackableTiles, hoveredTile, SPELLS, selectedSpell, TILE_W, TILE_H, GRID_COLS, GRID_ROWS, hasLineOfSight, player, getTilesInRangeBFS, drawTile, tileImage, tileImageLoaded, entities = []) {
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            let highlight = null;
            // Highlight portée déplacement
            if (playerState === 'idle' && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                highlight = 'rgba(46,204,113,0.22)';
            } else if (playerState === 'aiming' && attackableTiles.some(t => t.x === x && t.y === y)) {
                highlight = 'rgba(52,152,219,0.22)';
            }
            // Effet hover déplacement
            if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
                if (playerState === 'idle' && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                    highlight = 'rgba(39, 174, 96, 0.75)';
                } else if (playerState === 'aiming' && attackableTiles.some(t => t.x === x && t.y === y)) {
                    highlight = 'rgba(41, 128, 185, 0.75)';
                } else {
                    highlight = 'rgba(255,255,255,0.55)';
                }
            }
            // Effet zone d'effet du sort si hover en mode visée
            if (playerState === 'aiming' && hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
                const spell = SPELLS[selectedSpell];
                if (spell.aoe) {
                    const aoeTiles = [
                        {x: x, y: y},
                        {x: x + 1, y: y},
                        {x: x - 1, y: y},
                        {x: x, y: y + 1},
                        {x: x, y: y - 1}
                    ];
                    for (const tile of aoeTiles) {
                        if (tile.x >= 0 && tile.x < GRID_COLS && tile.y >= 0 && tile.y < GRID_ROWS) {
                            if (hasLineOfSight(player.gridX, player.gridY, tile.x, tile.y)) {
                                // Highlight AoE tile
                                ctx.save();
                                const pos = { x: (ctx.canvas.width / 2) + (tile.x - tile.y) * (TILE_W / 2), y: (TILE_H * 4) + (tile.x + tile.y) * (TILE_H / 2) };
                                ctx.translate(Math.round(pos.x), Math.round(pos.y));
                                ctx.beginPath();
                                ctx.moveTo(0, -TILE_H / 2);
                                ctx.lineTo(TILE_W / 2, 0);
                                ctx.lineTo(0, TILE_H / 2);
                                ctx.lineTo(-TILE_W / 2, 0);
                                ctx.closePath();
                                ctx.fillStyle = 'rgba(230, 126, 34, 0.65)';
                                ctx.fill();
                                ctx.restore();
                            } else {
                                ctx.save();
                                const pos = { x: (ctx.canvas.width / 2) + (tile.x - tile.y) * (TILE_W / 2), y: (TILE_H * 4) + (tile.x + tile.y) * (TILE_H / 2) };
                                ctx.translate(Math.round(pos.x), Math.round(pos.y));
                                ctx.beginPath();
                                ctx.moveTo(0, -TILE_H / 2);
                                ctx.lineTo(TILE_W / 2, 0);
                                ctx.lineTo(0, TILE_H / 2);
                                ctx.lineTo(-TILE_W / 2, 0);
                                ctx.closePath();
                                ctx.fillStyle = 'rgba(120, 120, 120, 0.35)';
                                ctx.fill();
                                ctx.restore();
                            }
                        }
                    }
                } else if (spell.push) {
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
                        ctx.save();
                        const pos = { x: (ctx.canvas.width / 2) + (nextPushX - nextPushY) * (TILE_W / 2), y: (TILE_H * 4) + (nextPushX + nextPushY) * (TILE_H / 2) };
                        ctx.translate(Math.round(pos.x), Math.round(pos.y));
                        ctx.beginPath();
                        ctx.moveTo(0, -TILE_H / 2);
                        ctx.lineTo(TILE_W / 2, 0);
                        ctx.lineTo(0, TILE_H / 2);
                        ctx.lineTo(-TILE_W / 2, 0);
                        ctx.closePath();
                        ctx.fillStyle = 'rgba(0,184,148,0.55)';
                        ctx.fill();
                        ctx.restore();
                        pushX = nextPushX; pushY = nextPushY;
                    }
                }
            }
            // On détermine s'il y a une entité sur cette case
            const entityOnTile = entities.find(item => item.entity.gridX === x && item.entity.gridY === y);
            // Si une entité animée est sur la case, on dessine la highlight AVANT l'entité, et pas après
            if (highlight && !entityOnTile) {
                // Cas normal : highlight dessinée avec la tuile
                drawTile(
                    ctx,
                    x,
                    y,
                    mapGrid[y] ? mapGrid[y][x] : 0,
                    highlight,
                    tileImage,
                    tileImageLoaded,
                    mapGrid,
                    TILE_W,
                    TILE_H,
                    GRID_COLS,
                    GRID_ROWS
                );
            } else {
                // Pas de highlight, ou highlight mais entité présente : on dessine la tuile sans highlight
                drawTile(
                    ctx,
                    x,
                    y,
                    mapGrid[y] ? mapGrid[y][x] : 0,
                    null,
                    tileImage,
                    tileImageLoaded,
                    mapGrid,
                    TILE_W,
                    TILE_H,
                    GRID_COLS,
                    GRID_ROWS
                );
            }
            // Si highlight et entité présente, on dessine la highlight juste avant l'entité (sous l'entité)
            if (highlight && entityOnTile) {
                ctx.save();
                const pos = { x: (ctx.canvas.width / 2) + (x - y) * (TILE_W / 2), y: (TILE_H * 4) + (x + y) * (TILE_H / 2) };
                ctx.translate(Math.round(pos.x), Math.round(pos.y));
                ctx.beginPath();
                ctx.moveTo(0, -TILE_H / 2);
                ctx.lineTo(TILE_W / 2, 0);
                ctx.lineTo(0, TILE_H / 2);
                ctx.lineTo(-TILE_W / 2, 0);
                ctx.closePath();
                ctx.fillStyle = highlight;
                ctx.globalAlpha = 1;
                ctx.fill();
                ctx.restore();
            }
            // Entité
            if (entityOnTile) {
                drawEntity(ctx, entityOnTile.entity, entityOnTile.color, ...entityOnTile.args);
            }
        }
    }
}

// Fonction pour dessiner une entité
export function drawEntity(ctx, entity, color, TILE_W, TILE_H, bossImage, bossImageLoaded, playerImage, playerImageLoaded, currentTurn) {
    let screenX = (typeof entity.screenX === 'number') ? entity.screenX : ((TILE_W * 14) / 2 + (entity.gridX - entity.gridY) * (TILE_W / 2));
    let screenY = (typeof entity.screenY === 'number') ? entity.screenY : (TILE_H * 4 + (entity.gridX + entity.gridY) * (TILE_H / 2));
    entity.screenX = screenX;
    entity.screenY = screenY;
    // Ombre limitée à la case (clip losange)
    const zRatio = Math.max(0, Math.min(1, (entity.gridX + entity.gridY) / (TILE_W + TILE_H)));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenX, screenY + 6 - TILE_H / 2);
    ctx.lineTo(screenX + TILE_W / 2, screenY + 6);
    ctx.lineTo(screenX, screenY + 6 + TILE_H / 2);
    ctx.lineTo(screenX - TILE_W / 2, screenY + 6);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = 0.18 + 0.10 * zRatio;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 7 + 8 * zRatio;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 6, entity.size * 0.55, entity.size * 0.18 + 2 * zRatio, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    if (entity.size === 36 && bossImageLoaded) {
        const imgWidth = TILE_W * 1.2;
        const imgHeight = bossImage.height * (imgWidth / bossImage.width);
        const drawX = screenX - imgWidth / 2;
        const drawY = screenY - imgHeight + (TILE_H / 2);
        ctx.drawImage(bossImage, drawX, drawY, imgWidth, imgHeight);
    } else if (entity.size === 28 && playerImageLoaded) {
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
    if ((entity.size === 28 && currentTurn === 'player') || (entity.size === 36 && currentTurn === 'boss')) {
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
    if (entity.size === 28 && currentTurn === 'player') {
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.12 * Math.abs(Math.sin(Date.now() / 300));
        ctx.beginPath();
        ctx.arc(screenX, screenY - entity.size / 2, entity.size * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
        ctx.restore();
    }
}

// Fonction pour dessiner les projectiles
export function drawProjectiles(ctx, projectiles, SPELLS) {
    projectiles.forEach(p => {
        ctx.save();
        if (p.owner === 'player') {
            let spellColor = '#f1c40f';
            if (typeof p.spellIndex === 'number' && SPELLS && SPELLS[p.spellIndex]) {
                spellColor = SPELLS[p.spellIndex].color;
            }
            // Glow effect
            ctx.shadowColor = spellColor;
            ctx.shadowBlur = 18;
            // Mono-cible: étoile brillante qui tourne avec glow
            if (p.spellIndex === 0) {
                ctx.globalAlpha = 0.85;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
                ctx.fillStyle = spellColor;
                ctx.fill();
                ctx.globalAlpha = 1;
                const angle = Date.now() / 200;
                for (let i = 0; i < 6; i++) {
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(angle + i * Math.PI / 3);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, 18);
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.7;
                    ctx.stroke();
                    ctx.restore();
                }
            } else if (p.spellIndex === 1) {
                // Zone croix: cercles concentriques qui pulsent + trailing effect
                const pulse = (Math.sin(Date.now() / 150) + 1) * 0.5;
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 12 + pulse * 6, 0, Math.PI * 2);
                ctx.fillStyle = spellColor;
                ctx.fill();
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 22 + pulse * 8, 0, Math.PI * 2);
                ctx.strokeStyle = spellColor;
                ctx.lineWidth = 3;
                ctx.stroke();
                // Trail
                for (let t = 1; t <= 4; t++) {
                    ctx.globalAlpha = 0.12 * (1 - t / 5);
                    ctx.beginPath();
                    ctx.arc(p.x - p.dx * t * 3, p.y - p.dy * t * 3, 10 + pulse * 4, 0, Math.PI * 2);
                    ctx.fillStyle = spellColor;
                    ctx.fill();
                }
            } else if (p.spellIndex === 2) {
                // Poussée: cône dynamique + trailing particles
                ctx.globalAlpha = 0.7;
                const angle = Math.atan2(p.dy, p.dx);
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-18, 10);
                ctx.lineTo(-18, -10);
                ctx.closePath();
                ctx.fillStyle = spellColor;
                ctx.shadowColor = '#fff';
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.restore();
                // Trailing particles
                for (let t = 1; t <= 5; t++) {
                    ctx.globalAlpha = 0.13 * (1 - t / 6);
                    ctx.beginPath();
                    ctx.arc(p.x - p.dx * t * 3, p.y - p.dy * t * 3, 7, 0, Math.PI * 2);
                    ctx.fillStyle = spellColor;
                    ctx.fill();
                }
            }
        } else {
            // Projectile du boss: red orb with pulse and trail
            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 12;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#e74c3c';
            ctx.fill();
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(p.x - p.dx * 2, p.y - p.dy * 2, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    });
}

// Fonction pour dessiner les animations de dégâts
export function drawDamageAnimations(ctx, damageAnimations) {
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

export function drawBackground(ctx, canvas) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#a8edea');
    grad.addColorStop(1, '#fed6e3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Draw end game overlay (like legacy drawEndGame)
export function drawEndGameOverlay(ctx, canvas, gameOver, player) {
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
        ctx.fillText(player.hp > 0 ? 'VICTOIRE !' : 'GAME OVER', canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }
}

// Utility: sort and draw entities by Y (for correct isometric overlap)
export function drawEntitiesSorted(ctx, entities, drawEntityFn) {
    entities.sort((a, b) => (a.entity.screenY || 0) - (b.entity.screenY || 0));
    entities.forEach(item => drawEntityFn(ctx, item.entity, item.color, ...item.args));
}