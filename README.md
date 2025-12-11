<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/16w4mOzyA5he7t9u7IEguj_5WQiotov5H

## O que o app faz
- Processa inscrições do edital 003/2025 por curso e cotas (PCD, pública local/ampla, privada local/ampla) com remanejamentos previstos.
- Aceita uploads em CSV ou XLS/XLSX (primeira aba) do Google Forms.
- Mostra notas com separador decimal **vírgula** na interface e nas exportações.
- Exporta resultado com posição, inscrição, nome e situação (classificado/classificável) para PDF, XLS e DOC.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
