// --- INITIALISATION ---
let pendingData = null; // Stocke la séance en attente de pastille
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    
    // On attend que les données soient chargées avant de dessiner
    await renderLogs(); 
    await updateGoalsDashboard();
});

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
    // Masquer toutes les sections
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    // Afficher la bonne
    document.getElementById('section-' + id).classList.remove('hidden');
    
    // Mettre à jour les couleurs de la barre de navigation
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.replace('text-violet-500', 'text-slate-400');
    });
    // L'élément cliqué devient violet (nécessite de passer 'event' ou de chercher le bouton)
    if(window.event) {
        window.event.currentTarget.classList.replace('text-slate-400', 'text-violet-500');
    
    }
    if (id === 'stats') {
        updateStatsDashboard();
    }
    if (id === 'stretching') {
        loadStretchMenu(); // On génère la liste des 20 programmes
    }
    if (id === 'objectifs') {
        renderSchedule();
        updateGoalsDashboard(); // La fonction pour les barres de progression
    }
}


// --- LOGIQUE MUSCU ---
function loadExercise(type) {
    document.getElementById('exercise-menu').classList.add('hidden');
    document.getElementById('exercise-active').classList.remove('hidden');
    const container = document.getElementById('exercise-content');

    if (type === 'deadhang' || type === 'arms90') {
        const isArms90 = type === 'arms90';
        container.innerHTML = `
            <div class="glass p-6 rounded-3xl border border-violet-500/20 text-center">
                <h3 class="font-bold text-xl mb-4 text-violet-400">${isArms90 ? 'Bras 90°' : 'Suspension'}</h3>
                <div class="grid grid-cols-2 gap-3 mb-6 text-left">
                    ${!isArms90 ? `
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
                    ` : ''}
                    <div class="${isArms90 ? 'col-span-2' : 'col-span-1'}">
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
                <button onclick="startPyramid()" class="w-full bg-violet-600 p-4 rounded-2xl font-bold">LANCER</button>
            </div>
        `;
    }
    lucide.createIcons();
}

function startComplexCycle(type) {
    const isArms90 = type === 'arms90';
    const work = parseInt(document.getElementById('input-work').value);
    const rest = parseInt(document.getElementById('input-rest').value);
    const cycles = parseInt(document.getElementById('input-cycles').value);
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
                    const sessionData = {
                        type: isArms90 ? 'Bras 90°' : 'Suspension',
                        work, rest, cycles,
                        fingers: !isArms90 ? document.getElementById('hang-fingers').value : null,
                        hands: !isArms90 ? document.getElementById('hang-hands').value : null,
                        note: `${cycles} x ${work}s (Repos: ${rest}s)`
                    };
                    showMoodSelector(sessionData);
                    return;
                }
                isWorking = true;
                timeLeft = work;
                status.innerText = isArms90 ? "BLOCAGE" : "SUSPENSION";
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




function backToMenu() {
    document.getElementById('exercise-menu').classList.remove('hidden');
    document.getElementById('exercise-active').classList.add('hidden');
    clearInterval(chronoInterval);
}



function startPyramid() {
    const max = document.getElementById('pyramid-max').value;
    if (!max) return;
    pyrMax = parseInt(max);
    pyrCurrent = 1;
    pyrDirection = 1;
    pyrData.steps = [];
    
    renderPyramidUI();
    startChrono();
}

