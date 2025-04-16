// Fonctions d'affichage, gestion UI, messages, barres de vie, input

// Affichage des messages
export function showMessage(text, duration = 2000) {
    const messageBox = document.getElementById('messageBox');
    messageBox.textContent = text;
    messageBox.classList.add('show');
    clearTimeout(messageBox.timer);
    messageBox.timer = setTimeout(() => {
        messageBox.classList.remove('show');
    }, duration);
}

// Mise à jour des barres de vie
export function updateHealthBar(barElement, currentHp, maxHp) {
    const healthPercentage = Math.max(0, (currentHp / maxHp) * 100);
    barElement.style.width = `${healthPercentage}%`;
    if (healthPercentage < 30) barElement.style.backgroundColor = '#e74c3c';
    else if (healthPercentage < 60) barElement.style.backgroundColor = '#f39c12';
    else {
        if (barElement.id === 'player-health-bar') barElement.style.backgroundColor = '#3498db';
        else barElement.style.backgroundColor = '#2ecc71';
    }
}

// Mise à jour de l'UI générale
export function updateUI(turnIndicator, playerApDisplay, playerMpDisplay, bossApDisplay, bossMpDisplay, player, boss, playerHealthBar, bossHealthBar, currentTurn, isMoving, isBossActing, playerState, endTurnButton, gameOver) {
    turnIndicator.textContent = currentTurn === 'player' ? 'Joueur' : 'Boss';
    playerApDisplay.textContent = player.ap;
    playerMpDisplay.textContent = player.mp;
    bossApDisplay.textContent = boss.ap;
    bossMpDisplay.textContent = boss.mp;
    updateHealthBar(playerHealthBar, player.hp, player.maxHp);
    updateHealthBar(bossHealthBar, boss.hp, boss.maxHp);
    endTurnButton.disabled = isMoving || isBossActing || currentTurn !== 'player' || playerState !== 'idle' || gameOver;
}

/**
 * Update the spell bar selection UI to highlight the selected spell.
 * @param {number} selectedSpellIndex
 */
export function updateSpellBarSelection(selectedSpellIndex) {
    for (let i = 0; i < 3; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (btn) {
            btn.style.outline = (i === selectedSpellIndex) ? '3px solid #fff' : 'none';
            btn.style.background = (i === selectedSpellIndex) ? 'rgba(255,255,255,0.12)' : 'none';
        }
    }
}

/**
 * Set up event listeners for the spell bar buttons.
 * @param {function(number):void} setSelectedSpellFn - Function to set the selected spell index.
 * @param {function():number} getSelectedSpellIndexFn - Function to get the selected spell index.
 * @param {Array} SPELLS - Array of spell objects.
 * @param {function(string, number=):void} showMessageFn - Function to show a message.
 * @param {function():void} updateAllUIFn - Function to update all UI.
 */
export function setupSpellBarListeners(setSelectedSpellFn, getSelectedSpellIndexFn, SPELLS, showMessageFn, updateAllUIFn) {
    for (let i = 0; i < 3; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (btn) {
            btn.addEventListener('click', function() {
                setSelectedSpellFn(i);
                updateSpellBarSelection(i);
                showMessageFn(`Sort sélectionné : ${SPELLS[i].name}`);
                updateAllUIFn();
            });
        }
    }
    updateSpellBarSelection(getSelectedSpellIndexFn());
}

/**
 * Update all UI elements (health bars, AP/MP, turn indicator, etc).
 * @param {object} params - All UI and state references needed for update.
 */
export function updateAllUI({
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
}) {
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
    // Cursor feedback
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    if (gameOver) canvas.style.cursor = 'default';
    else if (currentTurn !== 'player' || isBossActing) canvas.style.cursor = 'default';
    else if (playerState === 'aiming') canvas.style.cursor = 'crosshair';
    else if (playerState === 'idle') canvas.style.cursor = 'pointer';
    else canvas.style.cursor = 'default';
}

// --- Sound system ---
const sounds = {
    turn: new Audio('./arcade-ui-4-229502.mp3'), // free chime
    damage: new Audio('./damage-40114.mp3'), // free hit
    spell: new Audio('./magic-spell-6005.mp3'), // free cast
    move: new Audio('./running-14658.mp3'), // Son de déplacement continu
};

export function playSound(name) {
    if (sounds[name]) {
        if (name === 'move') {
            sounds.move.loop = true;
            sounds.move.currentTime = 0;
            sounds.move.play();
        } else {
            sounds[name].currentTime = 0;
            sounds[name].play();
        }
    }
}

export function stopSound(name) {
    if (sounds[name]) {
        sounds[name].pause();
        sounds[name].currentTime = 0;
    }
}

// --- Turn order indicator animation ---
export function updateTurnOrder(currentTurn) {
    const playerEl = document.getElementById('turnOrder-player');
    const bossEl = document.getElementById('turnOrder-boss');
    if (!playerEl || !bossEl) return;
    if (currentTurn === 'player') {
        playerEl.style.background = '#3498db';
        bossEl.style.background = '#c0392b55';
        playerEl.style.transform = 'scale(1.12)';
        bossEl.style.transform = 'scale(1)';
    } else {
        playerEl.style.background = '#3498db55';
        bossEl.style.background = '#c0392b';
        playerEl.style.transform = 'scale(1)';
        bossEl.style.transform = 'scale(1.12)';
    }
    setTimeout(() => {
        playerEl.style.transform = 'scale(1)';
        bossEl.style.transform = 'scale(1)';
    }, 400);
}

// --- Spell tooltips ---
export function setupSpellTooltips(SPELLS) {
    const tooltip = document.getElementById('spellTooltip');
    for (let i = 0; i < SPELLS.length; i++) {
        const btn = document.getElementById('spell-btn-' + i);
        if (!btn) continue;
        btn.addEventListener('mouseenter', e => {
            tooltip.style.display = 'block';
            tooltip.innerHTML = `<b>${SPELLS[i].name}</b><br>Portée: ${SPELLS[i].range}<br>Dégâts: ${SPELLS[i].damage().toString().replace(/\D/g,'')}+<br>${SPELLS[i].aoe ? 'Zone croix' : SPELLS[i].push ? 'Poussée' : 'Mono-cible'}`;
            const rect = btn.getBoundingClientRect();
            tooltip.style.left = rect.left + rect.width/2 - 80 + 'px';
            tooltip.style.top = (rect.top - 40 + window.scrollY) + 'px';
        });
        btn.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }
}