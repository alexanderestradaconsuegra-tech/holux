const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
:root{--bg:#060605;--line:rgba(255,255,255,.1);--text:#fff8ed;--muted:#b0a396;--dim:#6a6058;--gold:#c8a96b;--gold2:#f0d48d}
*{box-sizing:border-box}
body{margin:0;background:#050504;color:var(--text);font-family:Inter,system-ui,sans-serif;font-size:16px;line-height:1.6}
a{color:var(--gold2);text-decoration:none}
a:hover{text-decoration:underline}
.legal-nav{position:sticky;top:0;z-index:10;background:rgba(6,6,5,.9);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.legal-nav-in{width:min(760px,calc(100% - 40px));margin:auto;height:74px;display:flex;align-items:center;justify-content:space-between}
.legal-wrap{width:min(760px,calc(100% - 40px));margin:40px auto 90px}
.legal-wrap h1{font-size:clamp(30px,5vw,44px);font-weight:700;letter-spacing:-.03em;margin:0 0 6px}
.legal-updated{color:var(--dim);font-size:13px;margin:0 0 36px}
.legal-wrap h2{font-size:20px;font-weight:700;letter-spacing:-.02em;margin:36px 0 12px}
.legal-wrap p,.legal-wrap li{color:var(--muted);font-size:15px;line-height:1.75;margin:0 0 12px}
.legal-wrap ul{padding-left:20px;margin:0 0 16px}
.legal-note{border-radius:16px;background:rgba(255,255,255,.04);border:1px solid var(--line);padding:16px 18px;color:var(--muted);font-size:13.5px;line-height:1.65;margin-top:32px}
.footer{border-top:1px solid var(--line);padding:26px 0;color:var(--dim);font-size:13px;text-align:center}
`;

export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <style>{CSS}</style>
      <nav className="legal-nav">
        <div className="legal-nav-in">
          <a href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/holu-logo-256.png" alt="HOLU" style={{ height: 40, width: "auto", display: "block" }} />
          </a>
          <a href="/">← Volver al inicio</a>
        </div>
      </nav>
      <div className="legal-wrap">
        <h1>{title}</h1>
        <p className="legal-updated">Última actualización: {updated}</p>
        {children}
      </div>
      <footer className="footer">© {new Date().getFullYear()} HOLU · Chile</footer>
    </div>
  );
}
