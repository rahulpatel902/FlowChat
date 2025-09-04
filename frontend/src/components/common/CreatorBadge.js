import React, { useEffect, useState } from 'react';

const CreatorBadge = ({ isDark = false, username = 'rahulpatel902', avatarPath = '/rp.jpg' }) => {
  const [visible, setVisible] = useState(false);

  // Ensure hidden on initial mount (avoid Fast Refresh preserving previous state)
  useEffect(() => {
    setVisible(false);
  }, []);

  const handleClick = () => {
    // Toggle visibility of the username pill (no navigation)
    setVisible((v) => !v);
  };

  return (
    <div className="fixed right-4 top-4 z-40 flex items-center select-none">
      {/* Username pill (opens GitHub) */}
      <a
        href={`https://github.com/${username}`}
        target="_blank"
        rel="noreferrer"
        title={`Visit ${username} on GitHub`}
        className={`${
          isDark
            ? 'bg-white/5 border border-white/10 text-gray-200'
            : 'bg-white/90 border border-black/10 text-gray-800'
        } backdrop-blur mr-2 inline-flex items-center rounded-full text-sm font-semibold shadow-sm transition-all duration-500 ease-out`}
        style={{
          maxWidth: visible ? 220 : 0,
          opacity: visible ? 1 : 0,
          paddingLeft: visible ? 8 : 0,
          paddingRight: visible ? 8 : 0,
          paddingTop: visible ? 4 : 0,
          paddingBottom: visible ? 4 : 0,
          filter: visible ? 'blur(0px)' : 'blur(2px)',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        aria-hidden={!visible}
      >
        <span>@{username}</span>
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="ml-1.5 opacity-90"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M15 7h3a5 5 0 0 1 0 10h-3" />
          <path d="M9 17H6a5 5 0 0 1 0-10h3" />
          <path d="M8 12h8" />
        </svg>
      </a>

      {/* Round avatar button (click to reveal username, no navigation) */}
      <button
        type="button"
        onClick={handleClick}
        title={visible ? `Hide creator` : 'Show creator'}
        className={`h-12 w-12 rounded-full flex items-center justify-center shadow-sm transition relative ${
          isDark
            ? 'bg-white/5 hover:bg-white/10 border border-white/10'
            : 'bg-white/90 hover:bg-white border border-black/10'
        } backdrop-blur`}
      >
        <img
          src={avatarPath}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = `https://github.com/${username}.png`;
          }}
          alt={`${username} avatar`}
          className={`h-9 w-9 rounded-full object-cover ring-1 ${
            isDark ? 'ring-white/10' : 'ring-black/10'
          }`}
        />
        {/* GitHub logo badge (larger) */}
        <span
          aria-hidden
          className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center ring-1 ${
            isDark ? 'bg-[#24292f] ring-white/20' : 'bg-[#24292f] ring-black/10'
          }`}
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="currentColor"
            className="text-white"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </span>
      </button>
    </div>
  );
};

export default CreatorBadge;
