"use client";

import { useEffect, useRef, useState } from "react";

type StoryImageProps = {
  src: string;
  fallbackSrc: string;
  alt: string;
  videoSrc?: string | null;
  videoHlsSrc?: string | null;
  videoHasAudio?: boolean | null;
  eager?: boolean;
  autoplay?: boolean;
  showAudioToggle?: boolean;
  className?: string;
};

export function StoryImage({
  src,
  fallbackSrc,
  alt,
  videoSrc = null,
  videoHlsSrc = null,
  videoHasAudio = null,
  eager = false,
  autoplay = false,
  showAudioToggle = false,
  className,
}: StoryImageProps) {
  const [activeSrc, setActiveSrc] = useState(src);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsControllerRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    setActiveSrc(src);
    setHasVideoError(false);
    setIsMuted(true);
  }, [src, videoSrc, videoHlsSrc]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoSrc || hasVideoError) {
      return;
    }

    const mediaElement = video;
    const mp4Src = videoSrc;
    const hlsSrc = videoHlsSrc;
    let isCancelled = false;

    hlsControllerRef.current?.destroy();
    hlsControllerRef.current = null;

    async function configureVideoSource() {
      const canPlayNativeHls =
        Boolean(hlsSrc) &&
        typeof mediaElement.canPlayType === "function" &&
        Boolean(
          mediaElement.canPlayType("application/vnd.apple.mpegurl") ||
            mediaElement.canPlayType("application/x-mpegURL"),
        );

      if (canPlayNativeHls && hlsSrc) {
        mediaElement.src = hlsSrc;
        mediaElement.load();
        return;
      }

      if (hlsSrc) {
        try {
          const module = await import("hls.js");
          const Hls = module.default;

          if (!isCancelled && Hls.isSupported()) {
            const hls = new Hls();
            hlsControllerRef.current = hls;
            hls.loadSource(hlsSrc);
            hls.attachMedia(mediaElement);
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data.fatal) {
                return;
              }

              hls.destroy();
              hlsControllerRef.current = null;

              mediaElement.src = mp4Src;
              mediaElement.load();
            });
            return;
          }
        } catch {
          // Fall through to the MP4 fallback below.
        }
      }

      mediaElement.src = mp4Src;
      mediaElement.load();
    }

    void configureVideoSource();

    return () => {
      isCancelled = true;
      hlsControllerRef.current?.destroy();
      hlsControllerRef.current = null;
    };
  }, [hasVideoError, videoHlsSrc, videoSrc]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !videoSrc || hasVideoError) {
      return;
    }

    if (!autoplay) {
      video.pause();
      return;
    }

    void video.play().catch(() => {
      // Autoplay can fail silently depending on the browser; keep the poster visible.
    });
  }, [autoplay, hasVideoError, videoSrc, videoHlsSrc]);

  useEffect(() => {
    if (!autoplay) {
      setIsMuted(true);
    }
  }, [autoplay]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.defaultMuted = isMuted;
    video.muted = isMuted;

    if (!isMuted) {
      video.volume = 1;
    }
  }, [isMuted]);

  if (videoSrc && !hasVideoError) {
    return (
      <>
        <video
          ref={videoRef}
          className={className}
          src={videoSrc}
          poster={activeSrc}
          muted={isMuted}
          loop
          playsInline
          autoPlay={autoplay}
          preload={eager || autoplay ? "auto" : "metadata"}
          aria-label={alt}
          disablePictureInPicture
          onError={() => {
            setHasVideoError(true);
          }}
        />
        {showAudioToggle && videoHasAudio !== false ? (
          <button
            type="button"
            className="story-media__audio-toggle"
            aria-pressed={!isMuted}
            aria-label={isMuted ? "Turn sound on" : "Turn sound off"}
            onClick={(event) => {
              event.stopPropagation();

              const video = videoRef.current;
              const nextMuted = !isMuted;

              setIsMuted(nextMuted);

              if (!video) {
                return;
              }

              video.defaultMuted = nextMuted;
              video.muted = nextMuted;

              if (!nextMuted) {
                video.volume = 1;
                void video.play().catch(() => {
                  // Browsers may still reject playback state changes; keep the UI in sync.
                });
              }
            }}
          >
            {isMuted ? "Sound off" : "Sound on"}
          </button>
        ) : null}
      </>
    );
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "auto"}
      draggable={false}
      onError={() => {
        if (activeSrc !== fallbackSrc) {
          setActiveSrc(fallbackSrc);
        }
      }}
    />
  );
}
