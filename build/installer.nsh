; FasoBar NSIS hooks — keep uninstall from wiping local sales / SQLite.
; User data lives in %APPDATA%\FasoBar (Electron userData).
; deleteAppDataOnUninstall is false in electron-builder.yml; reinforce here.
;
; Branding: Programs & Features DisplayIcon must resolve to FasoBar.exe
; (embedded multi-res ICO), not a loose sidecar that can get out of sync.

!macro customInstall
  WriteRegStr SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayIcon" "$appExe,0"
!macroend

!macro customUnInstall
  DetailPrint "Conservation des donnees locales FasoBar (%APPDATA%\\FasoBar)."
!macroend
