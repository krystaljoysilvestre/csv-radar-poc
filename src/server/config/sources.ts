export const newsFeeds = [
  {
    name: "Google News: Philippines Energy Policy",
    url: "https://news.google.com/rss/search?q=Philippines%20energy%20policy&hl=en-PH&gl=PH&ceid=PH:en",
  },
  {
    name: "Google News: DOE ERC Philippines",
    url: "https://news.google.com/rss/search?q=DOE%20ERC%20Philippines%20energy&hl=en-PH&gl=PH&ceid=PH:en",
  },
];

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
