import React from 'react';

const BrandFooter = ({ isDark = false, className = '', username = 'rahulpatel902', avatarPath = '/rp.jpg' }) => {
  return (
    <div
      className={`w-full flex items-center justify-center text-[11px] sm:text-xs tracking-normal ${
        isDark ? 'text-gray-400' : 'text-gray-600'
      } ${className}`}
    >
      <a
        href={`https://github.com/${username}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center"
        title={`Visit ${username} on GitHub`}
      >
        <span
          className={`font-semibold ${
            isDark ? 'text-gray-200 hover:text-white' : 'text-gray-800 hover:text-black'
          }`}
        >
          @{username}
        </span>
        <img
          src={avatarPath}
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = `https://github.com/${username}.png`;
          }}
          alt={`${username} avatar`}
          className={`h-5 w-5 rounded-full object-cover ml-1 ring-1 ${
            isDark ? 'ring-white/10' : 'ring-black/10'
          }`}
        />
      </a>
    </div>
  );
};

export default BrandFooter;
