import { connect } from "node:net";
import { once } from "node:events";
import { expect, it } from "vitest";
import { startOwnedAwsWireFixture } from "../../scripts/fixtures/ownedAwsWireFixture.mjs";

it("closes its active incomplete HTTP connection without waiting for the client", async () => {
  const fixture = await startOwnedAwsWireFixture();
  const socket = connect(Number(new URL(fixture.origin).port), "127.0.0.1");
  socket.on("error", () => {});
  try {
    await once(socket, "connect");
    socket.write("POST / HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Length: 999\r\n");
    // Let the owned HTTP server accept an intentionally incomplete request.
    await new Promise(resolve => setTimeout(resolve, 10));
    const closed = once(socket, "close");
    await fixture.close();
    await closed;
    expect(socket.destroyed).toBe(true);
    await fixture.close(); // Cleanup remains safe after an earlier close.
  } finally { socket.destroy(); await fixture.close(); }
});
