export function LoadingSpinner({ size = 18 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin 1s linear infinite',
      }}
    />
  );
}
