export type NewsContentBlock = {
  id?: string;
  text: string;
  imageUrl: string | null;
  imageAlt?: string;
};

export function parseNewsContent(content: string): NewsContentBlock[] {
  if (!content || !content.trim()) return [];
  // Try JSON array of blocks (new format with per-paragraph images)
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && "text" in parsed[0]) {
      return parsed.map((b: any, idx: number) => ({
        id: b.id || `block-${idx}`,
        text: String(b.text ?? ""),
        imageUrl: b.imageUrl || b.image || null,
        imageAlt: b.imageAlt || "",
      })).filter((b) => b.text.trim() || b.imageUrl);
    }
  } catch {}
  // Fallback: handle markdown image syntax ![alt](url) embedded in plain text
  // Split by double newlines, then check each part for markdown image
  const rawParts = content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const blocks: NewsContentBlock[] = [];
  const mdImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  for (const part of rawParts) {
    const images: Array<{ alt: string; url: string }> = [];
    let match: RegExpExecArray | null;
    // Reset regex lastIndex
    mdImageRegex.lastIndex = 0;
    while ((match = mdImageRegex.exec(part)) !== null) {
      images.push({ alt: match[1], url: match[2] });
    }
    if (images.length > 0) {
      // Remove markdown images from text, keep text part
      const textOnly = part.replace(mdImageRegex, "").trim();
      if (textOnly) blocks.push({ text: textOnly, imageUrl: null });
      for (const img of images) {
        blocks.push({ text: "", imageUrl: img.url, imageAlt: img.alt });
      }
    } else {
      // Split by single newlines as separate paragraphs if needed
      const lines = part.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        blocks.push({ text: line, imageUrl: null });
      }
    }
  }
  return blocks.length ? blocks : [{ text: content, imageUrl: null }];
}

export function hasCoverImage(imageUrl: string | null): boolean {
  return !!imageUrl && imageUrl.trim().length > 0;
}

export function getCoverImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl || !imageUrl.trim()) return null;
  return imageUrl.trim();
}
