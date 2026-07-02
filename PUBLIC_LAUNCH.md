# Premium AI — Free Public Launch

This version has a logo, favicon, and one-port public launch setup.

## Local public launch with Cloudflare Tunnel (free temporary URL)

1. Make sure Ollama is running and your model is available:

```powershell
ollama list
```

2. Build the website so the backend can serve it on the same port:

```powershell
cd "C:\Users\Admin\Downloads\ai-plus-suite\web"
npm run build
```

3. Start the server:

```powershell
cd "C:\Users\Admin\Downloads\ai-plus-suite\server"
npm run dev
```

4. Open locally first:

```text
http://localhost:8080
```

5. In a new PowerShell window, create a free public URL:

```powershell
cloudflared tunnel --url http://localhost:8080
```

Copy the `https://....trycloudflare.com` URL and share it.

## Alternative: ngrok

```powershell
ngrok http 8080
```

Copy the HTTPS forwarding URL.

## Notes

- Laptop must stay ON.
- Server PowerShell must stay open.
- Ollama must stay running.
- OTP is currently console fallback, so public users cannot receive email OTP unless SMTP is configured.
- For real public users, add Gmail App Password SMTP in `server/.env`.
- Free tunnel URLs can change every time you restart the tunnel.
