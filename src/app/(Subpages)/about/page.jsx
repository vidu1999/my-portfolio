import Image from 'next/image';
import RenderModels from '@/app/compenents/RenderModels';
import About from '@/app/compenents/about';
import Book from '@/app/compenents/models/Book';
import { publicAsset } from '@/app/lib/publicAsset';
import { buildMetadata } from '@/app/lib/seo';

export const metadata = buildMetadata({
  title: 'About',
  path: '/about/',
  description:
    'Learn about Vidura Kavinda Jayathilake, a full-stack developer focused on React, Next.js, Three.js, Python, cloud tools, and polished interactive user experiences.',
});

export default function AboutPage() {
  return (
    <>
      <div className="fixed inset-0 z-0">
        <Image
          src={publicAsset('bg/abg.webp')}
          alt="Decorative about page background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-25"
        />
      </div>

      <div className="w-full h-screen bottom-0 fixed">
        <RenderModels>
          <Book />
        </RenderModels>
      </div>

      <About />
    </>
  );
}
