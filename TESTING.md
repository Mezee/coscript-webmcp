# coscript WebMCP testing

## Public demo

Open <https://coscript-webmcp.vercel.app/> in ChatGPT's in-app browser, or in
Google Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled.

The app is client-side and does not require an account. The first transcription
downloads the selected model from Hugging Face; use a short local sample for a
quick judge walkthrough.

## Suggested judge walkthrough

1. Open the app and confirm the `coscript` header and upload screen.
2. Load a short video or audio file with a speech track.
3. Confirm the agent can discover the tools exposed for the current screen.
4. Ask the agent to inspect the project, search the transcript, and focus a match.
5. Ask the agent to propose a cleanup or edit; review the visible proposal before applying it.
6. Ask the agent to open export confirmation, then confirm export in the UI.

Tools are contextual: upload, processing, transcript, selection, history, and
export tools register only while their corresponding UI state is visible.

## Local verification

```bash
npm install
npm run test:agent
npm run build
```

`npm run test:agent` covers the semantic command layer, WebMCP diagnostics, and
SDK registration behavior. Use only local or seeded data for state-changing
manual tests.
