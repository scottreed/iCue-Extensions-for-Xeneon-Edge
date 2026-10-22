# Library Player: Spotify setup

Library Player shows your Spotify playlists, the songs inside them, your queue, and what's playing, with controls. It talks to Spotify through your own free developer app, so the one-time setup below is needed.

## Requirements
- Spotify **Premium**. Spotify requires it for playback control, and for the account that owns a developer app.
- The Spotify desktop app running on the same PC (the widget controls it).
- iCUE 5.44 or later and a XENEON EDGE.

## 1. Publish the callback page (once per repo)
The sign-in needs a tiny HTTPS page that shows you a code.
1. Push this repository to GitHub.
2. In the repo, open **Settings > Pages**, set **Source** to *Deploy from a branch*, branch `main`, folder `/docs`.
3. After a minute your page is live at `https://<your-username>.github.io/<repo-name>/callback/`. Keep the trailing slash.

## 2. Create a Spotify app
1. Go to <https://developer.spotify.com/dashboard> and choose **Create app**.
2. Any name and description (do not include "Spotify" in the name).
3. **Redirect URI**: paste the exact callback URL from step 1.
4. Tick **Web API** and save.
5. Open the app's **Settings** and copy the **Client ID**.
6. Under **User management**, add the Spotify email of anyone else who will use it (development mode allows 5 users; you are included automatically).

## 3. Configure the widget in iCUE
Add the widget to your XENEON EDGE, then open its settings:
- **Spotify Client ID**: the ID from step 2.
- **Redirect page URL**: the exact same callback URL you registered.

## 4. Connect
1. Tap **Connect** on the widget. Your browser opens Spotify's approval page; approve it.
2. You land on the callback page. Copy the code it shows.
3. Paste it into **Paste code here** in the widget settings.
4. The widget signs in and loads your library. It keeps you signed in and refreshes access on its own.

## Good to know
- **Followed playlists** (made by Spotify or other people) may show as *Play only*. In Spotify's development mode the API only lists songs for playlists you own or collaborate on. You can still play them.
- **Nothing playing / no device**: start Spotify on this PC, then play something once.
- **Free accounts**: browsing works, but playback controls need Premium.
- To sign out, clear the **Paste code here** setting and remove the widget, or revoke the app at <https://www.spotify.com/account/apps/>.
- Spotify rate limits are low in development mode; the widget checks every few seconds and backs off automatically.
