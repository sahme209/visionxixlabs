use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::sync::atomic::{AtomicU64, Ordering};
static MUTATION: OnceLock<Mutex<()>> = OnceLock::new();
static NEXT: AtomicU64 = AtomicU64::new(1);
const MAX_WORKTREES: usize = 25;
const MAX_BYTES: u64 = 50 * 1024 * 1024 * 1024;
#[derive(Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct Worktree { path: String, branch: String, bytes: u64 }
fn git(root: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let mut command=Command::new("git");
    command.arg("-C").arg(root).args(["-c","core.hooksPath=/dev/null","-c","core.fsmonitor=false","-c","submodule.recurse=false"]);
    // Checkout/status must not launch repository-configured filter processes.
    let filters=Command::new("git").arg("-C").arg(root).args(["config","--null","--name-only","--get-regexp","^filter\\."]).output().map_err(|_|"Git filter configuration unavailable.")?;
    if filters.status.code()!=Some(0) && filters.status.code()!=Some(1) {return Err("Git filter configuration could not be verified.".into());}
    if filters.stdout.len()>100_000 {return Err("Git filter configuration exceeds the supported limit.".into());}
    let names=String::from_utf8(filters.stdout).map_err(|_|"Git filter configuration is not UTF-8.")?;
    let mut drivers=std::collections::BTreeSet::new();
    for name in names.split('\0').filter(|name|!name.is_empty()) {if let Some((driver,_))=name.rsplit_once('.') {drivers.insert(driver);}}
    for driver in drivers {for suffix in ["smudge=","clean=","process=","required=false"] {command.args(["-c",&format!("{driver}.{suffix}")]);}}
    let output=command.args(args).env("GIT_TERMINAL_PROMPT","0").output().map_err(|_| "Git worktree operation could not start.")?;
    if !output.status.success() {return Err("Git refused this worktree operation. Check its branch, files and repository state before retrying.".into());}
    if output.stdout.len()>2_000_000 {return Err("Worktree metadata exceeded the supported limit.".into());}
    Ok(output.stdout)
}
fn text(root: &Path,args: &[&str]) -> Result<String,String> {String::from_utf8(git(root,args)?).map_err(|_|"Worktree metadata is not UTF-8.".into())}
fn primary(repository_path: &str) -> Result<PathBuf,String> {
    let root=crate::git::repository_root(repository_path)?;
    let output=text(&root,&["worktree","list","--porcelain","-z"])?;
    let first=output.split('\0').next().and_then(|line|line.strip_prefix("worktree ")).ok_or("Primary working tree unavailable.")?;
    let main=fs::canonicalize(first).map_err(|_|"Primary working tree unavailable.")?;
    if !main.join(".git").is_dir() {return Err("A non-bare primary working tree is required.".into());}
    Ok(main)
}
fn common_directory(root: &Path) -> Result<PathBuf,String> {
    let raw=PathBuf::from(text(root,&["rev-parse","--git-common-dir"])?.trim());
    fs::canonicalize(if raw.is_absolute() {raw} else {root.join(raw)}).map_err(|_|"Git worktree ownership unavailable.".into())
}
fn managed_parent(root: &Path) -> PathBuf {let mut name=root.file_name().unwrap_or_default().to_os_string();name.push(".axiom-worktrees");root.with_file_name(name)}
fn checked_parent(root: &Path, create: bool) -> Result<PathBuf,String> {
    let path=managed_parent(root);
    if create && !path.exists() {fs::create_dir(&path).map_err(|_|"Could not reserve the worktree folder.")?;}
    let metadata=fs::symlink_metadata(&path).map_err(|_|"Worktree folder unavailable.")?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() || fs::canonicalize(&path).map_err(|_|"Worktree folder unavailable.")? != path {return Err("Worktree folder must be a real sibling directory.".into());}
    Ok(path)
}
fn size(root: &Path) -> Result<u64,String> {
    let mut bytes=0_u64; let mut visited=0; let mut dirs=vec![root.to_path_buf()];
    while let Some(dir)=dirs.pop() {
        for item in fs::read_dir(dir).map_err(|_|"Worktree size could not be verified.")? {
            let item=item.map_err(|_|"Worktree size could not be verified.")?;
            visited+=1; if visited>100_000 {return Err("Worktree size inventory exceeds 100,000 entries; inspect it outside Axiom.".into());}
            let metadata=fs::symlink_metadata(item.path()).map_err(|_|"Worktree size could not be verified.")?;
            if metadata.file_type().is_symlink() {continue;}
            if metadata.is_dir() {dirs.push(item.path());} else {bytes=bytes.checked_add(metadata.len()).ok_or("Worktree size overflow.")?;}
        }
    }
    Ok(bytes)
}
fn list(root: &Path) -> Result<Vec<Worktree>,String> {
    let parent=managed_parent(root);
    if !parent.exists() {return Ok(vec![]);}
    let parent=checked_parent(root,false)?;
    let output=text(root,&["worktree","list","--porcelain","-z"])?;
    let expected_common=common_directory(root)?;
    let mut rows=Vec::new();
    let mut path: Option<PathBuf>=None; let mut branch=String::new();
    for field in output.split('\0') {
        if field.is_empty() {
            if let Some(value)=path.take() {
                // Git uses normal drive paths on Windows; canonical paths can
                // carry an extended-length prefix. Compare canonical parents.
                let candidate_parent=value.parent().and_then(|path|fs::canonicalize(path).ok());
                if candidate_parent.as_deref()==Some(parent.as_path()) && value.file_name().and_then(|name|name.to_str()).map(|name|name.starts_with("axiom-")).unwrap_or(false) {
                    let metadata=fs::symlink_metadata(&value).map_err(|_|"A recorded worktree is missing. Recover its Git metadata before cleanup.")?;
                    if metadata.file_type().is_symlink() || !metadata.is_dir() {return Err("Worktree path changed; inspect it outside Axiom.".into());}
                    let canonical=fs::canonicalize(&value).map_err(|_|"Worktree path unavailable.")?;
                    if canonical.parent()!=Some(parent.as_path()) {return Err("Worktree parent changed; inspect it outside Axiom.".into());}
                    if common_directory(&canonical)?!=expected_common {return Err("Recorded checkout belongs to a different repository. No cleanup is permitted.".into());}
                    rows.push(Worktree{bytes:size(&canonical)?,path:canonical.to_string_lossy().into(),branch:branch.strip_prefix("refs/heads/").unwrap_or(&branch).into()});
                }
            }
            branch.clear();
        } else if let Some(value)=field.strip_prefix("worktree ") {path=Some(PathBuf::from(value));}
        else if let Some(value)=field.strip_prefix("branch ") {branch=value.into();}
    }
    Ok(rows)
}
fn create(source: &Path, branch: &str) -> Result<Worktree,String> {
    let main=primary(source.to_str().ok_or("Invalid source checkout.")?)?;
    let root=main.as_path();
    if branch.is_empty() || branch.len()>200 || branch.trim()!=branch || branch.starts_with('-') {return Err("Enter a new valid branch name up to 200 characters.".into());}
    git(root,&["check-ref-format","--branch",branch])?;
    if git(root,&["show-ref","--verify",&format!("refs/heads/{branch}")]).is_ok() {return Err("Use a new branch name; existing branches are never replaced.".into());}
    let rows=list(root)?;
    if rows.len()>=MAX_WORKTREES || rows.iter().map(|row|row.bytes).sum::<u64>()>=MAX_BYTES {return Err("Managed worktree count or disk limit reached.".into());}
    let parent=checked_parent(root,true)?;
    let nonce=std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_|"System clock unavailable.")?.as_nanos();
    let path=parent.join(format!("axiom-{nonce}-{}",NEXT.fetch_add(1,Ordering::Relaxed)));
    let head=text(source,&["rev-parse","--verify","HEAD^{commit}"])?;
    // New branch at a captured commit; no checkout/branch movement in the source.
    git(root,&["worktree","add","-b",branch,path.to_str().ok_or("Worktree path is not UTF-8.")?,head.trim()])?;
    let bytes=size(&path)?;
    if rows.iter().map(|row|row.bytes).sum::<u64>().saturating_add(bytes)>MAX_BYTES {return Err("Worktree was created but exceeds the disk limit. Inspect and remove the clean checkout explicitly.".into());}
    Ok(Worktree{path:path.to_string_lossy().into(),branch:branch.into(),bytes})
}
fn remove(root: &Path, target: &Path) -> Result<(),String> {
    let rows=list(root)?;
    if !rows.iter().any(|row|Path::new(&row.path)==target) {return Err("Only a recorded Axiom worktree of this repository can be removed.".into());}
    // Status and Git removal honor index exclusions, which can hide local edits.
    // Refuse these checkouts rather than clearing user flags or risking data loss.
    let entries=git(target,&["ls-files","-v","-z"])?;
    if entries.split(|byte|*byte==0).filter(|entry|!entry.is_empty()).any(|entry|entry.len()<3 || &entry[..2]!=b"H ") {
        return Err("Worktree has excluded or unusual index entries. Inspect and preserve its files outside Axiom before cleanup.".into());
    }
    // --ignored protects ignored build output and local files as well as source.
    if !git(target,&["status","--porcelain=v1","--untracked-files=all","--ignored"] )?.is_empty() {return Err("Worktree contains changed, untracked or ignored files. Preserve them before removing it.".into());}
    if crate::git::repository_root(target.to_str().ok_or("Invalid worktree path.")?)?!=target {return Err("Worktree ownership changed.".into());}
    // Git checks tracked/untracked changes again. Never --force, prune or delete a branch.
    git(root,&["worktree","remove","--",target.to_str().ok_or("Invalid worktree path.")?])?;
    Ok(())
}
#[tauri::command]
pub async fn list_repository_worktrees(repository_path: String)->Result<Vec<Worktree>,String> {list(&primary(&repository_path)?)}
#[tauri::command]
pub async fn create_repository_worktree(repository_path: String, branch_name: String)->Result<Worktree,String> {let _guard=MUTATION.get_or_init(||Mutex::new(())).lock().map_err(|_|"Worktree mutation unavailable.")?;create(&crate::git::repository_root(&repository_path)?,&branch_name)}
#[tauri::command]
pub async fn remove_repository_worktree(repository_path: String, worktree_path: String)->Result<(),String> {let _guard=MUTATION.get_or_init(||Mutex::new(())).lock().map_err(|_|"Worktree mutation unavailable.")?;if crate::git::repository_root(&repository_path)? == Path::new(&worktree_path) {return Err("Switch to another checkout before removal.".into());} remove(&primary(&repository_path)?,Path::new(&worktree_path))}

