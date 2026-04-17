import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ayan.ai — Autonomous Agentic Proctoring Platform',
  description: 'We don\'t detect violations. We reason about behavior. Ayan.ai is the Autonomous Integrity Engine for High-Stakes Assessments.',
  keywords: ['agentic AI', 'autonomous proctoring', 'exam integrity', 'AI proctoring platform', 'online assessment security', 'enterprise proctoring'],
  icons: {
    icon: '/ayan-icon.png',
    apple: '/ayan-icon.png',
  },
  openGraph: {
    title: 'Ayan.ai — Autonomous Agentic Proctoring Platform',
    description: 'We don\'t detect violations. We reason about behavior. The Third Eye of Digital Trust.',
    type: 'website',
    url: 'https://ayan.nunmai.local',
    images: ['/ayan-logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-navy-950 text-gray-300">
        {children}
      </body>
    </html>
  );
}