function renderPyramidUI() {
    const container = document.getElementById('exercise-content');
    container.innerHTML = `
        <div class="glass p-6 rounded-3xl text-center">
            <h3 class="font-bold text-xl mb-4 text-violet-400">Pyramide Pro</h3>
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
    // On enregistre les données réelles de la série qui vient de finir
    currentSessionSteps.push({
        reps: pyrCurrent,
        work: seconds,      // Temps d'effort chronométré
        rest: pyrData.currentRest // Temps de repos juste avant cette série
    });

    // Logique de progression de la pyramide (Montée/Descente)
    if (pyrCurrent === pyrMax) pyrDirection = -1;
    pyrCurrent += pyrDirection;

    if (pyrCurrent === 0) {
        clearInterval(chronoInterval);
        savePyramidFinal();
    } else {
        renderPyramidUI();
        startChrono(); // Relance pour le repos suivant
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
    return `
        ${log.hands ? `
            <div class="flex gap-2 mb-3">
                <span class="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-violet-500/30">
                    ${log.hands} Main(s)
                </span>
                ${log.fingers ? `
                    <span class="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-[9px] uppercase font-bold border border-blue-500/30">
                        ${log.fingers} Doigt(s)
                    </span>
                ` : ''}
            </div>
        ` : ''}

        ${log.totalReps ? `
            <div class="grid grid-cols-2 gap-2 mb-3">
                <div class="bg-violet-500/10 p-2 rounded-xl border border-violet-500/20 text-center">
                    <p class="text-[9px] text-slate-500 uppercase">Vitesse</p>
                    <p class="text-sm font-bold text-violet-400">${log.avgWorkPerRep}s / rep</p>
                </div>
                <div class="bg-blue-500/10 p-2 rounded-xl border border-blue-500/20 text-center">
                    <p class="text-[9px] text-slate-500 uppercase">Repos moy.</p>
                    <p class="text-sm font-bold text-blue-400">${log.avgRestPerRep}s / rep</p>
                </div>
            </div>
        ` : ''}
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
    return `
        <div class="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 mb-3 flex items-center gap-3">
            <i data-lucide="accessibility" class="w-4 h-4 text-emerald-400"></i>
            <div>
                <p class="text-[10px] text-slate-500 uppercase font-bold">Focus</p>
                <p class="text-xs text-white">${log.routine}</p>
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

async function renderLogs(filter = 'all') {
    const container = document.getElementById('log-list');
    if (!container) return;

    const searchTerm = document.getElementById('log-search')?.value.toLowerCase() || "";
    
    // Récupération des logs depuis Dexie
    let logs = await DB.getLogs(); 

    // Filtre par type et recherche textuelle
    const filteredLogs = logs.filter(l => {
        const matchesType = (filter === 'all' || l.type.toLowerCase() === filter.toLowerCase());
        const text = (l.type + (l.note || "") + (l.exercise || "")).toLowerCase();
        return matchesType && text.includes(searchTerm);
    });

    const moodColors = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 5: '#a855f7' };

    container.innerHTML = filteredLogs.map(log => {
        let specificContent = "";
        
        // Routage du rendu selon le sport
        switch(log.type) {
            case 'Course': specificContent = renderRunDetails(log); break;
            case 'Musique': specificContent = renderMusicDetails(log); break;
            case 'Étirement': specificContent = renderStretchDetails(log); break;
            case 'Escalade': specificContent = renderClimbingDetails(log); break;
            default: specificContent = renderMuscuDetails(log);
        }

        const displayDate = log.date || new Date(log.timestamp).toLocaleDateString('fr-FR');
        // Sécurité pour l'ID (Dexie utilise .id)
        const logId = log.id; 

        return `
            <div class="glass p-4 rounded-2xl border-l-4 mb-3 cursor-pointer transition-all active:scale-[0.98]" 
                style="border-color: ${moodColors[log.mood] || '#475569'}" 
                onclick="toggleComment('${logId}')">
                
                <div class="flex justify-between items-start mb-2">
                    <p class="text-sm font-bold text-white">${log.type}</p>
                    <span class="text-[10px] text-slate-500">${displayDate}</span>
                </div>

                ${log.note ? `<p class="text-xs text-slate-300 mb-3">${log.note}</p>` : ''}
                
                ${specificContent}

                <div id="details-${logId}" class="hidden mt-3 pt-3 border-t border-white/5">
                    <div class="bg-black/20 p-2 rounded-lg text-[10px] text-slate-400 italic mb-3">
                        "${log.comment || 'Aucun commentaire...'}"
                    </div>
                    
                    <div class="flex flex-col gap-2">
                        <button onclick="addComment(event, '${logId}')" class="w-full py-2 bg-white/5 rounded-xl text-[10px] text-violet-400 font-bold uppercase">
                            Modifier la note
                        </button>
                        <button onclick="deleteLog(event, '${logId}')" class="w-full py-2 text-[9px] text-red-400/50 uppercase">
                            Supprimer la séance
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
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
    // --- NOUVEAU : On attend les logs de la base de données ---
    const logs = await DB.getLogs(); 
    
    if (!logs || logs.length === 0) {
        console.log("Aucune donnée pour les stats");
        return;
    }

    // --- 1. STATS PYRAMIDE ---
    const pyramidLogs = logs.filter(l => l.type && l.type.includes('Pyramide'));
    if (pyramidLogs.length > 0) {
        const totalReps = pyramidLogs.reduce((acc, l) => acc + (parseInt(l.totalReps) || 0), 0);
        const logsWithSpeed = pyramidLogs.filter(l => l.avgWorkPerRep);
        const avgSpeed = logsWithSpeed.length > 0 
            ? logsWithSpeed.reduce((acc, l) => acc + parseFloat(l.avgWorkPerRep), 0) / logsWithSpeed.length 
            : 0;

        if(document.getElementById('stat-total-reps')) document.getElementById('stat-total-reps').innerText = totalReps;
        if(document.getElementById('stat-avg-speed')) document.getElementById('stat-avg-speed').innerText = avgSpeed.toFixed(1) + "s";
        
        // On envoie les 10 derniers à ton graphique
        if (typeof renderProgressionChart === "function") {
            renderProgressionChart(pyramidLogs.slice(0, 10).reverse());
        }
    }

    // --- 2. STATS SUSPENSION ---
    const filterEl = document.getElementById('stat-finger-filter');
    const fingerFilter = filterEl ? filterEl.value : 'all';

    const hangLogs = logs.filter(l => {
        const typeLower = (l.type || "").toLowerCase();
        const isHang = typeLower.includes('suspension') || typeLower.includes('deadhang') || typeLower.includes('bras 90');
        if (!isHang) return false;
        if (fingerFilter === 'all') return true;
        return String(l.fingers) === String(fingerFilter);
    });

    const totalSeconds = hangLogs.reduce((acc, l) => {
        let volume = 0;
        if (l.totalReps != null) {
            volume = parseInt(l.totalReps);
        } else if (l.cycles && l.work) {
            volume = parseInt(l.cycles) * parseInt(l.work);
        }
        return acc + (isNaN(volume) ? 0 : volume);
    }, 0);

    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    const displayHang = document.getElementById('stat-total-hang');
    if (displayHang) {
        displayHang.innerText = mins > 0 ? `${mins}m ${secs.toString().padStart(2, '0')}s` : `${secs}s`;
    }

    // --- 3. STATS COURSE ---
    const runLogs = logs.filter(l => l.type === 'Course');
    if (runLogs.length > 0) {
        const totalDist = runLogs.reduce((acc, l) => acc + (parseFloat(l.distance) || 0), 0);
        const distEl = document.getElementById('stat-run-total-dist');
        if(distEl) distEl.innerText = totalDist.toFixed(1) + "km";

        const thirtyDaysAgo = new Date().getTime() - (30 * 24 * 60 * 60 * 1000);
        const recentRuns = runLogs.filter(l => new Date(l.timestamp).getTime() > thirtyDaysAgo);
        const freqEl = document.getElementById('stat-run-freq');
        if(freqEl) freqEl.innerText = recentRuns.length;

        if (typeof renderRunChart === "function") renderRunChart(runLogs.slice().reverse());
    }

    // --- 4. AUTRES TOTAUX (MUSIQUE / ZEN) ---
    const totals = logs.reduce((acc, log) => {
        if (log.type === 'Étirement') acc.stretch += (parseInt(log.duration) || 0);
        if (log.type === 'Musique') acc.music += (parseInt(log.duration) || 0);
        return acc;
    }, { stretch: 0, music: 0 });

    const stretchEl = document.getElementById('stat-stretch-total');
    const musicEl = document.getElementById('stat-music-total');
    if(stretchEl) stretchEl.innerText = `${Math.round(totals.stretch / 60)} min`;
    if(musicEl) musicEl.innerText = `${Math.round(totals.music / 60)} min`;

    // --- 5. APPELS DES GRAPHIQUES GENERAUX ---
    if (typeof renderMainChart === "function") renderMainChart(logs);
    if (typeof renderVolumeChart === "function") renderVolumeChart(logs);

        // --- 6. STATS ESCALADE ---
    const climbLogs = logs.filter(l => l.type === 'Escalade' || l.type === 'escalade');
    if (climbLogs.length > 0) {
        // Calcul du volume total
        const totalAttempts = climbLogs.reduce((acc, l) => acc + (l.details ? l.details.length : 0), 0);
        const totalSuccess = climbLogs.reduce((acc, l) => {
            return acc + (l.details ? l.details.filter(d => d.success).length : 0);
        }, 0);

        // Affichage des compteurs (assure-toi que ces IDs existent dans ton HTML)
        const climbVolEl = document.getElementById('stat-climb-volume');
        const climbRateEl = document.getElementById('stat-climb-success-rate');
        
        if(climbVolEl) climbVolEl.innerText = totalAttempts;
        if(climbRateEl) {
            const rate = totalAttempts > 0 ? Math.round((totalSuccess / totalAttempts) * 100) : 0;
            climbRateEl.innerText = rate + "%";
        }

        // Appel du nouveau graphique d'évolution
        if (typeof renderClimbEvolutionChart === "function") {
            renderClimbEvolutionChart(climbLogs.slice().reverse());
        }
    }

    // --- 7. NOUVEAU : HEATMAP DE DISCIPLINE ---
    if (typeof renderHeatmap === "function") {
        renderHeatmap(logs);
    }

    // --- 8. NOUVEAU : RADAR DE L'ÉQUILIBRE ---
    // On définit ici les objectifs (en minutes par semaine par ex)
    const objectifsHebdo = {
        'Escalade': 120, 
        'Musculation': 60,
        'Course': 90,
        'Musique': 130,
        'Stretching': 60
    };
    if (typeof renderRadarChart === "function") {
        renderRadarChart(logs, objectifsHebdo);
    }

    // --- 9. NOUVEAU : SCATTER PLOT (EFFORT VS PERF) ---
    if (typeof renderScatterChart === "function") {
        renderScatterChart(logs);
    }

    // --- 10. NOUVEAU : CHARGE DE FATIGUE (7j vs 28j) ---
    if (typeof renderFatigueChart === "function") {
        renderFatigueChart(logs);
    }
}

