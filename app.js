// --- INITIALISATION ---
let pendingData = null; // Stocke la séance en attente de pastille

let currentJournalIndex = 0; 
let filteredLogsForJournal = [];
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    
    // On attend que les données soient chargées avant de dessiner
    await renderLogs(); 
    // 1. On règle les dates par défaut (1 mois)
    setDefaultFilterDates();
    // FORCER LA SÉLECTION "TOUT VOIR"
    const limitSelect = document.getElementById('stats-limit');
    if (limitSelect) {
        limitSelect.value = "all"; 
    }

    // Lancer le premier affichage
    // 2. On lance le dashboard qui va lire ces dates
    await updateGoalsDashboard();
    // VERIFICATION CHRONO MUSIQUE EN COURS
    // RÉCUPÉRATION COURSE
    const savedIsRunning = localStorage.getItem('run_isRunning') === 'true';
    runSecondsBeforePause = parseInt(localStorage.getItem('run_secondsBeforePause')) || 0;
    runStartTime = parseInt(localStorage.getItem('run_startTime'));

    if (savedIsRunning && runStartTime) {
        isRunning = true;
        const btn = document.getElementById('btn-run');
        if(btn) {
            btn.innerText = "Pause";
            btn.classList.replace('bg-blue-600', 'bg-orange-500');
        }
        launchRunInterval();
    } else if (runSecondsBeforePause > 0) {
        // Cas où l'appli a fermé alors qu'on était en PAUSE
        runSeconds = runSecondsBeforePause;
        updateRunDisplay();
        const btn = document.getElementById('btn-run');
        if(btn) btn.innerText = "Reprendre";
    }
    setTimeout(() => {
        checkActiveMusicSession();
    }, 50);
});









function checkActiveMusicSession() {
    const savedMusicStart = localStorage.getItem('active_music_start');
    if (savedMusicStart) {
        const instrument = localStorage.getItem('active_music_instrument');
        
        // On affiche la section proprement
        showSection('musique'); 

        // On bascule l'affichage interne du timer
        const setup = document.getElementById('music-setup');
        const active = document.getElementById('music-active');
        if (setup && active) {
            setup.classList.add('hidden');
            active.classList.remove('hidden');
            document.getElementById('active-instrument-name').innerText = instrument;
            
            // On relance la boucle du chrono
            launchMusicInterval();
        }
    }
}


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
        .then(reg => {
        console.log('Le gardien (Service Worker) est bien installé !');
        })
        .catch(err => {
            console.log('Échec de l\'installation du gardien :', err);
        });
    });
}

// --- NAVIGATION ---
function showSection(id) {
    // 1. Masquer toutes les sections
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    
    // 2. Afficher la bonne section
    const targetSection = document.getElementById('section-' + id);
    if (targetSection) targetSection.classList.remove('hidden');
    
    // 3. Mettre à jour la navigation
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.replace('text-violet-500', 'text-slate-400');
        
        // Si on n'a pas d'event (appel manuel), on cherche le bouton qui correspond à l'id
        if (!window.event && btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${id}'`)) {
            btn.classList.replace('text-slate-400', 'text-violet-500');
        }
    });

    // Si c'est un clic, on active le bouton cliqué normalement
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.replace('text-slate-400', 'text-violet-500');
    }

    // 4. Triggers spécifiques
    if (id === 'stats') updateStatsDashboard();
    if (id === 'stretching') renderStretchCatalog();
    if (id === 'objectifs') {
        renderSchedule();
        updateGoalsDashboard();
    }
    if (id === 'journal') renderJournal();
    if (id === 'sommeil') updateSleepChart();
}

// --- VARIABLES GLOBALES JOURNAL ---
// Ces variables doivent être accessibles par toutes les fonctions ci-dessous


// --- LOGIQUE DU JOURNAL ---

// --- VARIABLES GLOBALES ---

// --- VARIABLES GLOBALES ---

let groupedLogsByDay = []; 


async function renderJournal() {
    const container = document.getElementById('journal-container');
    if (!container) return;

    const allLogs = await DB.getLogs();
    
    // Groupement par date LOCALE (évite le bug du 17/18)
    const groups = allLogs.reduce((acc, log) => {
        const d = new Date(log.timestamp);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(log);
        return acc;
    }, {});

    // On transforme en tableau trié par date (le plus récent est l'index 0)
    groupedLogsByDay = Object.keys(groups)
        .sort((a, b) => b.localeCompare(a))
        .map(date => ({ date, logs: groups[date] }));

    currentJournalIndex = 0; 
    displayJournalPage();
}

