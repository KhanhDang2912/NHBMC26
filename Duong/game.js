let ga, vit, clicks, targetX, targetY, score = 0, mistakes = 0;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(freq, type, duration) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    click: () => playSound(600, 'sine', 0.1),
    success: () => { playSound(800, 'square', 0.1); setTimeout(() => playSound(1000, 'square', 0.1), 100); },
    fail: () => playSound(200, 'sawtooth', 0.3),
    win: () => [440, 554, 659, 880].forEach((f, i) => setTimeout(() => playSound(f, 'sine', 0.4), i * 150))
};

function refreshPermanentHighScore() {
    const saved = sessionStorage.getItem('tdn_farm_highscore') || 0;
    const elem = document.getElementById('global-high-score');
    if (elem) elem.innerText = saved;
}

window.startGame = function() {
    initAudio(); 
    sounds.click();
    document.getElementById('story-intro').classList.add('hidden');
    document.getElementById('phase1').classList.remove('hidden');
};

window.restartGame = function() {
    score = 0;
    mistakes = 0; // Reset lại số lần sai
    clicks = Math.floor(Math.random() * 3) + 3;
    generateProblem();
    
    // Đặt lại các màn hình
    document.getElementById('phase2').classList.add('hidden');
    document.getElementById('final-stats').classList.add('hidden');
    document.getElementById('phase1-gameover').classList.add('hidden');
    document.getElementById('phase1').classList.remove('hidden');
    
    document.getElementById('p1-feedback').innerText = '';
    document.getElementById('inputX').value = '';
    document.getElementById('inputY').value = '';
    document.getElementById('game-log').innerText = "Nhìn kỹ tỷ lệ và mổ ngay nào! 🔪";
    refreshPermanentHighScore();
};

window.checkPhase1 = function() {
    const x = parseInt(document.getElementById('inputX').value);
    const y = parseInt(document.getElementById('inputY').value);
    
    if (x === targetX && y === targetY) {
        sounds.success();
        document.getElementById('phase1').classList.add('hidden');
        document.getElementById('phase2').classList.remove('hidden');
        updateUI();
    } else {
        mistakes++;
        sounds.fail();
        
        // Kiểm tra xem đã sai quá 1 lần chưa (lần 2 là thua luôn)
        if (mistakes >= 2) {
            document.getElementById('phase1').classList.add('hidden');
            document.getElementById('phase1-gameover').classList.remove('hidden');
        } else {
            // Cảnh báo khi sai lần đầu
            document.getElementById('p1-feedback').innerHTML = 
                "<span style='color: #c0392b; font-weight: bold;'>❌ Sai rồi! Bạn chỉ được sai 1 lần duy nhất nữa thôi!</span>";
        }
    }
};

window.slaughter = function(type) {
    if (clicks <= 0) return;
    let t = (type === 'ga') ? ga : vit;
    if (t.total <= 0) return;

    if (Math.random() < (t.quality / t.total)) {
        score++; t.quality--; sounds.success();
        document.getElementById('game-log').innerText = "✨ Đỉnh cao! Trúng ngay con CHẤT LƯỢNG! 💎";
    } else {
        sounds.click();
        document.getElementById('game-log').innerText = "🍃 Ôi không, con này hơi gầy...";
    }
    t.total--; clicks--; updateUI();
};

function generateProblem() {
    targetX = Math.floor(Math.random() * 10) + 5;
    targetY = Math.floor(Math.random() * 10) + 5;
    const weights = [1.5, 2, 2.5, 3];
    
    let a = weights[Math.floor(Math.random() * 2)]; // Cân nặng Gà
    let b = weights[Math.floor(Math.random() * 2) + 2]; // Cân nặng Vịt
    let totalW = (targetX * a) + (targetY * b);

    // Xuất đề bài dạng văn xuôi
    document.getElementById('problem-desc').innerHTML = 
        `Có <b>${targetX + targetY}</b> con vừa gà vừa vịt, có cân nặng tổng cộng là <b>${totalW.toFixed(1)}kg</b>.<br><br>` +
        `Biết rằng, mỗi con gà nặng <b>${a}kg</b>, mỗi con vịt nặng <b>${b}kg</b>.<br>` +
        `Hỏi có bao nhiêu con gà, bao nhiêu con vịt?`;
    
    ga = { quality: Math.floor(targetX * (Math.random() * 0.4 + 0.3)), total: targetX };
    vit = { quality: Math.floor(targetY * (Math.random() * 0.4 + 0.3)), total: targetY };
}

function updateUI() {
    document.getElementById('ga_stat').innerText = `${ga.quality}/${ga.total}`;
    document.getElementById('vit_stat').innerText = `${vit.quality}/${vit.total}`;
    document.getElementById('clicks').innerText = clicks;

    if (clicks === 0) {
        sounds.win();
        let currentHigh = parseInt(sessionStorage.getItem('tdn_farm_highscore')) || 0;
        if (score > currentHigh) {
            currentHigh = score;
            sessionStorage.setItem('tdn_farm_highscore', currentHigh);
        }
        document.getElementById('final-stats').classList.remove('hidden');
        document.getElementById('final-score').innerText = score;
        document.getElementById('high-score').innerText = currentHigh;
        document.getElementById('rank-text').innerText = score >= 4 ? "🌟 Nông dân đại tài!" : "🤠 Cố gắng luyện tập thêm nhé!";
        refreshPermanentHighScore();
        
        // Ẩn nút mổ để kết thúc
        document.getElementById('action-buttons').classList.add('hidden');
    } else {
        document.getElementById('action-buttons').classList.remove('hidden');
    }
}

function renderMath() {
    if (window.MathJax && window.MathJax.typeset) {
        window.MathJax.typeset();
    }
}

// Gọi renderMath() trong window.onload hoặc sau khi mở UI mới
window.onload = () => { 
    generateProblem(); 
    clicks = 5; 
    refreshPermanentHighScore(); 
    renderMath(); // Vẽ lại công thức khi load trang
};