// On crée une variable à l'extérieur pour stocker l'instance du graphique
let radarChartInstance = null;
function renderRadarChart(logs,objectifs) {
    const canvas = document.getElementById('radarChart');
    if (!canvas) return;



    const labels = Object.keys(objectifs);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const realValues = labels.map(label => {
        return logs.filter(l => {
            const logDate = new Date(l.timestamp);
            return logDate > sevenDaysAgo;
        }).reduce((sum, l) => {
            const type = l.type;
            let mins = 0;

            // MUSCULATION (Déjà en secondes -> Minutes)
            if (label === 'Musculation') {
                if (type === "Bras 90°" || type === "Suspension") {
                    mins = ((parseInt(l.work)||0) + (parseInt(l.rest)||0)) * (parseInt(l.cycles)||1) / 60;
                } else if (type === "Pyramide Tractions") {
                    mins = (parseInt(l.totalReps)||0) * (parseFloat(l.avgWorkPerRep)||0) / 60;
                }
            }
            // COURSE (Format 00:00:00 -> H:M:S)
            else if (label === 'Course' && type === "Course") {
                if (l.duration && typeof l.duration === 'string' && l.duration.includes(':')) {
                    const parts = l.duration.split(':').map(Number);
                    if (parts.length === 3) {
                        mins = (parts[0] * 60) + parts[1] + (parts[2] / 60);
                    } else if (parts.length === 2) {
                        mins = parts[0] + (parts[1] / 60);
                    }
                } else {
                    mins = parseFloat(l.duration) || 0;
                }
            }
            // MUSIQUE (Secondes -> Minutes)
            else if (label === 'Musique' && type === "Musique") {
                mins = (parseFloat(l.duration) || 0) / 60;
            }
            // ESCALADE (Déjà en minutes)
            else if (label === 'Escalade' && type === "Escalade") {
                mins = parseFloat(l.duration) || 0;
            }
            // STRETCHING (Déjà en minutes via durationStr)
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
                pointRadius: 0
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
                        font: { size: 12, weight: 'bold' },
                        callback: (label, index) => `${label}: ${Math.round(realValues[index])}m`
                    }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderFatigueChart(logs) {
    const ctx = document.getElementById('fatigueChart').getContext('2d');
    
    // On génère les 28 derniers jours
    const last28Days = [...Array(28).keys()].map(i => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const dailyScores = last28Days.map(date => {
        return logs
            .filter(l => l.timestamp.startsWith(date))
            .reduce((sum, l) => sum + (l.mood || 0), 0); // Utilise mood ou un score d'effort
    });

    // Calcul charge aiguë (moyenne 7j) et chronique (28j)
    const acuteLoad = dailyScores.map((_, i, arr) => {
        const slice = arr.slice(Math.max(0, i - 6), i + 1);
        return slice.reduce((a, b) => a + b, 0) / slice.length;
    });

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: last28Days,
            datasets: [
                {
                    label: 'Charge 7j (Aiguë)',
                    data: acuteLoad,
                    borderColor: '#8b5cf6',
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(139, 92, 246, 0.1)'
                }
            ]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function renderScatterChart(logs) {
    const canvas = document.getElementById('scatterChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 1. Dictionnaire pour convertir les textes en positions sur l'axe X
    const levelMapping = {
        // Couleurs
        'blanc': 1, 'jaune': 2, 'vert': 3, 'bleu': 4, 'rouge': 5, 'noir': 6, 'violet': 7,
        // Cotations (on les intercale ou on les suit)
        '4c':2.1, '5a':2.4, '5b':2.9, '5c':3.5, '6a':4.8, '6b':5.1, '6c':5.5, '7a':6.4, '7b':6.8,'7c':7,'8a':7.5,'8b':8,'8c':9,
    };

    const climbLogs = logs.filter(l => l.type === 'Escalade' && l.details);
    const dataPoints = [];

    climbLogs.forEach(log => {
        log.details.forEach(lap => {
            // On récupère le texte, on enlève les espaces et on met en minuscule
            const rawLevel = String(lap.level || "").toLowerCase().trim();
            const xVal = levelMapping[rawLevel] || parseFloat(rawLevel);
            const yVal = parseInt(lap.effort);
            
            if (xVal && !isNaN(yVal)) {
                dataPoints.push({
                    x: xVal + (Math.random() * 0.3 - 0.15), // Jitter
                    y: yVal + (Math.random() * 0.3 - 0.15), // Jitter
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
                x: { 
                    title: { display: true, text: 'Difficulté (Couleurs & Cotations)', color: '#94a3b8' },
                    min: 0, max: 8,
                    ticks: {
                        stepSize: 1,
                        color: '#94a3b8',
                        callback: (v) => ["", "Blanc", "Jaune", "Vert", "Bleu", "Rouge", "Noir", "Violet"][Math.round(v)] || v
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
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
                        label: (ctx) => ` Bloc: ${ctx.raw.originalLevel} - Effort: ${ctx.raw.effortReal}/5`
                    }
                }
            }
        }
    });
}

function renderClimbEvolutionChart(climbLogs) {
    const canvas = document.getElementById('climbEvolutionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Mapping des niveaux en valeurs numériques
    const levelMap = {
        'Jaune': 1, '4': 1,
        'Vert': 2, '5a': 2, '5b': 2, '5c': 2,
        'Bleu': 3, '6a': 3, '6a+': 3,
        'Rouge': 4, '6b': 4, '6b+': 4, '6c': 4,
        'Noir': 5, '6c+': 5, '7a': 5, '7a+': 5, '7b': 5,
        'Violet': 6, '7b+': 6, '7c': 6, '8a': 6
    };

    const labels = [];
    const successData = [];
    const projectData = [];

    climbLogs.forEach(log => {
        labels.push(new Date(log.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
        
        if (log.details && log.details.length > 0) {
            // Trouver le niveau max réussi ce jour-là
            const validated = log.details
                .filter(d => d.success)
                .map(d => levelMap[d.level] || 0);
            const maxVal = validated.length > 0 ? Math.max(...validated) : 0;
            
            // Calculer le "Niveau de Forme" : Difficulté Max tentée + (Ressenti / 10)
            const attempted = log.details.map(d => {
                const base = levelMap[d.level] || 0;
                // Si effort est bas (1), le niveau estimé est plus haut que le bloc
                // Si effort est haut (5), le niveau estimé est égal au bloc
                const effortBonus = (6 - parseInt(d.effort)) * 0.2; 
                return d.success ? base + effortBonus : base - 0.5;
            });
            const maxProject = Math.max(...attempted);

            successData.push(maxVal);
            projectData.push(maxProject);
        }
    });

    if (window.myClimbChart) window.myClimbChart.destroy();
    window.myClimbChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Niveau Validé',
                    data: successData,
                    borderColor: '#10b981', // Vert
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    borderWidth: 3,
                    pointRadius: 4
                },
                {
                    label: 'Potentiel (Forme/Projet)',
                    data: projectData,
                    borderColor: '#ec4899', // Rose
                    borderDash: [5, 5],
                    backgroundColor: 'transparent',
                    tension: 0.4,
                    borderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0,
                    max: 7,
                    ticks: {
                        callback: (value) => {
                            const labels = ['', 'Jaune', 'Vert', 'Bleu', 'Rouge', 'Noir', 'Violet', 'Élite'];
                            return labels[value];
                        },
                        color: '#94a3b8'
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
                legend: { labels: { color: '#f8fafc', font: { size: 11 } } }
            }
        }
    });
}

function updateGeneralCounters(logs) {
    const musicTotal = logs
        .filter(l => l.type === 'Musique')
        .reduce((acc, l) => acc + (parseInt(l.duration) || 0), 0);
    
    const zenTotal = logs
        .filter(l => l.type === 'Étirement')
        .reduce((acc, l) => acc + (parseInt(l.duration) || 0), 0);

    // Injection (Assure-toi que ces IDs existent dans ton HTML)
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

    window.myRunChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => new Date(d.timestamp).toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'})),
            datasets: [{
                label: 'Allure',
                data: data.map(d => paceToFloat(d.pace)),
                borderColor: '#818cf8',
                backgroundColor: 'rgba(129, 140, 248, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            scales: {
                y: { 
                    reverse: true, // Plus le chiffre est petit, plus on court vite !
                    ticks: { callback: value => Math.floor(value) + ":" + Math.round((value % 1) * 60).toString().padStart(2, '0') }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function renderProgressionChart(data) {
    const ctx = document.getElementById('statsChart').getContext('2d');
    if (window.mystatsChart) window.mystatsChart.destroy();

    // --- CORRECTION ICI : On inverse l'ordre des données avant le rendu ---
    // [...data] crée une copie pour ne pas impacter le reste de l'application
    // .reverse() remet le plus ancien à gauche (index 0)
    const displayData = [...data].reverse();

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
                    return (l.type === 'Pyramide Tractions' || l.type === 'Bras 90°' || l.type === 'Suspension');
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
                if (l.type === 'Escalade' || l.type === 'escalade') {
                    return total + (l.details ? l.details.length : 0);
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

function toggleRunTimer() {
    const btn = document.getElementById('btn-run');
    if (!isRunning) {
        isRunning = true;
        btn.innerText = "Pause";
        btn.classList.replace('bg-blue-600', 'bg-orange-500');
        runInterval = setInterval(() => {
            runSeconds++;
            updateRunDisplay();
        }, 1000);
    } else {
        isRunning = false;
        btn.innerText = "Reprendre";
        btn.classList.replace('bg-orange-500', 'bg-blue-600');
        clearInterval(runInterval);
    }
}

function updateRunDisplay() {
    const h = Math.floor(runSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((runSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (runSeconds % 60).toString().padStart(2, '0');
    document.getElementById('run-timer').innerText = `${h}:${m}:${s}`;
}

function stopAndSaveRun() {
    clearInterval(runInterval);
    isRunning = false;

    const distInput = document.getElementById('run-distance');
    const distance = parseFloat(distInput.value) || 0;

    if (distance <= 0) {
        alert("Saisis une distance pour enregistrer ta course !");
        return;
    }

    const totalMinutes = runSeconds / 60;
    const paceDecimal = totalMinutes / distance;
    const paceMin = Math.floor(paceDecimal);
    const paceSec = Math.round((paceDecimal - paceMin) * 60);
    const finalPace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;

    const runData = {
        type: 'Course',
        distance: distance,
        duration: document.getElementById('run-timer').innerText,
        pace: finalPace,
        note: `${distance}km en ${finalPace} min/km`
    };

    // Préparation de l'affichage du Mood Selector
    showSection('muscu'); 
    document.getElementById('exercise-menu').classList.add('hidden');
    document.getElementById('exercise-active').classList.remove('hidden');
    
    showMoodSelector(runData);

    // Reset du chrono pour la suite
    runSeconds = 0;
    distInput.value = "";
    updateRunDisplay();
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





let musicInterval;
let musicSeconds = 0;
let currentInstrument = "";

function startMusicSession(instrument) {
    currentInstrument = instrument;
    musicSeconds = 0;
    
    // UI Switch
    document.getElementById('music-setup').classList.add('hidden');
    document.getElementById('music-active').classList.remove('hidden');
    document.getElementById('active-instrument-name').innerText = instrument;

    musicInterval = setInterval(() => {
        musicSeconds++;
        const mins = Math.floor(musicSeconds / 60).toString().padStart(2, '0');
        const secs = (musicSeconds % 60).toString().padStart(2, '0');
        document.getElementById('music-timer').innerText = `${mins}:${secs}`;
    }, 1000);
}

function stopMusicSession() {
    // 1. Arrêt du chrono
    clearInterval(musicInterval);
    
    // 2. Préparation des données de temps
    const finalSeconds = musicSeconds;
    const durationMins = Math.floor(finalSeconds / 60);
    const durationStr = durationMins > 0 ? `${durationMins} min` : `${finalSeconds} sec`;
    
    // 3. Récupération du nom de l'instrument (via variable ou DOM)
    const instrumentName = typeof currentInstrument !== 'undefined' ? currentInstrument : 
                        (document.getElementById('active-instrument-name')?.innerText || 'Musique');

    // 4. Objet de données fusionné
    const musicData = {
        type: 'Musique',
        exercise: instrumentName, // 'exercise' pour la compatibilité journal
        instrument: instrumentName,
        duration: finalSeconds,   // Nombre pur pour l'histogramme de volume
        durationStr: durationStr, // Texte pour le journal de bord
        totalSeconds: finalSeconds,
        note: `Session de ${instrumentName} (${durationStr})`
    };

    // 5. Reset de l'Interface Utilisateur
    document.getElementById('music-setup').classList.remove('hidden');
    document.getElementById('music-active').classList.add('hidden');
    
    const timerDisplay = document.getElementById('music-timer');
    if (timerDisplay) timerDisplay.innerText = "00:00:00";
    
    // Remise à zéro du compteur global
    musicSeconds = 0;

    // 6. Envoi au sélecteur de ressenti (Mood Selector)
    showMoodSelector(musicData);
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
    // --- QUOTIDIEN & ÉCHAUFFEMENT (5-10 min) ---
    "Quotidien Forme": { type: "Mixte", duration: 10, exos: [
        { name: "Cercle cou/épaules", d: 60, img: "refresh-cw" },
        { name: "Dos de chat / Vache", d: 60, img: "cat" },
        { name: "Rotation buste au sol", d: 120, img: "move" },
        { name: "Fente basse ouverture", d: 120, img: "arrow-up-right" },
        { name: "Squat profond", d: 120, img: "arrow-down" },
        { name: "Étirement latéral", d: 120, img: "side-stretch" }
    ]},
    "Réveil Articulaire": { type: "Actif", duration: 7, exos: [
        { name: "Moulinets bras", d: 60, img: "rotate-cw" },
        { name: "Poignets & Doigts", d: 120, img: "hand" },
        { name: "Cossack Squats", d: 120, img: "move-horizontal" },
        { name: "Balancier de jambes", d: 120, img: "arrow-left-right" }
    ]},

    // --- SÉANCES LONGUES (+30 min) ---
    "Ouverture Bassin Profonde": { type: "Passif", duration: 30, exos: [
        { name: "Papillon", d: 300, img: "unfold-more" },
        { name: "Pigeon Gauche", d: 300, img: "pigeon" },
        { name: "Pigeon Droit", d: 300, img: "pigeon" },
        { name: "Grenouille", d: 420, img: "layout-grid" },
        { name: "Lézard profond", d: 480, img: "maximize" }
    ]},
    "Full Body Récupération": { type: "Passif", duration: 40, exos: [
        { name: "Posture de l'enfant", d: 300, img: "baby" },
        { name: "Chien tête en bas", d: 300, img: "dog" },
        { name: "Cobra", d: 300, img: "snake" },
        { name: "Grand écart assisté", d: 600, img: "expand" },
        { name: "Torsion colonne", d: 600, img: "repeat" },
        { name: "Savasana", d: 300, img: "moon" }
    ]},
    "Souplesse Spécial Grand Écart": { type: "Mixte", duration: 35, exos: [
        { name: "Fente Flexion Ischio", d: 300, img: "stretch-vertical" },
        { name: "Fente haute active", d: 300, img: "zap" },
        { name: "Écart facial au mur", d: 600, img: "columns" },
        { name: "Pancake stretch", d: 600, img: "layers" },
        { name: "Posture de la demi-lune", d: 300, img: "moon-star" }
    ]},

    // --- SÉANCES MÉDIANES (15-20 min) ---
    "Grimpeur : Mobilité Active": { type: "Actif", duration: 15, exos: [
        { name: "Ouverture Épaules mur", d: 180, img: "shield" },
        { name: "Hanches rotation interne", d: 240, img: "rotate-ccw" },
        { name: "Squat Cosaque", d: 240, img: "move-horizontal" },
        { name: "Suspension active barre", d: 240, img: "grip" }
    ]},
    "Souplesse Jambes & Ischio": { type: "Mixte", duration: 20, exos: [
        { name: "Chien tête en bas dyn.", d: 300, img: "dog" },
        { name: "Pince debout", d: 300, img: "arrow-down" },
        { name: "Fente haute active", d: 300, img: "zap" },
        { name: "Étirement Ischio couché", d: 300, img: "stretch-vertical" }
    ]},
    "Haut du corps & Thorax": { type: "Passif", duration: 15, exos: [
        { name: "Pectoraux encadrement", d: 180, img: "door" },
        { name: "Étirement Triceps", d: 180, img: "arrow-up" },
        { name: "Posture du chiot", d: 240, img: "dog" },
        { name: "Aigle (épaules)", d: 300, img: "bird" }
    ]},
    "Mobilité Colonne & Torsion": { type: "Mixte", duration: 18, exos: [
        { name: "Thread the needle", d: 240, img: "needle" },
        { name: "Torsion assise", d: 240, img: "repeat" },
        { name: "Pont (Bridge pose)", d: 300, img: "arch" },
        { name: "Cobra dynamique", d: 300, img: "activity" }
    ]},
    "Détente Soir (Sommeil)": { type: "Passif", duration: 20, exos: [
        { name: "Jambes contre le mur", d: 300, img: "wall" },
        { name: "Bébé heureux", d: 300, img: "smile" },
        { name: "Respiration ventrale", d: 300, img: "wind" },
        { name: "Détente cervicale", d: 300, img: "cloud" }
    ]},

    // --- SÉANCES EXPRESS (-5 min) ---
    "Déblocage Avant-bras": { type: "Actif", duration: 4, exos: [
        { name: "Extension poignets", d: 60, img: "hand" },
        { name: "Flexion poignets", d: 60, img: "hand" },
        { name: "Shake (Secouer)", d: 120, img: "wind" }
    ]},
    "Anti-Bureau (Nuque)": { type: "Mixte", duration: 5, exos: [
        { name: "Rétraction cervicale", d: 60, img: "user" },
        { name: "Ouverture pectoraux", d: 120, img: "door" },
        { name: "Trapèzes", d: 120, img: "align-center" }
    ]},
    "Flash Hanche (Squat)": { type: "Actif", duration: 3, exos: [
        { name: "Squat profond actif", d: 180, img: "arrow-down" }
    ]},
    "Pieds & Chevilles": { type: "Mixte", duration: 5, exos: [
        { name: "Massage voûte plantaire", d: 150, img: "foot" },
        { name: "Flexion orteils", d: 150, img: "foot" }
    ]},

    // --- AJOUTS POUR ARRIVER À 20 ---
    "Ouverture Thoracique Forte": { type: "Actif", duration: 12, exos: [
        { name: "Planche inversée", d: 180, img: "arrow-up" },
        { name: "Pompes Hindu", d: 180, img: "activity" },
        { name: "Cobra actif", d: 360, img: "zap" }
    ]},
    "Adducteurs & Squat": { type: "Passif", duration: 14, exos: [
        { name: "Grenouille légère", d: 420, img: "layout-grid" },
        { name: "Étirement latéral sol", d: 420, img: "move-horizontal" }
    ]},
    "Spécial Dos (Bas du dos)": { type: "Passif", duration: 16, exos: [
        { name: "Genoux poitrine", d: 320, img: "circle" },
        { name: "Posture de l'enfant", d: 320, img: "baby" },
        { name: "Torsion douce", d: 320, img: "repeat" }
    ]},
    "Yoga Power (Vinyasa simple)": { type: "Actif", duration: 22, exos: [
        { name: "Salutation soleil A", d: 300, img: "sun" },
        { name: "Guerrier 1 & 2", d: 600, img: "sword" },
        { name: "Planche active", d: 420, img: "shield" }
    ]},
    "Soulagement Lombaire": { type: "Passif", duration: 12, exos: [
        { name: "Sphinx", d: 360, img: "eye" },
        { name: "Torsion au sol", d: 360, img: "repeat" }
    ]},
    "Mobilité Poignets Pro": { type: "Actif", duration: 8, exos: [
        { name: "Cercle poignets sol", d: 240, img: "refresh-cw" },
        { name: "Étirement doigts un par un", d: 240, img: "hand" }
    ]}
};

let stretchIndex = 0;
let stretchTimer;
let currentRoutine = [];



function loadStretchMenu() {
    const menu = document.getElementById('stretch-menu');
    menu.innerHTML = Object.keys(STRETCH_DATA).map(key => {
        const prog = STRETCH_DATA[key];
        const typeColor = prog.type === 'Actif' ? 'text-orange-400' : (prog.type === 'Passif' ? 'text-blue-400' : 'text-emerald-400');
        
        return `
            <button onclick="startStretchRoutine('${key}')" class="glass p-4 rounded-2xl border-l-4 border-emerald-500/30 flex justify-between items-center active:scale-95 transition-all">
                <div class="text-left">
                    <p class="font-bold text-white">${key}</p>
                    <div class="flex gap-2 mt-1">
                        <span class="text-[9px] uppercase font-black ${typeColor}">${prog.type}</span>
                        <span class="text-[9px] text-slate-500 uppercase font-black">• ${prog.duration} MIN</span>
                    </div>
                </div>
                <i data-lucide="play" class="w-4 h-4 text-emerald-500"></i>
            </button>
        `;
    }).join('');
    lucide.createIcons();
}
// --- CORRECTION ÉTIREMENTS ---
function startStretchRoutine(type) {
    const routineData = STRETCH_DATA[type];
    if (!routineData) return;

    currentRoutine = routineData.exos; // ON PREND LE TABLEAU EXOS
    stretchIndex = 0;
    
    document.getElementById('stretch-menu').classList.add('hidden');
    document.getElementById('stretch-active').classList.remove('hidden');
    document.getElementById('stretch-name').innerText = type;
    
    runStretchStep();
}

function runStretchStep() {
    if (!currentRoutine || stretchIndex >= currentRoutine.length) {
        finishStretch();
        return;
    }

    let step = currentRoutine[stretchIndex];
    let timeLeft = step.d;
    
    document.getElementById('stretch-exercise').innerHTML = `
        <div class="flex flex-col items-center gap-4">
            <div class="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                <i data-lucide="${step.img || 'accessibility'}" class="w-10 h-10 text-emerald-400"></i>
            </div>
            <span class="text-xl font-bold text-white">${step.name}</span>
        </div>
    `;
    
    document.getElementById('stretch-timer').innerText = timeLeft;
    lucide.createIcons();
    
    if (stretchTimer) clearInterval(stretchTimer);
    if (typeof beep === "function") beep();

    stretchTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('stretch-timer').innerText = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(stretchTimer);
            stretchIndex++;
            if (typeof beep === "function") beep(600, 200);
            setTimeout(runStretchStep, 2000);
        }
    }, 1000);
}

function finishStretch() {
    // On calcule la durée réelle effectuée
    const totalDuration = currentRoutine.reduce((acc, exo) => acc + exo.d, 0); 
    
    const data = {
        type: 'Étirement',
        routine: document.getElementById('stretch-name').innerText,
        duration: totalDuration, // En secondes pour l'histogramme
        durationStr: Math.round(totalDuration / 60) + " min"
    };
    
    document.getElementById('stretch-menu').classList.remove('hidden'); // On affiche le menu
    document.getElementById('stretch-active').classList.add('hidden'); // On cache l'actif
    
    showMoodSelector(data);
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
    { id: 'climbEvolutionChart', title: 'Evolution niveau escalade'},
    { id: 'volumeChart', title: "Volume Hebdomadaire" },
    { id: 'fatigueChart', title: "Charge d'Entraînement (Fatigue)" },
    { id: 'scatterChart', title: "Flow State (Escalade)" },
    { id: 'radarChart', title: "Équilibre des Piliers" }
];

function changeChart(direction) {
    // 1. Calculer le nouvel index
    currentChartIndex += direction;
    if (currentChartIndex < 0) currentChartIndex = charts.length - 1;
    if (currentChartIndex >= charts.length) currentChartIndex = 0;

    // 2. Mettre à jour l'affichage
    const activeChart = charts[currentChartIndex];
    
    // Cacher tous les wrappers et afficher le bon
    document.querySelectorAll('.chart-wrapper').forEach(el => el.classList.add('hidden'));
    document.getElementById(`wrapper-${activeChart.id}`).classList.remove('hidden');
    
    // Mettre à jour le titre
    document.getElementById('chart-title').innerText = activeChart.title;

    // 3. Redessiner si nécessaire pour corriger les problèmes de taille
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

    // Définition des constantes de temps
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startWeek = new Date(); 
    startWeek.setDate(now.getDate() - 7);

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
        const relevant = logs.filter(l => new Date(l.timestamp) >= startWeek && l.type === g.type);
        let val = 0;
        
        if (g.unit === "km") {
            val = relevant.reduce((acc, l) => acc + (parseFloat(l.distance) || 0), 0);
        } else if (g.fingers) {
            val = Math.max(...relevant.filter(l => l.fingers == g.fingers).map(l => parseInt(l.work) || 0), 0);
        } else if (g.unit === "top" && g.color) {
            // On compte les succès dans les détails (laps) pour la couleur donnée
            relevant.forEach(l => {
                if (l.details && Array.isArray(l.details)) {
                    val += l.details.filter(lap => lap.color === g.color && lap.success).length;
                }
            });
        }
        
        checkSuccess(val, g.target);
        weeklyHtml += renderGoalBar(g.label, val, g.target, g.unit, 'blue');
    });

    // --- 3. ELITE ---
    let eliteHtml = `<h3 class="text-[10px] font-bold text-violet-500 uppercase tracking-widest mb-3 mt-6">Performance Elite</h3>`;
    eliteGoals.forEach(g => {
        const val = Math.max(...logs.filter(l => l.type === g.type).map(l => parseFloat(l.distance) || 0), 0);
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



function renderPersonalRecords(logs) {
    // 1. Meilleure Distance (Course)
    const bestRun = logs.filter(l => l.type === 'Course').sort((a,b) => b.distance - a.distance)[0];
    
    // 2. Meilleur Sommet (Pyramide)
    const bestPyr = logs.filter(l => l.type === 'Pyramide Tractions')
                        .sort((a,b) => (parseInt(b.note.match(/Sommet (\d+)/)?.[1]) || 0) - (parseInt(a.note.match(/Sommet (\d+)/)?.[1]) || 0))[0];

    // 3. Meilleure Cotation (Escalade)
    const colorOrder = ['blanc', 'jaune', 'vert', 'bleu', 'rouge', 'noir', 'violet'];
    let absoluteBestColor = "---";
    let bestColorLog = null;

    logs.filter(l => l.type === 'Escalade').forEach(l => {
        l.details?.forEach(lap => {
            if (lap.success) {
                const currentIndex = colorOrder.indexOf(lap.color);
                const bestIndex = colorOrder.indexOf(absoluteBestColor);
                if (currentIndex > bestIndex) {
                    absoluteBestColor = lap.color;
                    bestColorLog = l;
                }
            }
        });
    });

    // 4. Meilleure Suspension
    const bestHang = logs.filter(l => l.type === 'Suspension').sort((a,b) => b.work - a.work)[0];

    const records = [
        { label: "Plus longue distance", val: bestRun ? bestRun.distance + " km" : "---", date: bestRun?.timestamp },
        { label: "Plus haut sommet", val: bestPyr ? "Sommet " + (bestPyr.note.match(/Sommet (\d+)/)?.[1] || "?") : "---", date: bestPyr?.timestamp },
        { label: "Cotation Max", val: absoluteBestColor.toUpperCase(), date: bestColorLog?.timestamp },
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

// Fonction utilitaire pour extraire le meilleur score selon le type
function calculateBest(logs, goal) {
    const relevant = logs.filter(l => l.type === goal.type || l.exercise === goal.type);
    let best = 0;
    relevant.forEach(l => {
        let val = 0;
        if (goal.unit === "km") val = parseFloat(l.distance) || 0;
        else if (goal.fingers) val = (l.fingers == goal.fingers) ? (parseInt(l.work) || 0) : 0;
        else if (goal.unit === "sommet") val = parseInt(l.note?.match(/Sommet (\d+)/)?.[1]) || 0;
        else if (goal.unit === "top" && goal.color) {
            // Si on a réussi au moins un bloc de cette couleur dans cette séance
            const hasSuccess = l.details?.some(lap => lap.color === goal.color && lap.success);
            val = hasSuccess ? 1 : 0;
        }
        if (val > best) best = val;
    });
    return best;
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