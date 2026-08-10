const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const slugifyHeading = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");

type LegalMarkdownOptions = {
  renderLicenseButtons?: boolean;
  stripReferenceDirs?: boolean;
  legalReferenceHrefByPath?: Partial<Record<string, string>>;
};

const isClickableReference = (value: string): boolean =>
  value === "NOTICE.md" || value.startsWith("licenses/");

const renderLicenseLink = (href: string, label: string): string =>
  `<a class="gw-license-link" href="${href}"><code>${label}</code></a>`;

const renderLicenseButton = (legalPath: string, label: string): string =>
  `<button type="button" class="gw-license-link" data-license-path="${legalPath}"><code>${label}</code></button>`;

const renderListItem = (value: string, options: LegalMarkdownOptions): string =>
  `<li>${renderInlineMarkdown(value, options)}</li>`;

const getLegalReferenceLabel = (value: string, stripDirectories: boolean): string =>
  stripDirectories ? (value.split("/").at(-1) ?? value) : value;

const METADATA_LINE_PATTERN =
  /^(Packages?|Copyright|Website|Homepage|Repository|Authors?|Maintainers?|License|Licenses|Full license text):?\b/iu;
const REFERENCE_LINE_PATTERN = /^See\s+`[^`]+`/u;

const AUTOLINK_PATTERN = /<(https?:\/\/[^<>\s]+)>|(https?:\/\/[^\s<>]+)/gu;
const TRAILING_URL_PUNCTUATION = /[.,!?;:'"]/u;

const trimUrlPunctuation = (rawUrl: string): { trailingText: string; url: string } => {
  let url = rawUrl;
  let trailingText = "";

  const trailingBracketPairs = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ] as const;

  while (url.length > 0) {
    const lastCharacter = url.at(-1);
    if (!lastCharacter) {
      break;
    }

    if (TRAILING_URL_PUNCTUATION.test(lastCharacter)) {
      trailingText = lastCharacter + trailingText;
      url = url.slice(0, -1);
      continue;
    }

    const trailingBracketPair = trailingBracketPairs.find(
      ([, closing]) => closing === lastCharacter,
    );
    if (!trailingBracketPair) {
      break;
    }

    const [opening, closing] = trailingBracketPair;
    const openingCount = [...url].filter((character) => character === opening).length;
    const closingCount = [...url].filter((character) => character === closing).length;

    if (closingCount <= openingCount) {
      break;
    }

    trailingText = lastCharacter + trailingText;
    url = url.slice(0, -1);
  }

  return { trailingText, url };
};

const renderTextSegment = (value: string): string => {
  let result = "";
  let lastIndex = 0;

  for (const match of value.matchAll(AUTOLINK_PATTERN)) {
    const matchText = match[0];
    const angleBracketUrl = match[1];
    const plainUrl = match[2];
    const matchIndex = match.index ?? -1;

    if (!matchText || matchIndex < 0) {
      continue;
    }

    result += escapeHtml(value.slice(lastIndex, matchIndex));
    const { trailingText, url } = angleBracketUrl
      ? { trailingText: "", url: angleBracketUrl }
      : trimUrlPunctuation(plainUrl ?? "");

    if (!url) {
      result += escapeHtml(matchText);
      lastIndex = matchIndex + matchText.length;
      continue;
    }

    const escapedUrl = escapeHtml(url);
    result += `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
    result += escapeHtml(trailingText);
    lastIndex = matchIndex + matchText.length;
  }

  result += escapeHtml(value.slice(lastIndex));
  return result;
};

const renderInlineMarkdown = (
  value: string,
  options: LegalMarkdownOptions = {},
): string =>
  value
    .split(/(`[^`]+`)/g)
    .filter(Boolean)
    .map((part) => {
      if (!part.startsWith("`") || !part.endsWith("`")) {
        return renderTextSegment(part);
      }

      const inlineCode = part.slice(1, -1);

      if (options.renderLicenseButtons && isClickableReference(inlineCode)) {
        const legalPath = escapeHtml(inlineCode);
        const label = escapeHtml(
          getLegalReferenceLabel(inlineCode, options.stripReferenceDirs ?? false),
        );
        const href = options.legalReferenceHrefByPath?.[inlineCode];

        if (href) {
          return renderLicenseLink(escapeHtml(href), label);
        }

        return renderLicenseButton(legalPath, label);
      }

      return `<code>${escapeHtml(inlineCode)}</code>`;
    })
    .join("");

const preserveParagraphBreaks = (lines: string[]): boolean =>
  lines.length > 1 &&
  lines.every(
    (line) => METADATA_LINE_PATTERN.test(line) || REFERENCE_LINE_PATTERN.test(line),
  );

export const renderLegalMarkdown = (
  source: string,
  options: LegalMarkdownOptions = {},
): string => {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let blockquote: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return;
    }

    const separator = preserveParagraphBreaks(paragraph) ? "<br />" : " ";
    blocks.push(
      `<p>${paragraph.map((line) => renderInlineMarkdown(line, options)).join(separator)}</p>`,
    );
    paragraph = [];
  };

  const flushList = (): void => {
    if (list.length === 0) {
      return;
    }

    const items = list.map((item) => renderListItem(item, options)).join("");
    blocks.push(`<ul>${items}</ul>`);
    list = [];
  };

  const flushBlockquote = (): void => {
    if (blockquote.length === 0) {
      return;
    }

    blocks.push(
      `<blockquote><p>${renderInlineMarkdown(blockquote.join(" "), options)}</p></blockquote>`,
    );
    blockquote = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushBlockquote();
      continue;
    }

    if (/^-{3,}$/u.test(trimmed)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      blocks.push("<hr />");
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const heading = trimmed.slice(2);
      blocks.push(`<h1 id="${slugifyHeading(heading)}">${escapeHtml(heading)}</h1>`);
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const heading = trimmed.slice(3);
      blocks.push(`<h2 id="${slugifyHeading(heading)}">${escapeHtml(heading)}</h2>`);
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const heading = trimmed.slice(4);
      blocks.push(`<h3 id="${slugifyHeading(heading)}">${escapeHtml(heading)}</h3>`);
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      flushBlockquote();
      list.push(trimmed.slice(2));
      continue;
    }

    if (trimmed.startsWith("> ")) {
      flushParagraph();
      flushList();
      blockquote.push(trimmed.slice(2));
      continue;
    }

    flushList();
    flushBlockquote();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushBlockquote();

  return blocks.join("");
};

export const applyLegalSemantics = (
  root: HTMLElement,
  fallbackHeadingId = "legal-document",
): void => {
  const firstHeading = root.querySelector<HTMLHeadingElement>("h1, h2, h3");
  if (!firstHeading) {
    return;
  }

  if (!firstHeading.id) {
    firstHeading.id = slugifyHeading(firstHeading.textContent ?? fallbackHeadingId);
  }

  root.setAttribute("aria-labelledby", firstHeading.id);
};
