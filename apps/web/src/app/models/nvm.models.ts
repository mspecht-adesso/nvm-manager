export type NvmCommandResult = {
  stdout: string;
  stderr: string;
};

export type RemoteNodeVersion = {
  version: string;
  lts: string | null;
};

export type RemoteVersionsResponse = NvmCommandResult & {
  versions: RemoteNodeVersion[];
};

export type NvmStatus = {
  ok: boolean;
  nvmVersion?: string;
  nvmDir?: string;
  error?: string;
};

export type InstalledNodeVersion = {
  version: string;
  active: boolean;
  default: boolean;
  system: boolean;
};

export type InstalledVersionsResponse = NvmCommandResult & {
  versions: InstalledNodeVersion[];
};

export type NvmAlias = {
  name: string;
  target: string;
  resolved: string | null;
  editable: boolean;
  deletable: boolean;
};

export type AliasesResponse = NvmCommandResult & {
  aliases: NvmAlias[];
};
