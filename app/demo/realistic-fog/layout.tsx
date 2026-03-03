export default function RealisticFogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="!min-h-screen" style={{ background: "#09090b" }}>
      {children}
    </div>
  );
}
