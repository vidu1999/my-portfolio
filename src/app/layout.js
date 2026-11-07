import "./globals.css";
import FireFliesBackground from './compenents/FireFliesBackground';
import { buildMetadata, personJsonLd, websiteJsonLd, siteName, siteUrl } from '@/app/lib/seo';

export const metadata = {
  metadataBase: new URL(siteUrl),
  ...buildMetadata(),
  applicationName: siteName,
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  keywords: [
    'Vidura Kavinda Jayathilake',
    'full-stack developer',
    'portfolio',
    'React',
    'Next.js',
    'Three.js',
    '3D portfolio',
    'Python',
    'Node.js',
    'Sri Lanka',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <FireFliesBackground />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </body>
    </html>
  );
}
