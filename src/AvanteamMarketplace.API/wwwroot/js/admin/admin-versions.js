// admin-versions.js
// Gestion des versions de composants

// Déclaration des fonctions de suppression pour éviter les problèmes de référence
function confirmDeleteVersion(componentId, versionId) {
    deleteTarget = versionId;
    deleteType = "version";
    currentComponentId = componentId;
    
    $("#confirmDeleteMessage").html(`Êtes-vous sûr de vouloir supprimer la version <strong>${versionId}</strong> ? <br>Cette action est irréversible et supprimera également le package associé.<br>Note: Vous ne pouvez pas supprimer la version actuelle d'un composant.`);
    $("#confirmDeleteModal").css("display", "block");
}

function deleteVersion(componentId, versionId) {
    console.log(`Suppression de la version ${versionId} du composant ${componentId}`);
    
    // Désactiver le bouton de confirmation pour éviter les clics multiples
    $("#btnConfirmDelete").prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Suppression...');
    
    // Récupérer d'abord les détails de la version pour les préserver
    fetch(`${apiBaseUrl}/management/components/${componentId}/versions/${versionId}`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors de la récupération des détails de la version: ${response.status}`);
        }
        return response.json();
    })
    .then(versionDetails => {
        console.log("Détails de la version récupérés:", versionDetails);
        
        // Créer un nouvel objet avec les mêmes propriétés mais en marquant la version comme désactivée
        const updatedVersion = {
            Version: `Désactivé_${Math.floor(Date.now() / 1000)}`, // Marquer comme désactivé
            ChangeLog: versionDetails.changeLog || versionDetails.ChangeLog || "",
            MinPlatformVersion: versionDetails.minPlatformVersion || versionDetails.MinPlatformVersion || "",
            IsLatest: false // S'assurer que ce n'est pas marqué comme version actuelle
        };
        
        // Mettre à jour la version pour la "désactiver" logiquement
        return fetch(`${apiBaseUrl}/management/components/${componentId}/versions/${versionId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedVersion)
        });
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors de la suppression de la version: ${response.status}`);
        }
        
        $("#confirmDeleteModal").css("display", "none");
        $("#btnConfirmDelete").prop('disabled', false).html('Confirmer');
        
        // Afficher une notification de succès
        const successNotif = $(`<div class="alert alert-success">
            <i class="fas fa-check-circle"></i> Version supprimée avec succès
        </div>`);
        $(".admin-header").after(successNotif);
        setTimeout(() => successNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
        
        // Recharger la liste des versions
        loadComponentVersions(componentId);
    })
    .catch(error => {
        console.error("Erreur:", error);
        
        // Réinitialiser le bouton
        $("#btnConfirmDelete").prop('disabled', false).html('Confirmer');
        
        // Fermer la modal de confirmation
        $("#confirmDeleteModal").css("display", "none");
        
        // Tenter d'extraire un message d'erreur plus utile
        let errorMessage = error.message;
        
        // Afficher une notification d'erreur
        const errorNotif = $(`<div class="alert alert-danger">
            <i class="fas fa-exclamation-circle"></i> Erreur lors de la suppression de la version: ${errorMessage}
        </div>`);
        $(".admin-header").after(errorNotif);
        setTimeout(() => errorNotif.fadeOut(2000, function() { $(this).remove(); }), 8000);
    });
}

function showVersionPanel(componentId, componentName) {
    currentComponentId = componentId;
    $("#versionComponentName").text(componentName);
    loadComponentVersions(componentId);
    loadComponentUsage(componentId);
    $("#versionManagementPanel").addClass("active");
}

function hideVersionPanel() {
    $("#versionManagementPanel").removeClass("active");
    currentComponentId = null;
}

function loadComponentVersions(componentId) {
    // Ajouter un indicateur de chargement
    const versionsTable = document.querySelector('#versionsTable tbody');
    versionsTable.innerHTML = '<tr><td colspan="6" class="text-center">Chargement des versions...</td></tr>';
    
    fetch(`${apiBaseUrl}/management/components/${componentId}/versions`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        },
        // Ajouter un paramètre pour éviter la mise en cache
        cache: 'no-store'
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors du chargement des versions: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Debug: Afficher la réponse complète de l'API
        console.log("Réponse API versions (brute):", data);
        
        // Nettoyer le tableau
        versionsTable.innerHTML = '';
        
        // Extraire les versions en gérant tous les formats possibles
        let versions = [];
        
        if (Array.isArray(data)) {
            versions = data;
        } else if (data && data.$values) {
            versions = data.$values;
        } else if (data && data.versions) {
            if (Array.isArray(data.versions)) {
                versions = data.versions;
            } else if (data.versions.$values) {
                versions = data.versions.$values;
            }
        } else {
            console.warn("Format de données inconnu:", data);
        }
        
        // Debug: Afficher les versions extraites
        console.log("Versions extraites:", versions);
        
        if (versions.length === 0) {
            versionsTable.innerHTML = '<tr><td colspan="6" class="text-center">Aucune version trouvée</td></tr>';
            return;
        }
        
        // Filtrer les versions logiquement supprimées (préfixées par "Désactivé_")
        versions = versions.filter(version => {
            const versionString = version.versionNumber || version.version || version.Version || "";
            return !String(versionString).startsWith("Désactivé_");
        });
        
        if (versions.length === 0) {
            versionsTable.innerHTML = '<tr><td colspan="6" class="text-center">Aucune version active trouvée</td></tr>';
            return;
        }
        
        versions.forEach(version => {
            // Normaliser la version pour extraire le numéro de version de l'URL si nécessaire
            if ((!version.version && !version.versionNumber && !version.Version) && 
                version.packageUrl && typeof version.packageUrl === 'string') {
                
                // Tenter d'extraire le numéro de version de l'URL du package
                const urlVersionMatch = version.packageUrl.match(/[^a-zA-Z0-9](\d+\.\d+(\.\d+)?)\.zip$/);
                if (urlVersionMatch && urlVersionMatch[1]) {
                    version.version = urlVersionMatch[1];
                    version.versionNumber = urlVersionMatch[1];
                    version.Version = urlVersionMatch[1];
                }
            }
            
            // Vérifier tous les noms de propriétés possibles pour les valeurs clés
            // Version number - différentes possibilités de nommage
            let versionNumber = "N/A";
            if (version.versionNumber !== undefined && version.versionNumber !== null) {
                versionNumber = version.versionNumber;
            } else if (version.version !== undefined && version.version !== null) {
                versionNumber = version.version;
            } else if (version.Version !== undefined && version.Version !== null) {
                versionNumber = version.Version;
            }
            
            // Date de publication
            let releaseDate = "N/A";
            if (version.releaseDate) {
                releaseDate = new Date(version.releaseDate).toLocaleDateString();
            } else if (version.ReleaseDate) {
                releaseDate = new Date(version.ReleaseDate).toLocaleDateString();
            } else if (version.createdDate) {
                releaseDate = new Date(version.createdDate).toLocaleDateString();
            } else if (version.CreatedDate) {
                releaseDate = new Date(version.CreatedDate).toLocaleDateString();
            }
            
            // Version minimale de la plateforme - Analyse complète de toutes les propriétés possibles
            let minPlatformVersion = "N/A";
            
            // Fonction pour extraire la propriété de façon plus robuste
            const extractProperty = (obj, propNames) => {
                // Créer une liste de toutes les variantes de casse possibles
                const allKeys = Object.keys(obj);
                
                // Debug: Afficher toutes les clés disponibles dans l'objet version
                console.log(`Version ${versionNumber} - Toutes les clés disponibles:`, allKeys);
                
                // Chercher parmi les clés connues d'abord
                for (const prop of propNames) {
                    if (obj[prop] !== undefined && obj[prop] !== null && obj[prop] !== "") {
                        return obj[prop];
                    }
                }
                
                // Recherche insensible à la casse en dernier recours
                const normalizedPropName = "minplatformversion"; // Version minuscule sans espaces
                for (const key of allKeys) {
                    if (key.toLowerCase().replace(/[-_\s]/g, "") === normalizedPropName) {
                        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
                            return obj[key];
                        }
                    }
                }
                
                return null;
            };
            
            // Liste des noms de propriétés possibles pour MinPlatformVersion
            const possiblePropNames = [
                "minPlatformVersion", 
                "MinPlatformVersion", 
                "minplatformversion",
                "min-platform-version",
                "min_platform_version",
                "MINPLATFORMVERSION"
            ];
            
            // Extraire la valeur
            const extractedValue = extractProperty(version, possiblePropNames);
            if (extractedValue !== null) {
                minPlatformVersion = extractedValue;
                console.log(`Version ${versionNumber} - MinPlatformVersion trouvé:`, minPlatformVersion);
            } else {
                console.warn(`Version ${versionNumber} - MinPlatformVersion non trouvé`);
            }
            
            // Nombre de téléchargements
            const downloadCount = version.downloadCount || version.DownloadCount || 0;
            
            // Version actuelle
            const isLatest = version.isLatest === true || version.IsLatest === true;
            
            // ID de la version
            const versionId = version.versionId || version.id || version.Id || version.VersionId;
            
            // Création de la ligne
            // Debug: Afficher les valeurs pour chaque ligne avant de créer le HTML
            console.log(`Création de ligne pour version ${versionNumber}:`, {
                versionNumber,
                releaseDate,
                minPlatformVersion,
                downloadCount,
                isLatest,
                versionId
            });
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${versionNumber}</td>
                <td>${releaseDate}</td>
                <td>${minPlatformVersion}</td>
                <td>${version.maxPlatformVersion || version.MaxPlatformVersion || "N/A"}</td>
                <td>${downloadCount}</td>
                <td>${isLatest ? '<span class="is-latest-badge">Actuelle</span>' : ''}</td>
                <td class="action-buttons">
                    <a href="#" class="action-btn action-btn-edit-version" data-id="${versionId}">Modifier</a>
                    <a href="#" class="action-btn action-btn-set-latest" data-id="${versionId}" ${isLatest ? 'style="display:none"' : ''}>Définir comme actuelle</a>
                    <a href="#" class="action-btn action-btn-delete-version" data-id="${versionId}" ${isLatest ? 'style="display:none"' : ''}>Supprimer</a>
                </td>
            `;
            versionsTable.appendChild(row);
        });
        
        // Ajouter les gestionnaires d'événements
        document.querySelectorAll('.action-btn-edit-version').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const versionId = this.getAttribute('data-id');
                editVersion(versionId);
            });
        });
        
        document.querySelectorAll('.action-btn-set-latest').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const versionId = this.getAttribute('data-id');
                setLatestVersion(componentId, versionId);
            });
        });
        
        document.querySelectorAll('.action-btn-delete-version').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const versionId = this.getAttribute('data-id');
                confirmDeleteVersion(componentId, versionId);
            });
        });
    })
    .catch(error => {
        console.error('Erreur lors du chargement des versions:', error);
        versionsTable.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Erreur: ${error.message}</td></tr>`;
    });
}

function loadComponentUsage(componentId) {
    // Afficher un message de chargement
    const usageList = document.querySelector('#clientsUsageList');
    usageList.innerHTML = '<div class="loading">Chargement des données d\'utilisation...</div>';
    
    // Récupérer toutes les versions actives du composant
    fetch(`${apiBaseUrl}/management/components/${componentId}/versions`, {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur lors du chargement des versions: ${response.status}`);
        }
        return response.json();
    })
    .then(async data => {
        // Extraire les versions (gérer différents formats possibles)
        let versions = [];
        
        if (Array.isArray(data)) {
            versions = data;
        } else if (data && data.$values) {
            versions = data.$values;
        } else if (data && data.versions) {
            if (Array.isArray(data.versions)) {
                versions = data.versions;
            } else if (data.versions.$values) {
                versions = data.versions.$values;
            }
        }
        
        // Filtrer les versions désactivées
        versions = versions.filter(version => {
            const versionString = version.versionNumber || version.version || version.Version || "";
            return !String(versionString).startsWith("Désactivé_");
        });
        
        if (versions.length === 0) {
            usageList.innerHTML = '<p>Aucune version active trouvée pour ce composant.</p>';
            return;
        }
        
        // Ajouter un champ de recherche
        let usageHTML = `
            <div class="usage-filter">
                <input type="text" id="clientFilter" class="search-input custom-search" placeholder="Filtrer par client ou version PS..." />
            </div>
            <table class="admin-table usage-table" id="usageTable">
                <thead>
                    <tr>
                        <th>Version</th>
                        <th>Clients utilisant cette version</th>
                        <th>Version PS</th>
                        <th>Dernière mise à jour</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Récupérer les clients pour chaque version
        const fetchPromises = versions.map(async (version) => {
            // Normaliser le numéro de version
            const versionNumber = version.versionNumber || version.version || version.Version || "";
            if (!versionNumber || versionNumber.startsWith("Désactivé_")) {
                return null; // Ignorer les versions invalides ou désactivées
            }
            
            try {
                const response = await fetch(`${apiBaseUrl}/management/components/${componentId}/versions/${encodeURIComponent(versionNumber)}/clients`, {
                    headers: {
                        'Authorization': `Bearer ${adminToken}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Erreur lors du chargement des clients pour la version ${versionNumber}`);
                }
                
                const clientsData = await response.json();
                
                // Vérifier si nous avons un tableau de clients
                let clients = [];
                if (Array.isArray(clientsData)) {
                    clients = clientsData;
                } else if (clientsData && clientsData.$values) {
                    clients = clientsData.$values;
                }
                
                // Déterminer la date de dernière mise à jour (la plus récente parmi tous les clients)
                let lastUpdate = "N/A";
                if (clients.length > 0) {
                    const latestDate = clients.reduce((latest, client) => {
                        const updateDate = client.lastUpdateDate || client.LastUpdateDate;
                        if (!updateDate) return latest;
                        
                        const date = new Date(updateDate);
                        return date > latest ? date : latest;
                    }, new Date(0));
                    
                    if (latestDate.getTime() > 0) {
                        lastUpdate = latestDate.toLocaleDateString();
                    }
                }
                
                // Générer l'HTML pour cette version
                // Stocker tous les détails des clients pour le filtrage ultérieur
                const clientData = clients.map(client => {
                    const clientId = client.clientIdentifier || client.ClientIdentifier || "";
                    const clientUrl = client.clientName || client.ClientName || clientId;
                    const clientPlatform = client.platformVersion || client.PlatformVersion || "N/A";
                    return {
                        id: clientId,
                        url: clientUrl,
                        platform: clientPlatform,
                        element: `<span class="client-badge" data-client-id="${clientId}" data-platform="${clientPlatform}" title="${clientId}">${clientUrl}</span>`
                    };
                });
                
                const clientsList = clients.length > 0 
                    ? clientData.map(client => client.element).join(" ")
                    : "<em>Aucun client n'utilise cette version</em>";
                
                // Collecter les versions PS uniques
                const platformVersions = [...new Set(clients.map(c => c.platformVersion || c.PlatformVersion || "N/A"))].join(", ");
                
                return {
                    versionNumber,
                    html: `
                        <tr class="version-row" data-version="${versionNumber}">
                            <td><strong>${versionNumber}</strong></td>
                            <td class="clients-list">
                                ${clientsList}
                                <span class="client-count">(${clients.length} client${clients.length !== 1 ? 's' : ''})</span>
                            </td>
                            <td>${platformVersions}</td>
                            <td>${lastUpdate}</td>
                        </tr>
                    `,
                    clientCount: clients.length,
                    clients: clientData
                };
            } catch (error) {
                console.error(`Erreur pour la version ${versionNumber}:`, error);
                return {
                    versionNumber,
                    html: `
                        <tr class="version-row" data-version="${versionNumber}">
                            <td><strong>${versionNumber}</strong></td>
                            <td class="text-danger">Erreur lors du chargement des données</td>
                            <td>N/A</td>
                            <td>N/A</td>
                        </tr>
                    `,
                    clientCount: 0,
                    clients: []
                };
            }
        });
        
        // Attendre que toutes les requêtes soient terminées
        const results = await Promise.all(fetchPromises);
        
        // Trier les résultats par nombre de clients (décroissant)
        results.sort((a, b) => {
            if (!a) return 1;
            if (!b) return -1;
            return b.clientCount - a.clientCount;
        });
        
        // Ajouter chaque ligne à la table
        results.forEach(result => {
            if (result) {
                usageHTML += result.html;
            }
        });
        
        // Fermer la table
        usageHTML += `
                </tbody>
            </table>
        `;
        
        // Calculer des statistiques
        const totalClients = results.reduce((total, result) => total + (result ? result.clientCount : 0), 0);
        const versionsWithClients = results.filter(r => r && r.clientCount > 0).length;
        
        // Préparer les données pour le graphique
        const chartData = results.filter(r => r && r.clientCount > 0).map(r => ({
            version: r.versionNumber,
            clients: r.clientCount
        }));
        
        // Ajouter un résumé avec graphique
        usageHTML = `
            <div class="usage-summary">
                <div class="usage-stat">
                    <span class="stat-number">${totalClients}</span>
                    <span class="stat-label">installations actives</span>
                </div>
                <div class="usage-stat">
                    <span class="stat-number">${versionsWithClients}</span>
                    <span class="stat-label">versions utilisées</span>
                </div>
                <div class="usage-stat">
                    <span class="stat-number">${versions.length}</span>
                    <span class="stat-label">versions disponibles</span>
                </div>
            </div>
        ` + usageHTML + `
            <div class="usage-chart-container">
                <h4>Répartition des versions par client</h4>
                <div id="versionsChart" style="height: 250px; width: 100%;"></div>
            </div>
        `;
        
        // Fonction pour générer le graphique après le chargement du DOM
        window.generateVersionsChart = function() {
            // Vérifier que les données sont disponibles
            if (!chartData || chartData.length === 0) {
                document.getElementById('versionsChart').innerHTML = '<p class="text-center">Aucune donnée disponible pour le graphique</p>';
                return;
            }
            
            // Créer un tableau de couleurs pour les versions
            const colors = [
                '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
                '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
            ];
            
            // Préparer le conteneur
            const chartContainer = document.getElementById('versionsChart');
            chartContainer.innerHTML = '';
            
            // Calculer les dimensions
            const containerWidth = chartContainer.clientWidth;
            const containerHeight = chartContainer.clientHeight;
            const margin = { top: 20, right: 30, bottom: 50, left: 50 };
            const width = containerWidth - margin.left - margin.right;
            const height = containerHeight - margin.top - margin.bottom;
            
            // Créer le SVG
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', containerWidth);
            svg.setAttribute('height', containerHeight);
            chartContainer.appendChild(svg);
            
            // Groupe principal avec marge
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', `translate(${margin.left},${margin.top})`);
            svg.appendChild(g);
            
            // Échelle X (versions)
            const xScale = chartData.map((d, i) => i * (width / chartData.length) + (width / chartData.length) / 2);
            
            // Échelle Y (nombre de clients)
            const maxClients = Math.max(...chartData.map(d => d.clients));
            const yScale = value => height - (value / maxClients) * height;
            
            // Axe X (versions)
            const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            xAxis.setAttribute('transform', `translate(0,${height})`);
            g.appendChild(xAxis);
            
            // Ajouter les ticks sur l'axe X
            chartData.forEach((d, i) => {
                const tick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                tick.setAttribute('x', xScale[i]);
                tick.setAttribute('y', 20);
                tick.setAttribute('text-anchor', 'middle');
                tick.setAttribute('font-size', '12px');
                tick.textContent = d.version;
                xAxis.appendChild(tick);
                
                // Ligne verticale de grille
                const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                gridLine.setAttribute('x1', xScale[i]);
                gridLine.setAttribute('x2', xScale[i]);
                gridLine.setAttribute('y1', 0);
                gridLine.setAttribute('y2', height);
                gridLine.setAttribute('stroke', '#e0e0e0');
                gridLine.setAttribute('stroke-width', '1');
                gridLine.setAttribute('stroke-dasharray', '3,3');
                g.appendChild(gridLine);
            });
            
            // Ligne horizontale
            const horizontalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            horizontalLine.setAttribute('x1', 0);
            horizontalLine.setAttribute('x2', width);
            horizontalLine.setAttribute('y1', height);
            horizontalLine.setAttribute('y2', height);
            horizontalLine.setAttribute('stroke', '#333');
            horizontalLine.setAttribute('stroke-width', '1');
            g.appendChild(horizontalLine);
            
            // Axe Y (nombre de clients)
            const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.appendChild(yAxis);
            
            // Ajouter les ticks sur l'axe Y
            const yTicks = 5;
            for (let i = 0; i <= yTicks; i++) {
                const value = Math.round((i / yTicks) * maxClients);
                const y = yScale(value);
                
                const tick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                tick.setAttribute('x', -10);
                tick.setAttribute('y', y + 5);
                tick.setAttribute('text-anchor', 'end');
                tick.setAttribute('font-size', '12px');
                tick.textContent = value;
                yAxis.appendChild(tick);
                
                // Ligne horizontale de grille
                const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                gridLine.setAttribute('x1', 0);
                gridLine.setAttribute('x2', width);
                gridLine.setAttribute('y1', y);
                gridLine.setAttribute('y2', y);
                gridLine.setAttribute('stroke', '#e0e0e0');
                gridLine.setAttribute('stroke-width', '1');
                gridLine.setAttribute('stroke-dasharray', '3,3');
                g.appendChild(gridLine);
            }
            
            // Ligne verticale
            const verticalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            verticalLine.setAttribute('x1', 0);
            verticalLine.setAttribute('x2', 0);
            verticalLine.setAttribute('y1', 0);
            verticalLine.setAttribute('y2', height);
            verticalLine.setAttribute('stroke', '#333');
            verticalLine.setAttribute('stroke-width', '1');
            g.appendChild(verticalLine);
            
            // Titre de l'axe Y
            const yTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            yTitle.setAttribute('transform', 'rotate(-90)');
            yTitle.setAttribute('x', -height / 2);
            yTitle.setAttribute('y', -35);
            yTitle.setAttribute('text-anchor', 'middle');
            yTitle.setAttribute('font-size', '12px');
            yTitle.textContent = 'Nombre de clients';
            g.appendChild(yTitle);
            
            // Dessiner les barres
            chartData.forEach((d, i) => {
                const barWidth = width / chartData.length * 0.7;
                const barHeight = height - yScale(d.clients);
                const x = xScale[i] - barWidth / 2;
                const y = yScale(d.clients);
                
                const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bar.setAttribute('x', x);
                bar.setAttribute('y', y);
                bar.setAttribute('width', barWidth);
                bar.setAttribute('height', barHeight);
                bar.setAttribute('fill', colors[i % colors.length]);
                
                // Ajouter des bordures arrondies
                bar.setAttribute('rx', '3');
                bar.setAttribute('ry', '3');
                
                // Animation simple
                bar.style.transition = 'height 0.5s ease, y 0.5s ease';
                bar.style.transformOrigin = 'bottom';
                
                // Ajouter un titre au survol
                const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                title.textContent = `Version ${d.version}: ${d.clients} client${d.clients > 1 ? 's' : ''}`;
                bar.appendChild(title);
                
                // Ajouter le nombre au-dessus de la barre
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', x + barWidth / 2);
                text.setAttribute('y', y - 5);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '12px');
                text.setAttribute('font-weight', 'bold');
                text.textContent = d.clients;
                
                g.appendChild(bar);
                g.appendChild(text);
                
                // Effet de survol
                bar.addEventListener('mouseover', () => {
                    bar.setAttribute('fill-opacity', '0.8');
                    bar.style.cursor = 'pointer';
                });
                
                bar.addEventListener('mouseout', () => {
                    bar.setAttribute('fill-opacity', '1');
                });
                
                // Clic pour filtrer
                bar.addEventListener('click', () => {
                    const clientFilter = document.getElementById('clientFilter');
                    if (clientFilter) {
                        clientFilter.value = d.version;
                        clientFilter.dispatchEvent(new Event('input'));
                    }
                });
            });
        };
        
        // Ajouter les styles CSS pour le graphique
        const chartStyles = document.createElement('style');
        chartStyles.textContent = `
            .usage-chart-container {
                margin-bottom: 25px;
                background-color: #fff;
                border-radius: 5px;
                padding: 15px;
                border: 1px solid #eaeaea;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .usage-chart-container h4 {
                margin-top: 0;
                margin-bottom: 15px;
                text-align: center;
                color: #333;
            }
        `;
        document.head.appendChild(chartStyles);
        
        // Ajouter le CSS pour les badges de client et les statistiques
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .client-badge {
                display: inline-block;
                background-color: #e9f5ff;
                border: 1px solid #c2e0ff;
                border-radius: 4px;
                padding: 3px 8px;
                margin: 2px;
                font-size: 0.85em;
                color: #0066cc;
                transition: all 0.3s ease;
                white-space: nowrap;
                max-width: 300px;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .client-badge:hover {
                background-color: #d0e8ff;
                border-color: #99ccff;
                transform: translateY(-1px);
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                z-index: 10;
                position: relative;
                max-width: none;
            }
            .client-badge-match {
                background-color: #e8f5e9;
                border-color: #a5d6a7;
                color: #2e7d32;
                font-weight: bold;
            }
            .platform-match {
                background-color: #fff8e1;
                border-color: #ffecb3;
                color: #ff8f00;
                font-weight: bold;
            }
            .platform-version-match {
                background-color: #fff8e1;
                color: #ff8f00;
                font-weight: bold;
            }
            .client-badge-faded {
                opacity: 0.6;
            }
            .client-count {
                color: #666;
                font-size: 0.85em;
                margin-left: 5px;
            }
            .usage-summary {
                display: flex;
                justify-content: space-around;
                margin-bottom: 20px;
                background-color: #f9f9f9;
                border-radius: 5px;
                padding: 15px;
                border: 1px solid #eaeaea;
            }
            .usage-stat {
                text-align: center;
            }
            .stat-number {
                display: block;
                font-size: 1.8em;
                font-weight: bold;
                color: #2c7d32;
            }
            .stat-label {
                display: block;
                font-size: 0.85em;
                color: #666;
            }
            .usage-table {
                margin-top: 15px;
            }
            .clients-list {
                max-width: 500px;
                overflow-x: auto;
            }
            .usage-filter {
                margin-bottom: 15px;
                padding: 0 0 15px 0;
                border-bottom: 1px solid #eaeaea;
                position: relative;
            }
            .usage-filter input.custom-search {
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                background-color: #f8f8f8;
                background-image: none;
                transition: border-color 0.3s, box-shadow 0.3s;
            }
            .usage-filter input.custom-search:focus {
                border-color: #2c7d32;
                box-shadow: 0 0 0 3px rgba(44, 125, 50, 0.2);
                outline: none;
                background-image: none;
            }
        `;
        document.head.appendChild(styleElement);
        
        // Stocker toutes les données des clients pour le filtrage
        window.usageData = results;
        
        // Mettre à jour l'affichage
        usageList.innerHTML = usageHTML;
        
        // Générer le graphique après le chargement du DOM
        setTimeout(window.generateVersionsChart, 100);
        
        // Ajouter manuellement l'icône de recherche via JavaScript
        setTimeout(() => {
            const searchInput = document.getElementById('clientFilter');
            if (searchInput) {
                // Créer le conteneur pour l'icône et le champ
                const searchWrapper = document.createElement('div');
                searchWrapper.className = 'search-wrapper';
                searchWrapper.style.position = 'relative';
                searchWrapper.style.display = 'flex';
                searchWrapper.style.alignItems = 'center';
                
                // Créer l'icône de recherche
                const searchIcon = document.createElement('i');
                searchIcon.className = 'fas fa-search';
                searchIcon.style.position = 'absolute';
                searchIcon.style.left = '10px';
                searchIcon.style.color = '#888';
                searchIcon.style.pointerEvents = 'none';
                
                // Mettre à jour le style du champ de recherche
                searchInput.style.paddingLeft = '30px';
                
                // Remplacer le champ de recherche par notre wrapper contenant l'icône + champ
                searchInput.parentNode.insertBefore(searchWrapper, searchInput);
                searchWrapper.appendChild(searchIcon);
                searchWrapper.appendChild(searchInput);
            }
        }, 200);
        
        // Ajouter le gestionnaire d'événements pour le filtrage
        document.getElementById('clientFilter').addEventListener('input', function(e) {
            const filterText = e.target.value.toLowerCase();
            const tbody = document.querySelector('#usageTable tbody');
            const rows = tbody.querySelectorAll('.version-row');
            
            // Variable pour suivre si au moins une ligne correspond au filtre
            let hasMatch = false;
            
            // Parcourir toutes les lignes du tableau
            rows.forEach(row => {
                const versionNumber = row.getAttribute('data-version');
                const versionData = window.usageData.find(v => v.versionNumber === versionNumber);
                
                if (!versionData || !versionData.clients || versionData.clients.length === 0) {
                    // Masquer les versions sans clients
                    row.style.display = filterText ? 'none' : '';
                    return;
                }
                
                // Rechercher des clients correspondant au filtre (URL, ID ou version PS)
                const matchingClients = versionData.clients.filter(client => 
                    client.id.toLowerCase().includes(filterText) || 
                    client.url.toLowerCase().includes(filterText) ||
                    client.platform.toLowerCase().includes(filterText)
                );
                
                if (matchingClients.length > 0 || !filterText) {
                    row.style.display = ''; // Afficher cette ligne
                    hasMatch = true;
                    
                    // Si un filtre est appliqué, mettre en évidence les clients correspondants
                    if (filterText) {
                        const clientBadges = row.querySelectorAll('.client-badge');
                        // Vérifier si le filtre correspond à une version PS spécifique
                        const isPlatformFilter = row.querySelector('td:nth-child(3)').textContent.toLowerCase().includes(filterText);
                        
                        if (isPlatformFilter) {
                            // Mettre en évidence la cellule de la version PS
                            row.querySelector('td:nth-child(3)').classList.add('platform-version-match');
                        }
                        
                        clientBadges.forEach(badge => {
                            const clientId = badge.getAttribute('data-client-id');
                            const platform = badge.getAttribute('data-platform');
                            
                            // Vérifier si ce client correspond au filtre par ID/URL ou par version
                            const isClientMatch = matchingClients.some(c => c.id === clientId);
                            const isPlatformMatch = platform && platform.toLowerCase().includes(filterText);
                            
                            if (isClientMatch || isPlatformMatch) {
                                badge.classList.add('client-badge-match');
                                // Ajouter une classe spéciale si la correspondance est sur la version PS
                                if (isPlatformMatch) {
                                    badge.classList.add('platform-match');
                                }
                            } else {
                                badge.classList.remove('client-badge-match');
                                badge.classList.remove('platform-match');
                                badge.classList.add('client-badge-faded');
                            }
                        });
                    } else {
                        // Réinitialiser les styles si aucun filtre n'est appliqué
                        row.querySelector('td:nth-child(3)').classList.remove('platform-version-match');
                        const clientBadges = row.querySelectorAll('.client-badge');
                        clientBadges.forEach(badge => {
                            badge.classList.remove('client-badge-match');
                            badge.classList.remove('platform-match');
                            badge.classList.remove('client-badge-faded');
                        });
                    }
                } else {
                    row.style.display = 'none'; // Masquer cette ligne
                }
            });
            
            // Afficher un message si aucune correspondance n'est trouvée
            const noMatch = tbody.querySelector('.no-match-row');
            if (!hasMatch && filterText) {
                if (!noMatch) {
                    const newRow = document.createElement('tr');
                    newRow.className = 'no-match-row';
                    newRow.innerHTML = `<td colspan="4" class="text-center">Aucun client ou version PS ne correspond à "${filterText}"</td>`;
                    tbody.appendChild(newRow);
                }
            } else if (noMatch) {
                noMatch.remove();
            }
        });
    })
    .catch(error => {
        console.error('Erreur lors du chargement des données d\'utilisation:', error);
        usageList.innerHTML = `<div class="alert alert-danger">
            <i class="fas fa-exclamation-circle"></i> Erreur lors du chargement des données d'utilisation: ${error.message}
        </div>`;
    });
}

