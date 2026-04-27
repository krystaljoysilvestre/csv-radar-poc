export interface NewsFeed {
  name: string;
  url: string;
}

const defaultNewsFeeds: NewsFeed[] = [
  {
    name: "Google News: Philippines Energy Policy",
    url: "https://news.google.com/rss/search?q=Philippines%20energy%20policy&hl=en-PH&gl=PH&ceid=PH:en",
  },
  {
    name: "Google News: DOE ERC Philippines",
    url: "https://news.google.com/rss/search?q=DOE%20ERC%20Philippines%20energy&hl=en-PH&gl=PH&ceid=PH:en",
  },
];

function readableFeedName(url: string, index: number) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return `Configured Feed ${index + 1}: ${host}`;
  } catch {
    return `Configured Feed ${index + 1}`;
  }
}

function parseEnvNewsFeeds(value: string | undefined): NewsFeed[] {
  if (!value?.trim()) {
    return defaultNewsFeeds;
  }

  const urls = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!urls.length) {
    return defaultNewsFeeds;
  }

  return urls.map((url, index) => ({
    name: readableFeedName(url, index),
    url,
  }));
}

export const newsFeeds = parseEnvNewsFeeds(
  process.env.NEWS_FEEDS ?? process.env.NEWS_SOURCES,
);

export const policySources = [
  {
    name: "DOE" as const,
    baseUrl: "https://www.doe.gov.ph",
    entryPaths: ["/", "/laws-and-issuances", "/energy-virtual-one-stop-shop"],
    seedUrls: [
      "https://www.doe.gov.ph/laws-and-issuances",
      "https://www.doe.gov.ph/energy-virtual-one-stop-shop",
      "https://www.doe.gov.ph/announcements",
    ],
  },
  {
    name: "ERC" as const,
    baseUrl: "https://www.erc.gov.ph",
    entryPaths: ["/", "/Pages/Issuances.aspx", "/ContentPage/47"],
    seedUrls: [
      "https://www.erc.gov.ph/Pages/Issuances.aspx",
      "https://www.erc.gov.ph/ContentPage/47",
      "https://www.erc.gov.ph/Pages/NewsAndUpdates.aspx",
    ],
  },
];

export const policyKeywords = [
  "policy",
  "circular",
  "order",
  "resolution",
  "guideline",
  "issuance",
  "memorandum",
  "advisory",
  "psa",
  "ppa",
  "pdf",
];
