# Security

## Reporting a vulnerability

Please open a private security advisory on the GitHub repository rather than a
public issue. Include what you found, how to reproduce it, and what an attacker
could do with it.

## Security model

SignatureSync is a static site plus one serverless function, which removes most
of the attack surface a conventional web app has. There is no database, no
server-side session and no user account system.

**Google access tokens** are issued to the browser by Google Identity Services
and held in memory only. They are never written to `localStorage` or
`sessionStorage`, never sent anywhere except Google's own APIs and the extract
endpoint, and expire after about an hour. Signing out revokes the token with
Google.

**OAuth scope.** The app requests `drive.file`, which grants access only to
spreadsheets the user creates through the app or explicitly selects with the
Google Picker. It cannot read or write anything else in the user's Drive.

**The extract endpoint** (`/api/extract`) holds the model API key, which is the
only secret in the system. It is never exposed to the browser. Every request to
the endpoint must carry a Google access token, which the function verifies with
Google and checks was issued to this deployment's own OAuth client ID, so the
endpoint cannot be called anonymously. `ALLOWED_EMAILS` restricts it further to
named accounts. Requests are size-capped and rate limited per caller.

**Data handling.** Signature text is sent to the configured model provider
during extraction, and to Google Sheets on save. Nothing is persisted by this
application: the contact data exists only in the user's own spreadsheet. The
function logs errors, never contact data.

**Public configuration.** Any variable prefixed `VITE_` is compiled into the
browser bundle and must be treated as public. The Google client ID and API key
are public by design; the API key should be restricted to the Picker API and to
your site origin in the Google Cloud Console.

## Known limitations

- Rate limiting in the function is per instance, since serverless instances do
  not share memory. It blunts a burst from one caller but is not a global
  quota. The Google token requirement is the real access control.
- `drive.file` access to a picked spreadsheet persists until revoked by the
  user in their Google account settings.