function displayJournalPage() {
    const container = document.getElementById('journal-container');
    const dateTitle = document.getElementById('journal-current-date');
    const dateSubtitle = document.getElementById('journal-date-subtitle');
    
    if (!container) return;
    if (groupedLogsByDay.length === 0) {
        container.innerHTML = `<div class="p-12 text-center text-slate-600 italic">Aucune séance trouvée.</div>`;
        return;
    }

    const dayGroup = groupedLogsByDay[currentJournalIndex];
    
    // --- FIX DATE LOCALE ---
    // On recrée la date à partir de "YYYY-MM-DD" pour éviter le décalage UTC
    const [y, m, d] = dayGroup.date.split('-');
    const dateObj = new Date(y, m - 1, d);
    
    if(dateTitle) dateTitle.innerText = dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    if(dateSubtitle) dateSubtitle.innerText = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' });

    const logsHTML = dayGroup.logs.map(log => {
        // --- LOGIQUE DE RÉCUPÉRATION DU COMMENTAIRE ---
        // On vérifie toutes les variantes possibles pour ne rien rater
        const finalComment = log.comment || log.commentaires || "Pas de commentaire";

        const typeColors = {
            'Escalade': 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
            'Course': 'border-blue-500/30 text-blue-400 bg-blue-500/10',
            'Musique': 'border-pink-500/30 text-pink-400 bg-pink-500/10',
            'Étirement': 'border-violet-500/30 text-violet-400 bg-violet-500/10'
        };
        const colorClass = typeColors[log.type] || 'border-slate-700 text-slate-400 bg-slate-800/50';

        return `
            <div class="bg-slate-900/40 border border-slate-800 rounded-3xl p-5 mb-4 shadow-lg animate-in fade-in zoom-in duration-300">
                <div class="flex justify-between items-center mb-4">
                    <span class="text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest ${colorClass}">
                        ${log.type} ${log.exercise ? '• ' + log.exercise : ''}
                    </span>
                    <button onclick="deleteLog('${log.id}')" class="text-slate-600 hover:text-red-400 transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>

                <div class="space-y-4">
                    ${typeof renderLogDetails === 'function' ? renderLogDetails(log) : ''}
                </div>

                ${finalComment ? `
                    <div class="mt-4 p-4 bg-violet-600/10 border-l-4 border-violet-500 rounded-r-2xl">
                        <p class="text-sm text-slate-200 leading-relaxed font-medium">
                            <span class="text-violet-400 text-lg mr-1 opacity-50">“</span>${finalComment}<span class="text-violet-400 text-lg ml-1 opacity-50">”</span>
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="animate-in slide-in-from-right-4 duration-300">
            ${logsHTML}
            <div class="mt-8 text-center text-[10px] font-mono text-slate-700 uppercase tracking-widest">
                JOUR ${currentJournalIndex + 1} / ${groupedLogsByDay.length}
            </div>
        </div>
    `;
    
    if (window.lucide) lucide.createIcons();
}

function changeJournalDay(step) {
    const newIndex = currentJournalIndex + step;
    if (newIndex >= 0 && newIndex < groupedLogsByDay.length) {
        currentJournalIndex = newIndex;
        displayJournalPage();
    }
}


// --- LOGIQUE MUSCU ---
function loadExercise(type) {
    document.getElementById('exercise-menu').classList.add('hidden');
    document.getElementById('exercise-active').classList.remove('hidden');
    const container = document.getElementById('exercise-content');

    if (type === 'deadhang' || type === 'arms90' || type === 'tractions') {
        const isArms90 = type === 'arms90';
        const isTractions = type === 'tractions';
        container.innerHTML = `
            <div class="glass p-6 rounded-3xl border border-violet-500/20 text-center">
                <h3 class="font-bold text-xl mb-4 text-violet-400">
                    ${isTractions ? 'Tractions' : (isArms90 ? 'Bras Bloqués' : 'Suspension')}
                </h3>
                <div class="grid grid-cols-2 gap-3 mb-6 text-left">
                    ${isTractions ? `
                        <div class="col-span-2">
                            <label class="text-[10px] text-slate-500 uppercase ml-1">Variante</label>
                            <select id="traction-variant" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                                <option value="Strictes">Strictes</option>
                                <option value="Négatives">Négatives</option>
                            </select>
                        </div>
                        <div class="col-span-2">
                            <label class="text-[10px] text-slate-500 uppercase ml-1">Répétitions par cycle</label>
                            <input type="number" id="input-reps-per-cycle" value="5" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                        </div>
                    `: isArms90 ? `
                        <div class="col-span-1">
                            <label class="text-[10px] text-slate-500 uppercase ml-1">Angle</label>
                            <select id="hang-angle" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                                <option value="0">0°</option>
                                <option value="45">45°</option>
                                <option value="90">90°</option>
                                <option value="120">120°</option>
                                
                            </select>
                        </div>
                        <div class="col-span-1">
                            <label class="text-[10px] text-slate-500 uppercase ml-1">Côté</label>
                            <select id="hang-side" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                                <option value="2 bras">2 bras</option>
                                <option value="Bras Droit">Droit</option>
                                <option value="Bras Gauche">Gauche</option>
                            </select>
                        </div>
                    ` : `
                        <div class="col-span-1">
                            <label class="text-[10px] text-slate-500 uppercase ml-1">Doigts</label>
                            <select id="hang-fingers" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                                <option value="10">10 Doigts</option><option value="9">9 Doigts</option><option value="8">8 Doigts</option><option value="7">7 Doigts</option><option value="6">6 Doigts</option><option value="5">5 Doigts</option><option value="4">4 Doigts</option><option value="3">3 Doigts</option><option value="2">2 Doigts</option><option value="1">1 Doigt</option>
                            </select>
                        </div>
                        <div class="col-span-1">
                            <label class="text-[10px] text-slate-500 uppercase ml-1">Mains</label>
                            <select id="hang-hands" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                                <option value="2">2 Mains</option><option value="1">1 Main</option>
                            </select>
                        </div>
                    `}
                    <div class="col-span-1">
                        <label class="text-[10px] text-slate-500 uppercase ml-1">Travail (s)</label>
                        <input type="number" id="input-work" value="30" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                    </div>
                    <div class="col-span-1">
                        <label class="text-[10px] text-slate-500 uppercase ml-1">Repos (s)</label>
                        <input type="number" id="input-rest" value="60" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                    </div>
                    <div class="col-span-2">
                        <label class="text-[10px] text-slate-500 uppercase ml-1">Cycles</label>
                        <input type="number" id="input-cycles" value="3" class="w-full bg-slate-800 p-2 rounded-xl text-xs mt-1 outline-none">
                    </div>
                </div>
                <div class="py-10">
                    <div id="main-timer" class="text-7xl font-light mb-2">00</div>
                    <p id="timer-status" class="text-violet-400 uppercase tracking-widest text-sm font-bold font-mono">Prêt ?</p>
                    <p id="cycle-count" class="text-slate-500 text-xs mt-2">Cycle: 0 / 0</p>
                </div>
                <button onclick="startComplexCycle('${type}')" id="btn-start" class="w-full bg-violet-600 p-4 rounded-2xl font-bold">LANCER</button>
            </div>
        `;
    }

    if (type === 'pyramid') {
        container.innerHTML = `
            <div class="glass p-6 rounded-3xl text-center">
                <h3 class="font-bold text-xl mb-4 text-violet-400">Mode Pyramide</h3>
                <input type="number" id="pyramid-max" placeholder="Sommet (ex: 5)" 
                        class="w-full bg-slate-800 p-4 rounded-2xl mb-4 text-center text-xl outline-none">
                
                <div class="flex items-center justify-between bg-slate-800/50 p-4 rounded-2xl mb-6">
                    <span class="text-sm text-slate-300">Montée uniquement (1 → Max)</span>
                    <input type="checkbox" id="pyramid-up-only" class="w-6 h-6 accent-violet-500">
                </div>

                <button onclick="startPyramid()" class="w-full bg-violet-600 p-4 rounded-2xl font-bold">LANCER</button>
            </div>
        `;
    }
    lucide.createIcons();
}


function startComplexCycle(type) {
    const isArms90 = type === 'arms90';
    const isTractions = type === 'tractions';
    const work = parseInt(document.getElementById('input-work').value);
    const rest = parseInt(document.getElementById('input-rest').value);
    const cycles = parseInt(document.getElementById('input-cycles').value);
    
    // 1. Récupérer les répétitions par cycle (uniquement pour les tractions)
    const repsPerCycle = isTractions ? parseInt(document.getElementById('input-reps-per-cycle').value) : 1;

    const btn = document.getElementById('btn-start');
    const status = document.getElementById('timer-status');
    const display = document.getElementById('main-timer');
    const cycleDisplay = document.getElementById('cycle-count');

    btn.disabled = true;
    btn.classList.add('opacity-50');

    let currentCycle = 1;
    let isWorking = true;
    let timeLeft = work;

    const interval = setInterval(() => {
        timeLeft--;
        display.innerText = timeLeft.toString().padStart(2, '0');
        cycleDisplay.innerText = `Cycle: ${currentCycle} / ${cycles}`;
        
        if (timeLeft <= 0) {
            beep();
            if (isWorking) {
                isWorking = false;
                timeLeft = rest;
                status.innerText = "REPOS";
                status.className = "text-blue-400 uppercase tracking-widest text-sm font-bold font-mono";
            } else {
                currentCycle++;
                if (currentCycle > cycles) {
                    clearInterval(interval);
                    beep(880, 500);
                    
                    // 2. Calculer le volume total (Séries x Reps)
                    const totalReps = isTractions ? (cycles * repsPerCycle) : cycles;

                    const sessionData = {
                        type: isTractions ? 'Tractions' : (isArms90 ? 'Bras 90°' : 'Suspension'),
                        work, 
                        rest, 
                        cycles,
                        repsPerCycle: isTractions ? repsPerCycle : null, // Stockage pour l'historique
                        avgWorkPerRep : isTractions? (work*cycles/totalReps).toFixed(1) : null,
                        avgRestPerRep : isTractions? (rest*cycles/totalReps).toFixed(1) : null,

                        totalReps: totalReps, // Donnée clé pour renderVolumeChart
                        
                        // Note formatée selon l'exercice
                        note: isTractions ? 
                                `${cycles} x ${repsPerCycle} reps (${work}s / Repos: ${rest}s)` : 
                                `${cycles} x ${work}s (Repos: ${rest}s)`,
                        
                        variant: isTractions ? document.getElementById('traction-variant').value : null,
                        angle: isArms90 ? document.getElementById('hang-angle').value : null,
                        side: isArms90 ? document.getElementById('hang-side').value : null,
                        fingers: (!isArms90 && !isTractions) ? document.getElementById('hang-fingers').value : null,
                        hands: (!isArms90 && !isTractions) ? document.getElementById('hang-hands').value : null,
                    };
                    
                    showMoodSelector(sessionData);
                    return;
                }
                isWorking = true;
                timeLeft = work;
                status.innerText = isTractions ? "EFFORT" : (isArms90 ? "BLOCAGE" : "SUSPENSION");
                status.className = "text-violet-400 uppercase tracking-widest text-sm font-bold font-mono";
            }
        }
    }, 1000);
}
// --- UTILITAIRES PYRAMIDE ---


// --- UTILITAIRES ---
const beep = (freq = 440, duration = 200) => {
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const osc = context.createOscillator();
    osc.frequency.setValueAtTime(freq, context.currentTime);
    osc.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration / 1000);
};


// --- VARIABLES GLOBALES ---
let pyrData = { steps: [], phase: 'repos' };
let chronoInterval;
let seconds = 0;
let pyrMax, pyrCurrent, pyrDirection;
let isUpOnly; // Ajout de isUpOnly ici



function backToMenu() {
    document.getElementById('exercise-menu').classList.remove('hidden');
    document.getElementById('exercise-active').classList.add('hidden');
    clearInterval(chronoInterval);
}



function startPyramid() {
    const max = document.getElementById('pyramid-max').value;
    if (!max) return;
    
    // On vérifie si la case est cochée
    isUpOnly = document.getElementById('pyramid-up-only').checked; 
    
    pyrMax = parseInt(max);
    pyrCurrent = 1;
    pyrDirection = 1;
    pyrData.steps = [];
    currentSessionSteps = []; // On vide aussi la session précédente
    
    renderPyramidUI();
    startChrono();
}

function renderPyramidUI() {
    const container = document.getElementById('exercise-content');
    container.innerHTML = `
        <div class="glass p-6 rounded-3xl text-center">
            <h3 class="font-bold text-xl mb-1 text-violet-400">Pyramide Pro</h3>
            ${isUpOnly ? '<span class="bg-orange-500/20 text-orange-400 text-[10px] px-2 py-0.5 rounded-full border border-orange-500/30 mb-4 inline-block font-bold">SEMI-PYRAMIDE</span>' : ''}
            <div class="text-7xl font-bold text-white mb-2" id="pyr-reps">${pyrCurrent}</div>
            <p id="pyr-phase" class="text-blue-400 uppercase text-xs font-bold mb-6">REPOS</p>
            <div id="pyr-timer" class="text-5xl font-mono mb-8 text-slate-300">00:00</div>
            <div id="pyr-controls">
                <button onclick="prepareSet()" class="w-full bg-blue-600 p-5 rounded-2xl font-bold text-lg text-white">DÉBUT SÉRIE</button>
            </div>
        </div>
    `;
}

function startChrono() {
    clearInterval(chronoInterval);
    seconds = 0;
    chronoInterval = setInterval(() => {
        seconds++;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        const timerEl = document.getElementById('pyr-timer');
        if (timerEl) timerEl.innerText = `${m}:${s}`;
    }, 1000);
}

function prepareSet() {
    pyrData.currentRest = seconds;
    let count = 5;
    const phase = document.getElementById('pyr-phase');
    const controls = document.getElementById('pyr-controls');
    
    phase.innerText = "PRÉPARE-TOI";
    phase.className = "text-orange-500 uppercase text-xs font-bold animate-pulse";
    controls.innerHTML = `<div class="text-5xl font-bold text-orange-500">${count}</div>`;

    const countdown = setInterval(() => {
        count--;
        if (count <= 0) {
            clearInterval(countdown);
            startEffort();
        } else if (document.getElementById('pyr-controls')) {
            document.getElementById('pyr-controls').innerHTML = `<div class="text-5xl font-bold text-orange-500">${count}</div>`;
        }
    }, 1000);
}

function startEffort() {
    startChrono();
    document.getElementById('pyr-phase').innerText = "EFFORT (TRACTIONS)";
    document.getElementById('pyr-phase').className = "text-red-500 uppercase text-xs font-bold";
    document.getElementById('pyr-controls').innerHTML = `
        <button onclick="finishSet()" class="w-full bg-green-600 p-5 rounded-2xl font-bold text-lg text-white">SÉRIE RÉUSSIE</button>
    `;
}

// Variable temporaire pour stocker les paliers de la séance en cours
let currentSessionSteps = []; 

function finishSet() {
    currentSessionSteps.push({
        reps: pyrCurrent,
        work: seconds,
        rest: pyrData.currentRest
    });

    // --- NOUVELLE LOGIQUE ---
    if (pyrCurrent === pyrMax) {
        if (isUpOnly) {
            // Si on ne fait que la montée, on s'arrête direct au sommet
            pyrCurrent = 0; 
        } else {
            // Sinon, on entame la descente
            pyrDirection = -1;
            pyrCurrent += pyrDirection;
        }
    } else {
        pyrCurrent += pyrDirection;
    }
    // ------------------------

    if (pyrCurrent <= 0) { // On met <= 0 par sécurité
        clearInterval(chronoInterval);
        savePyramidFinal();
    } else {
        renderPyramidUI();
        startChrono();
    }
}

function savePyramidFinal() {
    const totalReps = currentSessionSteps.reduce((acc, s) => acc + s.reps, 0);
    const totalWork = currentSessionSteps.reduce((acc, s) => acc + s.work, 0);
    const totalRest = currentSessionSteps.reduce((acc, s) => acc + s.rest, 0);

    const exerciseData = {
        type: 'Pyramide Tractions',
        totalReps: totalReps,
        avgWorkPerRep: (totalWork / totalReps).toFixed(1), // Temps moyen par traction
        avgRestPerRep: (totalRest / totalReps).toFixed(1), // Repos moyen par traction
        steps: currentSessionSteps, // Le détail complet pour les calculs futurs
        isSemi: isUpOnly,
        note: `Sommet ${pyrMax} | ${totalReps} reps | Cadence: ${(totalWork / totalReps).toFixed(1)}s/rep`
    };

    showMoodSelector(exerciseData);
}

// --- SYSTÈME DE MOOD & SAUVEGARDE ---
function showMoodSelector(data) {
    // 1. On stocke les données pour finalSave2
    pendingData = data;

    // 2. On bascule sur la section qui contient le conteneur de mood
    showSection('muscu');
    
    // 3. On cache le menu de muscu et on montre la zone active
    document.getElementById('exercise-menu').classList.add('hidden');
    document.getElementById('exercise-active').classList.remove('hidden');

    // 4. On génère le contenu visuel selon le type de sport/activité
    const container = document.getElementById('exercise-content');
    
    // On adapte le petit texte de résumé selon le type
    let summary = "";
    if (data.type === 'Musique') {
        summary = `${data.instrument} • ${data.duration}`;
    } else if (data.type === 'Course') {
        summary = `${data.distance} km`;
    } else if (data.type === 'Étirement') {
        summary = data.routine;
    } else if (data.type === 'Escalade') {
        // AJOUT : Résumé pour l'escalade (nombre de blocs/voies)
        const count = data.details ? data.details.length : 0;
        summary = `${data.exercise} • ${count} ascension${count > 1 ? 's' : ''}`;
    } else {
        summary = `${data.totalReps || 0}s de travail`;
    }

    container.innerHTML = `
        <div class="glass p-8 rounded-3xl text-center">
            <div class="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <i data-lucide="check" class="text-emerald-400 w-8 h-8"></i>
            </div>
            <h3 class="text-xl font-black text-white mb-1">BIEN JOUÉ !</h3>
            <p class="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-6">${summary}</p>
            
            <p class="text-sm text-slate-300 mb-8 font-medium">Comment s'est passée la séance ?</p>
            
            <div class="flex justify-between mb-10">
                ${[1, 2, 3, 4, 5].map(m => `
                    <button onclick="finalSave2(${m})" 
                            class="mood-btn mood-${m} hover:scale-110 transition-transform shadow-lg">
                    </button>
                `).join('')}
            </div>
            
            <p class="text-[9px] text-slate-600 uppercase font-bold tracking-widest">Clique sur une couleur pour enregistrer</p>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

function finalSave(jsonStr, moodScore) {
    const data = JSON.parse(decodeURIComponent(jsonStr));
    const fullLog = {
        ...data,
        date: new Date().toLocaleDateString('fr-FR'),
        mood: moodScore,
        comment: ""
    };
    DB.saveLog(fullLog);
    renderLogs();
    showSection('stats');
}

// --- JOURNAL (RENDER LOGS) ---
// --- MOTEUR 1 : MUSCU & SUSPENSION (Ton code qui fonctionne) ---
function renderMuscuDetails(log) {
    // 1. Tags de variantes
    const variantTag = log.variant ? `
        <span class="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-emerald-500/30">
            ${log.variant}
        </span>` : '';

    const semiTag = log.isSemi ? `
        <span class="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-orange-500/30">
            ▲ Semi-Pyramide
        </span>` : '';

    // 2. Détails techniques (Angle, Bras, Mains, Doigts)
    let techHtml = '';
    if (log.hands || log.fingers) {
        techHtml = `
            <div class="flex gap-2 mb-3">
                <span class="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-violet-500/30">${log.hands || 2} Main(s)</span>
                ${log.fingers ? `<span class="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-blue-500/30">${log.fingers} Doigt(s)</span>` : ''}
            </div>`;
    } else if (log.angle || log.side) {
        techHtml = `
            <div class="flex gap-2 mb-3">
                ${log.side ? `<span class="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-violet-500/30">${log.side}</span>` : ''}
                ${log.angle ? `<span class="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-blue-500/30">Angle: ${log.angle}°</span>` : ''}
            </div>`;
    }

    // 3. Affichage des stats (Condition élargie aux Pyramides)
    let statsHtml = '';
    // On vérifie si c'est 'Tractions' OU 'Pyramide Tractions'
    const isTractionType = log.type === 'Tractions' || log.type === 'Pyramide Tractions';

    if (isTractionType && log.avgWorkPerRep) {
        statsHtml = `
            <div class="grid grid-cols-2 gap-2 mb-3">
                <div class="bg-violet-500/10 p-2 rounded-xl border border-violet-500/20 text-center">
                    <p class="text-[9px] text-slate-500 uppercase">Vitesse moy.</p>
                    <p class="text-xs font-bold text-violet-400">${log.avgWorkPerRep}s / rep</p>
                </div>
                <div class="bg-blue-500/10 p-2 rounded-xl border border-blue-500/20 text-center">
                    <p class="text-[9px] text-slate-500 uppercase">Repos moy.</p>
                    <p class="text-xs font-bold text-blue-400">${log.avgRestPerRep}s / rep</p>
                </div>
            </div>`;
    } else {
        // Pour les Suspensions et Bras 90°
        statsHtml = `
            <div class="grid grid-cols-3 gap-2 mb-3">
                <div class="bg-slate-800/40 p-2 rounded-xl border border-slate-700 text-center">
                    <p class="text-[9px] text-slate-500 uppercase">Cycles</p>
                    <p class="text-xs font-bold text-white">${log.cycles || '-'}</p>
                </div>
                <div class="bg-violet-500/10 p-2 rounded-xl border border-violet-500/20 text-center">
                    <p class="text-[9px] text-slate-500 uppercase">Travail</p>
                    <p class="text-xs font-bold text-violet-400">${log.work || '-'}s</p>
                </div>
                <div class="bg-blue-500/10 p-2 rounded-xl border border-blue-500/20 text-center">
                    <p class="text-[9px] text-slate-500 uppercase">Repos</p>
                    <p class="text-xs font-bold text-blue-400">${log.rest || '-'}s</p>
                </div>
            </div>`;
    }

    return `
        ${variantTag || semiTag ? `<div class="flex flex-wrap gap-2 mb-3">${variantTag}${semiTag}</div>` : ''}
        ${techHtml}
        ${statsHtml}
    `;
}

// --- MOTEUR 2 : COURSE ---
function renderRunDetails(log) {
    return `
        <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="bg-blue-500/10 p-2 rounded-xl text-center border border-blue-500/20">
                <p class="text-[9px] text-slate-500 uppercase font-bold">Km</p>
                <p class="text-sm font-bold text-blue-400">${log.distance || 0}</p>
            </div>
            <div class="bg-indigo-500/10 p-2 rounded-xl text-center border border-indigo-500/20">
                <p class="text-[9px] text-slate-500 uppercase font-bold">Allure</p>
                <p class="text-sm font-bold text-indigo-400">${log.pace || '--'}</p>
            </div>
            <div class="bg-white/5 p-2 rounded-xl text-center border border-white/10">
                <p class="text-[9px] text-slate-500 uppercase font-bold">Temps</p>
                <p class="text-sm font-bold text-white">${log.duration || '--'}</p>
            </div>
        </div>
    `;
}

// --- MOTEUR 3 : MUSIQUE ---
function renderMusicDetails(log) {
    // Petit dictionnaire d'icônes selon l'instrument
    const icons = {
        'Piano': 'piano',
        'Clarinette': 'music-2',
        'Saxophone': 'music',
        'Flûte': 'wind',
        'Autre': 'more-horizontal'
    };
    const iconName = icons[log.instrument] || 'music';

    return `
        <div class="flex items-center gap-3 bg-violet-500/5 border border-violet-500/10 p-3 rounded-xl mb-3">
            <div class="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                <i data-lucide="${iconName}" class="w-5 h-5 text-violet-400"></i>
            </div>
            <div>
                <p class="text-[10px] text-slate-500 uppercase font-black">Instrument</p>
                <p class="text-sm font-bold text-white">${log.instrument}</p>
            </div>
            <div class="ml-auto text-right">
                <p class="text-[10px] text-slate-500 uppercase font-black">Durée</p>
                <p class="text-sm font-bold text-violet-400">${log.duration || '0s'}</p>
            </div>
        </div>
    `;
}

// --- MOTEUR 4 : STRETCHING ---
function renderStretchDetails(log) {
    // Debug : affiche les données reçues dans la console pour vérifier les calculs
    console.log("Données du log :", { 
        reel: log.duration, 
        theo: log.durationTheo, 
        fini: log.completed 
    });

    let statusLabel = "";
    let statusColor = "";
    let icon = "check-circle";
    let tempsCalcule = 0; 
    // Conversion forcée en nombres pour éviter les erreurs de comparaison JS
    const duration = Number(log.duration);
    const durationTheo = Number(log.durationTheo);
    const tempsSeconde = log.duration;
    const tempsMinuteArrondi = Number(log.durationStr2)

    tempsCalcule = tempsSeconde - 60*tempsMinuteArrondi
    if (tempsCalcule < 0) {
        tempsFinaleSec = 60 + tempsCalcule
        tempsFinaleMin = tempsMinuteArrondi -1
    } else {
        tempsFinaleSec = tempsCalcule
        tempsFinaleMin = tempsMinuteArrondi
    }

    // 1. Priorité à l'abandon explicite (Bouton Abandonner)
    if (log.completed === false) {
        statusLabel = "Séance Abandonnée";
        statusColor = "text-red-400";
        icon = "alert-circle";
    } 
    // 2. Si le temps réel est inférieur à 90% du temps prévu (Exos passés via "Passer")
    // On ajoute une vérification pour s'assurer que durationTheo existe
    else if (durationTheo > 0 && duration < (durationTheo * 0.9)) {
        statusLabel = "Séance Raccourcie";
        statusColor = "text-orange-400";
        icon = "fast-forward";
    } 
    // 3. Sinon, la séance est considérée comme complète
    else {
        statusLabel = "Séance Complète";
        statusColor = "text-emerald-400";
        icon = "check-circle";
    }

    return `
        <div class="bg-white/5 p-3 rounded-xl border border-white/10 mb-3 space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-emerald-500/10 rounded-lg">
                        <i data-lucide="accessibility" class="w-4 h-4 text-emerald-400"></i>
                    </div>
                    <div>
                        <p class="text-[10px] text-slate-500 uppercase font-black">Focus</p>
                        <p class="text-xs text-white font-bold">${log.routine || 'Étirement'}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-[10px] text-slate-500 uppercase font-black">Statut</p>
                    <div class="flex items-center gap-1 justify-end">
                        <i data-lucide="${icon}" class="w-3 h-3 ${statusColor}"></i>
                        <p class="text-[10px] font-black uppercase ${statusColor}">${statusLabel}</p>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-between items-center pt-2 border-t border-white/5">
                <span class="text-[10px] text-slate-400 uppercase font-bold">Temps effectif</span>
                <span class="text-xs text-white font-mono bg-white/5 px-2 py-0.5 rounded">${tempsFinaleMin || '0'} min ${tempsFinaleSec || '0'} sec</span>
            </div>
        </div>
    `;
}

// --- MOTEUR 5 : ESCALADE ---

function renderClimbingDetails(log) {
    const details = log.details || [];
    const totalEssais = details.length; // Nombre total de tentatives
    const successes = details.filter(d => d.success).length;
    const fails = totalEssais - successes;
    
    // 1. On groupe les données par difficulté
    const statsByLevel = details.reduce((acc, d) => {
        if (!acc[d.level]) acc[d.level] = { success: 0, fail: 0 };
        if (d.success) acc[d.level].success++;
        else acc[d.level].fail++;
        return acc;
    }, {});

    const arkoseColors = {
        'Jaune': '#fbbf24', 'Vert': '#4ade80', 'Bleu': '#60a5fa', 
        'Rouge': '#f87171', 'Noir': '#1e293b', 'Violet': '#a855f7'
    };

    // 2. Génération du résumé (ce qu'on voit tout de suite)
    const summaryHTML = Object.entries(statsByLevel).map(([lvl, stat]) => {
        const dotColor = arkoseColors[lvl] || '#94a3b8';
        return `
            <div class="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                <span class="w-2 h-2 rounded-full" style="background-color: ${dotColor}"></span>
                <span class="text-[10px] font-bold text-white">${lvl}</span>
                <span class="text-[9px] text-slate-400 ml-1">${stat.success}✅ / ${stat.fail}❌</span>
            </div>
        `;
    }).join('');

    return `
        <div class="mt-2 space-y-3">
            <div class="flex flex-wrap items-center gap-2">
                <div class="bg-violet-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black uppercase shadow-lg shadow-violet-500/20">
                    ${totalEssais} ESSAIS TOTAUX
                </div>
                <div class="flex items-center gap-2 text-[10px] font-bold text-slate-400 border-l border-white/10 pl-2">
                    <span class="text-emerald-400">${successes}✅</span>
                    <span class="text-red-400">${fails}❌</span>
                </div>
            </div>

            <div id="details-content-${log.id}" class="hidden-details-content mt-3 space-y-2 border-t border-white/5 pt-3">
                <p class="text-[10px] uppercase font-black text-slate-500 mb-2 italic">Détail de la session :</p>
                <div class="flex flex-wrap gap-2">
                ${summaryHTML || '<span class="text-[10px] text-slate-500 italic">Aucune ascension enregistrée</span>'}
                </div>
                

                ${log.duration ? `
                    <div class="flex items-center gap-2 text-slate-500 mt-2">
                        <i data-lucide="clock" class="w-3 h-3"></i>
                        <span class="text-[10px]">Durée totale : ${log.duration} minutes</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

let showAllLogs = false; // Variable indépendante

async function renderLogs(filter = 'all') {
    const container = document.getElementById('log-list');
    if (!container) return;

    const searchTerm = document.getElementById('log-search')?.value.toLowerCase() || "";
    let logs = await DB.getLogs(); 

    // 1. Tri par date (plus récent d'abord)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 2. Filtrage (Uniquement type et recherche, pas de dates de stats !)
    let filteredLogs = logs.filter(l => {
        const matchesType = (filter === 'all' || l.type.toLowerCase() === filter.toLowerCase());
        const formattedDate = new Date(l.timestamp).toLocaleDateString('fr-FR');
        const searchableText = [l.type, l.note, l.exercise, formattedDate, l.comment].join(' ').toLowerCase();
        return matchesType && searchableText.includes(searchTerm);
    });

    const totalCount = filteredLogs.length;

    // 3. Limitation "Anti-Chauffe" (Indépendante)
    if (!showAllLogs) {
        filteredLogs = filteredLogs.slice(0, 10);
    }

    // 4. Rendu HTML
    const moodColors = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 5: '#a855f7' };
    let html = filteredLogs.map(log => {
        let specificContent = "";
        switch(log.type) {
            case 'Course': specificContent = renderRunDetails(log); break;
            case 'Musique': specificContent = renderMusicDetails(log); break;
            case 'Étirement': specificContent = renderStretchDetails(log); break;
            case 'Escalade': specificContent = renderClimbingDetails(log); break;
            default: specificContent = renderMuscuDetails(log);
        }

        return `
            <div class="glass p-4 rounded-2xl border-l-4 mb-3" style="border-color: ${moodColors[log.mood] || '#475569'}" onclick="toggleComment('${log.id}')">
                <div class="flex justify-between items-start mb-2">
                    <p class="text-sm font-bold text-white">${log.type}</p>
                    <span class="text-[10px] text-slate-500">${new Date(log.timestamp).toLocaleDateString('fr-FR')}</span>
                </div>

                ${log.note ? `<p class="text-xs text-slate-300 mb-3">${log.note}</p>` : ''}
                
                ${specificContent}

                <div id="details-${log.id}" class="hidden mt-3 pt-3 border-t border-white/5">
                    <div class="bg-black/20 p-2 rounded-lg text-[10px] text-slate-400 italic mb-3">
                        "${log.comment || 'Aucun commentaire...'}"
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <button onclick="addComment(event, '${log.id}')" class="w-full py-2 bg-white/5 rounded-xl text-[10px] text-violet-400 font-bold uppercase">
                            Modifier la note
                        </button>
                        <button onclick="deleteLog(event, '${log.id}')" class="w-full py-2 text-[9px] text-red-400/50 uppercase">
                            Supprimer la séance
                        </button>
                    </div>
                </div>
            </div>
            </div>`;
    }).join('');

    // Bouton "Tout voir"
    if (!showAllLogs && totalCount > 10) {
        html += `<button onclick="toggleShowAllLogs()" class="w-full py-4 mt-2 bg-slate-800/30 rounded-2xl text-[10px] text-slate-500 font-bold uppercase tracking-widest">Voir les ${totalCount - 10} séances précédentes</button>`;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

function toggleShowAllLogs() {
    showAllLogs = true;
    renderLogs();
}

function toggleComment(id) {
    // On force l'ID en string car l'ID HTML contient le nombre
    const details = document.getElementById('details-' + id);
    if (details) {
        details.classList.toggle('hidden');
    }
}

async function addComment(event, id) {
    event.stopPropagation();
    
    const newComment = prompt("Ajouter une note ou un commentaire sur cette séance :");
    
    if (newComment !== null) {
        try {
            // On met à jour uniquement le champ 'comment' dans IndexedDB
            await DB.updateLog(id, { comment: newComment });
            
            // On rafraîchit l'affichage pour voir le changement
            await renderLogs();
            
            // On réouvre le volet de détails pour que l'utilisateur voit son texte
            toggleComment(id);
        } catch (err) {
            console.error("Erreur mise à jour commentaire:", err);
            alert("Erreur lors de l'enregistrement du commentaire.");
        }
    }
}

async function migrateFromLocalStorage() {
    try {
        const oldData = localStorage.getItem('zenith_logs');
        if (!oldData) {
            alert("Aucune donnée ancienne trouvée dans ce navigateur.");
            return;
        }

        const oldLogs = JSON.parse(oldData);
        if (oldLogs.length === 0) {
            alert("Ton ancien historique est vide.");
            return;
        }

        // On boucle sur chaque log pour les mettre dans IndexedDB
        for (let log of oldLogs) {
            // On supprime l'ancien ID pour que Dexie en génère un nouveau propre
            const { id, ...cleanLog } = log; 
            await DB.saveLog(cleanLog);
        }

        // On nettoie le localStorage pour ne pas migrer deux fois
        localStorage.removeItem('zenith_logs');
        
        alert(`Succès ! ${oldLogs.length} séances ont été migrées.`);
        location.reload(); // On recharge pour actualiser les stats
        
    } catch (err) {
        console.error("Erreur migration :", err);
        alert("Une erreur est survenue pendant la migration.");
    }
}




async function updateStatsDashboard() {
    // 1. RÉCUPÉRATION INITIALE
    const allLogs = await DB.getLogs(); 
    if (!allLogs || allLogs.length === 0) {
        console.log("Aucune donnée pour les stats");
        return;
    }

    // 2. PRÉPARATION DES FILTRES (POUR LES GRAPHS SPÉCIFIQUES)
    const limit = document.getElementById('stats-limit')?.value || 'all';
    const startDate = document.getElementById('stats-start')?.value;
    const endDate = document.getElementById('stats-end')?.value;

    let filteredLogs = [...allLogs];

    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) >= start);
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredLogs = filteredLogs.filter(l => new Date(l.timestamp) <= end);
    }
    if (limit !== 'all') {
        filteredLogs = filteredLogs.slice(0, parseInt(limit));
    }

    // On prépare une version chronologique (ancien -> récent) pour les graphiques linéaires
    const filteredChronological = [...filteredLogs].reverse();
    const allChronological = [...allLogs].reverse();

    const legendEl = document.getElementById('stats-period-legend');

    if (legendEl) {
        if (startDate && endDate) {
            // Formatage lisible (ex: 2024-02-01 -> 01/02/2024)
            const d1 = startDate.split('-').reverse().join('/');
            const d2 = endDate.split('-').reverse().join('/');
            legendEl.innerText = `Période du ${d1} au ${d2}`;
        } else if (startDate) {
            const d1 = startDate.split('-').reverse().join('/');
            legendEl.innerText = `Depuis le ${d1}`;
        } else if (endDate) {
            const d2 = endDate.split('-').reverse().join('/');
            legendEl.innerText = `Jusqu'au ${d2}`;
        } else {
            legendEl.innerText = "Toutes les séances";
        }
    }
    

    // ==========================================
    // 3. MISES À JOUR DES COMPTEURS (TEXTE)
    // ==========================================

    // --- TRACTIONS ---
    const tractionLogs = allLogs.filter(l => l.type && (l.type.includes('Pyramide') || l.type === 'Tractions'));
    if (tractionLogs.length > 0) {
        const totalReps = tractionLogs.reduce((acc, l) => acc + (parseInt(l.totalReps) || 0), 0);
        const logsWithSpeed = tractionLogs.filter(l => l.avgWorkPerRep);
        const avgSpeed = logsWithSpeed.length > 0 
            ? logsWithSpeed.reduce((acc, l) => acc + parseFloat(l.avgWorkPerRep), 0) / logsWithSpeed.length 
            : 0;

        if(document.getElementById('stat-total-reps')) document.getElementById('stat-total-reps').innerText = totalReps;
        if(document.getElementById('stat-avg-speed') && avgSpeed > 0) document.getElementById('stat-avg-speed').innerText = avgSpeed.toFixed(1) + "s";
    }

    // --- SUSPENSIONS & BRAS 90 ---
    const fingerFilter = document.getElementById('stat-finger-filter')?.value || 'all';
    const hangLogs = allLogs.filter(l => {
        const typeLower = (l.type || "").toLowerCase();
        const isFingerHang = typeLower.includes('suspension') || typeLower.includes('deadhang');
        return isFingerHang && (fingerFilter === 'all' || String(l.fingers) === String(fingerFilter));
    });
    const arms90Logs = allLogs.filter(l => (l.type || "").toLowerCase().includes('bras'));

    const totalSecondsHang = hangLogs.reduce((acc, l) => acc + (parseInt(l.cycles) * parseInt(l.work) || 0), 0);
    const armStats = { droit: 0, gauche: 0, deux: 0 };
    const totalSeconds90 = arms90Logs.reduce((acc, l) => {
        let vol = parseInt(l.cycles) * parseInt(l.work) || 0;
        const side = (l.side || "").toLowerCase();
        if (side.includes('droit')) armStats.droit += vol;
        else if (side.includes('gauche')) armStats.gauche += vol;
        else armStats.deux += vol;
        return acc + vol;
    }, 0);

    if (document.getElementById('stat-total-hang')) document.getElementById('stat-total-hang').innerText = totalSecondsHang + "s";
    if (document.getElementById('stat-total-arms90')) document.getElementById('stat-total-arms90').innerText = totalSeconds90 + "s";

    // --- COURSE & AUTRES ---
    const runLogs = allLogs.filter(l => l.type === 'Course');
    if (runLogs.length > 0) {
        const totalDist = runLogs.reduce((acc, l) => acc + (parseFloat(l.distance) || 0), 0);
        if(document.getElementById('stat-run-total-dist')) document.getElementById('stat-run-total-dist').innerText = totalDist.toFixed(1) + "km";
    }

    const totals = allLogs.reduce((acc, log) => {
        if (log.type === 'Étirement') acc.stretch += (parseInt(log.duration) || 0);
        if (log.type === 'Musique') acc.music += (parseInt(log.duration) || 0);
        return acc;
    }, { stretch: 0, music: 0 });

    if(document.getElementById('stat-stretch-total')) document.getElementById('stat-stretch-total').innerText = `${Math.round(totals.stretch / 60)} min`;
    if(document.getElementById('stat-music-total')) document.getElementById('stat-music-total').innerText = `${Math.round(totals.music / 60)} min`;

    // ==========================================
    // 4. APPEL DES GRAPHIQUES (AVEC OU SANS FILTRE)
    // ==========================================

    // --- GROUPE 1 : SANS FILTRE (HISTORIQUE TOTAL) ---
    if (typeof renderMainChart === "function") renderMainChart(allLogs);
    if (typeof renderVolumeChart === "function") renderVolumeChart(allLogs);
    if (typeof renderFatigueChart === "function") renderFatigueChart(allLogs);
    if (typeof renderHeatmap === "function") renderHeatmap(allLogs);
    
    // Radars (Équilibre & Profil) - Pas de tri/filtre
    const objectifsHebdo = { 'Escalade': 120, 'Musculation': 60, 'Course': 90, 'Musique': 130, 'Stretching': 60 };
    if (typeof renderRadarChart === "function") renderRadarChart(allLogs, objectifsHebdo);
    if (typeof renderCompetenceRadar === "function") renderCompetenceRadar(allLogs);

    // --- GROUPE 2 : AVEC FILTRE (PLAGE DYNAMIQUE) ---
    // Note: On utilise filteredChronological pour que la gauche du graph soit le plus ancien de la sélection
    
    if (typeof renderRunChart === "function") {
        const filteredRuns = filteredLogs.filter(l => l.type === 'Course').reverse();
        renderRunChart(filteredRuns);
    }

    if (typeof renderEnduranceChart === "function" || typeof renderProgressionChart === "function") {
        const filteredTraction = filteredLogs.filter(l => l.type && (l.type.includes('Pyramide') || l.type === 'Tractions')).reverse();
        if (typeof renderProgressionChart === "function") renderProgressionChart(filteredTraction);
        // Si enduranceChart est une fonction séparée :
        if (typeof renderEnduranceChart === "function") renderEnduranceChart(filteredTraction); 
    }

    if (typeof renderBlocEvolutionChart === "function" || typeof renderVoieEvolutionChart === "function") {
        const filteredClimb = filteredLogs.filter(l => l.type === 'Escalade' || l.type === 'escalade').reverse();
        if (typeof renderBlocEvolutionChart === "function") renderBlocEvolutionChart(filteredClimb);
        if (typeof renderVoieEvolutionChart === "function") renderVoieEvolutionChart(filteredClimb);
    }

    if (typeof renderScatterChart === "function") {
        renderScatterChart(filteredLogs); // Scatter chart utilise généralement le filteredLogs direct
    }

    // Affichage des dominance Bras 90 basé sur les stats calculées
    renderArmBalanceChart(armStats);
}

function renderArmBalanceChart(data) {
    const ctx = document.getElementById('armBalanceChart');
    if (!ctx) return;

    if (window.myArmChart) window.myArmChart.destroy();

    const diff = Math.abs(data.droit - data.gauche);

    window.myArmChart = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['BRAS INDIVIDUELS', '2 BRAS'],
            datasets: [
                {
                    label: 'Droit',
                    data: [data.droit, 0],
                    backgroundColor: 'rgba(139, 92, 246, 0.6)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1,
                    borderRadius: 4,
                    xAxisID: 'x', // Axe pour les bras
                },
                {
                    label: 'Gauche',
                    data: [data.gauche, 0],
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4,
                    xAxisID: 'x', // Axe pour les bras
                },
                {
                    label: '2 Bras',
                    data: [0, data.deux],
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    borderWidth: 1,
                    borderRadius: 4,
                    xAxisID: 'xTotal', // DEUXIÈME AXE INDÉPENDANT
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                // Axe pour les bras individuels
                x: {
                    display: false,
                    stacked: true, // Empile Droit et Gauche sur la ligne 1
                    beginAtZero: true
                },
                // Axe pour le total (invisible et indépendant)
                xTotal: {
                    display: false,
                    stacked: true,
                    beginAtZero: true
                },
                y: {
                    stacked: true,
                    ticks: { color: '#64748b', font: { size: 9, weight: 'bold' } },
                    grid: { display: false }
                }
            }
        },
        plugins: [{
            id: 'diffLabel',
            afterDatasetsDraw(chart) {
                const { ctx, chartArea: { right }, scales: { y } } = chart;
                ctx.save();
                ctx.font = 'bold 10px sans-serif';
                ctx.fillStyle = '#f59e0b';
                ctx.textAlign = 'right';
                
                const yPos = y.getPixelForValue(0);
                // On affiche la diff au bout de la barre des bras individuels
                ctx.fillText(`Δ ${diff}s`, right - 10, yPos + 3);
                ctx.restore();
            }
        }]
    });
}

