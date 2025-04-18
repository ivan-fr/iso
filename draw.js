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
            if (useArbre) {
                // Placement arbre inchangé
                const treeWidth = TILE_W * 1.05;
                const treeHeight = img.height * (treeWidth / img.width);
                const verticalOffset = -TILE_H - treeHeight * 0.68;
                ctx.drawImage(img, -treeWidth/2, verticalOffset, treeWidth, treeHeight);
            } else {
                // Placement caisse : base parfaitement alignée avec la tuile
                const boxWidth = TILE_W * 0.82;
                const boxHeight = img.height * (boxWidth / img.width);
                // On veut que le bas de l'image coïncide avec le bas du losange (screenY + TILE_H/2)
                // Or l'origine du dessin est (0,0) sur la tuile, donc offset = -TILE_H/2 - boxHeight
                const verticalOffset = TILE_H / 2; // Force la caisse à toucher le bas du losange
                ctx.drawImage(img, -boxWidth/2, verticalOffset, boxWidth, boxHeight);
            }
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
    // 1. Dessiner toutes les tuiles de sol et highlights (sauf sous les obstacles)
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            if (mapGrid[y][x] === 1) continue; // On ne dessine pas le sol ici sous les obstacles
            let highlight = null;
            if (playerState === 'idle' && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                highlight = 'rgba(46,204,113,0.22)';
            } else if (playerState === 'aiming' && attackableTiles.some(t => t.x === x && t.y === y)) {
                highlight = 'rgba(52,152,219,0.22)';
            }
            if (hoveredTile && hoveredTile.x === x && hoveredTile.y === y) {
                if (playerState === 'idle' && reachableTiles.some(t => t.x === x && t.y === y && t.cost <= player.mp)) {
                    highlight = 'rgba(39, 174, 96, 0.75)';
                } else if (playerState === 'aiming' && attackableTiles.some(t => t.x === x && t.y === y)) {
                    highlight = 'rgba(41, 128, 185, 0.75)';
                } else {
                    highlight = 'rgba(255,255,255,0.55)';
                }
            }
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
                }
            }
            // Dessine uniquement le sol et le highlight
            drawTile(
                ctx,
                x,
                y,
                mapGrid[y] ? (mapGrid[y][x] === 1 ? 0 : mapGrid[y][x]) : 0,
                highlight,
                tileImage,
                tileImageLoaded,
                mapGrid,
                TILE_W,
                TILE_H,
                GRID_COLS,
                GRID_ROWS
            );
        }
    }

    // --- Affichage de la zone de poussée par-dessus les tuiles ---
    if (playerState === 'aiming' && hoveredTile) {
        const spell = SPELLS[selectedSpell];
        if (spell && spell.push) {
            let x = hoveredTile.x;
            let y = hoveredTile.y;
            let dx = x - player.gridX;
            let dy = y - player.gridY;
            if (!(dx === 0 && dy === 0)) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    dx = Math.sign(dx); dy = 0;
                } else if (Math.abs(dy) > Math.abs(dx)) {
                    dy = Math.sign(dy); dx = 0;
                } else if (dx !== 0) {
                    dx = Math.sign(dx); dy = 0;
                } else if (dy !== 0) {
                    dy = Math.sign(dy); dx = 0;
                }
                let pushX = x;
                let pushY = y;
                for (let step = 0; step < 3; step++) {
                    if (
                        pushX < 0 || pushX >= GRID_COLS ||
                        pushY < 0 || pushY >= GRID_ROWS ||
                        mapGrid[pushY]?.[pushX] === 1
                    ) break;
                    ctx.save();
                    const pos = { x: (ctx.canvas.width / 2) + (pushX - pushY) * (TILE_W / 2), y: (TILE_H * 4) + (pushX + pushY) * (TILE_H / 2) };
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
                    pushX += dx; pushY += dy;
                }
            }
        } else if (spell && spell.aoe) {
            // Affichage de la zone en croix par-dessus les tuiles
            const x = hoveredTile.x;
            const y = hoveredTile.y;
            const aoeTiles = [
                {x: x, y: y},
                {x: x + 1, y: y},
                {x: x - 1, y: y},
                {x: x, y: y + 1},
                {x: x, y: y - 1}
            ];
            for (const tile of aoeTiles) {
                if (tile.x >= 0 && tile.x < GRID_COLS && tile.y >= 0 && tile.y < GRID_ROWS) {
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
                }
            }
        }
    }

    // 2. Collecte tous les obstacles et entités à dessiner, avec leur screenY pour le tri z-index
    let drawables = [];
    // Obstacles
    for (let y = 0; y < GRID_ROWS; y++) {
        for (let x = 0; x < GRID_COLS; x++) {
            if (mapGrid[y][x] === 1) {
                const pos = { x: (ctx.canvas.width / 2) + (x - y) * (TILE_W / 2), y: (TILE_H * 4) + (x + y) * (TILE_H / 2) };
                drawables.push({
                    type: 'obstacle',
                    x, y,
                    screenY: pos.y,
                    draw: () => {
                        // Dessine le sol plat sous l'obstacle, sans profondeur
                        ctx.save();
                        ctx.translate(Math.round(pos.x), Math.round(pos.y));
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
                        } else {
                            ctx.fillStyle = (x + y) % 2 === 0 ? '#b2f7ef' : '#f7d6e0';
                            ctx.beginPath();
                            ctx.moveTo(0, -TILE_H / 2);
                            ctx.lineTo(TILE_W / 2, 0);
                            ctx.lineTo(0, TILE_H / 2);
                            ctx.lineTo(-TILE_W / 2, 0);
                            ctx.closePath();
                            ctx.fill();
                        }
                        ctx.restore();
                        // Dessine l'obstacle
                        ctx.save();
                        ctx.translate(Math.round(pos.x), Math.round(pos.y));
                        const useArbre = (x + y) % 2 === 0;
                        let img = null;
                        if (useArbre && window.arbreImage && window.arbreImage.complete) img = window.arbreImage;
                        if (!useArbre && window.caisseImage && window.caisseImage.complete) img = window.caisseImage;
                        if (img) {
                            ctx.shadowColor = '#222';
                            ctx.shadowBlur = 8;
                            // Taille réduite : 0.7x la largeur de tuile, position ajustée
                            const imgW = TILE_W * 0.7;
                            const imgH = img.height * (imgW / img.width);
                            ctx.drawImage(img, -imgW/2, TILE_H / 2 - imgH, imgW, imgH);
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
                        ctx.restore();
                    }
                });
            }
        }
    }
    // Entités (prend la position screenY réelle pour l'animation)
    for (const item of entities) {
        const screenY = (typeof item.entity.screenY === 'number') ? item.entity.screenY : ((TILE_H * 4) + (item.entity.gridX + item.entity.gridY) * (TILE_H / 2));
        drawables.push({
            type: 'entity',
            screenY,
            draw: () => drawEntity(ctx, item.entity, item.color, ...item.args)
        });
    }
    // Bouftous (utilise drawEntity pour cohérence)
    if (typeof bouftous !== 'undefined') {
        for (const b of bouftous) {
            if (b.hp <= 0) continue;
            const screenY = (typeof b.screenY === 'number') ? b.screenY : ((TILE_H * 4) + (b.gridX + b.gridY) * (TILE_H / 2));
            drawables.push({
                type: 'bouftou',
                screenY,
                draw: () => drawEntity(ctx, b, '#bada55', TILE_W, TILE_H, null, false, null, false, null)
            });
        }
    }
    // 3. Trie tous les drawables par screenY croissant (z-index isométrique parfait)
    drawables.sort((a, b) => a.screenY - b.screenY);
    // 4. Dessine tous les drawables (obstacles et entités) dans l'ordre
    for (const d of drawables) d.draw();
}