// Local isolated workspaces. No network, forced deletion, branch deletion or auto-run.
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    struct Fixture(std::path::PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("axiom-worktree-{}-{}", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
            fs::create_dir(&path).unwrap();
            assert!(Command::new("git").args(["init", "-b", "main"]).arg(&path).output().unwrap().status.success());
            fs::write(path.join("file.txt"), "original\n").unwrap();
            fs::write(path.join(".gitignore"), "ignored.txt\n").unwrap();
            assert!(Command::new("git").arg("-C").arg(&path).args(["add", "."]).output().unwrap().status.success());
            assert!(Command::new("git").arg("-C").arg(&path).args(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-m", "fixture"]).output().unwrap().status.success());
            Self(fs::canonicalize(path).unwrap())
        }
    }
    impl Drop for Fixture { fn drop(&mut self) { let _=fs::remove_dir_all(managed_parent(&self.0)); let _=fs::remove_dir_all(&self.0); } }
    #[test]
    fn creates_isolated_branch_and_removes_only_clean_checkout_preserving_branch() {
        let f=Fixture::new();
        let created=create(&f.0,"axiom/one").unwrap();
        let target=std::path::PathBuf::from(&created.path);
        assert_eq!(fs::read_to_string(target.join("file.txt")).unwrap(),"original\n");
        assert_eq!(list(&f.0).unwrap().len(),1);
        fs::write(target.join("file.txt"),"changed\n").unwrap();
        assert_eq!(fs::read_to_string(f.0.join("file.txt")).unwrap(),"original\n");
        assert!(remove(&f.0,&target).is_err());
        fs::write(target.join("file.txt"),"original\n").unwrap();
        fs::write(target.join("untracked.txt"),"keep").unwrap();
        assert!(remove(&f.0,&target).is_err());
        fs::remove_file(target.join("untracked.txt")).unwrap();
        remove(&f.0,&target).unwrap();
        assert!(!target.exists());
        assert!(git(&f.0,&["show-ref","--verify","refs/heads/axiom/one"]).is_ok());
        assert!(f.0.join("file.txt").exists());
    }
    #[test]
    fn refuses_index_flags_that_can_hide_modified_files() {
        for (index, flag) in ["--assume-unchanged", "--skip-worktree"].iter().enumerate() {
            let f=Fixture::new();
            let row=create(&f.0,&format!("axiom/hidden-{index}")).unwrap();
            let target=PathBuf::from(row.path);
            git(&target,&["update-index",flag,"file.txt"]).unwrap();
            fs::write(target.join("file.txt"),"hidden edits must survive\n").unwrap();
            assert!(remove(&f.0,&target).is_err(),"must refuse {flag}");
            assert_eq!(fs::read_to_string(target.join("file.txt")).unwrap(),"hidden edits must survive\n");
        }
    }
    #[test]
    fn rejects_existing_or_invalid_branch_and_unmanaged_or_foreign_removal() {
        let f=Fixture::new(); let other=Fixture::new();
        for branch in ["main","../escape","-bad","bad name",""] { assert!(create(&f.0,branch).is_err()); }
        assert!(remove(&f.0,&f.0).is_err());
        let foreign=create(&other.0,"axiom/foreign").unwrap();
        assert!(remove(&f.0,std::path::Path::new(&foreign.path)).is_err());
    }
    #[test]
    fn refuses_ignored_files_and_never_executes_checkout_hook() {
        let f=Fixture::new();
        #[cfg(unix)] {
            use std::os::unix::fs::PermissionsExt;
            let hook=f.0.join(".git/hooks/post-checkout");
            fs::write(&hook,format!("#!/bin/sh\ntouch '{}'\n",f.0.join("HOOK_RAN").display())).unwrap();
            fs::set_permissions(&hook,fs::Permissions::from_mode(0o755)).unwrap();
        }
        let created=create(&f.0,"axiom/hooks").unwrap();
        assert!(!f.0.join("HOOK_RAN").exists());
        let target=std::path::PathBuf::from(created.path);
        git(&f.0,&["worktree","lock",target.to_str().unwrap()]).unwrap();
        assert!(remove(&f.0,&target).is_err());
        git(&f.0,&["worktree","unlock",target.to_str().unwrap()]).unwrap();
        fs::write(target.join(".gitignore"),"ignored.txt\n").unwrap();
        fs::write(target.join("ignored.txt"),"must retain").unwrap();
        assert!(remove(&f.0,&target).is_err());
    }
    #[test]
    fn refuses_a_recorded_checkout_replaced_by_an_unrelated_repository() {
        let f=Fixture::new();let other=Fixture::new();let row=create(&f.0,"axiom/replaced").unwrap();let target=PathBuf::from(&row.path);
        fs::remove_dir_all(&target).unwrap();fs::rename(&other.0,&target).unwrap();
        assert!(list(&f.0).is_err());assert!(remove(&f.0,&target).is_err());
        assert_eq!(fs::read_to_string(target.join("file.txt")).unwrap(),"original\n");
    }
    #[cfg(unix)]
    #[test]
    fn does_not_execute_configured_checkout_filter() {
        let f=Fixture::new();
        fs::write(f.0.join(".gitattributes"),"file.txt filter=fixture\n").unwrap();
        git(&f.0,&["config","filter.fixture.smudge",&format!("touch '{}'; cat",f.0.join("FILTER_RAN").display())]).unwrap();
        git(&f.0,&["add",".gitattributes"]).unwrap();
        git(&f.0,&["-c","user.name=Fixture","-c","user.email=fixture@example.invalid","-c","commit.gpgsign=false","commit","-m","filter fixture"]).unwrap();
        create(&f.0,"axiom/filter").unwrap();assert!(!f.0.join("FILTER_RAN").exists());
    }
    #[test]
    fn creates_from_selected_worktree_commit_instead_of_primary_head() {
        let f=Fixture::new();let first=create(&f.0,"axiom/source").unwrap();let source=PathBuf::from(&first.path);
        fs::write(source.join("file.txt"),"source commit\n").unwrap();
        git(&source,&["add","file.txt"]).unwrap();
        git(&source,&["-c","user.name=Fixture","-c","user.email=fixture@example.invalid","-c","commit.gpgsign=false","commit","-m","isolated source"]).unwrap();
        let second=create(&source,"axiom/derived").unwrap();
        assert_eq!(fs::read_to_string(Path::new(&second.path).join("file.txt")).unwrap(),"source commit\n");
        assert_eq!(fs::read_to_string(f.0.join("file.txt")).unwrap(),"original\n");
        assert_eq!(list(&f.0).unwrap().len(),2);
    }
}
#[cfg(test)]
mod additional_tests {
    use super::*;
    #[cfg(unix)]
    #[test]
    fn refuses_symlinked_worktree_parent() {
        use std::os::unix::fs::symlink;
        let base=std::env::temp_dir().join(format!("axiom-worktree-link-{}",std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir(&base).unwrap(); let root=base.join("repository");fs::create_dir(&root).unwrap();let root=fs::canonicalize(root).unwrap();let other=base.join("other");fs::create_dir(&other).unwrap();symlink(&other,managed_parent(&root)).unwrap();
        assert!(checked_parent(&root,true).is_err());assert!(other.exists());fs::remove_file(managed_parent(&root)).unwrap();fs::remove_dir_all(base).unwrap();
    }
}