function renderCompetenceRadar(logs) {
    const canvas = document.getElementById('radarChart2');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // --- 1. FONCTION DE CALCUL DES PERFORMANCES ET RECORDS ---
    const getStats = (targetLogs, isHistorical = false) => {
        let musicMax = 0;
        let forceMax = 0;
        let techMax = 0;
        let runTotal = 0;
        let recupTotal = 0;

        const levelMap = { 'jaune': 2, 'vert': 4, 'bleu': 6, 'rouge': 8, 'noir': 9, 'violet': 10 };

        targetLogs.forEach(l => {
            // Musique : On cherche la session la plus longue (le record)
            if (l.type?.toLowerCase() === 'musique') {
                const dur = parseInt(l.duration) || 0;
                if (dur > musicMax) musicMax = dur;
            }

            // Force : On cherche le sommet le plus haut (le record)
            if (l.type?.includes('Pyramide Tractions') && !l.isSemi) {
                const sommet = parseInt(l.note?.match(/Sommet (\d+)/)?.[1]) || 0;
                if (sommet > forceMax) forceMax = sommet;
            }

            // Technique : On cherche la meilleure performance en escalade
            if (l.type === 'Escalade' && l.details) {
                l.details.forEach(lap => {
                    if (lap.success) {
                        const diff = levelMap[(lap.level || lap.color || "").toLowerCase().trim()] || 0;
                        const effortInv = 6 - (parseInt(lap.effort) || 5);
                        const score = (diff + effortInv) / 1.5;
                        if (score > techMax) techMax = score;
                    }
                });
            }

            // Endurance & Récup : On cumule sur la période
            if (l.type === 'Course' || l.type === 'Run') {
                runTotal += (parseFloat(l.distance) || 0);
            }
            if (['Étirement', 'stretching', 'Zen'].includes(l.type)) {
                recupTotal += 1;
            }
        });

        return {
            force: forceMax,
            endurance: runTotal,
            musique: musicMax,
            recup: recupTotal,
            technique: techMax
        };
    };

    // --- 2. LOGIQUE DE TEMPORALITÉ ---
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    // Séparation des logs
    const currentLogs = logs.filter(l => new Date(l.timestamp || l.date) >= oneWeekAgo);
    const oldLogs = logs.filter(l => new Date(l.timestamp || l.date) < oneWeekAgo);

    // Calcul des valeurs
    const current = getStats(currentLogs);
    const history = getStats(oldLogs);

    // --- 3. CALCUL DU PLAFOND DYNAMIQUE (Le 100%) ---
    const getAxisMax = (cur, hist) => {
        // Le record historique avec le bonus de 5%
        const limit = (hist || 0) * 1.05;
        // Le max du graph est soit ce record+5%, soit ta perf actuelle si tu l'as dépassé
        // On met un minimum (ex: 10) pour ne pas avoir un graph vide au début
        return Math.max(cur, limit, 1); 
    };

    const axisLimits = {
        force: getAxisMax(current.force, history.force),
        endurance: getAxisMax(current.endurance, history.endurance),
        musique: getAxisMax(current.musique, history.musique),
        recup: getAxisMax(current.recup, history.recup),
        technique: getAxisMax(current.technique, history.technique)
    };

    // --- 4. NORMALISATION (Score sur 10) ---
    // Si perf actuelle >= record+5%, le score sera de 10/10 (touche le bord)
    const finalData = [
        (current.force / axisLimits.force) * 10,
        (current.endurance / axisLimits.endurance) * 10,
        (current.musique / axisLimits.musique) * 10,
        (current.recup / axisLimits.recup) * 10,
        (current.technique / axisLimits.technique) * 10
    ];

    // --- 5. RENDU ---
    if (window.radarInstance) window.radarInstance.destroy();
    window.radarInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Force', 'Endurance', 'Musique', 'Récup', 'Technique'],
            datasets: [{
                data: finalData,
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                borderColor: '#a855f7',
                borderWidth: 2,
                pointBackgroundColor: '#a855f7'
            }]
        },
        options: {
            scales: {
                r: {
                    min: 0, max: 10, beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: '#94a3b8', font: { size: 11 } },
                    ticks: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const i = context.dataIndex;
                            const keys = ['force', 'endurance', 'musique', 'recup', 'technique'];
                            const units = ['Sommet', 'km (7j)', 'sec', 'séances (7j)', 'niv'];
                            let val = current[keys[i]];
                            if (keys[i] === 'musique') val = Math.floor(val/60) + "m " + (val%60) + "s";
                            return `${context.label}: ${val} ${units[i]}`;
                        }
                    }
                }
            }
        }
    });
}

 /** * Fonction utilitaire pour obtenir le numéro de semaine 

 */

function getWeekNumber(d) {

    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));

    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

} 


