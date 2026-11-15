"""One corrected offline build after actual cached-route reproduction."""
from pathlib import Path
import importlib.util
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('auth_reproducer',HERE/'compile_reproducer.py')
unit=importlib.util.module_from_spec(spec);spec.loader.exec_module(unit)
unit.build.HERE=HERE/'dynamic-correction'
if __name__=='__main__':
 unit.build.HERE.mkdir(exist_ok=True)
 raise SystemExit(unit.build.main())
