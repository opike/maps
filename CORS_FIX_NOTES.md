# CORS Issue Fix Notes

## Problem
The fetch for `saved-points.json` from GitHub was failing when the JavaScript code was in an external `script.js` file, but worked when the same code was inline in `index.html`.

## Root Cause
This is a **browser CORS (Cross-Origin Resource Sharing) policy** issue that occurs when:

1. **Opening HTML files directly** via `file://` protocol (double-clicking the HTML file)
2. **External scripts** loaded via `<script src="script.js">` have stricter CORS policies than inline scripts in some browsers
3. **Custom headers trigger CORS preflight requests** - Headers like `Accept: application/vnd.github.v3.raw` or `Cache-Control: no-cache` cause the browser to send an OPTIONS request first
4. The CORS preflight request fails when the script is external, but may succeed when inline

### Why Inline Scripts Work But External Scripts Don't

**Inline Scripts (in HTML):**
- Considered part of the HTML document
- Same origin as the page
- Browsers may be more lenient with CORS preflight handling
- The script execution context is directly tied to the document

**External Scripts (script.js):**
- Loaded as a separate resource
- With `file://` protocol, each file can be a different origin
- Stricter CORS enforcement
- Custom headers in fetch requests trigger preflight OPTIONS requests that fail

**The Critical Issue:** Custom headers like `Cache-Control: no-cache` or `Accept: application/vnd.github.v3.raw` trigger **CORS preflight requests**. These preflight requests work differently depending on whether the fetch is initiated from an inline script vs. an external script when using the `file://` protocol.

## Solution Implemented

### 1. Avoid Custom Headers (Primary Fix)
**The key fix:** Remove custom headers that trigger CORS preflight requests. Simple GET requests without custom headers work reliably in both inline and external scripts.

### 2. Multiple Fetch Methods with Fallbacks
The `loadDataFromGitHub()` function now tries multiple methods in order:

```javascript
1. GitHub Raw URL (simple - NO CUSTOM HEADERS)
   - URL: https://raw.githubusercontent.com/opike/maps/main/saved-points.json?t=timestamp
   - No custom headers = No CORS preflight = Works with external scripts
   - Cache busting via URL parameter instead of headers

2. GitHub Raw URL (with cache control)
   - URL: https://raw.githubusercontent.com/opike/maps/main/saved-points.json
   - Uses cache: 'no-store' option (less likely to trigger preflight than headers)

3. GitHub API (base64 decode)
   - URL: https://api.github.com/repos/opike/maps/contents/saved-points.json
   - No custom headers
   - Decodes the base64 content returned by the API

4. GitHub API (via download_url)
   - URL: https://api.github.com/repos/opike/maps/contents/saved-points.json
   - No custom headers
   - Uses the download_url field from the API response
```

### 3. Why This Works
- **Simple requests** (GET with no custom headers) don't trigger CORS preflight
- Works identically in both inline and external scripts
- Compatible with `file://` protocol
- Still gets fresh data via URL cache busting (`?t=timestamp`)

### 2. Enhanced Error Logging
Added detailed console logging to help diagnose which method works:
- Logs each attempt
- Shows response status
- Displays error details
- Indicates which method succeeded

## Testing

### Option 1: Use the Test Page
Open `test-cors.html` in your browser to test all fetch methods:

```bash
# From the maps directory
open test-cors.html  # macOS
# or just double-click the file
```

### Option 2: Run a Local Web Server (Recommended)
To avoid CORS issues entirely, serve the files via a local web server:

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js (if you have http-server installed)
npx http-server -p 8000

# PHP
php -S localhost:8000
```

Then open: `http://localhost:8000/index.html`

### Option 3: Use VS Code Live Server
If you're using VS Code:
1. Install the "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Why This Happens

### Browser Security Policies
- **Same-Origin Policy**: Browsers restrict how documents/scripts from one origin can interact with resources from another origin
- **file:// Protocol**: Has the strictest CORS policies because each file is considered a different origin
- **External Scripts**: Some browsers apply stricter CORS rules to external scripts loaded via `<script src="">` compared to inline scripts

### GitHub URLs
- **API Endpoint** (`api.github.com`): Has proper CORS headers, works best
- **Raw Content** (`raw.githubusercontent.com`): Also has CORS headers, but may be blocked in some scenarios
- **no-cors Mode**: Allows the request but makes the response "opaque" (can't read the data), only useful as a last resort

## Verification

After implementing the fix, check the browser console (F12) for logs:

### Success Pattern
```
loadDataFromGitHub: Trying GitHub API (raw) from: https://api.github.com/...
loadDataFromGitHub: GitHub API (raw) response status: 200 OK: true
Loaded 70 points and 16 color groups from GitHub using GitHub API (raw)
```

### Fallback Pattern
```
loadDataFromGitHub: Trying GitHub API (raw) from: https://api.github.com/...
Error with GitHub API (raw): Failed to fetch
loadDataFromGitHub: Trying GitHub Raw URL from: https://raw.githubusercontent.com/...
loadDataFromGitHub: GitHub Raw URL response status: 200 OK: true
Loaded 70 points and 16 color groups from GitHub using GitHub Raw URL
```

## Recommendations

### For Development
1. **Always use a local web server** during development
2. Test with `http://localhost` instead of `file://`
3. Use browser DevTools Network tab to inspect fetch requests

### For Production
1. Deploy to a web server (GitHub Pages, Netlify, Vercel, etc.)
2. Ensure proper CORS headers are set on your server
3. The current implementation should work on any properly configured web server

### For GitHub Pages Deployment
If you want to deploy this to GitHub Pages:

```bash
# Enable GitHub Pages in your repository settings
# Choose the main branch as the source
# Your site will be available at: https://opike.github.io/maps/
```

GitHub Pages automatically serves files with proper headers, so CORS issues won't occur.

## Additional Notes

### Why Inline Scripts Worked
When JavaScript code is inline in the HTML file:
- The browser considers it part of the same document
- Some browsers are more lenient with CORS for inline scripts
- The script executes in the context of the HTML document's origin

### Why External Scripts Failed
When JavaScript code is in an external file:
- The browser loads it as a separate resource
- Stricter CORS policies may apply, especially with `file://` protocol
- Each file may be considered a different origin

### The Fix
By implementing multiple fallback methods, the code now:
1. Tries the best method first (GitHub API)
2. Falls back to alternative methods if needed
3. Provides detailed logging for debugging
4. Works in both development (local) and production (web server) environments

## Troubleshooting

### Still Getting CORS Errors?
1. Check browser console for specific error messages
2. Verify you're using a web server (not `file://`)
3. Try a different browser (Chrome, Firefox, Safari)
4. Check if your network/firewall is blocking GitHub
5. Verify the GitHub repository is public

### Network Issues?
The code includes a 5-second timeout for GitHub fetches and falls back to cached data:
```javascript
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('GitHub fetch timeout')), 5000)
);
```

If GitHub is unreachable, the app will use locally cached points.

## Summary
The fix implements a robust fallback mechanism that tries multiple methods to fetch data from GitHub, with detailed logging to help diagnose issues. For the best experience, always serve the application via a web server rather than opening HTML files directly.

