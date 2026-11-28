# V19 for the Microsoft Store (MSIX)

The Microsoft Store is the free way to ship a signed Windows app: Microsoft signs an MSIX package after
it passes certification, and Store installs show no SmartScreen warning. The direct-download MSI and
NSIS installers stay as they are (unsigned) for machines without the Store.

## How it is built

`.github/workflows/desktop-msix.yml` (started by hand with a tag, for example `desktop-v0.1.27`):

1. Builds the app with `VITE_V19_DISTRIBUTION=microsoft_store`. In that build Settings says updates come
   from the Microsoft Store instead of pointing to the download page. The app has no self-updater.
2. Stages `axiom-desktop.exe`, the logos in `Assets/` and `AppxManifest.xml`, rendered from
   `AppxManifest.template.xml` by `scripts/msix/render_manifest.py` (version `x.y.z.0`, full trust,
   the `axiom-agent` sign-in link).
3. Packs with `makeappx.exe` from the Windows SDK on the runner.
4. Install-tests a copy signed with a throwaway certificate: installs it, checks the app starts and stays
   running and the sign-in link is registered, then removes the package and the certificate.
5. Uploads the **unsigned** package as the `v19-msix-<version>` artifact, ready for Partner Center.

## Store identity

Partner Center → the app → Product identity gives three values (not secrets). Set them as repository
variables: `MSIX_IDENTITY_NAME` (Package/Identity/Name), `MSIX_PUBLISHER` (Package/Identity/Publisher,
starts with `CN=`) and `MSIX_PUBLISHER_DISPLAY_NAME`. Without them the workflow uses a placeholder
identity and marks the run "testing only": such a package installs locally but cannot be uploaded.

## Not covered by the workflow

- Store certification (Microsoft's review, usually a few days) and the listing text and screenshots.
- An existing MSI install and a Store install of V19 sit side by side until the MSI one is removed.
- The Windows App Certification Kit is not run in CI.
