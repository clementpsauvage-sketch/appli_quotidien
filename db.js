// Gestion du stockage local
const db = new Dexie("ZenithDB");

// On définit le schéma : '++id' est automatique, les autres sont indexés
db.version(1).stores({
    logs: '++id, timestamp, type, exercise'
});

const DB = {
    // Sauvegarder (Asynchrone)
    saveLog: async (entry) => {
        const fullEntry = {
            ...entry,
            timestamp: new Date().toISOString()
        };
        return await db.logs.add(fullEntry);
    },

    // Récupérer tous les logs (Triage par date décroissante)
    getLogs: async () => {
        return await db.logs.orderBy('timestamp').reverse().toArray();
    },


    deleteLog: async (id) => {
        // Dexie a besoin que l'ID soit un nombre si c'est un auto-incrément
        const numericId = parseInt(id);
        return await db.logs.delete(numericId);
    },
    updateLog: async (id, updatedFields) => {
        const numericId = parseInt(id);
        return await db.logs.update(numericId, updatedFields);
    },
    // Exporter toutes les données de la table logs
    exportAll: async () => {
        try {
            const allLogs = await db.logs.toArray();
            const dataStr = JSON.stringify(allLogs, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const date = new Date().toISOString().split('T')[0];
            const a = document.createElement('a');
            a.href = url;
            a.download = `zenith-db-${date}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Erreur export:", err);
            alert("Erreur lors de l'exportation.");
        }
    },

    // Importer et remplacer (ou ajouter)
    importAll: async (jsonContent) => {
        try {
            const logs = JSON.parse(jsonContent);
            if (!Array.isArray(logs)) throw new Error("Format invalide");

            // 1. Demander si on écrase ou si on fusionne
            const shouldClear = confirm("Voulez-vous supprimer les logs actuels avant l'import ?\n\nOK : Remplacer tout\nAnnuler : Ajouter aux logs existants");

            if (shouldClear) {
                await db.logs.clear();
            }

            // 2. Nettoyage des données pour éviter les erreurs d'ID
            // On retire l'ID pour que Dexie en génère un nouveau auto-incrémenté 
            // et on s'assure que le reste est propre.
            const logsToImport = logs.map(log => {
                const { id, ...cleanLog } = log; 
                return cleanLog;
            });

            // 3. Utilisation de bulkAdd (plus rapide)
            await db.logs.bulkAdd(logsToImport);
            
            alert("Importation réussie ! " + logsToImport.length + " séances ajoutées.");
            window.location.reload();

        } catch (err) {
            console.error("Erreur détaillée import:", err);
            alert("Erreur lors de l'import : " + err.message);
        }
    },
    // --- STATISTIQUES ---
    getStorageStats: async () => {
        const allLogs = await db.logs.toArray();
        const count = allLogs.length;
        
        // Estimation de la taille en octets
        const size = new TextEncoder().encode(JSON.stringify(allLogs)).length;
        const sizeMb = (size / (1024 * 1024)).toFixed(2);

        return { count, sizeMb };
    },

    // --- DANGER ZONE ---
    dangerZoneReset: async () => {
        const confirm1 = confirm("⚠️ ATTENTION : Cela supprimera DÉFINITIVEMENT tous vos entraînements. Êtes-vous sûr ?");
        if (confirm1) {
            const confirm2 = confirm("DERNIÈRE CHANCE : Avez-vous fait un export JSON ? Cliquez sur OK pour TOUT supprimer.");
            if (confirm2) {
                await db.logs.clear();
                // Optionnel : supprimer aussi les autres tables si tu en as (objectifs, etc.)
                alert("Base de données réinitialisée.");
                window.location.reload();
            }
        }
    }
};