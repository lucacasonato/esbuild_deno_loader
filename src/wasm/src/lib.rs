use std::path::PathBuf;
use std::rc::Rc;

use deno_config::deno_json::ConfigParseOptions;
use deno_config::deno_json::NodeModulesDirMode;
use deno_config::fs::DenoConfigFs;
use deno_config::fs::FsMetadata;
use deno_config::workspace::CreateResolverOptions;
use deno_config::workspace::MappedResolution;
use deno_config::workspace::SpecifiedImportMap;
use deno_config::workspace::Workspace;
use deno_config::workspace::WorkspaceDirectory;
use deno_config::workspace::WorkspaceDiscoverOptions;
use deno_config::workspace::WorkspaceDiscoverStart;
use deno_config::workspace::WorkspaceResolver;
use deno_lockfile::NewLockfileOptions;
use deno_package_json::PackageJsonDepValue;
use deno_semver::jsr::JsrDepPackageReq;
use serde::Deserialize;
use url::Url;
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

#[wasm_bindgen]
pub struct WasmWorkspace {
  inner: Rc<Workspace>,
}

#[wasm_bindgen]
impl WasmWorkspace {
  #[wasm_bindgen]
  pub fn discover(
    entrypoints: Vec<String>,
    is_config_file: bool,
  ) -> Result<WasmWorkspace, JsError> {
    let entrypoints: Vec<_> =
      entrypoints.into_iter().map(|s|PathBuf::from(s.replace('\\', "/"))).collect();
    let opts = WorkspaceDiscoverOptions {
      fs: &WasmFs,
      deno_json_cache: None,
      pkg_json_cache: None,
      workspace_cache: None,
      config_parse_options: ConfigParseOptions::default(),
      additional_config_file_names: &[],
      discover_pkg_json: true,
      maybe_vendor_override: None,
    };
    let start = if is_config_file {
      assert_eq!(entrypoints.len(), 1);
      WorkspaceDiscoverStart::ConfigFile(entrypoints.get(0).unwrap())
    } else {
      WorkspaceDiscoverStart::Paths(&entrypoints)
    };
    let workspace = WorkspaceDirectory::discover(start, &opts)
      .map_err(|err| JsError::new(&format!("{:#?}", err)))?;
    Ok(Self {
      inner: workspace.workspace,
    })
  }

  #[wasm_bindgen]
  pub fn lock_path(&self) -> Result<Option<String>, JsError> {
    self
      .inner
      .resolve_lockfile_path()
      .map_err(|err| JsError::new(&format!("{:#?}", err)))
      .map(|p| p.map(|p| p.to_string_lossy().to_string()))
  }

  #[wasm_bindgen]
  pub fn node_modules_dir(&self) -> Result<String, JsError> {
    let node_modules_dir = self
      .inner
      .node_modules_dir()
      .map_err(|err| JsError::new(&format!("{:#?}", err)))?;

    let node_modules_dir = match node_modules_dir {
      Some(dir) => dir,
      None => match self.inner.root_pkg_json().is_some() {
        true => NodeModulesDirMode::Manual,
        false => NodeModulesDirMode::None,
      },
    };
    Ok(node_modules_dir.as_str().to_string())
  }

  #[wasm_bindgen]
  pub fn resolver(
    &self,
    import_map_url: Option<String>,
    import_map_value: JsValue,
  ) -> Result<WasmWorkspaceResolver, JsError> {
    let specified_import_map = if let Some(import_map_url) = import_map_url {
      let base_url = Url::parse(&import_map_url)?;
      let value: serde_json::Value =
        serde_wasm_bindgen::from_value(import_map_value)?;
      Some(SpecifiedImportMap { base_url, value })
    } else {
      None
    };

    let opts = CreateResolverOptions {
      specified_import_map,
      pkg_json_dep_resolution:
        deno_config::workspace::PackageJsonDepResolution::Enabled,
    };
    let resolver = self
      .inner
      .create_resolver(opts, |path| Ok(WasmFs.read_to_string_lossy(path)?))?;
    Ok(WasmWorkspaceResolver { inner: resolver })
  }
}

#[wasm_bindgen]
pub struct WasmWorkspaceResolver {
  inner: WorkspaceResolver,
}

