import './globals.css';
import type { Metadata } from 'next';
import { Sidebar } from '../components/sidebar';
import { DialogProvider } from '../components/ui/dialog';

const isGithubActions = process.env.GITHUB_ACTIONS || false;
const repo = isGithubActions && process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}`
  : '';

export const metadata: Metadata = {
  title: 'Gestão de Apostilas • Microlins',
  description: 'Sistema Profissional de Controle e Higienização de Material Didático',
  icons: {
    icon: `${repo}/favicon.ico`,
    shortcut: `${repo}/favicon.ico`,
    apple: `${repo}/images/microlins-icon.png`,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen bg-[#f8fafd]">
        <DialogProvider>
          <Sidebar />
          <main className="flex-1 flex flex-col min-w-0 overflow-auto">
            {children}
          </main>
        </DialogProvider>
      </body>
    </html>
  );
}

