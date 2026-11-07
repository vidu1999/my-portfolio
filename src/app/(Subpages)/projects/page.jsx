import Image from 'next/image';
import RenderModels from '@/app/compenents/RenderModels';
import ProjectList from '@/app/compenents/projects';
import Branch from '@/app/compenents/models/Branch';
import Stump from '@/app/compenents/models/Stump';
import { publicAsset } from '@/app/lib/publicAsset';
import { buildMetadata } from '@/app/lib/seo';

export const metadata = buildMetadata({
  title: 'Projects',
  path: '/projects/',
  description:
    'Explore projects by Vidura Kavinda Jayathilake, including QuickBite, 3D portfolios, games, attendance systems, language identification, rental platforms, and maintenance apps.',
});

export default function ProjectsPage() {
  return (
    <>
      <div className="fixed inset-0 z-0">
        <Image
          src={publicAsset('bg/pbg.webp')}
          alt="Decorative projects page background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-25"
        />
      </div>

      <div className="w-full h-screen bottom-0 fixed">
        <RenderModels>
          <Branch />
        </RenderModels>
      </div>

      <div className="w-full h-screen fixed bottom-0">
        <RenderModels>
          <Stump />
        </RenderModels>
      </div>

      <ProjectList />
    </>
  );
}