// Fonction pour dessiner une entité
export function drawEntity(ctx, entity, color, TILE_W, TILE_H, bossImage, bossImageLoaded, playerImage, playerImageLoaded, currentTurn) {
    let screenX = (typeof entity.screenX === 'number') ? entity.screenX : (ctx.canvas.width / 2 + (entity.gridX - entity.gridY) * (TILE_W / 2));
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

    // Animation disparition d'entité
    let alpha = typeof entity._deathAlpha === 'number' ? entity._deathAlpha : 1;
    let scale = typeof entity._deathScale === 'number' ? entity._deathScale : 1;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(screenX, screenY - entity.size/2);
    ctx.scale(scale, scale);
    ctx.translate(-screenX, -(screenY - entity.size/2));

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
    } else if (entity.size === 26 && entity.type === 'boufton_noir' && window.bouftonNoirImage) {
        // Boufton noir
        const imgWidth = TILE_W * 0.9;
        const imgHeight = window.bouftonNoirImage.height * (imgWidth / window.bouftonNoirImage.width);
        const drawX = screenX - imgWidth / 2;
        const drawY = screenY - imgHeight + (TILE_H / 2);
        ctx.drawImage(window.bouftonNoirImage, drawX, drawY, imgWidth, imgHeight);
    } else if (entity.size === 26 && window.bouftouImage) {
        // Bouftou
        const imgWidth = TILE_W * 0.9;
        const imgHeight = window.bouftouImage.height * (imgWidth / window.bouftouImage.width);
        const drawX = screenX - imgWidth / 2;
        const drawY = screenY - imgHeight + (TILE_H / 2);
        ctx.drawImage(window.bouftouImage, drawX, drawY, imgWidth, imgHeight);
    } else { // Cercle fallback
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(screenX, screenY - entity.size / 2, entity.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    if ((entity.size === 28 && currentTurn === 'player') || (entity.size === 36 && currentTurn === 'boss')) {
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.12 * Math.abs(Math.sin(Date.now() / 300)) * alpha;
        ctx.beginPath();
        ctx.arc(screenX, screenY - entity.size / 2, entity.size * 0.9 * scale, 0, Math.PI * 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
    }

    if (entity.size === 28 && currentTurn === 'player') {
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.12 * Math.abs(Math.sin(Date.now() / 300)) * alpha;
        ctx.beginPath();
        ctx.arc(screenX, screenY - entity.size / 2, entity.size * 0.7 * scale, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
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
            // --- Nouveau design stylé pour chaque sort ---
            if (p.spellIndex === 0) {
                // Mono-cible : étoile lumineuse animée avec traînée
                ctx.globalAlpha = 0.92;
                const angle = Date.now() / 180;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(angle);
                // Étoile centrale
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const r = i % 2 === 0 ? 13 : 6;
                    ctx.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r);
                }
                ctx.closePath();
                ctx.shadowColor = spellColor;
                ctx.shadowBlur = 18;
                ctx.fillStyle = spellColor;
                ctx.fill();
                // Halo
                ctx.globalAlpha = 0.25;
                ctx.beginPath();
                ctx.arc(0, 0, 18, 0, Math.PI * 2);
                ctx.fillStyle = spellColor;
                ctx.fill();
                ctx.restore();
                // Traînée lumineuse
                for (let t = 1; t <= 5; t++) {
                    ctx.globalAlpha = 0.10 * (1 - t / 6);
                    ctx.beginPath();
                    ctx.arc(p.x - p.dx * t * 3, p.y - p.dy * t * 3, 8, 0, Math.PI * 2);
                    ctx.fillStyle = spellColor;
                    ctx.fill();
                }
            } else if (p.spellIndex === 1) {
                // Zone croix : orbe pulsante avec éclairs
                const pulse = (Math.sin(Date.now() / 120) + 1) * 0.5;
                ctx.save();
                ctx.translate(p.x, p.y);
                // Orbe centrale
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(0, 0, 13 + pulse * 4, 0, Math.PI * 2);
                ctx.fillStyle = spellColor;
                ctx.shadowColor = spellColor;
                ctx.shadowBlur = 16;
                ctx.fill();
                // Éclairs croisés
                ctx.globalAlpha = 0.7;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2.2;
                for (let i = 0; i < 4; i++) {
                    ctx.save();
                    ctx.rotate(i * Math.PI / 2 + pulse * 0.2);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, 22 + pulse * 6);
                    ctx.stroke();
                    ctx.restore();
                }
                ctx.restore();
                // Traînée d'orbes
                for (let t = 1; t <= 4; t++) {
                    ctx.globalAlpha = 0.10 * (1 - t / 5);
                    ctx.beginPath();
                    ctx.arc(p.x - p.dx * t * 3, p.y - p.dy * t * 3, 10 + pulse * 2, 0, Math.PI * 2);
                    ctx.fillStyle = spellColor;
                    ctx.fill();
                }
            } else if (p.spellIndex === 2) {
                // Poussée : flèche verte stylisée, plus marquée et dynamique
                ctx.globalAlpha = 0.92;
                const angle = Math.atan2(p.dy, p.dx);
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(angle);
                // Corps de la flèche
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(-28, 12);
                ctx.lineTo(-20, 0);
                ctx.lineTo(-28, -12);
                ctx.closePath();
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 22;
                ctx.fillStyle = '#00ff88';
                ctx.fill();
                // Tige de la flèche
                ctx.globalAlpha = 0.7;
                ctx.beginPath();
                ctx.moveTo(-20, 0);
                ctx.lineTo(-40, 0);
                ctx.lineWidth = 6;
                ctx.strokeStyle = '#00b894';
                ctx.shadowColor = '#00b894';
                ctx.shadowBlur = 10;
                ctx.stroke();
                // Effet de vent stylisé
                ctx.globalAlpha = 0.18;
                for (let i = 1; i <= 3; i++) {
                    ctx.beginPath();
                    ctx.ellipse(-10 * i, 0, 8 - i * 1.5, 4 + i, 0, 0, Math.PI * 2);
                    ctx.fillStyle = '#00ff88';
                    ctx.fill();
                }
                ctx.restore();
                // Traînée verte
                for (let t = 1; t <= 6; t++) {
                    ctx.globalAlpha = 0.09 * (1 - t / 7);
                    ctx.beginPath();
                    ctx.arc(p.x - p.dx * t * 3, p.y - p.dy * t * 3, 8, 0, Math.PI * 2);
                    ctx.fillStyle = '#00ff88';
                    ctx.fill();
                }
            }
        } else {
            // Projectile du boss: orbe rouge pulsante avec traînée
            ctx.shadowColor = '#e74c3c';
            ctx.shadowBlur = 14;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#e74c3c';
            ctx.fill();
            ctx.globalAlpha = 0.25;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
            ctx.fill();
            // Traînée
            for (let t = 1; t <= 4; t++) {
                ctx.globalAlpha = 0.10 * (1 - t / 5);
                ctx.beginPath();
                ctx.arc(p.x - p.dx * t * 3, p.y - p.dy * t * 3, 8, 0, Math.PI * 2);
                ctx.fillStyle = '#e74c3c';
                ctx.fill();
            }
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