#[wasm_bindgen]
impl WasmWorkspaceResolver {
  #[wasm_bindgen]
  pub fn resolve(
    &self,
    specifier: &str,
    referrer: &str,
  ) -> Result<String, JsError> {
    let referrer = Url::parse(referrer)?;
    let resolved = self.inner.resolve(specifier, &referrer)?;
    match resolved {
      MappedResolution::Normal { specifier, .. }
      | MappedResolution::ImportMap { specifier, .. }
      | MappedResolution::WorkspaceJsrPackage { specifier, .. } => {
        Ok(specifier.to_string())
      }
      MappedResolution::WorkspaceNpmPackage { .. } => {
        Err(JsError::new("WorkspaceNpmPackage is not supported"))
      }
      MappedResolution::PackageJson {
        dep_result,
        sub_path,
        ..
      } => {
        let result = dep_result
          .as_ref()
          .map_err(|e| JsError::new(&e.to_string()))?;

        match result {
          PackageJsonDepValue::Workspace { .. } => {
            Err(JsError::new("Workspace dep is not supported"))
          }
          PackageJsonDepValue::Req(req) => Ok(format!(
            "npm:{}@{}{}",
            req.name,
            req.version_req,
            sub_path.map(|p| format!("/{}", p)).unwrap_or_default()
          )),
        }
      }
    }
  }
}

#[wasm_bindgen(module = "/fs.js")]
extern "C" {
  #[wasm_bindgen(catch)]
  fn stat_sync(path: &str) -> Result<JsValue, JsValue>;
  #[wasm_bindgen(catch)]
  fn read_to_string_lossy(path: &str) -> Result<String, JsValue>;
  #[wasm_bindgen(catch)]
  fn read_dir(path: &str) -> Result<JsValue, JsValue>;
}

#[derive(Debug, Default, Clone, Deserialize)]
pub struct WasmFsMetadata {
  pub is_file: bool,
  pub is_directory: bool,
  pub is_symlink: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WasmFsDirEntry {
  pub name: String,
  #[serde(flatten)]
  pub metadata: WasmFsMetadata,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Error {
  pub message: String,
  pub code: Option<String>,
}

struct WasmFs;

impl DenoConfigFs for WasmFs {
  fn stat_sync(
    &self,
    path: &std::path::Path,
  ) -> Result<FsMetadata, std::io::Error> {
    let path = path.to_string_lossy().to_string();
    let value = stat_sync(&path).map_err(map_err)?;
    let metadata: WasmFsMetadata =
      serde_wasm_bindgen::from_value(value).unwrap();
    Ok(FsMetadata {
      is_file: metadata.is_file,
      is_directory: metadata.is_directory,
      is_symlink: metadata.is_symlink,
    })
  }

  fn read_to_string_lossy(
    &self,
    path: &std::path::Path,
  ) -> Result<String, std::io::Error> {
    let path = path.to_string_lossy().to_string();
    let value = read_to_string_lossy(&path).map_err(map_err)?;
    Ok(value)
  }

  fn read_dir(
    &self,
    path: &std::path::Path,
  ) -> Result<Vec<deno_config::fs::FsDirEntry>, std::io::Error> {
    let path2 = path.to_string_lossy().to_string();
    let bytes = read_dir(&path2).map_err(map_err)?;
    let entries: Vec<WasmFsDirEntry> =
      serde_wasm_bindgen::from_value(bytes).unwrap();
    Ok(
      entries
        .into_iter()
        .map(|entry| deno_config::fs::FsDirEntry {
          path: path.join(entry.name),
          metadata: FsMetadata {
            is_file: entry.metadata.is_file,
            is_directory: entry.metadata.is_directory,
            is_symlink: entry.metadata.is_symlink,
          },
        })
        .collect(),
    )
  }
}

fn map_err(err: JsValue) -> std::io::Error {
  let error: Error = serde_wasm_bindgen::from_value(err).unwrap();
  let kind = match error.code {
    Some(code) => match code.as_str() {
      "ENOENT" => std::io::ErrorKind::NotFound,
      _ => std::io::ErrorKind::Other,
    },
    None => std::io::ErrorKind::Other,
  };
  std::io::Error::new(kind, error.message)
}
