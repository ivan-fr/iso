// draw.js

// Fonction pour dessiner une tuile isométrique
export function drawTile(ctx, gridX, gridY, type, highlightColor, tileImage, tileImageLoaded, mapGrid, TILE_W, TILE_H, GRID_COLS, GRID_ROWS) {
    const pos = { x: (TILE_W * GRID_COLS) / 2 + (gridX - gridY) * (TILE_W / 2), y: TILE_H * 4 + (gridX + gridY) * (TILE_H / 2) };
    ctx.save();
    ctx.translate(Math.round(pos.x), Math.round(pos.y));
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
    if (type === 1) {
        ctx.fillStyle = '#7f8c8d';
        ctx.shadowColor = '#222';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#434c55';
        ctx.stroke();
    } else if (tileImageLoaded) {
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
    if (highlightColor) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = highlightColor;
        ctx.fill();
    }
    ctx.restore();
}

// Fonction pour dessiner la grille
export function drawGrid(ctx, mapGrid, playerState, reachableTiles, attackableTiles, hoveredTile, SPELLS, selectedSpell, TILE_W, TILE_H, GRID_COLS, GRID_ROWS, hasLineOfSight, player, getTilesInRangeBFS, drawTile) {
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
                                drawTile(ctx, tile.x, tile.y, mapGrid[tile.y][tile.x], 'rgba(230, 126, 34, 0.65)');
                            } else {
                                drawTile(ctx, tile.x, tile.y, mapGrid[tile.y][tile.x], 'rgba(120, 120, 120, 0.35)');
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
                        drawTile(ctx, nextPushX, nextPushY, mapGrid[nextPushY][nextPushX], 'rgba(0,184,148,0.55)');
                        pushX = nextPushX; pushY = nextPushY;
                    }
                }
            }
            drawTile(ctx, x, y, mapGrid[y][x], highlight);
        }
    }
}

// Fonction pour dessiner une entité
export function drawEntity(ctx, entity, color, TILE_W, TILE_H, bossImage, bossImageLoaded, playerImage, playerImageLoaded, currentTurn) {
    let screenX = (typeof entity.screenX === 'number') ? entity.screenX : ((TILE_W * 14) / 2 + (entity.gridX - entity.gridY) * (TILE_W / 2));
    let screenY = (typeof entity.screenY === 'number') ? entity.screenY : (TILE_H * 4 + (entity.gridX + entity.gridY) * (TILE_H / 2));
    entity.screenX = screenX;
    entity.screenY = screenY;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 6, entity.size * 0.8, entity.size * 0.3, 0, 0, Math.PI * 2);
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
            const spell = SPELLS[p.spellIndex];
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = spell.color;
            ctx.fill();
            if (p.spellIndex === 0) {
                ctx.globalAlpha = 1;
                const angle = Date.now() / 200;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(
                        p.x + Math.cos(angle + i * Math.PI / 2) * 12,
                        p.y + Math.sin(angle + i * Math.PI / 2) * 12
                    );
                    ctx.strokeStyle = spell.color;
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            } else if (p.spellIndex === 1) {
                const pulse = (Math.sin(Date.now() / 150) + 1) * 0.5;
                ctx.globalAlpha = 0.5 - pulse * 0.3;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 10 + pulse * 5, 0, Math.PI * 2);
                ctx.strokeStyle = spell.color;
                ctx.lineWidth = 2;
                ctx.stroke();
            } else if (p.spellIndex === 2) {
                ctx.globalAlpha = 0.6;
                const angle = Math.atan2(p.dy, p.dx);
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(
                    p.x - Math.cos(angle) * 15 + Math.cos(angle + Math.PI/2) * 8,
                    p.y - Math.sin(angle) * 15 + Math.sin(angle + Math.PI/2) * 8
                );
                ctx.lineTo(
                    p.x - Math.cos(angle) * 15 + Math.cos(angle - Math.PI/2) * 8,
                    p.y - Math.sin(angle) * 15 + Math.sin(angle - Math.PI/2) * 8
                );
                ctx.closePath();
                ctx.fillStyle = spell.color;
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(p.x - p.dx * 2, p.y - p.dy * 2, 3, 0, Math.PI * 2);
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