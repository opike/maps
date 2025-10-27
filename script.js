(async function () {
  // Base map
  const map = L.map('map', { scrollWheelZoom: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // Target ZIPs
  const wanted = new Set(["85118", "85119", "85120", "85140", "85142", "85143", "85144", "85147", "85201", "85202", "85203", "85204", "85205", "85210", "85213", "85215", "85248", "85249", "85256", "85286"]);

  // Source: OpenDataDE state ZIP GeoJSON (derived from Census ZCTA shapefiles)
  const src = "https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/az_arizona_zip_codes_geo.min.json";

  // Fetch and filter features for our ZIPs
  let gj;
  try {
    const res = await fetch(src);
    gj = await res.json();
  } catch (e) {
    alert("Failed to load ZIP boundaries.\nPlease ensure you are online.\n" + e);
    return;
  }

  const features = (gj.features || []).filter(f => {
    const p = f.properties || {};
    const zip = p.ZCTA5CE10 || p.ZCTA5CE || p.zip || p.ZIPCODE || p.ZIP || p.postalCode;
    return zip && wanted.has(String(zip));
  });

  const colorMap = { 
    "85118": "#e41a1c", "85119": "#377eb8", "85120": "#4daf4a", "85140": "#984ea3", 
    "85142": "#ff7f00", "85143": "#c5b0d5", "85144": "#1f77b4", "85147": "#ff7f0e", "85201": "#2ca02c", 
    "85202": "#d62728", "85203": "#9467bd", "85204": "#8c564b", "85205": "#e377c2", 
    "85210": "#7f7f7f", "85213": "#bcbd22", "85215": "#17becf", "85248": "#aec7e8", 
    "85249": "#ffbb78", "85256": "#98df8a", "85286": "#ff9896" 
  };

  // Hard-coded mapping of ZIP codes to town/city names
  const zipTownMap = {
    "85118": "Gold Canyon",
    "85119": "Apache Junction",
    "85120": "Apache Junction",
    "85140": "Queen Creek/San Tan Valley",
    "85142": "Queen Creek/San Tan Valley",
    "85143": "San Tan Valley",
    "85144": "San Tan Valley",
    "85147": "Sacaton",
    "85201": "Mesa",
    "85202": "Mesa",
    "85203": "Mesa",
    "85204": "Mesa",
    "85205": "Mesa",
    "85210": "Mesa",
    "85213": "Mesa",
    "85215": "Mesa",
    "85248": "Chandler",
    "85249": "Chandler",
    "85256": "Scottsdale",
    "85286": "Chandler"
  };

  const layer = L.geoJSON(features, {
    style: f => ({
      color: "#222",
      weight: 1.5,
      fillColor: colorMap[String(
        (f.properties && (f.properties.ZCTA5CE10 || f.properties.ZCTA5CE || f.properties.zip || f.properties.ZIPCODE || f.properties.ZIP || f.properties.postalCode))
      )] || "#8e44ad",
      fillOpacity: 0.35
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const zip = p.ZCTA5CE10 || p.ZCTA5CE || p.zip || p.ZIPCODE || p.ZIP || p.postalCode || "ZIP";
      const name = zipTownMap[String(zip)] || "";
      
      layer.bindPopup(`<strong>ZIP ${zip}</strong>${name ? " – " + name : ""}`);
      
      // Handle click vs double-click to prevent popup during point creation
      let clickTimeout;
      
      layer.on('click', function(e) {
        // Clear any existing timeout
        clearTimeout(clickTimeout);
        
        // Set a timeout to show popup only if no double-click follows
        clickTimeout = setTimeout(function() {
          layer.openPopup(e.latlng);
        }, 300); // Wait 300ms to see if double-click occurs
        
        // Prevent the event from bubbling to the map
        L.DomEvent.stopPropagation(e);
      });
      
      layer.on('dblclick', function(e) {
        // Clear the click timeout to prevent popup from showing
        clearTimeout(clickTimeout);
        
        // Close any open popup
        layer.closePopup();
        
        // Prevent the event from bubbling to avoid double point creation
        L.DomEvent.stopPropagation(e);
      });
      
      
      // Add a lightweight label at the polygon's center
      try {
        const center = layer.getBounds().getCenter();
        L.tooltip({permanent:true, direction:'center', className:'zip-label'})
          .setContent(zip)
          .setLatLng(center)
          .addTo(map);
      } catch {}
    }
  }).addTo(map);

  // Fit to bounds
  if (features.length) {
    map.fitBounds(layer.getBounds(), { padding: [20,20] });
  } else {
    map.setView([33.3, -111.8], 10); // Arizona Phoenix metro area fallback
  }

  // Legend
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = `
      <div class="collapsible-header">
        <span class="header-title">Shaded ZIPs v8</span>
        <button class="collapse-button" onclick="toggleCollapse('legend')" id="legendCollapseButton" title="Collapse/Expand">−</button>
      </div>
      <div class="collapsible-content" id="legendContent">
        ${Object.entries(colorMap).map(([zip, color]) => {
          const townName = zipTownMap[zip] || '';
          const displayText = townName ? `${zip} - ${townName}` : zip;
          return `<div style="margin-bottom:2px;"><span style="display:inline-block;width:12px;height:12px;background:${color};border:1px solid #222;margin-right:6px;vertical-align:middle;"></span><span style="font-size:13px;">${displayText}</span></div>`;
        }).join('')}
        <div style="margin-top:.5rem;font-size:12px;color:#555;">Boundaries: OpenDataDE (Census ZCTA)</div>
      </div>
    `;
    return div;
  };
  legend.addTo(map);

  // Search functionality
  let searchMarkers = [];
  const SEARCH_HISTORY_KEY = 'mapSearchHistory';
  const MAX_SEARCH_HISTORY = 10;
  
  // Load search history from local storage
  function loadSearchHistory() {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Error loading search history:', e);
      return [];
    }
  }
  
  // Save search history to local storage
  function saveSearchHistory(history) {
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Error saving search history:', e);
    }
  }
  
  // Add search to history
  function addToSearchHistory(query) {
    if (!query || query.trim() === '') return;
    
    const history = loadSearchHistory();
    const trimmedQuery = query.trim();
    
    // Remove if already exists to avoid duplicates
    const filteredHistory = history.filter(item => item.toLowerCase() !== trimmedQuery.toLowerCase());
    
    // Add to beginning of array
    filteredHistory.unshift(trimmedQuery);
    
    // Keep only the most recent searches
    const limitedHistory = filteredHistory.slice(0, MAX_SEARCH_HISTORY);
    
    saveSearchHistory(limitedHistory);
    updateSearchHistoryDropdown();
  }
  
  // Update search history dropdown
  function updateSearchHistoryDropdown() {
    const dropdown = document.getElementById('searchHistoryDropdown');
    const history = loadSearchHistory();
    
    if (history.length === 0) {
      dropdown.innerHTML = '';
      dropdown.style.display = 'none';
      return;
    }
    
    dropdown.innerHTML = history.map(item => `
      <div class="search-history-item" onclick="selectSearchHistoryItem('${item.replace(/'/g, "\\'")}')">
        <span>${item}</span>
      </div>
    `).join('');
  }
  
  // Select search history item
  function selectSearchHistoryItem(query) {
    document.getElementById('searchInput').value = query;
    hideSearchHistoryDropdown();
    searchBusinesses();
  }
  

  // Show search history dropdown
  function showSearchHistoryDropdown() {
    const dropdown = document.getElementById('searchHistoryDropdown');
    const history = loadSearchHistory();
    if (history.length > 0) {
      updateSearchHistoryDropdown();
      dropdown.style.display = 'block';
    }
  }
  
  // Hide search history dropdown
  function hideSearchHistoryDropdown() {
    const dropdown = document.getElementById('searchHistoryDropdown');
    dropdown.style.display = 'none';
  }
  
  // Clear all search history
  function clearSearchHistory() {
    if (confirm('Clear all search history?')) {
      saveSearchHistory([]);
      updateSearchHistoryDropdown();
    }
  }
  
  // Clear search input and markers
  function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const clearButton = document.getElementById('searchClearButton');
    
    // Clear input
    searchInput.value = '';
    
    // Clear results
    searchResults.innerHTML = '';
    
    // Hide clear button
    clearButton.style.display = 'none';
    
    // Hide search history dropdown
    hideSearchHistoryDropdown();
    
    // Clear search markers from map
    searchMarkers.forEach(marker => map.removeLayer(marker));
    searchMarkers = [];
  }
  
  // Update clear button visibility
  function updateClearButtonVisibility() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('searchClearButton');
    
    if (searchInput.value.trim() !== '') {
      clearButton.style.display = 'flex';
    } else {
      clearButton.style.display = 'none';
    }
  }
  
  // Saved points functionality
  let savedMarkers = [];
  const STORAGE_KEY = 'mapSavedPoints_cloud';  // Cloud-synced points cached locally
  let currentPointsFilter = '';
  
  // GitHub repository configuration
  const GITHUB_REPO_URL = 'https://raw.githubusercontent.com/opike/maps/main/saved-points.json';
  const GITHUB_API_URL = 'https://api.github.com/repos/opike/maps/contents/saved-points.json';
  let githubToken = localStorage.getItem('githubToken') || '';
  
  // Check if user has edit permissions (has valid GitHub token)
  function hasEditPermission() {
    return !!githubToken && githubToken.trim().length > 0;
  }
  
  // Check if we're in read-only mode (no edit permission)
  function isReadOnlyMode() {
    return !hasEditPermission();
  }
  
  // Color groups configuration
  const COLOR_GROUPS_KEY = 'mapColorGroups';
  const DEFAULT_COLOR_GROUPS = {
    '#d62728': '',
    '#2ca02c': 'Golf Course',
    '#1f77b4': '',
    '#ff7f0e': '',
    '#9467bd': '',
    '#8c564b': '',
    '#e377c2': '',
    '#7f7f7f': '',
    '#bcbd22': '',
    '#17becf': '',
    '#aec7e8': '',
    '#ffbb78': '',
    '#98df8a': '',
    '#ff9896': '',
    '#c5b0d5': '',
    '#c49c94': ''
  };
  
  let currentGroupFilter = 'ALL_GROUPS'; // Show all groups by default
  
  // Load and save color groups
  function loadColorGroups() {
    try {
      const saved = localStorage.getItem(COLOR_GROUPS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_COLOR_GROUPS;
    } catch (e) {
      console.error('Error loading color groups:', e);
      return DEFAULT_COLOR_GROUPS;
    }
  }
  
  function saveColorGroups(groups) {
    try {
      localStorage.setItem(COLOR_GROUPS_KEY, JSON.stringify(groups));
    } catch (e) {
      console.error('Error saving color groups:', e);
    }
  }
  
  // Load saved points from local cache
  function loadSavedPoints() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const points = saved ? JSON.parse(saved) : [];
      console.log(`loadSavedPoints: Loaded ${points.length} points from cache`);
      return points.map(point => ({
        ...point,
        color: point.color || '#d62728',
        notes: point.notes || ''
      }));
    } catch (e) {
      console.error('Error loading saved points:', e);
      return [];
    }
  }
  
  // Create a colored marker icon
  function createColoredMarkerIcon(color) {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="
        background-color: ${color};
        width: 25px;
        height: 25px;
        border-radius: 50% 50% 50% 0;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transform: rotate(-45deg);
        position: relative;
      ">
        <div style="
          width: 6px;
          height: 6px;
          background-color: white;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(45deg);
        "></div>
      </div>`,
      iconSize: [25, 25],
      iconAnchor: [12, 24]
    });
  }
  
  // Save points to local cache
  function saveSavedPoints(points) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(points));
      console.log(`saveSavedPoints: Saved ${points.length} points to cache`);
    } catch (e) {
      console.error('Error saving points:', e);
    }
  }
  
  // Create combined data structure for GitHub sync
  function createSyncData() {
    const points = loadSavedPoints();
    const colorGroups = loadColorGroups();
    
    return {
      points: points,
      colorGroups: colorGroups,
      version: "1.0",
      lastUpdated: new Date().toISOString()
    };
  }
  
  // Extract points and groups from sync data
  function extractFromSyncData(syncData) {
    // Handle both old format (array) and new format (object)
    if (Array.isArray(syncData)) {
      // Old format - just points array
      return {
        points: syncData,
        colorGroups: DEFAULT_COLOR_GROUPS
      };
    } else if (syncData && typeof syncData === 'object') {
      // New format - object with points and colorGroups
      return {
        points: syncData.points || [],
        colorGroups: syncData.colorGroups || DEFAULT_COLOR_GROUPS
      };
    } else {
      // Invalid or empty data
      return {
        points: [],
        colorGroups: DEFAULT_COLOR_GROUPS
      };
    }
  }
  
  // Load saved data from GitHub repository
  async function loadDataFromGitHub() {
    try {
      // Use GitHub API endpoint instead of raw URL to avoid CORS issues
      // The API endpoint has proper CORS headers
      const apiUrl = 'https://api.github.com/repos/opike/maps/contents/saved-points.json';
      
      const response = await fetch(apiUrl, {
        cache: 'no-cache',
        headers: {
          'Accept': 'application/vnd.github.v3.raw', // Get raw content directly
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const cloudData = await response.json();
        const extracted = extractFromSyncData(cloudData);
        
        console.log(`Loaded ${extracted.points.length} points and ${Object.keys(extracted.colorGroups).length} color groups from GitHub`);
        
        // Update local color groups with cloud data
        saveColorGroups(extracted.colorGroups);
        
        return extracted.points;
      } else {
        console.log('No saved data found in GitHub repository');
        return [];
      }
    } catch (e) {
      console.error('Error loading data from GitHub:', e);
      return [];
    }
  }
  
  // Legacy function name for backward compatibility
  async function loadPointsFromGitHub() {
    return await loadDataFromGitHub();
  }
  
  // Save data to GitHub repository (points + color groups)
  async function saveDataToGitHub(showAlert = true) {
    if (!githubToken) {
      if (showAlert) {
        alert('GitHub token required for saving. Please set up sync first.');
      }
      return false;
    }
    
    try {
      // Create combined data structure
      const syncData = createSyncData();
      
      // First, get the current file to get its SHA
      const getResponse = await fetch(GITHUB_API_URL, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      let sha = null;
      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
      }
      
      // Update the file with combined data
      const content = btoa(JSON.stringify(syncData, null, 2));
      const updateResponse = await fetch(GITHUB_API_URL, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: `Update saved data (${syncData.points.length} points, ${Object.keys(syncData.colorGroups).length} color groups)`,
          content: content,
          sha: sha
        })
      });
      
      if (updateResponse.ok) {
        console.log('Successfully saved data to GitHub');
        return true;
      } else {
        const error = await updateResponse.json();
        console.error('Error saving to GitHub:', error);
        if (showAlert) {
          alert('Error saving to GitHub: ' + (error.message || 'Unknown error'));
        }
        return false;
      }
    } catch (e) {
      console.error('Error saving data to GitHub:', e);
      if (showAlert) {
        alert('Error saving to GitHub: ' + e.message);
      }
      return false;
    }
  }
  
  // Legacy function for backward compatibility
  async function savePointsToGitHub(points, showAlert = true) {
    return await saveDataToGitHub(showAlert);
  }
  
  // Automatically save to GitHub if token is available
  async function autoSaveToGitHub() {
    if (!githubToken) {
      console.log('Auto-save skipped: No GitHub token configured');
      updateSyncStatus('No GitHub token - auto-save disabled');
      return; // No token, skip auto-save
    }
    
    const points = loadSavedPoints();
    const colorGroups = loadColorGroups();
    console.log(`Auto-saving ${points.length} points and ${Object.keys(colorGroups).length} color groups to GitHub...`);
    updateSyncStatus('Auto-saving to GitHub...');
    
    try {
      const success = await saveDataToGitHub(false); // Don't show alert for auto-save
      if (success) {
        console.log(`Auto-save successful: ${points.length} points and color groups saved to GitHub`);
        updateSyncStatus(`Auto-saved ${points.length} points + groups to GitHub`);
      } else {
        console.error('Auto-save failed: saveDataToGitHub returned false');
        updateSyncStatus('Auto-save failed');
      }
    } catch (error) {
      console.error('Auto-save error:', error);
      updateSyncStatus('Auto-save error');
    }
  }
  
  // Merge local and cloud points
  function mergePoints(localPoints, cloudPoints) {
    const merged = [...cloudPoints];
    const cloudIds = new Set(cloudPoints.map(p => p.id));
    
    // Add local points that aren't in cloud
    localPoints.forEach(localPoint => {
      if (!cloudIds.has(localPoint.id)) {
        merged.push(localPoint);
      }
    });
    
    // Sort by timestamp
    merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return merged;
  }
  
  // Add a saved point
  function addSavedPoint(lat, lng, name = '', color = '#d62728', notes = '') {
    const point = {
      id: Date.now(),
      lat: lat,
      lng: lng,
      name: name || `Point ${Date.now()}`,
      color: color,
      notes: notes || '',
      timestamp: new Date().toISOString()
    };
    
    const savedPoints = loadSavedPoints();
    savedPoints.push(point);
    saveSavedPoints(savedPoints);
    
    // Create marker with custom color
    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: createColoredMarkerIcon(point.color)
    }).addTo(map);
    
    marker.bindPopup(`
      <div>
        <strong>${point.name}</strong><br>
        ${point.notes ? `<div style="font-size: 12px; color: #666; margin: 4px 0;">${point.notes}</div>` : ''}
        <small>Saved: ${new Date(point.timestamp).toLocaleString()}</small><br>
        <button onclick="editSavedPoint(${point.id})" style="margin-top: 5px; margin-right: 5px; padding: 2px 6px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Edit</button>
        <button onclick="removeSavedPoint(${point.id})" style="margin-top: 5px; padding: 2px 6px; font-size: 11px; background: #d62728; color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button>
      </div>
    `);
    
    // Update marker position when dragged
    marker.on('dragend', function() {
      const newPos = marker.getLatLng();
      updateSavedPointPosition(point.id, newPos.lat, newPos.lng);
    });
    
    marker.pointId = point.id;
    savedMarkers.push(marker);
    
    updateSavedPointsList();
    
    // Auto-save to GitHub if token is available
    autoSaveToGitHub();
    
    return point;
  }
  
  // Remove a saved point
  function removeSavedPoint(pointId) {
    const savedPoints = loadSavedPoints();
    const point = savedPoints.find(p => p.id === pointId);
    
    if (!point) return;
    
    // Show confirmation dialog
    const confirmMessage = `Are you sure you want to delete "${point.name}"?`;
    if (!confirm(confirmMessage)) {
      return; // User cancelled
    }
    
    const filteredPoints = savedPoints.filter(p => p.id !== pointId);
    saveSavedPoints(filteredPoints);
    
    // Remove marker from map
    const markerIndex = savedMarkers.findIndex(m => m.pointId === pointId);
    if (markerIndex >= 0) {
      map.removeLayer(savedMarkers[markerIndex]);
      savedMarkers.splice(markerIndex, 1);
    }
    
    updateSavedPointsList();
    
    // Auto-save to GitHub if token is available
    autoSaveToGitHub();
  }
  
  // Update saved point position
  function updateSavedPointPosition(pointId, newLat, newLng) {
    const savedPoints = loadSavedPoints();
    const point = savedPoints.find(p => p.id === pointId);
    if (point) {
      point.lat = newLat;
      point.lng = newLng;
      saveSavedPoints(savedPoints);
      
      // Auto-save to GitHub if token is available
      autoSaveToGitHub();
    }
  }
  
  // Load and display all saved points
  async function displaySavedPoints() {
    console.log('displaySavedPoints: Starting to load points...');
    
    let pointsToDisplay = [];
    
    // Try to load from GitHub with timeout
    try {
      console.log('displaySavedPoints: Attempting to fetch from GitHub...');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('GitHub fetch timeout')), 5000)
      );
      
      const cloudPoints = await Promise.race([
        loadPointsFromGitHub(),
        timeoutPromise
      ]);
      
      console.log(`displaySavedPoints: Fetched ${cloudPoints.length} points from GitHub`);
      
      if (cloudPoints.length > 0) {
        // Save to local cache
        saveSavedPoints(cloudPoints);
        pointsToDisplay = cloudPoints;
        updateSyncStatus(`Loaded ${cloudPoints.length} points from GitHub`);
      } else {
        updateSyncStatus('No points found in GitHub - click Pull to load');
      }
    } catch (error) {
      console.warn('displaySavedPoints: GitHub fetch failed, using cached points:', error);
      // Fall back to cached points
      pointsToDisplay = loadSavedPoints();
      if (pointsToDisplay.length > 0) {
        updateSyncStatus(`Using ${pointsToDisplay.length} cached points (offline)`);
      } else {
        updateSyncStatus('No points found - click Pull to load from GitHub');
      }
    }
    
    console.log(`displaySavedPoints: Displaying ${pointsToDisplay.length} points`);
    
    // Clear existing markers
    savedMarkers.forEach(marker => map.removeLayer(marker));
    savedMarkers = [];
    
    // Display points
    const readOnly = isReadOnlyMode();
    pointsToDisplay.forEach(point => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: !readOnly, // Only draggable if user has edit permission
        icon: createColoredMarkerIcon(point.color)
      }).addTo(map);
      
      // Build popup content based on permissions
      let popupContent = `
        <div>
          <strong>${point.name}</strong><br>
          ${point.notes ? `<div style="font-size: 12px; color: #666; margin: 4px 0;">${point.notes}</div>` : ''}
          <small>Saved: ${new Date(point.timestamp).toLocaleString()}</small><br>
      `;
      
      if (!readOnly) {
        // Show edit/remove buttons only if user has permission
        popupContent += `
          <button onclick="editSavedPoint(${point.id})" style="margin-top: 5px; margin-right: 5px; padding: 2px 6px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Edit</button>
          <button onclick="removeSavedPoint(${point.id})" style="margin-top: 5px; padding: 2px 6px; font-size: 11px; background: #d62728; color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button>
        `;
      } else {
        // Show read-only indicator
        popupContent += `
          <div style="margin-top: 5px; font-size: 10px; color: #999; font-style: italic;">
            📖 Read-only mode
          </div>
        `;
      }
      
      popupContent += `</div>`;
      marker.bindPopup(popupContent);
      
      if (!readOnly) {
        marker.on('dragend', function() {
          const newPos = marker.getLatLng();
          updateSavedPointPosition(point.id, newPos.lat, newPos.lng);
        });
      }
      
      marker.pointId = point.id;
      savedMarkers.push(marker);
    });
    updateSavedPointsList();
    updateDebugInfo();
    updateUIForPermissions();
    
    console.log('displaySavedPoints: Finished displaying points');
  }
  
  // Filter saved points based on current filters
  function filterSavedPoints(points, filterText, groupFilter) {
    let filteredPoints = points;
    
    // Handle special group filters
    if (groupFilter === 'HIDE_ALL') {
      // Return empty array to hide all points
      return [];
    } else if (groupFilter !== null && groupFilter !== undefined && groupFilter !== 'ALL_GROUPS') {
      // Apply group filter for specific groups
      const colorGroups = loadColorGroups();
      filteredPoints = filteredPoints.filter(point => {
        const groupName = colorGroups[point.color] || '';
        return groupName === groupFilter;
      });
    }
    
    // Apply text filter
    if (filterText && filterText.trim() !== '') {
      const filter = filterText.toLowerCase().trim();
      filteredPoints = filteredPoints.filter(point => 
        point.name.toLowerCase().includes(filter) ||
        point.notes.toLowerCase().includes(filter) ||
        point.lat.toString().includes(filter) ||
        point.lng.toString().includes(filter)
      );
    }
    
    return filteredPoints;
  }

  // Update markers visibility based on filters
  function updateMarkersVisibility() {
    const savedPoints = loadSavedPoints();
    const filteredPoints = filterSavedPoints(savedPoints, currentPointsFilter, currentGroupFilter);
    const filteredIds = new Set(filteredPoints.map(p => p.id));
    
    savedMarkers.forEach(marker => {
      if (filteredIds.has(marker.pointId)) {
        if (!map.hasLayer(marker)) {
          map.addLayer(marker);
        }
      } else {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      }
    });
  }

  // Update the saved points list in UI
  function updateSavedPointsList() {
    const savedPoints = loadSavedPoints();
    const filteredPoints = filterSavedPoints(savedPoints, currentPointsFilter, currentGroupFilter);
    const colorGroups = loadColorGroups();
    const listDiv = document.getElementById('savedPointsList');
    const readOnly = isReadOnlyMode();
    
    if (listDiv) {
      if (savedPoints.length === 0) {
        listDiv.innerHTML = '<div style="color: #999; font-size: 12px; font-style: italic;">No saved points</div>';
      } else if (currentGroupFilter === 'HIDE_ALL') {
        listDiv.innerHTML = '<div style="color: #999; font-size: 12px; font-style: italic;">All points hidden</div>';
      } else if (filteredPoints.length === 0 && (currentPointsFilter || currentGroupFilter)) {
        listDiv.innerHTML = '<div style="color: #999; font-size: 12px; font-style: italic;">No points match filters</div>';
      } else {
        listDiv.innerHTML = filteredPoints.map(point => {
          const groupName = colorGroups[point.color] || '';
          const displayGroupName = groupName === '' ? '' : groupName;
          
          // Build action buttons based on permissions
          let actionButtons = `<button onclick="zoomToSavedPoint(${point.id})" style="margin-left: 8px; padding: 1px 4px; font-size: 10px; background: #007cff; color: white; border: none; border-radius: 2px; cursor: pointer;">Zoom</button>`;
          
          if (!readOnly) {
            actionButtons += `
              <button onclick="editSavedPoint(${point.id})" style="margin-left: 4px; padding: 1px 4px; font-size: 10px; background: #28a745; color: white; border: none; border-radius: 2px; cursor: pointer;">Edit</button>
              <button onclick="removeSavedPoint(${point.id})" style="margin-left: 4px; padding: 1px 4px; font-size: 10px; background: #d62728; color: white; border: none; border-radius: 2px; cursor: pointer;">×</button>
            `;
          }
          
          return `
            <div style="padding: 3px 0; border-bottom: 1px solid #eee; font-size: 12px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; background: ${point.color}; border: 1px solid #ccc; border-radius: 2px; flex-shrink: 0;"></div>
                <div style="font-weight: 600; flex: 1;">${point.name}</div>
                ${displayGroupName ? `<div style="font-size: 10px; color: #888;">${displayGroupName}</div>` : ''}
              </div>
              ${point.notes ? `<div style="color: #666; font-size: 11px; font-style: italic; margin: 2px 0 2px 18px;">${point.notes}</div>` : ''}
              <div style="color: #666; font-size: 11px; margin-left: 18px;">
                ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}
                ${actionButtons}
              </div>
            </div>
          `;
        }).join('');
      }
    }
    
    // Update markers visibility
    updateMarkersVisibility();
    
    // Update group filter dropdown
    updateGroupFilterDropdown();
  }
  
  // Zoom to a saved point
  function zoomToSavedPoint(pointId) {
    const savedPoints = loadSavedPoints();
    const point = savedPoints.find(p => p.id === pointId);
    if (point) {
      map.setView([point.lat, point.lng], 16);
      const marker = savedMarkers.find(m => m.pointId === pointId);
      if (marker) {
        marker.openPopup();
      }
    }
  }
  
  // Clear all saved points
  function clearAllSavedPoints() {
    if (confirm('Are you sure you want to remove all saved points?')) {
      // Remove all markers from map
      savedMarkers.forEach(marker => map.removeLayer(marker));
      savedMarkers = [];
      
      // Clear from local storage
      saveSavedPoints([]);
      updateSavedPointsList();
      
      // Auto-save to GitHub if token is available
      autoSaveToGitHub();
    }
  }
  
  // Add map double-click handler for saving points
  map.on('dblclick', function(e) {
    // Check if in read-only mode
    if (isReadOnlyMode()) {
      alert('Read-only mode: You cannot add points without a GitHub token.\n\nTo edit points:\n1. Click the ⚙️ button in the Saved Points panel\n2. Enter your GitHub Personal Access Token\n3. You will then be able to add, edit, and remove points');
      return;
    }
    
    const pointName = prompt('Enter a name for this point:');
    if (pointName !== null) { // User didn't cancel
      addSavedPoint(e.latlng.lat, e.latlng.lng, pointName || `Point ${Date.now()}`, '#d62728', '');
    }
  });
  
  // Load saved points on initialization
  displaySavedPoints();
  
  // Initialize group filter dropdown
  updateGroupFilterDropdown();
  
  // Save a search result as a saved point
  window.saveSearchResult = function(index) {
    if (searchMarkers[index]) {
      const marker = searchMarkers[index];
      const result = marker.resultData;
      const name = result.display_name.split(',')[0];
      
      // Add the point to saved points
      addSavedPoint(parseFloat(result.lat), parseFloat(result.lon), name);
      
      // Show confirmation
      marker.bindPopup(`
        <div style="font-weight: 600;">${name}</div>
        <div style="font-size: 12px; margin-top: 4px;">${result.display_name}</div>
        <div style="margin-top: 8px; color: #28a745; font-size: 12px;">
          ✓ Saved to your points!
        </div>
      `).openPopup();
      
      // Revert popup after 2 seconds
      setTimeout(() => {
        marker.bindPopup(`
          <div style="font-weight: 600;">${name}</div>
          <div style="font-size: 12px; margin-top: 4px;">${result.display_name}</div>
          <div style="margin-top: 8px;">
            <button onclick="saveSearchResult(${index})" style="padding: 4px 8px; font-size: 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Save Point</button>
          </div>
        `);
      }, 2000);
    }
  };
  
  // Edit a saved point name and coordinates
  window.editSavedPoint = function(pointId) {
    const savedPoints = loadSavedPoints();
    const point = savedPoints.find(p => p.id === pointId);
    if (!point) return;
    
    // Create a more detailed edit dialog
    const editDialog = `
      <div style="font-family: system-ui, -apple-system, sans-serif;">
        <h3 style="margin: 0 0 15px 0; font-size: 16px;">Edit Point</h3>
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 12px;">Name:</label>
          <input type="text" id="editName" value="${point.name}" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 12px;">Notes:</label>
          <textarea id="editNotes" placeholder="Add notes or description..." style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; min-height: 60px; resize: vertical; font-family: inherit;">${point.notes}</textarea>
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 12px;">Latitude:</label>
          <input type="number" id="editLat" value="${point.lat}" step="any" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 12px;">Longitude:</label>
          <input type="number" id="editLng" value="${point.lng}" step="any" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 3px; font-weight: 600; font-size: 12px;">Color Group:</label>
          <select id="editColorGroup" onchange="updateEditColor()" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px; margin-bottom: 8px;">
            ${Object.entries(loadColorGroups()).map(([color, name]) => `
              <option value="${color}" ${color === point.color ? 'selected' : ''}>${name}</option>
            `).join('')}
          </select>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="color" id="editColor" value="${point.color}" onchange="updateEditColorGroup()" style="width: 40px; height: 30px; border: 1px solid #ccc; border-radius: 3px; cursor: pointer;">
            <button onclick="editColorGroup()" style="padding: 4px 8px; font-size: 11px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">Edit Groups</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-top: 8px;">
            ${Object.entries(loadColorGroups()).map(([color, name]) => `
              <div onclick="document.getElementById('editColor').value='${color}'; document.getElementById('editColorGroup').value='${color}';" style="width: 24px; height: 24px; background: ${color}; border: 1px solid #ccc; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; text-shadow: 1px 1px 1px rgba(0,0,0,0.5);" title="${name}">
                ${color === point.color ? '✓' : ''}
              </div>
            `).join('')}
          </div>
        </div>
        <div style="text-align: right;">
          <button onclick="cancelEdit()" style="margin-right: 8px; padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Cancel</button>
          <button onclick="saveEdit(${point.id})" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Save</button>
        </div>
      </div>
    `;
    
    // Create a modal-like overlay
    const overlay = document.createElement('div');
    overlay.id = 'editOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 2000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 300px;
      max-width: 400px;
    `;
    
    dialog.innerHTML = editDialog;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Focus the name input
    setTimeout(() => {
      document.getElementById('editName').focus();
      document.getElementById('editName').select();
    }, 100);
  };
  
  // Cancel edit dialog
  window.cancelEdit = function() {
    const overlay = document.getElementById('editOverlay');
    if (overlay) {
      overlay.remove();
    }
  };
  
  // Save edited point
  window.saveEdit = function(pointId) {
    const nameInput = document.getElementById('editName');
    const notesInput = document.getElementById('editNotes');
    const latInput = document.getElementById('editLat');
    const lngInput = document.getElementById('editLng');
    const colorInput = document.getElementById('editColor');
    
    if (!nameInput || !notesInput || !latInput || !lngInput || !colorInput) return;
    
    const newName = nameInput.value.trim();
    const newNotes = notesInput.value.trim();
    const newLat = parseFloat(latInput.value);
    const newLng = parseFloat(lngInput.value);
    const newColor = colorInput.value;
    
    // Validation
    if (!newName) {
      alert('Please enter a name for the point.');
      nameInput.focus();
      return;
    }
    
    if (isNaN(newLat) || newLat < -90 || newLat > 90) {
      alert('Please enter a valid latitude between -90 and 90.');
      latInput.focus();
      return;
    }
    
    if (isNaN(newLng) || newLng < -180 || newLng > 180) {
      alert('Please enter a valid longitude between -180 and 180.');
      lngInput.focus();
      return;
    }
    
    // Update the saved point
    const savedPoints = loadSavedPoints();
    const point = savedPoints.find(p => p.id === pointId);
    if (point) {
      const oldLat = point.lat;
      const oldLng = point.lng;
      const oldColor = point.color;
      
      point.name = newName;
      point.notes = newNotes;
      point.lat = newLat;
      point.lng = newLng;
      point.color = newColor;
      saveSavedPoints(savedPoints);
      
      // Update the marker position, color, and popup
      const marker = savedMarkers.find(m => m.pointId === pointId);
      if (marker) {
        // Update marker position if coordinates changed
        if (oldLat !== newLat || oldLng !== newLng) {
          marker.setLatLng([newLat, newLng]);
        }
        
        // Update marker color if changed
        if (oldColor !== newColor) {
          marker.setIcon(createColoredMarkerIcon(newColor));
        }
        
        // Update popup content
        marker.bindPopup(`
          <div>
            <strong>${point.name}</strong><br>
            ${point.notes ? `<div style="font-size: 12px; color: #666; margin: 4px 0;">${point.notes}</div>` : ''}
            <small>Saved: ${new Date(point.timestamp).toLocaleString()}</small><br>
            <button onclick="editSavedPoint(${point.id})" style="margin-top: 5px; margin-right: 5px; padding: 2px 6px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Edit</button>
            <button onclick="removeSavedPoint(${point.id})" style="margin-top: 5px; padding: 2px 6px; font-size: 11px; background: #d62728; color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button>
          </div>
        `);
      }
      
      // Update the saved points list
      updateSavedPointsList();
      
      // Auto-save to GitHub if token is available
      autoSaveToGitHub();
      
      // Close the edit dialog
      cancelEdit();
    }
  };
  
  // Clear points filter
  function clearPointsFilter() {
    const filterInput = document.getElementById('pointsFilter');
    const filterClearButton = document.getElementById('filterClearButton');
    
    filterInput.value = '';
    currentPointsFilter = '';
    filterClearButton.style.display = 'none';
    updateSavedPointsList();
  }

  // Update filter clear button visibility
  function updateFilterClearButtonVisibility() {
    const filterInput = document.getElementById('pointsFilter');
    const filterClearButton = document.getElementById('filterClearButton');
    
    if (filterInput.value.trim() !== '') {
      filterClearButton.style.display = 'flex';
    } else {
      filterClearButton.style.display = 'none';
    }
  }

  // Apply points filter
  function applyPointsFilter() {
    const filterInput = document.getElementById('pointsFilter');
    currentPointsFilter = filterInput.value;
    updateSavedPointsList();
    updateFilterClearButtonVisibility();
  }
  
  // Apply group filter
  function applyGroupFilter() {
    const groupSelect = document.getElementById('groupFilter');
    const selectedValue = groupSelect.value;
    
    // Handle special filter values
    if (selectedValue === '') {
      currentGroupFilter = 'ALL_GROUPS';
    } else if (selectedValue === 'HIDE_ALL') {
      currentGroupFilter = 'HIDE_ALL';
    } else {
      currentGroupFilter = selectedValue;
    }
    
    updateSavedPointsList();
  }
  
  // Update group filter dropdown
  function updateGroupFilterDropdown() {
    const groupSelect = document.getElementById('groupFilter');
    const colorGroups = loadColorGroups();
    const savedPoints = loadSavedPoints();
    
    // Get unique colors that are actually used
    const usedColors = new Set(savedPoints.map(point => point.color));
    
    // Build options
    let options = '<option value="">All Groups</option>';
    options += '<option value="HIDE_ALL">Hide All</option>';
    
    // Group colors by their names
    const groupsByName = {};
    Object.entries(colorGroups).forEach(([color, name]) => {
      if (usedColors.has(color)) {
        if (!groupsByName[name]) {
          groupsByName[name] = [];
        }
        groupsByName[name].push(color);
      }
    });
    
    // Add options for each unique group name
    Object.entries(groupsByName).forEach(([name, colors]) => {
      const selected = currentGroupFilter === name ? 'selected' : '';
      const displayName = name === '' ? '(Ungrouped)' : name;
      options += `<option value="${name}" ${selected}>${displayName}</option>`;
    });
    
    // Handle special selections
    if (currentGroupFilter === 'ALL_GROUPS' || currentGroupFilter === '') {
      options = options.replace('<option value="">All Groups</option>', '<option value="" selected>All Groups</option>');
    } else if (currentGroupFilter === 'HIDE_ALL') {
      options = options.replace('<option value="HIDE_ALL">Hide All</option>', '<option value="HIDE_ALL" selected>Hide All</option>');
    }
    
    groupSelect.innerHTML = options;
  }
  
  // Update edit color when group changes
  function updateEditColor() {
    const groupSelect = document.getElementById('editColorGroup');
    const colorInput = document.getElementById('editColor');
    if (groupSelect && colorInput) {
      colorInput.value = groupSelect.value;
    }
  }
  
  // Update edit group when color changes
  function updateEditColorGroup() {
    const colorInput = document.getElementById('editColor');
    const groupSelect = document.getElementById('editColorGroup');
    const colorGroups = loadColorGroups();
    
    if (colorInput && groupSelect) {
      const color = colorInput.value;
      if (colorGroups[color]) {
        groupSelect.value = color;
      }
    }
  }
  
  // Edit color groups
  function editColorGroup() {
    const colorGroups = loadColorGroups();
    const groupEntries = Object.entries(colorGroups);
    
    let editDialog = `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-height: 400px; overflow-y: auto;">
        <h3 style="margin: 0 0 15px 0; font-size: 16px;">Edit Color Groups</h3>
        <div id="colorGroupsList">
          ${groupEntries.map(([color, name], index) => `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <div style="width: 20px; height: 20px; background: ${color}; border: 1px solid #ccc; border-radius: 3px;"></div>
              <input type="text" value="${name}" id="groupName${index}" style="flex: 1; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
              <button onclick="removeColorGroup('${color}')" style="padding: 2px 6px; font-size: 11px; background: #d62728; color: white; border: none; border-radius: 3px; cursor: pointer;">×</button>
            </div>
          `).join('')}
        </div>
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
          <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <input type="color" id="newGroupColor" value="#000000" style="width: 40px; height: 30px; border: 1px solid #ccc; border-radius: 3px;">
            <input type="text" id="newGroupName" placeholder="Group name" style="flex: 1; padding: 4px; border: 1px solid #ccc; border-radius: 3px; font-size: 12px;">
            <button onclick="addColorGroup()" style="padding: 4px 8px; font-size: 11px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Add</button>
          </div>
        </div>
        <div style="text-align: right; margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
          <button onclick="cancelColorGroupEdit()" style="margin-right: 8px; padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Cancel</button>
          <button onclick="saveColorGroups()" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;">Save</button>
        </div>
      </div>
    `;
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'colorGroupEditOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 2000;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      min-width: 400px;
      max-width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    dialog.innerHTML = editDialog;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  // Update sync status
  function updateSyncStatus(message) {
    const statusDiv = document.getElementById('syncStatus');
    if (statusDiv) {
      statusDiv.textContent = message;
      
      // Keep error messages longer, clear success messages after 5 seconds
      const isError = message.toLowerCase().includes('failed') || message.toLowerCase().includes('error');
      const timeout = isError ? 10000 : 5000; // 10 seconds for errors, 5 for success
      
      setTimeout(() => {
        if (statusDiv.textContent === message) {
          statusDiv.textContent = '';
        }
      }, timeout);
    }
  }
  
  // Update debug info
  function updateDebugInfo() {
    const debugDiv = document.getElementById('debugInfo');
    if (debugDiv) {
      const cachedPoints = loadSavedPoints();
      const hasToken = !!githubToken;
      debugDiv.textContent = `Cached: ${cachedPoints.length} points | Token: ${hasToken ? '✓' : '✗'}`;
    }
  }
  
  // Update UI based on read-only mode
  function updateUIForPermissions() {
    const readOnly = isReadOnlyMode();
    
    // Update header message
    const headerMessage = document.getElementById('headerMessage');
    if (headerMessage) {
      if (readOnly) {
        headerMessage.innerHTML = '📖 <span style="color: #ff9800;">Read-only mode</span> - <a href="#" onclick="setupGitHubSync(); return false;" style="color: #007cff; text-decoration: underline;">Add token to edit</a>';
      } else {
        headerMessage.textContent = 'Double-click map to save points';
      }
    }
    
    // Hide/show Clear All button
    const clearAllContainer = document.getElementById('clearAllContainer');
    if (clearAllContainer) {
      clearAllContainer.style.display = readOnly ? 'none' : 'block';
    }
    
    // Update sync status if in read-only mode
    if (readOnly) {
      const cloudPoints = loadCloudPoints();
      if (cloudPoints.length > 0) {
        updateSyncStatus(`Viewing ${cloudPoints.length} points (read-only)`);
      }
    }
  }
  
  // Setup GitHub sync
  function setupGitHubSync() {
    const currentToken = githubToken;
    const token = prompt(`Enter your GitHub Personal Access Token for repository access:
    
1. Go to GitHub Settings > Developer settings > Personal access tokens
2. Generate a new token with 'repo' permissions
3. Copy and paste it here

Current token: ${currentToken ? '***' + currentToken.slice(-4) : 'None'}

Leave empty to remove token and switch to read-only mode.`, currentToken);
    
    if (token !== null) {
      githubToken = token.trim();
      if (githubToken) {
        localStorage.setItem('githubToken', githubToken);
        updateSyncStatus('GitHub token saved - you can now edit points');
        alert('GitHub token saved! You can now add, edit, and remove points.\n\nYour changes will automatically sync to GitHub.');
      } else {
        localStorage.removeItem('githubToken');
        updateSyncStatus('GitHub token removed - switched to read-only mode');
      }
      
      // Refresh UI to reflect new permissions
      updateUIForPermissions();
      updateSavedPointsList();
      updateDebugInfo();
    }
  }
  
  // Manual pull from GitHub (for the pull button)
  async function manualPullFromGitHub() {
    updateSyncStatus('Pulling from GitHub...');
    console.log('manualPullFromGitHub: Starting manual pull...');
    
    try {
      const cloudPoints = await loadDataFromGitHub();
      
      if (cloudPoints.length === 0) {
        updateSyncStatus('No points found in GitHub');
        alert('No saved points found in GitHub repository.');
        return;
      }
      
      console.log(`manualPullFromGitHub: Loaded ${cloudPoints.length} points from GitHub`);
      
      // Save to cache
      saveSavedPoints(cloudPoints);
      
      // Reload the display
      await displaySavedPoints();
      
      updateSyncStatus(`Pulled ${cloudPoints.length} points from GitHub`);
      alert(`Successfully pulled ${cloudPoints.length} points from GitHub!`);
    } catch (error) {
      console.error('manualPullFromGitHub: Error pulling from GitHub:', error);
      updateSyncStatus('Pull failed: ' + error.message);
      alert('Failed to pull from GitHub: ' + error.message);
    }
  }
  
  // Manual save to GitHub (for the push button)
  async function manualSaveToGitHub() {
    const points = loadSavedPoints();
    const colorGroups = loadColorGroups();
    
    if (points.length === 0) {
      updateSyncStatus('No points to save');
      return;
    }
    
    updateSyncStatus('Manually saving to GitHub...');
    
    const success = await saveDataToGitHub(true); // Show alerts for manual save
    if (success) {
      updateSyncStatus(`Manually saved ${points.length} points + groups to GitHub`);
    } else {
      updateSyncStatus('Manual save failed');
    }
  }
  
  // Color group management functions
  window.addColorGroup = function() {
    const colorInput = document.getElementById('newGroupColor');
    const nameInput = document.getElementById('newGroupName');
    
    if (colorInput && nameInput && nameInput.value.trim()) {
      const color = colorInput.value;
      const name = nameInput.value.trim();
      
      const colorGroups = loadColorGroups();
      colorGroups[color] = name;
      saveColorGroups(colorGroups);
      
      // Auto-save to GitHub when color groups are modified
      autoSaveToGitHub();
      
      // Refresh the dialog
      editColorGroup();
    }
  };
  
  window.removeColorGroup = function(color) {
    if (confirm('Remove this color group?')) {
      const colorGroups = loadColorGroups();
      delete colorGroups[color];
      saveColorGroups(colorGroups);
      
      // Auto-save to GitHub when color groups are modified
      autoSaveToGitHub();
      
      // Refresh the dialog
      editColorGroup();
    }
  };
  
  window.saveColorGroups = function() {
    const colorGroups = loadColorGroups();
    const groupEntries = Object.entries(colorGroups);
    const updatedGroups = {};
    
    groupEntries.forEach(([color, originalName], index) => {
      const nameInput = document.getElementById(`groupName${index}`);
      if (nameInput) {
        updatedGroups[color] = nameInput.value.trim() || originalName;
      } else {
        updatedGroups[color] = originalName;
      }
    });
    
    saveColorGroups(updatedGroups);
    cancelColorGroupEdit();
    updateGroupFilterDropdown();
    updateSavedPointsList();
    
    // Auto-save to GitHub when color groups are modified
    autoSaveToGitHub();
  };
  
  window.cancelColorGroupEdit = function() {
    const overlay = document.getElementById('colorGroupEditOverlay');
    if (overlay) {
      overlay.remove();
    }
  };
  
  // Make functions global for onclick handlers
  window.removeSavedPoint = removeSavedPoint;
  window.zoomToSavedPoint = zoomToSavedPoint;
  window.clearAllSavedPoints = clearAllSavedPoints;
  window.editSavedPoint = editSavedPoint;
  window.cancelEdit = cancelEdit;
  window.saveEdit = saveEdit;
  window.clearPointsFilter = clearPointsFilter;
  window.setupGitHubSync = setupGitHubSync;
  window.manualPullFromGitHub = manualPullFromGitHub;
  window.manualSaveToGitHub = manualSaveToGitHub;
  window.applyGroupFilter = applyGroupFilter;
  window.updateEditColor = updateEditColor;
  window.updateEditColorGroup = updateEditColorGroup;
  window.editColorGroup = editColorGroup;
  
  window.searchBusinesses = async function() {
    const query = document.getElementById('searchInput').value.trim();
    const resultsDiv = document.getElementById('searchResults');
    
    if (!query) {
      resultsDiv.innerHTML = '<div style="color: #999; font-size: 12px;">Please enter a search term</div>';
      return;
    }
    
    // Add to search history
    addToSearchHistory(query);
    
    resultsDiv.innerHTML = '<div style="color: #666; font-size: 12px;">Searching...</div>';
    
    // Clear previous search markers
    searchMarkers.forEach(marker => map.removeLayer(marker));
    searchMarkers = [];
    
    try {
      // Determine if this looks like an address search vs business search
      const isAddressLike = /\d/.test(query) || /\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place)\b/i.test(query);
      
      console.log(`Search query: "${query}", detected as: ${isAddressLike ? 'address' : 'business'} search`);
      
      let results = [];
      
      // First, try a bounded search for businesses (to prioritize nearby results)
      if (!isAddressLike) {
        try {
          const bounds = map.getBounds();
          const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
          const boundedUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&bounded=1&viewbox=${bbox}&limit=8&addressdetails=1&extratags=1&countrycodes=us`;
          const boundedResponse = await fetch(boundedUrl);
          if (boundedResponse.ok) {
            results = await boundedResponse.json();
          }
        } catch (e) {
          console.log('Bounded search failed, continuing with broader search');
        }
      }
      
      // If we don't have enough results, do a broader search within Arizona
      if (results.length < 5) {
        let broadQuery = query;
        
        // For address searches, be more specific about Arizona if not already included
        if (isAddressLike && !/(arizona|az|phoenix|mesa|chandler|scottsdale|tempe|glendale|peoria|gilbert)\b/i.test(query)) {
          // Add Arizona context for address searches
          broadQuery = query + ', Arizona';
        }
        
        const broadSearchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(broadQuery)}&limit=15&addressdetails=1&extratags=1&countrycodes=us`;
        const broadResponse = await fetch(broadSearchUrl);
        
        if (!broadResponse.ok) {
          throw new Error('Search failed');
        }
        
        const broadResults = await broadResponse.json();
        
        // Combine results, avoiding duplicates
        const existingIds = new Set(results.map(r => r.place_id));
        const newResults = broadResults.filter(r => !existingIds.has(r.place_id));
        results = [...results, ...newResults];
      }
      
      // If still no results and it's an address search, try with different variations
      if (results.length === 0 && isAddressLike) {
        // Try searching without street suffixes first
        const simplifiedQuery = query.replace(/\b(st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place)\b/gi, '').trim();
        if (simplifiedQuery !== query && simplifiedQuery.length > 0) {
          const simplifiedUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplifiedQuery + ', Arizona')}&limit=10&addressdetails=1&extratags=1&countrycodes=us`;
          const simplifiedResponse = await fetch(simplifiedUrl);
          if (simplifiedResponse.ok) {
            const simplifiedResults = await simplifiedResponse.json();
            results = [...results, ...simplifiedResults];
          }
        }
      }
      
      if (results.length === 0) {
        resultsDiv.innerHTML = '<div style="color: #999; font-size: 12px;">No results found. Try including city name (e.g., "123 Main St, Phoenix") or search for nearby businesses.</div>';
        console.log('No search results found for query:', query);
        return;
      }
      
      console.log(`Found ${results.length} results for query: "${query}"`);
      console.log('Results:', results.map(r => ({ name: r.display_name, type: r.type, class: r.class })));
      
      // Sort results to prioritize addresses for address-like queries and businesses for business queries
      results.sort((a, b) => {
        if (isAddressLike) {
          // For address searches, prioritize house numbers and addresses
          const aIsAddress = a.type === 'house' || a.class === 'place' || /\d+/.test(a.display_name);
          const bIsAddress = b.type === 'house' || b.class === 'place' || /\d+/.test(b.display_name);
          if (aIsAddress && !bIsAddress) return -1;
          if (!aIsAddress && bIsAddress) return 1;
        } else {
          // For business searches, prioritize amenities and shops
          const aIsBusiness = a.class === 'amenity' || a.class === 'shop' || a.class === 'tourism';
          const bIsBusiness = b.class === 'amenity' || b.class === 'shop' || b.class === 'tourism';
          if (aIsBusiness && !bIsBusiness) return -1;
          if (!aIsBusiness && bIsBusiness) return 1;
        }
        return 0;
      });
      
      // Limit to top 10 results after sorting
      results = results.slice(0, 10);
      
      // Helper function to get result type icon and label
      function getResultTypeInfo(result) {
        if (result.class === 'amenity') {
          return { icon: '🏪', label: 'Business' };
        } else if (result.class === 'shop') {
          return { icon: '🛍️', label: 'Shop' };
        } else if (result.class === 'tourism') {
          return { icon: '🏛️', label: 'Tourism' };
        } else if (result.type === 'house' || /\d+/.test(result.display_name.split(',')[0])) {
          return { icon: '🏠', label: 'Address' };
        } else if (result.class === 'highway') {
          return { icon: '🛣️', label: 'Road' };
        } else if (result.class === 'place') {
          return { icon: '📍', label: 'Place' };
        } else {
          return { icon: '📍', label: 'Location' };
        }
      }
      
      // Display results with type indicators
      resultsDiv.innerHTML = results.map((result, index) => {
        const name = result.display_name.split(',')[0];
        const address = result.display_name.split(',').slice(1, 3).join(',');
        const typeInfo = getResultTypeInfo(result);
        
        return `
          <div class="search-result-item">
            <div onclick="zoomToResult(${index})" style="flex: 1; cursor: pointer;">
              <div style="font-weight: 600; display: flex; align-items: center; gap: 4px;">
                <span style="font-size: 12px;">${typeInfo.icon}</span>
                <span>${name}</span>
                <span style="font-size: 10px; color: #888; font-weight: normal;">${typeInfo.label}</span>
              </div>
              <div style="font-size: 11px; color: #666;">${address}</div>
            </div>
            <button onclick="saveSearchResult(${index}); event.stopPropagation();" style="margin-left: 8px; padding: 2px 6px; font-size: 10px; background: #28a745; color: white; border: none; border-radius: 2px; cursor: pointer; flex-shrink: 0;">Save</button>
          </div>
        `;
      }).join('');
      
      // Add markers to map with different colors for different types
      results.forEach((result, index) => {
        const name = result.display_name.split(',')[0];
        const typeInfo = getResultTypeInfo(result);
        
        // Create custom icon based on result type
        let markerIcon;
        if (result.class === 'amenity' || result.class === 'shop' || result.class === 'tourism') {
          // Blue markers for businesses
          markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
              background-color: #007cff;
              width: 25px;
              height: 25px;
              border-radius: 50% 50% 50% 0;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              transform: rotate(-45deg);
              position: relative;
            ">
              <div style="
                width: 6px;
                height: 6px;
                background-color: white;
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(45deg);
              "></div>
            </div>`,
            iconSize: [25, 25],
            iconAnchor: [12, 24]
          });
        } else {
          // Green markers for addresses and other locations
          markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="
              background-color: #28a745;
              width: 25px;
              height: 25px;
              border-radius: 50% 50% 50% 0;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              transform: rotate(-45deg);
              position: relative;
            ">
              <div style="
                width: 6px;
                height: 6px;
                background-color: white;
                border-radius: 50%;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(45deg);
              "></div>
            </div>`,
            iconSize: [25, 25],
            iconAnchor: [12, 24]
          });
        }
        
        const marker = L.marker([result.lat, result.lon], { icon: markerIcon })
          .bindPopup(`
            <div style="font-weight: 600; display: flex; align-items: center; gap: 4px;">
              <span>${typeInfo.icon}</span>
              <span>${name}</span>
              <span style="font-size: 10px; color: #888; font-weight: normal;">${typeInfo.label}</span>
            </div>
            <div style="font-size: 12px; margin-top: 4px;">${result.display_name}</div>
            <div style="margin-top: 8px;">
              <button onclick="saveSearchResult(${index})" style="padding: 4px 8px; font-size: 12px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">Save Point</button>
            </div>
          `)
          .addTo(map);
        
        searchMarkers.push(marker);
        
        // Store result data on marker for zoom function
        marker.resultData = result;
        marker.resultIndex = index;
      });
      
    } catch (error) {
      resultsDiv.innerHTML = '<div style="color: #d62728; font-size: 12px;">Search error. Please try again.</div>';
      console.error('Search error:', error);
    }
  };
  
  window.zoomToResult = function(index) {
    if (searchMarkers[index]) {
      const marker = searchMarkers[index];
      map.setView([marker.getLatLng().lat, marker.getLatLng().lng], 16);
      marker.openPopup();
    }
  };
  
  // Add event listeners for search input
  const searchInput = document.getElementById('searchInput');
  
  // Allow search on Enter key
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      hideSearchHistoryDropdown();
      searchBusinesses();
    }
  });
  
  // Show search history on focus
  searchInput.addEventListener('focus', function() {
    showSearchHistoryDropdown();
  });
  
  // Update clear button visibility on input
  searchInput.addEventListener('input', function() {
    updateClearButtonVisibility();
  });
  
  // Initialize clear button visibility
  updateClearButtonVisibility();
  
  // Add event listeners for points filter
  const pointsFilterInput = document.getElementById('pointsFilter');
  
  // Filter points as user types
  pointsFilterInput.addEventListener('input', function() {
    applyPointsFilter();
  });
  
  // Initialize filter clear button visibility
  updateFilterClearButtonVisibility();
  
  // Hide search history when clicking outside
  document.addEventListener('click', function(e) {
    const searchInputContainer = document.querySelector('.search-input-container');
    const searchHistoryDropdown = document.getElementById('searchHistoryDropdown');
    
    // Check if click is outside the search input container and dropdown
    if (!searchInputContainer.contains(e.target) && !searchHistoryDropdown.contains(e.target)) {
      hideSearchHistoryDropdown();
    }
  });
  
  // Custom resize functionality for top-right handle
  function initializeCustomResize() {
    const container = document.querySelector('.saved-points-container');
    const WIDGET_HEIGHT_KEY = 'savedPointsWidgetHeight';
    const DEFAULT_HEIGHT = 350;
    
    // Load saved height from localStorage
    function loadSavedHeight() {
      try {
        const savedHeight = localStorage.getItem(WIDGET_HEIGHT_KEY);
        return savedHeight ? parseInt(savedHeight, 10) : DEFAULT_HEIGHT;
      } catch (e) {
        console.error('Error loading widget height:', e);
        return DEFAULT_HEIGHT;
      }
    }
    
    // Save height to localStorage
    function saveHeight(height) {
      try {
        localStorage.setItem(WIDGET_HEIGHT_KEY, height.toString());
      } catch (e) {
        console.error('Error saving widget height:', e);
      }
    }
    
    // Apply saved height on initialization (but only if not collapsed)
    const savedHeight = loadSavedHeight();
    // Check if the container will be collapsed on initialization
    const collapseStates = loadCollapseStates();
    if (!collapseStates.savedPoints) {
      container.style.height = savedHeight + 'px';
    } else {
      // Store the height for when it gets expanded later
      container.dataset.expandedHeight = savedHeight + 'px';
    }
    
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    
    // Add mouse events to the container for the top-right area
    container.addEventListener('mousedown', function(e) {
      // Don't allow resizing when collapsed
      if (container.classList.contains('collapsed-widget')) {
        return;
      }
      
      const rect = container.getBoundingClientRect();
      const isInResizeArea = (
        e.clientX >= rect.right - 20 && 
        e.clientX <= rect.right && 
        e.clientY >= rect.top && 
        e.clientY <= rect.top + 20
      );
      
      if (isInResizeArea) {
        isResizing = true;
        startY = e.clientY;
        startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
      }
    });
    
    function doResize(e) {
      if (!isResizing) return;
      
      // Calculate new height (inverted because we're resizing from top)
      const deltaY = startY - e.clientY;
      const newHeight = startHeight + deltaY;
      
      // Apply constraints
      const minHeight = 200;
      const maxHeight = window.innerHeight * 0.8;
      const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
      
      container.style.height = constrainedHeight + 'px';
    }
    
    function stopResize() {
      isResizing = false;
      document.removeEventListener('mousemove', doResize);
      document.removeEventListener('mouseup', stopResize);
      
      // Save the final height to localStorage
      const currentHeight = parseInt(container.style.height, 10);
      saveHeight(currentHeight);
    }
    
    // Update cursor when hovering over resize area
    container.addEventListener('mousemove', function(e) {
      // Don't show resize cursor when collapsed
      if (container.classList.contains('collapsed-widget')) {
        container.style.cursor = 'default';
        return;
      }
      
      const rect = container.getBoundingClientRect();
      const isInResizeArea = (
        e.clientX >= rect.right - 20 && 
        e.clientX <= rect.right && 
        e.clientY >= rect.top && 
        e.clientY <= rect.top + 20
      );
      
      container.style.cursor = isInResizeArea ? 'ns-resize' : 'default';
    });
    
    container.addEventListener('mouseleave', function() {
      container.style.cursor = 'default';
    });
  }
  
  // Initialize custom resize functionality
  initializeCustomResize();

  // Make search history functions global
  window.selectSearchHistoryItem = selectSearchHistoryItem;
  window.clearSearchHistory = clearSearchHistory;
  window.clearSearch = clearSearch;

  // Collapsible functionality
  const COLLAPSE_STATES_KEY = 'mapCollapseStates';
  
  // Load collapse states from localStorage
  function loadCollapseStates() {
    try {
      const saved = localStorage.getItem(COLLAPSE_STATES_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Error loading collapse states:', e);
      return {};
    }
  }
  
  // Save collapse states to localStorage
  function saveCollapseStates(states) {
    try {
      localStorage.setItem(COLLAPSE_STATES_KEY, JSON.stringify(states));
    } catch (e) {
      console.error('Error saving collapse states:', e);
    }
  }
  
  // Toggle collapse state for a component
  function toggleCollapse(componentId) {
    const contentId = componentId + 'Content';
    const buttonId = componentId + 'CollapseButton';
    
    // Handle special case for saved points - collapse the entire widget
    let contentElements = [];
    if (componentId === 'savedPoints') {
      // For saved points, we want to collapse everything except the header with the collapse button
      contentElements = [
        document.getElementById('savedPointsHeaderContent'),
        document.getElementById('savedPointsContent')
      ].filter(el => el !== null);
    } else {
      const contentEl = document.getElementById(contentId);
      if (contentEl) {
        contentElements = [contentEl];
      }
    }
    
    const button = document.getElementById(buttonId);
    
    if (contentElements.length === 0 || !button) {
      console.error('Collapse elements not found for:', componentId);
      return;
    }
    
    // Get current states
    const collapseStates = loadCollapseStates();
    const isCurrentlyCollapsed = collapseStates[componentId] || false;
    const newCollapsedState = !isCurrentlyCollapsed;
    
    // Update visual state
    contentElements.forEach(contentEl => {
      if (newCollapsedState) {
        contentEl.classList.add('collapsed');
      } else {
        contentEl.classList.remove('collapsed');
      }
    });
    
    // For saved points, also adjust the container height when collapsed
    if (componentId === 'savedPoints') {
      const container = document.querySelector('.saved-points-container');
      if (container) {
        if (newCollapsedState) {
          // Store the current height before collapsing
          container.dataset.expandedHeight = container.style.height || '350px';
          // Remove the inline height style to allow CSS to take over
          container.style.height = '';
          container.classList.add('collapsed-widget');
        } else {
          container.classList.remove('collapsed-widget');
          // Restore the previous height
          const expandedHeight = container.dataset.expandedHeight || '350px';
          container.style.height = expandedHeight;
        }
      }
    }
    
    // Update button text
    button.textContent = newCollapsedState ? '+' : '−';
    button.title = newCollapsedState ? 'Expand' : 'Collapse';
    
    // Save state
    collapseStates[componentId] = newCollapsedState;
    saveCollapseStates(collapseStates);
  }
  
  // Initialize collapse states on page load
  function initializeCollapseStates() {
    const collapseStates = loadCollapseStates();
    
    // Apply saved states
    Object.entries(collapseStates).forEach(([componentId, isCollapsed]) => {
      if (isCollapsed) {
        const contentId = componentId + 'Content';
        const buttonId = componentId + 'CollapseButton';
        
        // Handle special case for saved points
        let contentElements = [];
        if (componentId === 'savedPoints') {
          contentElements = [
            document.getElementById('savedPointsHeaderContent'),
            document.getElementById('savedPointsContent')
          ].filter(el => el !== null);
        } else {
          const contentEl = document.getElementById(contentId);
          if (contentEl) {
            contentElements = [contentEl];
          }
        }
        
        const button = document.getElementById(buttonId);
        
        if (contentElements.length > 0 && button) {
          contentElements.forEach(contentEl => {
            contentEl.classList.add('collapsed');
          });
          
          // For saved points, also add the collapsed widget class
          if (componentId === 'savedPoints') {
            const container = document.querySelector('.saved-points-container');
            if (container) {
              // Store the current height before collapsing
              container.dataset.expandedHeight = container.style.height || '350px';
              // Remove the inline height style to allow CSS to take over
              container.style.height = '';
              container.classList.add('collapsed-widget');
            }
          }
          
          button.textContent = '+';
          button.title = 'Expand';
        }
      }
    });
  }
  
  // Make toggle function global
  window.toggleCollapse = toggleCollapse;
  
  // Initialize collapse states after a short delay to ensure DOM is ready
  setTimeout(initializeCollapseStates, 100);
})();
