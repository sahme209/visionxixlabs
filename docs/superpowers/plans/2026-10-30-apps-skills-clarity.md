# Apps & skills clarity pass

The user requested a cleaner, more focused catalogue inspired by modern AI and
developer tools and explicitly opted out of routine checkpoints. This applies
the existing approved interface-clarity guide; no new integration or authority.

Design: keep the current central catalogue and search. Separate primary browsing
(All, Apps, Skills, Developer tools) from existing status filters. Label the app
area App connections, since available entries are not necessarily connected.
Group providers by their existing source-control/collaboration/work-management/
cloud/batch categories. Keep action/recovery panels mounted independently of
search/filter results so uncertainty or a draft is not destroyed by browsing.
Use an accessible search label and section headings. No guessed status counters,
new provider reads, provider writes, network effects on filters, or permission
changes. Outlook remains an explicitly opened existing card; no auto-load.

1. Add catalogue regression checks for category headings and split filter groups,
   keyboard-search label, unchanged installation/connection side-effect counts.
   Watch them fail before changing the catalogue.
2. Refactor presentation only in PluginsSkillsView.tsx. Preserve handler logic,
   state IDs, existing labels queried by consumers and mounted recovery panels.
3. Run catalogue, Bot return/navigation and Outlook recovery checks; desktop
   types/build. Perform native visual acceptance in a signed local app.
4. Review the delta once, back up source and refresh the one local release batch.
   No Vercel deployment, installer publication or paid CI is authorized here.
