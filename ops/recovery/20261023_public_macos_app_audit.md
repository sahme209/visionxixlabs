# Read-only audit of the old public Mac application

The official public 0.1.20 arm64 disk image matches SHA256 `71389d31f2cbf85c29511597100409824033b4676df91320d380675254f1b1bc`. Its outer image has a valid Developer ID signature but no stapled image ticket, as recorded separately.

To distinguish packaging from application identity, the same verified bytes were mounted read-only with no browser/Finder presentation in a new private mount directory. The single contained application has identifier `com.visionxixlabs.axiom`, version 0.1.20 and arm64 executable. Deep strict signature validation passes with the expected Developer ID team `FG5N98FE6W`. Gatekeeper accepts it with source `Notarized Developer ID`, and the app's own stapled ticket validates.

The application was not launched or installed. The volume detached normally and the image hash remained unchanged. Therefore the observed missing ticket concerns the outer disk image; it is not evidence that the contained application is unsigned or unnotarized. These checks concern one old public architecture/version, not a new release candidate, installed workflow acceptance, Windows or Linux. No notarization request, signing credential retrieval, publication or installer attestation change occurred.
