import './globals.css';

export const metadata = {
  title: 'AccessLM — Run LLMs on Any Device',
  description: 'Run Llama 3, Mistral, Phi-3 on your laptop — no GPU, no cloud, no login.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}