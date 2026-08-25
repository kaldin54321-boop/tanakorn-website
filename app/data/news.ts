export interface NewsArticle {
  slug: string;
  category: string;
  date: string;
  title: string;
  description: string;
  content: string[];
}

export const newsArticles: NewsArticle[] = [

  {
    slug: "winlator-frost-11-1-released",

    category: "RELEASE",

    date: "August 22, 2026",

    title:
      "Winlator@Frost 11.1 Released",

    description:
      "The latest Winlator@Frost release is now available with new improvements, updated components and additional customization options.",

    content: [
      "Winlator@Frost 11.1 is now available.",

      "This release introduces improvements to the Frost experience, updated components and additional customization options.",

      "Visit the Downloads page to obtain the latest release.",
    ],
  },


  {
    slug: "graphics-driver-updates",

    category: "UPDATE",

    date: "August 18, 2026",

    title:
      "Graphics Driver Updates",

    description:
      "Learn about the latest graphics driver improvements and compatibility updates available for Frost.",

    content: [
      "Graphics support continues to be an important part of the Frost project.",

      "This update focuses on improving compatibility and keeping the graphics stack up to date.",
    ],
  },


  {
    slug: "the-future-of-frost",

    category: "DEVELOPMENT",

    date: "August 10, 2026",

    title:
      "The Future of Frost",

    description:
      "A look at the future direction of Winlator@Frost and some of the features currently being developed.",

    content: [
      "The Frost project continues to evolve.",

      "Future development will focus on performance, compatibility, customization and improving the overall user experience.",
    ],
  },

];