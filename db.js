// Gestion du stockage local
const DB = {
    saveLog: (entry) => {
        let logs = JSON.parse(localStorage.getItem('zenith_logs')) || [];
        // On ajoute un ID unique et une date précise
        const fullEntry = {
            ...entry,
            id: Date.now(),
            timestamp: new Date().toISOString()
        };
        logs.unshift(fullEntry);
        localStorage.setItem('zenith_logs', JSON.stringify(logs));
    },
    getLogs: () => JSON.parse(localStorage.getItem('zenith_logs')) || [],

    saveGoals: (goals) => localStorage.setItem('zenith_goals', JSON.stringify(goals)),
    getGoals: () => JSON.parse(localStorage.getItem('zenith_goals')) || [
        { id: 'pullup_1arm', label: 'Traction 1 bras', target: 1, current: 0, unit: 'nb' },
        { id: 'run_10k', label: '10km en 43min', target: 43, current: 55, unit: 'min' }
    ]
};