"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, AlertTriangle } from "lucide-react";
import { getVideoUrl } from "@/services/depotVision";

interface VideoPlayerProps {
  videoFile: string;
  detectionId?: string; // Make optional
}

export default function VideoPlayer({ videoFile, detectionId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const videoUrl = getVideoUrl(videoFile);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      setPlaying(false);
    };

    const handleError = () => {
      const videoError = video.error;
      let message = "Video playback failed";
      
      if (videoError) {
        switch (videoError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            message = "Video loading was aborted";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            message = "Network error while loading video";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = "Video decoding failed";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = "Video format not supported";
            break;
        }
      }
      
      setError(message);
      setLoading(false);
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
    };
  }, []);

  // Keyboard controls for frame-by-frame navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        video.currentTime += 1 / 24; // Advance 1 frame at 24fps
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        video.currentTime -= 1 / 24; // Rewind 1 frame
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      video.play();
      setPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setMuted(vol === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !muted;
    setMuted(!muted);
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] bg-[#0F1A30] rounded-lg p-4 text-center">
        <AlertTriangle className="w-8 h-8 text-[#F04A4A] mb-2" />
        <div className="text-[#F04A4A] text-[12px] font-bold mb-1">Video Error</div>
        <div className="text-[#8A9BBF] text-[10px]">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Video element */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto"
          style={{ maxHeight: "300px" }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-[12px]">Loading video...</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-2">
        {/* Play/Pause and Timeline */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="p-1.5 rounded bg-[#E5521A] text-white hover:bg-[#FF7A42] transition"
            disabled={loading}
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 bg-[#1E2F50] rounded-lg appearance-none cursor-pointer"
            disabled={loading}
          />
          <span className="text-[10px] text-[#8A9BBF] min-w-[60px] text-right">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Volume and Playback Speed */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className="p-1 text-[#8A9BBF] hover:text-[#E8EDF8] transition"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-[#1E2F50] rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#8A9BBF]">Speed:</span>
            {[0.25, 0.5, 1, 1.5, 2].map((rate) => (
              <button
                key={rate}
                onClick={() => changePlaybackRate(rate)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                  playbackRate === rate
                    ? "bg-[#E5521A] text-white"
                    : "bg-[#1E2F50] text-[#8A9BBF] hover:bg-[#2A3F68]"
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="text-[9px] text-[#4E6090] text-center">
          Use ← → arrow keys for frame-by-frame navigation | Space to play/pause
        </div>
      </div>
    </div>
  );
}