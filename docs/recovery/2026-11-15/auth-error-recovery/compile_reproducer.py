"""One offline compiler reproduction of the reviewer's request-time cache concern."""
from pathlib import Path
import importlib.util
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('framer_build',HERE.parent/'framer-website-followup/compile_website.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
build.HERE=HERE/'static-reproducer'
build.EXTRA=build.EXTRA+('lib/auth/authErrorRecovery.ts','app/auth/error/page.tsx','lib/auth/__tests__/authErrorRecovery.test.ts','lib/__tests__/authErrorRouting.test.ts','app/auth/error/__tests__/page.test.ts')
if __name__=='__main__':
 build.HERE.mkdir(exist_ok=True)
 raise SystemExit(build.main())
