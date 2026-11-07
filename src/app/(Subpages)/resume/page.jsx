import { buildMetadata } from '@/app/lib/seo';
import { publicAsset } from '@/app/lib/publicAsset';

export const metadata = buildMetadata({
  title: 'Resume',
  path: '/resume/',
  description: 'View or download the resume of Vidura Kavinda Jayathilake, full-stack developer.',
});

export default function ResumePage() {
  const resumeUrl = publicAsset('resume.pdf');
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4">
      <h1 className="sr-only">Resume of Vidura Kavinda Jayathilake</h1>
      <div className="flex-col justify-center space-x-4 w-full">
        <embed
          src={resumeUrl}
          type="application/pdf"
          width="100%"
          height="600px"
          title="Resume of Vidura Kavinda Jayathilake"
        />
      </div>
      <a
        href={resumeUrl}
        target="_blank"
        rel="noopener noreferrer"
        download="VKJ.pdf"
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md"
      >
        Download Resume
      </a>
    </div>
  );
}
