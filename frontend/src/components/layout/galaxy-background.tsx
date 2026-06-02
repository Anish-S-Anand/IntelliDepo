const stars = [
  { left: "6%", top: "14%", size: 2, opacity: 0.55, delay: "0s", duration: "4.8s" },
  { left: "14%", top: "38%", size: 1.5, opacity: 0.34, delay: "0.7s", duration: "5.6s" },
  { left: "22%", top: "66%", size: 2.2, opacity: 0.48, delay: "1.6s", duration: "6.3s" },
  { left: "31%", top: "24%", size: 1.8, opacity: 0.42, delay: "0.4s", duration: "5.2s" },
  { left: "39%", top: "56%", size: 2.4, opacity: 0.62, delay: "1.2s", duration: "6.8s" },
  { left: "47%", top: "18%", size: 1.6, opacity: 0.38, delay: "0.2s", duration: "5.7s" },
  { left: "54%", top: "71%", size: 2, opacity: 0.5, delay: "1.8s", duration: "6.1s" },
  { left: "62%", top: "32%", size: 1.4, opacity: 0.32, delay: "0.9s", duration: "4.9s" },
  { left: "71%", top: "59%", size: 2.3, opacity: 0.56, delay: "2.1s", duration: "6.6s" },
  { left: "78%", top: "21%", size: 1.7, opacity: 0.4, delay: "0.5s", duration: "5.4s" },
  { left: "86%", top: "46%", size: 2.1, opacity: 0.52, delay: "1.1s", duration: "5.9s" },
  { left: "92%", top: "73%", size: 1.5, opacity: 0.36, delay: "2.5s", duration: "6.4s" },
];

export function GalaxyBackground() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      aria-hidden="true"
      style={{
        backgroundImage: "url('/backgrounds/galaxy-space.avif')",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,5,12,0.02),rgba(3,5,12,0.06)_70%,rgba(3,5,12,0.1)_100%)]" />
      {stars.map((star, index) => (
        <span
          key={index}
          className="motion-star absolute rounded-full bg-white"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animationDelay: star.delay,
            animationDuration: star.duration,
            boxShadow: `0 0 ${star.size * 6}px rgba(255,255,255,0.4)`,
          }}
        />
      ))}
    </div>
  );
}
