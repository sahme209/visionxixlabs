# HTTP Date source decision — candidate rejected for bounded-time authority

The owner-approved one read of [RFC9110 section6.6.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-6.6.1) is consumed. Only this standard was consulted; no link, native time endpoint, account API, credential, implementation or spending followed.

The section defines message-origination time and recommends the sender's best available approximation. Generation can occur during message origination. A forwarding recipient may append a missing Date or replace an invalid one. It gives no numerical maximum UTC error. Therefore authenticated transport and a short measured round trip alone cannot establish the currently required `earliest/latest` clock interval: they do not bound error already present at the sender. This is an inference from the stated semantics, not a claim of a live AWS clock defect.

Decision: do not implement Date±one/five seconds as a qualified clock, do not read a real endpoint just to collect that header, and do not weaken the existing clock/expiry/closure gates. A header can remain an unqualified diagnostic, never an allow receipt.

Next: investigate an existing authenticated bounded-time protocol and maintained implementation rather than hand-writing an unsupported time guarantee. Roughtime is a candidate to verify, not an adopted service/library or a claim of current availability. Research must establish nonce binding, signature/public-root/delegation validation, returned uncertainty, replay/currentness limits, licensing and native runtime compatibility. No new dependency, trusted key, real time query or production registration is authorized by research.
