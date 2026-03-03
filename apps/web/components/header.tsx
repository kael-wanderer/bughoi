export function Header({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-background-light/95 px-4 py-3 backdrop-blur">
      <h1 className="text-center text-lg font-bold">{title}</h1>
    </header>
  );
}
