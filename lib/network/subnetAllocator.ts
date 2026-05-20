/**
 * Pure network-engineer IPv4 subnet allocator (CIDR math, no deps).
 *
 * Given a parent CIDR (e.g. 10.0.0.0/16) and a list of requested
 * subnet sizes (in CIDR suffixes, e.g. /24 /24 /26), allocate
 * non-overlapping child CIDRs starting at the parent's base. Returns
 * each allocation + any unsatisfied requests.
 *
 * Pure / deterministic. IPv4 only — the platform's network surfaces
 * speak IPv6 separately.
 */

export interface SubnetRequest {
  /** Operator-readable label. */
  label: string;
  /** Desired CIDR suffix (16..32). */
  prefixLength: number;
}

export interface SubnetAllocation {
  label: string;
  cidr: string;
  prefixLength: number;
  /** First usable host address. */
  firstHost: string;
  /** Last usable host address. */
  lastHost: string;
  /** Number of usable hosts (total addresses − 2 network/broadcast). */
  usableHosts: number;
}

export interface AllocateResult {
  allocations: SubnetAllocation[];
  unsatisfied: SubnetRequest[];
  parentCidr: string;
  remainingHosts: number;
}

const parseIPv4 = (s: string): number | null => {
  const m = s.split(".");
  if (m.length !== 4) return null;
  let acc = 0;
  for (let i = 0; i < 4; i++) {
    const n = Number(m[i]);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    acc = (acc * 256) + n;
  }
  return acc >>> 0;
};

const formatIPv4 = (n: number): string => {
  const a = (n >>> 24) & 0xff;
  const b = (n >>> 16) & 0xff;
  const c = (n >>> 8) & 0xff;
  const d = n & 0xff;
  return `${a}.${b}.${c}.${d}`;
};

export interface ParsedCidr {
  network: number;
  prefixLength: number;
  size: number;
}

export function parseCidr(cidr: string): ParsedCidr | null {
  const [ipStr, prefStr] = cidr.split("/");
  const ip = parseIPv4(ipStr ?? "");
  const prefix = Number(prefStr);
  if (ip === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const size = prefix === 0 ? 4294967296 : 2 ** (32 - prefix);
  // Mask the network address to remove any host bits the caller passed.
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return { network: ip & mask, prefixLength: prefix, size };
}

function buildAllocation(label: string, network: number, prefix: number): SubnetAllocation {
  const size = prefix === 0 ? 4294967296 : 2 ** (32 - prefix);
  const last = network + size - 1;
  // /31 + /32 don't follow the usual host math.
  const usableHosts = prefix >= 31 ? size : Math.max(0, size - 2);
  const firstHost = prefix >= 31 ? formatIPv4(network) : formatIPv4(network + 1);
  const lastHost = prefix >= 31 ? formatIPv4(last) : formatIPv4(last - 1);
  return {
    label,
    cidr: `${formatIPv4(network)}/${prefix}`,
    prefixLength: prefix,
    firstHost,
    lastHost,
    usableHosts,
  };
}

export function allocateSubnets(input: {
  parentCidr: string;
  requests: readonly SubnetRequest[];
}): AllocateResult {
  const parent = parseCidr(input.parentCidr);
  if (!parent) {
    return {
      allocations: [],
      unsatisfied: [...input.requests],
      parentCidr: input.parentCidr,
      remainingHosts: 0,
    };
  }

  // Greedy: sort requests by largest subnet first (smallest prefix).
  // That mirrors how operators do it on paper and avoids fragmentation.
  const sorted = [...input.requests].sort((a, b) => a.prefixLength - b.prefixLength);
  let cursor = parent.network;
  const parentEnd = parent.network + parent.size;
  const allocations: SubnetAllocation[] = [];
  const unsatisfied: SubnetRequest[] = [];

  for (const req of sorted) {
    if (!Number.isInteger(req.prefixLength) || req.prefixLength < parent.prefixLength || req.prefixLength > 32) {
      unsatisfied.push(req);
      continue;
    }
    const size = req.prefixLength === 0 ? 4294967296 : 2 ** (32 - req.prefixLength);
    // Align cursor to the subnet boundary.
    const aligned = Math.ceil(cursor / size) * size;
    if (aligned + size > parentEnd) {
      unsatisfied.push(req);
      continue;
    }
    allocations.push(buildAllocation(req.label, aligned, req.prefixLength));
    cursor = aligned + size;
  }

  const consumed = cursor - parent.network;
  return {
    allocations,
    unsatisfied,
    parentCidr: input.parentCidr,
    remainingHosts: Math.max(0, parent.size - consumed),
  };
}
