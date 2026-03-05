import './globals.css';

export const metadata = {
  title: 'Vlogger AI',
  description: 'TikTok Travel Vlog Generator'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
