import Image from 'next/image';
import Contact from '@/app/compenents/contact';
import { publicAsset } from '@/app/lib/publicAsset';
import { buildMetadata } from '@/app/lib/seo';

export const metadata = buildMetadata({
  title: 'Contact',
  path: '/contact/',
  description:
    'Contact Vidura Kavinda Jayathilake for full-stack development, 3D web experiences, React/Next.js projects, and software collaboration.',
});

export default function ContactPage() {
  return (
    <>
      <div className="fixed inset-0 z-0">
        <Image
          src={publicAsset('bg/cbg.webp')}
          alt="Decorative contact page background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-25"
        />
      </div>

      <Contact />
    </>
  );
}
