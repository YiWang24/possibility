interface OrbAvatarProps {
  size?: number;
}

export default function OrbAvatar({ size = 48 }: OrbAvatarProps) {
  return (
    <div
      className="relative rounded-full overflow-hidden flex-none"
      style={{
        width: size,
        height: size,
        background: `
          radial-gradient(circle at 38% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0) 42%),
          radial-gradient(circle at 50% 55%, #4A55D6 0%, #2A2F9E 70%, #1B1E5C 100%)
        `,
      }}
      data-testid="orb-avatar"
    >
      <div
        className="absolute rounded-full"
        style={{
          left: '-25%',
          top: '-25%',
          width: '105%',
          height: '105%',
          background: 'radial-gradient(circle at 45% 45%, #6FA5FF 0%, rgba(143,123,255,0.75) 45%, rgba(143,123,255,0) 72%)',
          filter: 'blur(4px)',
          mixBlendMode: 'screen',
          animation: 'orblava1 9s ease-in-out infinite',
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          right: '-30%',
          bottom: '-30%',
          width: '95%',
          height: '95%',
          background: 'radial-gradient(circle at 50% 50%, #F06ACD 0%, rgba(255,122,77,0.7) 48%, rgba(255,122,77,0) 74%)',
          filter: 'blur(5px)',
          mixBlendMode: 'screen',
          animation: 'orblava2 11s ease-in-out infinite',
        }}
      />
    </div>
  );
}