// On crée une variable à l'extérieur pour stocker l'instance du graphique
let radarChartInstance = null;
let currentRadarWeekOffset = 0; // 0 = semaine actuelle, 1 = semaine dernière...
function renderRadarChart(logs, objectifs) {
    const canvas = document.getElementById('radarChart');
    if (!canvas) return;

    const labels = Object.keys(objectifs);

    // --- LOGIQUE DE CALCUL DES DATES ---
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 (Dimanche) à 6 (Samedi)
    const diffToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    
    // Calcul du Lundi de la semaine sélectionnée
    const targetMonday = new Date(now);
    targetMonday.setDate(now.getDate() - diffToMonday - (currentRadarWeekOffset * 7));
    targetMonday.setHours(0, 0, 0, 0);

    // Calcul du Dimanche de la semaine sélectionnée
    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);
    targetSunday.setHours(23, 59, 59, 999);

    // Mise à jour du texte de la période (ex: 12 fév. - 18 fév.)
    const titleEl = document.getElementById('radar-period-title');
    if (titleEl) {
        if (currentRadarWeekOffset === 0) {
            titleEl.innerText = "Cette semaine";
        } else {
            const options = { day: 'numeric', month: 'short' };
            titleEl.innerText = `${targetMonday.toLocaleDateString('fr-FR', options)} - ${targetSunday.toLocaleDateString('fr-FR', options)}`;
        }
    }

    // --- CALCUL DES VALEURS ---
    const realValues = labels.map(label => {
        return logs.filter(l => {
            const logDate = new Date(l.timestamp);
            // FILTRE : On ne garde que les logs entre targetMonday et targetSunday
            return logDate >= targetMonday && logDate <= targetSunday;
        }).reduce((sum, l) => {
            const type = l.type;
            let mins = 0;

            if (label === 'Musculation') {
                if (["Bras 90°", "Suspension", "Tractions"].includes(type)) {
                    mins = ((parseInt(l.work) || 0) + (parseInt(l.rest) || 0)) * (parseInt(l.cycles) || 1) / 60;
                } else if (type === "Pyramide Tractions") {
                    mins = (parseInt(l.totalReps) || 0) * (parseFloat(l.avgWorkPerRep) || 0) / 60;
                }
            } 
            else if (label === 'Course' && type === "Course") {
                if (l.duration && typeof l.duration === 'string' && l.duration.includes(':')) {
                    const parts = l.duration.split(':').map(Number);
                    mins = parts.length === 3 ? (parts[0]*60 + parts[1] + parts[2]/60) : (parts[0] + parts[1]/60);
                } else { mins = parseFloat(l.duration) || 0; }
            }
            else if (label === 'Musique' && type === "Musique") {
                mins = (parseFloat(l.duration) || 0) / 60;
            }
            else if (label === 'Escalade' && type === "Escalade") {
                mins = parseFloat(l.duration) || 0;
            }
            else if (label === 'Stretching' && type === "Étirement") {
                mins = parseFloat(l.durationStr) || 0;
            }

            return sum + mins;
        }, 0);
    });

    const displayData = realValues.map((val, i) => Math.min(val / objectifs[labels[i]], 1));

    if (window.radarChartInstance) window.radarChartInstance.destroy();

    window.radarChartInstance = new Chart(canvas, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                data: displayData,
                fill: true,
                backgroundColor: 'rgba(139, 92, 246, 0.4)',
                borderColor: '#a855f7',
                borderWidth: 2,
                // --- CONFIGURATION DES POINTS ---
                pointRadius: 4,              // Taille du cercle
                pointHoverRadius: 6,         // Taille au survol
                pointStyle: 'circle',        // S'assure que c'est bien un cercle
                
                // Couleur de fond du cercle (Doré si >= 1, sinon Violet)
                /*pointBackgroundColor: (ctx) => {
                    return ctx.raw >= 1 ? '#f59e0b' : '#a855f7'; 
                },*/
                
                // Supprime la bordure violette en utilisant la même logique de couleur
                pointBorderColor: (ctx) => {
                    return ctx.raw >= 1 ? '#f59e0b' : '#a855f7'; 
                },
                
                // Alternative si vous voulez supprimer totalement la bordure :
                // pointBorderWidth: 0,
                // --------------------------------
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0, max: 1,
                    ticks: { display: false },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: {
                        color: '#94a3b8',
                        font: { size: 10, weight: 'bold' },
                        callback: (label, index) => `${label}: ${Math.round(realValues[index])}m`
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

async function changeWeek(direction) {
    // direction: -1 pour reculer (gauche), 1 pour avancer (droite)
    // On soustrait la direction : si on clique à gauche (-1), l'offset augmente (0 - -1 = 1)
    currentRadarWeekOffset -= direction; 
    
    if (currentRadarWeekOffset < 0) currentRadarWeekOffset = 0; // Sécurité futur

    try {
        const allLogs = await DB.getLogs();
        const objectifsHebdo = { 'Escalade': 120, 'Musculation': 60, 'Course': 90, 'Musique': 130, 'Stretching': 60 };
        
        renderRadarChart(allLogs, objectifsHebdo);
        
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error("Erreur lors du changement de semaine:", err);
    }
}

function renderFatigueChart(logs) {
    const ctx = document.getElementById('fatigueChart').getContext('2d');
    
    // 1. Générer les labels des 28 derniers jours (Axe X)
    const last28Days = [...Array(28).keys()].map(i => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    // 2. Calculer les scores quotidiens en excluant Musique et Étirement
    const dailyScores = last28Days.map(date => {
        return logs
            .filter(l => 
                l.timestamp.startsWith(date) && 
                l.type !== "Musique" && 
                l.type !== "Étirement"
            )
            .reduce((sum, l) => sum + (l.mood || 0), 0);
    });

    // 3. Calcul Charge Aiguë (Moyenne mobile 7 jours)
    const acuteLoad = dailyScores.map((_, i, arr) => {
        const slice = arr.slice(Math.max(0, i - 6), i + 1);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

    // 4. Calcul Charge Chronique (Moyenne mobile 28 jours)
    const chronicLoad = dailyScores.map((_, i, arr) => {
        const slice = arr.slice(0, i + 1); 
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

    // 5. Rendu du graphique avec Chart.js
    if (window.scatterChartInstance) window.fatigueChartInstance.destroy();
    window.fatigueChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: last28Days,
            datasets: [
                {
                    label: 'Charge Aiguë (7j) - Fatigue',
                    data: acuteLoad,
                    borderColor: '#8b5cf6', // Violet
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Charge Chronique (28j) - Forme',
                    data: chronicLoad,
                    borderColor: '#10b981', // Vert
                    borderDash: [5, 5], // Pointillés pour la forme de base
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top' 
                } 
            },
            scales: { 
                y: { 
                    beginAtZero: true,
                    title: { display: true, text: 'Intensité cumulée' }
                } 
            }
        }
    });
}

function renderScatterChart(logs) {
    const canvas = document.getElementById('scatterChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // On reprend ton premier mapping (linéaire et simple)
    const levelMapping = {
        // Couleurs (Positions entières)
        'jaune': 1, 'vert': 2, 'bleu': 3, 'rouge': 4, 'noir': 5, 'violet': 6,
        
        // Cotations (Positions intercalées comme dans ton 1er exemple)
        '4c': 1.5, '5a': 2.0, '5b': 2.5, '5c': 3.0, 
        '6a': 3.5, '6b': 4.0, '6c': 4.5, 
        '7a': 5.0, '7b': 5.5, '7c': 6.0, 
        '8a': 6.5, '8b': 7.0, '8c': 7.5
    };

    const climbLogs = logs.filter(l => l.type === 'Escalade' && l.details);
    const dataPoints = [];

    climbLogs.forEach(log => {
        log.details.forEach(lap => {
            const rawLevel = String(lap.level || "").toLowerCase().trim();
            const xVal = levelMapping[rawLevel] || parseFloat(rawLevel);
            const yVal = parseInt(lap.effort);
            
            if (xVal && !isNaN(yVal)) {
                dataPoints.push({
                    x: xVal + (Math.random() * 0.3 - 0.15), // Jitter
                    y: yVal + (Math.random() * 0.3 - 0.15),
                    originalLevel: lap.level,
                    effortReal: yVal
                });
            }
        });
    });

    if (window.scatterChartInstance) window.scatterChartInstance.destroy();
    if (dataPoints.length === 0) return;

    window.scatterChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                data: dataPoints,
                backgroundColor: 'rgba(168, 85, 247, 0.7)',
                pointRadius: 6,
                borderColor: '#fff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                // AXE DU BAS : COULEURS (Basé sur ton 1er exemple)
                x: { 
                    position: 'bottom',
                    title: { display: true, text: 'Difficulté (Couleurs)', color: '#94a3b8' },
                    min: 0, max: 7,
                    ticks: {
                        stepSize: 1,
                        color: '#94a3b8',
                        callback: (v) => ["", "Jaune", "Vert", "Bleu", "Rouge", "Noir", "Violet"][Math.round(v)] || ""
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                // AXE DU HAUT : COTATIONS (Second axe synchronisé)
                x2: {
                    position: 'top',
                    title: { display: true, text: 'Cotations (Voie)', color: '#94a3b8' },
                    min: 0, max: 7,
                    afterBuildTicks: axis => {
                        // On force les graduations sur les demi-points (1.5, 2.0, 2.5...)
                        axis.ticks = [0.0,0.5,1.0,1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0,6.5, 7.0].map(v => ({value: v}));
                    },
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) {
                            const labels = {
                                0.0: '3c',0.5: '4a',1.0: '4b',
                                1.5: '4c', 2.0: '5a',2.5: '5b', 3.0: '5c', 3.5: '6a', 
                                4.0: '6b', 4.5: '6c', 5.0: '7a', 5.5: '7b', 
                                6.0: '7c',6.5: '8a', 7.0: '8b'
                            };
                            return labels[value] || "";
                        }
                    },
                    grid: { display: false }
                },
                y: { 
                    title: { display: true, text: 'Effort (1-5)', color: '#94a3b8' },
                    min: 0, max: 6,
                    ticks: { stepSize: 1, color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ` Niveau: ${ctx.raw.originalLevel} - Effort: ${ctx.raw.effortReal}/5`
                    }
                }
            }
        }
    });
}



const voieLevelMap = {
    '4c': 1, '5a': 2, '5b': 3, '5c': 4,
    '6a': 5, '6a+': 6, '6b': 7, '6b+': 8, '6c': 9, '6c+': 10,
    '7a': 11, '7a+': 12, '7b': 13, '7b+': 14, '7c': 15, '7c+': 16,
    '8a': 17, '8a+': 18, '8b': 19, '8b+': 20, '8c': 21, '8c+': 22,
    '9a': 23, '9a+': 24, '9b': 25, '9b+': 26, '9c': 27
};

// Liste inverse pour l'affichage des labels sur l'axe Y
const voieLabels = [
    '', '4c', '5a', '5b', '5c', '6a', '6a+', '6b', '6b+', '6c', '6c+',
    '7a', '7a+', '7b', '7b+', '7c', '7c+', '8a', '8a+', '8b', '8b+', '8c', '8c+',
    '9a', '9a+', '9b', '9b+', '9c'
];
function renderBlocEvolutionChart(climbLogs) {
    const canvas = document.getElementById('blocEvolutionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const blocLogs = climbLogs.filter(log => log.exercise === 'Bloc');

    const levelMap = {
        'Jaune': 1, '4': 1,
        'Vert': 2, '5a': 2, '5b': 2, '5c': 2,
        'Bleu': 3, '6a': 3, '6a+': 3,
        'Rouge': 4, '6b': 4, '6b+': 4, '6c': 4,
        'Noir': 5, '6c+': 5, '7a': 5, '7a+': 5, '7b': 5,
        'Violet': 6, '7b+': 6, '7c': 6, '8a': 6
    };

    const labels = [];
    const rawSuccess = [];
    const rawProject = [];

    blocLogs.forEach(log => {
        if (!log.details || log.details.length === 0) return;

        labels.push(new Date(log.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        
        const validated = log.details.filter(d => d.success).map(d => levelMap[d.level] || 0);
        rawSuccess.push(validated.length > 0 ? Math.max(...validated) : 0);
        
        const attempted = log.details.map(d => {
            const base = levelMap[d.level] || 0;
            const effortBonus = (6 - parseInt(d.effort)) * 0.2; 
            return d.success ? base + effortBonus : base - 0.5;
        });
        rawProject.push(Math.max(...attempted));
    });

    // Calcul des moyennes mobiles sur 4 séances
    const avgSuccessData = [];
    const avgProjectData = [];
    for (let i = 0; i < rawSuccess.length; i++) {
        const start = Math.max(0, i - 3);
        const windowS = rawSuccess.slice(start, i + 1);
        const windowP = rawProject.slice(start, i + 1);
        avgSuccessData.push(windowS.reduce((a, b) => a + b, 0) / windowS.length);
        avgProjectData.push(windowP.reduce((a, b) => a + b, 0) / windowP.length);
    }

    createClimbChart(ctx, 'Bloc', labels, rawSuccess, avgSuccessData, avgProjectData, 'window.myBlocChart', 7);
}

function renderVoieEvolutionChart(climbLogs) {
    const canvas = document.getElementById('voieEvolutionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const voieLogs = climbLogs.filter(log => log.exercise === 'Voie');

    const levelMap =  {
    '4c': 1, '5a': 2, '5b': 3, '5c': 4,
    '6a': 5, '6a+': 6, '6b': 7, '6b+': 8, '6c': 9, '6c+': 10,
    '7a': 11, '7a+': 12, '7b': 13, '7b+': 14, '7c': 15, '7c+': 16,
    '8a': 17, '8a+': 18, '8b': 19, '8b+': 20, '8c': 21, '8c+': 22,
    '9a': 23, '9a+': 24, '9b': 25, '9b+': 26, '9c': 27
    };
    const labels = [];
    const rawSuccess = [];
    const rawProject = [];

    voieLogs.forEach(log => {
        if (!log.details || log.details.length === 0) return;
        labels.push(new Date(log.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        
        const validated = log.details.filter(d => d.success).map(d => levelMap[d.level] || 0);
        rawSuccess.push(validated.length > 0 ? Math.max(...validated) : 0);
        
        const attempted = log.details.map(d => {
            const base = levelMap[d.level] || 0;
            const effortBonus = (6 - parseInt(d.effort)) * 0.2; 
            return d.success ? base + effortBonus : base - 0.5;
        });
        rawProject.push(Math.max(...attempted));
    });

    const avgSuccessData = [];
    const avgProjectData = [];
    for (let i = 0; i < rawSuccess.length; i++) {
        const start = Math.max(0, i - 3);
        const windowS = rawSuccess.slice(start, i + 1);
        const windowP = rawProject.slice(start, i + 1);
        avgSuccessData.push(windowS.reduce((a, b) => a + b, 0) / windowS.length);
        avgProjectData.push(windowP.reduce((a, b) => a + b, 0) / windowP.length);
    }

    createClimbChart(ctx, 'Voie', labels, rawSuccess, avgSuccessData, avgProjectData, 'window.myVoieChart', 27);
}

function createClimbChart(ctx, type, labels, successData, avgSuccessData, avgProjectData, chartRef, yMax) {
    const globalRef = chartRef === 'window.myBlocChart' ? window.myBlocChart : window.myVoieChart;
    if (globalRef) globalRef.destroy();

    const mainColor = type === 'Bloc' ? '#10b981' : '#3b82f6';
    const projectColor = '#ec4899'; // Rose
    const avgColor = '#f59e0b';    // Jaune/Ambre

    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Moyenne Potentiel (Rose)',
                    data: avgProjectData,
                    borderColor: projectColor,
                    borderDash: [5, 5],
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: 'transparent', // Vide au milieu
                    pointBorderColor: projectColor,
                    pointBorderWidth: 2,
                    pointHoverRadius: 6,
                },
                {
                    label: 'Moyenne Validé (Jaune)',
                    data: avgSuccessData,
                    borderColor: avgColor,
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 4,
                    pointBackgroundColor: 'transparent', // Vide au milieu
                    pointBorderColor: avgColor,
                    pointBorderWidth: 2,
                    pointHoverRadius: 6,
                    fill: true
                },
                {
                    label: `Séance (${type})`,
                    data: successData,
                    borderColor: mainColor,
                    backgroundColor: 'transparent',
                    tension: 0.2,
                    borderWidth: 1,
                    pointRadius: 4,
                    pointBackgroundColor: 'transparent', // Vide au milieu
                    pointBorderColor: mainColor,
                    pointBorderWidth: 2,
                    pointHoverRadius: 6,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: yMax,
                    ticks: {
                        stepSize: 1,
                        color: '#94a3b8',
                        font: { size: 9 },
                        callback: function(value) {
                            if (type === 'Bloc') {
                                const bLabels = ['', 'Jaune', 'Vert', 'Bleu', 'Rouge', 'Noir', 'Violet', 'Élite'];
                                return bLabels[value] || '';
                            }
                            return (typeof voieLabels !== 'undefined') ? voieLabels[value] || '' : value;
                        }
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
            },
            plugins: {
                legend: { 
                    labels: { color: '#f8fafc', font: { size: 10 }, usePointStyle: true } 
                },
            }
        }
    });

    if (chartRef === 'window.myBlocChart') window.myBlocChart = newChart;
    else window.myVoieChart = newChart;
}

function updateGeneralCounters(logs) {
    const musicTotal = logs
        .filter(l => l.type === 'Musique')
        .reduce((acc, l) => acc + (parseInt(l.duration) || 0), 0);
    
    const zenTotal = logs
        .filter(l => l.type === 'Étirement')
        .reduce((acc, l) => acc + (parseInt(l.duration) || 0), 0);

    const mElem = document.getElementById('stat-total-music');
    const zElem = document.getElementById('stat-total-zen');
    if (mElem) mElem.innerText = (musicTotal / 3600).toFixed(1) + "h";
    if (zElem) zElem.innerText = Math.round(zenTotal / 60) + "m";
}


function renderMainChart(logs) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (window.myChart) window.myChart.destroy();

    // On prend les 10 derniers jours avec un ressenti (mood)
    const moodData = logs
        .filter(l => l.mood)
        .slice(0, 10)
        .reverse();

    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: moodData.map(l => new Date(l.timestamp).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'})),
            datasets: [{
                label: 'Ressenti',
                data: moodData.map(l => l.mood),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Autorise le graphique à remplir toute la hauteur
            plugins: { legend: { display: false } },
            scales: { 
                y: { min: 1, max: 5, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    })
}

// Fonction pour transformer "4:30" en 4.5 pour le graphique
function paceToFloat(paceStr) {
    const parts = paceStr.split(':');
    return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
}

function renderRunChart(data) {
    const ctx = document.getElementById('runChart').getContext('2d');
    if (window.myRunChart) window.myRunChart.destroy();

    // Calcul de l'allure médiane sur un mois glissant
    const medianData = data.map((d, i) => {
        const currentDate = new Date(d.timestamp);
        const oneMonthAgo = new Date(currentDate);
        oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

        // On récupère les séances dans la fenêtre de 30 jours
        const monthSessions = data.filter(s => {
            const sDate = new Date(s.timestamp);
            return sDate <= currentDate && sDate >= oneMonthAgo;
        });

        const paces = monthSessions.map(s => paceToFloat(s.pace)).sort((a, b) => a - b);
        const mid = Math.floor(paces.length / 2);
        return paces.length % 2 !== 0 ? paces[mid] : (paces[mid - 1] + paces[mid]) / 2;
    });

    window.myRunChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.timestamp).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})),
            datasets: [
                {
                    label: 'Allure actuelle',
                    data: data.map(d => paceToFloat(d.pace)),
                    borderColor: '#818cf8',
                    backgroundColor: 'rgba(129, 140, 248, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Médiane (1 mois)',
                    data: medianData,
                    borderColor: '#fbbf24', // Ambre/Orange
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0, // On ne veut pas de points sur cette ligne
                    fill: false,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    reverse: true,
                    ticks: { callback: value => Math.floor(value) + ":" + Math.round((value % 1) * 60).toString().padStart(2, '0') }
                }
            },
            plugins: { legend: { display: true, labels: { color: '#94a3b8', boxWidth: 10 } } }
        }
    });
}

function renderProgressionChart(data) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    if (window.mystatsChart) window.mystatsChart.destroy();

    // --- CORRECTION ICI : On inverse l'ordre des données avant le rendu ---
    // [...data] crée une copie pour ne pas impacter le reste de l'application
    // .reverse() remet le plus ancien à gauche (index 0)
    const displayData = [...data] ;

    window.mystatsChart = new Chart(ctx, {
        type: 'line',
        data: {
            // On utilise displayData au lieu de data
            labels: displayData.map(d => d.date.split('/')[0] + '/' + d.date.split('/')[1]),
            datasets: [{
                label: 'Repos/Rep',
                data: displayData.map(d => parseFloat(d.avgRestPerRep) || 0),
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    display: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)', drawBorder: true },
                    ticks: { color: '#94a3b8', font: { size: 10 } },
                    title: { display: true, text: 'Sec / Rep', color: '#94a3b8', font: { size: 9 } }
                },
                x: {
                    display: true,
                    grid: { display: false },
                    ticks: { color: '#94a3b8', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderVolumeChart(logs) {
    const canvas = document.getElementById('volumeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const last7DaysDates = [];
    const last7DaysLabels = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7DaysLabels.push(d.toLocaleDateString('fr-FR', { weekday: 'short' }));
        const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        last7DaysDates.push(ds);
    }

    const getScore = (date, category) => {
        return logs
            .filter(l => {
                const logDate = l.timestamp.split('T')[0];
                if (logDate !== date) return false;

                if (category === 'Musculation') {
                    // AJOUT : On inclut "Tractions" et tout type contenant "Tractions" (pour les pyramides)
                    return (
                        l.type === 'Bras 90°' || 
                        l.type === 'Suspension' || 
                        l.type === 'Tractions' || 
                        (l.type && l.type.includes('Tractions'))
                    );
                }
                if (category === 'Escalade') {
                    return l.type === 'Escalade' || l.type === 'escalade';
                }
                return l.type === category;
            })
            .reduce((total, l) => {
                if (l.type === 'Course') return total + (parseFloat(l.distance) * 10 || 0);
                if (l.type === 'Musique' || l.type === 'Étirement') return total + (Math.round(parseInt(l.duration) / 60) || 0);
                
                // Volume Escalade = Nombre de tentatives (laps)
                // Dans ton reduce de getScore pour l'escalade :
                if (l.type === 'Escalade' || l.type === 'escalade') {
                    if (!l.details) return total;

                    const pointsSeance = l.details.reduce((acc, bloc) => {
                        const niveau = bloc.level; 
                        
                        switch (niveau) {
                            // --- SYSTÈME ARKOSE / COTATIONS ---
                            case 'Jaune':  case '4c':           return acc + 1;   // Échauffement
                            case 'Vert':   case '5a': case '5b': return acc + 2;   
                            case 'Bleu':   case '5c': case '6a': return acc + 4;   // Un peu de challenge
                            case 'Rouge':  case '6b': case '6c': return acc + 8;   // Effort intense
                            case 'Noir':   case '7a': case '7b': return acc + 16;  // Très intense
                            case 'Violet': case '7c': case '8a': return acc + 32;  // Performance
                            default: return acc + 3; 
                        }
                    }, 0);

                    return total + pointsSeance;
                }

                return total + (parseInt(l.totalReps) || parseInt(l.cycles) || 0);
            }, 0);
    };

    if (window.myVolumeChart) window.myVolumeChart.destroy();
    window.myVolumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last7DaysLabels,
            datasets: [
                { label: 'Muscu', data: last7DaysDates.map(d => getScore(d, 'Musculation')), backgroundColor: '#8b5cf6', borderRadius: 4 },
                { label: 'Run', data: last7DaysDates.map(d => getScore(d, 'Course')), backgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'Grimpe', data: last7DaysDates.map(d => getScore(d, 'Escalade')), backgroundColor: '#ec4899', borderRadius: 4 },
                { label: 'Musique', data: last7DaysDates.map(d => getScore(d, 'Musique')), backgroundColor: '#f59e0b', borderRadius: 4 },
                { label: 'Zen', data: last7DaysDates.map(d => getScore(d, 'Étirement')), backgroundColor: '#10b981', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { 
                    stacked: false, // BARRES CÔTE À CÔTE
                    grid: { display: false }
                },
                y: { 
                    beginAtZero: true, 
                    stacked: false, // BARRES CÔTE À CÔTE
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#64748b', font: { size: 10 } }
                } 
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', boxWidth: 8, padding: 15, font: { size: 10, weight: 'bold' } }
                }
            },
            barPercentage: 0.8, // Ajuste la largeur des barres pour éviter qu'elles soient trop fines
            categoryPercentage: 0.9
        }
    });
}

async function deleteLog(event, id) {
    event.stopPropagation(); // Empêche d'ouvrir/fermer la carte en cliquant sur supprimer

    if (confirm("Supprimer cette séance définitivement ?")) {
        try {
            await DB.deleteLog(id); // On supprime dans IndexedDB
            await renderLogs();    // On rafraîchit la liste
            
            // Si tu as un graphique ou des compteurs d'objectifs, 
            // n'oublie pas de les rafraîchir ici aussi
            if (window.updateGoalsDashboard) await updateGoalsDashboard();
            
        } catch (err) {
            console.error("Erreur lors de la suppression :", err);
            alert("Impossible de supprimer la séance.");
        }
    }
}

function checkRecords(logs) {
    if (logs.length < 2) return;
    
    // Le dernier log (le plus récent)
    const latest = logs[0];
    // Tous les autres
    const history = logs.slice(1);

    // Record de Volume
    const maxRepsHistory = Math.max(...history.map(l => parseInt(l.totalReps) || 0));
    if (parseInt(latest.totalReps) > maxRepsHistory) {
        animateRecord('stat-total-reps');
    }

    // Record de Vitesse (Le plus bas est le mieux)
    const bestSpeedHistory = Math.min(...history.map(l => parseFloat(l.avgWorkPerRep) || 999));
    if (parseFloat(latest.avgWorkPerRep) < bestSpeedHistory) {
        animateRecord('stat-avg-speed');
    }
}

function animateRecord(elementId) {
    const el = document.getElementById(elementId);
    el.classList.add('text-yellow-400', 'animate-bounce');
    // On retire l'animation après 3s mais on laisse la couleur or
    setTimeout(() => el.classList.remove('animate-bounce'), 3000);
}

// -------------- COURSE -----------------------------------



let runInterval;
let runSeconds = 0;
let isRunning = false;

let runStartTime = null; // Stocke le moment précis du début
let runSecondsBeforePause = 0; // Stocke le cumul des sessions précédentes (si pause)

function saveRunState() {
    localStorage.setItem('run_startTime', runStartTime);
    localStorage.setItem('run_secondsBeforePause', runSecondsBeforePause);
    localStorage.setItem('run_isRunning', isRunning);
}

function clearRunState() {
    localStorage.removeItem('run_startTime');
    localStorage.removeItem('run_secondsBeforePause');
    localStorage.removeItem('run_isRunning');
}

function toggleRunTimer() {
    const btn = document.getElementById('btn-run');
    
    if (!isRunning) {
        isRunning = true;
        btn.innerText = "Pause";
        btn.classList.replace('bg-blue-600', 'bg-orange-500');

        runStartTime = Date.now();
        saveRunState(); // <--- SAUVEGARDE

        launchRunInterval();
    } else {
        isRunning = false;
        btn.innerText = "Reprendre";
        btn.classList.replace('bg-orange-500', 'bg-blue-600');
        
        runSecondsBeforePause = runSeconds;
        clearInterval(runInterval);
        
        saveRunState(); // <--- SAUVEGARDE
        sendTimerNotification(runSeconds, "Course en pause");
    }
}

// On isole la boucle pour pouvoir la relancer au démarrage
function launchRunInterval() {
    if (runInterval) clearInterval(runInterval);
    
    runInterval = setInterval(() => {
        const now = Date.now();
        // On recalcule TOUJOURS par rapport à l'heure de départ stockée
        const totalElapsedMs = (now - runStartTime) + (runSecondsBeforePause * 1000);
        runSeconds = Math.floor(totalElapsedMs / 1000);
        
        updateRunDisplay();

        if (runSeconds % 60 === 0 && runSeconds > 0) {
            sendTimerNotification(runSeconds, "Course en cours");
        }
    }, 1000);
}

async function sendTimerNotification(seconds, status) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        
        // Formatage HH:MM:SS pour la notification
        const timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);
        
        registration.showNotification("Zenith Coach", {
            body: `${status} : ${timeStr}`,
            icon: 'icon-192.png',
            badge: 'icon-192.png', // Petite icône dans la barre d'état
            tag: 'run-timer', // Important : remplace la notif précédente au lieu d'en créer une nouvelle
            silent: true,
            renotify: false
        });
    }
}

