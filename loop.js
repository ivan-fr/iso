import { drawBackground, drawGrid, drawEntity, drawProjectiles, drawDamageAnimations } from './draw.js';
import { player, boss } from './entities.js';
import { projectiles, damageAnimations, gameOver } from './game.js';
import { SPELLS } from './spells.js';

export function startGameLoop() {
    function gameLoop() {
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        drawBackground(ctx, canvas);
        drawGrid();
        drawEntity(ctx, player, '#3498db');
        drawEntity(ctx, boss, '#c0392b');
        drawProjectiles(ctx, projectiles, SPELLS);
        drawDamageAnimations(ctx, damageAnimations);
        // ...autres appels de rendu ou de logique si besoin...
        if (!gameOver) requestAnimationFrame(gameLoop);
    }
    gameLoop();
}