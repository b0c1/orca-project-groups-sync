# Orca Project Groups Sync

An [Orca](https://github.com/b0c1/orca) plugin that mirrors your sidebar project groups to a JSON file and back, so you can edit groups by hand or share them between devices through a synced folder.

- Drag projects between groups in the sidebar as usual; the file updates.
- Edit the file by hand, then run **Project Groups: Sync Now** (or change anything in the sidebar).
- Deleting a group moves its projects to the default (ungrouped) section, on every device.

## Requirements

Needs an Orca build with the `projects:organize` plugin capability (host API 1.1). Older Orca versions refuse the manifest.

## Install

Orca → Settings → Plugins → Install from git URL:

```
https://github.com/b0c1/orca-project-groups-sync.git
```

Or clone it and install from the local path. Approve the requested capabilities when asked.

## Configuration

`~/.orca/project-groups.json`:

```json
{
  "syncFile": "D:/OneDrive/orca/project-groups.json",
  "groups": {
    "Work": ["github.com/acme/api", "github.com/acme/web"],
    "Personal": ["notes"]
  }
}
```

Projects are matched by git remote (`host/owner/repo`), or by display name when there is none.

### Syncing between devices

Set `syncFile` on each device to a file inside a folder that is already synced (OneDrive, Dropbox, iCloud Drive, a git checkout). The groups then live in that file instead of the local one. Changes made on both devices since the last sync are merged; a group deleted on either side is deleted everywhere, and its projects land in the default group. A project that exists only on one device keeps its group assignment in the shared file.

Groups imported from a folder or SSH root are device-specific and are left untouched.

## Limits

- Sync runs on every project-group change and on the **Sync Now** command; the file is not watched continuously.
- Only group names and membership sync. Order, colour and nesting stay per device.
- Two devices writing the shared file at the same moment is left to the sync service's conflict handling.

## Development

```
npm test
```

The merge logic lives in `sync-plan.mjs` and is pure; `main.mjs` does the file and host I/O.

## License

MIT
