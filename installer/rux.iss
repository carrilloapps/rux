; Inno Setup script for the rux Windows installer.
;
; Built by .github/workflows/release.yml, which passes the version in:
;   ISCC.exe /DAppVersion=1.0.0 installer\rux.iss
;
; The installer adds rux to the user's PATH so it works from any terminal, and
; installs per-user by default so it needs no administrator rights.

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

#define AppName "rux"
#define AppPublisher "Jose Carrillo"
#define AppUrl "https://github.com/carrilloapps/rux"
#define AppLauncher "rux.cmd"

[Setup]
AppId={{9F1C4E2A-7B3D-4A56-9C81-2E5D7F0A3B64}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppUrl}
AppSupportURL={#AppUrl}/issues
AppUpdatesURL={#AppUrl}/releases
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoDescription=Windows system inspector and cleaner
VersionInfoCopyright=Copyright (c) 2026 {#AppPublisher}

DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
AllowNoIcons=yes

; Per-user by default: no elevation prompt for a command line tool.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog commandline

OutputDir=..\build
OutputBaseFilename=rux-{#AppVersion}-setup
SetupIconFile=
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
LicenseFile=..\LICENSE
UninstallDisplayName={#AppName} {#AppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "addtopath"; Description: "{cm:AddToPath}"; GroupDescription: "{cm:AdditionalTasks}"

[Files]
; The staged folder holds the embedded Node runtime, the bundled application and
; the launchers. See scripts/package-windows.mjs for why the runtime ships beside
; the app rather than being packed into a single executable.
Source: "..\build\stage\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{cmd}"; Parameters: "/k ""{app}\{#AppLauncher}"" --help"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"

[Run]
Filename: "{cmd}"; Parameters: "/k ""{app}\{#AppLauncher}"" --help"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: postinstall skipifsilent unchecked

[CustomMessages]
english.AddToPath=Add rux to the PATH environment variable
english.AdditionalTasks=Additional tasks
spanish.AddToPath=Agregar rux a la variable de entorno PATH
spanish.AdditionalTasks=Tareas adicionales

[Code]
const
  EnvironmentKeyUser = 'Environment';
  EnvironmentKeyMachine = 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment';

function EnvironmentRootKey(): Integer;
begin
  if IsAdminInstallMode then
    Result := HKEY_LOCAL_MACHINE
  else
    Result := HKEY_CURRENT_USER;
end;

function EnvironmentSubKey(): string;
begin
  if IsAdminInstallMode then
    Result := EnvironmentKeyMachine
  else
    Result := EnvironmentKeyUser;
end;

{ Reads PATH, appends the install directory once, and writes it back.
  A semicolon is added around the comparison so a directory whose name is a
  prefix of another entry is not mistaken for an existing one. }
procedure AddDirectoryToPath(const Directory: string);
var
  CurrentPath: string;
  Haystack: string;
  Needle: string;
begin
  if not RegQueryStringValue(EnvironmentRootKey(), EnvironmentSubKey(), 'Path', CurrentPath) then
    CurrentPath := '';

  Haystack := ';' + Uppercase(CurrentPath) + ';';
  Needle := ';' + Uppercase(Directory) + ';';
  if Pos(Needle, Haystack) > 0 then
    exit;

  if (CurrentPath <> '') and (CurrentPath[Length(CurrentPath)] <> ';') then
    CurrentPath := CurrentPath + ';';

  RegWriteExpandStringValue(EnvironmentRootKey(), EnvironmentSubKey(), 'Path', CurrentPath + Directory);
end;

procedure RemoveDirectoryFromPath(const Directory: string);
var
  CurrentPath: string;
  Haystack: string;
  Needle: string;
  Position: Integer;
begin
  if not RegQueryStringValue(EnvironmentRootKey(), EnvironmentSubKey(), 'Path', CurrentPath) then
    exit;

  Haystack := ';' + Uppercase(CurrentPath) + ';';
  Needle := ';' + Uppercase(Directory) + ';';
  Position := Pos(Needle, Haystack);
  if Position = 0 then
    exit;

  Delete(CurrentPath, Position, Length(Directory) + 1);
  RegWriteExpandStringValue(EnvironmentRootKey(), EnvironmentSubKey(), 'Path', CurrentPath);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and WizardIsTaskSelected('addtopath') then
    AddDirectoryToPath(ExpandConstant('{app}'));
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
    RemoveDirectoryFromPath(ExpandConstant('{app}'));
end;