/**
 * Ouvre la modale d'édition de version avec les données de la version sélectionnée
 * @param {string|number} versionId - L'identifiant de la version à éditer
 */
function editVersion(versionId) {
    if (!versionId) {
        console.error("ID de version manquant pour l'édition");
        return;
    }
    
    console.log(`Édition de la version ID: ${versionId}`);
    
    // Utiliser showVersionModal avec l'ID de la version pour charger et éditer une version existante
    showVersionModal(versionId);
}

function showVersionModal(versionId = null) {
    console.log("Ouverture du modal version", versionId);
    
    // Réinitialiser tout état antérieur
    // Très important pour éviter les problèmes de chargement de fichier
    if (window.fileResetTimeout) {
        clearTimeout(window.fileResetTimeout);
    }
    
    // Nettoyer les affichages existants
    $("#selectedVersionFileName").text("");
    
    // Remplacer complètement l'élément input file pour éviter tout problème de sélection
    const fileInputContainer = $("#fileVersionPackage").parent();
    const oldFileInput = $("#fileVersionPackage");
    
    // Sauvegarder tous les attributs
    const attributes = {
        id: oldFileInput.attr('id'),
        accept: oldFileInput.attr('accept'),
        hidden: oldFileInput.prop('hidden')
    };
    
    // Remplacer l'élément
    oldFileInput.remove();
    const newFileInput = $('<input type="file">');
    Object.keys(attributes).forEach(key => {
        if (key === 'hidden') {
            newFileInput.prop(key, attributes[key]);
        } else {
            newFileInput.attr(key, attributes[key]);
        }
    });
    
    // Réinsérer le nouvel élément
    fileInputContainer.append(newFileInput);
    console.log("Input file remplacé pour éviter les problèmes de sélection");
    
    // Attendre un court instant pour que le DOM soit mis à jour avant de réinitialiser les gestionnaires
    setTimeout(() => {
        // Réattacher les gestionnaires d'événements
        initFileHandlers();
        console.log("Gestionnaires de fichiers réinitialisés pour le modal version");
    }, 200);
    
    // Mettre à jour la position de la modale pour être devant le panneau
    // Cela s'assure que la modale est affichée correctement même avec le panneau ouvert
    $("#versionModal").css("z-index", "2000");
    
    // Réinitialiser l'état du bouton de sauvegarde
    $("#btnSaveVersion").data('saving', false).prop('disabled', false);
    
    currentVersionId = versionId;
    
    if (versionId) {
        // Modification d'une version existante
        $('#versionModalTitle').text('Modifier la version');
        
        fetch(`${apiBaseUrl}/management/components/${currentComponentId}/versions/${versionId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        })
        .then(response => response.json())
        .then(data => {
            // Afficher les données reçues pour le débogage
            console.log("Données de version reçues pour édition:", data);
            
            $('#txtVersionNumber').val(data.versionNumber || data.Version || data.version || '');
            $('#txtVersionChangelog').val(data.changeLog || data.ChangeLog || data.changelog || '');
            
            // Gérer les différentes casses possibles pour minPlatformVersion
            const minPlatformVersion = data.minPlatformVersion || data.MinPlatformVersion || data.minplatformversion || '';
            $('#txtVersionMinPlatform').val(minPlatformVersion);
            
            // Gérer les différentes casses possibles pour maxPlatformVersion
            const maxPlatformVersion = data.maxPlatformVersion || data.MaxPlatformVersion || data.maxplatformversion || '';
            $('#txtVersionMaxPlatform').val(maxPlatformVersion);
            
            $('#chkIsLatestVersion').prop('checked', data.isLatest || data.IsLatest || false);
            
            // Effacer toute sélection de fichier précédente
            $('#selectedVersionFileName').text('');
            
            // Afficher la modal au premier plan
            $('#versionModal').css("z-index", "2000").show();
        })
        .catch(error => {
            console.error('Erreur lors du chargement des détails de la version:', error);
            alert('Erreur lors du chargement des détails de la version.');
        });
    } else {
        // Ajout d'une nouvelle version
        $('#versionModalTitle').text('Ajouter une version');
        $('#txtVersionNumber').val('');
        $('#txtVersionChangelog').val('');
        $('#txtVersionMinPlatform').val('');
        $('#txtVersionMaxPlatform').val('');
        $('#chkIsLatestVersion').prop('checked', true);
        $('#selectedVersionFileName').text('');
        
        // Afficher la modal au premier plan
        $('#versionModal').css("z-index", "2000").show();
    }
}

function hideVersionModal() {
    $('#versionModal').hide();
    currentVersionId = null;
}

function saveVersion() {
    // Bouton de sauvegarde
    const saveBtn = $("#btnSaveVersion");
    
    // Vérifier si le bouton est déjà en cours de sauvegarde
    if (saveBtn.data('saving')) {
        console.log("Sauvegarde déjà en cours, ignore l'événement");
        return;
    }
    
    console.log("Début de la fonction saveVersion");
    
    // Marquer le bouton comme en cours de sauvegarde
    saveBtn.data('saving', true);
    
    // Créer un objet avec les données du formulaire
    const versionData = {
        Version: $('#txtVersionNumber').val(),
        ChangeLog: $('#txtVersionChangelog').val(),
        MinPlatformVersion: $('#txtVersionMinPlatform').val(),
        MaxPlatformVersion: $('#txtVersionMaxPlatform').val(),
        IsLatest: $('#chkIsLatestVersion').is(':checked')
    };
    
    // Vérifier les données de base
    if (!versionData.Version || !versionData.Version.match(/^\d+\.\d+(\.\d+)?$/)) {
        alert('Veuillez saisir un numéro de version valide (format X.Y.Z)');
        saveBtn.data('saving', false);
        return;
    }
    
    // Afficher l'état de sauvegarde
    const originalText = saveBtn.text();
    saveBtn.html('<i class="fas fa-spinner fa-spin"></i> Enregistrement...');
    saveBtn.prop('disabled', true);
    
    const fileInput = document.getElementById('fileVersionPackage');
    const hasFile = fileInput.files && fileInput.files.length > 0;
    
    if (currentVersionId) {
        // Mise à jour d'une version existante
        fetch(`${apiBaseUrl}/management/components/${currentComponentId}/versions/${currentVersionId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(versionData)
        })
        .then(response => {
            if (response.ok) {
                hideVersionModal();
                loadComponentVersions(currentComponentId);
                
                // Afficher une notification de succès
                const successNotif = $(`<div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Version mise à jour avec succès
                </div>`);
                $(".admin-header").after(successNotif);
                setTimeout(() => successNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
            } else {
                return response.text().then(text => {
                    throw new Error('Erreur lors de la mise à jour de la version');
                });
            }
        })
        .catch(error => {
            alert('Erreur lors de la mise à jour de la version: ' + error.message);
        })
        .finally(() => {
            // Remettre le bouton à son état initial
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
        });
    } else {
        // Création d'une nouvelle version
        if (!hasFile) {
            alert('Veuillez sélectionner un fichier de package');
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
            return;
        }
        
        // Préparer les données du formulaire pour l'envoi
        const formData = new FormData();
        formData.append('packageFile', fileInput.files[0]);
        formData.append('version', versionData.Version);
        formData.append('changeLog', versionData.ChangeLog);
        formData.append('minPlatformVersion', versionData.MinPlatformVersion);
        formData.append('maxPlatformVersion', versionData.MaxPlatformVersion);
        formData.append('isLatest', versionData.IsLatest);
        
        // Téléversement avec timeout
        const xhr = new XMLHttpRequest();
        let uploadTimedOut = false;
        
        // Définir un timeout
        const timeoutDuration = 60000; // 60 secondes
        const timeoutId = setTimeout(() => {
            uploadTimedOut = true;
            xhr.abort();
            
            // Remettre le bouton à son état initial
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
            
            alert('Le téléversement a été interrompu car il prend trop de temps. Veuillez réessayer.');
        }, timeoutDuration);
        
        // Configurer la requête
        xhr.open('POST', `${apiBaseUrl}/management/components/${currentComponentId}/versions/with-package`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${adminToken}`);
        
        // Gérer la fin de la requête
        xhr.onload = function() {
            clearTimeout(timeoutId);
            
            if (xhr.status >= 200 && xhr.status < 300) {
                // Succès
                hideVersionModal();
                loadComponentVersions(currentComponentId);
                
                // Afficher une notification de succès
                const successNotif = $(`<div class="alert alert-success">
                    <i class="fas fa-check-circle"></i> Version créée avec succès
                </div>`);
                $(".admin-header").after(successNotif);
                setTimeout(() => successNotif.fadeOut(500, function() { $(this).remove(); }), 5000);
            } else {
                // Erreur
                alert('Erreur lors de la création de la version: ' + xhr.statusText);
            }
            
            // Remettre le bouton à son état initial
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
        };
        
        // Gérer les erreurs de réseau
        xhr.onerror = function() {
            clearTimeout(timeoutId);
            if (!uploadTimedOut) {
                alert('Erreur de connexion lors du téléversement');
            }
            
            // Remettre le bouton à son état initial
            saveBtn.html(originalText);
            saveBtn.prop('disabled', false);
            saveBtn.data('saving', false);
        };
        
        // Envoyer la requête
        xhr.send(formData);
    }
}

function setLatestVersion(componentId, versionId) {
    fetch(`${apiBaseUrl}/management/components/${componentId}/versions/${versionId}/setLatest`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    })
    .then(response => {
        if (response.ok) {
            loadComponentVersions(componentId);
            alert('Version définie comme actuelle avec succès');
        } else {
            throw new Error('Erreur lors de la définition de la version comme actuelle');
        }
    })
    .catch(error => {
        console.error('Erreur:', error);
        alert('Erreur lors de la définition de la version comme actuelle: ' + error.message);
    });
}

// Événements pour le panneau de gestion des versions
$(document).ready(function() {
    $("#closeVersionPanel").click(function(e) {
        e.preventDefault();
        hideVersionPanel();
    });
    
    $("#btnAddVersion").click(function() {
        showVersionModal();
    });
    
    $("#btnSaveVersion").click(function(e) {
        // Empêcher tout comportement de soumission qui pourrait causer un refresh
        e.preventDefault();
        e.stopPropagation();
        
        console.log("Bouton Enregistrer cliqué");
        
        // Appeler directement la fonction de sauvegarde
        saveVersion();
        
        return false; // Empêcher tout comportement par défaut
    });
    
    $("#btnCancelVersion").click(function() {
        hideVersionModal();
    });
});