function updateRunDisplay() {
    const h = Math.floor(runSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((runSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (runSeconds % 60).toString().padStart(2, '0');
    document.getElementById('run-timer').innerText = `${h}:${m}:${s}`;
}

function stopAndSaveRun() {
    // 1. Arrêt du chrono et de l'état
    clearInterval(runInterval);
    isRunning = false;

    const distInput = document.getElementById('run-distance');
    const distance = parseFloat(distInput.value) || 0;

    // 2. Validation
    if (distance <= 0) {
        alert("Saisis une distance pour enregistrer ta course !");
        return;
    }

    // 3. Calcul de l'allure haute précision (Minutes:Secondes au kilomètre)
    // On utilise le nombre TOTAL de secondes accumulées
    const totalSeconds = runSeconds; 
    const secondsPerKm = totalSeconds / distance;

    const paceMin = Math.floor(secondsPerKm / 60);
    const paceSec = Math.round(secondsPerKm % 60); 
    
    // Gestion du cas particulier où l'arrondi des secondes arrive à 60
    let finalPaceMin = paceMin;
    let finalPaceSec = paceSec;
    if (finalPaceSec === 60) {
        finalPaceMin += 1;
        finalPaceSec = 0;
    }

    const finalPaceStr = `${finalPaceMin}:${finalPaceSec.toString().padStart(2, '0')}`;

    // 4. Préparation des données pour IndexedDB (via le Mood Selector)
    const runData = {
        type: 'Course',
        distance: distance,
        duration: document.getElementById('run-timer').innerText, // Temps formaté HH:MM:SS
        durationSeconds: totalSeconds, // Optionnel: utile pour tes futurs graphiques
        pace: finalPaceStr,
        paceRaw: secondsPerKm, // Optionnel: utile pour calculer une moyenne de vitesse plus tard
        timestamp: new Date().toISOString(),
        note: `${distance}km en ${finalPaceStr} min/km`
    };

    // 5. Nettoyage de la persistance (LocalStorage)
    clearRunState(); 

    // 6. Mise à jour de l'UI pour afficher le sélecteur d'humeur
    // On bascule sur la section muscu car c'est là que se trouve ton conteneur d'exercice actif
    showSection('muscu'); 
    document.getElementById('exercise-menu').classList.add('hidden');
    document.getElementById('exercise-active').classList.remove('hidden');
    
    // Envoi vers le sélecteur final (qui fera le db.add)
    showMoodSelector(runData);

    // 7. Reset complet du chrono pour la prochaine fois
    runSeconds = 0;
    runSecondsBeforePause = 0;
    distInput.value = "";
    updateRunDisplay();
    
    // Nettoyage des notifications
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.getNotifications({ tag: 'run-timer' }).then(notifications => {
                notifications.forEach(n => n.close());
            });
        });
    }
}

function finalSave2(mood) {
    if (!pendingData) return;

    // On fusionne les données de la séance avec le mood choisi
    const entryToSave = {
        ...pendingData,
        mood: mood,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('fr-FR')
    };

    // Sauvegarde DB
    DB.saveLog(entryToSave);

    // Reset de la variable temporaire
    pendingData = null;

    // Retour au menu muscu et rafraîchissement du journal
    showSection('muscu');
    renderLogs();
    
    // Si on était dans l'interface "exercice actif", on revient au menu
    document.getElementById('exercise-menu')?.classList.remove('hidden');
    document.getElementById('exercise-active')?.classList.add('hidden');
}

//------------------ MUSIQUE ----------------------------------------------





let musicStartTime = null; // Stockera l'heure exacte du début
let musicInterval = null;
let currentInstrument = "";

function startMusicSession(instrument) {
    currentInstrument = instrument;
    musicStartTime = Date.now();

    // SAUVEGARDE : On écrit dans le localStorage
    localStorage.setItem('active_music_start', musicStartTime);
    localStorage.setItem('active_music_instrument', instrument);
    
    // UI Switch
    document.getElementById('music-setup').classList.add('hidden');
    document.getElementById('music-active').classList.remove('hidden');
    document.getElementById('active-instrument-name').innerText = instrument;

    launchMusicInterval();
}

// On isole la boucle dans une fonction pour pouvoir la relancer au démarrage
function launchMusicInterval() {
    if (musicInterval) clearInterval(musicInterval);
    
    const updateTimer = () => {
        const startTime = localStorage.getItem('active_music_start');
        if (!startTime) {
            stopMusicSession();
            return;
        }

        const totalSeconds = Math.floor((Date.now() - parseInt(startTime)) / 1000);
        const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const secs = (totalSeconds % 60).toString().padStart(2, '0');
        
        const timerElement = document.getElementById('music-timer');
        if (timerElement) timerElement.innerText = `${mins}:${secs}`;

        // Notification toutes les 2 minutes (120s)
        if (totalSeconds % 120 === 0 && totalSeconds > 0) {
            sendMusicNotification(totalSeconds, localStorage.getItem('active_music_instrument'));
        }
    };

    updateTimer(); // Exécution immédiate
    musicInterval = setInterval(updateTimer, 1000); // Puis boucle
}

function stopMusicSession() {
    clearInterval(musicInterval);
    
    // Récupération depuis le storage pour être sûr
    const savedStart = localStorage.getItem('active_music_start');
    const instrumentName = localStorage.getItem('active_music_instrument') || 'Musique';

    if (!savedStart) return;

    const finalSeconds = Math.floor((Date.now() - savedStart) / 1000);
    const durationMins = Math.floor(finalSeconds / 60);
    const durationStr = durationMins > 0 ? `${durationMins} min` : `${finalSeconds} sec`;
    
    const musicData = {
        type: 'Musique',
        exercise: instrumentName,
        instrument: instrumentName,
        duration: finalSeconds,
        durationStr: durationStr,
        note:`Session de ${instrumentName} (${durationStr})`,
        timestamp: new Date().toISOString()
    };

    // NETTOYAGE : Très important
    localStorage.removeItem('active_music_start');
    localStorage.removeItem('active_music_instrument');

    // Reset UI
    document.getElementById('music-setup').classList.remove('hidden');
    document.getElementById('music-active').classList.add('hidden');
    document.getElementById('music-timer').innerText = "00:00";
    
    clearMusicNotification();
    showMoodSelector(musicData);
}




async function sendMusicNotification(seconds, instrument) {
    if ('serviceWorker' in navigator && Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        const timeStr = new Date(seconds * 1000).toISOString().substr(14, 5); // Format MM:SS
        
        registration.showNotification("Zenith Musique", {
            body: `Session de ${instrument} : ${timeStr}`,
            icon: 'icon-192.png',
            tag: 'music-timer', // Remplace la notif précédente
            silent: true, // Pas de vibration à chaque minute
            renotify: false
        });
    }
}

async function clearMusicNotification() {
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const notifications = await registration.getNotifications({ tag: 'music-timer' });
        notifications.forEach(n => n.close());
    }
}

let audioCtx = null;
let isMetronomeRunning = false;
let nextNoteTime = 0.0;
let timerID = null;
let bpm = 120;

function toggleMetronome() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    isMetronomeRunning = !isMetronomeRunning;
    const btn = document.getElementById('btn-metronome');

    if (isMetronomeRunning) {
        btn.innerText = "Stop";
        btn.classList.replace('bg-violet-600', 'bg-red-500');
        scheduler();
    } else {
        btn.innerText = "Start";
        btn.classList.replace('bg-red-500', 'bg-violet-600');
        clearTimeout(timerID);
    }
}

function scheduler() {
    while (nextNoteTime < audioCtx.currentTime + 0.1) {
        playClick(nextNoteTime);
        nextNoteTime += 60.0 / bpm;
    }
    timerID = setTimeout(scheduler, 25.0);
}

function playClick(time) {
    const osc = audioCtx.createOscillator();
    const envelope = audioCtx.createGain();

    osc.frequency.value = 880; // Son du clic
    envelope.gain.value = 1;
    envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

    osc.connect(envelope);
    envelope.connect(audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.1);
}

function syncBpm(val) {
    bpm = val;
    document.getElementById('bpm-display').innerText = val;
}

function updateBpm(delta) {
    const slider = document.getElementById('bpm-slider');
    slider.value = parseInt(slider.value) + delta;
    syncBpm(slider.value);
}

let tunerInterval;
let analyser;
let microphone;

async function toggleTuner() {
    const status = document.getElementById('tuner-status');
    const noteEl = document.getElementById('tuner-note');
    const btn = document.getElementById('btn-tuner');

    if (analyser) {
        // Stop Tuner
        analyser = null;
        status.innerText = "Micro éteint";
        noteEl.innerText = "--";
        btn.innerText = "Activer";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        analyser.fftSize = 2048;
        
        status.innerText = "À l'écoute...";
        btn.innerText = "Couper";
        updateTuner();
    } catch (err) {
        alert("Microphone refusé ou non disponible.");
    }
}

function updateTuner() {
    if (!analyser) return;
    const buffer = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buffer);
    
    let freq = detectPitch(buffer, 44100); 
    
    if (freq && freq > 20 && freq < 2000) {
        // 1. Calcul de la note et du décalage (cents)
        const HALF_STEP = 12 * Math.log2(freq / 440) + 69;
        const noteIndex = Math.round(HALF_STEP);
        const centsOff = Math.floor(100 * (HALF_STEP - noteIndex));
        
        // 2. Noms des notes
        const notes = ["DO", "DO#", "RE", "RE#", "MI", "FA", "FA#", "SOL", "SOL#", "LA", "LA#", "SI"];
        document.getElementById('tuner-note').innerText = notes[noteIndex % 12];

        // 3. Déplacement de l'aiguille (-50% à +50% de la barre)
        const needle = document.getElementById('tuner-needle');
        const position = 50 + centsOff; // centré à 50%
        needle.style.left = `${Math.max(5, Math.min(95, position))}%`;

        // 4. Couleur dynamique (Vert si proche du centre)
        if (Math.abs(centsOff) < 5) {
            needle.style.backgroundColor = "#10b981"; // Emerald
            needle.style.boxShadow = "0 0 15px #10b981";
        } else {
            needle.style.backgroundColor = "white";
            needle.style.boxShadow = "0 0 10px white";
        }
    }
    requestAnimationFrame(updateTuner);
}

// Fonction utilitaire pour détecter la hauteur
function detectPitch(buffer, sampleRate) {
    let maxCorrelation = 0;
    let bestOffset = -1;
    for (let offset = 20; offset < 500; offset++) {
        let correlation = 0;
        for (let i = 0; i < buffer.length - offset; i++) {
            correlation += Math.abs(buffer[i] - buffer[i + offset]);
        }
        if (bestOffset === -1 || correlation < maxCorrelation) {
            maxCorrelation = correlation;
            bestOffset = offset;
        }
    }
    return sampleRate / bestOffset;
}



//----------------- ETIREMMENT ------------------------




