"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Background video for the hero: muted, looping, inline (so phones autoplay it), with a smaller file on narrow screens.
 * Visitors who prefer reduced motion get the poster still instead. A pause button is always offered while it plays.
 * With no video configured it renders a neutral placeholder block.
 */
export function HeroVideo({ desktop, mobile, poster, showPause = true }: { desktop: string | null; mobile: string | null; poster: string | null; showPause?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setStill(mq.matches);
      if (mq.matches) ref.current?.pause();
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!desktop) {
    return <div className="media image-placeholder" aria-hidden="true" />;
  }

  if (still) {
    // eslint-disable-next-line @next/next/no-img-element
    return poster ? <img src={poster} alt="" className="media" /> : <div className="media image-placeholder" aria-hidden="true" />;
  }

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <video ref={ref} className="media" autoPlay muted loop playsInline preload="metadata" poster={poster ?? undefined} aria-hidden="true">
        {mobile ? <source src={mobile} type="video/mp4" media="(max-width: 767px)" /> : null}
        <source src={desktop} type="video/mp4" />
      </video>
      {showPause ? (
        <button type="button" className="pause" onClick={toggle} aria-label={playing ? "Pause background video" : "Play background video"}>
          {playing ? <Pause aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
        </button>
      ) : null}
    </>
  );
}
