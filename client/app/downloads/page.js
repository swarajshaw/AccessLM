import fs from 'fs';
import path from 'path';

const downloads = [
  {
    platform: 'macOS (Apple Silicon)',
    file: 'AccessLM-2.1.0-arm64.dmg'
  },
  {
    platform: 'macOS (Intel)',
    file: 'AccessLM-2.1.0.dmg'
  },
  {
    platform: 'Windows',
    file: 'AccessLM-2.1.0.exe'
  },
  {
    platform: 'Linux',
    file: 'accesslm_2.1.0_amd64.deb'
  }
];

function isAvailable(file) {
  const filePath = path.join(process.cwd(), 'public', 'downloads', file);
  return fs.existsSync(filePath);
}

export default function DownloadsPage() {
  const items = downloads.map((item) => ({
    ...item,
    available: isAvailable(item.file)
  }));

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-4">Downloads</h1>
        <p className="text-gray-600 mb-8">
          Choose the installer for your platform.
        </p>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.file} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{item.platform}</div>
                <div className="text-sm text-gray-500">{item.file}</div>
              </div>
              {item.available ? (
                <a
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                  href={`/downloads/${item.file}`}
                >
                  Download
                </a>
              ) : (
                <div className="text-sm text-gray-500">Not available yet</div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-sm text-gray-500">
          If a file shows “Not available yet”, it hasn’t been added to `client/public/downloads/`.
        </div>
      </div>
    </div>
  );
}
