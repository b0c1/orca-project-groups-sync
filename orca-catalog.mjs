// Project catalog over the local Orca RPC, shaped for sync-plan.mjs.
import { call } from './orca-rpc.mjs'

// Folder-backed groups are device-specific and deleting one removes its folder workspaces.
function isFolderBacked(group, folderWorkspaceGroupIds) {
  return (
    group.parentPath != null || Boolean(group.connectionId) || folderWorkspaceGroupIds.has(group.id)
  )
}

export async function listCatalog() {
  const [{ groups }, { repos }, { folderWorkspaces }] = await Promise.all([
    call('projectGroup.list'),
    call('repo.list'),
    call('folderWorkspace.list')
  ])
  const owners = new Set(folderWorkspaces.map((workspace) => workspace.projectGroupId))
  return {
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      folderBacked: isFolderBacked(group, owners)
    })),
    projects: repos.map((repo) => ({
      id: repo.id,
      displayName: repo.displayName,
      remoteKey: repo.gitRemoteIdentity?.canonicalKey ?? null,
      groupId: repo.projectGroupId ?? null
    }))
  }
}

export async function createGroup(name) {
  const { group } = await call('projectGroup.create', { name })
  return group.id
}

export async function deleteGroup(groupId) {
  await call('projectGroup.delete', { groupId })
}

export async function moveToGroup(projectId, groupId) {
  await call('projectGroup.moveProject', { repo: `id:${projectId}`, groupId })
}
