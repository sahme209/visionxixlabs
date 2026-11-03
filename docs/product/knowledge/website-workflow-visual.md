# Product workflow illustration

Help ID: `website.product.workflow`

The Product page's **Conceptual workflow** is an original illustration of five records in a deployment workflow. It is available in this local source preview only. It is not an application screenshot, a live account view, a released capability statement, or evidence that an operation ran.

Choose a numbered stage to read its explanation. A border, arrow and pressed state identify the selection; color is supplementary. The ordered sequence remains visible: Repository context → Exact proposal → Independent review → Separate requester execution → Recorded outcome and recovery. Selection changes only local explanatory text, never approvals or provider state. It does not open an account, fetch data, start playback, or execute an action.

## Controls and keyboard

All five controls are ordinary focusable buttons. Tab and Shift+Tab move through them; Enter or Space selects a focused button. Arrow keys select and focus the previous/next stage, wrapping at the ends. Home selects the first stage; End selects the last. Focus stays on the stage control while its associated record region updates. Each component instance generates unique IDs for its controls, help and shared record region, linked with `aria-controls`, `aria-labelledby` and `aria-describedby`.

| Visible control | Documentation help ID | Effect |
| --- | --- | --- |
| Repository context | `website.product.workflow.context` | Select scope record explanation |
| Exact proposal | `website.product.workflow.proposal` | Select exact change explanation |
| Independent review | `website.product.workflow.review` | Select independent review explanation |
| Separate requester execution | `website.product.workflow.intent` | Select requester intent explanation |
| Recorded outcome and recovery | `website.product.workflow.outcome` | Select evidence and uncertainty explanation |

These help IDs describe the actual controls in `components/marketing/WorkflowEvidenceMap.tsx`. They are content identifiers, not installed retrieval bindings or stable DOM IDs. DOM IDs are generated per instance.

## Limits and recovery

The conceptual label precedes the controls. Installed-version/enabled-workflow guidance and incomplete Governance Intelligence notice remain visible for every selection. The surrounding Product page retains its current support qualifications, scripted preview and setup links.

The outcome record distinguishes confirmed evidence, refusal and unresolved unknown results. No example claims a successful deployment. A recovery plan is not proof of recovery. These statements teach the workflow; this surface cannot inspect a real uncertain action, reconcile it, retry it, restore approval, or establish execution authority. Consult the supported installed workflow and its evidence for an actual operation.

There is no timer, autoplay, motion, persisted selection or animation library. Reloading starts at Repository context. There are no account, permission, provider, runtime or activation changes. Mounted tests establish local presentation behavior only; actual browser, responsive, build and wider accessibility acceptance are separate checks.