const STRETCH_DATA = {
// Parfait
    "Grimpeur - Grand Écart & Bassin": {
    "type": "Mixte",
    "duration": 15,
    "tags": ["Mixte", "Moyen", "Grimpe", "Hanches","Hebdomadaire"],
    "exos": [
      // 🔹 Activation (5 min)
        { "name": "Cossack squat contrôlé", "d": 60, "img": "move-horizontal" },
        { "name": "Fente haute active (Psoas G)", "d": 30, "img": "zap" },
        { "name": "Fente haute active (Psoas D)", "d": 30, "img": "zap" },
        { "name": "Rotations internes hanches (sol)", "d": 60, "img": "rotate-ccw" },
        { "name": "Balancier jambes latéral contrôlé", "d": 60, "img": "arrow-left-right" },
        { "name": "Squat profond actif (maintien)", "d": 60, "img": "arrow-down" },

        // 🔹 Ouverture ciblée (7 min)
        { "name": "90/90 hanches + inclinaison (G)", "d": 60, "img": "rotate-ccw" },
        { "name": "90/90 hanches + inclinaison (D)", "d": 60, "img": "rotate-ccw" },
        { "name": "Grenouille active (adducteurs)", "d": 120, "img": "layout-grid" },
        { "name": "Demi-grand écart ischio (G)", "d": 60, "img": "stretch-vertical" },
        { "name": "Demi-grand écart ischio (D)", "d": 60, "img": "stretch-vertical" },
        { "name": "Pancake actif léger", "d": 60, "img": "layers" },

        // 🔹 Spécifique split (3 min)
        { "name": "Grand écart latéral actif", "d": 120,"img": "expand" },
        { "name": "Grand écart facial contrôlé (option)", "d": 60, "img": "expand" }
    ]},
//10 min 
    "Quotidien Forme": { "type": "Mixte", "duration": 10,
        "tags": ["Mixte", "Moyen", "Quotidien", "Full Body"],
        "exos": [
        { "name": "Cercle cou/épaules", "d": 45, "img": "refresh-cw" },
        { "name": "Dos de chat / Vache", "d": 60, "img": "cat" },
        { "name": "Rotation buste au sol", "d": 90, "img": "move" },
        { "name": "Fente basse ouverture", "d": 90, "img": "arrow-up-right" },
        { "name": "Squat profond", "d": 90, "img": "arrow-down" },
        { "name": "Chien tête en bas", "d": 90, "img": "dog" },
        { "name": "Étirement latéral debout", "d": 90, "img": "side-stretch" },
        { "name": "Coup de pied fessier (dyn)", "d": 45, "img": "activity" }
    ]},
//7min très bien
    "Réveil Articulaire": { "type": "Actif", "duration": 7, 
        "tags": ["Actif", "Court", "Quotidien", "Full Body"],
        "exos": [
        { "name": "Moulinets bras", "d": 60, "img": "rotate-cw" },
        { "name": "Poignets & Doigts", "d": 60, "img": "hand" },
        { "name": "Cossack Squats", "d": 60, "img": "move-horizontal" },
        { "name": "Balancier de jambes", "d": 60, "img": "arrow-left-right" },
        { "name": "Rotations chevilles", "d": 60, "img": "refresh-cw" },
        { "name": "Cercle de hanches", "d": 60, "img": "circle" },
        { "name": "Ouverture cage (Y-W)", "d": 60, "img": "expand" }
    ]},
// 27 min manque des min
    "Ouverture Bassin Profonde": { "type": "Passif", "duration": 27,
        "tags": ["Passif", "Long", "Hanches","Mensuel"],
        "exos": [
        { "name": "Papillon", "d": 180, "img": "unfold-more" },
        { "name": "90/90 Hanches (G)", "d": 120, "img": "rotate-ccw" },
        { "name": "90/90 Hanches (D)", "d": 120, "img": "rotate-ccw" },
        { "name": "Pigeon Gauche", "d": 180, "img": "pigeon" },
        { "name": "Pigeon Droit", "d": 180, "img": "pigeon" },
        { "name": "Grenouille", "d": 240, "img": "layout-grid" },
        { "name": "Lézard profond (G)", "d": 180, "img": "maximize" },
        { "name": "Lézard profond (D)", "d": 180, "img": "maximize" },
        { "name": "Demi-grand écart (G)", "d": 150, "img": "stretch" },
        { "name": "Demi-grand écart (D)", "d": 150, "img": "stretch" },
        { "name": "Posture du Héros", "d": 120, "img": "user" }
    ]},
// 50 min un peu long
    "Full Body Récupération": { "type": "Passif", "duration": 50, 
        "tags": ["Passif", "Long", "Full Body","Mensuel"],
        "exos": [
        // --- Haut du Corps & Dos (10.5 min / 630s) ---
        { "name": "Posture de l'enfant (Respiration)", "d": 90, "img": "baby" },
        { "name": "Posture de l'enfant (Bras G)", "d": 90, "img": "chevron-left" },
        { "name": "Posture de l'enfant (Bras D)", "d": 90, "img": "chevron-right" },
        { "name": "Chien tête en bas (Pédalage)", "d": 90, "img": "dog" },
        { "name": "Chien tête en bas (Statique)", "d": 90, "img": "dog" },
        { "name": "Cobra (Ouverture douce)", "d": 90, "img": "snake" },
        { "name": "Posture du chiot (Front au sol)", "d": 90, "img": "dog" },

        // --- Poignets & Avant-bras (6 min / 360s) ---
        { "name": "Étirement fléchisseurs doigts", "d": 90, "img": "hand" },
        { "name": "Étirement extenseurs poignets", "d": 90, "img": "hand" },
        { "name": "Torsion avant-bras G (Sol)", "d": 90, "img": "rotate-ccw" },
        { "name": "Torsion avant-bras D (Sol)", "d": 90, "img": "rotate-ccw" },

        // --- Chaîne Antérieure & Psoas (9 min / 540s) ---
        { "name": "Fente basse - Psoas G (Basique)", "d": 90, "img": "arrow-up-right" },
        { "name": "Fente basse - Psoas G (Bras levé)", "d": 90, "img": "arrow-up-right" },
        { "name": "Fente basse - Psoas D (Basique)", "d": 90, "img": "arrow-up-right" },
        { "name": "Fente basse - Psoas D (Bras levé)", "d": 90, "img": "arrow-up-right" },
        { "name": "Étirement Quadriceps (G)", "d": 90, "img": "zap" },
        { "name": "Étirement Quadriceps (D)", "d": 90, "img": "zap" },

        // --- Fessiers & Adducteurs (12 min / 720s) ---
        { "name": "Pigeon - Fessier G (Actif)", "d": 90, "img": "pigeon" },
        { "name": "Pigeon - Fessier G (Relâché)", "d": 90, "img": "pigeon" },
        { "name": "Pigeon - Fessier D (Actif)", "d": 90, "img": "pigeon" },
        { "name": "Pigeon - Fessier D (Relâché)", "d": 90, "img": "pigeon" },
        { "name": "Grenouille - Phase 1", "d": 90, "img": "layout-grid" },
        { "name": "Grenouille - Phase 2 (Profond)", "d": 90, "img": "layout-grid" },
        { "name": "Papillon (Dos droit)", "d": 90, "img": "unfold-more" },
        { "name": "Papillon (Relâché)", "d": 90, "img": "unfold-more" },

        // --- Chaîne Postérieure (6 min / 360s) ---
        { "name": "Pince assise (Respiration)", "d": 90, "img": "arrow-down" },
        { "name": "Pince assise (Approfondissement)", "d": 90, "img": "arrow-down" },
        { "name": "Écart facial assis (Statique)", "d": 90, "img": "columns" },
        { "name": "Écart facial (Inclinaison latérale)", "d": 90, "img": "columns" },

        // --- Relaxation Finale (6.5 min / 410s) ---
        { "name": "Torsion colonne G", "d": 80, "img": "repeat" },
        { "name": "Torsion colonne D", "d": 80, "img": "repeat" },
        { "name": "Bébé heureux", "d": 80, "img": "smile" },
        { "name": "Jambes au mur (Calme)", "d": 85, "img": "wall" },
        { "name": "Jambes au mur (Méditation)", "d": 85, "img": "wall" }
    ]},
// 33 min manque des min
    "Souplesse Spécial Grand Écart": { "type": "Mixte", "duration": 33, 
        "tags": ["Mixte", "Long", "Hanches"],
        "exos": [
        // --- Préparation & Ischios (6 min / 360s) ---
        { "name": "Fente Flexion Ischio (G)", "d": 90, "img": "stretch-vertical" },
        { "name": "Fente Flexion Ischio (D)", "d": 90, "img": "stretch-vertical" },
        { "name": "Flexion avant debout", "d": 90, "img": "arrow-down" },
        { "name": "Compression Core (Pike)", "d": 90, "img": "activity" },

        // --- Flexion de Hanche & Psoas (6 min / 360s) ---
        { "name": "Fente haute active (G)", "d": 90, "img": "zap" },
        { "name": "Fente haute active (D)", "d": 90, "img": "zap" },
        { "name": "Posture de la demi-lune (G)", "d": 90, "img": "moon-star" },
        { "name": "Posture de la demi-lune (D)", "d": 90, "img": "moon-star" },

        // --- Latéral & Adducteurs (7.5 min / 450s) ---
        { "name": "Cossack Squat contrôlé (G)", "d": 90, "img": "move-horizontal" },
        { "name": "Cossack Squat contrôlé (D)", "d": 90, "img": "move-horizontal" },
        { "name": "Cossack Squat lesté (Alterné)", "d": 90, "img": "weight" },
        { "name": "Écart facial au mur (Partie 1)", "d": 90, "img": "columns" },
        { "name": "Écart facial au mur (Partie 2)", "d": 90, "img": "columns" },

        // --- Pancake & Ouverture (6 min / 360s) ---
        { "name": "Pancake stretch (Actif)", "d": 90, "img": "layers" },
        { "name": "Pancake stretch (Passif)", "d": 90, "img": "layers" },
        { "name": "Étirement Adducteurs assis", "d": 90, "img": "layout-grid" },
        { "name": "Rotation interne hanche", "d": 90, "img": "refresh-ccw" },

        // --- Tentatives de Grand Écart (7.5 min / 450s) ---
        { "name": "Grand écart (Prépa G)", "d": 90, "img": "expand" },
        { "name": "Grand écart (Essai G)", "d": 90, "img": "expand" },
        { "name": "Grand écart (Prépa D)", "d": 90, "img": "expand" },
        { "name": "Grand écart (Essai D)", "d": 90, "img": "expand" },
        { "name": "Prière en fente profonde", "d": 90, "img": "shield" }
    ]},
// 15 min bon ratio
    "Grimpeur : Mobilité Active": { "type": "Actif", "duration": 15, 
        "tags": ["Actif", "Moyen", "Grimpe", "Full Body","Hebdomadaire"],
        "exos": [
        { "name": "Ouverture Épaules mur", "d": 120, "img": "shield" },
        { "name": "Hanches rotation interne", "d": 120, "img": "rotate-ccw" },
        { "name": "Squat Cosaque", "d": 150, "img": "move-horizontal" },
        { "name": "Suspension active barre", "d": 120, "img": "grip" },
        { "name": "Extension poignets sol", "d": 120, "img": "hand" },
        { "name": "Rotation scapulaire", "d": 120, "img": "refresh-cw" },
        { "name": "Lézard dynamique", "d": 150, "img": "zap" }
    ]},
// 20 min un peu long les exos
    "Souplesse Jambes & Ischio": { "type": "Mixte", "duration": 20, 
        "tags": ["Mixte", "Moyen", "Hanches","Hebdomadaire"],
        "exos": [
        { "name": "Chien tête en bas dyn.", "d": 120, "img": "dog" },
        { "name": "Pince debout", "d": 120, "img": "arrow-down" },
        { "name": "Fente haute active", "d": 150, "img": "zap" },
        { "name": "Étirement Ischio couché G", "d": 180, "img": "stretch-vertical" },
        { "name": "Étirement Ischio couché D", "d": 180, "img": "stretch-vertical" },
        { "name": "Étirement Mollets", "d": 150, "img": "foot" },
        { "name": "Fente latérale", "d": 150, "img": "move-horizontal" },
        { "name": "Pyramide pose", "d": 150, "img": "triangle" }
    ]},
// 15 min
    "Haut du corps & Thorax": { "type": "Passif", "duration": 15, 
        "tags": ["Passif", "Moyen", "Dos","Hebdomadaire"],
        "exos": [
        { "name": "Pectoraux encadrement G", "d": 120, "img": "door" },
        { "name": "Pectoraux encadrement D", "d": 120, "img": "door" },
        { "name": "Étirement Triceps", "d": 120, "img": "arrow-up" },
        { "name": "Posture du chiot", "d": 180, "img": "dog" },
        { "name": "Aigle (épaules)", "d": 180, "img": "bird" },
        { "name": "Rotation thoracique", "d": 90, "img": "refresh-cw" },
        { "name": "Étirement Avant-bras", "d": 90, "img": "hand" }
    ]},
// 18 min 
    "Mobilité Colonne & Torsion": { "type": "Mixte", "duration": 18, 
        "tags": ["Mixte", "Moyen", "Dos","Hebdomadaire"],
        "exos": [
        { "name": "Thread the needle G", "d": 120, "img": "needle" },
        { "name": "Thread the needle D", "d": 120, "img": "needle" },
        { "name": "Torsion assise", "d": 180, "img": "repeat" },
        { "name": "Pont (Bridge pose)", "d": 180, "img": "arch" },
        { "name": "Cobra dynamique", "d": 180, "img": "activity" },
        { "name": "Posture de la sauterelle", "d": 150, "img": "zap" },
        { "name": "Roulement colonne", "d": 150, "img": "refresh-cw" }
    ]},
// 20 min
    "Détente Soir (Sommeil)": { "type": "Passif", "duration": 20, 
        "tags": ["Passif", "Moyen", "Quotidien", "Full Body"],
        "exos": [
        { "name": "Jambes contre le mur", "d": 240, "img": "wall" },
        { "name": "Bébé heureux", "d": 180, "img": "smile" },
        { "name": "Respiration ventrale", "d": 240, "img": "wind" },
        { "name": "Détente cervicale", "d": 180, "img": "cloud" },
        { "name": "Papillon allongé", "d": 180, "img": "heart" },
        { "name": "Torsion couchée douce", "d": 180, "img": "repeat" }
    ]},
//4min parfait
    "Déblocage Avant-bras": { "type": "Actif", "duration": 4,
        "tags": ["Actif", "Court", "Grimpe", "Dos"],
        "exos": [
        { "name": "Extension poignets", "d": 60, "img": "hand" },
        { "name": "Flexion poignets", "d": 60, "img": "hand" },
        { "name": "Cercle poignets", "d": 60, "img": "refresh-cw" },
        { "name": "Shake (Secouer)", "d": 60, "img": "wind" }
    ]},
// 5 min
    "Anti-Bureau (Nuque)": { "type": "Mixte", "duration": 5, 
        "tags": ["Mixte", "Court", "Bureau", "Dos"],
        "exos": [
        { "name": "Rétraction cervicale", "d": 60, "img": "user" },
        { "name": "Ouverture pectoraux", "d": 90, "img": "door" },
        { "name": "Trapèzes latéraux", "d": 90, "img": "align-center" },
        { "name": "Y-W raises", "d": 60, "img": "expand" }
    ]},
// 3 min
    "Flash Hanche (Squat)": { "type": "Actif", "duration": 3, 
        "tags": ["Actif", "Court", "Hanches"],
        "exos": [
        { "name": "Squat profond actif", "d": 120, "img": "arrow-down" },
        { "name": "Rotations hanches déb.", "d": 60, "img": "refresh-cw" }
    ]},

    "Pieds & Chevilles": { "type": "Mixte", "duration": 5, 
        "tags": ["Mixte", "Court", "Full Body"],
        "exos": [
        { "name": "Massage voûte plantaire", "d": 120, "img": "foot" },
        { "name": "Flexion orteils", "d": 90, "img": "foot" },
        { "name": "Équilibre une jambe", "d": 90, "img": "user" }
    ]},

    "Ouverture Thoracique Forte": { "type": "Actif", "duration": 12, 
        "tags": ["Actif", "Moyen", "Dos"],
        "exos": [
        { "name": "Planche inversée", "d": 90, "img": "arrow-up" },
        { "name": "Pompes Hindu", "d": 90, "img": "activity" },
        { "name": "Cobra actif", "d": 90, "img": "zap" },
        { "name": "Arc (Bow pose)", "d": 90, "img": "target" },
        { "name": "Posture du chiot (Puppy)", "d": 90, "img": "dog" },
        { "name": "Rotation thoracique (G)", "d": 90, "img": "rotate-cw" },
        { "name": "Rotation thoracique (D)", "d": 90, "img": "rotate-cw" },
        { "name": "Ouverture pectoraux mur", "d": 90, "img": "door-open" }
    ]},
// 14 min : pas assez d'exos
    "Adducteurs & Squat": { "type": "Passif", "duration": 14, 
        "tags": ["Passif", "Moyen", "Hanches"],
        "exos": [
        { "name": "Grenouille légère", "d": 90, "img": "layout-grid" },
        { "name": "Étirement latéral sol (G)", "d": 90, "img": "move-horizontal" },
        { "name": "Étirement latéral sol (D)", "d": 90, "img": "move-horizontal" },
        { "name": "Pancake léger", "d": 90, "img": "layers" },
        { "name": "Squat profond passif", "d": 90, "img": "arrow-down" },
        { "name": "Posture du Papillon", "d": 90, "img": "smile" },
        { "name": "Fente latérale (G)", "d": 75, "img": "chevron-left" },
        { "name": "Fente latérale (D)", "d": 75, "img": "chevron-right" },
        { "name": "Cossack squat passif", "d": 75, "img": "move-horizontal" },
        { "name": "Mobilité hanches 90/90", "d": 75, "img": "refresh-ccw" }
    ]},
// 16 min pas assez d'exos
    "Spécial Dos (Bas du dos)": { "type": "Passif", "duration": 16, 
        "tags": ["Passif", "Moyen", "Dos"],
        "exos": [
        { "name": "Genoux poitrine", "d": 80, "img": "circle" },
        { "name": "Posture de l'enfant", "d": 80, "img": "baby" },
        { "name": "Torsion douce (G)", "d": 80, "img": "repeat" },
        { "name": "Torsion douce (D)", "d": 80, "img": "repeat" },
        { "name": "Sphinx", "d": 80, "img": "eye" },
        { "name": "Posture du Chat-Vache", "d": 80, "img": "refresh-cw" },
        { "name": "Étirement Carré des lombes (G)", "d": 80, "img": "align-left" },
        { "name": "Étirement Carré des lombes (D)", "d": 80, "img": "align-right" },
        { "name": "Chien tête en bas", "d": 80, "img": "chevron-up" },
        { "name": "Pliage avant assis", "d": 80, "img": "arrow-down-circle" },
        { "name": "Posture du Pigeon (G)", "d": 80, "img": "accessibility" },
        { "name": "Posture du Pigeon (D)", "d": 80, "img": "accessibility" }
    ]},
// 22 min pas assez d'exos
    "Yoga Power (Vinyasa simple)": { "type": "Actif", "duration": 22, 
        "tags": ["Actif", "Long", "Full Body"],
        "exos": [
        { "name": "Salutation soleil A", "d": 90, "img": "sun" },
        { "name": "Guerrier 1 (G)", "d": 90, "img": "sword" },
        { "name": "Guerrier 1 (D)", "d": 90, "img": "sword" },
        { "name": "Guerrier 2 (G)", "d": 90, "img": "sword" },
        { "name": "Guerrier 2 (D)", "d": 90, "img": "sword" },
        { "name": "Planche active", "d": 90, "img": "shield" },
        { "name": "Triangle pose (G)", "d": 90, "img": "triangle" },
        { "name": "Triangle pose (D)", "d": 90, "img": "triangle" },
        { "name": "Vinyasa flow lent", "d": 90, "img": "activity" },
        { "name": "Posture de la chaise", "d": 90, "img": "armchair" },
        { "name": "Équilibre sur une jambe (G)", "d": 75, "img": "user" },
        { "name": "Équilibre sur une jambe (D)", "d": 75, "img": "user" },
        { "name": "Posture de la fente basse", "d": 90, "img": "zap" },
        { "name": "Chien tête en haut", "d": 90, "img": "arrow-up-right" },
        { "name": "Plan incliné", "d": 90, "img": "trending-up" }
    ]},
// 12 min pas assez d'exos
    "Soulagement Lombaire": { "type": "Passif", "duration": 12, 
        "tags": ["Passif", "Moyen", "Dos"],
        "exos": [
        { "name": "Sphinx", "d": 90, "img": "eye" },
        { "name": "Torsion au sol (G)", "d": 90, "img": "repeat" },
        { "name": "Torsion au sol (D)", "d": 90, "img": "repeat" },
        { "name": "Posture de l'enfant large", "d": 90, "img": "baby" },
        { "name": "Pont fessier passif", "d": 90, "img": "bridge" },
        { "name": "Jambes contre le mur", "d": 90, "img": "align-vertical-bottom" },
        { "name": "Étirement Psoas (G)", "d": 90, "img": "zap" },
        { "name": "Étirement Psoas (D)", "d": 90, "img": "zap" }
    ]},
// 8 min pas assez d'exos
    "Mobilité Poignets Pro": { "type": "Actif", "duration": 8, 
        "tags": ["Actif", "Court", "Grimpe"],
        "exos": [
        { "name": "Cercle poignets sol", "d": 80, "img": "refresh-cw" },
        { "name": "Étirement doigts (extension)", "d": 80, "img": "hand" },
        { "name": "Étirement doigts (flexion)", "d": 80, "img": "hand" },
        { "name": "Pompes sur poignets", "d": 80, "img": "zap" },
        { "name": "Extension poignet assis (G)", "d": 80, "img": "chevron-up" },
        { "name": "Extension poignet assis (D)", "d": 80, "img": "chevron-up" }
    ]},
    "Ultimate Full Body": {
        "type": "Passif / Profond",
        "duration": 90,
        "tags": ["Passif", "Profond", "Tres long", "Full Body", "Mensuel"],
        "exos": [
        // --- Mobilité Cervicale & Nuque (4.5 min) ---
        { "name": "Inclinaison latérale nuque G", "d": 90, "img": "user" },
        { "name": "Inclinaison latérale nuque D", "d": 90, "img": "user" },
        { "name": "Menton-Poitrine (Légère pression)", "d": 90, "img": "arrow-down" },

        // --- Ouverture Épaules & Haut du Dos (12 min) ---
        { "name": "Posture de l'enfant (Respiration)", "d": 90, "img": "baby" },
        { "name": "Posture de l'enfant (Bras G)", "d": 90, "img": "chevron-left" },
        { "name": "Posture de l'enfant (Bras D)", "d": 90, "img": "chevron-right" },
        { "name": "Fil de l'aiguille (Épaule G au sol)", "d": 90, "img": "align-center" },
        { "name": "Fil de l'aiguille (Épaule D au sol)", "d": 90, "img": "align-center" },
        { "name": "Posture du chiot (Poitrine au sol)", "d": 90, "img": "dog" },
        { "name": "Étirement Pectoral au sol (Bras G)", "d": 90, "img": "expand" },
        { "name": "Étirement Pectoral au sol (Bras D)", "d": 90, "img": "expand" },

        // --- Colonne & Lombaire (9 min) ---
        { "name": "Cat-Cow (Lent et fluide)", "d": 90, "img": "refresh-cw" },
        { "name": "Chien tête en bas (Pédalage)", "d": 90, "img": "dog" },
        { "name": "Chien tête en bas (Statique)", "d": 90, "img": "dog" },
        { "name": "Cobra (Bas sur avant-bras)", "d": 90, "img": "snake" },
        { "name": "Sphinx (Maintien passif)", "d": 90, "img": "snake" },
        { "name": "Torsion assise douce G", "d": 90, "img": "rotate-ccw" },

        // --- Poignets & Mains (6 min) ---
        { "name": "Étirement fléchisseurs", "d": 90, "img": "hand" },
        { "name": "Étirement extenseurs", "d": 90, "img": "hand" },
        { "name": "Rotation poignets (Mobilité douce)", "d": 90, "img": "rotate-cw" },
        { "name": "Étirement pouces et paumes", "d": 90, "img": "hand" },

        // --- Hanches & Psoas - Travail Profond (15 min) ---
        { "name": "Fente basse G (Hanches basses)", "d": 90, "img": "arrow-up-right" },
        { "name": "Fente basse G (Ouverture genou ext.)", "d": 90, "img": "external-link" },
        { "name": "Fente basse D (Hanches basses)", "d": 90, "img": "arrow-up-right" },
        { "name": "Fente basse D (Ouverture genou ext.)", "d": 90, "img": "external-link" },
        { "name": "Lézard G (Avant-bras au sol)", "d": 90, "img": "target" },
        { "name": "Lézard D (Avant-bras au sol)", "d": 90, "img": "target" },
        { "name": "Couché sur le dos - Genou poitrine G", "d": 90, "img": "arrow-down-left" },
        { "name": "Couché sur le dos - Genou poitrine D", "d": 90, "img": "arrow-down-right" },
        { "name": "Étirement Quadriceps G (Couché côté)", "d": 90, "img": "zap" },
        { "name": "Étirement Quadriceps D (Couché côté)", "d": 90, "img": "zap" },

        // --- Fessiers & Bassin (15 min) ---
        { "name": "Pigeon G (Buste droit)", "d": 90, "img": "pigeon" },
        { "name": "Pigeon G (Relâché devant)", "d": 90, "img": "pigeon" },
        { "name": "Pigeon D (Buste droit)", "d": 90, "img": "pigeon" },
        { "name": "Pigeon D (Relâché devant)", "d": 90, "img": "pigeon" },
        { "name": "90/90 Hanches (Rotation interne G)", "d": 90, "img": "corner-down-left" },
        { "name": "90/90 Hanches (Rotation interne D)", "d": 90, "img": "corner-down-right" },
        { "name": "Grenouille (Phase statique)", "d": 90, "img": "layout-grid" },
        { "name": "Papillon (Dos droit)", "d": 90, "img": "unfold-more" },
        { "name": "Papillon (Buste vers l'avant)", "d": 90, "img": "unfold-more" },
        { "name": "Squat profond (Malasana)", "d": 90, "img": "arrow-down" },

        // --- Ischios & Mollets (12 min) ---
        { "name": "Demi-grand écart G (Ischios)", "d": 90, "img": "minimize-2" },
        { "name": "Demi-grand écart D (Ischios)", "d": 90, "img": "minimize-2" },
        { "name": "Pince assise (Jambes serrées)", "d": 90, "img": "arrow-down" },
        { "name": "Écart facial (Statique milieu)", "d": 90, "img": "columns" },
        { "name": "Écart facial (Vers jambe G)", "d": 90, "img": "corner-left-down" },
        { "name": "Écart facial (Vers jambe D)", "d": 90, "img": "corner-right-down" },
        { "name": "Étirement Mollets contre mur G", "d": 90, "img": "trending-up" },
        { "name": "Étirement Mollets contre mur D", "d": 90, "img": "trending-up" },

        // --- Pieds & Chevilles (6 min) ---
        { "name": "Posture de l'orteil (Assis sur talons)", "d": 90, "img": "hash" },
        { "name": "Étirement coup de pied (Cheville)", "d": 90, "img": "activity" },
        { "name": "Rotation chevilles lente G/D", "d": 180, "img": "rotate-cw" },

        // --- Relaxation & Intégration (10.5 min) ---
        { "name": "Torsion colonne couché G", "d": 90, "img": "repeat" },
        { "name": "Torsion colonne couché D", "d": 90, "img": "repeat" },
        { "name": "Bébé heureux", "d": 90, "img": "smile" },
        { "name": "Jambes au mur (Viparita Karani)", "d": 180, "img": "wall" },
        { "name": "Savasana (Repos total)", "d": 180, "img": "moon" }
        ]}
}







