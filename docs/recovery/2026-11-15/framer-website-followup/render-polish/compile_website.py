"""One build for the browser-found tap-target/neutral-palette correction."""
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('framer_build',Path(__file__).resolve().parent.parent/'compile_website.py')
build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
build.HERE=Path(__file__).resolve().parent
if __name__=='__main__':raise SystemExit(build.main())
