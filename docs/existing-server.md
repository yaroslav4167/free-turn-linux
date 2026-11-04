# Existing VPS installations

The SSH wizard checks for the managed `/opt/free-turn-proxy` binary, known
systemd units (`freeturn-server`, `free-turn-server`, `free-turn-proxy`, and
`vk-turn-proxy`), and common `freeturn-server` installation paths. It repeats
the check before installation. Detection is read-only; it does not execute
unknown binaries or source their configuration files.

If an installation is found, the wizard skips installation, WireGuard setup,
and server startup. Enter the existing connection parameters, authorized client
ID, obfuscation key, and client WireGuard/AmneziaWG configuration to save a
local profile. These values are not recovered automatically. SSH management is
not attached to this profile, so it cannot accidentally reconfigure an unknown
installation layout.

Custom service names, container-only deployments, and nonstandard paths may not
be detected. For these, add/import an existing profile instead of deploying a
new VPS.

Deleting a profile from the application's server list removes only local data.
The separate **Uninstall from VPS** management action removes the remote managed
installation and can affect every profile using that same installation.
