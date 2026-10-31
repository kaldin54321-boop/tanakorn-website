"use client";

import { useState } from "react";
import type { YoutubeVideo } from "@/lib/youtube";

export default function VideoGallery({ videos }: { videos: YoutubeVideo[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="video-gallery">
      {videos.map((video) => (
        <article key={video.id} className="video-tile">
          <div className="video-tile-media">
            {activeId === video.id ? (
              <iframe
                src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                type="button"
                className="video-tile-play"
                onClick={() => setActiveId(video.id)}
                aria-label={`Play ${video.title}`}
              >
                <img
                  src={video.thumbnail_url}
                  alt=""
                  loading="lazy"
                  width={480}
                  height={360}
                />
                <span className="video-tile-play-icon" aria-hidden="true">
                  ▶
                </span>
              </button>
            )}
          </div>
          <div className="video-tile-body">
            <h3>{video.title}</h3>
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="video-tile-link"
            >
              Watch on YouTube ↗
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
