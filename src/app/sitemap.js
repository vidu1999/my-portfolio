import { siteUrl } from '@/app/lib/seo';

export default function sitemap() {
  const lastModified = new Date();
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${siteUrl}/about/`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/projects/`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${siteUrl}/contact/`, lastModified, changeFrequency: 'yearly', priority: 0.7 },
    { url: `${siteUrl}/resume/`, lastModified, changeFrequency: 'yearly', priority: 0.6 },
  ];
}
