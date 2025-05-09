/**
 * filters.js - Module de filtrage pour le Marketplace
 * 
 * Gère les filtres pour les composants du Marketplace, avec une interface utilisateur
 * permettant de filtrer par catégorie, tag, version, etc.
 */

MarketplaceMediator.defineModule('filters', ['utils', 'components'], function(utils, components) {
    // État des filtres
    let state = {
        activeFilters: {
            categories: [],
            tags: [],
            versions: []
        },
        availableFilters: {
            categories: [],
            tags: [],
            versions: []
        },
        searchTerm: '',
        showFilters: false,
        showInstalledOnly: false // Nouveau paramètre pour n'afficher que les composants installés
    };
    
    // Références DOM
    let filterPanel;
    let filterToggle;
    let filterTabs;
    let clearFiltersBtn;
    let categoryContainer;
    let tagContainer;
    let versionContainer;
    let filterOverlay;
    let filterBar;
    let filterChipsContainer;
    let componentCount;
    let domInitialized = false;
    
    /**
     * Initialise le module de filtrage
     */
    function init() {
        console.log("Initialisation du module de filtrage");
        
        try {
            // Vérifier si les éléments sont déjà initialisés
            if (document.querySelector('.filter-toggle')) {
                return;
            }
            
            // Création de l'interface de filtrage
            createFilterUI();
            
            // Attachement des gestionnaires d'événements
            if (domInitialized) {
                attachEventListeners();
                
                // Par défaut, le panneau est masqué
                toggleFilterPanel(false);
            }
            
            // S'abonner aux événements
            MarketplaceMediator.subscribe('componentsLoaded', onComponentsLoaded);
            MarketplaceMediator.subscribe('setInstalledOnlyFilter', onSetInstalledOnlyFilter);
            
            // Publier un événement pour indiquer que le module est prêt
            MarketplaceMediator.publish('filtersModuleReady', {});
        } catch (error) {
            console.error("Erreur lors de l'initialisation du système de filtrage:", error);
        }
    }
    
    /**
     * Gère l'événement lorsque des composants sont chargés
     * @param {Object} data - Données de l'événement
     */
    function onComponentsLoaded(data) {
        // Extraire les filtres des composants chargés
        if (data && data.components) {
            extractFilters(data.components);
        }
    }
    
    /**
     * Gère l'événement lorsque le filtre "N'afficher que les composants installés" change
     * @param {Object} data - Données de l'événement
     */
    function onSetInstalledOnlyFilter(data) {
        if (data && typeof data.showInstalledOnly === 'boolean') {
            // Mettre à jour l'état
            state.showInstalledOnly = data.showInstalledOnly;
            
            // Appliquer les filtres
            applyFilters();
        }
    }
    
    /**
     * Crée l'interface utilisateur du panneau de filtres
     */
    function createFilterUI() {
        // Vérifier si l'élément tabs existe
        const tabsContainer = document.querySelector('.marketplace-tabs');
        if (!tabsContainer) {
            console.warn("Impossible de trouver le conteneur d'onglets pour ajouter les filtres");
            return;
        }
        
        // Création de la barre de filtres horizontale
        filterBar = document.createElement('div');
        filterBar.className = 'filter-bar';
        
        // Conteneur pour les puces de filtres
        filterChipsContainer = document.createElement('div');
        filterChipsContainer.className = 'filter-chips-container';
        
        // Bouton de filtres
        filterToggle = document.createElement('div');
        filterToggle.className = 'filter-toggle';
        filterToggle.innerHTML = '<i class="fas fa-filter"></i> Filtres';
        
        // Assemblage de la barre de filtres
        filterBar.appendChild(filterChipsContainer);
        
        // Repositionner la barre de recherche dans la barre de filtres
        const searchContainer = document.querySelector('.marketplace-search');
        if (searchContainer) {
            filterBar.appendChild(searchContainer);
            filterBar.appendChild(filterToggle);
        } else {
            filterBar.appendChild(filterToggle);
        }
        
        // Insérer la barre de filtres après les onglets
        tabsContainer.insertAdjacentElement('afterend', filterBar);
        
        // Création du panneau de filtres latéral
        filterPanel = document.createElement('div');
        filterPanel.className = 'filter-panel';
        filterPanel.id = 'marketplace-filter-panel';
        
        // Création de l'overlay
        filterOverlay = document.createElement('div');
        filterOverlay.className = 'filter-overlay';
        
        // Création de l'en-tête du panneau
        const panelHeader = document.createElement('div');
        panelHeader.className = 'filter-panel-header';
        panelHeader.innerHTML = `
            <h3>Filtres</h3>
            <div class="filter-count">0 composants</div>
            <button class="filter-close"><i class="fas fa-times"></i></button>
        `;
        
        // Création des onglets de filtres
        filterTabs = document.createElement('div');
        filterTabs.className = 'filter-tabs';
        filterTabs.innerHTML = `
            <div class="filter-tab active" data-tab="categories">Catégories</div>
            <div class="filter-tab" data-tab="tags">Tags</div>
            <div class="filter-tab" data-tab="versions">Versions</div>
        `;
        
        // Conteneurs pour chaque type de filtre
        categoryContainer = document.createElement('div');
        categoryContainer.className = 'filter-tab-content active';
        categoryContainer.setAttribute('data-content', 'categories');
        
        tagContainer = document.createElement('div');
        tagContainer.className = 'filter-tab-content';
        tagContainer.setAttribute('data-content', 'tags');
        
        versionContainer = document.createElement('div');
        versionContainer.className = 'filter-tab-content';
        versionContainer.setAttribute('data-content', 'versions');
        
        // Nous avons supprimé la référence à installedContainer
        
        // Bouton pour effacer tous les filtres
        clearFiltersBtn = document.createElement('button');
        clearFiltersBtn.className = 'clear-filters-btn';
        clearFiltersBtn.innerHTML = 'Effacer tous les filtres';
        clearFiltersBtn.style.display = 'none';
        
        // Assemblage du panneau
        filterPanel.appendChild(panelHeader);
        filterPanel.appendChild(filterTabs);
        filterPanel.appendChild(categoryContainer);
        filterPanel.appendChild(tagContainer);
        filterPanel.appendChild(versionContainer);
        // Nous avons supprimé cette ligne
        filterPanel.appendChild(clearFiltersBtn);
        
        // Ajout au DOM
        document.body.appendChild(filterOverlay);
        document.body.appendChild(filterPanel);
            
        // Mise à jour du compteur de composants
        componentCount = panelHeader.querySelector('.filter-count');
        
        // Marquer comme initialisé
        domInitialized = true;
    }
    
    /**
     * Attache les gestionnaires d'événements aux éléments de l'interface
     */
    function attachEventListeners() {
        if (!domInitialized) return;
        
        // Basculement du panneau de filtres
        filterToggle.addEventListener('click', () => {
            toggleFilterPanel();
        });
        
        // Fermeture du panneau
        const closeBtn = filterPanel.querySelector('.filter-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toggleFilterPanel(false);
            });
        }
        
        // Clic sur l'overlay ferme le panneau
        filterOverlay.addEventListener('click', () => {
            toggleFilterPanel(false);
        });
        
        // Gestion des onglets
        const tabs = filterTabs.querySelectorAll('.filter-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabType = e.target.getAttribute('data-tab');
                activateTab(tabType);
            });
        });
        
        // Effacer tous les filtres
        clearFiltersBtn.addEventListener('click', clearAllFilters);
        
        // Recherche
        const searchInput = document.getElementById('search-components');
        if (searchInput) {
            searchInput.addEventListener('input', utils.debounce(function() {
                state.searchTerm = this.value.toLowerCase();
                applyFilters();
            }, 300));
        }
    }
    
    /**
     * Bascule l'affichage du panneau de filtres
     * @param {boolean} [show] - Force l'état d'affichage si spécifié
     */
    function toggleFilterPanel(show) {
        if (!domInitialized) return;
        
        state.showFilters = show !== undefined ? show : !state.showFilters;
        
        if (state.showFilters) {
            filterPanel.classList.add('active');
            filterToggle.classList.add('active');
            filterOverlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Empêcher le défilement du body
        } else {
            filterPanel.classList.remove('active');
            filterToggle.classList.remove('active');
            filterOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Restaurer le défilement
        }
    }
    
    /**
     * Active un onglet spécifique dans le panneau de filtres
     * @param {string} tabType - Le type d'onglet à activer (categories, tags, versions)
     */
    function activateTab(tabType) {
        if (!domInitialized) return;
        
        // Désactiver tous les onglets
        const tabs = filterTabs.querySelectorAll('.filter-tab');
        tabs.forEach(tab => tab.classList.remove('active'));
        
        // Masquer tous les contenus d'onglet
        const contents = filterPanel.querySelectorAll('.filter-tab-content');
        contents.forEach(content => content.classList.remove('active'));
        
        // Activer l'onglet sélectionné
        const selectedTab = filterTabs.querySelector(`.filter-tab[data-tab="${tabType}"]`);
        if (selectedTab) selectedTab.classList.add('active');
        
        // Afficher le contenu sélectionné
        const selectedContent = filterPanel.querySelector(`.filter-tab-content[data-content="${tabType}"]`);
        if (selectedContent) selectedContent.classList.add('active');
    }
    
    /**
     * Extrait les filtres disponibles à partir des données des composants
     * @param {Array} components - Liste des composants
     */
    function extractFilters(components) {
        if (!domInitialized) {
            setTimeout(() => extractFilters(components), 500);
            return;
        }
        
        if (!components || !components.length) {
            return;
        }
        
        const categories = new Set();
        const tags = new Set();
        const versions = new Set();
        
        // Extraction des valeurs uniques
        components.forEach(component => {
            // Catégories
            if (component.category) {
                categories.add(component.category);
            }
            
            // Tags
            if (component.tagsArray && Array.isArray(component.tagsArray)) {
                component.tagsArray.forEach(tag => tags.add(tag));
            }
            
            // Versions
            if (component.version) {
                versions.add(component.version);
            }
        });
        
        // Mise à jour de l'état
        state.availableFilters = {
            categories: Array.from(categories).sort(),
            tags: Array.from(tags).sort(),
            versions: Array.from(versions).sort((a, b) => utils.compareVersions(b, a))
        };
        
        // Mise à jour de l'interface
        renderFilterOptions();
    }
    
    /**
     * Affiche les options de filtres dans le panneau
     */
    function renderFilterOptions() {
        if (!domInitialized) return;
        
        // Rendu des catégories
        renderFilterSection(categoryContainer, 'categories', state.availableFilters.categories);
        
        // Rendu des tags
        renderFilterSection(tagContainer, 'tags', state.availableFilters.tags);
        
        // Rendu des versions
        renderFilterSection(versionContainer, 'versions', state.availableFilters.versions);
        
        // Mise à jour des puces de filtres
        renderFilterChips();
    }
    
    /**
     * Affiche une section de filtres spécifique
     * @param {HTMLElement} container - Le conteneur à remplir
     * @param {string} filterType - Le type de filtre
     * @param {Array} options - Les options disponibles
     */
    function renderFilterSection(container, filterType, options) {
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!options || options.length === 0) {
            container.innerHTML = '<div class="filter-empty">Aucune option disponible</div>';
            return;
        }
        
        const filterList = document.createElement('div');
        filterList.className = 'filter-list';
        
        options.forEach(option => {
            const isActive = state.activeFilters[filterType].includes(option);
            
            const filterItem = document.createElement('div');
            filterItem.className = `filter-item ${isActive ? 'active' : ''}`;
            filterItem.setAttribute('data-value', option);
            filterItem.setAttribute('data-type', filterType);
            
            // Icône pour l'état du filtre
            const checkIcon = isActive ? '<i class="fas fa-check-square"></i>' : '<i class="far fa-square"></i>';
            
            filterItem.innerHTML = `
                ${checkIcon}
                <span class="filter-label">${option}</span>
                <span class="filter-item-count"></span>
            `;
            
            // Gestionnaire d'événement pour activer/désactiver le filtre
            filterItem.addEventListener('click', () => {
                toggleFilter(filterType, option);
            });
            
            filterList.appendChild(filterItem);
        });
        
        container.appendChild(filterList);
    }
    
    /**
     * Affiche les puces de filtres actifs dans la barre horizontale
     */
    function renderFilterChips() {
        if (!domInitialized || !filterChipsContainer || !clearFiltersBtn) return;
        
        // Vider le conteneur
        filterChipsContainer.innerHTML = '';
        
        // Extraction de tous les filtres actifs
        const allActiveFilters = [
            ...state.activeFilters.categories.map(cat => ({ type: 'categories', value: cat })),
            ...state.activeFilters.tags.map(tag => ({ type: 'tags', value: tag })),
            ...state.activeFilters.versions.map(ver => ({ type: 'versions', value: ver }))
            // Le champ 'installed' a été supprimé
        ];
        
        // Mise à jour du nombre de filtres actifs sur le bouton
        updateFilterBadge(allActiveFilters.length);
        
        // Afficher/masquer le bouton d'effacement
        if (allActiveFilters.length === 0) {
            if (clearFiltersBtn) clearFiltersBtn.style.display = 'none';
        } else {
            if (clearFiltersBtn) clearFiltersBtn.style.display = 'block';
        }
        
        // Génération des puces de filtres
        allActiveFilters.forEach(filter => {
            const filterChip = document.createElement('div');
            filterChip.className = 'filter-chip';
            filterChip.setAttribute('data-type', filter.type);
            filterChip.setAttribute('data-value', filter.value);
            
            // Déterminer la classe CSS en fonction du type de filtre
            let chipClass = '';
            switch (filter.type) {
                case 'categories':
                    chipClass = 'category';
                    break;
                case 'tags':
                    chipClass = 'tag';
                    break;
                case 'versions':
                    chipClass = 'version';
                    break;
            }
            
            filterChip.classList.add(chipClass);
            
            // Type de filtre et valeur
            let typeLabel = '';
            switch (filter.type) {
                case 'categories':
                    typeLabel = 'Catégorie:';
                    break;
                case 'tags':
                    typeLabel = 'Tag:';
                    break;
                case 'versions':
                    typeLabel = 'Version:';
                    break;
            }
            
            filterChip.innerHTML = `
                <span class="filter-type">${typeLabel}</span>
                <span class="filter-value">${filter.value}</span>
                <button class="remove-filter"><i class="fas fa-times"></i></button>
            `;
            
            // Gestionnaire pour supprimer le filtre
            const removeBtn = filterChip.querySelector('.remove-filter');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Empêcher la propagation de l'événement
                toggleFilter(filter.type, filter.value);
            });
            
            filterChipsContainer.appendChild(filterChip);
        });
    }
    
    /**
     * Met à jour le badge de nombre de filtres actifs
     * @param {number} count - Nombre de filtres actifs
     */
    function updateFilterBadge(count) {
        // Supprimer l'ancien badge s'il existe
        const oldBadge = filterToggle.querySelector('.active-filter-count');
        if (oldBadge) {
            filterToggle.removeChild(oldBadge);
        }
        
        // Ajouter un nouveau badge si nécessaire
        if (count > 0) {
            const badge = document.createElement('span');
            badge.className = 'active-filter-count';
            badge.textContent = count.toString();
            filterToggle.appendChild(badge);
        }
    }
    
    /**
     * Active ou désactive un filtre
     * @param {string} filterType - Le type de filtre
     * @param {string} value - La valeur du filtre
     */
    function toggleFilter(filterType, value) {
        const index = state.activeFilters[filterType].indexOf(value);
        
        if (index === -1) {
            // Ajouter le filtre
            state.activeFilters[filterType].push(value);
        } else {
            // Retirer le filtre
            state.activeFilters[filterType].splice(index, 1);
        }
        
        // Mise à jour de l'interface
        renderFilterOptions();
        
        // Appliquer les filtres aux composants
        applyFilters();
    }
    
    /**
     * Efface tous les filtres actifs
     */
    function clearAllFilters() {
        state.activeFilters = {
            categories: [],
            tags: [],
            versions: [],
            installed: []
        };
        
        // Mise à jour de l'interface
        renderFilterOptions();
        
        // Appliquer les filtres aux composants
        applyFilters();
        
        // Fermer le panneau de filtres
        toggleFilterPanel(false);
    }
    
    /**
     * Applique les filtres actuels et notifie les autres modules
     */
    function applyFilters() {
        // Créer un objet avec tous les filtres actifs
        const filters = {
            ...state.activeFilters,
            searchTerm: state.searchTerm,
            showInstalledOnly: state.showInstalledOnly // Ajouter le filtre pour les composants installés
        };
        
        // Notifier du changement
        MarketplaceMediator.publish('filtersChanged', filters);
        
        // Mettre à jour le compteur
        updateComponentCount();
    }
    
    /**
     * Met à jour le compteur de composants affichés
     */
    function updateComponentCount() {
        // Obtenir le nombre de composants visibles
        const count = components.getVisibleComponentsCount();
        
        if (componentCount) {
            componentCount.textContent = `${count} composant${count > 1 ? 's' : ''}`;
        }
    }
    
    // API publique
    return {
        init,
        extractFilters,
        applyFilters,
        clearAllFilters,
        toggleFilterPanel
    };
});