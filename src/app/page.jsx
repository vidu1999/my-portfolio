import HomeScreen from '@/app/compenents/HomeScreen';
import { buildMetadata } from '@/app/lib/seo';

export const metadata = buildMetadata({
  path: '/',
  description:
    'Vidura Kavinda Jayathilake — full-stack developer crafting interactive web apps, 3D portfolio experiences, games, and intelligent systems with React, Next.js, Three.js, Python, and Node.js.',
});

export default function HomePage() {
  return <HomeScreen />;
}