let stretchTimer = null;
let stretchIndex = 0;
let currentRoutine = null;
let totalTimePracticed = 0; // Initialisation du compteur
let currentRoutineName = "";

// Remplace loadStretchMenu par cette version améliorée
async function renderStretchCatalog() {
    const container = document.getElementById('stretch-menu');
    const countLabel = document.getElementById('stretch-count');
    if (!container) return;

    // 1. Récupération des filtres
    const typeF = document.getElementById('filter-stretch-type')?.value || 'all';
    const durF = document.getElementById('filter-stretch-duration')?.value || 'all';
    const focF = document.getElementById('filter-stretch-focus')?.value || 'all';
    const regF = document.getElementById('filter-stretch-regularite')?.value || 'all';

    // 2. Filtrage
    const filteredKeys = Object.keys(STRETCH_DATA).filter(key => {
        const session = STRETCH_DATA[key];
        const tags = session.tags || [];
        
        const matchType = typeF === 'all' || tags.includes(typeF);
        const matchDur = durF === 'all' || tags.includes(durF);
        const matchFoc = focF === 'all' || tags.includes(focF);
        const matchReg = regF === 'all' || tags.includes(regF);

        return matchType && matchDur && matchFoc && matchReg;
    });

    // 3. Mise à jour du compteur
    if(countLabel) countLabel.innerText = `${filteredKeys.length} SÉANCES`;

    // 4. Rendu HTML avec ton style d'origine
    if (filteredKeys.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-500 text-[10px] uppercase py-10">Aucune séance ne correspond</p>`;
        return;
    }

    container.innerHTML = filteredKeys.map(key => {
        const prog = STRETCH_DATA[key];
        
        // Ta logique de couleurs originale
        const typeColor = prog.type === 'Actif' ? 'text-orange-400' : 
                        (prog.type === 'Passif' ? 'text-blue-400' : 
                        (prog.type === 'Passif / Profond' ? 'text-violet-400' : 'text-emerald-400'));
        
        const borderColor = prog.type === 'Actif' ? 'border-orange-500/30' : 
                            (prog.type === 'Passif' ? 'border-blue-500/30' : 
                            (prog.type === 'Passif / Profond' ? 'border-violet-500/30' : 'border-emerald-500/30'));

        return `
            <button onclick="startStretchRoutine('${key}')" class="glass p-4 rounded-2xl border-l-4 ${borderColor} flex justify-between items-center active:scale-95 transition-all">
                <div class="text-left">
                    <p class="font-bold text-white text-sm">${key}</p>
                    <div class="flex gap-2 mt-1">
                        <span class="text-[9px] uppercase font-black ${typeColor}">${prog.type}</span>
                        <span class="text-[9px] text-slate-500 uppercase font-black">• ${prog.duration} MIN</span>
                    </div>
                </div>
                <i data-lucide="play" class="w-4 h-4 text-slate-500"></i>
            </button>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

// Dans ta fonction showSection('stretching'), assure-toi d'appeler :
// renderStretchCatalog();

// --- CORRECTION ÉTIREMENTS ---

function startStretchRoutine(type) {
    const routineData = STRETCH_DATA[type];
    if (!routineData) return;

    currentRoutine = routineData.exos; 
    stretchIndex = 0;
    currentRoutineName = type;
    totalTimePracticed = 0; // On remet à zéro pour la nouvelle séance
    
    document.getElementById('stretch-menu').classList.add('hidden');
    document.getElementById('stretch-active').classList.remove('hidden');
    document.getElementById('stretch-name').innerText = type;
    
    runStretchStep();
}

function runStretchStep() {
    // Vérifier si la routine est finie
    if (!currentRoutine || stretchIndex >= currentRoutine.length) {
        finishStretch(false);
        return;
    }

    let step = currentRoutine[stretchIndex];
    let initialTime = step.d; 
    let timeLeft = initialTime;
    
    // Affichage de l'exercice
    const exerciseEl = document.getElementById('stretch-exercise');
    exerciseEl.innerHTML = `
        <div class="flex flex-col items-center gap-4">
            <div class="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                <i data-lucide="${step.img || 'accessibility'}" class="w-10 h-10 text-emerald-400"></i>
            </div>
            <span class="text-xl font-bold text-white">${step.name}</span>
        </div>
    `;
    
    document.getElementById('stretch-timer').innerText = timeLeft;
    updateTimerCircle(100); 
    lucide.createIcons();
    
    if (stretchTimer) clearInterval(stretchTimer);
    if (typeof beep === "function") beep();

    stretchTimer = setInterval(() => {
        timeLeft--;
        totalTimePracticed++; // Cumul du temps réel
        
        document.getElementById('stretch-timer').innerText = timeLeft;
        
        const percentage = (timeLeft / initialTime) * 100;
        updateTimerCircle(percentage);
        
        if (timeLeft <= 0) {
            clearInterval(stretchTimer);
            stretchIndex++;
            if (typeof beep === "function") beep(600, 200);
            
            // On attend 2 secondes avant de lancer le suivant ou de finir
            setTimeout(runStretchStep, 2000);
        }
    }, 1000);
}

function skipStretchStep() {
    if (stretchTimer) clearInterval(stretchTimer);
    
    // Note : On ne remet pas totalTimePracticed à zéro ici, 
    // on veut garder le temps passé sur l'exo qu'on vient de quitter.
    
    stretchIndex++;
    runStretchStep();
}

function stopStretch() {
    if (stretchTimer) clearInterval(stretchTimer);

    // Si on a fait plus de 5s, on enregistre comme "interrompu"
    if (totalTimePracticed > 5) {
        finishStretch(true); 
    } else {
        resetStretchUI();
    }
}

function finishStretch(wasInterrupted = false) {
    if (stretchTimer) clearInterval(stretchTimer);

    // On récupère les données via la variable globale qu'on a définie au début
    const routineName = STRETCH_DATA[currentRoutineName];
    
    // Calcul de la durée théorique (en secondes)
    const theoSec = routineName ? routineName.duration * 60 : 0;

    const data = {
        type: 'Étirement',
        routine: currentRoutineName,
        duration: totalTimePracticed, 
        durationTheo: theoSec,
        durationStr: Math.round(totalTimePracticed / 60) + " min",
        durationStr2: Math.round(totalTimePracticed / 60),
        completed: !wasInterrupted 
    };

    resetStretchUI();
    
    // IMPORTANT : Vérifie que cette fonction existe dans ton code
    if (typeof showMoodSelector === "function") {
        showMoodSelector(data);
    }
}

function resetStretchUI() {
    document.getElementById('stretch-active').classList.add('hidden');
    document.getElementById('stretch-menu').classList.remove('hidden');
    stretchIndex = 0;
    currentRoutine = null;
    if (stretchTimer) clearInterval(stretchTimer);
}

function updateTimerCircle(percent) {
    const circle = document.getElementById('timer-progress');
    const circumference = 377; // 2 * PI * 60
    const offset = circumference - (percent / 100) * circumference;
    circle.style.strokeDashoffset = offset;
}





let currentChartIndex = 0;
const charts = [
    { id: 'mainChart', title: 'Évolution du Ressenti' },
    { id: 'runChart', title: "Allure Course (min/km)" },
    { id: 'statsChart', title: "Endurance (Repos/Rep)" },
    { id: 'blocEvolutionChart', title: 'Evolution niveau escalade (bloc)'},
    { id: 'voieEvolutionChart', title: 'Evolution niveau escalade (voie)'},
    { id: 'volumeChart', title: "Volume Hebdomadaire" },
    { id: 'fatigueChart', title: "Charge d'Entraînement (Fatigue)" },
    { id: 'scatterChart', title: "Flow State (Escalade)" },
    { id: 'radarChart', title: "Équilibre des Piliers" },
    { id: 'radarChart2', title: "Profil" }
];

function changeChart(direction) {
    // 1. Calculer le nouvel index
    currentChartIndex += direction;
    if (currentChartIndex < 0) currentChartIndex = charts.length - 1;
    if (currentChartIndex >= charts.length) currentChartIndex = 0;

    const activeChart = charts[currentChartIndex];
    
    // 2. Gestion des filtres et du titre
    const filteredCharts = ['runChart', 'statsChart', 'blocEvolutionChart', 'voieEvolutionChart', 'scatterChart'];
    
    let fullTitle = activeChart.title;

    // Si le graph est filtrable, on cherche les dates
    if (filteredCharts.includes(activeChart.id)) {
        const start = document.getElementById('stats-start')?.value;
        const end = document.getElementById('stats-end')?.value;
        
        if (start || end) {
            const d1 = start ? start.split('-').reverse().slice(0,2).join('/') : '...';
            const d2 = end ? end.split('-').reverse().slice(0,2).join('/') : 'Jourdhui';
            fullTitle += ` (${d1} au ${d2})`;
        }
    }

    // Mettre à jour le texte du titre
    document.getElementById('chart-title').innerText = fullTitle;

    // 3. Mise à jour visuelle des wrappers
    document.querySelectorAll('.chart-wrapper').forEach(el => el.classList.add('hidden'));
    const wrapper = document.getElementById(`wrapper-${activeChart.id}`);
    if (wrapper) wrapper.classList.remove('hidden');

    const weekNav = document.getElementById('week-nav');
    const radarWrapper = document.getElementById('wrapper-radarChart');
    
    if (radarWrapper && !radarWrapper.classList.contains('hidden')) {
        weekNav.classList.remove('hidden');
    } else {
        weekNav.classList.add('hidden');
    }

    // 4. Redessiner les données
    updateStatsDashboard(); 
}



// Configuration des objectifs par défaut
// --- DISCIPLINE DAILY ---
const dailyGoals = [
    { label: "Clarinette", target: 10, unit: "min", type: "Musique" },
    { label: "Étirement", target: 10, unit: "min", type: "Étirement" },
    { label: "Suspension (Daily)", target: 60, unit: "s", type: "Suspension" }
];

// --- VOLUME WEEKLY ---
const weeklyGoals = [
    { label: "Volume Course", target: 20, unit: "km", type: "Course" },
    { label: "Suspension 2 Doigts", target: 7, unit: "s", type: "Suspension", fingers: "2" },
    // Nouveaux objectifs de volume bloc
    { label: "Blocs Jaunes", target: 5, unit: "top", type: "Escalade", color: "jaune" },
    { label: "Blocs Verts", target: 5, unit: "top", type: "Escalade", color: "vert" },
    { label: "Blocs Bleus", target: 5, unit: "top", type: "Escalade", color: "bleu" },
    { label: "Blocs Rouges", target: 5, unit: "top", type: "Escalade", color: "rouge" }
];

// --- PERFORMANCE ELITE ---
const eliteGoals = [
    { label: "Semi-Marathon", target: 21.1, unit: "km", type: "Course" },
    { label: "Bloc Noir (Elite)", target: 1, unit: "top", type: "Escalade", color: "noir" }
];

// --- LÉGENDE GOLDEN ---
const goldenGoals = [
    { label: "Marathon", target: 42.195, unit: "km", type: "Course" },
    { label: "Traction un bras (Pyr 30)", target: 30, unit: "sommet", type: "Pyramide Tractions" },
    { label: "Suspension 1 Doigt", target: 30, unit: "s", type: "Suspension", fingers: "1" },
    { label: "Bloc Violet (Légende)", target: 1, unit: "top", type: "Escalade", color: "violet" }
];

const blackGoals = [
    { label: "L'Ultra (100km)", target: 100, unit: "km", type: "Course" }
];

const weeklySchedule = [
    { day: "Lundi", task: "Muscu (Pyramide) + Musique", icon: "armchair" },
    { day: "Mardi", task: "Course Fondamentale", icon: "timer" },
    { day: "Mercredi", task: "Repos / Stretching", icon: "accessibility" },
    { day: "Jeudi", task: "Muscu (Suspension)", icon: "armchair" },
    { day: "Vendredi", task: "Course Fractionnée", icon: "timer" },
    { day: "Samedi", task: "Session Libre / Musique", icon: "music" },
    { day: "Dimanche", task: "Sortie Longue", icon: "map" }
];

// Ajoute "async" devant la fonction
async function updateGoalsDashboard() {
    // 1. Attendre les logs de la base de données
    const logs = await DB.getLogs(); 
    
    const goalsContainer = document.getElementById('goals-container');
    if (!goalsContainer) return;

    // --- Définition du temps ---
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // CALCUL DU LUNDI DE LA SEMAINE EN COURS
    const startWeek = new Date(now);
    const day = startWeek.getDay(); // 0 (dimanche) à 6 (samedi)
    const diff = startWeek.getDate() - day + (day === 0 ? -6 : 1); // Ajustement pour lundi
    startWeek.setDate(diff);
    startWeek.setHours(0, 0, 0, 0); // On commence à minuit pile le lundi

    let totalAchieved = 0;
    
    // Calcul du nombre total (assure-toi que ces listes existent dans ton fichier ou en global)
    const totalGoalsCount = (typeof dailyGoals !== 'undefined' ? dailyGoals.length : 0) + 
                            (typeof weeklyGoals !== 'undefined' ? weeklyGoals.length : 0) + 
                            (typeof eliteGoals !== 'undefined' ? eliteGoals.length : 0) + 
                            (typeof goldenGoals !== 'undefined' ? goldenGoals.length : 0) + 
                            (typeof blackGoals !== 'undefined' ? blackGoals.length : 0);

    const checkSuccess = (current, target) => {
        if (parseFloat(current) >= parseFloat(target)) {
            totalAchieved++;
            return true;
        }
        return false;
    };

    // --- 1. DAILY ---
    let dailyHtml = "";
    const dailyVals = dailyGoals.map(g => {
        const val = logs.filter(l => l.timestamp.split('T')[0] === todayStr && (l.type === g.type || l.exercise === g.type))
                        .reduce((acc, l) => {
                            // Sécurité pour éviter les NaN
                            const duration = l.duration ? Math.round(l.duration/60) : 0;
                            const reps = parseInt(l.totalReps) || 0;
                            const work = parseInt(l.work) || 0;
                            return acc + duration + reps + work;
                        }, 0);
        checkSuccess(val, g.target);
        return val;
    });

    // On prépare le header après avoir calculé les succès daily
    // Mais attention : pour un score total juste, il faut calculer TOUTES les sections avant de générer le HTML du header.
    
    // --- 2. WEEKLY ---
    let weeklyHtml = `<h3 class="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-3 mt-6">Volume Weekly</h3>`;

    weeklyGoals.forEach(g => {
        // On filtre les logs par date ET par type (ex: 'Run' ou 'Escalade')
        const relevant = logs.filter(l => new Date(l.timestamp) >= startWeek && l.type === g.type);
        let val = 0;
        
        // CAS 1 : La Course (ou autre activité à distance)
        if (g.unit === "km") {
            val = relevant.reduce((acc, l) => acc + (parseFloat(l.distance) || 0), 0);
        } 
        // CAS 2 : Les suspensions (Fingers/Hangboard)
        else if (g.fingers) {
            val = Math.max(...relevant.filter(l => l.fingers == g.fingers).map(l => parseInt(l.work) || 0), 0);
        } 
        // CAS 3 : Les Blocs d'escalade (recherche par couleur dans 'level')
        else if (g.unit === "top" && g.color) {
            relevant.forEach(l => {
                if (l.details && Array.isArray(l.details)) {
                    // On filtre les succès qui correspondent à la couleur demandée
                    val += l.details.filter(lap => {
                        // On cherche dans 'level' (ta nouvelle version) ou 'color' (l'ancienne)
                        const lapColor = (lap.level || lap.color || "").toLowerCase().trim();
                        const goalColor = g.color.toLowerCase().trim();
                        
                        return lapColor === goalColor && lap.success === true;
                    }).length;
                }
            });
        }
        
        checkSuccess(val, g.target);
        weeklyHtml += renderGoalBar(g.label, val, g.target, g.unit, 'blue');
    });
    // --- 3. ELITE ---
    let eliteHtml = `<h3 class="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-3 mt-6">Performance Elite</h3>`;
    eliteGoals.forEach(g => {
        let val = 0;

        // Si c'est un objectif de type "top" (comme un bloc Noir ou Violet)
        if (g.unit === "top") {
            // On utilise la fonction calculateBest que nous avons corrigée ensemble
            val = calculateBest(logs, g); 
        } 
        // Sinon, on garde la logique de distance/perf classique
        else {
            val = Math.max(...logs.filter(l => l.type === g.type).map(l => parseFloat(l.distance) || 0), 0);
        }

        checkSuccess(val, g.target);
        eliteHtml += renderGoalBar(g.label, val, g.target, g.unit, 'violet');
    });

    // --- 4. GOLDEN ---
    let goldenHtml = `<h3 class="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-3 mt-6">Objectifs Golden</h3>`;
    goldenGoals.forEach(g => {
        let best = calculateBest(logs, g);
        checkSuccess(best, g.target);
        const progress = Math.min(Math.round((best / g.target) * 100), 100);
        goldenHtml += renderGoldenCard(g.label, best, g.target, g.unit, progress);
    });

    // --- 5. BLACK ---
    let blackHtml = `<h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-6">Catégorie Black</h3>`;
    blackGoals.forEach(g => {
        const val = Math.max(...logs.filter(l => l.type === g.type).map(l => parseFloat(l.distance) || 0), 0);
        checkSuccess(val, g.target);
        const progress = Math.min(Math.round((val / g.target) * 100), 100);
        blackHtml += `
            <div class="glass p-5 rounded-3xl border-2 border-slate-800 bg-black shadow-2xl mb-4">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-black text-white uppercase tracking-tighter">${g.label}</span>
                    <span class="text-xs font-mono text-slate-500">${progress}%</span>
                </div>
                <div class="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-white/5">
                    <div class="bg-gradient-to-r from-slate-900 via-slate-400 to-white h-full" style="width: ${progress}%"></div>
                </div>
            </div>`;
    });

    // --- CONSTRUCTION FINALE DU HTML ---
    let finalHtml = `
        <div class="glass p-4 rounded-3xl mb-6 bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-white/10 flex items-center justify-between">
            <div>
                <p class="text-[10px] text-slate-400 uppercase font-black tracking-widest">Objectifs Atteints</p>
                <h2 class="text-2xl font-black text-white">${totalAchieved} <span class="text-sm font-normal text-slate-500">/ ${totalGoalsCount}</span></h2>
            </div>
            <div class="w-12 h-12 rounded-full border-4 border-violet-500/20 flex items-center justify-center">
                <span class="text-[10px] font-bold text-violet-400">${Math.round((totalAchieved/totalGoalsCount)*100 || 0)}%</span>
            </div>
        </div>
        <h3 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Discipline Daily</h3>
    `;

    // Ajout des barres Daily
    dailyGoals.forEach((g, i) => {
        finalHtml += renderGoalBar(g.label, dailyVals[i], g.target, g.unit, 'emerald');
    });

    // Ajout des autres sections
    finalHtml += weeklyHtml + eliteHtml + goldenHtml + blackHtml;

    // Ajout des Records
    finalHtml += `<h3 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 mt-10">Records Historiques</h3>`;
    finalHtml += renderPersonalRecords(logs);

    goalsContainer.innerHTML = finalHtml;
    lucide.createIcons();
}


// 1. CORRECTION DE CALCULATEBEST
function calculateBest(logs, goal) {
    const relevant = logs.filter(l => l.type === goal.type || l.exercise === goal.type);
    let best = 0;

    relevant.forEach(l => {
        let val = 0;
        if (goal.unit === "km") val = parseFloat(l.distance) || 0;
        else if (goal.fingers) val = (l.fingers == goal.fingers) ? (parseInt(l.work) || 0) : 0;
        else if (goal.unit === "sommet") { if ( !l.isSemi) { val = parseInt(l.note?.match(/Sommet (\d+)/)?.[1]) || 0;}}
        
        // CORRECTION ICI : On compte le nombre de tops réussis de cette couleur dans la séance
        else if (goal.unit === "top" && goal.color) {
            if (l.details && Array.isArray(l.details)) {
                val = l.details.filter(lap => {
                    const lapColor = (lap.level || lap.color || "").toLowerCase().trim();
                    const goalColor = goal.color.toLowerCase().trim();
                    return lapColor === goalColor && lap.success === true;
                }).length;
            }
        }
        
        if (val > best) best = val;
    });
    return best;
}

// 2. CORRECTION DES RECORDS (Ordre des couleurs)
function renderPersonalRecords(logs) {
    const bestRun = logs.filter(l => l.type === 'Course').sort((a,b) => b.distance - a.distance)[0];
    const bestPyr = logs.filter(l => l.type === 'Pyramide Tractions'&& !l.isSemi)
                        .sort((a,b) => (parseInt(b.note?.match(/Sommet (\d+)/)?.[1]) || 0) - (parseInt(a.note?.match(/Sommet (\d+)/)?.[1]) || 0))[0];

    // L'ordre doit être exact (minuscules)
    const colorOrder = ['blanc', 'jaune', 'vert', 'bleu', 'rouge', 'noir', 'violet'];
    let absoluteBestColor = "";
    let bestColorLog = null;

    logs.filter(l => l.type === 'Escalade').forEach(l => {
        l.details?.forEach(lap => {
            if (lap.success) {
                const lapColor = (lap.level || lap.color || "").toLowerCase().trim();
                const currentIndex = colorOrder.indexOf(lapColor);
                const bestIndex = colorOrder.indexOf(absoluteBestColor);
                
                if (currentIndex > bestIndex) {
                    absoluteBestColor = lapColor;
                    bestColorLog = l;
                }
            }
        });
    });

    const bestHang = logs.filter(l => l.type === 'Suspension').sort((a,b) => b.work - a.work)[0];

    const records = [
        { label: "Plus longue distance", val: bestRun ? bestRun.distance + " km" : "---", date: bestRun?.timestamp },
        { label: "Plus haut sommet", val: bestPyr ? "Sommet " + (bestPyr.note.match(/Sommet (\d+)/)?.[1] || "?") : "---", date: bestPyr?.timestamp },
        { label: "Cotation Max Bloc", val: absoluteBestColor ? absoluteBestColor.toUpperCase() : "---", date: bestColorLog?.timestamp },
        { label: "Max Suspension", val: bestHang ? bestHang.work + " s" : "---", date: bestHang?.timestamp }
    ];

    return `
        <div class="grid grid-cols-2 gap-2 mb-10">
            ${records.map(r => `
                <div class="p-3 bg-slate-900/40 rounded-2xl border border-white/5">
                    <p class="text-[9px] text-slate-500 uppercase font-bold mb-1">${r.label}</p>
                    <p class="text-sm font-bold text-white">${r.val}</p>
                    <p class="text-[8px] text-slate-600 font-mono mt-1">${r.date ? new Date(r.date).toLocaleDateString('fr-FR') : ''}</p>
                </div>
            `).join('')}
        </div>
    `;
}


// Fonction utilitaire pour éviter de répéter le code HTML des barres
function renderGoalBar(label, current, target, unit, color) {
    const progress = Math.min(Math.round((current / target) * 100), 100);
    return `
        <div class="glass p-3 rounded-2xl mb-2 border-l-2 border-${color}-500/50">
            <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium text-slate-300">${label}</span>
                <span class="text-[10px] font-mono">${current}/${target} ${unit}</span>
            </div>
            <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div class="bg-${color}-500 h-full transition-all duration-700" style="width: ${progress}%"></div>
            </div>
        </div>`;
}

function renderGoldenCard(label, current, target, unit, progress) {
    const p = Math.min(Math.round(progress), 100);
    return `
        <div class="glass p-4 rounded-3xl bg-gradient-to-br from-slate-800/40 to-amber-500/5 mb-3 border border-amber-500/10">
            <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-black text-amber-200 uppercase">${label}</span>
                <span class="text-xs font-mono text-amber-500">${p}%</span>
            </div>
            <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden shadow-inner">
                <div class="bg-amber-500 h-full" style="width: ${p}%"></div>
            </div>
        </div>`;
}

function renderSchedule() {
    const container = document.getElementById('schedule-container');
    const dateDisplay = document.getElementById('current-date-display');
    if (!container) return;

    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const now = new Date();
    
    // Affichage de la date du jour
    dateDisplay.innerText = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

    // Calcul de la Muscu (Tous les 2 jours)
    // On prend une date de référence (ex: 1er Janvier 2024 qui était un Lundi)
    const referenceDate = new Date(2024, 0, 1);
    const diffTime = Math.abs(now - referenceDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const isMuscuDay = diffDays % 2 === 0;

    let scheduleHTML = '';

    // Génération pour les 3 prochains jours pour donner de la visibilité
    for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setDate(now.getDate() + i);
        const dayName = days[d.getDay()];
        const isToday = i === 0;
        
        // Détermination des activités
        let activities = [];
        
        // 1. Muscu (tous les 2 jours)
        if ((diffDays + i) % 2 === 0) activities.push({ label: "Musculation", icon: "armchair", color: "text-violet-400" });

        // 2. Activités Fixes
        if (dayName === 'Jeudi') activities.push({ label: "Escalade (Soir)", icon: "mountain", color: "text-emerald-400" });
        if (dayName === 'Vendredi') activities.push({ label: "Musique (Soir)", icon: "music", color: "text-amber-400" });
        if (dayName === 'Samedi' || dayName === 'Dimanche') {
            if (i === 0 || (i > 0 && dayName === 'Samedi')) { // On ne l'affiche qu'une fois dans le weekend prévu
                activities.push({ label: "Course prévue", icon: "timer", color: "text-blue-400" });
            }
        }

        if (activities.length === 0) activities.push({ label: "Repos / Stretching", icon: "accessibility", color: "text-slate-500" });

        scheduleHTML += `
            <div class="glass p-4 rounded-3xl border ${isToday ? 'border-violet-500/50 bg-violet-500/5' : 'border-white/5'}">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-bold uppercase tracking-tighter ${isToday ? 'text-violet-400' : 'text-slate-500'}">
                        ${isToday ? 'Aujourd\'hui' : dayName}
                    </span>
                    ${isToday ? '<span class="flex h-2 w-2 rounded-full bg-violet-500 animate-pulse"></span>' : ''}
                </div>
                <div class="space-y-3">
                    ${activities.map(act => `
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center ${act.color}">
                                <i data-lucide="${act.icon}" class="w-4 h-4"></i>
                            </div>
                            <span class="text-sm font-medium ${isToday ? 'text-white' : 'text-slate-400'}">${act.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = scheduleHTML;
    lucide.createIcons();
}




// ------------------ ESCALADE -------------------
// --- CONFIGURATION ESCALADE ---
const CONFIG_CLIMB = {
    'Bloc': {
        levels: ['Jaune', 'Vert', 'Bleu', 'Rouge', 'Noir', 'Violet'],
        colors: { 'Jaune': '#fbbf24', 'Vert': '#4ade80', 'Bleu': '#60a5fa', 'Rouge': '#f87171', 'Noir': '#1e293b', 'Violet': '#a855f7' }
    },
    'Voie': {
        levels: ['4c', '5a', '5b', '5c', '6a', '6b', '6c', '7a', '7b','7c','8a','8b','8c'],
        colors: {} // On utilisera une couleur par défaut pour les voies
    }
};

let currentClimbSession = {
    startTime: null,
    type: '',
    laps: [],
    selectedLevel: '',
    selectedColor: ''
};

let isSuccess = true; // État global du bouton OUI/NON

// --- LOGIQUE DE SÉANCE ---

function startClimb(type) {
    currentClimbSession = {
        type: type, // 'Bloc' ou 'Voie'
        startTime: new Date(),
        laps: [],
        selectedLevel: type === 'Bloc' ? 'Jaune' : '5a'
    };

    document.getElementById('climb-setup').classList.add('hidden');
    document.getElementById('climb-active').classList.remove('hidden');
    document.getElementById('climb-type-display').innerText = type;
    document.getElementById('climb-laps').innerHTML = ''; // Vide la liste précédente

    renderDifficultyButtons(type);
}

function renderDifficultyButtons(type) {
    const container = document.getElementById('climb-levels-grid');
    const config = CONFIG_CLIMB[type];
    
    container.innerHTML = config.levels.map((lvl) => {
        if (type === 'Bloc') {
            const color = config.colors[lvl];
            return `
                <button onclick="selectClimbLevel('${lvl}', '${color}')" 
                        class="lvl-btn w-8 h-8 rounded-full flex-shrink-0 border-2 border-transparent transition-all"
                        style="background-color: ${color}"
                        data-lvl="${lvl}">
                </button>`;
        } else {
            return `
                <button onclick="selectClimbLevel('${lvl}', '#6366f1')" 
                        class="lvl-btn px-4 py-2 rounded-xl bg-slate-800 text-white text-[10px] font-bold flex-shrink-0 border border-white/5 transition-all"
                        data-lvl="${lvl}">
                    ${lvl}
                </button>`;
        }
    }).join('');
    
    selectClimbLevel(currentClimbSession.selectedLevel, type === 'Bloc' ? config.colors[currentClimbSession.selectedLevel] : '#6366f1');
}

function selectClimbLevel(lvl, color) {
    currentClimbSession.selectedLevel = lvl;
    currentClimbSession.selectedColor = color;

    document.querySelectorAll('.lvl-btn').forEach(btn => {
        if (btn.getAttribute('data-lvl') === lvl) {
            btn.classList.add('border-white', 'scale-110');
            btn.classList.remove('border-transparent', 'bg-slate-800');
            if(currentClimbSession.type === 'Voie') btn.classList.add('bg-violet-600');
        } else {
            btn.classList.remove('border-white', 'scale-110', 'bg-violet-600');
            btn.classList.add('border-transparent');
            if(currentClimbSession.type === 'Voie') btn.classList.add('bg-slate-800');
        }
    });
}

function setClimbStatus(status) {
    isSuccess = status;
    const btnSuccess = document.getElementById('btn-success');
    const btnFail = document.getElementById('btn-fail');
    
    if(status) {
        btnSuccess.className = 'px-4 py-1 rounded-lg bg-emerald-500/20 text-emerald-500 border border-emerald-500/50 text-xs font-bold';
        btnFail.className = 'px-4 py-1 rounded-lg bg-slate-800 text-slate-500 text-xs';
    } else {
        btnSuccess.className = 'px-4 py-1 rounded-lg bg-slate-800 text-slate-500 text-xs';
        btnFail.className = 'px-4 py-1 rounded-lg bg-red-500/20 text-red-500 border border-red-500/50 text-xs font-bold';
    }
}

function addClimbLap() {
    const level = currentClimbSession.selectedLevel;
    const effort = document.getElementById('climb-effort').value;
    const status = isSuccess;
    const color = currentClimbSession.selectedColor;

    const lap = {
        level: level,
        effort: effort,
        success: status,
        time: new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})
    };
    
    currentClimbSession.laps.push(lap);
    
    // Affichage dans la liste de la session active
    const lapHTML = `
        <div class="flex justify-between items-center p-4 glass rounded-2xl border-l-4 mb-2 animate-in fade-in slide-in-from-right-4 duration-300" 
                style="border-left-color: ${status ? color : '#ef4444'}">
            <div class="flex items-center gap-3">
                <span class="text-xl">${status ? '✅' : '❌'}</span>
                <div>
                    <span class="block text-white font-bold text-sm">${currentClimbSession.type} ${level}</span>
                    <span class="text-[10px] text-slate-500">${lap.time}</span>
                </div>
            </div>
            <div class="flex flex-col items-end gap-1">
                <div class="flex gap-1">
                    ${Array.from({length: 5}).map((_, i) => `
                        <div class="w-1.5 h-1.5 rounded-full ${i < effort ? 'bg-violet-500' : 'bg-slate-700'}"></div>
                    `).join('')}
                </div>
                <span class="text-[9px] text-slate-500 uppercase">Effort ${effort}/5</span>
            </div>
        </div>
    `;
    
    document.getElementById('climb-laps').insertAdjacentHTML('afterbegin', lapHTML);
}

async function finishClimbSession() {
    const durationInput = document.getElementById('climb-duration-input');
    const duration = parseInt(durationInput.value) || 0;

    if (currentClimbSession.laps.length === 0) {
        alert("Ajoute au moins une ascension !");
        return;
    }

    const successes = currentClimbSession.laps.filter(l => l.success).length;

    pendingData = {
        type: "Escalade",
        exercise: currentClimbSession.type,
        duration: duration,
        details: currentClimbSession.laps,
        timestamp: new Date().toISOString(),
        note: `${successes} réussi(s) sur ${currentClimbSession.laps.length} tentatives.`
    };

    resetClimbUI();
    showMoodSelector(pendingData);
}

function resetClimbUI() {
    document.getElementById('climb-setup').classList.remove('hidden');
    document.getElementById('climb-active').classList.add('hidden');
    document.getElementById('climb-laps').innerHTML = '';
    document.getElementById('climb-duration-input').value = '';
    currentClimbSession.laps = [];
}


// ------------------- PARAMETRE --------------------------------------
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => DB.importAll(e.target.result);
    reader.readAsText(file);
    // Reset l'input pour pouvoir ré-importer le même fichier si besoin
    event.target.value = '';
}


// Fonction pour rafraîchir les chiffres dans le menu
async function refreshSettingsStats() {
    const stats = await DB.getStorageStats();
    document.getElementById('stat-count').innerText = stats.count;
    document.getElementById('stat-size').innerText = stats.sizeMb + " MB";
}

// Optionnel : Déclencher la mise à jour quand on survole le parent des paramètres
document.querySelector('.group').addEventListener('mouseenter', refreshSettingsStats);

function toggleSettings(event) {
    event.stopPropagation(); // Empêche la fermeture immédiate
    const menu = document.getElementById('settings-menu');
    const isVisible = !menu.classList.contains('invisible');
    
    if (isVisible) {
        menu.classList.add('opacity-0', 'invisible');
    } else {
        refreshSettingsStats(); // On met à jour les stats à l'ouverture
        menu.classList.remove('opacity-0', 'invisible');
    }
}

// Fermer le menu si on clique n'importe où ailleurs sur l'écran
window.addEventListener('click', () => {
    const menu = document.getElementById('settings-menu');
    if (menu) {
        menu.classList.add('opacity-0', 'invisible');
    }
});


function setDefaultFilterDates() {
    const today = new Date();
    const oneMonthAgo = new Date();
    
    // On retire 1 mois à la date d'aujourd'hui
    oneMonthAgo.setMonth(today.getMonth() - 1);

    // Formatage en YYYY-MM-DD pour les inputs type="date"
    const formatDate = (date) => date.toISOString().split('T')[0];

    document.getElementById('stats-start').value = formatDate(oneMonthAgo);
    document.getElementById('stats-end').value = formatDate(today);
}

function resetGraphFilters() {
    // 1. On vide les inputs
    document.getElementById('stats-start').value = "";
    document.getElementById('stats-end').value = "";
    
    // 2. On remet la limite sur "Tout voir" (ou 15 selon ta préférence)
    document.getElementById('stats-limit').value = "all";

    // On vide la légende ou on remet "Toutes les séances"
    const legendEl = document.getElementById('stats-period-legend');
    if (legendEl) legendEl.innerText = "Toutes les séances";
    
    // 3. On relance la mise à jour des graphiques
    updateStatsDashboard();
}


async function saveSleep() {
    const start = document.getElementById('sleep-start').value;
    const end = document.getElementById('sleep-end').value;

    if (!start || !end) return alert("Veuillez remplir les deux horaires");

    const [hStart, mStart] = start.split(':').map(Number);
    const [hEnd, mEnd] = end.split(':').map(Number);

    let startDate = new Date();
    startDate.setHours(hStart, mStart, 0);
    
    let endDate = new Date();
    endDate.setHours(hEnd, mEnd, 0);

    if (endDate < startDate) {
        endDate.setDate(endDate.getDate() + 1);
    }

    const diffMs = endDate - startDate;
    const durationHours = (diffMs / (1000 * 60 * 60)).toFixed(2);

    const sleepData = {
        type: 'Sommeil',
        duration: parseFloat(durationHours),
        start: start,
        end: end,
        timestamp: new Date().toISOString(), // Date du réveil
        note: `Nuit de ${durationHours}h (${start} - ${end})`
    };

    await DB.saveLog(sleepData);
    
    // Reset les champs
    document.getElementById('sleep-start').value = "";
    document.getElementById('sleep-end').value = "";
    
    alert("Nuit enregistrée !");
    updateSleepChart();
}

async function updateSleepChart() {
    const ctx = document.getElementById('sleepChart').getContext('2d');
    const period = document.getElementById('sleep-period').value;
    const avgDisplay = document.getElementById('sleep-avg');
    
    let logs = await DB.getLogs();
    let sleepLogs = logs.filter(l => l.type === 'Sommeil')
                        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (period !== 'all') {
        sleepLogs = sleepLogs.slice(-parseInt(period));
    }

    if (sleepLogs.length === 0) {
        if (window.mySleepChart) window.mySleepChart.destroy();
        avgDisplay.innerText = "--h--";
        return;
    }

    const totalHours = sleepLogs.reduce((acc, log) => acc + parseFloat(log.duration), 0);
    const avg = totalHours / sleepLogs.length;
    avgDisplay.innerText = `${avg.toFixed(1)}h`;

    if (window.mySleepChart) window.mySleepChart.destroy();

    const backgroundZones = {
        id: 'backgroundZones',
        beforeDraw: (chart) => {
            const {ctx, chartArea, scales: {y}} = chart;
            const zones = [
                { yStart: 0, yEnd: 4, color: 'rgba(239, 68, 68, 0.25)' },   // Critique - Rouge plus vif
                { yStart: 4, yEnd: 6, color: 'rgba(249, 115, 22, 0.2)' },    // Insuffisant - Orange
                { yStart: 6, yEnd: 7.5, color: 'rgba(234, 179, 8, 0.15)' }, // Moyen - Jaune
                { yStart: 7.5, yEnd: 9, color: 'rgba(34, 197, 94, 0.2)' },  // Bon - Vert
                { yStart: 9, yEnd: 12, color: 'rgba(168, 85, 247, 0.25)' }  // Excellent - Violet
            ];
            zones.forEach(zone => {
                const top = y.getPixelForValue(zone.yEnd);
                const bottom = y.getPixelForValue(zone.yStart);
                ctx.fillStyle = zone.color;
                ctx.fillRect(chartArea.left, top, chartArea.width, bottom - top);
            });
        }
    };

    window.mySleepChart = new Chart(ctx, {
        type: 'line',
        data: {
            // Pour placer le point "entre", on crée des labels qui sont les jours de transition
            labels: sleepLogs.map(l => {
                const d = new Date(l.timestamp);
                return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            }),
            datasets: [{
                data: sleepLogs.map(l => l.duration),
                borderColor: '#ffffff', // Ligne blanche pour mieux ressortir sur les couleurs
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                fill: false,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: '#8b5cf6', // Point violet
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                zIndex: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 12,
                    zIndex: 5,
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    ticks: { color: '#f8fafc', font: { weight: 'bold' } }
                },
                x: {
                    // L'offset true combiné au grid offset false place le point entre les lignes de grille
                    offset: true, 
                    grid: {
                        display: true,
                        color: 'rgba(255,255,255,0.2)', // Grille plus visible
                        drawTicks: true,
                        offset: false // Force la ligne de grille à être sur l'étiquette, pas sur le point
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: { size: 10 },
                        align: 'start', // Décale le texte vers la gauche pour qu'il soit "sous la ligne"
                        backdropPadding: 0
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    displayColors: false,
                    callbacks: {
                        title: (items) => `Nuit du réveil : ${items[0].label}`,
                        label: (context) => `Durée : ${context.parsed.y}h`
                    }
                }
            }
        },
        plugins: [backgroundZones]
    });
}