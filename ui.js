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

// Fonctions d'UI (showMessage, updateHealthBar, updateUI, gestion des boutons sorts) à migrer ici depuis game.js