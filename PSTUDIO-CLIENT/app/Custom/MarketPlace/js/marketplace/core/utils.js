/**
 * utils.js - Fonctions utilitaires pour le Marketplace
 * 
 * Fournit des utilitaires communs utilisés par plusieurs modules
 */

MarketplaceMediator.defineModule('utils', [], function() {
    /**
     * Compare deux versions sémantiques (semver)
     * @param {string} a - Première version
     * @param {string} b - Deuxième version
     * @returns {number} - Négatif si a < b, positif si a > b, 0 si égales
     */
    function compareVersions(a, b) {
        const partsA = a.split('.').map(Number);
        const partsB = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const numA = partsA[i] || 0;
            const numB = partsB[i] || 0;
            
            if (numA !== numB) {
                return numA - numB;
            }
        }
        
        return 0;
    }
    
    /**
     * Formate une date au format local
     * @param {string} dateStr - Date au format ISO
     * @returns {string} - Date formatée
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString();
        } catch (error) {
            console.error('Erreur de formatage de date:', error);
            return dateStr;
        }
    }
    
    /**
     * Crée un identifiant unique
     * @returns {string} - Identifiant unique
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
    
    /**
     * Nettoie et normalise un tableau de tags
     * @param {Array|Object} tags - Tags à normaliser
     * @returns {Array} - Tableau de tags normalisé
     */
    function normalizeTags(tags) {
        if (!tags) return [];
        
        // Si c'est déjà un tableau
        if (Array.isArray(tags)) {
            return tags;
        }
        
        // Format spécifique de .NET avec $values
        if (tags.$values && Array.isArray(tags.$values)) {
            return tags.$values;
        }
        
        return [];
    }
    
    /**
     * Détecte le type de données et extrait un tableau
     * @param {any} data - Données à normaliser
     * @returns {Array} - Tableau extrait
     */
    function extractArray(data) {
        if (!data) return [];
        
        // Si c'est déjà un tableau
        if (Array.isArray(data)) {
            return data;
        }
        
        // Format spécifique de .NET avec $values
        if (data.$values && Array.isArray(data.$values)) {
            return data.$values;
        }
        
        // Format avec propriétés courantes
        if (data.items && Array.isArray(data.items)) {
            return data.items;
        }
        
        if (data.components && Array.isArray(data.components)) {
            return data.components;
        }
        
        if (data.components && data.components.$values && Array.isArray(data.components.$values)) {
            return data.components.$values;
        }
        
        if (data.data && Array.isArray(data.data)) {
            return data.data;
        }
        
        console.warn('Format inconnu, impossible d\'extraire un tableau:', data);
        return [];
    }
    
    /**
     * Sauvegarde des données dans localStorage
     * @param {string} key - Clé
     * @param {any} value - Valeur à sauvegarder
     */
    function saveToStorage(key, value) {
        try {
            const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
            localStorage.setItem(key, serialized);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde dans localStorage:', error);
        }
    }
    
    /**
     * Récupère des données depuis localStorage
     * @param {string} key - Clé
     * @param {any} defaultValue - Valeur par défaut
     * @returns {any} - Valeur ou valeur par défaut
     */
    function getFromStorage(key, defaultValue) {
        try {
            const value = localStorage.getItem(key);
            
            if (value === null) {
                return defaultValue;
            }
            
            // Essayer de parser comme JSON
            try {
                return JSON.parse(value);
            } catch {
                // Si échec, retourner la chaîne
                return value;
            }
        } catch (error) {
            console.error('Erreur lors de la récupération depuis localStorage:', error);
            return defaultValue;
        }
    }
    
    /**
     * Débounce une fonction
     * @param {Function} func - Fonction à debouncer
     * @param {number} wait - Délai d'attente en ms
     * @returns {Function} - Fonction debouncée
     */
    function debounce(func, wait) {
        let timeout;
        
        return function(...args) {
            const context = this;
            
            clearTimeout(timeout);
            
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // Expose l'API publique
    return {
        compareVersions,
        formatDate,
        generateId,
        normalizeTags,
        extractArray,
        saveToStorage,
        getFromStorage,
        debounce
    };
});