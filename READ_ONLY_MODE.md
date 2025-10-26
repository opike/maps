# Read-Only Mode Feature

## Overview

The map now supports **read-only mode** for users who don't have a GitHub Personal Access Token. This ensures that only you (the owner) can edit the points, while others can view them.

## How It Works

### Permission Levels

1. **Owner (Edit Mode)** - Has GitHub token configured
   - Can add new points (double-click map)
   - Can edit existing points
   - Can remove points
   - Can drag markers to move them
   - Changes automatically sync to GitHub

2. **Viewer (Read-Only Mode)** - No GitHub token
   - Can view all points
   - Can zoom to points
   - Can filter and search points
   - **Cannot** add, edit, or remove points
   - **Cannot** drag markers

### Visual Indicators

#### Read-Only Mode Shows:
- **Header**: "📖 Read-only mode - Add token to edit" (clickable link)
- **Marker popups**: "📖 Read-only mode" instead of Edit/Remove buttons
- **Points list**: Only "Zoom" button visible (no Edit/× buttons)
- **No "Clear All Points" button**
- **Markers are not draggable**
- **Debug info**: Shows `Token: ✗`

#### Edit Mode Shows:
- **Header**: "Double-click map to save points"
- **Marker popups**: Edit and Remove buttons
- **Points list**: Zoom, Edit, and × buttons
- **"Clear All Points" button visible**
- **Markers are draggable**
- **Debug info**: Shows `Token: ✓`

## User Experience

### For Viewers (No Token)

1. Open the map → Points load automatically from GitHub
2. Status shows: "Loaded X points from cloud"
3. Header shows: "📖 Read-only mode - Add token to edit"
4. Can browse, zoom, and filter points
5. If they try to double-click map: Alert explains they need a token

### For Owner (With Token)

1. Click ⚙️ button
2. Enter GitHub Personal Access Token
3. Alert confirms: "GitHub token saved! You can now edit points"
4. UI updates immediately to show edit controls
5. All changes auto-sync to GitHub

## Security

### What's Protected:
- ✅ GitHub repository (only you can push with your token)
- ✅ UI prevents editing without token
- ✅ Local storage separation (cloud vs local points)

### What's NOT Protected:
- ❌ Users can still modify their local browser storage manually
- ❌ No server-side authentication (this is a client-side app)
- ❌ Users could theoretically fork your code and remove restrictions

### Recommendation:
This is **sufficient for casual sharing** where you want to:
- Share a map with friends/family
- Let colleagues view your points
- Prevent accidental edits

This is **NOT sufficient** if you need:
- Enterprise-level security
- Protection against determined attackers
- Audit trails of who edited what

## Implementation Details

### Key Functions

```javascript
hasEditPermission()
// Returns true if user has a valid GitHub token

isReadOnlyMode()
// Returns true if using cloud points without edit permission

updateUIForPermissions()
// Updates all UI elements based on current permission level
```

### Storage Strategy

- **Cloud points** (`mapSavedPoints_cloud`): Synced from GitHub, read-only without token
- **Local points** (`mapSavedPoints_local`): Created locally, always editable

### Permission Checks

1. **On page load**: Check if cloud points exist and if token is present
2. **On double-click**: Block if in read-only mode
3. **On marker drag**: Disable dragging if in read-only mode
4. **On render**: Hide edit buttons if in read-only mode

## Testing

### Test Read-Only Mode:
```javascript
// In browser console:
localStorage.removeItem('githubToken');
location.reload();
// Should show read-only UI
```

### Test Edit Mode:
```javascript
// In browser console:
localStorage.setItem('githubToken', 'your_token_here');
location.reload();
// Should show edit UI
```

### Test Permission Switch:
1. Load page without token (read-only)
2. Click ⚙️ and add token
3. UI should update immediately without reload
4. Try adding a point - should work

## Future Enhancements

Possible improvements:
- Server-side authentication
- Role-based access (viewer, editor, admin)
- Point-level permissions
- Edit history/audit log
- Collaborative editing with conflict resolution

