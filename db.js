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
    }
};