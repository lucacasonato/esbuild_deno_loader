use std::path::PathBuf;

use deno_lockfile::NewLockfileOptions;
use deno_semver::jsr::JsrDepPackageReq;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmLockfile {
  inner: deno_lockfile::Lockfile,
}

#[wasm_bindgen]
impl WasmLockfile {
  #[wasm_bindgen(constructor)]
  pub fn new(
    file_path: String,
    content: String,
  ) -> Result<WasmLockfile, JsError> {
    let lockfile = deno_lockfile::Lockfile::new(NewLockfileOptions {
      file_path: PathBuf::from(file_path),
      content: &content,
      overwrite: false,
    })?;
    Ok(Self { inner: lockfile })
  }

  pub fn package_version(
    &self,
    specifier: &str,
  ) -> Result<Option<String>, JsError> {
    let dep = JsrDepPackageReq::from_str(specifier)?;
    Ok(self.inner.content.packages.specifiers.get(&dep).cloned())
  }
}
