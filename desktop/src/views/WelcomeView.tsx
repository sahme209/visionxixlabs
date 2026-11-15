interface WelcomeViewProps {
  onBuild: () => void;
  onBot: () => void;
  onAutomate: () => void;
  onDeploy: () => void;
}

/** Navigation only: never turn a launch choice into an AI or provider action. */
export function WelcomeView({ onBuild, onBot, onAutomate, onDeploy }: WelcomeViewProps) {
  return <section aria-label="Axiom welcome" className="axiom-home">
    <div className="axiom-home-content">
      <div className="home-introduction">
        <div className="home-introduction-copy">
          <p className="home-eyebrow">Your engineering workspace</p>
          <h1>Your next move,<br/><span>in focus.</span></h1>
          <p className="home-introduction-description">Research with Agent, work with your code, or prepare a release. Choose where to begin.</p>
          <button type="button" onClick={onBuild} className="home-primary-action">Open Agent <span aria-hidden="true">↗</span></button>
          <p className="home-primary-note">Code, context and a clear next step.</p>
        </div>
        <div className="home-landscape" aria-hidden="true">
          <img src="/images/axiom-painted-basin.webp" alt=""/>
          <div className="home-landscape-surface"><span>Space to think.</span><p>Room to<br/>build.</p><span>One considered step at a time.</span></div>
        </div>
      </div>
      <div className="home-destination-heading"><h2>Start with what matters.</h2><p>One workspace. Different ways forward.</p></div>
      <div className="home-destinations">
        <button type="button" onClick={onBot} className="home-destination"><span className="home-destination-top"><span aria-hidden="true">01</span><span aria-hidden="true">↗</span></span><span className="home-destination-title">Delegate a task</span><span className="home-destination-description">Saved tasks and AI responses in Axiom Bot. App changes require exact review.</span></button>
        <button type="button" onClick={onDeploy} className="home-destination"><span className="home-destination-top"><span aria-hidden="true">02</span><span aria-hidden="true">↗</span></span><span className="home-destination-title">Plan a release</span><span className="home-destination-description">Bring scope, proposed actions and delivery evidence into one review.</span></button>
        <button type="button" onClick={onAutomate} className="home-destination"><span className="home-destination-top"><span aria-hidden="true">03</span><span aria-hidden="true">↗</span></span><span className="home-destination-title">Review operations</span><span className="home-destination-description">Monitor batches and prepare operations. Requires an Airflow connection.</span></button>
      </div>
      <p className="home-navigation-note">Opening a section does not execute a change. Your saved work stays in its workspace.</p>
    </div>
  </section>;
}
