/**
 * Vision XIX AI — embed script
 * Add to your site: <script src="https://visionxixlabs.com/embed.js" data-bot-id="YOUR_BOT_ID"></script>
 */
(function() {
  const script = document.currentScript;
  const botId = script?.getAttribute('data-bot-id');
  if (!botId) return;

  const base = (script?.src || '').replace(/\/embed\.js.*$/, '');
  const embedUrl = base + '/embed/' + encodeURIComponent(botId);

  const btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Open chat');
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#4f46e5;color:white;border:none;cursor:pointer;box-shadow:0 4px 12px rgba(79,70,229,0.4);z-index:999999;display:flex;align-items:center;justify-content:center;';
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;bottom:90px;right:24px;width:400px;max-width:calc(100vw - 48px);height:500px;z-index:999998;display:none;';
  panel.innerHTML = '<iframe src="' + embedUrl + '" style="width:100%;height:100%;border:none;border-radius:16px 16px 0 0;box-shadow:0 -4px 24px rgba(0,0,0,0.15);"></iframe>';

  let open = false;
  btn.onclick = function() {
    open = !open;
    panel.style.display = open ? 'block' : 'none';
  };

  document.body.appendChild(panel);
  document.body.appendChild(btn);
})();
