import "server-only";

export const GRAFANA_SIGNATURE_HEADER = "x-grafana-alerting-signature";
export const GRAFANA_TIMESTAMP_HEADER = "x-grafana-alerting-timestamp";

// Local freshness policy for timestamped deliveries. Body-only signing remains
// compatible with Grafana contact points that omit the timestamp setting.
const MAX_CLOCK_SKEW_SECONDS = 300;

export function readGrafanaSignature(headers: Headers, body: Buffer, now = Date.now()) {
  const signature = headers.get(GRAFANA_SIGNATURE_HEADER);
  const timestamp = headers.get(GRAFANA_TIMESTAMP_HEADER);
  if (signature === null && timestamp === null) return {kind: "absent"} as const;
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature)) return {kind: "invalid"} as const;
  if (timestamp === null) return {kind: "signed", signature, bytes: body} as const;
  if (!/^[1-9][0-9]{0,11}$/.test(timestamp) ||
      Math.abs(Math.floor(now / 1000) - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
    return {kind: "invalid"} as const;
  }
  return {kind: "signed", signature, bytes: Buffer.concat([Buffer.from(timestamp + ":"), body])} as const;
}
