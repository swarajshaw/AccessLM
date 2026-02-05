'use client';

import { useEffect, useMemo, useState } from 'react';

const RELEASE_API = 'https://api.github.com/repos/swarajshaw/AccessLM/releases/latest';
const FALLBACK_RELEASE_URL = 'https://github.com/swarajshaw/AccessLM/releases/tag/v0.0.1';
const FALLBACK_ASSETS = [
  {
    name: 'AccessLM-0.0.1-arm64.dmg',
    url: 'https://github.com/swarajshaw/AccessLM/releases/download/v0.0.1/AccessLM-0.0.1-arm64.dmg',
    platform: 'macOS (Apple Silicon)'
  },
  {
    name: 'AccessLM-0.0.1.dmg',
    url: 'https://github.com/swarajshaw/AccessLM/releases/download/v0.0.1/AccessLM-0.0.1.dmg',
    platform: 'macOS (Intel)'
  },
  {
    name: 'AccessLM.Setup.0.0.1.exe',
    url: 'https://github.com/swarajshaw/AccessLM/releases/download/v0.0.1/AccessLM.Setup.0.0.1.exe',
    platform: 'Windows (Installer)'
  },
  {
    name: 'AccessLM.0.0.1.exe',
    url: 'https://github.com/swarajshaw/AccessLM/releases/download/v0.0.1/AccessLM.0.0.1.exe',
    platform: 'Windows (Portable)'
  }
];

function classifyAsset(asset) {
  const name = asset.name || '';
  if (name.includes('arm64') && name.endsWith('.dmg')) {
    return 'macOS (Apple Silicon)';
  }
  if (name.endsWith('.dmg')) {
    return 'macOS (Intel)';
  }
  if (name.toLowerCase().includes('setup') && name.endsWith('.exe')) {
    return 'Windows (Installer)';
  }
  if (name.endsWith('.exe')) {
    return 'Windows (Portable)';
  }
  if (name.endsWith('.zip') && name.includes('mac')) {
    return 'macOS (ZIP)';
  }
  return 'Other';
}

export default function DownloadsPage() {
  const [release, setRelease] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(RELEASE_API)
      .then((res) => res.json())
      .then((data) => {
        if (data?.message) {
          setError(data.message);
          return;
        }
        setRelease(data);
      })
      .catch((err) => setError(err.message || 'Failed to load release data.'));
  }, []);

  const assets = useMemo(() => {
    if (!release?.assets) return [];
    return release.assets
      .filter((asset) => asset?.browser_download_url)
      .map((asset) => ({
        name: asset.name,
        url: asset.browser_download_url,
        size: asset.size,
        platform: classifyAsset(asset)
      }))
      .sort((a, b) => a.platform.localeCompare(b.platform));
  }, [release]);

  const fallbackAssets = useMemo(() => FALLBACK_ASSETS, []);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-white">
      <div className="max-w-4xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-white/40">
              AccessLM
            </div>
            <h1 className="text-3xl font-semibold mt-2">Downloads</h1>
            <p className="text-white/60 mt-2">
              Latest builds are pulled directly from GitHub Releases.
            </p>
          </div>
          <a
            href="/"
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:text-white hover:border-white/40"
          >
            Back to home
          </a>
        </div>

        {(release?.html_url || FALLBACK_RELEASE_URL) && (
          <a
            className="inline-flex items-center text-sm text-[#22d3ee] hover:underline mb-8"
            href={release?.html_url || FALLBACK_RELEASE_URL}
            target="_blank"
            rel="noreferrer"
          >
            View latest release on GitHub
          </a>
        )}

        {error && assets.length === 0 && (
          <div className="mb-6 text-sm text-white/50">
            Using the latest published release assets.
          </div>
        )}

        <div className="grid gap-4">
          {(assets.length ? assets : fallbackAssets).map((asset) => (
            <div
              key={asset.url}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-4"
            >
              <div>
                <div className="font-medium">{asset.platform}</div>
                <div className="text-sm text-white/50">{asset.name}</div>
              </div>
              <a
                className="px-4 py-2 rounded-full bg-[#22d3ee] text-black text-sm font-semibold hover:bg-[#1dbfd6]"
                href={asset.url}
              >
                Download
              </a>
            </div>
          ))}

          {release === null && !error && (
            <div className="text-sm text-white/50">
              Loading latest release assets...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
