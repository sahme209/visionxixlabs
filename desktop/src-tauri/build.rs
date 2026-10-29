use std::{env,path::PathBuf,process::Command};
fn output(program:&str,args:&[&str])->String{let result=Command::new(program).args(args).output().expect("native observation toolchain unavailable");assert!(result.status.success(),"native observation toolchain failed: {}",String::from_utf8_lossy(&result.stderr));String::from_utf8(result.stdout).expect("native toolchain returned invalid UTF8").trim().to_owned()}
fn main(){
 println!("cargo:rerun-if-changed=native/AxiomWindowObservation.swift");println!("cargo:rerun-if-changed=native/AxiomWindowInput.swift");println!("cargo:rerun-if-env-changed=MACOSX_DEPLOYMENT_TARGET");
 if env::var("CARGO_CFG_TARGET_OS").as_deref()==Ok("macos"){
  let out=PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR"));let sdk=output("xcrun",&["--show-sdk-path"]);let arch=match env::var("CARGO_CFG_TARGET_ARCH").as_deref(){Ok("aarch64")=>"arm64",Ok("x86_64")=>"x86_64",_=>panic!("unsupported macOS observation architecture")};let minimum=env::var("MACOSX_DEPLOYMENT_TARGET").unwrap_or_else(|_|"10.15".into());let target=format!("{arch}-apple-macosx{minimum}");let object=out.join("axiom_observation.o");let archive=out.join("libaxiom_observation.a");
  let status=Command::new("xcrun").args(["swiftc","-emit-object","-parse-as-library","-whole-module-optimization","-module-name","AxiomWindowObservation","-target",&target,"-sdk",&sdk,"native/AxiomWindowObservation.swift","native/AxiomWindowInput.swift","-o"]).arg(&object).status().expect("Swift compiler unavailable");assert!(status.success(),"native observation Swift compilation failed");
  let status=Command::new("xcrun").args(["ar","crs"]).arg(&archive).arg(&object).status().expect("native archive tool unavailable");assert!(status.success(),"native observation archive failed");
  let info=output("xcrun",&["swiftc","-print-target-info","-target",&target]);let info:serde_json::Value=serde_json::from_str(&info).expect("Swift target info");if let Some(paths)=info["paths"]["runtimeLibraryPaths"].as_array(){for path in paths{if let Some(path)=path.as_str(){println!("cargo:rustc-link-search=native={path}")}}}
  println!("cargo:rustc-link-search=native={}",out.display());println!("cargo:rustc-link-lib=static=axiom_observation");println!("cargo:rustc-link-arg=-Wl,-weak_framework,ScreenCaptureKit");for framework in ["AppKit","Foundation","CoreGraphics","ImageIO","ApplicationServices","Security"]{println!("cargo:rustc-link-lib=framework={framework}")}println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/lib/swift");
 }
 tauri_build::build()
}
