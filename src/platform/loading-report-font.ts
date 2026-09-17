import unicodeRanges from "@fontsource/noto-sans-jp/unicode.json";

const fontAssetUrls = import.meta.glob<string>(
  "/node_modules/@fontsource/noto-sans-jp/files/*-400-normal.woff",
  { eager: true, import: "default", query: "?url" },
);

interface CodePointRange {
  readonly end: number;
  readonly start: number;
}

interface FontShard {
  readonly id: string;
  readonly ranges: readonly CodePointRange[];
  readonly url: string;
}

function parseRange(value: string): CodePointRange {
  const [startText, endText] = value.slice(2).split("-");
  const start = Number.parseInt(startText ?? "", 16);
  const end = Number.parseInt(endText ?? startText ?? "", 16);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) {
    throw new Error("Invalid Noto Sans JP unicode range metadata.");
  }
  return { end, start };
}

function assetUrlForShard(id: string): string {
  const suffix = `/noto-sans-jp-${id}-400-normal.woff`;
  const match = Object.entries(fontAssetUrls).find(([path]) => path.endsWith(suffix));
  if (match === undefined) {
    throw new Error("Noto Sans JP font asset is missing.");
  }
  return match[1];
}

const FONT_SHARDS: readonly FontShard[] = Object.entries(unicodeRanges).map(
  ([rawId, ranges]) => {
    const id = rawId.replace(/^\[/, "").replace(/\]$/, "");
    return {
      id,
      ranges: ranges.split(",").map(parseRange),
      url: assetUrlForShard(id),
    };
  },
);

const shardByCodePoint = new Map<number, FontShard | null>();
const fontBytesByShard = new Map<string, Promise<Uint8Array>>();

export function loadingReportFontShardForCodePoint(
  codePoint: number,
): string | undefined {
  const cached = shardByCodePoint.get(codePoint);
  if (cached !== undefined) return cached?.id;

  const shard =
    FONT_SHARDS.find((candidate) =>
      candidate.ranges.some(
        (range) => codePoint >= range.start && codePoint <= range.end,
      ),
    ) ?? null;
  shardByCodePoint.set(codePoint, shard);
  return shard?.id;
}

export async function loadLoadingReportFontShard(
  shardId: string,
): Promise<Uint8Array> {
  const existing = fontBytesByShard.get(shardId);
  if (existing !== undefined) return existing;

  const shard = FONT_SHARDS.find((candidate) => candidate.id === shardId);
  if (shard === undefined) {
    throw new Error("Unknown Noto Sans JP font shard.");
  }
  const pending = fetch(shard.url).then(async (response) => {
    if (!response.ok) {
      throw new Error("Noto Sans JP font asset could not be loaded.");
    }
    return new Uint8Array(await response.arrayBuffer());
  });
  fontBytesByShard.set(shardId, pending);
  try {
    return await pending;
  } catch (error) {
    fontBytesByShard.delete(shardId);
    throw error;
  }
}
