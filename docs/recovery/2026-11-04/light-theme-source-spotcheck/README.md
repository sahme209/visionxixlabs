# Light-theme source spot check

The enabled Bot composer counter/status uses neutral-zinc-500 (#69645b), with an opaque light prompt surface #fffef9. Literal sRGB pair ratio5.817914. Ticket record/digest/expiry uses that foreground; literal canvas/elevation candidates #faf9f5/#f0eee6 yield5.576474/5.057229, but the exact inherited final backdrop remains unverified. Root independently recalculated the pairs and inspected theme mappings. No definite failing pair was established in these two source surfaces, so no speculative color change was made.

This does not verify rendered opacity/compositing, complete light/dark contrast, accessibility/AT or product-wide compliance. No browser, native, provider or test action occurred for this source-only calculation.
