# Agent-native ReScript MVP

This fork adds a semantic agent command layer under `lib/agent/`. The layer reads and edits the existing Zustand editor state without driving DOM controls.

WebMCP registration is owned by the UI that makes each journey valid. The upload screen registers project discovery and only exposes opening when a saved target exists. Processing exposes one status tool. The transcript owns ready-state reads and selection-scoped tools. Editor chrome owns focus, reversible history, cleanup proposals, and the export handoff. Agent activity owns pending-plan review. Component scopes declare and withdraw tools independently; a coordinator coalesces their union into one SDK batch per state transition so a long-lived SPA does not emit duplicate registration churn. Registrars key contextual lifetimes to project, selection, modal, viewport, undo/redo, and proposal state. SDK telemetry is disabled.

Public tools are journey-oriented rather than command routers and are capped at ten distinct wire names across the document lifecycle. `inspect_project` adapts between processing and ready state, while `navigate_edit_history` advertises only the undo/redo directions currently available. Meaningful transcript changes first create a visible proposal; `review_proposed_edit` appears only while that proposal is current. Export stops at the app's confirmation dialog, and its opener unregisters while the dialog is open. On narrow layouts, proposal tools remain absent because the Agent activity review UI is not visible.

The internal command layer still covers project context, transcript search, selection context, semantic edits, navigation, history, plan proposal/review, and export confirmation. It remains available to Rescript code and tests, but WebMCP exposes only the smaller state-valid journey surface. `apply_edit_plan` remains one undoable internal transaction. Agent transactions and manual editor edits are retained separately in history.

`components/AgentPanel.tsx` is intentionally an activity surface rather than a chatbot. Chat remains in the external agent; the editor shows connection state, recent operations, transactions, a proposed edit plan with Preview / Apply / Reject, and a one-click cleanup action.

Run `npm run test:agent` to verify semantic commands, stable word-id preservation, one-step batch undo, plan approval, export confirmation, and transaction history.

## License note

This implementation is based on upstream commit `41d14daec749332894c4332abc98b230c70286e6`, which is released under the MIT License. Retain the upstream MIT notice in `LICENSE` and review all new dependencies before distribution.
