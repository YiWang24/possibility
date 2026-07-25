interface SimLoadProps {
  name: string;
  step: string;
}

// 推演加载 overlay (prototype #simload, ~2345). Rendered only while running.
// `position:fixed` covers the whole WebView — the prototype relied on the `.phone`
// frame as the offset parent, which the flash-app shell does not reproduce.
export default function SimLoad({ name, step }: SimLoadProps) {
  return (
    <div className="simload show" id="simload" data-testid="lab-simload" style={{ position: 'fixed' }}>
      <div className="orb-halo">
        <div className="orb" />
      </div>
      <h3>
        正在推演 <span id="loadName">{name}</span>
      </h3>
      <p id="loadStep">{step}</p>
    </div>
  );
}
