const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');

let cw = window.innerWidth;
let ch = window.innerHeight;

canvas.width = cw;
canvas.height = ch;

window.addEventListener('resize', () => {
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = cw;
    canvas.height = ch;
    render();
});

// Coordinate System Bounds
const X_MIN = -10;
const X_MAX = 10;
const Y_MIN = -10;
const Y_MAX = 10;

// UI Elements
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const finalScoreEl = document.getElementById('final-score');
const formulaInput = document.getElementById('formula-input');
const runBtn = document.getElementById('run-btn');
const pointsDisplay = document.getElementById('points-display');
const msgEl = document.getElementById('message');
const taskDesc = document.getElementById('task-desc');
const startOverlay = document.getElementById('start-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State
let score = 0;
let carPos = { x: 0, y: 0 };
let currentTargets = [];
let gameState = 'IDLE'; // IDLE, ANIMATING
let currentPath = []; // Path for the animated line
let carAnimationIndex = 0;
let timeLeft = 90;
let timerInterval = null;
let isPlaying = false;

// Map math coords to canvas coords
function mapX(x) {
    return ((x - X_MIN) / (X_MAX - X_MIN)) * cw;
}

function mapY(y) {
    return ch - ((y - Y_MIN) / (Y_MAX - Y_MIN)) * ch;
}

// Generate new level
function generateLevel() {
    formulaInput.value = '';
    formulaInput.focus();
    hideMessage();
    
    // 70% chance of 3 points (parabola), 30% chance for 2 points (line)
    const isParabola = Math.random() < 0.7;
    const targetsNeeded = isParabola ? 2 : 1;

    let funcBody = '';
    if (isParabola) {
        const a_options = [-2, -1, 1, 2, 0.5, -0.5];
        let a = a_options[Math.floor(Math.random() * a_options.length)];
        let h = Math.floor(Math.random() * 5) - 2; // -2 to 2
        let k = Math.floor(Math.random() * 9) - 4; // -4 to 4
        funcBody = `(${a}) * (x - ${h})^2 + ${k}`;
    } else {
        const a_options = [-3, -2, -1, 1, 2, 3, 0.5, -0.5];
        let a = a_options[Math.floor(Math.random() * a_options.length)];
        let b = Math.floor(Math.random() * 11) - 5;
        funcBody = `(${a}) * x + ${b}`;
    }
    
    const compiledEq = math.compile(funcBody);
    let generatedPoints = [];
    const usedX = new Set();
    let attempts = 0;
    
    while(generatedPoints.length < targetsNeeded + 1 && attempts < 200) {
        attempts++;
        let x = Math.floor(Math.random() * 17) - 8;
        if (usedX.has(x)) continue;
        
        let y = compiledEq.evaluate({ x });
        if (Math.abs(y - Math.round(y)) < 0.0001 && Math.abs(y) <= 8) {
            y = Math.round(y);
            usedX.add(x);
            generatedPoints.push({ x, y });
        }
    }

    if (generatedPoints.length < targetsNeeded + 1) {
        // Fallback simple line
        generatedPoints = [];
        let b = Math.floor(Math.random() * 5) - 2;
        for(let i=0; i<targetsNeeded+1; i++) {
            generatedPoints.push({ x: i - Math.floor((targetsNeeded+1)/2), y: i - Math.floor((targetsNeeded+1)/2) + b });
        }
    }

    carPos = generatedPoints[0];
    currentTargets = generatedPoints.slice(1);

    // Sort targets by X coordinate just for nice display
    const allPoints = [carPos, ...currentTargets].sort((a, b) => a.x - b.x);

    // Update UI
    let pointsHtml = `<div class="point-item car-point">Car: (${carPos.x}, ${carPos.y})</div>`;
    currentTargets.forEach((pt, i) => {
        pointsHtml += `<div class="point-item">Target ${i + 1}: (${pt.x}, ${pt.y})</div>`;
    });
    
    pointsDisplay.innerHTML = pointsHtml;
    taskDesc.innerText = `Connect the points with a valid function f(x).`;
    
    gameState = 'IDLE';
    currentPath = [];
    render();
}

function showMessage(text, isError = false) {
    msgEl.innerText = text;
    msgEl.className = `message show ${isError ? 'error' : 'success'}`;
}

function hideMessage() {
    msgEl.className = 'message';
}

function validateFunction(compiledEq) {
    const allPoints = [carPos, ...currentTargets];
    for (const pt of allPoints) {
        try {
            const evaluatedY = compiledEq.evaluate({ x: pt.x });
            const diff = Math.abs(evaluatedY - pt.y);
            if (diff > 0.05) { return false; }
        } catch (e) {
            return false;
        }
    }
    return true;
}

runBtn.addEventListener('click', () => {
    if (gameState !== 'IDLE' || !isPlaying) return;

    const formula = formulaInput.value.trim();
    if (!formula) {
        showMessage("Enter a formula!", true);
        return;
    }

    let compiledEq;
    try {
        compiledEq = math.compile(formula);
        // Test evaluate once
        compiledEq.evaluate({x: 0});
    } catch (e) {
        showMessage("Invalid formula syntax!", true);
        return;
    }

    const isValid = validateFunction(compiledEq);

    if (isValid) {
        showMessage("Correct! Routing...", false);
        startSuccessAnimation(compiledEq);
    } else {
        // Find which point missed or just general message
        showMessage("Function does not pass through all points.", true);
        drawFailedAttempt(compiledEq);
    }
});

formulaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        runBtn.click();
    }
});

