function LoadingIndicator() {
  return (
    <div className="flex items-center gap-1" aria-label="Carregando">
      <span className="size-2 animate-bounce rounded-full bg-current [animation-delay: -0.2s]" />
      <span className="size-2 animate-bounce rounded-full bg-current [animation-delay: -0.1s]" />
      <span className="size-2 animate-bounce rounded-full bg-current" />
    </div>
  );
}

export default LoadingIndicator;
