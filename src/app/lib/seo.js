export const siteName = 'Vidura Kavinda Jayathilake';
export const siteUrl = 'https://vidu1999.github.io/my-portfolio';
export const defaultDescription =
  'Portfolio of Vidura Kavinda Jayathilake, a full-stack developer building web apps, 3D experiences, games, and intelligent systems with React, Next.js, Three.js, Python, and Node.js.';

export const socialLinks = [
  'https://github.com/vidu1999',
  'https://www.linkedin.com/in/vidura-kavinda-a76b34204/',
  'https://x.com/Vidura1999',
  'https://facebook.com/vidura.kavinda.5',
];

export function pageUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalized}`;
}

export function buildMetadata({
  title,
  description = defaultDescription,
  path = '/',
  image = '/og.jpg',
  type = 'website',
} = {}) {
  const url = pageUrl(path);
  const imageUrl = pageUrl(image);
  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} | Full-Stack Developer & 3D Portfolio`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName,
      type,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: siteName }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
    },
  };
}

export const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: siteName,
  url: siteUrl,
  image: pageUrl('/og.jpg'),
  jobTitle: 'Full-Stack Developer',
  description: defaultDescription,
  sameAs: socialLinks,
  knowsAbout: [
    'React',
    'Next.js',
    'Three.js',
    'Node.js',
    'Python',
    'Full-Stack Development',
    '3D Web Experiences',
    'UI/UX Design',
  ],
};

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteName,
  url: siteUrl,
  description: defaultDescription,
  inLanguage: 'en',
};
