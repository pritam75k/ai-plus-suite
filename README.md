# AI Plus Suite - Image Studio UI + Free Ollama Chat

This version includes a redesigned dark premium web UI similar to the mockup:
- Left sidebar with New Chat, History, Images, Settings, Profile
- Main chat area with a bottom composer
- Image Generator logo/button beside the chat input
- Right-side Image Studio panel
- Free local chat with Ollama/TinyLlama
- Console OTP fallback for testing
- Optional OpenAI image generation if you add an OpenAI API key

## Start server
```powershell
cd "C:\Users\Admin\Downloads\ai-plus-suite\server"
npm install
npm run dev
```

Health check:
```text
http://localhost:8080/api/health
```

## Start website
Open another PowerShell:
```powershell
cd "C:\Users\Admin\Downloads\ai-plus-suite\web"
npm install
npm run dev
```

Open:
```text
http://localhost:5173
```

## Free AI setup
Install Ollama, then:
```powershell
ollama pull tinyllama
```

Set server/.env:
```env
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=tinyllama
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

In console fallback mode, OTP appears in the server PowerShell window.


## Free image generation

Set `IMAGE_PROVIDER=pollinations` in `server/.env` to generate images without OpenAI billing. This uses a public internet image endpoint, so internet must be working.

## Multilingual local chat

For better Hindi/Marathi/English/Hinglish replies on low-RAM laptops, try `ollama pull qwen2.5:1.5b` and set `OLLAMA_MODEL=qwen2.5:1.5b`.


## Public launch

This build includes `/web/public/logo.svg`, favicon/manifest, and backend static serving for `web/dist`. Run `./launch-public-build.ps1`, then start the server and expose `http://localhost:8080` using Cloudflare Tunnel or ngrok. See `PUBLIC_LAUNCH.md`.
