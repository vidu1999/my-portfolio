import "./globals.css";
import "@fontsource/chakra-petch/latin-500.css";
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/chakra-petch/latin-700.css";
import FireFliesBackground from './compenents/FireFliesBackground';
import LoadingScreen from './compenents/loading/LoadingScreen';
import AiGuide from './compenents/AiGuide';
import { buildMetadata, personJsonLd, websiteJsonLd, siteName, siteUrl } from '@/app/lib/seo';

// Runs before hydration so a returning visitor in the same session never sees a
// flash of the loader. Kept tiny and defensive — storage can throw in private mode.
const loaderGate = `(function(){try{if(sessionStorage.getItem('vkj-loader-seen')==='1'){document.documentElement.setAttribute('data-vkj-seen','1');}}catch(e){}})();`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: loaderGate }} />
      </head>
      <body>
        <LoadingScreen />
        {children}
        <FireFliesBackground />
        <AiGuide />
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