function startGame() {
    startOverlay.classList.add('hidden');
    gameOverOverlay.classList.add('hidden');
    score = 0;
    scoreEl.innerText = score;
    timeLeft = 90;
    updateTimeDisplay();
    isPlaying = true;
    runBtn.disabled = false;
    formulaInput.disabled = false;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimeDisplay();
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
    
    generateLevel();
}

function endGame() {
    clearInterval(timerInterval);
    isPlaying = false;
    runBtn.disabled = true;
    formulaInput.disabled = true;
    finalScoreEl.innerText = score;
    gameOverOverlay.classList.remove('hidden');
}

function updateTimeDisplay() {
    let m = Math.floor(timeLeft / 60);
    let s = timeLeft % 60;
    timeEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Render logic
function renderGrid() {
    ctx.lineWidth = 1;

    // Minor lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = X_MIN; i <= X_MAX; i++) {
        const x = mapX(i);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
    }
    for (let i = Y_MIN; i <= Y_MAX; i++) {
        const y = mapY(i);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(102, 252, 241, 0.4)';
    ctx.lineWidth = 2;
    // Y-axis
    ctx.beginPath(); ctx.moveTo(mapX(0), 0); ctx.lineTo(mapX(0), ch); ctx.stroke();
    // X-axis
    ctx.beginPath(); ctx.moveTo(0, mapY(0)); ctx.lineTo(cw, mapY(0)); ctx.stroke();
    
    // Labels
    ctx.fillStyle = 'rgba(102, 252, 241, 0.8)';
    ctx.font = '12px Orbitron';
    for (let i = X_MIN; i <= X_MAX; i++) {
        if (i !== 0 && i % 2 === 0) ctx.fillText(i, mapX(i) - 5, mapY(0) + 15);
    }
    for (let i = Y_MIN; i <= Y_MAX; i++) {
        if (i !== 0 && i % 2 === 0) ctx.fillText(i, mapX(0) + 10, mapY(i) + 5);
    }
}

function renderPoints() {
    // Target points
    ctx.fillStyle = '#66fcf1';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#66fcf1';
    for (const pt of currentTargets) {
        const px = mapX(pt.x);
        const py = mapY(pt.y);
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
}

function renderCar(x, y, angle) {
    ctx.save();
    ctx.translate(mapX(x), mapY(y));
    // In canvas, 0 angle points right, but our Y is flipped.
    // If we calculate angle using atan2 in map coordinates, we apply standard rotation but remember screen Y is inverted.
    ctx.rotate(angle);

    // Glow
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff007f';
    
    // Car shape (Sci-fi wedge)
    ctx.fillStyle = '#ff007f';
    ctx.beginPath();
    ctx.moveTo(15, 0);       // Nose
    ctx.lineTo(-10, 8);      // Back Right
    ctx.lineTo(-5, 0);       // Burner
    ctx.lineTo(-10, -8);     // Back Left
    ctx.closePath();
    ctx.fill();

    // Engine glow
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    ctx.arc(-8, 0, 3, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();
}

// Temporary render for a failed attempt
let tempPath = [];
function drawFailedAttempt(compiledEq) {
    tempPath = [];
    for (let x = X_MIN; x <= X_MAX; x += 0.1) {
        try {
            const y = compiledEq.evaluate({ x });
            tempPath.push({ x, y });
        } catch (e) {}
    }
    
    // Fade out after a second
    setTimeout(() => { tempPath = []; render(); }, 2000);
    render();
}

function renderFunctionPath(pointsArray, color, shadowColor, lengthLimit = pointsArray.length) {
    if (pointsArray.length === 0) return;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = shadowColor;
    ctx.lineJoin = 'round';
    
    let first = true;
    for (let i = 0; i < lengthLimit; i++) {
        const p = pointsArray[i];
        if (p.y > Y_MAX * 2 || p.y < Y_MIN * 2) {
            first = true; // Break line if it goes wildly out of bounds
            continue;
        }
        const px = mapX(p.x);
        const py = mapY(p.y);
        if (first) {
            ctx.moveTo(px, py);
            first = false;
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function render() {
    ctx.clearRect(0, 0, cw, ch);
    renderGrid();
    
    // Draw failed attempt if exists
    if (tempPath.length > 0) {
        renderFunctionPath(tempPath, 'rgba(252, 102, 102, 0.5)', 'rgba(252, 102, 102, 0)', tempPath.length);
    }

    renderPoints();

    if (gameState === 'ANIMATING') {
        renderFunctionPath(currentPath, '#66fcf1', '#00ffff', currentPath.length);
        
        if (carAnimationIndex < currentPath.length) {
            const p = currentPath[carAnimationIndex];
            // Calculate angle based on canvas coordinates
            let angle = 0;
            if (carAnimationIndex < currentPath.length - 1) {
                const nextP = currentPath[carAnimationIndex + 1];
                const dxCanvas = mapX(nextP.x) - mapX(p.x);
                const dyCanvas = mapY(nextP.y) - mapY(p.y); // Flipped Y implicitly handled here
                angle = Math.atan2(dyCanvas, dxCanvas);
            }
            renderCar(p.x, p.y, angle);
        }
    } else {
        // Idle
        // Render car idle
        renderCar(carPos.x, carPos.y, 0); // pointing right by default
    }
}

// Animation Loop
let reqId;
function startSuccessAnimation(compiledEq) {
    gameState = 'ANIMATING';
    runBtn.disabled = true;
    formulaInput.disabled = true;

    // Generate path covering the domain
    // We want the car to animate from the smallest x target/car out to the bounds, or just entirely across screen
    // We will just animate the whole curve from X_MIN to X_MAX
    currentPath = [];
    for (let x = X_MIN; x <= X_MAX; x += 0.1) {
        try {
            const y = compiledEq.evaluate({ x });
            // Only add points loosely in visible bounds
            if (y > Y_MIN * 3 && y < Y_MAX * 3) {
                currentPath.push({ x, y });
            }
        } catch (e) {}
    }

    // Set car animation index to starting point (min X of the current problem points)
    const allPoints = [carPos, ...currentTargets];
    const minPointX = Math.min(...allPoints.map(p => p.x));
    
    // find index in currentPath closest to minPointX
    let closestDist = Infinity;
    carAnimationIndex = 0;
    currentPath.forEach((p, idx) => {
        const d = Math.abs(p.x - minPointX);
        if (d < closestDist) {
            closestDist = d;
            carAnimationIndex = idx;
        }
    });

    animate();
}

function animate() {
    render();
    
    carAnimationIndex += 1; // Animation speed

    if (carAnimationIndex >= currentPath.length) {
        // Animation finished
        cancelAnimationFrame(reqId);
        completeLevel();
        return;
    }
    
    reqId = requestAnimationFrame(animate);
}

function completeLevel() {
    // Add score
    const pointsEarned = currentTargets.length;
    score += pointsEarned;
    scoreEl.innerText = score;
    scoreEl.style.transform = 'scale(1.5)';
    setTimeout(() => scoreEl.style.transform = 'scale(1)', 300);

    setTimeout(() => {
        if (!isPlaying) return; // Don't generate if time is up
        runBtn.disabled = false;
        formulaInput.disabled = false;
        generateLevel();
    }, 1500); // Pause for 1.5 seconds before next level
}

// Init Render
render();
